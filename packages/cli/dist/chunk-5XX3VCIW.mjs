import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  DEVICES,
  LAYOUT,
  anatomy,
  flowEdges,
  indexDesign,
  rowSize
} from "./chunk-ERSF5LUL.mjs";
import {
  core
} from "./chunk-QSPCCLE6.mjs";
import {
  designSystemProperties
} from "./chunk-FXLBUDHK.mjs";
import {
  serializeDesign
} from "./chunk-K4TDP4L5.mjs";

// packages/modules/exact/src/build.ts
var own = (def) => def.file.endsWith(".contract") && !def.file.includes(":");
function buildIndex(readings) {
  const { router, routes } = core.contractRoutes(readings.symbols, readings.sources);
  const defs = readings.symbols.definitions.filter(own);
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
    sources: [...new Set(readings.symbols.definitions.filter((d) => d.kind === "source" && own(d)).map((d) => d.name))].sort(),
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
    name: `${index.app.name} (app.forma)`,
    description: `The design of the Exact app ${index.app.id}, read from its app.forma by \`forma ir\` (digest ${design.digest}). Edit app.forma, not this file: the next capture rewrites it.`,
    ...Object.keys(colors).length ? { colors } : {},
    ...Object.keys(spacing).length ? { spacing } : {},
    isocan: { exact: { app: index.app.id, digest: design.digest, tokens: design.tokens.map((t) => ({ name: t.name, kind: t.kind, values: t.values })) } }
  };
  const where = (t) => t.uses.length === 0 ? "not used" : t.uses.map((u) => `${u.file}:${u.line}${u.component ? ` (${u.component})` : ""}`).join(", ");
  const rows = design.tokens.map((t) => `| \`${t.name}\` | ${t.kind} | ${t.light ?? t.values.join(" ")} | ${t.dark ?? ""} | ${where(t)} |`);
  const body = [
    "## Overview",
    "",
    `The tokens of ${index.app.name}'s \`app.forma\`, as the app's own compiler folds them, with where each is used.`,
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
