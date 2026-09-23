import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import { FIDELITY_PROP, newGroupId, newItemId, newVersionId, type CanvasSnapshotResponse, type Item, type Operation } from "@isocan/core";
import type { CliHost } from "@isocan/cli/modulehost";
import { RECIPES } from "./catalog/index.ts";
import { JEV_INPUT_PRICE, jevAnswerer, stubAnswerer, type Answerer, type JevResponse } from "./answerer.ts";
import {
  answeredResponse, applyPropsRound, applyStructure, decideFlow, flowScreen, pendingRound, requestBlueprint, roundCalls,
  type FlowDecision, type RoundCall, type RoundFile,
} from "./compose.ts";
import { readWire, renderWire } from "./render.ts";
import { wireSize, wireTitle, type WireSpec } from "./spec.ts";
import { DEFAULT_VARIATIONS, honestFlips, variations } from "./vary.ts";
import { StyleResolver, governingSystem, mappingAnswerer, mappingLines } from "./style-cli.ts";
import type { WireStyle } from "./theme.ts";

/**
 * **`isocan wire "<request>"` — a flow, composed in rounds, drawn in place.**
 *
 * The first thing written is a blueprint titled with the request, before
 * any answerer is asked: the first frame a person sees is blue within one
 * round trip of the daemon, not of the model. Round 1 turns it into the
 * first screen and adds a blueprint per remaining archetype in a row; rounds
 * 2 and 3 write `item.addVersion` into those same items, so a screen fills
 * rather than being replaced. Every op carries the flow's id as its group,
 * so one `isocan undo` takes the whole request back — including when an
 * agent answers the rounds across several invocations.
 *
 * The canvas is the only state. `wire questions` reads the flow's screens
 * back (each carries its spec, with the round it has reached) and prints the
 * pending round; `wire answer` applies a file of answers to it. Nothing is
 * kept on this machine between the two.
 */

const GAP = 80;

export type Ctx = Awaited<ReturnType<CliHost["ctxOf"]>>;

export interface Screen {
  item: string;
  spec: WireSpec;
  x: number;
  y: number;
  width: number;
  height: number;
}

function slugOf(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "screen";
}

/** The canvas half: every write is one of three existing ops, under the flow's group. */
export class FlowCanvas {
  /** Variations this invocation added, in the order they landed. */
  readonly variants: Screen[] = [];
  /**
   * The governing design system's mapping (design §9), stamped on every spec
   * this canvas writes that has none of its own — so a flow asked for where a
   * system governs arrives in it. Unset: the default look.
   */
  style: WireStyle | undefined;
  /** Merged into every placement this canvas adds at — a group's membership, for `wire --in <group>`. */
  placeIn: Record<string, unknown> = {};

  constructor(
    private host: CliHost,
    private ctx: Ctx,
    private canvasId: string,
    readonly group: string,
  ) {}

  private styled(spec: WireSpec): WireSpec {
    return this.style && spec.style === undefined ? { ...spec, style: this.style } : spec;
  }

  private async version(spec: WireSpec) {
    const html = renderWire(spec);
    const filename = `${slugOf(wireTitle(spec))}.html`;
    const upload = await this.ctx.client.uploadBlob(this.canvasId, Buffer.from(html, "utf8"), "text/html", filename);
    return { id: newVersionId(), blobHash: upload.blobHash, mimeType: "text/html", filename, size: upload.size };
  }

  private send(op: Operation) {
    return this.host.sendOp(this.ctx, this.canvasId, op, this.group);
  }

  async add(given: WireSpec, placement: unknown): Promise<Screen> {
    const spec = this.styled(given);
    const { width, height } = wireSize(spec);
    const itemId = newItemId();
    const result = await this.send({
      type: "item.add",
      itemId,
      version: await this.version(spec),
      width,
      height,
      placement: { ...(placement as object), ...this.placeIn } as never,
      title: wireTitle(spec),
      properties: { [FIDELITY_PROP]: "wireframe" },
    });
    const at = this.host.insertionReceiptPlacement(result.envelope.op, itemId) as { x?: number; y?: number };
    return { item: itemId, spec, x: at.x ?? 0, y: at.y ?? 0, width, height };
  }

  /** A new version of the same item — the screen fills in place — and its title and size if they moved. */
  async write(screen: Screen, given: WireSpec): Promise<Screen> {
    const spec = this.styled(given);
    await this.send({ type: "item.addVersion", itemId: screen.item, version: await this.version(spec) });
    if (wireTitle(spec) !== wireTitle(screen.spec)) await this.send({ type: "item.update", itemId: screen.item, patch: { title: wireTitle(spec) } });
    const { width, height } = wireSize(spec);
    if (width !== screen.width || height !== screen.height) await this.send({ type: "item.resize", itemId: screen.item, width, height });
    return { ...screen, spec, width, height };
  }
}

/** Where a new flow's row starts when nothing was asked: under everything on the canvas, at its left edge. */
function rowStart(snapshot: CanvasSnapshotResponse): { x: number; y: number; chosen: true } {
  const items = Object.values(snapshot.canvas.items ?? {});
  if (items.length === 0) return { x: 0, y: 0, chosen: true };
  const left = Math.min(...items.map((i) => i.x));
  const bottom = Math.max(...items.map((i) => i.y + i.height));
  return { x: Math.round(left), y: Math.round(bottom + 160), chosen: true };
}

// ---------- asking

interface RoundTally {
  round: 1 | 2 | 3;
  calls: number;
  /** Wall clock of the round: its calls run in parallel. */
  ms: number;
  inputTokens: number;
}

async function ask(answerer: Answerer, round: 1 | 2 | 3, calls: RoundCall[], save?: string): Promise<{ responses: JevResponse[]; tally: RoundTally; by: string }> {
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
  if (save) {
    await mkdir(save, { recursive: true });
    await Promise.all(calls.map(async (call, i) => {
      const name = `round-${round}.${i + 1}`;
      await writeFile(path.join(save, `${name}.request.json`), JSON.stringify(call.request, null, 2));
      await writeFile(path.join(save, `${name}.response.json`), JSON.stringify(answered[i]!.response, null, 2));
    }));
  }
  const responses = answered.map((a) => a.response);
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

function describeFlow(d: FlowDecision): string {
  const chosen = d.archetypes.map((a) => `${a.id} ${pct(a.p)}`).join(", ");
  const declined = d.declined.map((a) => `${a.id} ${pct(a.p)}${a.why === "platform" ? ` (not on ${d.platform})` : ""}`).join(", ");
  return (
    `flow: ${d.platform} ${pct(d.distributions.platform[d.platform])} · nav ${d.chrome.nav} ${pct(d.distributions.nav[d.chrome.nav])}` +
    ` · header ${d.chrome.header} ${pct(d.distributions.header[d.chrome.header])}\n` +
    `  screens: ${chosen}\n  declined: ${declined || "none"}`
  );
}

function screenLine(s: Screen, note: string): string {
  const open = s.spec.slots.filter((x) => x.block === null).length;
  const state = open === 0 ? "wireframe" : open === s.spec.slots.length ? "blueprint" : `${s.spec.slots.length - open} of ${s.spec.slots.length} slots chosen`;
  return `${s.item}  ${wireTitle(s.spec)} — ${s.spec.archetype}, ${s.spec.platform}, ${state}${note ? ` · ${note}` : ""}`;
}

/**
 * Write one round's answers into the canvas. Round 1 turns the request's
 * blueprint into the first screen and adds the rest beside it in running
 * order; rounds 2 and 3 version each screen in place.
 */
async function applyRound(
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
    out.forEach((s, i) => say(screenLine(s, `p(yes) ${pct(decision.archetypes[i]!.p)}`)));
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
  for (const spec of specs) {
    const v = await canvas.add(spec, { x: screen.x, y: bottom + GAP, chosen: true });
    bottom = v.y + v.height;
    made.push(v);
    canvas.variants.push(v);
  }
  return made;
}

// ---------- reading a flow back off the canvas

/** Every wireframe screen on the canvas whose file carries a spec, read back off its current version. */
export async function wiresOn(ctx: Ctx, canvasId: string, snapshot: CanvasSnapshotResponse): Promise<Screen[]> {
  const items = Object.values(snapshot.canvas.items ?? {}).filter((i) => i.properties?.[FIDELITY_PROP] === "wireframe");
  const read = await Promise.all(items.map(async (item) => {
    const current = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[item.versions.length - 1];
    if (!current || current.mimeType !== "text/html") return null;
    const spec = readWire(Buffer.from(await ctx.client.downloadBlob(canvasId, current.blobHash)).toString("utf8"));
    return spec ? { item: item.id, spec, x: item.x, y: item.y, width: item.width, height: item.height } : null;
  }));
  return read.filter((s): s is Screen => s !== null);
}

async function flowsOn(ctx: Ctx, canvasId: string, snapshot: CanvasSnapshotResponse): Promise<Map<string, Screen[]>> {
  const flows = new Map<string, Screen[]>();
  const order = (s: Screen) => RECIPES.findIndex((r) => r.id === s.spec.archetype);
  // A variation shares its screen's flow but is not one of the flow's screens: no round asks it anything.
  for (const s of await wiresOn(ctx, canvasId, snapshot)) {
    if (!s.spec.flow || s.spec.variantOf) continue;
    flows.set(s.spec.flow, [...(flows.get(s.spec.flow) ?? []), s]);
  }
  for (const list of flows.values()) list.sort((a, b) => order(a) - order(b));
  return flows;
}

function pickFlow(flows: Map<string, Screen[]>, wanted?: string): { flow: string; screens: Screen[]; round: 1 | 2 | 3 } {
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

// ---------- the verbs

function chooseAnswerer(name: string | undefined, seed: number): Answerer | "agent" {
  const key = process.env.TYPESAFE_API_KEY;
  const chosen = name ?? (key ? "jev" : "stub");
  if (chosen === "agent") return "agent";
  if (chosen === "stub") return stubAnswerer(seed);
  if (chosen === "jev") return jevAnswerer({ key });
  throw new Error(`--answerer must be jev, stub or agent — got: ${chosen}`);
}

function costLine(tallies: RoundTally[], by: string, screens: number): string {
  const tokens = tallies.reduce((s, t) => s + t.inputTokens, 0);
  const calls = tallies.reduce((s, t) => s + t.calls, 0);
  const rounds = tallies.map((t) => `round ${t.round} ${t.ms} ms`).join(" · ");
  return `${screens} screens, one op group — answered by ${by} · ${rounds} · ${calls} calls · ${tokens.toLocaleString("en-US")} input tokens · $${(tokens * JEV_INPUT_PRICE).toFixed(6)}`;
}

export function registerCompose(host: CliHost, wire: Command): void {
  const { run, ctxOf, resolveCanvas, printJson, placementFor } = host;

  // `wire` has options of its own now (`--at`, `--canvas`), and the program's
  // options are not positional, so `wire render x.json --at 1,2` hands `--at`
  // to `wire`, not `render`: a subcommand reads its flags with
  // `optsWithGlobals()`, which sees both.
  wire
    .argument("[request...]", "what the screens are for, in words — composes a flow")
    .option("--answerer <name>", "jev (needs TYPESAFE_API_KEY), stub (random, seeded) or agent (you answer: `wire questions` / `wire answer`) — default jev when the key is set, else stub")
    .option("--seed <n>", "the stub's seed", "1")
    .option("--save <dir>", "write each round's requests and responses there as JSON")
    .option("--canvas <canvas>")
    .option("--at <x,y>", "start the row at world coordinates (default: under everything on the canvas)")
    .option("--in <group>", "compose the flow inside this group — and in its design system, if it has one")
    .action(
      run(async (words: string[], opts: { answerer?: string; seed: string; save?: string; at?: string; in?: string }, cmd: Command) => {
        const request = words.join(" ").trim();
        if (!request) {
          cmd.help();
          return;
        }
        const answerer = chooseAnswerer(opts.answerer, Number(opts.seed));
        const ctx = await ctxOf(cmd);
        const say = (line: string) => {
          if (!ctx.json) console.log(line);
        };
        const t0 = Date.now();
        const p = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(p.id);
        const flow = newGroupId();
        const canvas = new FlowCanvas(host, ctx, p.id, flow);
        const placement = opts.in !== undefined || opts.at ? placementFor(snapshot, { ...(opts.at ? { at: opts.at } : {}), ...(opts.in !== undefined ? { in: opts.in } : {}) }, wireSize(requestBlueprint(request, flow))) : rowStart(snapshot);
        let screens = [await canvas.add(requestBlueprint(request, flow), placement)];
        // The rest of the flow joins the same group, where the writer puts it.
        const container = (placement as { containerId?: string }).containerId;
        if (container) canvas.placeIn = { containerId: container, groupPlacement: "exact" };
        const firstMs = Date.now() - t0;
        say(`${screens[0]!.item}  "${request}" — a blueprint, on the canvas in ${firstMs} ms, before any answer`);
        if (answerer === "agent") {
          if (ctx.json) return printJson({ flow, items: [screens[0]!.item], round: 1, answerer: "agent", firstBlueprintMs: firstMs });
          say(`flow ${flow} is waiting on round 1 of 3. Answer it yourself:\n  isocan wire questions > round.json    # Jev's request shape, one call per screen\n  (fill each call's "response" in Jev's response shape)\n  isocan wire answer round.json          # repeat until the flow is drawn`);
          return;
        }
        // The governing design system's mapping is asked for while round 1 is (design §9): a flow
        // asked for where a system governs arrives in it, and the wait is the longer of the two.
        const mapper = new StyleResolver(ctx, p.id, answerer, async () => (await wiresOn(ctx, p.id, await ctx.client.snapshot(p.id))).map((s) => s.spec), opts.save);
        const styling = styleAt(ctx, p.id, screens[0]!.item, mapper);
        styling.catch(() => {});
        say(`answering with ${answerer.name === "stub" ? `the stub (seed ${opts.seed})${process.env.TYPESAFE_API_KEY ? "" : " — no TYPESAFE_API_KEY here"}` : "Jev"}`);
        const tallies: RoundTally[] = [];
        let by = answerer.name as string;
        for (const round of [1, 2, 3] as const) {
          const calls = roundCalls(round, screens);
          const asked = await ask(answerer, round, calls, opts.save);
          tallies.push(asked.tally);
          by = asked.by;
          if (round === 1) {
            const styled = await styling;
            canvas.style = styled.system ? styled.style : undefined;
            for (const line of styled.lines) say(line);
          }
          screens = await applyRound(canvas, round, screens, calls, asked.responses, say);
        }
        const totalMs = Date.now() - t0;
        if (ctx.json) {
          return printJson({
            flow,
            answerer: by,
            firstBlueprintMs: firstMs,
            totalMs,
            screens: screens.map((s) => ({ itemId: s.item, title: s.spec.title, archetype: s.spec.archetype, platform: s.spec.platform, slots: s.spec.slots, ...(s.spec.varied ? { varied: s.spec.varied } : {}) })),
            variations: canvas.variants.map((v) => ({ itemId: v.item, title: wireTitle(v.spec), variantOf: v.spec.variantOf, flip: v.spec.flip })),
            rounds: tallies,
            style: canvas.style ?? { source: "default" },
            styleCalls: mapper.calls,
            inputTokens: tallies.reduce((s, t) => s + t.inputTokens, 0) + mapper.inputTokens,
            cost: (tallies.reduce((s, t) => s + t.inputTokens, 0) + mapper.inputTokens) * JEV_INPUT_PRICE,
          });
        }
        say(costLine(tallies, by, screens.length) + ` · ${totalMs} ms in all — \`isocan undo\` takes the whole flow back`);
      }),
    );
}

/**
 * The style a flow starting at this item takes: the mapping of the design
 * system governing its place, or the default when none does — with the lines
 * that say which, for a person.
 */
async function styleAt(ctx: Ctx, canvasId: string, itemId: string, mapper: StyleResolver): Promise<{ system: Item | null; style: WireStyle; lines: string[] }> {
  const snapshot = await ctx.client.snapshot(canvasId);
  const item = snapshot.canvas.items[itemId];
  const system = item ? governingSystem(snapshot.canvas, item) : null;
  const style = await mapper.styleFor(system);
  if (!system) return { system, style, lines: [] };
  const m = [...mapper.mappings.values()].find((x) => x.system.id === system.id)!;
  const cost = mapper.calls ? ` · ${mapper.inputTokens.toLocaleString("en-US")} input tokens · $${mapper.cost().toFixed(6)}` : "";
  return { system, style, lines: [`style: in the design system that governs here${cost}`, ...mappingLines(m, mapper.who).map((l) => `  ${l}`)] };
}

/** `isocan wire questions` — the pending round, as a file in Jev's request shape. */
export async function questions(host: CliHost, opts: { flow?: string }, cmd: Command): Promise<void> {
  const { ctxOf, resolveCanvas } = host;
  const ctx = await ctxOf(cmd);
  const p = await resolveCanvas(ctx);
  const snapshot = await ctx.client.snapshot(p.id);
  const { flow, screens, round } = pickFlow(await flowsOn(ctx, p.id, snapshot), opts.flow);
  const file: RoundFile = { flow, round, calls: roundCalls(round, screens) };
  console.log(JSON.stringify(file, null, 2));
}

/** `isocan wire answer <file>` — a round's answers, checked against the canvas's own questions and applied. */
export async function answer(host: CliHost, file: string, cmd: Command): Promise<void> {
  const { ctxOf, resolveCanvas, printJson } = host;
  let answered: RoundFile;
  try {
    answered = JSON.parse(await readFile(file, "utf8")) as RoundFile;
  } catch (error) {
    throw new Error(`${file} is not a JSON file this can read: ${(error as Error).message}`);
  }
  const ctx = await ctxOf(cmd);
  const say = (line: string) => {
    if (!ctx.json) console.log(line);
  };
  const p = await resolveCanvas(ctx);
  const snapshot = await ctx.client.snapshot(p.id);
  const { flow, screens, round } = pickFlow(await flowsOn(ctx, p.id, snapshot), answered.flow);
  if (answered.round !== round) throw new Error(`${file} answers round ${answered.round}, but flow ${flow} is waiting on round ${round} — \`isocan wire questions\` prints it`);
  // The questions are asked again from the canvas, not trusted from the file: an
  // answer is checked against the question this flow actually poses.
  const calls = roundCalls(round, screens);
  const responses = calls.map((call) => {
    const mine = (answered.calls ?? []).find((c) => c.item === call.item);
    if (!mine) throw new Error(`${file} has no call for ${call.item} — every screen in round ${round} needs its answers`);
    if (Object.keys(call.request.questions).length === 0) return { answers: {} } as JevResponse;
    return answeredResponse({ ...call, response: mine.response! }, `${file}'s call for ${call.item}`);
  });
  const canvas = new FlowCanvas(host, ctx, p.id, flow);
  // An agent's flow arrives in the governing system too. Round 1 asks for the mapping (Jev with a
  // key, else the stub, whose flat answers keep the default); later rounds read it off the screens.
  const mapper = new StyleResolver(ctx, p.id, mappingAnswerer(undefined), async () => screens.map((s) => s.spec));
  const styled = await styleAt(ctx, p.id, screens[0]!.item, mapper);
  canvas.style = styled.system ? styled.style : undefined;
  if (round === 1) for (const line of styled.lines) say(line);
  const after = await applyRound(canvas, round, screens, calls, responses, say);
  const next = pendingRound(after.map((s) => s.spec));
  if (ctx.json) return printJson({ flow, round, items: after.map((s) => s.item), next });
  say(next ? `round ${round} applied — round ${next} is next: \`isocan wire questions\`` : `round 3 applied — flow ${flow} is drawn; \`isocan undo\` takes the whole flow back`);
}
