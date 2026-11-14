import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  designSystemProperties
} from "./chunk-UJFMP4CZ.mjs";
import "./chunk-GUY4UN4O.mjs";
import {
  serializeDesign
} from "./chunk-K4TDP4L5.mjs";
import "./chunk-JYOOXWJZ.mjs";

// packages/modules/exact/src/cli-run.ts
import { createHash } from "node:crypto";
import { promises as fs, watch } from "node:fs";
import os from "node:os";
import path from "node:path";

// packages/modules/exact/src/core-ref.ts
var core;
function bindCore(record) {
  core = record;
}

// packages/modules/exact/src/map.ts
var own = (d) => d.file.endsWith(".contract") && !d.file.includes(":");
var indentOf = (line) => line.length - line.trimStart().length;
var blank = (line) => line.trim() === "" || line.trim().startsWith("//");
function groupsAround(text, col0) {
  const out = [];
  const open2 = [];
  const spans = [];
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' && text[i - 1] !== "\\") inString = !inString;
    if (inString) continue;
    if (c === "(") open2.push(i);
    else if (c === ")" && open2.length > 0) spans.push({ start: open2.pop() + 1, end: i });
  }
  for (const s of spans) if (s.start <= col0 && col0 < s.end) out.push(s);
  out.sort((a, b) => a.end - a.start - (b.end - b.start));
  out.push({ start: 0, end: text.length });
  return out;
}
function splitTop(text, token) {
  const parts = [];
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
var NAME_TERM = /^\(?\s*(?:[A-Za-z_][A-Za-z0-9_]*|top\([^()]*\))\.name\s*==\s*"([^"]+)"\s*\)?$/;
function routeCondition(cond, routes) {
  let text = cond.trim();
  while (text.startsWith("(") && text.endsWith(")") && groupsAround(text, 1)[0]?.start === 1 && groupsAround(text, 1)[0]?.end === text.length - 1) text = text.slice(1, -1).trim();
  const disjuncts = splitTop(text, " or ").map((d) => d.text.trim());
  let union = /* @__PURE__ */ new Set();
  let pure = true;
  for (const d of disjuncts) {
    const conjuncts = splitTop(d, " and ").map((c) => c.text.trim());
    let meet = null;
    for (const c of conjuncts) {
      const m = NAME_TERM.exec(c);
      const name = m?.[1];
      if (name === void 0 || !routes.has(name)) continue;
      meet = meet === null ? /* @__PURE__ */ new Set([name]) : new Set([...meet].filter((r) => r === name));
    }
    if (conjuncts.length !== 1 || meet === null) pure = false;
    if (meet === null) union = null;
    else if (union !== null) for (const r of meet) union.add(r);
  }
  if (union === null) pure = false;
  return { set: union, pure };
}
function screensAt(lines, line, col, routes) {
  let set = null;
  const restrict = (to) => {
    set = set === null ? new Set(to) : new Set([...set].filter((r) => to.has(r)));
  };
  const exclude = (out) => {
    set = new Set([...set ?? routes].filter((r) => !out.has(r)));
  };
  const text = lines[line - 1] ?? "";
  for (const g of groupsAround(text, col - 1)) {
    const body = text.slice(g.start, g.end);
    const q = splitTop(body, " ? ");
    if (q.length !== 2) continue;
    const arms = splitTop(q[1].text, " : ");
    if (arms.length !== 2) continue;
    const at = col - 1 - g.start;
    const condEnd = q[0].text.length;
    if (at < condEnd) continue;
    const thenStart = q[1].start;
    const elseStart = thenStart + arms[1].start;
    const cond = routeCondition(q[0].text, routes);
    if (at >= elseStart) {
      if (cond.pure && cond.set) exclude(cond.set);
    } else if (cond.set) restrict(cond.set);
  }
  let current = indentOf(text);
  for (let i = line - 2; i >= 0; i--) {
    const l = lines[i];
    if (blank(l)) continue;
    const ind = indentOf(l);
    if (ind >= current) continue;
    current = ind;
    const t = l.trim();
    if (/^(component|view)\b/.test(t) || ind === 0) break;
    const chain = /^(if|else if|else)\b(.*)$/.exec(t);
    if (!chain) continue;
    if (chain[1] !== "else") {
      const cond = routeCondition(chain[2], routes);
      if (cond.set) restrict(cond.set);
    }
    if (chain[1] !== "if") {
      for (let j = i - 1; j >= 0; j--) {
        const s = lines[j];
        if (blank(s)) continue;
        const si = indentOf(s);
        if (si > ind) continue;
        if (si < ind) break;
        const st = /^(if|else if)\b(.*)$/.exec(s.trim());
        if (!st) break;
        const cond = routeCondition(st[2], routes);
        if (cond.pure && cond.set) exclude(cond.set);
        if (st[1] === "if") break;
      }
    }
  }
  return set;
}
function verbAt(text, col) {
  const before = text.slice(0, col - 1);
  const candidates = [
    ["push", before.lastIndexOf("push(")],
    ["replace", before.lastIndexOf("replace(")],
    ["go", before.lastIndexOf("go(")],
    ["link", before.lastIndexOf("href=")]
  ];
  const [verb, at] = candidates.reduce((best, c) => c[1] > best[1] ? c : best, ["path", -1]);
  return at >= 0 ? verb : "path";
}
function actionAt(lines, line, actions) {
  let best = null;
  for (const a of actions) {
    if (a.line >= line) continue;
    const ind = indentOf(lines[a.line - 1] ?? "");
    let inside = true;
    for (let i = a.line; i < line - 1; i++) {
      const l = lines[i];
      if (blank(l)) continue;
      if (indentOf(l) <= ind) {
        inside = false;
        break;
      }
    }
    if (inside && indentOf(lines[line - 1] ?? "") > ind && (!best || a.line > best.line)) best = a;
  }
  return best;
}
function bodyOf(lines, action) {
  const ind = indentOf(lines[action.line - 1] ?? "");
  const out = [];
  for (let i = action.line; i < lines.length; i++) {
    const l = lines[i];
    if (blank(l)) continue;
    if (indentOf(l) <= ind) break;
    out.push({ text: l, line: i + 1 });
  }
  return out;
}
function flowEdges(symbols, sources, routes, router) {
  const names = new Set(routes.map((r) => r.name));
  const defs = symbols.definitions.filter(own);
  const refs = (symbols.references ?? []).filter(own);
  const actions = defs.filter((d) => d.kind === "action");
  const edges = [];
  const unplaced = [];
  const seen = /* @__PURE__ */ new Set();
  const add = (e) => {
    const key = `${e.from}\0${e.to}\0${e.verb}\0${e.action ?? ""}`;
    if (seen.has(key) || !names.has(e.from) || !names.has(e.to)) return;
    seen.add(key);
    edges.push(e);
  };
  const linesOf = (file) => (sources[file] ?? "").split("\n");
  for (const ref of refs.filter((r) => r.kind === "route" && names.has(r.name)).sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.col - b.col)) {
    const lines = linesOf(ref.file);
    const text = lines[ref.line - 1] ?? "";
    const verb = verbAt(text, ref.col);
    const action = actionAt(lines, ref.line, actions.filter((a) => a.file === ref.file));
    let from = null;
    if (action) {
      const calls = refs.filter((r) => r.kind === "action" && r.name === action.name && r.file === action.file);
      for (const call of calls) {
        const at = screensAt(linesOf(call.file), call.line, call.col, names);
        if (at === null) {
          from = null;
          break;
        }
        from = /* @__PURE__ */ new Set([...from ?? [], ...at]);
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
function anatomy(symbols, files, tests) {
  const defs = symbols.definitions.filter(own);
  const refs = (symbols.references ?? []).filter(own);
  const componentNames = new Set(defs.filter((d) => d.kind === "component").map((d) => d.name));
  const out = [];
  for (const file of [...files].sort()) {
    const here = defs.filter((d) => d.file === file);
    const comps = here.filter((d) => d.kind === "component").sort((a, b) => a.line - b.line);
    const owned = (c, kind) => [...new Set(here.filter((d) => d.kind === kind && (d.component === c.name || d.owner === c.name)).map((d) => d.name))];
    const components = comps.map((c) => {
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
        uses: [...new Set(refs.filter((r) => r.kind === "component" && r.file === file && r.line > c.line && r.line < end && componentNames.has(r.name) && r.name !== c.name).map((r) => r.name))].sort()
      };
    });
    out.push({
      file,
      routes: here.filter((d) => d.kind === "route").map((d) => d.name),
      components,
      shapes: here.filter((d) => d.kind === "shape").map((s) => ({ name: s.name, fields: here.filter((d) => d.kind === "field" && d.owner === s.name).map((d) => d.name) })),
      functions: here.filter((d) => d.kind === "fn").map((d) => d.name),
      sources: [...new Set(here.filter((d) => d.kind === "source").map((d) => d.name))].sort(),
      tests: (tests.find((t) => t.file === file)?.tests ?? []).map((t) => ({ name: t.name, steps: t.steps.length }))
    });
  }
  return out;
}
function isRouterState(defs, name) {
  const routeLine = Math.min(...defs.filter((d) => d.kind === "route").map((d) => d.line));
  return defs.some((d) => d.kind === "state" && d.name === name && Number.isFinite(routeLine) && d.line < routeLine);
}
var hex8 = (v) => v && /^#[0-9a-fA-F]{8}$/.test(v) && v.toLowerCase().endsWith("ff") ? v.slice(0, 7).toLowerCase() : v ?? null;
function indexDesign(design) {
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
        aliases: ok?.aliases ?? []
      };
    })
  };
}
var DEVICES = {
  phone: { width: 390, height: 844 },
  tablet: { width: 820, height: 1180 },
  desktop: { width: 1280, height: 800 }
};
var SCHEMES = ["light", "dark"];
var OP_LINE = /^(tap|type|clock|back|fail fetch|pass fetch|prefer)\b(.*)$/;
function parseShots(text) {
  let url = null;
  const ops = [];
  for (const [i, raw] of text.split("\n").entries()) {
    const line = raw.trim();
    if (line === "" || line.startsWith("//")) continue;
    const at = /^at\s+"([^"]*)"$/.exec(line);
    if (at) {
      if (url !== null) throw new Error(`exact.shots line ${i + 1}: a second \`at\` \u2014 a screen is reached from one place`);
      const path2 = at[1];
      if (!path2.startsWith("/") || path2.startsWith("//") || path2.includes("..") || /[\s\\]/.test(path2)) throw new Error(`exact.shots line ${i + 1}: \`at\` takes one of the app's own paths, like "/place/2", not ${JSON.stringify(path2)}`);
      url = path2;
      continue;
    }
    const op = OP_LINE.exec(line);
    if (!op) throw new Error(`exact.shots line ${i + 1}: ${JSON.stringify(line)} is not one of at, tap, type, clock, back, fail fetch, pass fetch, prefer`);
    if (op[1] === "prefer" && /\bcolor-scheme\b/.test(op[2])) throw new Error(`exact.shots line ${i + 1}: the device row sets the colour scheme; leave \`prefer color-scheme\` out`);
    if (/[\n\r\0]/.test(line)) throw new Error(`exact.shots line ${i + 1}: one operation per line`);
    ops.push(line);
  }
  if (url === null) throw new Error('exact.shots needs an `at "<path>"` line: where the driver opens the app');
  return { url, ops };
}
function shotsText(shots) {
  return [`at "${shots.url}"`, ...shots.ops].join("\n");
}
var LAYOUT = {
  primary: { width: 195, height: 422 },
  rowHeight: 160,
  gap: 24,
  rowGap: 12,
  /** Between one level of the stack and the next: room for the arrows and their words. */
  levelGap: 180,
  /** Between the side column (index, design, anatomy) and the map. */
  sideWidth: 320,
  sideGap: 120
};
function rowSize(device) {
  const d = DEVICES[device];
  return { width: Math.round(d.width / d.height * LAYOUT.rowHeight), height: LAYOUT.rowHeight };
}
function mapLayout(routes) {
  const cellWidth = LAYOUT.primary.width + LAYOUT.gap + ["phone", "tablet", "desktop"].reduce((w, d) => w + rowSize(d).width + LAYOUT.rowGap, 0);
  const cellHeight = LAYOUT.primary.height + LAYOUT.levelGap;
  const children = /* @__PURE__ */ new Map();
  for (const r of routes) children.set(r.parent, [...children.get(r.parent) ?? [], r]);
  const out = /* @__PURE__ */ new Map();
  const lay = (r, col2, depth) => {
    out.set(r.name, { x: col2 * (cellWidth + LAYOUT.gap * 2), y: depth * cellHeight, depth });
    let used = 0;
    for (const c of children.get(r.name) ?? []) used += lay(c, col2 + used, depth + 1);
    return Math.max(1, used);
  };
  let col = 0;
  for (const root of children.get(null) ?? []) col += lay(root, col, 0);
  return out;
}
function rowOffset(device, scheme) {
  let x = LAYOUT.primary.width + LAYOUT.gap;
  for (const d of ["phone", "tablet", "desktop"]) {
    if (d === device) break;
    x += rowSize(d).width + LAYOUT.rowGap;
  }
  return { x, y: scheme === "light" ? 0 : LAYOUT.rowHeight + LAYOUT.rowGap };
}

// packages/modules/exact/src/build.ts
var own2 = (def) => def.file.endsWith(".contract") && !def.file.includes(":");
function buildIndex(readings) {
  const { router, routes } = core.contractRoutes(readings.symbols, readings.sources);
  const defs = readings.symbols.definitions.filter(own2);
  const names = (kind) => [...new Set(defs.filter((d) => d.kind === kind).map((d) => d.name))].sort();
  const flow = flowEdges(readings.symbols, readings.sources, routes, router);
  const files = [.../* @__PURE__ */ new Set([...Object.keys(readings.sources), ...(readings.tests ?? []).map((t) => t.file)])];
  return {
    format: core.EXACT_INDEX_FORMAT,
    app: readings.app,
    exact: readings.exact,
    plan: readings.plan,
    routes,
    router,
    components: names("component"),
    actions: defs.filter((d) => d.kind === "action").map((d) => ({ name: d.name, component: d.component ?? null, writes: d.writes ?? [] })),
    sources: [...new Set(readings.symbols.definitions.filter((d) => d.kind === "source" && own2(d)).map((d) => d.name))].sort(),
    routesJson: core.checkRoutes(routes, readings.routesJson),
    edges: flow.edges,
    unplaced: flow.unplaced,
    anatomy: anatomy(readings.symbols, files, readings.tests ?? []),
    grants: readings.grants ?? null,
    design: indexDesign(readings.design ?? null),
    inputs: readings.inputs ?? null
  };
}
function captureKeyParts(index, route, device, scheme, shots) {
  return JSON.stringify([index.inputs, route, device, scheme, "web", core.CAPTURE_AT, DEVICES[device], shots]);
}
function designMarkdown(index) {
  const design = index.design;
  if (!design) return null;
  const colors = {};
  const spacing = {};
  for (const t of design.tokens) {
    if (t.kind === "color" && t.light && /^#[0-9a-f]{6}$/.test(t.light)) colors[t.name] = t.light;
    else if ((t.kind === "number" || t.kind === "length") && t.values.length === 1 && /^\d+(\.\d+)?(px)?$/.test(t.values[0])) spacing[t.name] = /px$/.test(t.values[0]) ? t.values[0] : Number(t.values[0]);
  }
  const tokens = {
    name: `${index.app.name} (app.tamber)`,
    description: `The design of the Exact app ${index.app.id}, read from its app.tamber by \`tamber ir\` (digest ${design.digest}). Edit app.tamber, not this file: the next capture rewrites it.`,
    ...Object.keys(colors).length ? { colors } : {},
    ...Object.keys(spacing).length ? { spacing } : {},
    isocan: { exact: { app: index.app.id, digest: design.digest, tokens: design.tokens.map((t) => ({ name: t.name, kind: t.kind, values: t.values })) } }
  };
  const where = (t) => t.uses.length === 0 ? "not used" : t.uses.map((u) => `${u.file}:${u.line}${u.component ? ` (${u.component})` : ""}`).join(", ");
  const rows = design.tokens.map((t) => `| \`${t.name}\` | ${t.kind} | ${t.light ?? t.values.join(" ")} | ${t.dark ?? ""} | ${where(t)} |`);
  const body = [
    "## Overview",
    "",
    `The tokens of ${index.app.name}'s \`app.tamber\`, as the app's own compiler folds them, with where each is used.`,
    "",
    "## Colors",
    "",
    "| Token | Kind | Light | Dark | Used at |",
    "| --- | --- | --- | --- | --- |",
    ...rows
  ].join("\n");
  return serializeDesign(tokens, body);
}
function designItemProperties(index) {
  return { ...designSystemProperties(), [core.EXACT_PROPS.app]: JSON.stringify({ id: index.app.id }), [core.EXACT_PROPS.tamber]: index.design?.digest ?? "" };
}

// packages/modules/exact/src/cli-run.ts
var id = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
var sha256 = (text) => createHash("sha256").update(text).digest("hex");
var PROVEN = { commit: "cbe553f6", protocol: "tamber/1.18", bun: "1.4.2" };
async function bridge(host, verb, args, what, quiet) {
  if (!host.runPackageScript) throw new Error("this isocan cannot run a script for a module \u2014 upgrade it (module API 0.2.11)");
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-exact-"));
  const report = path.join(dir, "report.json");
  try {
    host.runPackageScript("scripts/exact-bridge.mjs", [verb, ...args, "--report", report], { what, quiet });
    return JSON.parse(await fs.readFile(report, "utf8"));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
function appDir(given) {
  return path.resolve(given ?? ".");
}
async function doctor(host, given, opts, cmd) {
  const ctx = await host.ctxOf(cmd);
  const app = appDir(given);
  const r = await bridge(host, "doctor", ["--app", app, "--hosts", opts.hosts ?? "web"], "the Exact check", ctx.json);
  const warnings = [];
  if (r.bun.pin && r.bun.version && r.bun.version !== r.bun.pin) warnings.push(`Bun ${r.bun.version} is not Exact's pin ${r.bun.pin} \u2014 warned, not refused`);
  if (r.commit && !r.commit.startsWith(PROVEN.commit)) warnings.push(`this module was proven against Exact ${PROVEN.commit}; ${r.commit.slice(0, 8)} is tried as it is`);
  if (r.tamber.protocol && r.tamber.protocol !== PROVEN.protocol) warnings.push(`Tamber ${r.tamber.protocol} is not ${PROVEN.protocol}, which this module was proven against`);
  if (r.dirty > 0) warnings.push(`the checkout has ${r.dirty} changed file${r.dirty === 1 ? "" : "s"}`);
  const missing = r.setup.filter((row) => row.status !== "ok" && row.status !== "ready");
  if (ctx.json) return host.printJson({ ...r, proven: PROVEN, warnings, ready: missing.length === 0 });
  console.log(`${r.app} \u2014 on this machine`);
  console.log(`  checkout  ${r.checkout} @ ${r.commit?.slice(0, 8) ?? "?"}${r.subject ? ` (${r.subject})` : ""}`);
  console.log(`  bun       ${r.bun.version ?? "not found"} (${r.bun.path}); Exact pins ${r.bun.pin ?? r.bun.packageManager ?? "?"}`);
  console.log(`  tamber    ${r.tamber.protocol ?? `none \u2014 ${r.tamber.note}`}`);
  for (const row of r.setup) if (row.what !== "setup --check") console.log(`  ${row.status.padEnd(8)}  ${row.host}: ${row.what} \u2014 ${row.detail}`);
  for (const row of r.setup) if (row.what === "setup --check") console.log(`  ${row.host}: ${row.status}`);
  for (const w of warnings) console.log(`  warning: ${w}`);
}
var sameProps = (item, props) => Object.entries(props).every(([k, v]) => item.properties?.[k] === v);
async function upsert(host, ctx, canvasId, snapshot, existing, file, add, group) {
  const put = await ctx.client.uploadBlob(canvasId, file.bytes, file.mime, file.filename);
  const current = existing?.versions.find((v) => v.id === existing.currentVersionId) ?? existing?.versions.at(-1);
  if (existing && current?.blobHash === put.blobHash) {
    if (!sameProps(existing, add.properties)) await host.sendOp(ctx, canvasId, { type: "item.update", itemId: existing.id, patch: { properties: add.properties } }, group);
    return { itemId: existing.id, status: "unchanged", blobHash: put.blobHash };
  }
  const version = { id: id("ver"), blobHash: put.blobHash, mimeType: file.mime, filename: file.filename, size: put.size };
  if (existing) {
    await host.sendOp(ctx, canvasId, { type: "item.addVersion", itemId: existing.id, version }, group);
    if (!sameProps(existing, add.properties)) await host.sendOp(ctx, canvasId, { type: "item.update", itemId: existing.id, patch: { properties: add.properties } }, group);
    return { itemId: existing.id, status: "new version", blobHash: put.blobHash };
  }
  const itemId = id("itm");
  const groups = snapshot.project.groupMode === "groups";
  const op = {
    type: "item.add",
    itemId,
    version,
    width: add.width,
    height: add.height,
    // Chosen: the map is a layout — tabs in a row, pushes under, each
    // device row beside its screen — and the daemon's tidying would scatter
    // it. The spot is computed from the index card's, which sits clear of
    // everything else on the canvas (`mapOrigin`).
    placement: { x: Math.round(add.at.x), y: Math.round(add.at.y), chosen: true },
    title: add.title,
    properties: add.properties,
    ...groups ? { containerId: null, groupPlacement: "exact" } : {}
  };
  await host.sendOp(ctx, canvasId, op, group);
  return { itemId, status: "new", blobHash: put.blobHash };
}
function mapOrigin(snapshot, index) {
  if (index) return { x: index.x, y: index.y };
  const items = Object.values(snapshot.canvas.items);
  if (items.length === 0) return { x: 0, y: 0 };
  return { x: Math.round(Math.max(...items.map((i) => i.x + i.width)) + 400), y: Math.round(Math.min(...items.map((i) => i.y))) };
}
var DEVICE_NAMES = Object.keys(DEVICES);
function listOf(given, all, what) {
  if (!given) return [...all];
  const picked = given.split(",").map((s) => s.trim()).filter(Boolean);
  for (const p of picked) if (!all.includes(p)) throw new Error(`--${what} takes ${all.join(", ")}, not ${p}`);
  return picked;
}
async function sync(host, ctx, canvasId, app, opts) {
  const readings = await bridge(host, "read", ["--app", app], "reading the app", true);
  const index = buildIndex(readings);
  if (index.routes.length === 0) throw new Error(`${index.app.name} declares no routes in Contract \u2014 the map captures an app's routes; \`contract vocab routes\` says how to declare them`);
  let snapshot = await ctx.client.snapshot(canvasId);
  const appId = index.app.id;
  const wants = [];
  for (const route of index.routes) {
    const primary = core.screenItemOf(snapshot.canvas, appId, route.name);
    const fallback = primary?.properties?.[core.EXACT_PROPS.shots] ?? `at "${core.routeLocation(route, opts.params)}"`;
    for (const device of opts.devices) {
      for (const scheme of opts.schemes) {
        const existing = core.screenItemOf(snapshot.canvas, appId, route.name, device, scheme);
        const text = existing?.properties?.[core.EXACT_PROPS.shots] ?? fallback;
        let shots;
        try {
          shots = parseShots(text);
        } catch (err) {
          throw new Error(`${existing?.title ?? primary?.title ?? route.name}: ${err.message}`);
        }
        const normal = shotsText(shots);
        wants.push({ route, device, scheme, shots: normal, url: shots.url, key: sha256(captureKeyParts(index, route.name, device, scheme, normal)), existing });
      }
    }
  }
  const todo = wants.filter((w) => opts.force || !w.existing || w.existing.properties?.[core.EXACT_PROPS.key] !== w.key);
  const jobs = [];
  for (const w of todo) {
    let job = jobs.find((j) => j.wants[0].shots === w.shots);
    if (!job) {
      const s = parseShots(w.shots);
      job = { url: s.url, ops: s.ops, shots: [], wants: [] };
      jobs.push(job);
    }
    job.shots.push({ size: `${DEVICES[w.device].width}x${DEVICES[w.device].height}`, scheme: w.scheme });
    job.wants.push(w);
  }
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-exact-shots-"));
  try {
    let shots = { shots: [] };
    const started = Date.now();
    if (jobs.length > 0) {
      const jobsFile = path.join(dir, "jobs.json");
      await fs.writeFile(jobsFile, JSON.stringify(jobs.map(({ url, ops, shots: s }) => ({ url, ops, shots: s }))));
      shots = await bridge(host, "capture", ["--app", app, "--dir", dir, "--jobs", jobsFile], "the screenshots", true);
    }
    const captureMs = Date.now() - started;
    snapshot = await ctx.client.snapshot(canvasId);
    const group = id("exact-sync");
    const origin = mapOrigin(snapshot, core.indexItemOf(snapshot.canvas, appId));
    const indexItem = await upsert(
      host,
      ctx,
      canvasId,
      snapshot,
      core.indexItemOf(snapshot.canvas, appId),
      { bytes: Buffer.from(core.indexText(index), "utf8"), mime: core.EXACT_INDEX_MIME, filename: `${appId}.exact-index.json` },
      { title: `${index.app.name} \u2014 Exact index`, width: LAYOUT.sideWidth, height: 420, properties: { [core.EXACT_PROPS.app]: JSON.stringify({ id: appId }), [core.EXACT_PROPS.summary]: JSON.stringify(core.indexSummary(index)) }, at: origin },
      group
    );
    let sideY = origin.y + 420 + 40;
    let design = null;
    const md = designMarkdown(index);
    if (md) {
      design = await upsert(
        host,
        ctx,
        canvasId,
        snapshot,
        core.designItemOf(snapshot.canvas, appId),
        { bytes: Buffer.from(md, "utf8"), mime: "text/markdown", filename: "DESIGN.md" },
        { title: `${index.app.name} \u2014 design system (app.tamber)`, width: LAYOUT.sideWidth, height: 360, properties: designItemProperties(index), at: { x: origin.x, y: sideY } },
        group
      );
      sideY += 360 + 40;
    }
    const anatomy2 = [];
    for (const entry of index.anatomy) {
      const posted = await upsert(
        host,
        ctx,
        canvasId,
        snapshot,
        core.anatomyItemOf(snapshot.canvas, appId, entry.file),
        { bytes: Buffer.from(core.anatomyText(index, entry), "utf8"), mime: core.EXACT_ANATOMY_MIME, filename: `${entry.file}.anatomy.json` },
        { title: `${index.app.name} \xB7 ${entry.file}`, width: LAYOUT.sideWidth, height: 340, properties: { [core.EXACT_PROPS.app]: JSON.stringify({ id: appId }), [core.EXACT_PROPS.file]: entry.file }, at: { x: origin.x, y: sideY } },
        group
      );
      anatomy2.push({ file: entry.file, itemId: posted.itemId, status: posted.status });
      sideY += 340 + 40;
    }
    const layout = mapLayout(index.routes);
    const mapX = origin.x + LAYOUT.sideWidth + LAYOUT.sideGap;
    const screens = [];
    for (const w of wants) {
      const at = layout.get(w.route.name);
      const primary = w.device === "phone" && w.scheme === "light";
      const off = primary ? { x: 0, y: 0 } : rowOffset(w.device, w.scheme);
      const size = primary ? LAYOUT.primary : rowSize(w.device);
      const ownShots = primary || w.existing?.properties?.[core.EXACT_PROPS.shots] !== void 0;
      const props = core.screenProperties(index, w.route, w.url, { device: w.device, scheme: w.scheme, ...ownShots ? { shots: w.shots } : {}, key: w.key });
      const jobIndex = jobs.findIndex((j) => j.wants.includes(w));
      if (jobIndex < 0) {
        if (w.existing && !sameProps(w.existing, props)) await host.sendOp(ctx, canvasId, { type: "item.update", itemId: w.existing.id, patch: { properties: props } }, group);
        screens.push({ route: w.route.name, device: w.device, scheme: w.scheme, itemId: w.existing.id, status: "skipped", sha256: null, url: w.url });
        continue;
      }
      const shot = shots.shots.find((s) => s.job === jobIndex && s.index === jobs[jobIndex].wants.indexOf(w));
      const label = primary ? w.route.name : `${w.route.name} \xB7 ${w.device} ${w.scheme}`;
      const posted = await upsert(
        host,
        ctx,
        canvasId,
        snapshot,
        w.existing,
        { bytes: await fs.readFile(shot.file), mime: "image/png", filename: `${w.route.name}-${w.device}-${w.scheme}.png` },
        { title: `${index.app.name} \xB7 ${label}`, width: size.width, height: size.height, properties: props, at: { x: mapX + at.x + off.x, y: origin.y + at.y + off.y } },
        group
      );
      screens.push({ route: w.route.name, device: w.device, scheme: w.scheme, itemId: posted.itemId, status: posted.status, sha256: shot.sha256, url: w.url });
    }
    return { index, indexItem, design, anatomy: anatomy2, screens, captureMs };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
function syncJson(r) {
  return {
    index: { ...r.indexItem, routes: r.index.routes, routesJson: r.index.routesJson, edges: r.index.edges, unplaced: r.index.unplaced, exact: r.index.exact, plan: r.index.plan, inputs: r.index.inputs },
    design: r.design,
    anatomy: r.anatomy,
    screens: r.screens,
    captureMs: r.captureMs
  };
}
function tally(r) {
  const by = (s) => r.screens.filter((x) => x.status === s);
  const changed = by("new version");
  const routes = [...new Set(changed.map((s) => s.route))];
  return `${r.screens.length} screens: ${by("new").length} new, ${changed.length} new versions${routes.length ? ` (${routes.join(", ")})` : ""}, ${by("unchanged").length} recaptured and unchanged, ${by("skipped").length} skipped`;
}
function printSync(r) {
  console.log(`${r.indexItem.itemId}  ${r.index.app.name} \u2014 Exact index (${r.indexItem.status}), ${r.index.routes.length} routes from Contract, ${r.index.edges.length} arrows`);
  console.log(r.index.routesJson.equal ? "  routes.json agrees with Contract's routes" : `  routes.json disagrees: only in Contract ${JSON.stringify(r.index.routesJson.onlyContract)}, only in routes.json ${JSON.stringify(r.index.routesJson.onlyRoutesJson)}`);
  for (const e of r.index.edges) console.log(`  ${e.from} \u2192 ${e.to}  ${e.verb}${e.action ? ` (${e.action})` : ""}  ${e.file}:${e.line}`);
  for (const u of r.index.unplaced) console.log(`  not drawn: ${u.verb}${u.action ? ` (${u.action})` : ""} at ${u.file}:${u.line} \u2014 ${u.why}`);
  if (r.design) console.log(`${r.design.itemId}  design system from app.tamber (${r.design.status}), ${r.index.design?.tokens.length ?? 0} tokens`);
  for (const a of r.anatomy) console.log(`${a.itemId}  anatomy of ${a.file} (${a.status})`);
  for (const s of r.screens) console.log(`${s.itemId}  ${s.route.padEnd(14)} ${s.device.padEnd(8)} ${s.scheme.padEnd(6)} ${s.status.padEnd(12)} ${s.sha256?.slice(0, 12) ?? ""}`);
  console.log(tally(r));
}
function syncOptions(opts) {
  return {
    params: core.parseParams(opts.param ?? []),
    devices: listOf(opts.devices, DEVICE_NAMES, "devices"),
    schemes: listOf(opts.schemes, SCHEMES, "schemes"),
    force: opts.force === true
  };
}
async function open(host, given, opts, cmd) {
  const ctx = await host.ctxOf(cmd);
  const app = appDir(given);
  const canvas = await host.resolveCanvas(ctx);
  if (!ctx.json) console.error(`reading ${app} with its own Exact, on this machine, and capturing what moved\u2026`);
  const r = await sync(host, ctx, canvas.id, app, syncOptions(opts));
  if (ctx.json) return host.printJson(syncJson(r));
  printSync(r);
}
var IGNORED = /(^|\/)(target|\.exact|node_modules|\.git|dist[^/]*)(\/|$)|(^|\/)\.!|\.d\.ts$|\.DS_Store$|~$|\.swp$/;
async function live(host, given, opts, cmd) {
  const ctx = await host.ctxOf(cmd);
  const app = appDir(given);
  const canvas = await host.resolveCanvas(ctx);
  const options = syncOptions(opts);
  const max = opts.maxPasses === void 0 ? Number.POSITIVE_INFINITY : Number(opts.maxPasses);
  if (!(max >= 0)) throw new Error(`--max-passes takes a number, not ${opts.maxPasses}`);
  const quiet = opts.quietMs === void 0 ? 400 : Number(opts.quietMs);
  const say = (r, why) => {
    if (ctx.json) console.log(JSON.stringify({ why, ...syncJson(r) }));
    else console.log(`${(/* @__PURE__ */ new Date()).toISOString().slice(11, 19)}  ${why}: ${tally(r)}`);
  };
  if (!ctx.json) console.error(`live on ${app}, on this machine \u2014 a pass now, then one per save (ctrl-c stops)`);
  say(await sync(host, ctx, canvas.id, app, options), "opened");
  let passes = 0;
  if (passes >= max) return;
  const changed = /* @__PURE__ */ new Set();
  let timer = null;
  let running = false;
  await new Promise((resolve) => {
    const watcher = watch(app, { recursive: true }, (_event, name) => {
      const rel = typeof name === "string" ? name : "";
      if (!rel || IGNORED.test(rel)) return;
      changed.add(rel);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void pass(), quiet);
    });
    const stop = () => {
      watcher.close();
      resolve();
    };
    process.once("SIGINT", stop);
    const pass = async () => {
      if (running) {
        timer = setTimeout(() => void pass(), quiet);
        return;
      }
      running = true;
      const files = [...changed].sort();
      changed.clear();
      try {
        say(await sync(host, ctx, canvas.id, app, { ...options, force: false }), `saved ${files.join(", ")}`);
        passes++;
        if (passes >= max) stop();
      } catch (err) {
        console.error(`exact live: ${err.message}`);
      } finally {
        running = false;
      }
    };
  });
}
export {
  PROVEN,
  bindCore,
  doctor,
  live,
  open
};
