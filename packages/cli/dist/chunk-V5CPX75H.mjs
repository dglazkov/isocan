import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  designSystemProperties
} from "./chunk-VMZRQO4Z.mjs";
import {
  serializeDesign
} from "./chunk-K4TDP4L5.mjs";

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
  const open = [];
  const spans = [];
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' && text[i - 1] !== "\\") inString = !inString;
    if (inString) continue;
    if (c === "(") open.push(i);
    else if (c === ")" && open.length > 0) spans.push({ start: open.pop() + 1, end: i });
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
      const path = at[1];
      if (!path.startsWith("/") || path.startsWith("//") || path.includes("..") || /[\s\\]/.test(path)) throw new Error(`exact.shots line ${i + 1}: \`at\` takes one of the app's own paths, like "/place/2", not ${JSON.stringify(path)}`);
      url = path;
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
function mapLayout(routes, extra = 0) {
  const cellWidth = LAYOUT.primary.width + LAYOUT.gap + ["phone", "tablet", "desktop"].reduce((w, d) => w + rowSize(d).width + LAYOUT.rowGap, 0) + extra;
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
function captureKeyParts(index, route, device, scheme, shots, host = "web", sim = null) {
  return JSON.stringify([index.inputs, route, device, scheme, host, core.CAPTURE_AT, DEVICES[device], shots, "points", ...host === "web" ? [] : [sim, "ax"]]);
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

// packages/modules/exact/src/hosts.ts
var HOSTS = ["web", "ios", "macos"];
var NATIVE_DEVICE = { ios: "phone", macos: "desktop" };
var HOST_NAMES = { web: "web", ios: "iOS", macos: "macOS" };
function parseHosts(given) {
  const picked = (given ?? "web").split(",").map((s) => s.trim()).filter(Boolean);
  for (const p of picked) if (!HOSTS.includes(p)) throw new Error(`--hosts takes ${HOSTS.join(", ")}, not ${p}`);
  return [...new Set(picked)];
}
var UDID = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;
function jobSize(device) {
  return `${DEVICES[device].width}x${DEVICES[device].height}`;
}
function nativeOffset(host, scheme) {
  let x = LAYOUT.primary.width + LAYOUT.gap;
  for (const d of ["phone", "tablet", "desktop"]) x += rowSize(d).width + LAYOUT.rowGap;
  x += LAYOUT.gap;
  if (host === "macos") x += nativeSize("ios", null).width + LAYOUT.rowGap;
  return { x, y: scheme === "light" ? 0 : LAYOUT.rowHeight + LAYOUT.rowGap };
}
function nativeSize(host, png) {
  const shape = png ?? (host === "ios" ? { width: 402, height: 874 } : DEVICES.desktop);
  return { width: Math.round(shape.width / shape.height * LAYOUT.rowHeight), height: LAYOUT.rowHeight };
}
function nativeCellWidth(hosts) {
  let w = 0;
  if (hosts.includes("ios")) w += nativeSize("ios", null).width + LAYOUT.rowGap;
  if (hosts.includes("macos")) w += nativeSize("macos", null).width + LAYOUT.rowGap;
  return w ? w + LAYOUT.gap : 0;
}
function inversions(web, native, chrome = /* @__PURE__ */ new Set()) {
  const pick = (p) => {
    const out2 = /* @__PURE__ */ new Map();
    for (const n of p.nodes) if (n.testId && !chrome.has(n.testId) && n.w > 0 && n.h > 0 && !out2.has(n.testId)) out2.set(n.testId, n);
    return out2;
  };
  const a = pick(web);
  const b = pick(native);
  const both = [...a.keys()].filter((k) => b.has(k)).sort();
  const strictlyAbove = (x, y) => x.y + x.h <= y.y;
  const out = [];
  for (const i of both) {
    for (const j of both) {
      if (i === j) continue;
      if (strictlyAbove(b.get(i), b.get(j)) && strictlyAbove(a.get(j), a.get(i))) out.push({ above: b.get(i), below: b.get(j) });
    }
  }
  const seen = /* @__PURE__ */ new Set();
  return out.filter((v) => seen.has(v.above.testId) ? false : (seen.add(v.above.testId), true));
}
function presentationTestIds(sources, points) {
  const lines = /* @__PURE__ */ new Map();
  for (const [file, text] of Object.entries(sources)) {
    const rows = text.split("\n");
    const indent = (l) => l.length - l.trimStart().length;
    for (let i = 0; i < rows.length; i++) {
      if (!/\brole="tablist"/.test(rows[i])) continue;
      const set = lines.get(file) ?? /* @__PURE__ */ new Set();
      set.add(i + 1);
      for (let j = i + 1; j < rows.length && (rows[j].trim() === "" || indent(rows[j]) > indent(rows[i])); j++) set.add(j + 1);
      lines.set(file, set);
    }
  }
  const out = /* @__PURE__ */ new Set();
  for (const p of points) for (const n of p.nodes) if (n.testId && lines.get(n.file)?.has(n.line)) out.add(n.testId);
  return out;
}
function compareFindings(report, natives, sources = {}) {
  const chrome = presentationTestIds(sources, [...natives.flatMap((n) => n.points ? [n.points] : []), ...report.compares.flatMap((c) => c.web ? [c.web] : [])]);
  const out = [];
  for (const c of report.compares) {
    const native = natives.find((n) => n.route === c.route && n.host === c.host)?.points;
    if (!native || !c.web || !c.compare) continue;
    const found = inversions(c.web, native, chrome);
    if (found.length === 0) continue;
    const name = HOST_NAMES[c.host];
    const lines = c.text.split("\n").filter((l) => /^\s+\d+ \[/.test(l));
    const touches = (n) => lines.filter((l) => new RegExp(`\\bunder ${n.testId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(l));
    for (const v of found) {
      const key = `compare:${c.route}:${c.host}:${v.above.testId}`;
      const digest = native.files[v.above.file];
      const said = [.../* @__PURE__ */ new Set([...touches(v.above), ...touches(v.below)])].slice(0, 4).map((l) => l.trim());
      const body = [
        `${name} and the web lay out ${c.route} differently, beyond each platform's own bars: \`${v.above.testId}\` is above \`${v.below.testId}\` on ${name}, and below it on the web.`,
        `\`screenshot compare\` (the web at ${name}'s ${c.size.replace("x", "\xD7")}, against the ${name} capture): ${(c.compare.match * 100).toFixed(1)}% matches, ${c.compare.regions.length + c.compare.more} regions differ${said.length ? `; under these nodes:` : ", none of them named under these nodes."}`,
        ...said.map((l) => `  ${l}`),
        `Posted by \`isocan exact\`; it goes when the two hosts agree again.`,
        ...digest ? [core.sourceLine({ file: v.above.file, line: v.above.line, col: v.above.col, sha256: digest })] : [],
        `exact.diagnostic = ${key}`
      ];
      out.push({ key, routes: [c.route], scheme: "light", box: [v.above.x, v.above.y, v.above.w, v.above.h], body: body.join("\n"), anchor: { host: c.host, device: NATIVE_DEVICE[c.host], width: native.size?.width ?? 402 } });
    }
  }
  return out;
}
var HOST_ORDER = { web: 0, ios: 1, macos: 2 };
var DEVICE_ORDER = { phone: 0, tablet: 1, desktop: 2 };
function wallCells(canvas, appId, route, scheme = "light") {
  const P = core.EXACT_PROPS;
  const out = [];
  for (const item of Object.values(canvas.items)) {
    if (core.appIdOf(item) !== appId || item.properties?.[P.route] !== route || (item.properties?.[P.scheme] ?? "light") !== scheme) continue;
    const v = item.versions.find((x) => x.id === item.currentVersionId) ?? item.versions.at(-1);
    if (!v || v.mimeType !== "image/png") continue;
    const host = item.properties?.[P.host] ?? "web";
    const device = item.properties?.[P.device] ?? "phone";
    const points = core.parsePoints(item.properties?.[P.points]);
    const size = points?.size ?? DEVICES[device] ?? DEVICES.phone;
    out.push({
      itemId: item.id,
      host,
      device,
      scheme,
      title: item.title,
      blobHash: v.blobHash,
      width: size.width,
      height: size.height,
      url: item.properties?.[P.url] ?? "/",
      ...(item.properties?.[P.reached] ?? item.properties?.[P.shots]) !== void 0 ? { shots: item.properties[P.reached] ?? item.properties[P.shots] } : {},
      ...item.properties?.[P.points] !== void 0 ? { points: item.properties[P.points] } : {}
    });
  }
  return out.sort((a, b) => (HOST_ORDER[a.host] ?? 9) - (HOST_ORDER[b.host] ?? 9) || (DEVICE_ORDER[a.device] ?? 9) - (DEVICE_ORDER[b.device] ?? 9));
}
function wallText(wall) {
  return `${JSON.stringify(wall, null, 2)}
`;
}
function wallsOf(canvas, appId) {
  const out = [];
  for (const item of Object.values(canvas.items)) {
    if (core.appIdOf(item) !== appId) continue;
    const v = item.versions.find((x) => x.id === item.currentVersionId) ?? item.versions.at(-1);
    if (v?.mimeType !== core.EXACT_WALL_MIME) continue;
    const route = item.properties?.[core.EXACT_PROPS.route];
    if (route) out.push({ item, route, scheme: item.properties?.[core.EXACT_PROPS.scheme] === "dark" ? "dark" : "light" });
  }
  return out;
}
function wallSize(cells, height = 420) {
  const gap = 16;
  const width = cells.reduce((w, c) => w + Math.round(c.width / c.height * (height - 48)) + gap, gap);
  return { width: Math.max(320, width), height };
}

export {
  core,
  bindCore,
  screensAt,
  DEVICES,
  SCHEMES,
  parseShots,
  shotsText,
  LAYOUT,
  rowSize,
  mapLayout,
  rowOffset,
  buildIndex,
  captureKeyParts,
  designMarkdown,
  designItemProperties,
  NATIVE_DEVICE,
  HOST_NAMES,
  parseHosts,
  UDID,
  jobSize,
  nativeOffset,
  nativeSize,
  nativeCellWidth,
  compareFindings,
  wallCells,
  wallText,
  wallsOf,
  wallSize
};
