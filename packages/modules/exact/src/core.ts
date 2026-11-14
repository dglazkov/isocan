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

import type { CanvasContents, CoreModule, Item } from "@isocan/core";

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

/** The index's own format number — not Exact's, which moves daily. */
export const EXACT_INDEX_FORMAT = 1;

export const EXACT_PROPS = {
  /** On every item this module makes: `{ id }`, the app's bundle id. Intent, so it replicates. */
  app: "exact.app",
  /** A screen's route name, as Contract declares it. */
  route: "exact.route",
  /** `web` today; `ios`, `macos`, `linux`, `android` from phase 3. */
  host: "exact.host",
  /** `phone` today; tablet and desktop come with phase 1's device row. */
  device: "exact.device",
  scheme: "exact.scheme",
  /** SHA-256 of the plan the capture ran. */
  plan: "exact.plan",
  /** The driver's fixed facts the capture ran under, as JSON. */
  at: "exact.at",
  /** The location the driver opened, a route's pattern with its parameters filled. */
  url: "exact.url",
} as const;

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
  /** The app's own components, actions and data sources, by name (the anatomy, phase 1, reads further). */
  components: string[];
  actions: Array<{ name: string; component: string | null; writes: string[] }>;
  sources: string[];
  /** The index's routes against the web build's `routes.json`: a check, never an input. */
  routesJson: RoutesCheck;
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
}

/** The index of design §3, from the readings alone. */
export function buildIndex(readings: Readings): ExactIndex {
  const { router, routes } = contractRoutes(readings.symbols, readings.sources);
  const defs = readings.symbols.definitions.filter(own);
  const names = (kind: string) => [...new Set(defs.filter((d) => d.kind === kind).map((d) => d.name))].sort();
  return {
    format: EXACT_INDEX_FORMAT,
    app: readings.app,
    exact: readings.exact,
    plan: readings.plan,
    routes,
    router,
    components: names("component"),
    actions: defs.filter((d) => d.kind === "action").map((d) => ({ name: d.name, component: d.component ?? null, writes: d.writes ?? [] })),
    sources: [...new Set(readings.symbols.definitions.filter((d) => d.kind === "source" && own(d)).map((d) => d.name))].sort(),
    routesJson: checkRoutes(routes, readings.routesJson),
  };
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
export function screenProperties(index: ExactIndex, route: IndexRoute, url: string): Record<string, string> {
  return {
    [EXACT_PROPS.app]: JSON.stringify({ id: index.app.id }),
    [EXACT_PROPS.route]: route.name,
    [EXACT_PROPS.host]: "web",
    [EXACT_PROPS.device]: "phone",
    [EXACT_PROPS.scheme]: "light",
    ...(index.plan ? { [EXACT_PROPS.plan]: index.plan } : {}),
    [EXACT_PROPS.at]: JSON.stringify(CAPTURE_AT),
    [EXACT_PROPS.url]: url,
  };
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

/** The index item of an app on this canvas, if there is one. */
export function indexItemOf(canvas: CanvasContents, appId: string): Item | null {
  return Object.values(canvas.items).find((i) => appIdOf(i) === appId && !i.properties?.[EXACT_PROPS.route]) ?? null;
}

/** The screen item for one route of one app at phase 0's one host, device and scheme. */
export function screenItemOf(canvas: CanvasContents, appId: string, route: string): Item | null {
  return Object.values(canvas.items).find((i) =>
    appIdOf(i) === appId &&
    i.properties?.[EXACT_PROPS.route] === route &&
    (i.properties?.[EXACT_PROPS.host] ?? "web") === "web" &&
    (i.properties?.[EXACT_PROPS.device] ?? "phone") === "phone" &&
    (i.properties?.[EXACT_PROPS.scheme] ?? "light") === "light") ?? null;
}

/** The index as a file: stable key order, so the same readings are the same bytes and post no new version. */
export function indexText(index: ExactIndex): string {
  return `${JSON.stringify(index, null, 2)}\n`;
}

export function parseIndex(text: string): ExactIndex {
  const value = JSON.parse(text) as ExactIndex;
  if (value?.format !== EXACT_INDEX_FORMAT || !Array.isArray(value.routes)) throw new Error("not an Exact index this build reads");
  return value;
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
  ],
};

export default exactModule;
