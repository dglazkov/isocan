import { FIDELITY_PROP, groupContentBox, groupDescendants, newGroupId, newItemId, newVersionId, type CanvasContents, type Item, type Operation } from "@isocan/core";
import { RECIPES } from "./catalog/index.ts";
import { JEV_INPUT_PRICE, type Answerer, type JevResponse } from "./answerer.ts";
import {
  applyPropsRound, applyStructure, decideFlow, flowScreen, pendingRound, requestBlueprint, roundCalls,
  type FlowDecision, type RoundCall,
} from "./compose.ts";
import { currentVersionOf, type WirePort } from "./port.ts";
import { readWire, renderWire } from "./render.ts";
import { StyleResolver, governingSystem, mappingLines } from "./restyle.ts";
import { wireBy, wireSize, wireTitle, type WireBy, type WireSpec } from "./spec.ts";
import type { WireStyle } from "./theme.ts";
import { DEFAULT_VARIATIONS, honestFlips, variations } from "./vary.ts";
import { choosePack, flagPack, packLine, type PackChoice } from "./content/choose.ts";
import { fleshSpec, seedKey } from "./content/flesh-spec.ts";
import { packOf } from "./content/fill.ts";
import { maybeProperties } from "./maybe.ts";

/**
 * **A flow, composed in rounds, drawn in place** — the composer both
 * surfaces run (`isocan wire "<request>"`, and the web's `/wire <request>`),
 * over a `WirePort`.
 *
 * The first thing written is a blueprint titled with the request, before any
 * answerer is asked: the first frame a person sees is blue within one round
 * trip of the canvas, not of the model. Round 1 turns it into the first
 * screen and adds a blueprint per remaining archetype in a row; rounds 2 and
 * 3 write `item.addVersion` into those same items, so a screen fills rather
 * than being replaced. Every op carries the flow's id as its group, so one
 * undo takes the whole request back.
 */

const GAP = 80;

export interface Screen {
  item: string;
  spec: WireSpec;
  x: number;
  y: number;
  width: number;
  height: number;
  /** The group the screen's item sits in, if any — where its variations and its prototype go too. */
  containerId?: string;
}

/** Where an added item goes besides its spot: a group, placed exactly where it was asked (Porchlight #2, #6). */
export interface Into {
  containerId: string;
  groupPlacement: "exact";
}

/** The group an item sits in, as the fields an `item.add` carries to land in it too. */
export function intoOf(item: { containerId?: string | undefined } | undefined): Into | undefined {
  return item?.containerId ? { containerId: item.containerId, groupPlacement: "exact" } : undefined;
}

function slugOf(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "screen";
}

/** The canvas half: every write is one of four existing ops, under the flow's group. */
export class FlowCanvas {
  /** Variations this run added, in the order they landed. */
  readonly variants: Screen[] = [];
  /**
   * The governing design system's mapping (design §9), stamped on every spec
   * this canvas writes that has none of its own — so a flow asked for where a
   * system governs arrives in it. Unset: the default look.
   */
  style: WireStyle | undefined;
  /**
   * The group every item this canvas adds lands in — `wire --in <group>`'s,
   * or the source screen's for a variation. Sent as the op's own
   * `containerId` (not inside `placement`), which both surfaces' writers read.
   */
  into: Into | undefined;
  /**
   * The pack a composed flow fills from (design §10): stamped on every
   * screen as round 3 draws it, so the flow arrives fleshed — no second pass.
   */
  pack: PackChoice | undefined;
  /**
   * Who is drawing (`WireSpec.by`): stamped on every spec this canvas writes
   * once an answerer has spoken — the composer sets it when round 1 answers,
   * `wire answer` for an agent, `wire vary` from the screen it varies.
   */
  by: WireBy | undefined;

  constructor(readonly port: WirePort, readonly group: string) {}

  private styled(given: WireSpec, itemId: string): WireSpec {
    const signed = this.by && given.round !== 0 ? { ...given, by: this.by } : given;
    const spec = this.style && signed.style === undefined ? { ...signed, style: this.style } : signed;
    if (!this.pack || spec.round !== 3 || spec.content) return spec;
    return fleshSpec(spec, seedKey(spec, itemId), packOf(this.pack.pack), { p: this.pack.p, by: this.pack.by });
  }

  private async version(spec: WireSpec) {
    const filename = `${slugOf(wireTitle(spec))}.html`;
    const upload = await this.port.put(renderWire(spec), "text/html", filename);
    return { id: newVersionId(), blobHash: upload.blobHash, mimeType: "text/html", filename, size: upload.size };
  }

  private send(op: Operation) {
    return this.port.send(op, this.group);
  }

  async add(given: WireSpec, placement: Record<string, unknown>, into: Into | undefined = this.into): Promise<Screen> {
    const itemId = newItemId();
    const spec = this.styled(given, itemId);
    const { width, height } = wireSize(spec);
    const at = await this.send({
      type: "item.add",
      itemId,
      version: await this.version(spec),
      width,
      height,
      placement: placement as never,
      title: wireTitle(spec),
      // A maybe says so in the op that draws it; the canvas marks it until it is kept (maybe.ts).
      properties: { [FIDELITY_PROP]: "wireframe", ...maybeProperties(spec) },
      ...(into ?? {}),
    });
    const landed = at ?? (placement as { x?: number; y?: number });
    return { item: itemId, spec, x: landed.x ?? 0, y: landed.y ?? 0, width, height, ...(into ? { containerId: into.containerId } : {}) };
  }

  /** A new version of the same item — the screen fills in place — and its title and size if they moved. */
  async write(screen: Screen, given: WireSpec): Promise<Screen> {
    const spec = this.styled(given, screen.item);
    await this.send({ type: "item.addVersion", itemId: screen.item, version: await this.version(spec) });
    // The request's blueprint becomes round 1's first screen in place: if that screen is a maybe, its
    // property rides the same update as its new title — still the composer's act, never a second write.
    const maybe = maybeProperties(spec);
    const retitled = wireTitle(spec) !== wireTitle(screen.spec);
    const newlyMaybe = spec.maybe === true && !screen.spec.maybe;
    if (retitled || newlyMaybe) {
      await this.send({ type: "item.update", itemId: screen.item, patch: { ...(retitled ? { title: wireTitle(spec) } : {}), ...(newlyMaybe ? { properties: maybe } : {}) } });
    }
    const { width, height } = wireSize(spec);
    if (width !== screen.width || height !== screen.height) await this.send({ type: "item.resize", itemId: screen.item, width, height });
    return { ...screen, spec, width, height };
  }
}

/** Where a new flow's row starts when nothing was asked: under everything on the canvas, at its left edge. */
export function rowStart(canvas: CanvasContents): { x: number; y: number; chosen: true } {
  const items = Object.values(canvas.items ?? {});
  if (items.length === 0) return { x: 0, y: 0, chosen: true };
  const left = Math.min(...items.map((i) => i.x));
  const bottom = Math.max(...items.map((i) => i.y + i.height));
  return { x: Math.round(left), y: Math.round(bottom + 160), chosen: true };
}

/**
 * Where a new flow's row starts inside a group: under everything the group
 * already holds (its descendants, nested groups and all), at their left edge —
 * or the group's content corner when it is empty.
 */
export function rowStartIn(canvas: CanvasContents, groupId: string): { x: number; y: number; chosen: true } {
  const group = canvas.items[groupId];
  if (!group) throw new Error(`no group ${groupId} on this canvas`);
  const inside = groupDescendants(canvas, groupId);
  if (inside.length === 0) {
    const box = groupContentBox(group);
    return { x: Math.round(box.x), y: Math.round(box.y), chosen: true };
  }
  const left = Math.min(...inside.map((i) => i.x));
  const bottom = Math.max(...inside.map((i) => i.y + i.height));
  return { x: Math.round(left), y: Math.round(bottom + 160), chosen: true };
}

// ---------- asking

export interface RoundTally {
  round: 1 | 2 | 3;
  calls: number;
  /** Wall clock of the round: its calls run in parallel. */
  ms: number;
  inputTokens: number;
}

/** Told of every round asked — the CLI's `--save` writes the files. */
export type OnAsked = (round: 1 | 2 | 3, calls: RoundCall[], responses: JevResponse[]) => Promise<void>;

export async function ask(answerer: Answerer, round: 1 | 2 | 3, calls: RoundCall[], onAsked?: OnAsked): Promise<{ responses: JevResponse[]; tally: RoundTally; by: string }> {
  const t0 = Date.now();
  let by = answerer.name as string;
  const answered = await Promise.all(calls.map(async (call) => {
    // A screen with nothing left to decide asks nothing — Jev is never sent an empty question set.
    if (Object.keys(call.request.questions).length === 0) return { response: { answers: {} } as JevResponse, asked: false };
    const a = await answerer.answer(call.request);
    by = a.by;
    return { response: a.response, asked: true };
  }));
  const ms = Date.now() - t0;
  const responses = answered.map((a) => a.response);
  await onAsked?.(round, calls, responses);
  return {
    responses,
    by,
    tally: {
      round,
      calls: answered.filter((a) => a.asked).length,
      ms,
      inputTokens: responses.reduce((sum, r) => sum + (r.usage?.input_tokens ?? 0), 0),
    },
  };
}

// ---------- applying

const pct = (p: number | undefined) => (p === undefined ? "—" : p.toFixed(2));

/** What a maybe screen's line says: round 1 was unsure, and the keep decides. */
export const MAYBE_WORDS = "maybe — round 1 was unsure it is needed; keep it (📐) or leave it";

/** A flow's screens by title, a maybe marked — the Chat record's and the CLI's list. */
export function screenTitles(screens: readonly Pick<Screen, "spec">[]): string {
  return screens.map((s) => `${s.spec.title}${s.spec.maybe ? " (maybe)" : ""}`).join(" · ");
}

function describeFlow(d: FlowDecision): string {
  const chosen = d.archetypes.map((a) => `${a.id} ${pct(a.p)}${a.maybe ? " (maybe)" : ""}`).join(", ");
  const declined = d.declined.map((a) => `${a.id} ${pct(a.p)}${a.why === "platform" ? ` (not on ${d.platform})` : ""}`).join(", ");
  return (
    `flow: ${d.platform} ${pct(d.distributions.platform[d.platform])} · nav ${d.chrome.nav} ${pct(d.distributions.nav[d.chrome.nav])}` +
    ` · header ${d.chrome.header} ${pct(d.distributions.header[d.chrome.header])}\n` +
    `  screens: ${chosen}\n  declined: ${declined || "none"}`
  );
}

export function screenLine(s: Screen, note: string): string {
  const open = s.spec.slots.filter((x) => x.block === null).length;
  const state = open === 0 ? "wireframe" : open === s.spec.slots.length ? "blueprint" : `${s.spec.slots.length - open} of ${s.spec.slots.length} slots chosen`;
  return `${s.item}  ${wireTitle(s.spec)} — ${s.spec.archetype}, ${s.spec.platform}, ${state}${note ? ` · ${note}` : ""}`;
}

/**
 * Write one round's answers into the canvas. Round 1 turns the request's
 * blueprint into the first screen and adds the rest beside it in running
 * order; rounds 2 and 3 version each screen in place.
 */
export async function applyRound(
  canvas: FlowCanvas, round: 1 | 2 | 3, screens: Screen[], calls: RoundCall[], responses: JevResponse[], say: (line: string) => void,
): Promise<Screen[]> {
  if (round === 1) {
    const first = screens[0]!;
    const decision = decideFlow(calls[0]!.request, responses[0]!);
    say(describeFlow(decision));
    const specs = decision.archetypes.map((a) => flowScreen(a.id, first.spec.request, first.spec.flow, decision));
    const out: Screen[] = [await canvas.write(first, specs[0]!)];
    for (const spec of specs.slice(1)) {
      const prev = out[out.length - 1]!;
      out.push(await canvas.add(spec, { x: prev.x + prev.width + GAP, y: prev.y, chosen: true }));
    }
    out.forEach((s, i) => say(screenLine(s, `p(yes) ${pct(decision.archetypes[i]!.p)}${s.spec.maybe ? ` · ${MAYBE_WORDS}` : ""}`)));
    return out;
  }
  const specs = round === 2
    ? screens.map((screen, i) => applyStructure(screen.spec, calls[i]!.request, responses[i]!))
    // A screen with no honest alternative says so in the same version that draws it.
    : applyPropsRound(screens.map((s) => s.spec), calls.map((c) => c.request), responses)
        .map((spec) => (honestFlips(spec).length === 0 ? { ...spec, varied: "none" as const } : spec));
  const out: Screen[] = [];
  for (const [i, screen] of screens.entries()) out.push(await canvas.write(screen, specs[i]!));
  if (round === 3) {
    // Variations close the flow, in its op group: one undo still takes it all back.
    for (const s of out) {
      // A maybe waits for its keep before it is varied: over-including is cheap only while each maybe is one screen.
      if (s.spec.maybe) {
        say(screenLine(s, "maybe — no variations until it is kept (`wire vary` draws them)"));
        continue;
      }
      const made = await addVariations(canvas, s, [], DEFAULT_VARIATIONS);
      say(screenLine(s, s.spec.varied === "none" ? "one way to draw this" : `${made.length} variation${made.length === 1 ? "" : "s"}`));
      for (const v of made) say(`  ${screenLine(v, "")}`);
    }
  }
  return out;
}

/**
 * Add a screen's variations directly under it — same x, stacked below the
 * screen and any sibling already there — up to `count` in all.
 */
export async function addVariations(canvas: FlowCanvas, screen: Screen, siblings: readonly Screen[], count: number): Promise<Screen[]> {
  const specs = variations(screen.spec, screen.item, count, siblings.map((v) => v.spec.flip!).filter(Boolean));
  const made: Screen[] = [];
  let bottom = Math.max(screen.y + screen.height, ...siblings.map((v) => v.y + v.height));
  // In the screen's own group, so moving the group takes its variations along (Porchlight #2).
  const into = canvas.into ?? (screen.containerId ? { containerId: screen.containerId, groupPlacement: "exact" as const } : undefined);
  for (const spec of specs) {
    const v = await canvas.add(spec, { x: screen.x, y: bottom + GAP, chosen: true }, into);
    bottom = v.y + v.height;
    made.push(v);
    canvas.variants.push(v);
  }
  return made;
}

// ---------- reading a flow back off the canvas

/** Every wireframe screen on the canvas whose file carries a spec, read back off its current version. */
export async function wiresOn(port: Pick<WirePort, "readText">, canvas: CanvasContents): Promise<Screen[]> {
  const items = Object.values(canvas.items ?? {}).filter((i) => i.properties?.[FIDELITY_PROP] === "wireframe");
  const read = await Promise.all(items.map(async (item) => {
    const current = currentVersionOf(item);
    if (!current || current.mimeType !== "text/html") return null;
    const spec = readWire(await port.readText(current.blobHash));
    return spec ? { item: item.id, spec, x: item.x, y: item.y, width: item.width, height: item.height, ...(item.containerId ? { containerId: item.containerId } : {}) } : null;
  }));
  return read.filter((s): s is Screen => s !== null);
}

/** The flows on the canvas — a variation shares its screen's flow but is not one of its screens. */
export async function flowsOn(port: Pick<WirePort, "readText">, canvas: CanvasContents): Promise<Map<string, Screen[]>> {
  const flows = new Map<string, Screen[]>();
  const order = (s: Screen) => RECIPES.findIndex((r) => r.id === s.spec.archetype);
  for (const s of await wiresOn(port, canvas)) {
    if (!s.spec.flow || s.spec.variantOf) continue;
    flows.set(s.spec.flow, [...(flows.get(s.spec.flow) ?? []), s]);
  }
  for (const list of flows.values()) list.sort((a, b) => order(a) - order(b));
  return flows;
}

export function pickFlow(flows: Map<string, Screen[]>, wanted?: string): { flow: string; screens: Screen[]; round: 1 | 2 | 3 } {
  if (wanted) {
    const screens = flows.get(wanted);
    if (!screens) throw new Error(`no wireframe flow "${wanted}" on this canvas`);
    const round = pendingRound(screens.map((s) => s.spec));
    if (!round) throw new Error(`flow ${wanted} is drawn — every screen has answered all three rounds`);
    return { flow: wanted, screens, round };
  }
  const pending = [...flows.entries()].flatMap(([flow, screens]) => {
    const round = pendingRound(screens.map((s) => s.spec));
    return round ? [{ flow, screens, round }] : [];
  });
  if (pending.length === 0) throw new Error("no wireframe flow on this canvas is waiting on answers — `isocan wire \"<request>\" --answerer agent` starts one");
  // The newest: the last one the snapshot lists.
  return pending[pending.length - 1]!;
}

// ---------- the style a flow arrives in

/**
 * The style a flow starting at this item takes: the mapping of the design
 * system governing its place, or the default when none does — with the lines
 * that say which, for a person.
 */
export async function styleAt(port: WirePort, itemId: string, mapper: StyleResolver): Promise<{ system: Item | null; style: WireStyle; lines: string[] }> {
  const canvas = await port.canvas();
  const item = canvas.items[itemId];
  const system = item ? governingSystem(canvas, item) : null;
  const style = await mapper.styleFor(system);
  if (!system) return { system, style, lines: [] };
  const m = [...mapper.mappings.values()].find((x) => x.system.id === system.id)!;
  const cost = mapper.calls ? ` · ${mapper.inputTokens.toLocaleString("en-US")} input tokens · $${mapper.cost().toFixed(6)}` : "";
  return { system, style, lines: [`style: in the design system that governs here${cost}`, ...mappingLines(m, mapper.who).map((l) => `  ${l}`)] };
}

// ---------- the whole request

export interface ComposeOptions {
  /** Where the first blueprint goes. Default: under everything on the canvas (`rowStart`). */
  placement?: Record<string, unknown>;
  /** Lines for a person, as the flow is drawn. */
  say?: (line: string) => void;
  /** The blueprint is on the canvas, before any answer — the first frame. */
  onBlueprint?: (screen: Screen, ms: number, flow: string) => void | Promise<void>;
  onAsked?: OnAsked;
  /** Who maps the governing design system's tokens (design §9). Default: `answerer`. */
  mappingAnswerer?: Answerer;
  /** Told of the mapping, if one is asked — the CLI's `--save`. */
  onMappingAsked?: ConstructorParameters<typeof StyleResolver>[3];
  /**
   * Sample content (design §10), **on by default** (24 Sep 2026: a person
   * composing expects the words, not a second act to ask for them): the
   * screens land grey in round 2 and arrive fleshed in round 3, from the
   * pack chosen while round 1 is asked — one call more — or `pack` when
   * given. `false` is `--basic` (`/wire basic …`): plain grey wires, as
   * before, for `wire flesh` later.
   */
  flesh?: { pack?: string } | false;
}

export interface Composed {
  flow: string;
  screens: Screen[];
  variants: Screen[];
  tallies: RoundTally[];
  /** Who answered the rounds — the versioned model when it said. */
  by: string;
  firstMs: number;
  totalMs: number;
  style: WireStyle | undefined;
  mapper: StyleResolver;
  /** The pack the flow was filled from — absent for `--basic`, or when none could be chosen. */
  pack?: PackChoice;
}

/** Start a flow: the request's blueprint, alone, before anybody is asked anything. */
export async function startFlow(port: WirePort, request: string, placement?: Record<string, unknown>): Promise<{ canvas: FlowCanvas; first: Screen; flow: string }> {
  const flow = newGroupId();
  const canvas = new FlowCanvas(port, flow);
  const { containerId, groupPlacement, ...spot } = (placement ?? rowStart(await port.canvas())) as Record<string, unknown> & { containerId?: string; groupPlacement?: string };
  // The whole flow joins the group, at exactly the spots the row computes.
  if (typeof containerId === "string") canvas.into = { containerId, groupPlacement: "exact" };
  // `--in <group>` without `--at`: under everything already in the group, as a
  // flow at the root goes under everything on the canvas — not in the first gap
  // the first screen fits, from which the row would run over what is beside it
  // (Porchlight #1: a second flow laid across the first's variations).
  const where = typeof containerId === "string" && groupPlacement !== "exact" ? rowStartIn(await port.canvas(), containerId) : spot;
  const first = await canvas.add(requestBlueprint(request, flow), where);
  return { canvas, first, flow };
}

/** `wire "<request>"`, whole: the blueprint, the three rounds, the variations — one op group. */
export async function composeFlow(port: WirePort, request: string, answerer: Answerer, opts: ComposeOptions = {}): Promise<Composed> {
  const say = opts.say ?? (() => {});
  const t0 = Date.now();
  const { canvas, first, flow } = await startFlow(port, request, opts.placement);
  const firstMs = Date.now() - t0;
  await opts.onBlueprint?.(first, firstMs, flow);
  // The governing design system's mapping is asked for while round 1 is (design §9): a flow
  // asked for where a system governs arrives in it, and the wait is the longer of the two.
  const mapper = new StyleResolver(port, opts.mappingAnswerer ?? answerer, async () => (await wiresOn(port, await port.canvas())).map((s) => s.spec), opts.onMappingAsked);
  const styling = styleAt(port, first.item, mapper);
  styling.catch(() => {});
  // The pack is one more question, asked beside round 1 — the wait is the longer of the two.
  // A pack that cannot be chosen is not a flow that cannot be drawn: it arrives in bars, and says so.
  const fleshWith = opts.flesh === false ? undefined : (opts.flesh ?? {});
  const choosing: Promise<PackChoice | Error> | undefined = fleshWith
    ? (fleshWith.pack !== undefined ? Promise.resolve(flagPack(fleshWith.pack)) : choosePack(answerer, request)).catch((e: unknown) => (e instanceof Error ? e : new Error(String(e))))
    : undefined;
  let screens = [first];
  const tallies: RoundTally[] = [];
  let by = answerer.name as string;
  for (const round of [1, 2, 3] as const) {
    const calls = roundCalls(round, screens);
    const asked = await ask(answerer, round, calls, opts.onAsked);
    tallies.push(asked.tally);
    by = asked.by;
    // Signed by whoever answered this round — a home that fell back to the stub says so on the screens too.
    canvas.by = wireBy(by, port.actor);
    if (round === 1) {
      const styled = await styling;
      canvas.style = styled.system ? styled.style : undefined;
      for (const line of styled.lines) say(line);
    }
    if (round === 3 && choosing) {
      const chosen = await choosing;
      if (chosen instanceof Error) {
        say(`no pack: ${chosen.message} — the screens stay in grey bars; \`wire flesh\` fills them later`);
      } else {
        canvas.pack = chosen;
        say(packLine(chosen, "the screens arrive fleshed"));
        // Its one call was asked beside round 1, so it counts there.
        if (chosen.how === "asked" && tallies[0]) {
          tallies[0].calls += 1;
          tallies[0].inputTokens += chosen.inputTokens ?? 0;
        }
      }
    }
    screens = await applyRound(canvas, round, screens, calls, asked.responses, say);
  }
  return { flow, screens, variants: canvas.variants, tallies, by, firstMs, totalMs: Date.now() - t0, style: canvas.style, mapper, ...(canvas.pack ? { pack: canvas.pack } : {}) };
}

/** The closing line of a flow, for a person. */
export function costLine(tallies: readonly RoundTally[], by: string, screens: number, maybe = 0): string {
  const tokens = tallies.reduce((s, t) => s + t.inputTokens, 0);
  const calls = tallies.reduce((s, t) => s + t.calls, 0);
  const rounds = tallies.map((t) => `round ${t.round} ${t.ms} ms`).join(" · ");
  return `${screens} screens${maybe ? ` (${maybe} maybe)` : ""}, one op group — answered by ${by} · ${rounds} · ${calls} calls · ${tokens.toLocaleString("en-US")} input tokens · $${(tokens * JEV_INPUT_PRICE).toFixed(6)}`;
}
