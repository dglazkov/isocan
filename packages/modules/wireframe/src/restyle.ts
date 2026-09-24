import { newGroupId, parseDesign, selectDesignSystem, type CanvasContents, type Item } from "@isocan/core";
import { JEV_INPUT_PRICE, type Answerer, type JevRequest, type JevResponse } from "./answerer.ts";
import { rebuildPrototypes } from "./kept-flows.ts";
import { currentVersionOf, type WirePort } from "./port.ts";
import { writeWire } from "./rerender.ts";
import type { WireSpec } from "./spec.ts";
import {
  DEFAULT_STYLE, ROLES, applyMapping, candidatesOf, mappingRequest, roleLine, sameLook, sameStyle,
  type RoleChoice, type Role, type WireStyle,
} from "./theme.ts";
import type { Screen } from "./flow.ts";

/**
 * **Every wire in the design system that governs it** (design §9, journey
 * scene 6) — the restyle both surfaces run: `isocan wire style` and the web's
 * `/wire style`, over a `WirePort`.
 *
 * For each wire: which `DESIGN.md` governs its place (a scoped group's
 * first, then the canvas's — core's `selectDesignSystem`), the mapping of
 * that system's tokens onto the wire's roles (asked of the answerer once per
 * system *version*, and not at all when a wire on the canvas already carries
 * the mapping for that version), and a new version of every wire whose theme
 * changed — in one op group, so one undo takes the restyle back. A kept
 * flow's prototype is rebuilt in the same group, so it plays in the look its
 * screens now have.
 */

/** One system version's mapping, and what it cost to learn. */
export interface Mapping {
  system: Item;
  versionId: string;
  /** 1-based, of how many — for people: "version 2 of 3". */
  version: number;
  versions: number;
  name: string;
  roles: Partial<Record<Role, RoleChoice>>;
  /** How it was found: asked the answerer, read off a wire already in it, or nothing to ask. */
  how: "asked" | "reused" | "nothing to ask";
  request?: JevRequest;
  response?: JevResponse;
  ms?: number;
  /** Who answered it, when anybody was asked. */
  by?: string;
}

/** The design system that governs this item's place, or null. */
export function governingSystem(canvas: CanvasContents, item: Item): Item | null {
  const selected = selectDesignSystem(canvas, { at: item });
  return selected.status === "selected" ? selected.item : null;
}

/**
 * **Mappings, once per system version.** Cached for the run; before asking,
 * any wire already on the canvas drawn from the same version lends its
 * mapping — so re-running a restyle with nothing changed asks nothing.
 */
export class StyleResolver {
  readonly mappings = new Map<string, Mapping>();
  calls = 0;
  inputTokens = 0;
  by = "";
  private known: WireSpec[] | null = null;

  constructor(
    private port: Pick<WirePort, "readText">,
    private answerer: Answerer,
    /** The wires already on the canvas, read only when a mapping is needed. */
    private loadKnown: () => Promise<readonly WireSpec[]>,
    /** Told of every mapping asked — the CLI's `--save`. */
    private onAsked?: (system: Item, versionId: string, request: JevRequest, response: JevResponse) => Promise<void>,
  ) {}

  async styleFor(system: Item | null): Promise<WireStyle> {
    if (!system) return DEFAULT_STYLE;
    const m = await this.mapping(system);
    return { source: "design-system", itemId: system.id, versionId: m.versionId, name: m.name, ...(m.by ? { by: m.by } : {}), roles: m.roles };
  }

  /** A mapping on the canvas may be lent to this run: anything Jev (or nobody) answered; a stub's only to the stub. */
  private lendable(style: WireStyle | undefined, system: Item, versionId: string): boolean {
    if (style?.source !== "design-system" || style.itemId !== system.id || style.versionId !== versionId) return false;
    return !style.by?.startsWith("stub") || this.answerer.name === "stub";
  }

  async mapping(system: Item): Promise<Mapping> {
    const current = currentVersionOf(system);
    if (!current) throw new Error(`the design system "${system.title}" has no version to read`);
    const key = `${system.id}@${current.id}`;
    const cached = this.mappings.get(key);
    if (cached) return cached;
    const base = {
      system,
      versionId: current.id,
      version: system.versions.findIndex((v) => v.id === current.id) + 1,
      versions: system.versions.length,
    };
    this.known ??= [...(await this.loadKnown())];
    const lent = this.known.find((s) => this.lendable(s.style, system, current.id));
    const doc = parseDesign(await this.port.readText(current.blobHash));
    const name = doc.tokens.name ?? system.title;
    if (lent?.style?.source === "design-system") {
      const m: Mapping = { ...base, name, roles: lent.style.roles, how: "reused", ...(lent.style.by ? { by: lent.style.by } : {}) };
      this.mappings.set(key, m);
      return m;
    }
    const candidates = candidatesOf(doc);
    const request = mappingRequest(doc, candidates);
    let response: JevResponse = { answers: {} };
    let ms: number | undefined;
    let by: string | undefined;
    const asking = Object.keys(request.questions).length > 0;
    if (asking) {
      const answered = await this.answerer.answer(request);
      response = answered.response;
      ms = answered.ms;
      by = answered.by;
      this.by = answered.by;
      this.calls += 1;
      this.inputTokens += response.usage?.input_tokens ?? 0;
      await this.onAsked?.(system, current.id, request, response);
    }
    const m: Mapping = { ...base, name, roles: applyMapping(request, response, candidates), how: asking ? "asked" : "nothing to ask", request, response, ...(ms !== undefined ? { ms } : {}), ...(by ? { by } : {}) };
    this.mappings.set(key, m);
    return m;
  }

  /** Who answers — the versioned model once one has, else the answerer's name. */
  get who(): string {
    return this.by || this.answerer.name;
  }

  cost(): number {
    return this.inputTokens * JEV_INPUT_PRICE;
  }
}

/** A mapping, for a person: which system, how it was found, one line per role. */
export function mappingLines(m: Mapping, by: string): string[] {
  const how = m.how === "asked" ? `mapped by ${m.by ?? by}${m.ms !== undefined ? ` in ${m.ms} ms` : ""}` : m.how === "reused" ? `mapping (by ${m.by ?? "nobody — nothing to ask"}) reused from a wire already in this version — nothing asked` : "every role had one candidate or none — nothing asked";
  return [
    `"${m.name}" — ${m.system.id}, version ${m.version} of ${m.versions} · ${how}`,
    ...ROLES.map((role) => `  ${roleLine(role, m.roles[role])}`),
  ];
}

/**
 * **A restyle that would change nothing a person can see** (Porchlight #9).
 * A new version of the governing DESIGN.md that maps every role to the same
 * value as before — v3 added tint colours and nothing else — used to
 * re-version every wire only to record the new version id. Same system, same
 * look: the wire is left alone. Its spec still names the version that drew
 * it, so `--check` still says which version that was; the next `wire
 * style` asks again and, while the look holds, writes nothing again.
 */
export function alreadyLooks(was: WireStyle | undefined, now: WireStyle): boolean {
  const system = (s: WireStyle | undefined) => (s?.source === "design-system" ? s.itemId : null);
  return system(was) === system(now) && sameLook(was, now);
}

export interface RestyleTarget {
  screen: Screen;
  item: Item;
  system: Item | null;
  style: WireStyle;
}

export interface Restyled {
  group: string;
  targets: RestyleTarget[];
  changed: RestyleTarget[];
  prototypes: Array<{ itemId: string; what: string }>;
  resolver: StyleResolver;
}

/**
 * **The restyle itself.** `all` is every wire on the canvas (read with
 * `wiresOn`); `screens` the ones to restyle. Writes one version per wire
 * whose style changed and rebuilds the prototype of any kept flow it
 * touched — all in one new op group.
 */
export async function restyle(
  port: WirePort,
  canvas: CanvasContents,
  all: readonly Screen[],
  screens: readonly Screen[],
  resolver: StyleResolver,
  opts: { toDefault?: boolean } = {},
): Promise<Restyled> {
  const targets: RestyleTarget[] = [];
  for (const s of screens) {
    const item = canvas.items[s.item]!;
    const system = opts.toDefault ? null : governingSystem(canvas, item);
    targets.push({ screen: s, item, system, style: await resolver.styleFor(system) });
  }
  const group = newGroupId();
  const changed: RestyleTarget[] = [];
  for (const t of targets) {
    if (sameStyle(t.screen.spec.style, t.style) || alreadyLooks(t.screen.spec.style, t.style)) continue;
    const spec: WireSpec = { ...t.screen.spec, style: t.style };
    if (!(await writeWire(port, t.item, spec, group))) continue;
    t.screen = { ...t.screen, spec };
    changed.push(t);
  }
  const prototypes = await rebuildPrototypes(port, canvas, all, changed.map((t) => t.screen), group);
  return { group, targets, changed, prototypes, resolver };
}

/** The restyle's closing line, for a person. */
export function restyleSummary(r: Restyled): string {
  const { targets, changed, resolver } = r;
  const tail = changed.length ? " — one op group: one undo takes the restyle back" : " — nothing written";
  return `${changed.length} of ${targets.length} wires restyled · ${targets.length - changed.length} unchanged · ${resolver.calls === 0 ? "nothing asked" : `${resolver.calls} ${resolver.calls === 1 ? "call" : "calls"} to ${resolver.who} · ${resolver.inputTokens.toLocaleString("en-US")} input tokens · $${resolver.cost().toFixed(6)}`}${tail}`;
}
