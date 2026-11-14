/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { CanvasContents, ContextPiece, CoreModule, Item, ModuleEdge } from "@isocan/core";
import type { AnatomyFile, CompiledTests, DesignReading, Device, FlowEdge, IndexDesign, Scheme, UnplacedNavigation } from "./map.ts";

// The map's builders (`build.ts`, `map.ts`) are what the CLI's verbs run, and
// are imported by them lazily: this file is read at every CLI start-up (the
// module's record is registered before argv is parsed), so it holds only the
// keys, the shapes, and what the canvas itself asks — arrows and context rows.

/**
 * **Exact on the canvas, the facts both surfaces share** (exact phase 0;
 * `docs/projects/exact/design.md` §1–§4).
 *
 * An Exact app already describes itself to tools — `routes.json` from its
 * web build, `contract symbols` from its compiler, the agent driver's
 * screenshots. This file turns those printed readings into the index of
 * design §3 and the screen properties of §4. It reads nothing and runs
 * nothing: the CLI half hands it what Exact printed, through the bridge
 * script, and the web half only draws what it made.
 *
 * Every key below is ours forever (`authoring.md`): keys replay.
 */

export const EXACT_INDEX_MIME = "application/vnd.isocan.exact-index+json";
/** One Contract file's anatomy (exact phase 1): its components, shapes, sources, routes and tests. */
export const EXACT_ANATOMY_MIME = "application/vnd.isocan.exact-anatomy+json";

/** A device wall (exact phase 3): one route on every host and device, side by side. */
export const EXACT_WALL_MIME = "application/vnd.isocan.exact-wall+json";

/** The index's own format number — not Exact's, which moves daily. 2: the map (exact phase 1). */
export const EXACT_INDEX_FORMAT = 2;

export const EXACT_PROPS = {
  /** On every item this module makes: `{ id }`, the app's bundle id. Intent, so it replicates. */
  app: "exact.app",
  /** A screen's route name, as Contract declares it. */
  route: "exact.route",
  /** `web`, `ios` or `macos` (exact phase 3); `linux` and `android` later. */
  host: "exact.host",
  /** `phone`, `tablet` or `desktop` — the device row (exact phase 1). */
  device: "exact.device",
  /** `light` or `dark`. */
  scheme: "exact.scheme",
  /** SHA-256 of the plan the capture ran. */
  plan: "exact.plan",
  /** The driver's fixed facts the capture ran under, as JSON. */
  at: "exact.at",
  /** The location the driver opened, a route's pattern with its parameters filled. */
  url: "exact.url",
  /** How the screen is reached: Exact's launch lines (`at "/place/2"`, `tap …`), editable (exact phase 1). */
  shots: "exact.shots",
  /** What the capture depended on, digested: unchanged means the capture is skipped. */
  key: "exact.key",
  /** On a route's phone/light screen: the arrows that leave it, `[{to, verb, action}]`, from the index. */
  edges: "exact.edges",
  /** On an anatomy card: the Contract file it describes. */
  file: "exact.file",
  /** On the design-system item: the Tamber IR digest it was written from. */
  tamber: "exact.tamber",
  /** On the index: counts for `isocan context`, which cannot read the index's bytes. */
  summary: "exact.summary",
  /** On a screen: `on` — the canvas's intent that it starts live, where a viewer's live frames are on (exact phase 2). Each viewer's own Live / Still wins. */
  live: "exact.live",
  /** On a captured screen: each visible node's box at the capture size, joined to source — what pointing reads on a capture (exact phase 2). */
  points: "exact.points",
  /** On a captured screen: the shots its capture ran, read-only — where Drive mode starts (exact phase 3). `exact.shots` is the one to edit. */
  reached: "exact.reached",
  /** On a screen: a drive a person asked for on the canvas (exact phase 3) — `{seq, by, host, size, scheme, shots, ops}`, written by a browser that reaches nothing on its machine; `isocan exact live` answers it. */
  drive: "exact.drive",
  /** On a screen: the answer to its latest `exact.drive` — `{seq, ok, blobHash, points, results, ms, error?}`, the fresh picture a blob of the canvas. */
  driven: "exact.driven",
  /**
   * On a film (exact phase 4; design §8): an animated PNG of an interaction filmed against the virtual clock —
   * `{from, every, steps, over, at, key, route, host, device, scheme, shots, ops, watch, screen}`; frame i was drawn at
   * `from + i·every` ms after the interaction ended.
   */
  film: "exact.film",
  /** On a film: the component's state at each frame — the first frame's whole, then what each later one changed (`film.ts`). */
  frames: "exact.frames",
  /** On a screen: a film asked for on the canvas — `{seq, by, host, size, scheme, shots, ops, over, every, watch}`; `isocan exact live` films it (exact phase 4). */
  filmAsk: "exact.filmAsk",
  /** On a screen: the answer to its latest `exact.filmAsk` — `{seq, ok, itemId, sha256, ms, error?}`, the strip an item beside the map. */
  filmed: "exact.filmed",
  /** On a screen: an inspection asked for on the canvas — `{seq, by, host, size, scheme, shots}`; `isocan exact live` answers it (exact phase 4). */
  inspect: "exact.inspect",
  /** On a screen: the answer to its latest `exact.inspect` — `{seq, ok, blobHash, ms, error?}`, the driver's `tree --ax`, `layout`, `perf` and `logs` a JSON blob of the canvas. */
  inspected: "exact.inspected",
} as const;

/** One visible node of a capture: its box in the capture's CSS pixels, the line that drew it, and the styles that line names. */
export interface CapturePoint {
  x: number; y: number; w: number; h: number;
  type: string;
  testId?: string;
  file: string; line: number; col: number;
  component: string | null;
  chain: Array<{ file: string; line: number; col: number; component: string | null }>;
  classes?: string[];
}

/** `exact.points`: the nodes, and each file's digest when it was captured. */
export interface CapturePoints {
  files: Record<string, string>;
  nodes: CapturePoint[];
  /** The capture's own size in points, when it is not its device's web size (a simulator's screen, exact phase 3). */
  size?: { width: number; height: number };
}

export function parsePoints(text: string | undefined): CapturePoints | null {
  if (!text) return null;
  try {
    const v = JSON.parse(text) as CapturePoints;
    return v && Array.isArray(v.nodes) && v.files && typeof v.files === "object" ? v : null;
  } catch {
    return null;
  }
}

/**
 * **What a press at (x, y) on a capture lands on** (exact phase 2) — the
 * smallest box under it, as a page's own hit test lands on the innermost
 * node. In the capture's CSS pixels.
 */
export function pointAt(points: CapturePoints, x: number, y: number): CapturePoint | null {
  let best: CapturePoint | null = null;
  for (const n of points.nodes) {
    if (x < n.x || y < n.y || x > n.x + n.w || y > n.y + n.h) continue;
    if (!best || n.w * n.h <= best.w * best.h) best = n;
  }
  return best;
}

// ---------------------------------------------------------------- comments on lines (exact phase 2)

/**
 * **Where a comment points in the source** (design §6): the file relative to
 * the app, the 1-based line and column, and the SHA-256 of the file's bytes
 * when the comment was made. Comments carry no properties, so it rides in the
 * body as one line an agent and both surfaces read:
 *
 *     exact.source = {"file":"app.contract","line":110,"col":5,"sha256":"…"}
 *
 * The digest is how a comment knows it has *moved*: when the file's bytes no
 * longer hash to it, the line may be another line, and the comment says so
 * rather than re-anchoring itself.
 */
export interface ExactSource {
  file: string;
  line: number;
  col: number;
  sha256: string;
}

const SOURCE_LINE = /^exact\.source = (\{.*\})\s*$/m;
const DIAGNOSTIC_LINE = /^exact\.diagnostic = (\S+)\s*$/m;
const MOVED_LINE = /^exact\.moved = ([0-9a-f]{64})\s*$/m;

export function sourceLine(src: ExactSource): string {
  return `exact.source = ${JSON.stringify({ file: src.file, line: src.line, col: src.col, sha256: src.sha256 })}`;
}

/** The `exact.source` a comment's body carries, or null. A file outside the app (absolute, or climbing out) is not one. */
export function parseSource(body: string): ExactSource | null {
  const m = SOURCE_LINE.exec(body);
  if (!m) return null;
  try {
    const v = JSON.parse(m[1]!) as Partial<ExactSource>;
    if (typeof v.file !== "string" || v.file.startsWith("/") || v.file.split(/[\\/]/).includes("..")) return null;
    if (!Number.isInteger(v.line) || !Number.isInteger(v.col) || typeof v.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(v.sha256)) return null;
    return { file: v.file, line: v.line!, col: v.col!, sha256: v.sha256 };
  } catch {
    return null;
  }
}

/** The key of a finding the bridge posted (`build:…` a compile diagnostic, `check:…` an `agent check` finding), or null. */
export function diagnosticKey(body: string): string | null {
  return DIAGNOSTIC_LINE.exec(body)?.[1] ?? null;
}

/** The digest a *moved* reply was written against, or null. */
export function movedDigest(body: string): string | null {
  return MOVED_LINE.exec(body)?.[1] ?? null;
}

/** `app.contract:110:5`, as an editor and a person read a place. */
export function sourcePlace(src: Pick<ExactSource, "file" | "line" | "col">): string {
  return `${src.file}:${src.line}:${src.col}`;
}

/** The one-line summary of a selection the canvas shows: place, component, and each style that set a row (`class Price`). */
export function selectionSummary(sel: { source: { file: string; line: number; col: number; component?: string | null }; rows?: Array<{ origin?: string | null }>; type?: string }): string {
  const classes = [...new Set((sel.rows ?? []).map((r) => r.origin ?? "").filter((o) => o.startsWith("class:")).map((o) => `class ${o.slice(6)}`))];
  return [sourcePlace(sel.source), sel.source.component ? `in ${sel.source.component}` : null, ...classes].filter(Boolean).join(" · ");
}

/** The driver's defaults, said explicitly so a capture never depends on an unsaid default moving. */
export const CAPTURE_AT = { seed: 1, locale: "en-US", zone: "UTC", epoch: "2026-01-01" } as const;

/** The one size phase 0 captures at — a phone, in CSS pixels. */
export const PHONE = { width: 390, height: 844 } as const;

export interface RoutesJson {
  routes: Array<{ name: string; pattern: string; notfound?: boolean; render?: string }>;
}

export interface SymbolDef {
  name: string;
  kind: string;
  file: string;
  line: number;
  col: number;
  end_col?: number;
  component?: string;
  owner?: string;
  writes?: string[];
}

export interface Symbols {
  definitions: SymbolDef[];
  references?: unknown[];
}

/** One route as Contract declares it: `[tab] name "pattern"` under a `routes` block. */
export interface IndexRoute {
  name: string;
  pattern: string;
  /** A tab of the router (a root of its own stack), or a route pushed under `parent`. */
  tab: boolean;
  /** The route this one sits under in the declaration, or null for a tab or a lone root. */
  parent: string | null;
  /** The tab whose stack this route is declared in, or null when the router has no tabs. */
  inTab: string | null;
  /** Its `:name` segments, in order. */
  params: string[];
  file: string;
  line: number;
}

export interface ExactIndex {
  format: typeof EXACT_INDEX_FORMAT;
  app: { id: string; name: string };
  exact: { commit: string | null; protocol: string | null };
  /** SHA-256 of the web plan the readings were taken from. */
  plan: string | null;
  /** From Contract: `contract symbols` named each route, the source line said its pattern. */
  routes: IndexRoute[];
  /** The router's name (`routes nav` → `nav`), when the app declares one. */
  router: string | null;
  /** The app's own components, actions and data sources, by name. */
  components: string[];
  actions: Array<{ name: string; component: string | null; writes: string[] }>;
  sources: string[];
  /** The index's routes against the web build's `routes.json`: a check, never an input. */
  routesJson: RoutesCheck;
  /** The flow map's arrows (design §3), and what the reader could not place. */
  edges: FlowEdge[];
  unplaced: UnplacedNavigation[];
  /** One entry per Contract file. */
  anatomy: AnatomyFile[];
  /** `app.ts`'s `export const grants`, as written; null when it exports none. */
  grants: string | null;
  /** `tamber ir` with each token's `uses`, or null for an app with no design. */
  design: IndexDesign | null;
  /** A digest of everything a capture depends on: the app's own files and the Exact commit. */
  inputs: string | null;
}

export interface RoutesCheck {
  equal: boolean;
  onlyContract: Array<{ name: string; pattern: string }>;
  onlyRoutesJson: Array<{ name: string; pattern: string }>;
}

const ROUTE_ROW = /^(\s*)(?:(tab)\s+)?([A-Za-z_][A-Za-z0-9_]*)\s+"([^"]*)"/;
const ROUTER_ROW = /^\s*routes\s+([A-Za-z_][A-Za-z0-9_]*)\b/;

/** The app's own files: what `symbols` reports from a package (`exact:content`) is not the app's. */
const own = (def: SymbolDef) => def.file.endsWith(".contract") && !def.file.includes(":");

/**
 * **The routes, from Contract** (design §3).
 *
 * `contract symbols` names every route and where it is declared, and says
 * nothing of its pattern or nesting — so the declaration's own line is read,
 * at the place `symbols` gave: `[tab] name "pattern"`, its indent saying
 * what it sits under (`route-row` in Exact's `docs/contract-grammar.md`).
 * A line that does not read as a route row is a refusal naming it: Exact
 * changed under us, and the index must say so rather than guess.
 */
export function contractRoutes(symbols: Symbols, sources: Record<string, string>): { router: string | null; routes: IndexRoute[] } {
  const defs = symbols.definitions.filter((d) => d.kind === "route" && own(d)).sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  const routes: IndexRoute[] = [];
  let router: string | null = null;
  const stack: Array<{ indent: number; route: IndexRoute }> = [];
  let lastFile = "";
  for (const def of defs) {
    const text = sources[def.file];
    if (text === undefined) throw new Error(`contract symbols names route ${def.name} in ${def.file}, which the bridge did not read`);
    const lines = text.split("\n");
    if (def.file !== lastFile) {
      stack.length = 0;
      lastFile = def.file;
    }
    const line = lines[def.line - 1] ?? "";
    const m = ROUTE_ROW.exec(line);
    if (!m || m[3] !== def.name) {
      throw new Error(`${def.file}:${def.line} should declare route ${def.name} as \`[tab] ${def.name} "<pattern>"\`, and reads: ${line.trim()}`);
    }
    if (router === null) {
      for (let i = def.line - 2; i >= 0; i--) {
        const r = ROUTER_ROW.exec(lines[i] ?? "");
        if (r) { router = r[1]!; break; }
      }
    }
    const indent = m[1]!.length;
    while (stack.length > 0 && stack[stack.length - 1]!.indent >= indent) stack.pop();
    const parent = stack[stack.length - 1]?.route ?? null;
    const tab = m[2] === "tab";
    const pattern = m[4]!;
    const route: IndexRoute = {
      name: def.name,
      pattern,
      tab,
      parent: parent?.name ?? null,
      inTab: tab ? def.name : (parent ? (parent.tab ? parent.name : parent.inTab) : null),
      params: [...pattern.matchAll(/:([A-Za-z_][A-Za-z0-9_]*)/g)].map((p) => p[1]!),
      file: def.file,
      line: def.line,
    };
    routes.push(route);
    stack.push({ indent, route });
  }
  return { router, routes };
}

/** The index's routes against `routes.json`, by name and pattern; the not-found route is the build's, not a declaration. */
export function checkRoutes(routes: readonly IndexRoute[], json: RoutesJson): RoutesCheck {
  const key = (r: { name: string; pattern: string }) => `${r.name}\u0000${r.pattern}`;
  const declared = routes.map((r) => ({ name: r.name, pattern: r.pattern }));
  const built = json.routes.filter((r) => !r.notfound).map((r) => ({ name: r.name, pattern: r.pattern }));
  const builtKeys = new Set(built.map(key));
  const declaredKeys = new Set(declared.map(key));
  const onlyContract = declared.filter((r) => !builtKeys.has(key(r)));
  const onlyRoutesJson = built.filter((r) => !declaredKeys.has(key(r)));
  return { equal: onlyContract.length === 0 && onlyRoutesJson.length === 0 && declared.length === built.length, onlyContract, onlyRoutesJson };
}

/** What the bridge read off the app, as Exact printed it. */
export interface Readings {
  app: { id: string; name: string };
  exact: { commit: string | null; protocol: string | null };
  plan: string | null;
  routesJson: RoutesJson;
  symbols: Symbols;
  sources: Record<string, string>;
  /** `contract test` per `*.test.contract` (exact phase 1; absent in a phase 0 reading). */
  tests?: CompiledTests[];
  /** `app.ts`'s grants line, as written. */
  grants?: string | null;
  /** `tamber ir` and the wire's `uses` per token. */
  design?: DesignReading | null;
  inputs?: string | null;
}


/**
 * **Where the driver opens a route**: its pattern with each `:name` filled.
 * A value comes from `params` by name, else `1` — phase 0's stand-in for
 * phase 1's `exact.shots`, which will say how a screen that needs state is
 * reached. The value used is written on the screen (`exact.url`), so a
 * capture never hides what it was a picture of.
 */
export function routeLocation(route: Pick<IndexRoute, "pattern" | "params">, params: Readonly<Record<string, string>> = {}): string {
  return route.pattern.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_m, name: string) => encodeURIComponent(params[name] ?? "1"));
}

/** `--param id=2 --param slug=x` as a map; a malformed one is a sentence. */
export function parseParams(list: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const one of list) {
    const at = one.indexOf("=");
    if (at <= 0) throw new Error(`--param takes name=value, not ${JSON.stringify(one)}`);
    out[one.slice(0, at)] = one.slice(at + 1);
  }
  return out;
}

/** The properties a captured screen wears (design §4). */
export function screenProperties(index: ExactIndex, route: IndexRoute, url: string, where: { device?: Device; scheme?: Scheme; shots?: string; key?: string; host?: string; reached?: string } = {}): Record<string, string> {
  const device = where.device ?? "phone";
  const scheme = where.scheme ?? "light";
  const host = where.host ?? "web";
  const primary = device === "phone" && scheme === "light" && host === "web";
  return {
    [EXACT_PROPS.app]: JSON.stringify({ id: index.app.id }),
    [EXACT_PROPS.route]: route.name,
    [EXACT_PROPS.host]: host,
    [EXACT_PROPS.device]: device,
    [EXACT_PROPS.scheme]: scheme,
    ...(index.plan ? { [EXACT_PROPS.plan]: index.plan } : {}),
    [EXACT_PROPS.at]: JSON.stringify(CAPTURE_AT),
    [EXACT_PROPS.url]: url,
    ...(where.shots !== undefined ? { [EXACT_PROPS.shots]: where.shots } : {}),
    ...(where.key !== undefined ? { [EXACT_PROPS.key]: where.key } : {}),
    ...(where.reached !== undefined ? { [EXACT_PROPS.reached]: where.reached } : {}),
    ...(primary ? { [EXACT_PROPS.edges]: JSON.stringify(edgesFrom(index, route.name)) } : {}),
  };
}

/** The arrows that leave one route, as its phone/light screen carries them. */
export function edgesFrom(index: ExactIndex, route: string): Array<{ to: string; verb: string; action: string | null }> {
  return index.edges.filter((e) => e.from === route).map((e) => ({ to: e.to, verb: e.verb, action: e.action }));
}


/** The bundle id an item says it belongs to, or null. */
export function appIdOf(item: Item): string | null {
  const raw = item.properties?.[EXACT_PROPS.app];
  if (typeof raw !== "string") return null;
  try {
    const id = (JSON.parse(raw) as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
}

/** Is this item an Exact index (by its current version's mime)? */
function isIndex(item: Item): boolean {
  const v = item.versions.find((x) => x.id === item.currentVersionId) ?? item.versions.at(-1);
  return v?.mimeType === EXACT_INDEX_MIME;
}

/** The index item of an app on this canvas, if there is one. */
export function indexItemOf(canvas: CanvasContents, appId: string): Item | null {
  return Object.values(canvas.items).find((i) => appIdOf(i) === appId && isIndex(i)) ?? null;
}

/** The screen item for one route of one app, on one host (the web by default), at one device and scheme (phone/light by default). */
export function screenItemOf(canvas: CanvasContents, appId: string, route: string, device: Device = "phone", scheme: Scheme = "light", host = "web"): Item | null {
  return Object.values(canvas.items).find((i) =>
    appIdOf(i) === appId &&
    i.properties?.[EXACT_PROPS.route] === route &&
    (i.properties?.[EXACT_PROPS.host] ?? "web") === host &&
    (i.properties?.[EXACT_PROPS.device] ?? "phone") === device &&
    (i.properties?.[EXACT_PROPS.scheme] ?? "light") === scheme) ?? null;
}

/** An app's anatomy card for one Contract file. */
export function anatomyItemOf(canvas: CanvasContents, appId: string, file: string): Item | null {
  return Object.values(canvas.items).find((i) => appIdOf(i) === appId && i.properties?.[EXACT_PROPS.file] === file) ?? null;
}

/** The design-system item this module wrote for an app. */
export function designItemOf(canvas: CanvasContents, appId: string): Item | null {
  return Object.values(canvas.items).find((i) => appIdOf(i) === appId && i.properties?.[EXACT_PROPS.tamber] !== undefined) ?? null;
}

/** The index as a file: stable key order, so the same readings are the same bytes and post no new version. */
export function indexText(index: ExactIndex): string {
  return `${JSON.stringify(index, null, 2)}\n`;
}

/** An index of this format, or phase 0's (format 1), read with the map's fields empty. */
export function parseIndex(text: string): ExactIndex {
  const value = JSON.parse(text) as Partial<ExactIndex> & { format?: number };
  if ((value?.format !== EXACT_INDEX_FORMAT && value?.format !== 1) || !Array.isArray(value.routes)) throw new Error("not an Exact index this build reads");
  return { edges: [], unplaced: [], anatomy: [], grants: null, design: null, inputs: null, ...value, format: EXACT_INDEX_FORMAT } as ExactIndex;
}

/** An anatomy card's bytes: the file's entry, with the app it belongs to. */
export interface AnatomyCard {
  app: { id: string; name: string };
  grants: string | null;
  entry: AnatomyFile;
}

export function anatomyText(index: ExactIndex, entry: AnatomyFile): string {
  const card: AnatomyCard = { app: index.app, grants: index.grants, entry };
  return `${JSON.stringify(card, null, 2)}\n`;
}

export function parseAnatomy(text: string): AnatomyCard {
  const value = JSON.parse(text) as AnatomyCard;
  if (!value?.entry || typeof value.entry.file !== "string") throw new Error("not an Exact anatomy card");
  return value;
}

/** The counts `isocan context` shows for an app, carried on its index item. */
export interface IndexSummary {
  name: string;
  routes: number;
  arrows: number;
  components: string[];
  sources: string[];
  grants: string | null;
  tokens: number;
  files: string[];
}

export function indexSummary(index: ExactIndex): IndexSummary {
  return {
    name: index.app.name,
    routes: index.routes.length,
    arrows: index.edges.length,
    components: index.components,
    sources: index.sources,
    grants: index.grants,
    tokens: index.design?.tokens.length ?? 0,
    files: index.anatomy.map((a) => a.file),
  };
}


/** The phone/light screen of each route of each app, by `app\u0000route`. */
function primaries(canvas: CanvasContents): Map<string, Item> {
  const out = new Map<string, Item>();
  for (const item of Object.values(canvas.items)) {
    const app = appIdOf(item);
    const route = item.properties?.[EXACT_PROPS.route];
    if (!app || !route) continue;
    if ((item.properties?.[EXACT_PROPS.device] ?? "phone") !== "phone" || (item.properties?.[EXACT_PROPS.scheme] ?? "light") !== "light" || (item.properties?.[EXACT_PROPS.host] ?? "web") !== "web") continue;
    out.set(`${app}\u0000${route}`, item);
  }
  return out;
}

export interface MapEdge extends ModuleEdge {
  verb: string;
  action: string | null;
}

/**
 * **The flow map's arrows, read off the canvas** (design §3): each route's
 * phone screen carries the arrows that leave it; each resolves to the
 * phone screen of the route it reaches. Never stored as edges, so a screen
 * taken away takes its arrows with it.
 */
export function mapEdges(canvas: CanvasContents): MapEdge[] {
  const byRoute = primaries(canvas);
  const out: MapEdge[] = [];
  for (const [key, from] of byRoute) {
    const app = key.split("\u0000")[0]!;
    let list: Array<{ to?: unknown; verb?: unknown; action?: unknown }> = [];
    try { list = JSON.parse(from.properties?.[EXACT_PROPS.edges] ?? "[]") as typeof list; } catch { continue; }
    if (!Array.isArray(list)) continue;
    for (const e of list) {
      if (typeof e?.to !== "string") continue;
      const to = byRoute.get(`${app}\u0000${e.to}`);
      if (!to || to.id === from.id) continue;
      out.push({ from, to, verb: typeof e.verb === "string" ? e.verb : "push", action: typeof e.action === "string" ? e.action : null });
    }
  }
  return out;
}

/** `isocan context`'s rows: what each Exact app on the canvas is, for an agent that just joined. */
export function exactContext(canvas: CanvasContents): ContextPiece[] {
  const out: ContextPiece[] = [];
  for (const item of Object.values(canvas.items)) {
    if (!isIndex(item)) continue;
    const raw = item.properties?.[EXACT_PROPS.summary];
    if (!raw) continue;
    let s: IndexSummary;
    try { s = JSON.parse(raw) as IndexSummary; } catch { continue; }
    const screens = Object.values(canvas.items).filter((i) => appIdOf(i) === appIdOf(item) && i.properties?.[EXACT_PROPS.route]).length;
    out.push({
      name: `Exact app: ${s.name}`,
      source: "canvas",
      present: true,
      updatedAt: item.updatedAt,
      size: [
        `${s.routes} routes, ${s.arrows} arrows, ${screens} screens`,
        `components ${s.components.join(", ") || "none"}`,
        `sources ${s.sources.join(", ") || "none"}`,
        `grants ${s.grants ? JSON.stringify(s.grants) : "none"}`,
        `${s.tokens} design tokens`,
        `anatomy of ${s.files.join(", ")}`,
      ].join("; "),
      fix: `\`isocan get "${item.title}"\` is the index; each file's anatomy card is an item; \`isocan exact live <dir>\` keeps the map true as the app is edited.`,
    });
  }
  return out;
}

export const exactModule: CoreModule = {
  name: "@isocan/exact",
  propertyKeys: Object.values(EXACT_PROPS),
  kinds: [
    {
      id: "exact-index",
      mimes: [EXACT_INDEX_MIME],
      label: "Exact indexes",
      noun: "Exact index",
    },
    {
      id: "exact-anatomy",
      mimes: [EXACT_ANATOMY_MIME],
      label: "Exact anatomy cards",
      noun: "Exact anatomy card",
    },
    {
      id: "exact-wall",
      mimes: [EXACT_WALL_MIME],
      label: "Exact device walls",
      noun: "Exact device wall",
    },
  ],
  contextPieces: exactContext,
  edges: (canvas) => mapEdges(canvas).map(({ from, to }) => ({ from, to })),
};

export default exactModule;
