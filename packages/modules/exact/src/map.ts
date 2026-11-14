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

/**
 * **The map's facts** (exact phase 1; design §3, §4): where the router can
 * go, what each Contract file holds, and what the design's tokens are and
 * where they are used — all read off what Exact prints, pure, so both
 * surfaces and the tests read the same answer.
 *
 * **What `contract symbols` says about navigation, measured 13 Nov 2026**
 * (design §16 question 3; Exact `cbe553f6`): every `path("<route>", …)` is a
 * reference of kind `route`, at the route name's own column — so the TARGET
 * of a push, a replace or a link is printed. The VERB is not (`push`,
 * `replace`, `select`, `back` are builtins, never referenced), nor the action
 * a reference sits in, and `back(nav)` has no reference at all. An action's
 * call sites are references of kind `action`. So the verb is read from the
 * text left of the reference, the action from the indentation around it,
 * and the screen an arrow leaves from from the `e.name == "<route>"`
 * conditions that enclose the reference or the action's call sites — the
 * "small reader over the range" the design named as the fallback.
 */

import type { IndexRoute, SymbolDef, Symbols } from "./core.ts";

export type RouterVerb = "push" | "replace" | "link" | "go" | "path" | "back" | "select";

/** One arrow of the flow map: a route the router can reach from another. */
export interface FlowEdge {
  from: string;
  to: string;
  verb: RouterVerb;
  /** The action whose body takes it, or null for a link in the view or the platform's Back. */
  action: string | null;
  /** Where the verb (or, for Back, the route) is written. */
  file: string;
  line: number;
  /**
   * How the screen it leaves from was found: `condition` — the
   * `e.name == …` tests around the reference or the action's call sites;
   * `stack` — the route's place in the `routes` block (Back, or a push with
   * no condition to read); `tabs` — a `select` of the router, between tabs.
   */
  via: "condition" | "stack" | "tabs";
}

/** A navigation the reader could not place, said rather than guessed. */
export interface UnplacedNavigation {
  verb: RouterVerb;
  action: string | null;
  file: string;
  line: number;
  why: string;
}

export interface SymbolRef {
  name: string;
  kind: string;
  file: string;
  line: number;
  col: number;
  end_col?: number;
  to?: number;
}

const own = (d: { file: string }) => d.file.endsWith(".contract") && !d.file.includes(":");
const indentOf = (line: string) => line.length - line.trimStart().length;
const blank = (line: string) => line.trim() === "" || line.trim().startsWith("//");

/** The innermost-first chain of `( … )` groups around a column, and the line itself last. */
function groupsAround(text: string, col0: number): Array<{ start: number; end: number }> {
  const out: Array<{ start: number; end: number }> = [];
  const open: number[] = [];
  const spans: Array<{ start: number; end: number }> = [];
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' && text[i - 1] !== "\\") inString = !inString;
    if (inString) continue;
    if (c === "(") open.push(i);
    else if (c === ")" && open.length > 0) spans.push({ start: open.pop()! + 1, end: i });
  }
  for (const s of spans) if (s.start <= col0 && col0 < s.end) out.push(s);
  out.sort((a, b) => (a.end - a.start) - (b.end - b.start));
  out.push({ start: 0, end: text.length });
  return out;
}

/** Split at a top-level token (outside parentheses and strings). */
function splitTop(text: string, token: string): Array<{ text: string; start: number }> {
  const parts: Array<{ text: string; start: number }> = [];
  let depth = 0;
  let inString = false;
  let from = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' && text[i - 1] !== "\\") inString = !inString;
    if (inString) continue;
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (depth === 0 && text.startsWith(token, i)) {
      parts.push({ text: text.slice(from, i), start: from });
      from = i + token.length;
      i += token.length - 1;
    }
  }
  parts.push({ text: text.slice(from), start: from });
  return parts;
}

const NAME_TERM = /^\(?\s*(?:[A-Za-z_][A-Za-z0-9_]*|top\([^()]*\))\.name\s*==\s*"([^"]+)"\s*\)?$/;

/**
 * **What a condition says about the route on screen**: the routes it can be
 * true on (`set`, or null when it says nothing about routes), and whether it
 * says ONLY that — a pure disjunction of `x.name == "<route>"` tests, the one
 * shape whose `else` can be read as "every other route".
 */
export function routeCondition(cond: string, routes: ReadonlySet<string>): { set: Set<string> | null; pure: boolean } {
  let text = cond.trim();
  while (text.startsWith("(") && text.endsWith(")") && groupsAround(text, 1)[0]?.start === 1 && groupsAround(text, 1)[0]?.end === text.length - 1) text = text.slice(1, -1).trim();
  const disjuncts = splitTop(text, " or ").map((d) => d.text.trim());
  let union: Set<string> | null = new Set();
  let pure = true;
  for (const d of disjuncts) {
    const conjuncts = splitTop(d, " and ").map((c) => c.text.trim());
    let meet = null as Set<string> | null;
    for (const c of conjuncts) {
      const m = NAME_TERM.exec(c);
      const name = m?.[1];
      if (name === undefined || !routes.has(name)) continue;
      meet = meet === null ? new Set([name]) : new Set([...meet].filter((r: string) => r === name));
    }
    if (conjuncts.length !== 1 || meet === null) pure = false;
    if (meet === null) union = null;
    else if (union !== null) for (const r of meet) union.add(r);
  }
  if (union === null) pure = false;
  return { set: union, pure };
}

/**
 * **The routes a place in the view is drawn on**: every `if`/`else if`/`else`
 * around it (by indentation) and every `?:` around it on its line, read with
 * `routeCondition`. Null when nothing around it names a route.
 */
export function screensAt(lines: readonly string[], line: number, col: number, routes: ReadonlySet<string>): Set<string> | null {
  let set: Set<string> | null = null;
  const restrict = (to: Set<string>) => { set = set === null ? new Set(to) : new Set([...set].filter((r) => to.has(r))); };
  const exclude = (out: Set<string>) => { set = new Set([...(set ?? routes)].filter((r) => !out.has(r))); };

  // The ternaries on the line itself, innermost first.
  const text = lines[line - 1] ?? "";
  for (const g of groupsAround(text, col - 1)) {
    const body = text.slice(g.start, g.end);
    const q = splitTop(body, " ? ");
    if (q.length !== 2) continue;
    const arms = splitTop(q[1]!.text, " : ");
    if (arms.length !== 2) continue;
    const at = col - 1 - g.start;
    const condEnd = q[0]!.text.length;
    if (at < condEnd) continue;
    const thenStart = q[1]!.start;
    const elseStart = thenStart + arms[1]!.start;
    const cond = routeCondition(q[0]!.text, routes);
    if (at >= elseStart) { if (cond.pure && cond.set) exclude(cond.set); }
    else if (cond.set) restrict(cond.set);
  }

  // The blocks around it.
  let current = indentOf(text);
  for (let i = line - 2; i >= 0; i--) {
    const l = lines[i]!;
    if (blank(l)) continue;
    const ind = indentOf(l);
    if (ind >= current) continue;
    current = ind;
    const t = l.trim();
    if (/^(component|view)\b/.test(t) || ind === 0) break;
    const chain = /^(if|else if|else)\b(.*)$/.exec(t);
    if (!chain) continue;
    if (chain[1] !== "else") {
      const cond = routeCondition(chain[2]!, routes);
      if (cond.set) restrict(cond.set);
    }
    if (chain[1] !== "if") {
      // The siblings above it in the same chain: a pure one is "not those routes".
      for (let j = i - 1; j >= 0; j--) {
        const s = lines[j]!;
        if (blank(s)) continue;
        const si = indentOf(s);
        if (si > ind) continue;
        if (si < ind) break;
        const st = /^(if|else if)\b(.*)$/.exec(s.trim());
        if (!st) break;
        const cond = routeCondition(st[2]!, routes);
        if (cond.pure && cond.set) exclude(cond.set);
        if (st[1] === "if") break;
      }
    }
  }
  return set;
}

/** The router verb whose call a `path("…")` at this column is an argument of, or `link` for an `href=`. */
export function verbAt(text: string, col: number): RouterVerb {
  const before = text.slice(0, col - 1);
  const candidates: Array<[RouterVerb, number]> = [
    ["push", before.lastIndexOf("push(")],
    ["replace", before.lastIndexOf("replace(")],
    ["go", before.lastIndexOf("go(")],
    ["link", before.lastIndexOf("href=")],
  ];
  const [verb, at] = candidates.reduce((best, c) => (c[1] > best[1] ? c : best), ["path" as RouterVerb, -1]);
  return at >= 0 ? verb : "path";
}

/** The action a line sits in the body of, by indentation, or null. */
export function actionAt(lines: readonly string[], line: number, actions: readonly SymbolDef[]): SymbolDef | null {
  let best: SymbolDef | null = null;
  for (const a of actions) {
    if (a.line >= line) continue;
    const ind = indentOf(lines[a.line - 1] ?? "");
    let inside = true;
    for (let i = a.line; i < line - 1; i++) {
      const l = lines[i]!;
      if (blank(l)) continue;
      if (indentOf(l) <= ind) { inside = false; break; }
    }
    if (inside && indentOf(lines[line - 1] ?? "") > ind && (!best || a.line > best.line)) best = a;
  }
  return best;
}

/** Lines in an action's body. */
function bodyOf(lines: readonly string[], action: SymbolDef): Array<{ text: string; line: number }> {
  const ind = indentOf(lines[action.line - 1] ?? "");
  const out: Array<{ text: string; line: number }> = [];
  for (let i = action.line; i < lines.length; i++) {
    const l = lines[i]!;
    if (blank(l)) continue;
    if (indentOf(l) <= ind) break;
    out.push({ text: l, line: i + 1 });
  }
  return out;
}

/**
 * **Every arrow of the flow map** (design §3): a push, replace or link to
 * each route `symbols` names as a target, from the routes the reader finds
 * it drawn on; Back from every pushed route to the one under it (the
 * platform draws Back for a pushed route with nothing written — an action
 * that calls `back(…)` is named on it); and, where an action `select`s the
 * router, the tab bar between its tabs.
 */
export function flowEdges(symbols: Symbols & { references?: unknown[] }, sources: Record<string, string>, routes: readonly IndexRoute[], router: string | null): { edges: FlowEdge[]; unplaced: UnplacedNavigation[] } {
  const names = new Set(routes.map((r) => r.name));
  const defs = symbols.definitions.filter(own);
  const refs = ((symbols.references ?? []) as SymbolRef[]).filter(own);
  const actions = defs.filter((d) => d.kind === "action");
  const edges: FlowEdge[] = [];
  const unplaced: UnplacedNavigation[] = [];
  const seen = new Set<string>();
  const add = (e: FlowEdge) => {
    const key = `${e.from}\u0000${e.to}\u0000${e.verb}\u0000${e.action ?? ""}`;
    if (seen.has(key) || !names.has(e.from) || !names.has(e.to)) return;
    seen.add(key);
    edges.push(e);
  };
  const linesOf = (file: string) => (sources[file] ?? "").split("\n");

  for (const ref of refs.filter((r) => r.kind === "route" && names.has(r.name)).sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.col - b.col)) {
    const lines = linesOf(ref.file);
    const text = lines[ref.line - 1] ?? "";
    const verb = verbAt(text, ref.col);
    const action = actionAt(lines, ref.line, actions.filter((a) => a.file === ref.file));
    let from: Set<string> | null = null;
    if (action) {
      const calls = refs.filter((r) => r.kind === "action" && r.name === action.name && r.file === action.file);
      for (const call of calls) {
        const at = screensAt(linesOf(call.file), call.line, call.col, names);
        if (at === null) { from = null; break; }
        from = new Set([...(from ?? []), ...at]);
      }
      if (calls.length === 0) from = null;
    } else {
      from = screensAt(lines, ref.line, ref.col, names);
    }
    if (from === null) {
      const parent = routes.find((r) => r.name === ref.name)?.parent ?? null;
      if (parent) add({ from: parent, to: ref.name, verb, action: action?.name ?? null, file: ref.file, line: ref.line, via: "stack" });
      else unplaced.push({ verb, action: action?.name ?? null, file: ref.file, line: ref.line, why: `nothing around ${ref.file}:${ref.line} names the screen it is drawn on, and ${ref.name} is not pushed under another route` });
      continue;
    }
    for (const f of [...from].sort()) {
      if (f === ref.name) continue;
      add({ from: f, to: ref.name, verb, action: action?.name ?? null, file: ref.file, line: ref.line, via: "condition" });
    }
  }

  const routerName = router ?? "nav";
  const backAction = actions.find((a) => bodyOf(linesOf(a.file), a).some((l) => new RegExp(`\\bback\\(\\s*${routerName}\\b`).test(l.text)));
  for (const r of routes) {
    if (r.parent) add({ from: r.name, to: r.parent, verb: "back", action: backAction?.name ?? null, file: r.file, line: r.line, via: "stack" });
  }

  const tabs = routes.filter((r) => r.tab);
  for (const a of actions) {
    const lines = linesOf(a.file);
    for (const l of bodyOf(lines, a)) {
      if (new RegExp(`\\bselect\\(\\s*${routerName}\\b`).test(l.text)) {
        for (const x of tabs) for (const y of tabs) if (x !== y) add({ from: x.name, to: y.name, verb: "select", action: a.name, file: a.file, line: l.line, via: "tabs" });
      }
      const go = new RegExp(`\\bgo\\(\\s*${routerName}\\b`).exec(l.text);
      if (go && !/path\(/.test(l.text)) {
        unplaced.push({ verb: "go", action: a.name, file: a.file, line: l.line, why: "go() to a location the action is handed (the browser's Back and Forward, a deep link): no route is named to draw" });
      }
    }
  }
  return { edges, unplaced };
}

// ---------------------------------------------------------------- anatomy

export interface AnatomyComponent {
  name: string;
  line: number;
  props: string[];
  state: string[];
  derive: string[];
  resources: string[];
  actions: Array<{ name: string; writes: string[] }>;
  testIds: string[];
  /** Components of this app it draws. */
  uses: string[];
}

export interface AnatomyFile {
  file: string;
  routes: string[];
  components: AnatomyComponent[];
  shapes: Array<{ name: string; fields: string[] }>;
  functions: string[];
  /** The data sources the file's resources call (`app.ts` answers them). */
  sources: string[];
  /** For a `*.test.contract`: each test and how many steps it takes. */
  tests: Array<{ name: string; steps: number }>;
}

export interface CompiledTests {
  file: string;
  tests: Array<{ name: string; steps: unknown[] }>;
}

/**
 * **One card's worth per Contract file** (design §3): components with their
 * props, state, actions and what they write; shapes and their fields; the
 * data sources; the routes; and, for a test file, its tests.
 */
export function anatomy(symbols: Symbols & { references?: unknown[] }, files: readonly string[], tests: readonly CompiledTests[]): AnatomyFile[] {
  const defs = symbols.definitions.filter(own);
  const refs = ((symbols.references ?? []) as SymbolRef[]).filter(own);
  const componentNames = new Set(defs.filter((d) => d.kind === "component").map((d) => d.name));
  const out: AnatomyFile[] = [];
  for (const file of [...files].sort()) {
    const here = defs.filter((d) => d.file === file);
    const comps = here.filter((d) => d.kind === "component").sort((a, b) => a.line - b.line);
    const owned = (c: SymbolDef, kind: string) => [...new Set(here.filter((d) => d.kind === kind && (d.component === c.name || d.owner === c.name)).map((d) => d.name))];
    const components: AnatomyComponent[] = comps.map((c) => {
      const end = comps.find((o) => o.line > c.line)?.line ?? Number.POSITIVE_INFINITY;
      return {
        name: c.name,
        line: c.line,
        props: owned(c, "prop"),
        state: owned(c, "state").filter((s) => !isRouterState(here, s)),
        derive: owned(c, "derive"),
        resources: owned(c, "resource"),
        actions: here.filter((d) => d.kind === "action" && d.component === c.name).map((d) => ({ name: d.name, writes: d.writes ?? [] })),
        testIds: owned(c, "testId"),
        uses: [...new Set(refs.filter((r) => r.kind === "component" && r.file === file && r.line > c.line && r.line < end && componentNames.has(r.name) && r.name !== c.name).map((r) => r.name))].sort(),
      };
    });
    out.push({
      file,
      routes: here.filter((d) => d.kind === "route").map((d) => d.name),
      components,
      shapes: here.filter((d) => d.kind === "shape").map((s) => ({ name: s.name, fields: here.filter((d) => d.kind === "field" && d.owner === s.name).map((d) => d.name) })),
      functions: here.filter((d) => d.kind === "fn").map((d) => d.name),
      sources: [...new Set(here.filter((d) => d.kind === "source").map((d) => d.name))].sort(),
      tests: (tests.find((t) => t.file === file)?.tests ?? []).map((t) => ({ name: t.name, steps: t.steps.length })),
    });
  }
  return out;
}

/** The router's own state (`routes nav` declares `nav`) is the router, not a component's state. */
function isRouterState(defs: readonly SymbolDef[], name: string): boolean {
  const routeLine = Math.min(...defs.filter((d) => d.kind === "route").map((d) => d.line));
  return defs.some((d) => d.kind === "state" && d.name === name && Number.isFinite(routeLine) && d.line < routeLine);
}

// ---------------------------------------------------------------- the design

export interface TamberToken {
  name: string;
  kind: string;
  role: string | null;
  values: string[];
  fallback: string[] | null;
}

export interface TamberIr {
  format: number;
  digest: string;
  name: string;
  axes: unknown[];
  tokens: TamberToken[];
}

export interface TokenUse {
  file: string;
  line: number;
  col: number;
  component: string | null;
  row: string | null;
  via?: unknown;
}

export interface DesignReading {
  ir: TamberIr;
  /** `uses` per token, from the design server's wire. */
  uses: Record<string, { sites: TokenUse[]; aliases: string[] } | { error: string }>;
}

export interface IndexToken {
  name: string;
  kind: string;
  light: string | null;
  dark: string | null;
  values: string[];
  uses: Array<{ file: string; line: number; component: string | null; row: string | null }>;
  aliases: string[];
}

export interface IndexDesign {
  name: string;
  digest: string;
  tokens: IndexToken[];
}

const hex8 = (v: string | undefined) => (v && /^#[0-9a-fA-F]{8}$/.test(v) && v.toLowerCase().endsWith("ff") ? v.slice(0, 7).toLowerCase() : v ?? null);

export function indexDesign(design: DesignReading | null): IndexDesign | null {
  if (!design) return null;
  return {
    name: design.ir.name,
    digest: design.ir.digest,
    tokens: design.ir.tokens.map((t) => {
      const u = design.uses[t.name];
      const ok = u && "sites" in u ? u : null;
      return {
        name: t.name,
        kind: t.kind,
        light: hex8(t.fallback?.[0]),
        dark: hex8(t.fallback?.[1] ?? t.fallback?.[0]),
        values: t.values,
        uses: (ok?.sites ?? []).map((s) => ({ file: s.file, line: s.line, component: s.component ?? null, row: s.row ?? null })),
        aliases: ok?.aliases ?? [],
      };
    }),
  };
}

// ---------------------------------------------------------------- devices and shots

export const DEVICES = {
  phone: { width: 390, height: 844 },
  tablet: { width: 820, height: 1180 },
  desktop: { width: 1280, height: 800 },
} as const;
export type Device = keyof typeof DEVICES;
export const SCHEMES = ["light", "dark"] as const;
export type Scheme = (typeof SCHEMES)[number];

/**
 * **How a screen is reached** (`exact.shots`, design §4): Exact's own launch
 * lines, one per line — `at "<path>"`, then driver operations that put the
 * app in the state the picture needs (`tap`, `type`, `clock`, `back`,
 * `fail fetch`, `pass fetch`, `prefer`). It comes off the canvas and is
 * handed to the person's Exact, so it is a closed list: nothing that writes
 * a file (`screenshot`), nothing outside the app's own pages, no scheme
 * (the device row sets that).
 */
export interface Shots {
  url: string;
  ops: string[];
}

const OP_LINE = /^(tap|type|clock|back|fail fetch|pass fetch|prefer)\b(.*)$/;

export function parseShots(text: string): Shots {
  let url: string | null = null;
  const ops: string[] = [];
  for (const [i, raw] of text.split("\n").entries()) {
    const line = raw.trim();
    if (line === "" || line.startsWith("//")) continue;
    const at = /^at\s+"([^"]*)"$/.exec(line);
    if (at) {
      if (url !== null) throw new Error(`exact.shots line ${i + 1}: a second \`at\` — a screen is reached from one place`);
      const path = at[1]!;
      if (!path.startsWith("/") || path.startsWith("//") || path.includes("..") || /[\s\\]/.test(path)) throw new Error(`exact.shots line ${i + 1}: \`at\` takes one of the app's own paths, like "/place/2", not ${JSON.stringify(path)}`);
      url = path;
      continue;
    }
    const op = OP_LINE.exec(line);
    if (!op) throw new Error(`exact.shots line ${i + 1}: ${JSON.stringify(line)} is not one of at, tap, type, clock, back, fail fetch, pass fetch, prefer`);
    if (op[1] === "prefer" && /\bcolor-scheme\b/.test(op[2]!)) throw new Error(`exact.shots line ${i + 1}: the device row sets the colour scheme; leave \`prefer color-scheme\` out`);
    if (/[\n\r\0]/.test(line)) throw new Error(`exact.shots line ${i + 1}: one operation per line`);
    ops.push(line);
  }
  if (url === null) throw new Error("exact.shots needs an `at \"<path>\"` line: where the driver opens the app");
  return { url, ops };
}

export function shotsText(shots: Shots): string {
  return [`at "${shots.url}"`, ...shots.ops].join("\n");
}

// ---------------------------------------------------------------- layout

/** Card sizes on the canvas, in world units. */
export const LAYOUT = {
  primary: { width: 195, height: 422 },
  rowHeight: 160,
  gap: 24,
  rowGap: 12,
  /** Between one level of the stack and the next: room for the arrows and their words. */
  levelGap: 180,
  /** Between the side column (index, design, anatomy) and the map. */
  sideWidth: 320,
  sideGap: 120,
} as const;

/** A device-row card's size: the device's own shape at the row's height. */
export function rowSize(device: Device): { width: number; height: number } {
  const d = DEVICES[device];
  return { width: Math.round((d.width / d.height) * LAYOUT.rowHeight), height: LAYOUT.rowHeight };
}

/**
 * **Where each route's screens go, relative to the map's origin**: tabs in
 * a row, each pushed route under the one it is declared under, its device
 * row (light above, dark below) to the right of its phone screen, where the
 * arrows between screens do not cross it.
 */
export function mapLayout(routes: readonly IndexRoute[], extra = 0): Map<string, { x: number; y: number; depth: number }> {
  // `extra`: the native columns' width, when a map carries other hosts (exact phase 3).
  const cellWidth = LAYOUT.primary.width + LAYOUT.gap + (["phone", "tablet", "desktop"] as Device[]).reduce((w, d) => w + rowSize(d).width + LAYOUT.rowGap, 0) + extra;
  const cellHeight = LAYOUT.primary.height + LAYOUT.levelGap;
  const children = new Map<string | null, IndexRoute[]>();
  for (const r of routes) children.set(r.parent, [...(children.get(r.parent) ?? []), r]);
  const out = new Map<string, { x: number; y: number; depth: number }>();
  /** Lay a subtree with its root at column `col`; returns how many columns it took. */
  const lay = (r: IndexRoute, col: number, depth: number): number => {
    out.set(r.name, { x: col * (cellWidth + LAYOUT.gap * 2), y: depth * cellHeight, depth });
    let used = 0;
    for (const c of children.get(r.name) ?? []) used += lay(c, col + used, depth + 1);
    return Math.max(1, used);
  };
  let col = 0;
  for (const root of children.get(null) ?? []) col += lay(root, col, 0);
  return out;
}

/** Where a device-row card sits relative to its route's phone screen. */
export function rowOffset(device: Device, scheme: Scheme): { x: number; y: number } {
  let x = LAYOUT.primary.width + LAYOUT.gap;
  for (const d of ["phone", "tablet", "desktop"] as Device[]) {
    if (d === device) break;
    x += rowSize(d).width + LAYOUT.rowGap;
  }
  return { x, y: scheme === "light" ? 0 : LAYOUT.rowHeight + LAYOUT.rowGap };
}
