import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  grantedWrite,
  opsFromFlags,
  parseAcceptAnswer,
  parseProposalRecord,
  parseProposeAnswer,
  parseProposeAsk,
  proposalTitle,
  scopeFor
} from "./chunk-D2TJMLLO.mjs";
import {
  DEVICES,
  HOST_NAMES,
  LAYOUT,
  NATIVE_DEVICE,
  SCHEMES,
  UDID,
  buildIndex,
  captureKeyParts,
  compareFindings,
  designItemProperties,
  designMarkdown,
  jobSize,
  mapLayout,
  nativeCellWidth,
  nativeOffset,
  nativeSize,
  parseHosts,
  parseShots,
  rowOffset,
  rowSize,
  screensAt,
  shotsText,
  wallCells,
  wallSize,
  wallText,
  wallsOf
} from "./chunk-Y5UR3HVE.mjs";
import {
  bindCore,
  core
} from "./chunk-QSPCCLE6.mjs";
import "./chunk-VMZRQO4Z.mjs";
import "./chunk-GUY4UN4O.mjs";
import "./chunk-K4TDP4L5.mjs";
import "./chunk-JYOOXWJZ.mjs";

// packages/modules/exact/src/cli-run.ts
import { createHash as createHash2 } from "node:crypto";
import { promises as fs3, watch } from "node:fs";
import os3 from "node:os";
import path3 from "node:path";

// packages/modules/exact/src/findings.ts
var own = (d) => d.file.endsWith(".contract") && !d.file.includes(":");
var short = (text) => {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = Math.imul(h, 31) + text.charCodeAt(i) >>> 0;
  return h.toString(36);
};
function routesDrawing(symbols, sources, routes, file, line, col = 1) {
  const names = new Set(routes.map((r) => r.name));
  const all = routes.map((r) => r.name);
  if (!symbols) return all;
  const defs = symbols.definitions.filter(own);
  const refs = (symbols.references ?? []).filter(own);
  const components = defs.filter((d) => d.kind === "component").sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  const around = (f, l) => components.filter((c) => c.file === f && c.line <= l).at(-1) ?? null;
  const seen = /* @__PURE__ */ new Set();
  const ask = (f, l, c, depth) => {
    const comp = around(f, l);
    const lines = (sources[f] ?? "").split("\n");
    const here = screensAt(lines, l, c, names);
    if (here) return here;
    if (!comp || depth > 4 || seen.has(comp.name)) return null;
    const calls = refs.filter((r) => r.kind === "component" && r.name === comp.name);
    if (calls.length === 0) return null;
    seen.add(comp.name);
    let union = /* @__PURE__ */ new Set();
    for (const call of calls) {
      const at = ask(call.file, call.line, call.col, depth + 1);
      if (at === null) {
        union = null;
        break;
      }
      for (const r of at) union.add(r);
    }
    return union;
  };
  const found = ask(file, line, col, 0);
  const list = found ? all.filter((r) => found.has(r)) : all;
  return list.length > 0 ? list : all;
}
function testIdPlace(symbols, testId) {
  const def = symbols?.definitions.find((d) => d.kind === "testId" && d.name === testId && own(d));
  return def ? { file: def.file, line: def.line, col: def.col } : null;
}
function buildFindings(report, routes) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const d of report.diagnostics) {
    if (d.severity && d.severity !== "error") continue;
    const key = `build:${d.id}:${d.file}:${short(d.message)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const drawn = routesDrawing(report.symbols, report.sources, routes, d.file, d.line, d.col);
    const digest = report.digests[d.file];
    const lines = [
      `Compile error at ${d.file}:${d.line}:${d.col} \u2014 ${d.message} (\`${d.id}\`)`,
      `Drawn on: ${drawn.join(", ")}. Posted by \`isocan exact live\`; it goes when the build no longer says it.`,
      ...digest ? [core.sourceLine({ file: d.file, line: d.line, col: d.col, sha256: digest })] : [],
      `exact.diagnostic = ${key}`
    ];
    out.push({ key, routes: drawn, scheme: "light", box: null, body: lines.join("\n") });
  }
  return out;
}
function checkFindings(report, diag, routes) {
  const out = [];
  for (const one of report.checks) {
    const route = routes.find((r) => r.url === one.url)?.route;
    if (!route) continue;
    for (const pass of one.check) {
      const scheme = pass.scheme === "dark" ? "dark" : "light";
      for (const f of pass.findings) {
        const node = f.node ?? (f.text ? short(f.text) : "page");
        const key = `check:${route}:${scheme}:${f.kind}:${node}`;
        const place = f.node ? testIdPlace(diag?.symbols ?? null, f.node) : null;
        const digest = place ? diag?.digests[place.file] : void 0;
        const lines = [
          `\`agent check\` on ${route}, phone ${scheme}: ${(f.line ?? `${f.kind} ${f.text ?? ""}`).trim()}`,
          `Posted by \`isocan exact live\`; it goes when the check no longer finds it.`,
          ...place && digest ? [core.sourceLine({ ...place, sha256: digest })] : [],
          `exact.diagnostic = ${key}`
        ];
        out.push({ key, routes: [route], scheme, box: Array.isArray(f.box) && f.box.length === 4 ? f.box : null, body: lines.join("\n") });
      }
    }
  }
  return out;
}
function postedFindings(canvas, appId) {
  const out = /* @__PURE__ */ new Map();
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
function planFindings(canvas, index, findings, scope) {
  const posted = postedFindings(canvas, index.app.id);
  const plan = { create: [], update: [], remove: [] };
  for (const f of findings) {
    const thread = posted.get(f.key);
    if (thread) {
      if (thread.comments[0].body !== f.body) plan.update.push({ thread, body: f.body });
      continue;
    }
    const item = f.anchor ? f.routes.map((r) => core.screenItemOf(canvas, index.app.id, r, f.anchor.device, f.scheme, f.anchor.host)).find(Boolean) : f.routes.map((r) => core.screenItemOf(canvas, index.app.id, r, "phone", f.scheme)).find(Boolean) ?? f.routes.map((r) => core.screenItemOf(canvas, index.app.id, r)).find(Boolean);
    if (!item) continue;
    const scale = item.width / (f.anchor?.width ?? 390);
    const x = f.box ? Math.round(Math.min(item.width - 8, (f.box[0] + f.box[2]) * scale)) : Math.round(item.width - 12);
    const y = f.box ? Math.round(Math.min(item.height - 8, f.box[1] * scale)) : 12;
    plan.create.push({ finding: f, item, x, y });
  }
  const live2 = new Set(findings.map((f) => f.key));
  for (const [key, thread] of posted) if (scope(key) && !live2.has(key)) plan.remove.push({ thread, key });
  return plan;
}
function movedComments(canvas, appId, digests) {
  const out = [];
  for (const thread of Object.values(canvas.threads ?? {})) {
    if (!thread.anchorItemId) continue;
    const item = canvas.items[thread.anchorItemId];
    if (!item || core.appIdOf(item) !== appId) continue;
    if (core.diagnosticKey(thread.comments[0]?.body ?? "")) continue;
    const latest = thread.comments.map((c, i) => ({ i, source: core.parseSource(c.body) })).filter((x) => x.source).at(-1);
    if (!latest?.source) continue;
    const now = digests[latest.source.file];
    if (!now || now === latest.source.sha256) continue;
    if (thread.comments.slice(latest.i + 1).some((c) => core.movedDigest(c.body))) continue;
    out.push({ thread, source: latest.source, now });
  }
  return out;
}
function movedBody(source, now) {
  return [
    `Moved: ${source.file} has changed since this comment pointed at ${core.sourcePlace(source)} \u2014 that line may be another line now. Read the file, find the place by what the comment says, and do not trust the number alone.`,
    `exact.moved = ${now}`
  ].join("\n");
}

// packages/modules/exact/src/film.ts
function parseFilm(text) {
  if (!text) return null;
  try {
    const v = JSON.parse(text);
    if (!Number.isFinite(v?.every) || !Number.isInteger(v?.steps) || (v.steps ?? 0) < 1 || (v.every ?? 0) <= 0) return null;
    const from = Number.isFinite(v.from) ? v.from : 0;
    const at = Array.isArray(v.at) && v.at.length === v.steps && v.at.every((n) => Number.isFinite(n)) ? v.at : Array.from({ length: v.steps }, (_, i) => from + i * v.every);
    return {
      from,
      every: v.every,
      steps: v.steps,
      over: Number.isFinite(v.over) ? v.over : (v.steps - 1) * v.every,
      at,
      key: typeof v.key === "string" ? v.key : "",
      route: typeof v.route === "string" ? v.route : "",
      host: typeof v.host === "string" ? v.host : "web",
      device: typeof v.device === "string" ? v.device : "phone",
      scheme: v.scheme === "dark" ? "dark" : "light",
      shots: typeof v.shots === "string" ? v.shots : "",
      ops: Array.isArray(v.ops) ? v.ops.filter((o) => typeof o === "string") : [],
      watch: typeof v.watch === "string" ? v.watch : null,
      screen: typeof v.screen === "string" ? v.screen : null
    };
  } catch {
    return null;
  }
}
function filmKeyText(parts) {
  return ["film", parts.app, parts.route, parts.host, parts.device, parts.scheme, parts.shots, parts.ops.join("\n"), parts.over, parts.every, parts.watch ?? ""].join("\0");
}
function filmTitle(film2) {
  return `${film2.route} \u2014 film of ${film2.ops.join(", ") || "the screen"} (${film2.over} ms every ${film2.every}${film2.host === "web" ? "" : `, ${film2.host}`})`;
}
var same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function changes(prev, next) {
  if (!next) return void 0;
  const out = {};
  for (const [k, v] of Object.entries(next)) if (!prev || !same(prev[k], v)) out[k] = v;
  return Object.keys(out).length ? out : void 0;
}
function packFrames(frames) {
  if (frames.length === 0) return null;
  const [first, ...rest] = frames;
  const steps = [];
  let prev = first;
  for (const f of rest) {
    const slots = changes(prev.slots, f.slots);
    const derives = changes(prev.derives, f.derives);
    steps.push({ at: f.at, ...slots ? { slots } : {}, ...derives ? { derives } : {}, ...f.watch !== void 0 ? { watch: f.watch } : {} });
    prev = f;
  }
  return { first, steps };
}
function parseInspectRequest(text) {
  if (!text) return null;
  try {
    const v = JSON.parse(text);
    if (!Number.isFinite(v?.seq) || typeof v.host !== "string" || typeof v.shots !== "string") return null;
    return { seq: v.seq, by: typeof v.by === "string" ? v.by : null, host: v.host, size: typeof v.size === "string" ? v.size : "390x844", scheme: v.scheme === "dark" ? "dark" : "light", shots: v.shots };
  } catch {
    return null;
  }
}
function parseInspectAnswer(text) {
  if (!text) return null;
  try {
    const v = JSON.parse(text);
    return Number.isFinite(v?.seq) ? v : null;
  } catch {
    return null;
  }
}
function parseFilmAsk(text) {
  if (!text) return null;
  try {
    const v = JSON.parse(text);
    if (!Number.isFinite(v?.seq) || typeof v.host !== "string" || typeof v.shots !== "string" || !Array.isArray(v.ops) || v.ops.some((o) => typeof o !== "string")) return null;
    const over = Number(v.over), every = Number(v.every);
    if (!Number.isInteger(over) || !Number.isInteger(every) || over < 0 || every < 1) return null;
    return { seq: v.seq, by: typeof v.by === "string" ? v.by : null, host: v.host, size: typeof v.size === "string" ? v.size : "390x844", scheme: v.scheme === "dark" ? "dark" : "light", shots: v.shots, ops: v.ops, over, every, watch: typeof v.watch === "string" && v.watch ? v.watch : null };
  } catch {
    return null;
  }
}
function parseFilmAnswer(text) {
  if (!text) return null;
  try {
    const v = JSON.parse(text);
    return Number.isFinite(v?.seq) ? v : null;
  } catch {
    return null;
  }
}
function landFilm(items, keys, app, screen, where, job, report, key) {
  const appProp2 = JSON.stringify({ id: app.id });
  const ours = items.filter((i) => i.properties?.[keys.app] === appProp2);
  const films = ours.filter((i) => parseFilm(i.properties?.[keys.film]));
  const facts = { from: report.at?.[0] ?? 0, every: job.every, steps: report.at?.length ?? report.steps, over: job.over, at: report.at ?? [], key, route: where.route, host: job.host, device: where.device, scheme: job.scheme, shots: job.shots, ops: job.ops, watch: job.watch, screen: screen.id };
  const existing = films.find((i) => parseFilm(i.properties?.[keys.film])?.key === key) ?? null;
  const right = Math.max(...ours.filter((i) => !parseFilm(i.properties?.[keys.film])).map((i) => i.x + i.width), screen.x + screen.width) + 160 + films.length * 480;
  const width = 420;
  const height = Math.round(width * (report.png?.height ?? 844) / (report.png?.width ?? 390)) + 360;
  const frames = packFrames(report.states);
  return {
    facts,
    existing,
    title: filmTitle(facts),
    at: { x: Math.round(right), y: Math.round(screen.y) },
    width,
    height,
    properties: { [keys.app]: appProp2, [keys.film]: JSON.stringify(facts), ...frames ? { [keys.frames]: JSON.stringify(frames) } : {} }
  };
}

// packages/modules/exact/src/drives.ts
function parseDriveRequest(text) {
  if (!text) return null;
  try {
    const v = JSON.parse(text);
    if (!Number.isFinite(v?.seq) || typeof v.host !== "string" || typeof v.shots !== "string" || !Array.isArray(v.ops) || v.ops.some((o) => typeof o !== "string")) return null;
    return { seq: v.seq, by: typeof v.by === "string" ? v.by : null, host: v.host, size: typeof v.size === "string" ? v.size : "390x844", scheme: v.scheme === "dark" ? "dark" : "light", shots: v.shots, ops: v.ops };
  } catch {
    return null;
  }
}
function parseDriveAnswer(text) {
  if (!text) return null;
  try {
    const v = JSON.parse(text);
    return Number.isFinite(v?.seq) ? v : null;
  } catch {
    return null;
  }
}
function pendingDrives(entries, canvas, appId) {
  const touched = /* @__PURE__ */ new Set();
  for (const e of entries) {
    const op = e.envelope.op;
    if (op.type === "item.update" && op.itemId && op.patch?.properties && core.EXACT_PROPS.drive in op.patch.properties) touched.add(op.itemId);
  }
  const out = [];
  for (const id4 of touched) {
    const item = canvas.items[id4];
    if (!item || core.appIdOf(item) !== appId) continue;
    const request = parseDriveRequest(item.properties?.[core.EXACT_PROPS.drive]);
    const answered = parseDriveAnswer(item.properties?.[core.EXACT_PROPS.driven]);
    if (request && (!answered || answered.seq < request.seq)) out.push({ item, request });
  }
  return out;
}
function pendingInspects(entries, canvas, appId) {
  const touched = /* @__PURE__ */ new Set();
  for (const e of entries) {
    const op = e.envelope.op;
    if (op.type === "item.update" && op.itemId && op.patch?.properties && core.EXACT_PROPS.inspect in op.patch.properties) touched.add(op.itemId);
  }
  const out = [];
  for (const id4 of touched) {
    const item = canvas.items[id4];
    if (!item || core.appIdOf(item) !== appId) continue;
    const request = parseInspectRequest(item.properties?.[core.EXACT_PROPS.inspect]);
    const answered = parseInspectAnswer(item.properties?.[core.EXACT_PROPS.inspected]);
    if (request && (!answered || answered.seq < request.seq)) out.push({ item, request });
  }
  return out;
}
function pendingFilms(entries, canvas, appId) {
  const touched = /* @__PURE__ */ new Set();
  for (const e of entries) {
    const op = e.envelope.op;
    if (op.type === "item.update" && op.itemId && op.patch?.properties && core.EXACT_PROPS.filmAsk in op.patch.properties) touched.add(op.itemId);
  }
  const out = [];
  for (const id4 of touched) {
    const item = canvas.items[id4];
    if (!item || core.appIdOf(item) !== appId) continue;
    const request = parseFilmAsk(item.properties?.[core.EXACT_PROPS.filmAsk]);
    const answered = parseFilmAnswer(item.properties?.[core.EXACT_PROPS.filmed]);
    if (request && (!answered || answered.seq < request.seq)) out.push({ item, request });
  }
  return out;
}

// packages/modules/exact/src/stories.ts
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

// packages/modules/exact/src/story.ts
function storyOf(app, file, fileText, test) {
  const lines = fileText.split("\n");
  const steps = test.steps.map((s) => ({ line: s.line, text: (lines[s.line - 1] ?? "").trim(), op: s.op }));
  const first = steps[0]?.line ?? 1;
  let line = first;
  for (let i = first - 1; i >= 1; i--) if (/^\s*test\s+"/.test(lines[i - 1] ?? "")) {
    line = i;
    break;
  }
  return { format: 1, app, file, test: { name: test.name, line, steps }, runs: {}, frames: {} };
}
function sameSteps(a, b) {
  return a.test.name === b.test.name && JSON.stringify(a.test.steps.map((s) => [s.text, s.op])) === JSON.stringify(b.test.steps.map((s) => [s.text, s.op]));
}
function storyText(story) {
  return `${JSON.stringify(story, null, 1)}
`;
}
function parseStory(text) {
  const v = JSON.parse(text);
  if (v?.format !== 1 || !v.test || !Array.isArray(v.test.steps)) throw new Error("not an Exact storyboard this build reads");
  return { ...v, runs: v.runs ?? {}, frames: v.frames ?? {} };
}
function storySize(steps) {
  return { width: Math.min(2600, 240 + Math.max(4, steps) * 132), height: 880 };
}
function withRun(story, report, bytesOf, at) {
  const frames = {};
  const keep = (f) => {
    if (!f) return null;
    if (!frames[f.sha256]) {
      const known = story.frames[f.sha256];
      const b64 = known ? null : bytesOf(f);
      if (!known && !b64) return null;
      frames[f.sha256] = known ?? `data:image/png;base64,${b64}`;
    }
    return f.sha256;
  };
  const run = {
    host: report.host,
    at,
    verdict: report.verdict,
    said: report.said,
    steps: report.steps.map((s) => ({ line: s.line, state: s.state, frame: keep(s.frame) })),
    failed: report.failed ? { line: report.failed.line, reason: report.failed.reason, frame: keep(report.failed.frame), tree: report.failed.tree, reply: report.failed.reply } : null,
    end: keep(report.end),
    ms: report.ms,
    ...report.error ? { error: report.error } : {}
  };
  const runs = { ...story.runs, [report.host]: run };
  for (const r of Object.values(runs)) {
    if (r === run) continue;
    for (const k of [...r.steps.map((s) => s.frame), r.failed?.frame ?? null, r.end]) if (k && story.frames[k]) frames[k] = story.frames[k];
  }
  return { ...story, runs, frames };
}
function rebased(old, next) {
  if (!old || !sameSteps(old, next)) return next;
  const runs = {};
  for (const [host, r] of Object.entries(old.runs)) {
    const at = (line) => {
      const i = old.test.steps.findIndex((s) => s.line === line);
      return i >= 0 ? next.test.steps[i].line : line;
    };
    runs[host] = { ...r, steps: r.steps.map((s) => ({ ...s, line: at(s.line) })), failed: r.failed ? { ...r.failed, line: at(r.failed.line) } : null };
  }
  return { ...next, runs, frames: old.frames };
}
function parseRunAsk(text) {
  if (!text) return null;
  try {
    const v = JSON.parse(text);
    if (!Number.isFinite(v?.seq) || !Array.isArray(v.hosts) || v.hosts.length === 0 || v.hosts.some((h) => typeof h !== "string")) return null;
    return { seq: v.seq, by: typeof v.by === "string" ? v.by : null, hosts: [...new Set(v.hosts)] };
  } catch {
    return null;
  }
}
function parseRunAnswer(text) {
  if (!text) return null;
  try {
    const v = JSON.parse(text);
    return Number.isFinite(v?.seq) ? v : null;
  } catch {
    return null;
  }
}
var parseVerifyAsk = (text) => parseRunAsk(text);
function parseVerifyAnswer(text) {
  if (!text) return null;
  try {
    const v = JSON.parse(text);
    return Number.isFinite(v?.seq) ? v : null;
  } catch {
    return null;
  }
}
var DRIVE_OP = /^(?:tap [A-Za-z0-9_.:-]{1,80}|type [A-Za-z0-9_.:-]{1,80} "(?:[^"\\\n\r]|\\.){0,400}"|back)$/;
var TEST_FILE = /^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,80}\.test\.contract$/;
function parseRecordAsk(text) {
  if (!text) return null;
  try {
    const v = JSON.parse(text);
    const ops = (x) => Array.isArray(x) && x.length <= 40 && x.every((o) => typeof o === "string" && DRIVE_OP.test(o));
    if (!Number.isFinite(v?.seq) || typeof v.host !== "string" || typeof v.shots !== "string" || !ops(v.before ?? []) || !ops(v.ops) || v.ops.length === 0) return null;
    if (typeof v.file !== "string" || !TEST_FILE.test(v.file) || typeof v.name !== "string" || !testName(v.name)) return null;
    return { seq: v.seq, by: typeof v.by === "string" ? v.by : null, host: v.host, size: typeof v.size === "string" ? v.size : "390x844", scheme: v.scheme === "dark" ? "dark" : "light", shots: v.shots, before: v.before ?? [], ops: v.ops, file: v.file, name: v.name.trim() };
  } catch {
    return null;
  }
}
function parseRecordAnswer(text) {
  if (!text) return null;
  try {
    const v = JSON.parse(text);
    return Number.isFinite(v?.seq) ? v : null;
  } catch {
    return null;
  }
}
function testName(name) {
  return /^[^"\\\n\r]{1,80}$/.test(name.trim()) && name.trim().length > 0;
}
function parseRecording(text) {
  if (!text) return null;
  try {
    const v = JSON.parse(text);
    return typeof v?.file === "string" && TEST_FILE.test(v.file) && /^[0-9a-f]{64}$/.test(v.base ?? "") && typeof v.test === "string" ? v : null;
  } catch {
    return null;
  }
}
function testStep(op) {
  const tap = /^tap ([A-Za-z0-9_.:-]+)$/.exec(op);
  if (tap) return `tap "${tap[1]}"`;
  const type = /^type ([A-Za-z0-9_.:-]+) ("(?:[^"\\\n\r]|\\.)*")$/.exec(op);
  if (type) return `type "${type[1]}" ${type[2]}`;
  if (op === "back") return "back";
  const clock = /^clock (settle|data|\+\d{1,6})$/.exec(op);
  if (clock) return `clock ${clock[1]}`;
  throw new Error(`a recording holds tap, type, back and clock steps, not ${JSON.stringify(op)}`);
}
function shotsSteps(shots) {
  const out = [];
  for (const raw of shots.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("//")) continue;
    const at = /^at\s+"([^"]*)"$/.exec(line);
    if (at) {
      if (at[1] !== "/") out.push(`at "${at[1]}"`);
      continue;
    }
    out.push(testStep(line));
  }
  return out;
}
function literal(v) {
  if (v === null) return "none";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "boolean") return String(v);
  if (typeof v === "string") return v.length <= 80 && !/[\n\r"\\]/.test(v) ? JSON.stringify(v) : null;
  if (Array.isArray(v) && v.length === 0) return "[]";
  return null;
}
function linesFor(path4, was, value, depth) {
  const lit = literal(value);
  if (lit !== null) return [`expect state ${path4} == ${lit}`];
  if (Array.isArray(value)) {
    if (value.length > 3 || value.some((x) => literal(x) === null || Array.isArray(x))) return [];
    return value.map((x, i) => `expect state ${path4}.${i} == ${literal(x)}`);
  }
  if (depth > 0 || !value || typeof value !== "object") return [];
  const before = was && typeof was === "object" && !Array.isArray(was) ? was : {};
  const out = [];
  for (const [field, v] of Object.entries(value)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(field) || JSON.stringify(before[field]) === JSON.stringify(v)) continue;
    if (literal(v) !== null) out.push(`expect state ${path4}.${field} == ${literal(v)}`);
  }
  return out;
}
function proposeExpects(before, after, max = 6) {
  const whole = [], fields = [];
  for (const part of ["slots", "derives"]) {
    const a = before[part] ?? {};
    const b = after[part] ?? {};
    for (const [name, value] of Object.entries(b)) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || JSON.stringify(a[name]) === JSON.stringify(value)) continue;
      const record = !!value && typeof value === "object" && !Array.isArray(value);
      (record ? fields : whole).push(...linesFor(name, a[name], value, 0));
    }
  }
  return [...whole, ...fields].slice(0, max);
}
function recordedTest(name, shots, before, ops, expects) {
  const steps = [...shotsSteps(shots), ...[...before, ...ops].flatMap((op) => [testStep(op), "clock settle"]), ...expects];
  return [`test "${name.trim()}"`, ...steps.map((s) => `  ${s}`)].join("\n");
}
function appendTest(fileText, test) {
  const head = fileText.replace(/\s*$/, "");
  return `${head ? `${head}

` : ""}${test}
`;
}
var RECORDED_LINE = [
  /^test "[^"\\\n\r]{1,80}"$/,
  /^ {2}at "\/[^"\s\\]*"$/,
  /^ {2}tap "[A-Za-z0-9_.:-]{1,80}"$/,
  /^ {2}type "[A-Za-z0-9_.:-]{1,80}" "(?:[^"\\\n\r]|\\.){0,400}"$/,
  /^ {2}back$/,
  /^ {2}clock (?:settle|data|\+\d{1,6})$/,
  /^ {2}expect state [A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)? == (?:-?\d+(?:\.\d+)?|true|false|none|\[\]|"[^"\\\n\r]{0,80}")$/
];
function appendedTest(base, kept) {
  const head = base.replace(/\s*$/, "");
  const prefix = head ? `${head}

` : "";
  if (!kept.startsWith(prefix)) return { refused: "the kept text changes the file above the recorded test, which a recording never does" };
  const test = kept.slice(prefix.length).replace(/\n$/, "");
  const lines = test.split("\n");
  if (lines.length < 2 || !/^test "/.test(lines[0])) return { refused: "the kept text appends no test" };
  const bad = lines.find((l) => !RECORDED_LINE.some((re) => re.test(l)));
  if (bad !== void 0) return { refused: `the kept text holds a line a recording does not write: ${JSON.stringify(bad.slice(0, 80))}` };
  return { test };
}
function parseWritten(text) {
  if (!text) return null;
  try {
    const v = JSON.parse(text);
    return typeof v?.version === "string" ? v : null;
  } catch {
    return null;
  }
}

// packages/modules/exact/src/stories.ts
var id = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
var sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
var P = () => core.EXACT_PROPS;
var appProp = (appId) => JSON.stringify({ id: appId });
function testFileItemOf(snapshot, appId, file) {
  return Object.values(snapshot.canvas.items).find((i) => core.appIdOf(i) === appId && i.properties?.[P().testFile] === file && i.properties?.[P().test] === void 0 && !i.properties?.proposal) ?? null;
}
function storyItemOf(snapshot, appId, file, test) {
  return Object.values(snapshot.canvas.items).find((i) => core.appIdOf(i) === appId && i.properties?.[P().testFile] === file && i.properties?.[P().test] === test) ?? null;
}
var currentVersion = (item) => item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions.at(-1);
async function readStory(ctx, canvasId, item) {
  const v = currentVersion(item);
  if (!v) return null;
  try {
    return parseStory(Buffer.from(await ctx.client.downloadBlob(canvasId, v.blobHash)).toString("utf8"));
  } catch {
    return null;
  }
}
async function syncStories(kit2, host, ctx, canvasId, readings, index, at) {
  const out = [];
  const sources = readings.testSources ?? {};
  const group = id("exact-stories");
  let y = at.y;
  for (const compiled of readings.tests ?? []) {
    const text = sources[compiled.file];
    if (text === void 0) continue;
    let snapshot = await ctx.client.snapshot(canvasId);
    const fileItem = testFileItemOf(snapshot, index.app.id, compiled.file);
    const posted = await kit2.upsert(
      host,
      ctx,
      canvasId,
      snapshot,
      fileItem,
      { bytes: Buffer.from(text, "utf8"), mime: "text/plain", filename: compiled.file },
      { title: `${index.app.name} \xB7 ${compiled.file}`, width: 320, height: 420, properties: { [P().app]: appProp(index.app.id), [P().testFile]: compiled.file }, at: { x: at.sideX, y } },
      group
    );
    out.push({ file: compiled.file, test: null, itemId: posted.itemId, status: posted.status });
    let rowY = fileItem ? fileItem.y : y;
    for (const test of compiled.tests) {
      snapshot = await ctx.client.snapshot(canvasId);
      const next = storyOf(index.app, compiled.file, text, test);
      const key = sha256(JSON.stringify([next.test.name, next.test.line, next.test.steps]));
      const existing = storyItemOf(snapshot, index.app.id, compiled.file, test.name);
      const size = storySize(next.test.steps.length);
      if (existing?.properties?.[P().key] === key) {
        out.push({ file: compiled.file, test: test.name, itemId: existing.id, status: "skipped" });
        rowY = existing.y + existing.height + 60;
        continue;
      }
      const story = rebased(existing ? await readStory(ctx, canvasId, existing) : null, next);
      const r = await kit2.upsert(
        host,
        ctx,
        canvasId,
        snapshot,
        existing,
        { bytes: Buffer.from(storyText(story), "utf8"), mime: core.EXACT_STORY_MIME, filename: `${test.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "test"}.exact-storyboard.json` },
        { title: `${index.app.name} \xB7 test "${test.name}"`, width: size.width, height: size.height, properties: { [P().app]: appProp(index.app.id), [P().testFile]: compiled.file, [P().test]: test.name, [P().key]: key }, at: { x: at.mapX, y: rowY } },
        group
      );
      out.push({ file: compiled.file, test: test.name, itemId: r.itemId, status: r.status });
      rowY = (existing ? existing.y + existing.height : rowY + size.height) + 60;
    }
    y = Math.max(y + 420 + 60, rowY);
  }
  return out;
}
async function runOnHost(kit2, host, ctx, canvasId, app, item, on, sim) {
  const file = item.properties?.[P().testFile] ?? "";
  const test = item.properties?.[P().test] ?? "";
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-exact-run-"));
  try {
    const job = path.join(dir, "job.json");
    await fs.writeFile(job, JSON.stringify({ host: on, file, test }));
    const report = await kit2.bridge(host, "run", ["--app", app, "--dir", dir, "--job", job, ...sim ? ["--sim", sim] : []], `the test on ${on}`, true);
    const snapshot = await ctx.client.snapshot(canvasId);
    const now = snapshot.canvas.items[item.id] ?? item;
    const story = await readStory(ctx, canvasId, now);
    if (!story) throw new Error(`${now.title} does not read as a storyboard`);
    const read = /* @__PURE__ */ new Map();
    for (const f of [...report.steps.map((s) => s.frame), report.failed?.frame ?? null, report.end]) {
      if (f?.file && !read.has(f.sha256)) read.set(f.sha256, (await fs.readFile(f.file)).toString("base64"));
    }
    const next = withRun(story, report, (f) => read.get(f.sha256) ?? null, (/* @__PURE__ */ new Date()).toISOString());
    const posted = await kit2.upsert(
      host,
      ctx,
      canvasId,
      snapshot,
      now,
      { bytes: Buffer.from(storyText(next), "utf8"), mime: core.EXACT_STORY_MIME, filename: currentVersion(now)?.filename ?? "test.exact-storyboard.json" },
      { title: now.title, width: now.width, height: now.height, properties: {}, at: { x: now.x, y: now.y } },
      id("exact-run")
    );
    return { report, status: posted.status };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
function runLine(r) {
  if (r.verdict === "ok") return `${r.host.padEnd(6)} ok \u2014 ${r.steps.length} steps green`;
  if (r.verdict === "skipped") return `${r.host.padEnd(6)} skipped \u2014 ${r.said[0] ?? ""}`;
  const at = r.failed?.line ? `${r.file}:${r.failed.line}` : r.file;
  return `${r.host.padEnd(6)} ${r.verdict === "fail" ? "FAIL" : "error"} at ${at} \u2014 ${r.failed?.reason.split("\n")[0]?.slice(0, 220) ?? r.error ?? "?"}`;
}
async function answerRun(kit2, host, ctx, canvasId, app, hosts, sim, item, say) {
  const ask = parseRunAsk(item.properties?.[P().run]);
  if (!ask) return null;
  const started = Date.now();
  const answer = { seq: ask.seq, ok: true, hosts: {}, ms: 0 };
  for (const on of ask.hosts) {
    if (!hosts.includes(on)) {
      answer.hosts[on] = { verdict: "error", line: null, reason: `this \`isocan exact live\` runs on ${hosts.join(", ")} \u2014 start it with --hosts \u2026,${on}` };
      continue;
    }
    if (on === "ios" && !sim) {
      answer.hosts[on] = { verdict: "error", line: null, reason: "this `isocan exact live` has no simulator of its own: --sim <udid>" };
      continue;
    }
    say(`run on ${on}: ${item.title}${ask.by ? `, for ${ask.by}` : ""}`);
    try {
      const { report } = await runOnHost(kit2, host, ctx, canvasId, app, item, on, sim);
      answer.hosts[on] = { verdict: report.verdict, line: report.failed?.line ?? null, reason: report.failed?.reason ?? null };
      say(`run on ${on}: ${runLine(report)}`);
    } catch (err) {
      answer.hosts[on] = { verdict: "error", line: null, reason: err.message };
      say(`run on ${on}: ${err.message}`);
    }
  }
  answer.ms = Date.now() - started;
  answer.ok = Object.values(answer.hosts).every((h) => h.verdict !== "error");
  return answer;
}
var WEB_DEVICE = { "390x844": "phone", "820x1180": "tablet", "1280x800": "desktop" };
async function verifyOnHost(kit2, host, ctx, canvasId, app, on, sim) {
  const r = await kit2.bridge(host, "verify", ["--app", app, "--host", on, ...sim ? ["--sim", sim] : []], `verify on ${on}`, true);
  if (!r.ok) return { exit: r.exit, problems: null, tests: null, posted: [], unmatched: [], error: r.error ?? "verify did not report" };
  const info = await kit2.appOf(app);
  const manifest = JSON.parse(await fs.readFile(path.join(app, "app.json"), "utf8"));
  const start = manifest.start_url ?? "/";
  const snapshot = await ctx.client.snapshot(canvasId);
  const indexItem = core.indexItemOf(snapshot.canvas, info.id);
  let routes = [];
  if (indexItem) {
    try {
      routes = core.parseIndex(Buffer.from(await ctx.client.downloadBlob(canvasId, currentVersion(indexItem).blobHash)).toString("utf8")).routes;
    } catch {
    }
  }
  const startRoute = routes.find((x) => x.pattern === start)?.name ?? null;
  const posted = [];
  const unmatched = [];
  const group = id("exact-verify");
  for (const shot of r.shots) {
    const name = path.basename(shot.file);
    if (shot.screen === "relaunch") {
      unmatched.push({ shot: name, why: "verify's relaunch reopens on the store a passing test left, and says nothing of the route it shows" });
      continue;
    }
    if (shot.screen !== "first screen") {
      unmatched.push({ shot: name, why: `verify names this screen by the test that ended on it ("${shot.screen}"), not by a route, so the canvas cannot say which screen it shows` });
      continue;
    }
    if (!startRoute) {
      unmatched.push({ shot: name, why: `no route of the index has the start_url's pattern ${start}` });
      continue;
    }
    const size = shot.size ? `${shot.size[0]}x${shot.size[1]}` : "";
    const device = on === "web" ? WEB_DEVICE[size] : "phone";
    if (!device) {
      unmatched.push({ shot: name, why: `verify draws the first screen at ${size.replace("x", "\xD7")}, which is no device of the canvas's row (phone 390\xD7844, tablet 820\xD71180, desktop 1280\xD7800)` });
      continue;
    }
    const screen = core.screenItemOf(snapshot.canvas, info.id, startRoute, device, shot.scheme, on);
    if (!screen) {
      unmatched.push({ shot: name, why: `no ${on} ${device} ${shot.scheme} screen of ${startRoute} on this canvas \u2014 \`isocan exact open\` captures it first` });
      continue;
    }
    const p = await kit2.upsert(
      host,
      ctx,
      canvasId,
      snapshot,
      screen,
      { bytes: await fs.readFile(shot.file), mime: "image/png", filename: `${startRoute}-verify-${on}-${device}-${shot.scheme}.png` },
      { title: screen.title, width: screen.width, height: screen.height, properties: {}, at: { x: screen.x, y: screen.y } },
      group
    );
    posted.push({ itemId: screen.id, status: p.status, shot: name });
  }
  return { exit: r.exit, problems: r.problems, tests: r.tests ? { passed: r.tests.passed, failed: r.tests.failed, failing: r.tests.failing.map((t) => `${t.file}: ${t.name} \u2014 ${t.failures[0] ?? ""}`.slice(0, 300)) } : null, posted, unmatched };
}
function pendingRecords(entries, snapshot, appId) {
  const out = /* @__PURE__ */ new Map();
  for (const e of entries) {
    const op = e.envelope.op;
    if (op.type !== "item.update" || !op.itemId || !op.patch?.properties || !(P().record in op.patch.properties)) continue;
    const item = snapshot.canvas.items[op.itemId];
    if (!item || core.appIdOf(item) !== appId) continue;
    const ask = parseRecordAsk(item.properties?.[P().record]);
    const answered = parseRecordAnswer(item.properties?.[P().recorded]);
    if (ask && (!answered || answered.seq < ask.seq)) out.set(item.id, { item, ask, seq: e.seq });
  }
  return [...out.values()];
}
function pendingAsks(entries, snapshot, appId) {
  const touched = (key) => {
    const ids = /* @__PURE__ */ new Set();
    for (const e of entries) {
      const op = e.envelope.op;
      if (op.type === "item.update" && op.itemId && op.patch?.properties && key in op.patch.properties) ids.add(op.itemId);
    }
    return [...ids].map((i) => snapshot.canvas.items[i]).filter((i) => !!i && core.appIdOf(i) === appId);
  };
  const runs = touched(P().run).filter((i) => {
    const a = parseRunAsk(i.properties?.[P().run]);
    const b = parseRunAnswer(i.properties?.[P().ran]);
    return a && (!b || b.seq < a.seq);
  });
  const verifies = touched(P().verify).filter((i) => {
    const a = parseVerifyAsk(i.properties?.[P().verify]);
    const b = parseVerifyAnswer(i.properties?.[P().verified]);
    return a && (!b || b.seq < a.seq);
  });
  return { runs, verifies };
}
async function answerRecord(kit2, host, ctx, canvasId, app, hosts, sim, _screen, ask, askSeq) {
  const started = Date.now();
  const refused = (error) => ({ seq: ask.seq, ok: false, itemId: null, test: null, expects: [], ms: Date.now() - started, error });
  if (!hosts.includes(ask.host)) return refused(`this \`isocan exact live\` drives ${hosts.join(", ")} \u2014 start it with --hosts \u2026,${ask.host}`);
  if (ask.host === "ios" && !sim) return refused("this `isocan exact live` has no simulator of its own: --sim <udid>");
  const info = await kit2.appOf(app);
  const snapshot = await ctx.client.snapshot(canvasId);
  const fileItem = testFileItemOf(snapshot, info.id, ask.file);
  if (!fileItem) return refused(`${ask.file} is not on this canvas as a test file \u2014 \`isocan exact open\` posts the app's test files`);
  let disk;
  try {
    disk = await fs.readFile(path.join(app, ask.file), "utf8");
  } catch {
    return refused(`${ask.file} is not in the app`);
  }
  if (new RegExp(`^test "${ask.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s*$`, "m").test(disk)) return refused(`${ask.file} already has a test named "${ask.name}" \u2014 name the recording something else`);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-exact-record-"));
  let r;
  try {
    const job = path.join(dir, "job.json");
    await fs.writeFile(job, JSON.stringify({ host: ask.host, size: ask.size, scheme: ask.scheme, shots: ask.shots, before: ask.before, ops: ask.ops }));
    r = await kit2.bridge(host, "record", ["--app", app, "--job", job, ...sim ? ["--sim", sim] : []], "the recording", true);
  } catch (err) {
    return refused(err.message);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
  if (!r.ok || !r.before || !r.after) return refused(r.error ?? "the recording's drive did not finish");
  const expects = proposeExpects(r.before, r.after);
  let test;
  try {
    test = recordedTest(ask.name, ask.shots, ask.before, ask.ops, expects);
  } catch (err) {
    return refused(err.message);
  }
  const text = appendTest(disk, test);
  const put = await ctx.client.uploadBlob(canvasId, Buffer.from(text, "utf8"), "text/plain", ask.file);
  const recording = { file: ask.file, base: sha256(disk), test: ask.name, host: ask.host, seq: ask.seq };
  const presses = ask.ops.length;
  const why = `Recorded in Drive mode on ${ask.host === "web" ? "the web" : ask.host === "ios" ? "iOS" : "macOS"}: ${presses} press${presses === 1 ? "" : "es"}, and ${expects.length} expect line${expects.length === 1 ? "" : "s"} read off the state that changed. Keep it to write the test into ${ask.file}.`;
  const itemId = id("itm");
  const op = {
    type: "item.add",
    itemId,
    version: { id: id("ver"), blobHash: put.blobHash, mimeType: "text/plain", filename: ask.file, size: put.size },
    width: fileItem.width,
    height: fileItem.height,
    // Beside the file, on the side away from the map: the next file's item sits under it.
    placement: { x: Math.round(fileItem.x - fileItem.width - 80), y: Math.round(fileItem.y), chosen: true },
    title: `Recorded: test "${ask.name}" for ${ask.file}`,
    // Core's proposal, by its own keys (`packages/core/src/proposal.ts`, `lineage.ts`): the reducer refuses one without a cite or a why.
    properties: {
      proposal: "sure",
      parent: fileItem.id,
      proposalCites: JSON.stringify([{ kind: "op", ref: String(askSeq) }]),
      proposalWhy: why,
      [P().app]: appProp(info.id),
      [P().recording]: JSON.stringify(recording)
    },
    ...snapshot.project.groupMode === "groups" ? { containerId: null, groupPlacement: "exact" } : {}
  };
  try {
    await host.sendOp(ctx, canvasId, op, id("exact-record"));
  } catch (err) {
    return refused(err.message);
  }
  return { seq: ask.seq, ok: true, itemId, test, expects, ms: Date.now() - started };
}
async function writeKept(host, ctx, canvasId, app, appId, entries, snapshot, say) {
  const trashed = snapshot.canvas.trash.map((t) => t.item);
  const files = /* @__PURE__ */ new Set();
  for (const e of entries) {
    const op = e.envelope.op;
    if (op.type === "item.addVersion") files.add(op.itemId);
    if (op.type === "item.delete") {
      const p = trashed.find((i) => i.id === op.itemId);
      if (p && parseRecording(p.properties?.[P().recording]) && p.properties?.parent) files.add(p.properties.parent);
    }
  }
  for (const fileId of files) {
    const file = snapshot.canvas.items[fileId];
    if (!file || core.appIdOf(file) !== appId || !file.properties?.[P().testFile] || file.properties?.[P().test] !== void 0) continue;
    const version = currentVersion(file);
    if (!version || parseWritten(file.properties?.[P().written])?.version === version.id) continue;
    const kept = [...trashed, ...Object.values(snapshot.canvas.items)].find((i) => i.properties?.parent === file.id && parseRecording(i.properties?.[P().recording]) && currentVersion(i)?.blobHash === version.blobHash);
    if (!kept) continue;
    const recording = parseRecording(kept.properties?.[P().recording]);
    const target = path.join(app, recording.file);
    const answer = async (w) => {
      const written = { version: version.id, at: (/* @__PURE__ */ new Date()).toISOString(), ...w };
      await host.sendOp(ctx, canvasId, { type: "item.update", itemId: file.id, patch: { properties: { [P().written]: JSON.stringify(written) } } }, id("exact-write"));
      say(w.ok ? `kept: test "${w.test}" written into ${recording.file}` : `kept, not written: ${w.error}`);
    };
    if (recording.file !== file.properties[P().testFile]) {
      await answer({ ok: false, sha256: null, test: null, error: `the recording was for ${recording.file}, not ${file.properties[P().testFile]}` });
      continue;
    }
    let disk;
    try {
      disk = await fs.readFile(target, "utf8");
    } catch {
      await answer({ ok: false, sha256: null, test: null, error: `${recording.file} is not in the app any more` });
      continue;
    }
    if (sha256(disk) !== recording.base) {
      await answer({ ok: false, sha256: null, test: null, error: `${recording.file} changed on disk since the recording; record again` });
      continue;
    }
    const text = Buffer.from(await ctx.client.downloadBlob(canvasId, version.blobHash)).toString("utf8");
    const checked = appendedTest(disk, text);
    if ("refused" in checked) {
      await answer({ ok: false, sha256: null, test: null, error: checked.refused });
      continue;
    }
    const temp = `${target}.isocan-${process.pid}`;
    await fs.writeFile(temp, text);
    await fs.rename(temp, target);
    await answer({ ok: true, sha256: sha256(text), test: recording.test });
  }
}

// packages/modules/exact/src/proposals.ts
import { promises as fs2 } from "node:fs";
import os2 from "node:os";
import path2 from "node:path";
var id2 = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
var P2 = () => core.EXACT_PROPS;
var currentVersion2 = (item) => item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions.at(-1);
var LOOP = /^http:\/\/127\.0\.0\.1:\d+$/;
async function proposeVerb(host, ref, opts, cmd) {
  const ctx = await host.ctxOf(cmd);
  const canvas = await host.resolveCanvas(ctx);
  const snapshot = await ctx.client.snapshot(canvas.id);
  const screen = host.resolveItem(snapshot, ref);
  if (!screen.properties?.[P2().route] || !core.appIdOf(screen)) throw new Error(`${screen.title} is not an Exact screen \u2014 propose on a screen \`isocan exact open\` posted (it carries exact.route)`);
  const ops = opsFromFlags(opts.token ?? [], opts.row ?? [], opts.op ?? []);
  const why = (opts.why ?? "").trim();
  if (!why) throw new Error('a proposal says why, in design words: --why "\u2026" (two sentences at most)');
  if ((why.match(/[.!?](\s|$)/g) ?? []).length > 2) throw new Error("the why is two sentences at most; say the rest in a comment");
  const cites = (opts.cites ?? []).map((c) => {
    const at = c.indexOf(":");
    if (at <= 0) throw new Error(`--cites takes kind:ref (comment:<id>, op:<seq>, \u2026), not ${JSON.stringify(c)}`);
    return { kind: c.slice(0, at), ref: c.slice(at + 1) };
  });
  const area = opts.in ? host.resolveItem(snapshot, opts.in).id : null;
  const seq = Date.now();
  const ask = { seq, by: ctx.actor.name, ops, why, cites, in: area };
  await host.sendOp(ctx, canvas.id, { type: "item.update", itemId: screen.id, patch: { properties: { [P2().propose]: JSON.stringify(ask) } } }, id2("exact-propose"));
  const wait = opts.wait === void 0 ? 540 : Number(opts.wait);
  if (!(wait >= 0)) throw new Error(`--wait takes seconds, not ${opts.wait}`);
  if (wait === 0) {
    if (ctx.json) return host.printJson({ asked: { screen: screen.id, seq } });
    console.log(`asked on ${screen.title} \u2014 \`isocan exact live\` holds it and posts the proposal under the screen; read exact.proposed there`);
    return;
  }
  if (!ctx.json) console.error(`asked on ${screen.title}; waiting for \`isocan exact live\` to hold it and picture it on every device (a minute or two)\u2026`);
  const deadline = Date.now() + wait * 1e3;
  for (; ; ) {
    const now = await ctx.client.snapshot(canvas.id);
    const answer = parseProposeAnswer(now.canvas.items[screen.id]?.properties?.[P2().proposed]);
    if (answer && answer.seq === seq) {
      if (ctx.json) return host.printJson(answer);
      if (!answer.ok) throw new Error(`not proposed: ${answer.error}`);
      console.log(`${answer.itemId}  proposed (${answer.class}, ${answer.previews} pictures, held as ${answer.proposal} by ${answer.client} at ${answer.scope} scope) \u2014 a person's Keep writes it; nothing is written until then`);
      return;
    }
    if (Date.now() > deadline) throw new Error(`no answer in ${wait} s \u2014 is \`isocan exact live <app>\` running for this canvas, without --no-frames? The ask stays on the screen; it answers when it starts`);
    await new Promise((r) => setTimeout(r, 2e3));
  }
}
function pendingProposes(entries, snapshot, appId) {
  const out = /* @__PURE__ */ new Map();
  for (const e of entries) {
    const op = e.envelope.op;
    if (op.type !== "item.update" || !op.itemId || !op.patch?.properties || !(P2().propose in op.patch.properties)) continue;
    const item = snapshot.canvas.items[op.itemId];
    if (!item || core.appIdOf(item) !== appId || !item.properties?.[P2().route]) continue;
    const ask = parseProposeAsk(item.properties?.[P2().propose]);
    const answered = parseProposeAnswer(item.properties?.[P2().proposed]);
    if (ask && (!answered || answered.seq < ask.seq)) out.set(item.id, { item, ask, seq: e.seq, actor: e.envelope.actor });
  }
  return [...out.values()];
}
async function answerPropose(kit2, host, ctx, canvasId, app, opts, pending) {
  const { item: screen, ask, seq: askSeq, actor } = pending;
  const started = Date.now();
  let snapshot = await ctx.client.snapshot(canvasId);
  const isAgent = !!snapshot.canvas.agents?.[actor.id];
  const scope = scopeFor(isAgent, grantedWrite(actor, ctx.actor, process.env.ISOCAN_EXACT_GRANT));
  const refused = (error, extra = {}) => ({ seq: ask.seq, ok: false, itemId: null, proposal: null, class: null, scope, client: null, how: null, previews: 0, scopeCheck: null, ms: Date.now() - started, error, ...extra });
  const loop = process.env.ISOCAN_EXACT_LOOP;
  if (!loop || !LOOP.test(loop)) return refused("a proposal is held by the dev loop's Tamber wire, and this `isocan exact live` runs none (--no-frames): start it without --no-frames");
  const route = screen.properties[P2().route];
  const shots = screen.properties[P2().reached] ?? screen.properties[P2().shots] ?? `at "${screen.properties[P2().url] ?? "/"}"`;
  const ios = opts.hosts.includes("ios") && !!opts.sim;
  const dir = await fs2.mkdtemp(path2.join(os2.tmpdir(), "isocan-exact-propose-"));
  let r;
  try {
    const job = path2.join(dir, "job.json");
    await fs2.writeFile(job, JSON.stringify({
      ops: ask.ops,
      scope,
      name: actor.name,
      shots,
      devices: Object.keys(DEVICES).map((d) => ({ device: d, size: `${DEVICES[d].width}x${DEVICES[d].height}` })),
      schemes: ["light", "dark"],
      ios
    }));
    try {
      r = await kit2.bridge(host, "propose", ["--app", app, "--dir", path2.join(dir, "out"), "--job", job, "--dev-url", loop, ...ios ? ["--sim", opts.sim] : []], "the proposal's preview", true);
    } catch (err) {
      return refused(err.message);
    }
    const base = { proposal: r.proposal ?? null, class: r.class ?? null, client: r.client ?? null, how: r.how ?? null, scopeCheck: r.scopeCheck ?? null };
    if (!r.ok || !r.proposal || !r.previews?.length || scope === "read") {
      if (r.proposal) await dropOnWire(kit2, host, app, loop, r.proposal);
      return refused(r.error ?? "the proposal was not pictured", base);
    }
    const blobs = /* @__PURE__ */ new Map();
    const put = async (file, sha) => {
      const known = blobs.get(sha);
      if (known) return known;
      const b = await ctx.client.uploadBlob(canvasId, await fs2.readFile(file), "image/png", path2.basename(file));
      const v = { blobHash: b.blobHash, size: b.size };
      blobs.set(sha, v);
      return v;
    };
    const versions = [];
    const cells = [];
    const version = async (file, sha, name) => {
      const b = await put(file, sha);
      const v = { id: id2("ver"), blobHash: b.blobHash, mimeType: "image/png", filename: name, size: b.size };
      versions.push(v);
      return v.id;
    };
    for (const p of r.previews) {
      const stem = `${route}-${p.host}-${p.device}-${p.scheme}`;
      const before = await version(p.before, p.beforeSha256, `${stem}-before.png`);
      const after = await version(p.after, p.afterSha256, `${stem}-proposed.png`);
      cells.push({ host: p.host, device: p.device, scheme: p.scheme, before, after, restored: p.restored });
    }
    const host_ = screen.properties[P2().host] ?? "web", device = screen.properties[P2().device] ?? "phone", scheme = screen.properties[P2().scheme] ?? "light";
    const own2 = r.previews.find((p) => p.host === host_ && p.device === device && p.scheme === scheme);
    if (!own2) {
      await dropOnWire(kit2, host, app, loop, r.proposal);
      return refused(`this session pictures ${[...new Set(r.previews.map((p) => p.host))].join(", ")}; ${screen.title} is a ${host_} screen \u2014 propose on a screen this \`isocan exact live\` captures`, base);
    }
    await version(own2.after, own2.afterSha256, `${route}-${host_}-${device}-${scheme}.png`);
    const record = {
      seq: ask.seq,
      route,
      asker: { id: actor.id, name: actor.name, kind: isAgent ? "agent" : "person" },
      scope: scope === "propose" ? "propose" : "write",
      client: r.client,
      proposal: r.proposal,
      class: r.class,
      how: r.how,
      ops: ask.ops,
      files: r.files ?? {},
      changed: r.changed ?? [],
      previews: cells,
      at: (/* @__PURE__ */ new Date()).toISOString()
    };
    snapshot = await ctx.client.snapshot(canvasId);
    const size = { width: 1080, height: 300 + 280 * new Set(cells.map((c) => `${c.host}/${c.device}`)).size };
    const area = ask.in ? snapshot.canvas.items[ask.in] : null;
    const placement = area ? host.placementFor(snapshot, { in: area.id }, size) : { x: Math.round(screen.x), y: Math.round(screen.y + screen.height + 80) };
    const itemId = id2("itm");
    const [first, ...rest] = versions;
    const group = id2("exact-proposal");
    const add = {
      type: "item.add",
      itemId,
      version: first,
      width: size.width,
      height: size.height,
      placement,
      title: proposalTitle(actor.name, ask.ops),
      // Core's proposal, by its own keys (`packages/core/src/proposal.ts`): hung beneath the screen it changes, citing the ask.
      properties: {
        proposal: "sure",
        parent: screen.id,
        proposalCites: JSON.stringify([{ kind: "op", ref: String(askSeq) }, ...ask.cites]),
        proposalWhy: ask.why,
        [P2().app]: JSON.stringify({ id: core.appIdOf(screen) }),
        [P2().proposal]: JSON.stringify(record)
      },
      ...snapshot.project.groupMode === "groups" && !area ? { containerId: null, groupPlacement: "exact" } : {}
    };
    try {
      await host.sendOp(ctx, canvasId, add, group);
      for (const v of rest) await host.sendOp(ctx, canvasId, { type: "item.addVersion", itemId, version: v }, group);
    } catch (err) {
      await dropOnWire(kit2, host, app, loop, r.proposal);
      return refused(err.message, base);
    }
    return { seq: ask.seq, ok: true, itemId, ...base, scope, previews: cells.length, ms: Date.now() - started };
  } finally {
    await fs2.rm(dir, { recursive: true, force: true });
  }
}
async function dropOnWire(kit2, host, app, loop, proposal) {
  const dir = await fs2.mkdtemp(path2.join(os2.tmpdir(), "isocan-exact-drop-"));
  try {
    const job = path2.join(dir, "job.json");
    await fs2.writeFile(job, JSON.stringify({ proposal }));
    await kit2.bridge(host, "drop", ["--app", app, "--job", job, "--dev-url", loop], "the drop", true);
  } catch {
  } finally {
    await fs2.rm(dir, { recursive: true, force: true });
  }
}
async function settleKept(kit2, host, ctx, canvasId, app, appId, entries, snapshot, say) {
  const loop = process.env.ISOCAN_EXACT_LOOP;
  const trashed = new Map(snapshot.canvas.trash.map((t) => [t.item.id, t.item]));
  for (const e of entries) {
    const op = e.envelope.op;
    const ids = op.type === "item.delete" ? [op.itemId] : op.type === "group.change" ? [...new Set(JSON.stringify(op).match(/itm_[A-Za-z0-9_-]+/g) ?? [])] : [];
    for (const goneId of ids) await settleOne(goneId, e);
  }
  async function settleOne(goneId, e) {
    const gone = trashed.get(goneId);
    const record = gone ? parseProposalRecord(gone.properties?.[P2().proposal]) : null;
    if (!gone || !record || core.appIdOf(gone) !== appId) return;
    const screen = snapshot.canvas.items[gone.properties?.parent ?? ""];
    const picture = currentVersion2(gone);
    const kept = !!screen && !!picture && screen.versions.some((v) => v.id === picture.id);
    if (!loop || !LOOP.test(loop)) {
      say(`${kept ? "kept" : "dropped"} ${gone.title}, but this \`isocan exact live\` runs no dev loop (--no-frames): nothing reached the wire`);
      return;
    }
    if (!kept) {
      await dropOnWire(kit2, host, app, loop, record.proposal);
      say(`dropped: ${gone.title} (${record.proposal})`);
      return;
    }
    if (parseAcceptAnswer(screen.properties?.[P2().accepted])?.item === gone.id) return;
    const by = e.envelope.actor;
    const answer = async (a) => {
      const full = { item: gone.id, version: picture.id, by: by.name, at: (/* @__PURE__ */ new Date()).toISOString(), ...a };
      await host.sendOp(ctx, canvasId, { type: "item.update", itemId: screen.id, patch: { properties: { [P2().accepted]: JSON.stringify(full) } } }, id2("exact-accept"));
    };
    const putBack = async () => {
      const before = screen.versions.filter((v) => v.id !== picture.id).at(-1);
      if (before && screen.currentVersionId === picture.id) await host.sendOp(ctx, canvasId, { type: "item.setCurrentVersion", itemId: screen.id, versionId: before.id }, id2("exact-accept"));
    };
    const keptAt = grantedWrite(by, ctx.actor, process.env.ISOCAN_EXACT_GRANT) ? "write" : "read";
    if (snapshot.canvas.agents?.[by.id]) {
      await putBack();
      await answer({ ok: false, proposal: record.proposal, heldAgain: null, written: [], error: `${by.name} is an agent: a proposal reaches the files only by a person's Keep` });
      say(`refused: ${by.name}, an agent, chose ${gone.title}`);
      return;
    }
    const dir = await fs2.mkdtemp(path2.join(os2.tmpdir(), "isocan-exact-accept-"));
    let r;
    try {
      const job = path2.join(dir, "job.json");
      await fs2.writeFile(job, JSON.stringify({ proposal: record.proposal, ops: record.ops, files: record.files, name: by.name, scope: keptAt }));
      r = await kit2.bridge(host, "accept", ["--app", app, "--job", job, "--dev-url", loop], "the accept", true);
    } catch (err) {
      r = { ok: false, error: err.message };
    } finally {
      await fs2.rm(dir, { recursive: true, force: true });
    }
    if (!r.ok) await putBack();
    await answer({ ok: r.ok, proposal: record.proposal, heldAgain: r.heldAgain ?? null, written: r.written ?? [], ...r.error ? { error: r.error } : {} });
    say(r.ok ? `kept by ${by.name}: ${gone.title} \u2014 accepted on the wire, wrote ${(r.written ?? []).join(", ") || "nothing"}` : `kept by ${by.name}, not written: ${r.error}`);
  }
}

// packages/modules/exact/src/cli-run.ts
var id3 = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
var sha2562 = (text) => createHash2("sha256").update(text).digest("hex");
var PROVEN = { commit: "cbe553f6", protocol: "tamber/1.18", bun: "1.4.2" };
async function bridge(host, verb, args, what, quiet) {
  if (!host.runPackageScript) throw new Error("this isocan cannot run a script for a module \u2014 upgrade it (module API 0.2.11)");
  const dir = await fs3.mkdtemp(path3.join(os3.tmpdir(), "isocan-exact-"));
  const report = path3.join(dir, "report.json");
  try {
    host.runPackageScript("scripts/exact-bridge.mjs", [verb, ...args, "--report", report], { what, quiet });
    return JSON.parse(await fs3.readFile(report, "utf8"));
  } finally {
    await fs3.rm(dir, { recursive: true, force: true });
  }
}
function appDir(given) {
  return path3.resolve(given ?? ".");
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
  const version = { id: id3("ver"), blobHash: put.blobHash, mimeType: file.mime, filename: file.filename, size: put.size };
  if (existing) {
    await host.sendOp(ctx, canvasId, { type: "item.addVersion", itemId: existing.id, version }, group);
    if (!sameProps(existing, add.properties)) await host.sendOp(ctx, canvasId, { type: "item.update", itemId: existing.id, patch: { properties: add.properties } }, group);
    return { itemId: existing.id, status: "new version", blobHash: put.blobHash };
  }
  const itemId = id3("itm");
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
  if (opts.hosts.includes("ios") && !opts.sim) throw new Error('iOS captures run on a simulator of your own, never a booted one that may be somebody else\'s: `xcrun simctl create "isocan-exact" com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro <runtime>` prints a UDID; pass it as --sim <udid>');
  for (const route of index.routes) {
    const primary = core.screenItemOf(snapshot.canvas, appId, route.name);
    const fallback = primary?.properties?.[core.EXACT_PROPS.shots] ?? `at "${core.routeLocation(route, opts.params)}"`;
    for (const host2 of opts.hosts) {
      const devices = host2 === "web" ? opts.devices : [NATIVE_DEVICE[host2]];
      for (const device of devices) {
        for (const scheme of opts.schemes) {
          const existing = core.screenItemOf(snapshot.canvas, appId, route.name, device, scheme, host2);
          const text = existing?.properties?.[core.EXACT_PROPS.shots] ?? fallback;
          let shots;
          try {
            shots = parseShots(text);
          } catch (err) {
            throw new Error(`${existing?.title ?? primary?.title ?? route.name}: ${err.message}`);
          }
          const normal = shotsText(shots);
          wants.push({ route, host: host2, device, scheme, shots: normal, url: shots.url, key: sha2562(captureKeyParts(index, route.name, device, scheme, normal, host2, host2 === "ios" ? opts.sim : null)), existing });
        }
      }
    }
  }
  const todo = wants.filter((w) => opts.force || !w.existing || w.existing.properties?.[core.EXACT_PROPS.key] !== w.key);
  const jobs = [];
  for (const w of todo) {
    let job = jobs.find((j) => j.host === w.host && j.wants[0].shots === w.shots);
    if (!job) {
      const s = parseShots(w.shots);
      job = { host: w.host, url: s.url, ops: s.ops, shots: [], wants: [] };
      jobs.push(job);
    }
    job.shots.push({ size: jobSize(w.device), scheme: w.scheme });
    job.wants.push(w);
  }
  const dir = await fs3.mkdtemp(path3.join(os3.tmpdir(), "isocan-exact-shots-"));
  try {
    let shots = { shots: [] };
    const started = Date.now();
    if (jobs.length > 0) {
      const jobsFile = path3.join(dir, "jobs.json");
      await fs3.writeFile(jobsFile, JSON.stringify(jobs.map(({ host: on, url, ops, shots: s }) => ({ host: on, url, ops, shots: s }))));
      const loop = process.env.ISOCAN_EXACT_LOOP;
      const joined = loop && /^http:\/\/127\.0\.0\.1:\d+$/.test(loop) && jobs.some((j) => j.host !== "web") ? ["--dev-url", loop] : [];
      shots = await bridge(host, "capture", ["--app", app, "--dir", dir, "--jobs", jobsFile, ...opts.sim ? ["--sim", opts.sim] : [], ...joined], "the screenshots", true);
    }
    const captureMs = Date.now() - started;
    snapshot = await ctx.client.snapshot(canvasId);
    const group = id3("exact-sync");
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
    const anatomy = [];
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
      anatomy.push({ file: entry.file, itemId: posted.itemId, status: posted.status });
      sideY += 340 + 40;
    }
    const layout = mapLayout(index.routes, nativeCellWidth(opts.hosts));
    const mapX = origin.x + LAYOUT.sideWidth + LAYOUT.sideGap;
    const screens = [];
    const natives = [];
    for (const w of wants) {
      const at = layout.get(w.route.name);
      const primary = w.host === "web" && w.device === "phone" && w.scheme === "light";
      const jobIndex = jobs.findIndex((j) => j.wants.includes(w));
      const shot = jobIndex < 0 ? null : shots.shots.find((s) => s.job === jobIndex && s.index === jobs[jobIndex].wants.indexOf(w));
      const off = primary ? { x: 0, y: 0 } : w.host === "web" ? rowOffset(w.device, w.scheme) : nativeOffset(w.host, w.scheme);
      const size = primary ? LAYOUT.primary : w.host === "web" ? rowSize(w.device) : nativeSize(w.host, shot?.png ?? null);
      const ownShots = primary || w.existing?.properties?.[core.EXACT_PROPS.shots] !== void 0;
      const props = core.screenProperties(index, w.route, w.url, { device: w.device, scheme: w.scheme, host: w.host, ...ownShots ? { shots: w.shots } : {}, key: w.key, reached: w.shots });
      if (!shot) {
        if (w.existing && !sameProps(w.existing, props)) await host.sendOp(ctx, canvasId, { type: "item.update", itemId: w.existing.id, patch: { properties: props } }, group);
        screens.push({ route: w.route.name, host: w.host, device: w.device, scheme: w.scheme, itemId: w.existing.id, status: "skipped", sha256: null, url: w.url, ms: 0 });
        continue;
      }
      const label = primary ? w.route.name : w.host === "web" ? `${w.route.name} \xB7 ${w.device} ${w.scheme}` : `${w.route.name} \xB7 ${HOST_NAMES[w.host]} ${w.device} ${w.scheme}`;
      if (shot.points) props[core.EXACT_PROPS.points] = JSON.stringify(shot.points);
      const posted = await upsert(
        host,
        ctx,
        canvasId,
        snapshot,
        w.existing,
        { bytes: await fs3.readFile(shot.file), mime: "image/png", filename: `${w.route.name}-${w.host === "web" ? "" : `${w.host}-`}${w.device}-${w.scheme}.png` },
        { title: `${index.app.name} \xB7 ${label}`, width: size.width, height: size.height, properties: props, at: { x: mapX + at.x + off.x, y: origin.y + at.y + off.y } },
        group
      );
      screens.push({ route: w.route.name, host: w.host, device: w.device, scheme: w.scheme, itemId: posted.itemId, status: posted.status, sha256: shot.sha256, url: w.url, ms: shot.ms });
      if (w.host !== "web" && w.scheme === "light" && shot.png) natives.push({ route: w.route.name, host: w.host, points: shot.points ?? null, file: shot.file, size: `${shot.png.width}x${shot.png.height}`, url: w.url, ops: parseShots(w.shots).ops });
    }
    let hostFindings = [];
    const compared = natives.map((n) => ({ route: n.route, host: n.host }));
    if (natives.length > 0) {
      const jobsFile = path3.join(dir, "compare.json");
      await fs3.writeFile(jobsFile, JSON.stringify(natives.map((n) => ({ route: n.route, host: n.host, url: n.url, ops: n.ops, size: n.size, reference: n.file }))));
      const report = await bridge(host, "compare", ["--app", app, "--dir", dir, "--jobs", jobsFile], "the comparison between hosts", true);
      hostFindings = compareFindings(report, natives, readings.sources);
    }
    const walls = [];
    const after = await ctx.client.snapshot(canvasId);
    for (const w of wallsOf(after.canvas, appId)) {
      const posted = await postWall(host, ctx, canvasId, after, index.app, w.route, w.scheme, w.item);
      walls.push({ itemId: posted.itemId, route: w.route, status: posted.status });
    }
    const placed = Object.values(after.canvas.items).filter((i) => core.appIdOf(i) === appId && (i.properties?.[core.EXACT_PROPS.route] !== void 0 || i.id === indexItem.itemId));
    const below = Math.max(sideY, ...placed.map((i) => i.y + i.height)) + 240;
    const stories = await syncStories(kit, host, ctx, canvasId, readings, index, { sideX: origin.x, mapX, y: below });
    return { index, indexItem, design, anatomy, screens, captureMs, hostFindings, compared, walls, stories };
  } finally {
    await fs3.rm(dir, { recursive: true, force: true });
  }
}
async function postWall(host, ctx, canvasId, snapshot, app, route, scheme, existing) {
  const cells = wallCells(snapshot.canvas, app.id, route, scheme);
  if (cells.length === 0) throw new Error(`${app.name} has no screen of ${route} on this canvas \u2014 \`isocan exact open <app> --hosts web,ios,macos\` captures them first`);
  const wall2 = { format: 1, app, route, scheme, cells };
  const size = wallSize(cells);
  const items = Object.values(snapshot.canvas.items);
  const at = existing ? { x: existing.x, y: existing.y } : { x: items.length ? Math.round(Math.max(...items.map((i) => i.x + i.width)) + 200) : 0, y: items.length ? Math.round(Math.min(...items.map((i) => i.y))) : 0 };
  const posted = await upsert(
    host,
    ctx,
    canvasId,
    snapshot,
    existing,
    { bytes: Buffer.from(wallText(wall2), "utf8"), mime: core.EXACT_WALL_MIME, filename: `${route}.exact-wall.json` },
    { title: `${app.name} \xB7 ${route} \u2014 device wall`, width: size.width, height: size.height, properties: { [core.EXACT_PROPS.app]: JSON.stringify({ id: app.id }), [core.EXACT_PROPS.route]: route, [core.EXACT_PROPS.scheme]: scheme }, at },
    id3("exact-wall")
  );
  return { itemId: posted.itemId, status: posted.status, cells: cells.length };
}
async function wall(host, given, route, opts, cmd) {
  const ctx = await host.ctxOf(cmd);
  const app = await appOf(appDir(given));
  const canvas = await host.resolveCanvas(ctx);
  const scheme = listOf(opts.scheme ?? "light", SCHEMES, "scheme")[0];
  const snapshot = await ctx.client.snapshot(canvas.id);
  const existing = wallsOf(snapshot.canvas, app.id).find((w) => w.route === route && w.scheme === scheme)?.item ?? null;
  const r = await postWall(host, ctx, canvas.id, snapshot, app, route, scheme, existing);
  const cells = wallCells(snapshot.canvas, app.id, route, scheme);
  if (ctx.json) return host.printJson({ ...r, route, scheme, cells: cells.map((c) => ({ itemId: c.itemId, host: c.host, device: c.device, width: c.width, height: c.height })) });
  console.log(`${r.itemId}  ${app.name} \xB7 ${route} \u2014 device wall (${r.status}): ${cells.map((c) => `${HOST_NAMES[c.host]} ${c.device}`).join(", ")}`);
}
async function postHostFindings(host, ctx, canvasId, app, findings, compared) {
  if (compared.length === 0) return { created: 0, updated: 0, removed: 0 };
  const snapshot = await ctx.client.snapshot(canvasId);
  const scope = (key) => compared.some((c) => key.startsWith(`compare:${c.route}:${c.host}:`));
  const plan = planFindings(snapshot.canvas, { app }, findings, scope);
  const group = id3("exact-hosts");
  for (const c of plan.create) await host.sendOp(ctx, canvasId, { type: "thread.create", threadId: id3("thr"), x: c.x, y: c.y, anchorItemId: c.item.id, comment: { id: id3("cmt"), body: c.finding.body, record: true } }, group);
  for (const u of plan.update) await host.sendOp(ctx, canvasId, { type: "comment.update", threadId: u.thread.id, commentId: u.thread.comments[0].id, body: u.body }, group);
  for (const r of plan.remove) await host.sendOp(ctx, canvasId, { type: "thread.delete", threadId: r.thread.id }, group);
  return { created: plan.create.length, updated: plan.update.length, removed: plan.remove.length };
}
function syncJson(r) {
  return {
    index: { ...r.indexItem, routes: r.index.routes, routesJson: r.index.routesJson, edges: r.index.edges, unplaced: r.index.unplaced, exact: r.index.exact, plan: r.index.plan, inputs: r.index.inputs },
    design: r.design,
    anatomy: r.anatomy,
    screens: r.screens,
    captureMs: r.captureMs,
    hosts: { compared: r.compared, findings: r.hostFindings.map((f) => ({ key: f.key, routes: f.routes, body: f.body })) },
    walls: r.walls,
    stories: r.stories
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
  for (const s of r.screens) console.log(`${s.itemId}  ${s.route.padEnd(14)} ${s.host.padEnd(6)} ${s.device.padEnd(8)} ${s.scheme.padEnd(6)} ${s.status.padEnd(12)} ${s.sha256?.slice(0, 12) ?? ""}`);
  for (const f of r.hostFindings) console.log(`${f.key}
  ${f.body.split("\n")[0]}`);
  if (r.compared.length) console.log(`compared ${r.compared.map((c) => `${c.route} on ${HOST_NAMES[c.host]}`).join(", ")} with the web: ${r.hostFindings.length} difference${r.hostFindings.length === 1 ? "" : "s"} beyond each platform's own bars`);
  for (const w of r.walls) console.log(`${w.itemId}  device wall of ${w.route} (${w.status})`);
  for (const t of r.stories) console.log(`${t.itemId}  ${t.test === null ? `test file ${t.file}` : `storyboard of test "${t.test}"`} (${t.status})`);
  console.log(tally(r));
}
function syncOptions(opts) {
  const sim = opts.sim ?? null;
  if (sim !== null && !UDID.test(sim)) throw new Error(`--sim takes a simulator's UDID (\`xcrun simctl list devices\`), not ${JSON.stringify(sim)}: a name could be somebody else's simulator`);
  return {
    params: core.parseParams(opts.param ?? []),
    devices: listOf(opts.devices, DEVICE_NAMES, "devices"),
    schemes: listOf(opts.schemes, SCHEMES, "schemes"),
    force: opts.force === true,
    hosts: parseHosts(opts.hosts),
    sim
  };
}
async function open(host, given, opts, cmd) {
  const ctx = await host.ctxOf(cmd);
  const app = appDir(given);
  const canvas = await host.resolveCanvas(ctx);
  if (!ctx.json) console.error(`reading ${app} with its own Exact, on this machine, and capturing what moved\u2026`);
  const r = await sync(host, ctx, canvas.id, app, syncOptions(opts));
  await postHostFindings(host, ctx, canvas.id, r.index.app, r.hostFindings, r.compared);
  if (ctx.json) return host.printJson(syncJson(r));
  printSync(r);
}
var IGNORED = /(^|\/)(target|\.exact|node_modules|\.git|dist[^/]*)(\/|$)|(^|\/)\.!|\.d\.ts$|\.DS_Store$|~$|\.swp$|\.isocan-\d+$/;
async function appOf(app) {
  const manifest = JSON.parse(await fs3.readFile(path3.join(app, "app.json"), "utf8"));
  return { id: manifest.app?.id ?? manifest.id ?? path3.basename(app), name: manifest.app?.name ?? manifest.name ?? path3.basename(app) };
}
async function postFindings(host, ctx, canvasId, app, diag, checkRoutes) {
  const info = await appOf(app);
  const routes = diag.symbols ? core.contractRoutes(diag.symbols, diag.sources).routes : [];
  const findings = buildFindings(diag, routes);
  const errors = findings.length;
  let checked = [];
  if (errors === 0 && checkRoutes.length > 0) {
    const report = await bridge(host, "check", ["--app", app, ...checkRoutes.flatMap((r) => ["--url", r.url])], "agent check", true);
    findings.push(...checkFindings(report, diag, checkRoutes));
    checked = checkRoutes.map((r) => r.route);
  }
  const snapshot = await ctx.client.snapshot(canvasId);
  const inScope = (key) => key.startsWith("build:") || errors === 0 && checked.some((r) => key.startsWith(`check:${r}:`));
  const plan = planFindings(snapshot.canvas, { app: info }, findings, inScope);
  const group = id3("exact-findings");
  for (const c of plan.create) {
    await host.sendOp(ctx, canvasId, { type: "thread.create", threadId: id3("thr"), x: c.x, y: c.y, anchorItemId: c.item.id, comment: { id: id3("cmt"), body: c.finding.body, record: true } }, group);
  }
  for (const u of plan.update) {
    await host.sendOp(ctx, canvasId, { type: "comment.update", threadId: u.thread.id, commentId: u.thread.comments[0].id, body: u.body }, group);
  }
  for (const r of plan.remove) await host.sendOp(ctx, canvasId, { type: "thread.delete", threadId: r.thread.id }, group);
  const moved = movedComments(snapshot.canvas, info.id, diag.digests);
  for (const m of moved) {
    await host.sendOp(ctx, canvasId, { type: "thread.reply", threadId: m.thread.id, comment: { id: id3("cmt"), body: movedBody(m.source, m.now), record: true } }, group);
  }
  return { errors, created: plan.create.length, updated: plan.update.length, removed: plan.remove.length, moved: moved.length, checked, findings };
}
function findingsTally(f) {
  const parts = [
    f.errors > 0 ? `${f.errors} compile error${f.errors === 1 ? "" : "s"}` : "builds",
    f.checked.length > 0 ? `checked ${f.checked.join(", ")}` : null,
    f.created || f.updated || f.removed ? `comments: ${f.created} new, ${f.updated} rewritten, ${f.removed} resolved` : null,
    f.moved ? `${f.moved} moved` : null
  ];
  return parts.filter(Boolean).join("; ");
}
async function check(host, given, opts, cmd) {
  const ctx = await host.ctxOf(cmd);
  const app = appDir(given);
  const canvas = await host.resolveCanvas(ctx);
  const diag = await bridge(host, "diagnose", ["--app", app], "the compiler's check", true);
  const info = await appOf(app);
  const snapshot = await ctx.client.snapshot(canvas.id);
  const routes = diag.symbols ? core.contractRoutes(diag.symbols, diag.sources).routes : [];
  const urls = routes.flatMap((r2) => {
    const screen = core.screenItemOf(snapshot.canvas, info.id, r2.name);
    return screen ? [{ route: r2.name, url: screen.properties?.[core.EXACT_PROPS.url] ?? core.routeLocation(r2) }] : [];
  });
  const r = await postFindings(host, ctx, canvas.id, app, diag, opts.checks === false ? [] : urls);
  if (ctx.json) return host.printJson({ errors: r.errors, created: r.created, updated: r.updated, resolved: r.removed, moved: r.moved, checked: r.checked, findings: r.findings.map((f) => ({ key: f.key, routes: f.routes, body: f.body })) });
  for (const f of r.findings) console.log(`${f.key}
  ${f.body.split("\n")[0]}`);
  console.log(findingsTally(r));
}
function relayArgs(env) {
  const at = env.ISOCAN_EXACT_RELAY?.trim();
  if (!at) return [];
  const account = env.ISOCAN_EXACT_RELAY_ACCOUNT?.trim();
  if (!account) throw new Error("ISOCAN_EXACT_RELAY needs ISOCAN_EXACT_RELAY_ACCOUNT: the account label the relay gave you");
  const cert = env.ISOCAN_EXACT_RELAY_CERT?.trim(), key = env.ISOCAN_EXACT_RELAY_KEY?.trim();
  if (!cert !== !key) throw new Error("ISOCAN_EXACT_RELAY_CERT and ISOCAN_EXACT_RELAY_KEY go together: PEM files for the relay's names");
  return ["--relay", at, "--relay-account", account, ...cert && key ? ["--relay-cert", cert, "--relay-key", key] : []];
}
async function live(host, given, opts, cmd) {
  const ctx = await host.ctxOf(cmd);
  const app = appDir(given);
  const canvas = await host.resolveCanvas(ctx);
  if (opts.frames !== false) {
    if (!host.runPackageScript) throw new Error("this isocan cannot run a script for a module \u2014 upgrade it (module API 0.2.11), or pass --no-frames");
    const child = [process.execPath, process.argv[1], ...process.argv.slice(2), "--no-frames"];
    if (!child.includes("--canvas")) child.push("--canvas", canvas.id);
    const capture = syncOptions(opts);
    host.runPackageScript("scripts/exact-live.mjs", [
      "--app",
      app,
      "--child",
      JSON.stringify(child),
      // Drive mode runs on the hosts this session captures, and on iOS only on the simulator named here (exact phase 3).
      "--hosts",
      capture.hosts.join(","),
      ...capture.sim ? ["--sim", capture.sim] : [],
      ...opts.bridgePort ? ["--bridge-port", opts.bridgePort] : [],
      ...opts.designPort ? ["--design-port", opts.designPort] : [],
      // A teammate through Exact's relay (exact phase 8): named in the environment, so the verb's startup stays as it is.
      ...relayArgs(process.env),
      ...ctx.json ? ["--json"] : []
    ], { what: "the live bridge" });
    return;
  }
  const options = syncOptions(opts);
  const max = opts.maxPasses === void 0 ? Number.POSITIVE_INFINITY : Number(opts.maxPasses);
  if (!(max >= 0)) throw new Error(`--max-passes takes a number, not ${opts.maxPasses}`);
  const quiet = opts.quietMs === void 0 ? 400 : Number(opts.quietMs);
  const say = (r, f, why) => {
    if (ctx.json) console.log(JSON.stringify({ why, ...r ? syncJson(r) : { screens: [] }, findings: { errors: f.errors, created: f.created, updated: f.updated, resolved: f.removed, moved: f.moved, checked: f.checked } }));
    else console.log(`${(/* @__PURE__ */ new Date()).toISOString().slice(11, 19)}  ${why}: ${r ? tally(r) : "screens wait for a build"}; ${findingsTally(f)}`);
  };
  const onePass = async (force) => {
    const diag = await bridge(host, "diagnose", ["--app", app], "the compiler's check", true);
    const broken = diag.diagnostics.some((d) => !d.severity || d.severity === "error");
    const r = broken ? null : await sync(host, ctx, canvas.id, app, { ...options, force });
    if (r) await postHostFindings(host, ctx, canvas.id, r.index.app, r.hostFindings, r.compared);
    const recaptured = (r?.screens ?? []).filter((x) => x.host === "web" && x.device === "phone" && x.scheme === "light" && x.status !== "skipped").map((x) => ({ route: x.route, url: x.url }));
    const f = await postFindings(host, ctx, canvas.id, app, diag, opts.checks === false ? [] : recaptured);
    return { r, f };
  };
  if (!ctx.json) console.error(`live on ${app}, on this machine \u2014 a pass now, then one per save (ctrl-c stops)`);
  const drives = new AbortController();
  void serveDrives(host, ctx, canvas.id, app, options, drives.signal, (line) => console.log(`${(/* @__PURE__ */ new Date()).toISOString().slice(11, 19)}  ${line}`));
  {
    const first = await onePass(options.force);
    say(first.r, first.f, "opened");
  }
  let passes = 0;
  if (passes >= max) {
    drives.abort();
    return;
  }
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
      drives.abort();
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
        const next = await onePass(false);
        say(next.r, next.f, `saved ${files.join(", ")}`);
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
async function serveDrives(host, ctx, canvasId, app, options, signal, say) {
  let since = (await ctx.client.snapshot(canvasId)).lastSeq;
  const appId = (await appOf(app)).id;
  while (!signal.aborted) {
    let entries;
    try {
      entries = await ctx.client.getLog(canvasId, since, 25e3);
    } catch {
      if (signal.aborted) return;
      await new Promise((r) => setTimeout(r, 2e3));
      continue;
    }
    if (entries.length === 0) continue;
    since = Math.max(since, ...entries.map((e) => e.seq));
    const snapshot = await ctx.client.snapshot(canvasId);
    for (const { item, request } of pendingDrives(entries, snapshot.canvas, appId)) {
      if (signal.aborted) return;
      say(`drive on ${request.host} (${item.title}): ${request.ops.at(-1) ?? "the screen as captured"}${request.by ? `, for ${request.by}` : ""}`);
      const answer = await answerDrive(host, ctx, canvasId, app, options, request);
      say(`drive on ${request.host}: ${answer.ok ? `a fresh screenshot in ${answer.ms} ms` : answer.error}`);
      await host.sendOp(ctx, canvasId, { type: "item.update", itemId: item.id, patch: { properties: { [core.EXACT_PROPS.driven]: JSON.stringify(answer) } } }, id3("exact-drive"));
    }
    for (const { item, request } of pendingFilms(entries, snapshot.canvas, appId)) {
      if (signal.aborted) return;
      say(`film on ${request.host} (${item.title}): ${request.ops.join(", ") || "the screen"}, ${request.over} ms every ${request.every}${request.by ? `, for ${request.by}` : ""}`);
      const answer = await answerFilm(host, ctx, canvasId, app, options, item, request);
      say(`film on ${request.host}: ${answer.ok ? `${answer.itemId}, sha256 ${answer.sha256}, in ${answer.ms} ms` : answer.error}`);
      await host.sendOp(ctx, canvasId, { type: "item.update", itemId: item.id, patch: { properties: { [core.EXACT_PROPS.filmed]: JSON.stringify(answer) } } }, id3("exact-film"));
    }
    const asks = pendingAsks(entries, snapshot, appId);
    for (const item of asks.runs) {
      if (signal.aborted) return;
      const answer = await answerRun(kit, host, ctx, canvasId, app, options.hosts, options.sim, item, say);
      if (answer) await host.sendOp(ctx, canvasId, { type: "item.update", itemId: item.id, patch: { properties: { [core.EXACT_PROPS.ran]: JSON.stringify(answer) } } }, id3("exact-run"));
    }
    for (const item of asks.verifies) {
      if (signal.aborted) return;
      const ask = parseVerifyAsk(item.properties?.[core.EXACT_PROPS.verify]);
      const started = Date.now();
      const answer = { seq: ask.seq, ok: true, hosts: {}, ms: 0 };
      for (const on of ask.hosts) {
        say(`verify on ${on}${ask.by ? `, for ${ask.by}` : ""}`);
        if (!options.hosts.includes(on) || on === "ios" && !options.sim) {
          answer.hosts[on] = { exit: null, problems: null, tests: null, posted: [], unmatched: [], error: `this \`isocan exact live\` runs on ${options.hosts.join(", ")}${on === "ios" ? " (iOS needs --sim <udid>)" : ""}` };
          continue;
        }
        try {
          answer.hosts[on] = await verifyOnHost(kit, host, ctx, canvasId, app, on, on === "ios" ? options.sim : null);
        } catch (err) {
          answer.hosts[on] = { exit: null, problems: null, tests: null, posted: [], unmatched: [], error: err.message };
        }
        const h = answer.hosts[on];
        say(`verify on ${on}: ${h.error ?? `exit ${h.exit}, ${h.problems ?? "?"} problems, ${h.posted.length} screens versioned, ${h.unmatched.length} shots not placed`}`);
      }
      answer.ms = Date.now() - started;
      answer.ok = Object.values(answer.hosts).every((h) => !h.error);
      await host.sendOp(ctx, canvasId, { type: "item.update", itemId: item.id, patch: { properties: { [core.EXACT_PROPS.verified]: JSON.stringify(answer) } } }, id3("exact-verify"));
    }
    for (const { item, ask, seq } of pendingRecords(entries, snapshot, appId)) {
      if (signal.aborted) return;
      say(`recording on ${ask.host} (${item.title}): ${ask.ops.join(", ")}${ask.by ? `, for ${ask.by}` : ""}`);
      const answer = await answerRecord(kit, host, ctx, canvasId, app, options.hosts, options.sim, item, ask, seq);
      say(`recording: ${answer.ok ? `proposed ${answer.itemId} with ${answer.expects.length} expect lines (${answer.expects.join("; ")})` : answer.error}`);
      await host.sendOp(ctx, canvasId, { type: "item.update", itemId: item.id, patch: { properties: { [core.EXACT_PROPS.recorded]: JSON.stringify(answer) } } }, id3("exact-record"));
    }
    await writeKept(host, ctx, canvasId, app, appId, entries, snapshot, say);
    for (const pending of pendingProposes(entries, snapshot, appId)) {
      if (signal.aborted) return;
      const words = pending.ask.ops.map((o) => o.op === "set-token" ? `${o.name}=${o.value}` : `${o.op} ${"style" in o && o.style ? `${o.style}.` : ""}${o.row}=${o.value}`).join(", ");
      say(`proposal from ${pending.actor.name} on ${pending.item.title}: ${words}`);
      const answer = await answerPropose(kit, host, ctx, canvasId, app, { hosts: options.hosts, sim: options.sim }, pending);
      say(`proposal: ${answer.ok ? `${answer.itemId} (${answer.class}, ${answer.previews} pictures, ${answer.client} at ${answer.scope}${answer.scopeCheck ? `; its accept refused ${answer.scopeCheck.status} needs ${answer.scopeCheck.needs}` : ""}) in ${answer.ms} ms` : answer.error}`);
      await host.sendOp(ctx, canvasId, { type: "item.update", itemId: pending.item.id, patch: { properties: { [core.EXACT_PROPS.proposed]: JSON.stringify(answer) } } }, id3("exact-propose"));
    }
    const settledSnapshot = await ctx.client.snapshot(canvasId);
    await settleKept(kit, host, ctx, canvasId, app, appId, entries, settledSnapshot, say);
    try {
      const { pendingLaneAsks, answerPrepare, answerShip } = await import("./ship-XC6N5YDU.mjs");
      const lane = pendingLaneAsks(entries, settledSnapshot, appId);
      for (const { item } of lane.prepares) {
        if (signal.aborted) return;
        const answer = await answerPrepare(kit, host, ctx, canvasId, app, item, say);
        if (answer) await host.sendOp(ctx, canvasId, { type: "item.update", itemId: item.id, patch: { properties: { [core.EXACT_PROPS.prepared]: JSON.stringify(answer) } } }, id3("exact-prepare"));
      }
      for (const { item, actor } of lane.ships) {
        if (signal.aborted) return;
        const answer = await answerShip(kit, host, ctx, canvasId, app, item, actor, say);
        if (answer) await host.sendOp(ctx, canvasId, { type: "item.update", itemId: item.id, patch: { properties: { [core.EXACT_PROPS.shipped]: JSON.stringify(answer) } } }, id3("exact-ship"));
      }
    } catch (err) {
      say(`the release lane: ${err.message}`);
    }
    for (const { item, request } of pendingInspects(entries, snapshot.canvas, appId)) {
      if (signal.aborted) return;
      say(`inspect on ${request.host} (${item.title})${request.by ? `, for ${request.by}` : ""}`);
      const answer = await answerInspect(host, ctx, canvasId, app, options, request);
      say(`inspect on ${request.host}: ${answer.ok ? `tree --ax, layout, perf and logs in ${answer.ms} ms` : answer.error}`);
      await host.sendOp(ctx, canvasId, { type: "item.update", itemId: item.id, patch: { properties: { [core.EXACT_PROPS.inspected]: JSON.stringify(answer) } } }, id3("exact-inspect"));
    }
  }
}
async function answerDrive(host, ctx, canvasId, app, options, request) {
  const refused = (error) => ({ seq: request.seq, ok: false, blobHash: null, points: null, results: [], ms: 0, error });
  if (!options.hosts.includes(request.host)) return refused(`this \`isocan exact live\` drives ${options.hosts.join(", ")} \u2014 start it with --hosts \u2026,${request.host}`);
  if (request.host === "ios" && !options.sim) return refused("this `isocan exact live` has no simulator of its own to drive iOS on: --sim <udid>");
  const dir = await fs3.mkdtemp(path3.join(os3.tmpdir(), "isocan-exact-drive-"));
  try {
    const job = path3.join(dir, "job.json");
    await fs3.writeFile(job, JSON.stringify({ host: request.host, size: request.size, scheme: request.scheme, shots: request.shots, ops: request.ops }));
    let r;
    try {
      const loop = process.env.ISOCAN_EXACT_LOOP;
      const joined = loop && /^http:\/\/127\.0\.0\.1:\d+$/.test(loop) && request.host !== "web" ? ["--dev-url", loop] : [];
      r = await bridge(host, "drive", ["--app", app, "--dir", dir, "--job", job, ...options.sim ? ["--sim", options.sim] : [], ...joined], "the drive", true);
    } catch (err) {
      return refused(err.message);
    }
    const blobHash = r.file ? (await ctx.client.uploadBlob(canvasId, await fs3.readFile(r.file), "image/png", "drive.png")).blobHash : null;
    return { seq: request.seq, ok: r.ok && !!blobHash, blobHash, points: r.points, results: r.results, ms: r.ms, ...r.error ? { error: r.error } : {} };
  } finally {
    await fs3.rm(dir, { recursive: true, force: true });
  }
}
async function screenFacts(host, app, start, sim) {
  const dir = await fs3.mkdtemp(path3.join(os3.tmpdir(), "isocan-exact-facts-"));
  try {
    const job = path3.join(dir, "job.json");
    await fs3.writeFile(job, JSON.stringify(start));
    const loop = process.env.ISOCAN_EXACT_LOOP;
    const joined = loop && /^http:\/\/127\.0\.0\.1:\d+$/.test(loop) && start.host !== "web" ? ["--dev-url", loop] : [];
    return await bridge(host, "facts", ["--app", app, "--job", job, ...sim ? ["--sim", sim] : [], ...joined], "the inspection", true);
  } finally {
    await fs3.rm(dir, { recursive: true, force: true });
  }
}
async function answerInspect(host, ctx, canvasId, app, options, request) {
  const refused = (error) => ({ seq: request.seq, ok: false, blobHash: null, ms: 0, error });
  if (!options.hosts.includes(request.host)) return refused(`this \`isocan exact live\` inspects ${options.hosts.join(", ")} \u2014 start it with --hosts \u2026,${request.host}`);
  if (request.host === "ios" && !options.sim) return refused("this `isocan exact live` has no simulator of its own to inspect iOS on: --sim <udid>");
  let facts;
  try {
    facts = await screenFacts(host, app, { host: request.host, size: request.size, scheme: request.scheme, shots: request.shots }, options.sim);
  } catch (err) {
    return refused(err.message);
  }
  const blobHash = (await ctx.client.uploadBlob(canvasId, Buffer.from(JSON.stringify(facts), "utf8"), "application/json", "inspect.json")).blobHash;
  return { seq: request.seq, ok: facts.ok, blobHash, ms: facts.ms, ...facts.error ? { error: facts.error } : {} };
}
function startScreen(snapshot, appId, route, where) {
  const screen = core.screenItemOf(snapshot.canvas, appId, route, where.device, where.scheme, where.host);
  const primary = core.screenItemOf(snapshot.canvas, appId, route);
  const found = screen ?? primary;
  if (!found) throw new Error(`no screen of ${route} for ${appId} on this canvas \u2014 \`isocan exact open <app>\` lays the routes out first (\`--hosts ${where.host}\` for ${where.host})`);
  const text = screen?.properties?.[core.EXACT_PROPS.shots] ?? screen?.properties?.[core.EXACT_PROPS.reached] ?? primary?.properties?.[core.EXACT_PROPS.shots] ?? primary?.properties?.[core.EXACT_PROPS.reached] ?? `at "${found.properties?.[core.EXACT_PROPS.url] ?? "/"}"`;
  const shots = shotsText(parseShots(text));
  return { screen: found, shots };
}
function whereOf(opts) {
  const [on] = parseHosts(opts.host ?? "web");
  const host = on ?? "web";
  if (opts.host && opts.host.includes(",")) throw new Error("--host takes one host");
  const device = host === "web" ? listOf(opts.device ?? "phone", DEVICE_NAMES, "device")[0] : NATIVE_DEVICE[host];
  const scheme = listOf(opts.scheme ?? "light", SCHEMES, "scheme")[0];
  const sim = opts.sim ?? null;
  if (sim !== null && !UDID.test(sim)) throw new Error(`--sim takes a simulator's UDID, not ${JSON.stringify(sim)}`);
  if (host === "ios" && !sim) throw new Error("iOS runs on a simulator of your own, by UDID: --sim <udid> (never a booted one somebody else may own)");
  return { host, device, scheme, sim };
}
async function film(host, given, route, opts, cmd) {
  const ctx = await host.ctxOf(cmd);
  const app = appDir(given);
  const canvas = await host.resolveCanvas(ctx);
  const where = whereOf(opts);
  const over = Number(opts.over ?? 600), every = Number(opts.every ?? 16);
  if (!Number.isInteger(over) || !Number.isInteger(every) || over < 0 || every < 1) throw new Error("--over and --every take whole milliseconds (every \u2265 1)");
  const ops = opts.do ?? [];
  const appInfo = await appOf(app);
  const snapshot = await ctx.client.snapshot(canvas.id);
  const { screen, shots } = startScreen(snapshot, appInfo.id, route, where);
  const size = where.host === "ios" ? "390x844" : jobSize(where.device);
  const watch2 = opts.watch ?? null;
  if (!ctx.json) console.error(`filming ${route} on ${where.host} after ${ops.join(", ") || "nothing"}: ${over} ms every ${every} ms, on the virtual clock\u2026`);
  const made = await makeFilm(host, ctx, canvas.id, app, appInfo, screen, { route, device: where.device }, { host: where.host, size, scheme: where.scheme, shots, ops, over, every, watch: watch2 }, where.sim, opts.out);
  const { r, facts, posted } = made;
  const out = { itemId: posted.itemId, status: posted.status, title: filmTitle(facts), sha256: r.sha256, bytes: r.bytes, frames: facts.steps, at: facts.at, every, over, route, host: where.host, ops, watch: watch2, states: r.states.length, ...r.stateError ? { stateError: r.stateError } : {}, ms: r.ms, ...opts.out ? { out: path3.resolve(opts.out) } : {} };
  if (ctx.json) return host.printJson(out);
  console.log(`${out.title}: ${posted.status} (${posted.itemId})`);
  console.log(`  ${facts.steps} frames at ${facts.at.slice(0, 3).join(", ")}${facts.steps > 3 ? ` \u2026 ${facts.at.at(-1)}` : ""} ms \xB7 sha256 ${r.sha256}${opts.out ? ` \xB7 written to ${out.out}` : ""}`);
  console.log(`  state at every frame${watch2 ? ` and ${watch2}'s layout` : ""} in exact.frames${r.stateError ? ` \u2014 but ${r.stateError}` : ""}; film ${r.ms.film} ms, state ${r.ms.state} ms`);
}
async function makeFilm(host, ctx, canvasId, app, appInfo, screen, where, job, sim, outFile) {
  const dir = await fs3.mkdtemp(path3.join(os3.tmpdir(), "isocan-exact-film-"));
  try {
    const jobFile = path3.join(dir, "job.json");
    await fs3.writeFile(jobFile, JSON.stringify(job));
    const loop = process.env.ISOCAN_EXACT_LOOP;
    const joined = loop && /^http:\/\/127\.0\.0\.1:\d+$/.test(loop) && job.host !== "web" ? ["--dev-url", loop] : [];
    const r = await bridge(host, "film", ["--app", app, "--dir", dir, "--job", jobFile, ...sim ? ["--sim", sim] : [], ...joined], "the film", true);
    if (!r.ok || !r.file) throw new Error(`the film did not finish: ${r.error ?? "no file"}`);
    const bytes = await fs3.readFile(r.file);
    if (outFile) await fs3.writeFile(path3.resolve(outFile), bytes);
    const key = sha2562(filmKeyText({ app: appInfo.id, route: where.route, host: job.host, device: where.device, scheme: job.scheme, shots: job.shots, ops: job.ops, over: job.over, every: job.every, watch: job.watch }));
    const snapshot = await ctx.client.snapshot(canvasId);
    const land = landFilm(Object.values(snapshot.canvas.items), { app: core.EXACT_PROPS.app, film: core.EXACT_PROPS.film, frames: core.EXACT_PROPS.frames }, appInfo, screen, where, job, r, key);
    const existing = land.existing ? snapshot.canvas.items[land.existing.id] ?? null : null;
    const posted = await upsert(host, ctx, canvasId, snapshot, existing, { bytes, mime: "image/png", filename: `${where.route}-film.apng` }, { title: land.title, width: land.width, height: land.height, at: land.at, properties: land.properties }, id3("exact-film"));
    return { r, facts: land.facts, posted };
  } finally {
    await fs3.rm(dir, { recursive: true, force: true });
  }
}
async function answerFilm(host, ctx, canvasId, app, options, item, request) {
  const refused = (error) => ({ seq: request.seq, ok: false, itemId: null, sha256: null, ms: 0, error });
  if (!options.hosts.includes(request.host)) return refused(`this \`isocan exact live\` films ${options.hosts.join(", ")} \u2014 start it with --hosts \u2026,${request.host}`);
  if (request.host === "ios" && !options.sim) return refused("this `isocan exact live` has no simulator of its own to film iOS on: --sim <udid>");
  const route = item.properties?.[core.EXACT_PROPS.route];
  if (!route) return refused("only an Exact screen can be filmed");
  const started = Date.now();
  try {
    const { seq: _seq, by: _by, ...job } = request;
    const made = await makeFilm(host, ctx, canvasId, app, await appOf(app), item, { route, device: item.properties?.[core.EXACT_PROPS.device] ?? "phone" }, job, options.sim);
    return { seq: request.seq, ok: true, itemId: made.posted.itemId, sha256: made.r.sha256, ms: Date.now() - started };
  } catch (err) {
    return refused(err.message);
  }
}
async function inspect(host, given, route, opts, cmd) {
  const ctx = await host.ctxOf(cmd);
  const app = appDir(given);
  const canvas = await host.resolveCanvas(ctx);
  const where = whereOf(opts);
  const appInfo = await appOf(app);
  const snapshot = await ctx.client.snapshot(canvas.id);
  const { screen, shots } = startScreen(snapshot, appInfo.id, route, where);
  const size = where.host === "ios" ? "390x844" : jobSize(where.device);
  const facts = await screenFacts(host, app, { host: where.host, size, scheme: where.scheme, shots }, where.sim);
  if (ctx.json) return host.printJson({ screen: screen.id, ...facts });
  if (!facts.ok) throw new Error(`the inspection did not finish: ${facts.error ?? "no tree"}`);
  const elements = facts.ax?.ax?.elements ?? [];
  console.log(`${screen.title} on ${where.host} (${shots.split("\n").join("; ")}), ${facts.ms} ms`);
  console.log(`  tree --ax  ${elements.length} elements (${facts.ax?.ax?.source ?? "?"}); interactive: ${elements.filter((e) => e.interactive).map((e) => e.testId ?? e.name).filter(Boolean).join(", ") || "none"}`);
  console.log(`  layout     ${facts.layout?.nodes?.length ?? 0} nodes`);
  console.log(`  perf       ${facts.perf?.walked ?? "?"} walked; resources ${(facts.perf?.resources ?? []).map((x) => `${x.name}\xD7${x.asked}`).join(", ") || "none"}`);
  console.log(`  logs       ${(facts.logs?.lines ?? []).length} lines${(facts.logs?.lines ?? []).length ? `, last: ${facts.logs.lines.at(-1)}` : ""}`);
  console.log(`  the same tree: bun exact.mjs ${facts.command.map((a) => /\s/.test(a) ? JSON.stringify(a) : a).join(" ")}`);
}
async function moment(host, ref, ms, words, cmd) {
  const ctx = await host.ctxOf(cmd);
  const canvas = await host.resolveCanvas(ctx);
  const snapshot = await ctx.client.snapshot(canvas.id);
  const item = host.resolveItem(snapshot, ref);
  const facts = parseFilm(item.properties?.[core.EXACT_PROPS.film]);
  if (!facts) throw new Error(`${item.title} is not an Exact film \u2014 \`isocan exact film <app> <route>\` makes one`);
  const at = Number(ms);
  const min = facts.at[0] ?? facts.from, max = facts.at.at(-1) ?? min;
  if (!Number.isFinite(at) || at < min || at > max) throw new Error(`the film runs ${min}\u2013${max} ms; ${ms} is not on it`);
  const body = words.join(" ").trim();
  if (!body) throw new Error("say something: isocan exact moment <film> <ms> <words\u2026>");
  const threadId = id3("thr");
  const x = Math.round((at - min) / Math.max(1, max - min) * (item.width - 24)) + 12;
  await host.sendOp(ctx, canvas.id, { type: "thread.create", threadId, x, y: Math.round(item.height - 24), anchorItemId: item.id, comment: { id: id3("cmt"), body, at: Math.round(at) / 1e3 } }, id3("exact-moment"));
  if (ctx.json) return host.printJson({ threadId, itemId: item.id, at: Math.round(at) / 1e3, ms: Math.round(at) });
  console.log(`commented on ${item.title} at ${Math.round(at)} ms (${threadId})`);
}
var kit = { bridge, upsert, appOf };
async function runTest(host, given, test, opts, cmd) {
  const ctx = await host.ctxOf(cmd);
  const app = appDir(given);
  const canvas = await host.resolveCanvas(ctx);
  const hosts = parseHosts(opts.hosts);
  const sim = opts.sim ?? null;
  if (sim !== null && !UDID.test(sim)) throw new Error(`--sim takes a simulator's UDID, not ${JSON.stringify(sim)}`);
  if (hosts.includes("ios") && !sim) throw new Error("iOS runs on a simulator of your own, by UDID: --sim <udid> (never a booted one somebody else may own)");
  const info = await appOf(app);
  const snapshot = await ctx.client.snapshot(canvas.id);
  const stories = Object.values(snapshot.canvas.items).filter((i) => core.appIdOf(i) === info.id && i.properties?.[core.EXACT_PROPS.test] === test && (!opts.file || i.properties?.[core.EXACT_PROPS.testFile] === opts.file));
  if (stories.length === 0) throw new Error(`no storyboard of a test named "${test}" for ${info.name} on this canvas \u2014 \`isocan exact open <app>\` posts one per test`);
  if (stories.length > 1) throw new Error(`"${test}" is a test in ${stories.map((s) => s.properties?.[core.EXACT_PROPS.testFile]).join(" and ")} \u2014 name one with --file`);
  const item = storyItemOf(snapshot, info.id, stories[0].properties[core.EXACT_PROPS.testFile], test);
  const out = [];
  for (const on of hosts) {
    if (!ctx.json) console.error(`running "${test}" on ${on} with Exact's own test runner\u2026`);
    const { report, status } = await runOnHost(kit, host, ctx, canvas.id, app, item, on, on === "ios" ? sim : null);
    out.push({ ...report, status });
    if (!ctx.json) console.log(runLine(report));
  }
  if (ctx.json) return host.printJson({ itemId: item.id, test, file: item.properties?.[core.EXACT_PROPS.testFile], runs: out.map((r) => ({ host: r.host, verdict: r.verdict, said: r.said, failed: r.failed ? { line: r.failed.line, reason: r.failed.reason, tree: r.failed.tree?.length ?? 0, reply: r.failed.reply } : null, steps: r.steps.map((s) => ({ line: s.line, state: s.state })), version: r.status, ms: r.ms })) });
  console.log(`${item.id}  storyboard of test "${test}": ${out.length} run${out.length === 1 ? "" : "s"} kept as versions`);
}
async function verifyApp(host, given, opts, cmd) {
  const ctx = await host.ctxOf(cmd);
  const app = appDir(given);
  const canvas = await host.resolveCanvas(ctx);
  const hosts = parseHosts(opts.hosts ?? "web");
  const sim = opts.sim ?? null;
  if (sim !== null && !UDID.test(sim)) throw new Error(`--sim takes a simulator's UDID, not ${JSON.stringify(sim)}`);
  if (hosts.includes("ios") && !sim) throw new Error("iOS verifies on a simulator of your own, by UDID: --sim <udid>");
  const out = {};
  for (const on of hosts) {
    if (on === "macos") {
      out[on] = { exit: null, problems: null, tests: null, posted: [], unmatched: [], error: 'Exact\'s verify has no macOS leg (`bun exact.mjs verify macos`: "verify has no leg for it"); run the storyboards there instead' };
      continue;
    }
    if (!ctx.json) console.error(`verify on ${on}, with Exact's own verify\u2026`);
    out[on] = await verifyOnHost(kit, host, ctx, canvas.id, app, on, on === "ios" ? sim : null);
  }
  if (ctx.json) return host.printJson({ hosts: out });
  for (const [on, h] of Object.entries(out)) {
    if (h.error) {
      console.log(`${on.padEnd(6)} ${h.error}`);
      continue;
    }
    console.log(`${on.padEnd(6)} verify exit ${h.exit}, ${h.problems ?? "?"} problems; tests ${h.tests ? `${h.tests.passed} passed, ${h.tests.failed} failed` : "none"}`);
    for (const f of h.tests?.failing ?? []) console.log(`  failing: ${f}`);
    for (const p of h.posted) console.log(`  ${p.itemId}  ${p.shot} (${p.status})`);
    for (const u of h.unmatched) console.log(`  not placed: ${u.shot} \u2014 ${u.why}`);
  }
}
async function propose(host, ref, opts, cmd) {
  return proposeVerb(host, ref, opts, cmd);
}
async function branch(host, given, ref, opts, cmd) {
  const { branchVerb } = await import("./branch-ATRRUCCW.mjs");
  return branchVerb(kit, host, given, ref, opts, cmd);
}
async function prepare(host, given, opts, cmd) {
  const { prepareVerb } = await import("./ship-XC6N5YDU.mjs");
  return prepareVerb(kit, host, given, opts, cmd, appDir(given));
}
async function ship(host, kind, given, opts, cmd) {
  const { shipVerb } = await import("./ship-XC6N5YDU.mjs");
  return shipVerb(kit, host, kind, given, opts, cmd, appDir(given));
}
export {
  PROVEN,
  bindCore,
  branch,
  check,
  doctor,
  film,
  inspect,
  live,
  moment,
  open,
  prepare,
  propose,
  relayArgs,
  runTest,
  ship,
  verifyApp,
  wall
};
