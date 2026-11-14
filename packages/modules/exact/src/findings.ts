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
 * **Findings as comments** (exact phase 2; design §6): what the compiler and
 * `agent check` said, planned as ordinary comment ops — one thread per
 * finding, pinned to the screen that draws the broken line, carrying the
 * line as `exact.source`, and deleted by the bridge when the finding is gone
 * — and the *moved* reply for a comment whose file no longer hashes to the
 * digest it was made against. Pure: the CLI hands it what Exact printed and
 * the canvas, and sends what it plans. Only the CLI's verbs read it, so it is
 * kept apart from `core.ts`, which every CLI start-up reads.
 */

import type { CanvasContents, CommentThread, Item } from "@isocan/core";
import type { ExactIndex, ExactSource, IndexRoute, SymbolDef, Symbols } from "./core.ts";
import { core } from "./core-ref.ts";
import { screensAt, type SymbolRef } from "./map.ts";

/** One diagnostic as `contract build --json` prints it. */
export interface BuildDiagnostic {
  id: string;
  file: string;
  line: number;
  col: number;
  end_col?: number;
  message: string;
  severity?: string;
  related?: unknown[];
}

/** What `exact-bridge.mjs diagnose` reports. */
export interface DiagnoseReport {
  diagnostics: BuildDiagnostic[];
  symbols: Symbols | null;
  sources: Record<string, string>;
  digests: Record<string, string>;
}

/** One `agent check` finding, as the driver prints it with `--json`. */
export interface CheckFinding {
  kind: string;
  line?: string;
  text?: string;
  node?: string | null;
  box?: [number, number, number, number];
  hint?: string;
}

/** What `exact-bridge.mjs check` reports: per path, light and dark. */
export interface CheckReport {
  checks: Array<{ url: string; check: Array<{ scheme: string; findings: CheckFinding[] }> }>;
}

/** One finding, ready to be a comment. */
export interface Finding {
  /** `build:<id>:<file>:<message digest>` or `check:<route>:<scheme>:<kind>:<node>` — stable across saves that do not fix it. */
  key: string;
  /** The routes whose screens draw it; the first one's screen carries the comment. */
  routes: string[];
  scheme: "light" | "dark";
  /** Where on the phone screen, in its CSS pixels (390 wide), when the finding names a box. */
  box: [number, number, number, number] | null;
  body: string;
}

const own = (d: { file: string }) => d.file.endsWith(".contract") && !d.file.includes(":");
const short = (text: string) => {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(h, 31) + text.charCodeAt(i)) >>> 0;
  return h.toString(36);
};

/**
 * **The routes whose screens draw a line** (design §6): the component the
 * line sits in; where that is the routed view, the `e.name == …` conditions
 * around the line (the map's own reader, `screensAt`); where it is another
 * component, the same question asked at each place it is drawn, one level
 * up at a time. A line no route condition narrows is drawn on every route.
 */
export function routesDrawing(symbols: Symbols | null, sources: Record<string, string>, routes: readonly IndexRoute[], file: string, line: number, col = 1): string[] {
  const names = new Set(routes.map((r) => r.name));
  const all = routes.map((r) => r.name);
  if (!symbols) return all;
  const defs = symbols.definitions.filter(own);
  const refs = ((symbols.references ?? []) as SymbolRef[]).filter(own);
  const components = defs.filter((d) => d.kind === "component").sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  const around = (f: string, l: number): SymbolDef | null => components.filter((c) => c.file === f && c.line <= l).at(-1) ?? null;
  const seen = new Set<string>();
  const ask = (f: string, l: number, c: number, depth: number): Set<string> | null => {
    const comp = around(f, l);
    const lines = (sources[f] ?? "").split("\n");
    const here = screensAt(lines, l, c, names);
    if (here) return here;
    if (!comp || depth > 4 || seen.has(comp.name)) return null;
    const calls = refs.filter((r) => r.kind === "component" && r.name === comp.name);
    if (calls.length === 0) return null;
    seen.add(comp.name);
    let union: Set<string> | null = new Set();
    for (const call of calls) {
      const at = ask(call.file, call.line, call.col, depth + 1);
      if (at === null) { union = null; break; }
      for (const r of at) union.add(r);
    }
    return union;
  };
  const found = ask(file, line, col, 0);
  const list = found ? all.filter((r) => found.has(r)) : all;
  return list.length > 0 ? list : all;
}

/** Where a `testId` is written: the definition `symbols` names for it. */
export function testIdPlace(symbols: Symbols | null, testId: string): { file: string; line: number; col: number } | null {
  const def = symbols?.definitions.find((d) => d.kind === "testId" && d.name === testId && own(d));
  return def ? { file: def.file, line: def.line, col: def.col } : null;
}

/**
 * **The compiler's diagnostics as findings**: one per diagnostic, keyed so a
 * line moving under it keeps its comment, pinned to the screens its line
 * draws, its body saying the place, the words, the id and `exact.source`.
 */
export function buildFindings(report: DiagnoseReport, routes: readonly IndexRoute[]): Finding[] {
  const out: Finding[] = [];
  const seen = new Set<string>();
  for (const d of report.diagnostics) {
    if (d.severity && d.severity !== "error") continue;
    const key = `build:${d.id}:${d.file}:${short(d.message)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const drawn = routesDrawing(report.symbols, report.sources, routes, d.file, d.line, d.col);
    const digest = report.digests[d.file];
    const lines = [
      `Compile error at ${d.file}:${d.line}:${d.col} — ${d.message} (\`${d.id}\`)`,
      `Drawn on: ${drawn.join(", ")}. Posted by \`isocan exact live\`; it goes when the build no longer says it.`,
      ...(digest ? [core.sourceLine({ file: d.file, line: d.line, col: d.col, sha256: digest })] : []),
      `exact.diagnostic = ${key}`,
    ];
    out.push({ key, routes: drawn, scheme: "light", box: null, body: lines.join("\n") });
  }
  return out;
}

/** `agent check both`'s findings for the routes checked, each on that route's phone screen in its scheme, at the box it names. */
export function checkFindings(report: CheckReport, diag: DiagnoseReport | null, routes: ReadonlyArray<{ route: string; url: string }>): Finding[] {
  const out: Finding[] = [];
  for (const one of report.checks) {
    const route = routes.find((r) => r.url === one.url)?.route;
    if (!route) continue;
    for (const pass of one.check) {
      const scheme = pass.scheme === "dark" ? "dark" : "light";
      for (const f of pass.findings) {
        const node = f.node ?? (f.text ? short(f.text) : "page");
        const key = `check:${route}:${scheme}:${f.kind}:${node}`;
        const place = f.node ? testIdPlace(diag?.symbols ?? null, f.node) : null;
        const digest = place ? diag?.digests[place.file] : undefined;
        const lines = [
          `\`agent check\` on ${route}, phone ${scheme}: ${(f.line ?? `${f.kind} ${f.text ?? ""}`).trim()}`,
          `Posted by \`isocan exact live\`; it goes when the check no longer finds it.`,
          ...(place && digest ? [core.sourceLine({ ...place, sha256: digest })] : []),
          `exact.diagnostic = ${key}`,
        ];
        out.push({ key, routes: [route], scheme, box: Array.isArray(f.box) && f.box.length === 4 ? f.box : null, body: lines.join("\n") });
      }
    }
  }
  return out;
}

/** The threads this app's findings already hold, by key: a thread whose first comment carries `exact.diagnostic`, pinned to one of the app's items. */
export function postedFindings(canvas: CanvasContents, appId: string): Map<string, CommentThread> {
  const out = new Map<string, CommentThread>();
  for (const thread of Object.values(canvas.threads ?? {})) {
    const first = thread.comments[0];
    const key = first ? core.diagnosticKey(first.body) : null;
    if (!key || !thread.anchorItemId) continue;
    const item = canvas.items[thread.anchorItemId];
    if (!item || core.appIdOf(item) !== appId) continue;
    out.set(key, thread);
  }
  return out;
}

export interface FindingsPlan {
  create: Array<{ finding: Finding; item: Item; x: number; y: number }>;
  update: Array<{ thread: CommentThread; body: string }>;
  remove: Array<{ thread: CommentThread; key: string }>;
}

/**
 * **What to send** so the canvas says exactly the findings there are: a new
 * thread for each new one, the first comment rewritten where its words or
 * line moved (the bridge wrote it, so it may), and the thread taken away
 * where the finding is gone — but only for the kinds of finding this pass
 * looked for (`scope`): a pass that ran no check leaves the check's threads.
 */
export function planFindings(canvas: CanvasContents, index: Pick<ExactIndex, "app">, findings: readonly Finding[], scope: (key: string) => boolean): FindingsPlan {
  const posted = postedFindings(canvas, index.app.id);
  const plan: FindingsPlan = { create: [], update: [], remove: [] };
  for (const f of findings) {
    const thread = posted.get(f.key);
    if (thread) {
      if (thread.comments[0]!.body !== f.body) plan.update.push({ thread, body: f.body });
      continue;
    }
    const item = f.routes.map((r) => core.screenItemOf(canvas, index.app.id, r, "phone", f.scheme)).find(Boolean)
      ?? f.routes.map((r) => core.screenItemOf(canvas, index.app.id, r)).find(Boolean);
    if (!item) continue;
    const scale = item.width / 390;
    const x = f.box ? Math.round(Math.min(item.width - 8, (f.box[0] + f.box[2]) * scale)) : Math.round(item.width - 12);
    const y = f.box ? Math.round(Math.min(item.height - 8, f.box[1] * scale)) : 12;
    plan.create.push({ finding: f, item, x, y });
  }
  const live = new Set(findings.map((f) => f.key));
  for (const [key, thread] of posted) if (scope(key) && !live.has(key)) plan.remove.push({ thread, key });
  return plan;
}

/**
 * **Comments whose line has moved** (design §6): a comment on one of this
 * app's items carrying `exact.source`, whose file now hashes to another
 * digest, and whose thread has not been told it moved since that comment (once per move,
 * however many saves follow). The
 * bridge's own findings are rewritten instead, so they are left out.
 */
export function movedComments(canvas: CanvasContents, appId: string, digests: Readonly<Record<string, string>>): Array<{ thread: CommentThread; source: ExactSource; now: string }> {
  const out: Array<{ thread: CommentThread; source: ExactSource; now: string }> = [];
  for (const thread of Object.values(canvas.threads ?? {})) {
    if (!thread.anchorItemId) continue;
    const item = canvas.items[thread.anchorItemId];
    if (!item || core.appIdOf(item) !== appId) continue;
    if (core.diagnosticKey(thread.comments[0]?.body ?? "")) continue;
    // Told ONCE per move: the newest comment that carries a source is the one that counts, and a Moved reply after it
    // already said so — every later save that changes the file again is the same move, not a new one. A comment
    // made afresh (a new exact.source) starts the count again.
    const latest = thread.comments.map((c, i) => ({ i, source: core.parseSource(c.body) })).filter((x) => x.source).at(-1);
    if (!latest?.source) continue;
    const now = digests[latest.source.file];
    if (!now || now === latest.source.sha256) continue;
    if (thread.comments.slice(latest.i + 1).some((c) => core.movedDigest(c.body))) continue;
    out.push({ thread, source: latest.source, now });
  }
  return out;
}

/** The *moved* reply's words. */
export function movedBody(source: ExactSource, now: string): string {
  return [
    `Moved: ${source.file} has changed since this comment pointed at ${core.sourcePlace(source)} — that line may be another line now. Read the file, find the place by what the comment says, and do not trust the number alone.`,
    `exact.moved = ${now}`,
  ].join("\n");
}
