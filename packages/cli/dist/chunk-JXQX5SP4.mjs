import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  dropOnWire,
  postProposalItem
} from "./chunk-QWZHH6EQ.mjs";
import {
  DEVICES
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

// packages/modules/exact/src/systems.ts
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

// packages/modules/exact/src/system.ts
function parseSystem(text) {
  if (!text) return null;
  try {
    const v = JSON.parse(text);
    return v && v.from && typeof v.from.id === "string" && Array.isArray(v.tokens) && Array.isArray(v.styles) ? v : null;
  } catch {
    return null;
  }
}
function leafCss(leaf) {
  if (!leaf) return "";
  const v = leaf.$value;
  if (typeof v === "number" || typeof v === "string") return String(v);
  if (leaf.$type === "color" && v && Array.isArray(v.components)) {
    const c = v.components.map((n) => +n.toFixed(4));
    const alpha = typeof v.alpha === "number" && v.alpha < 1 ? ` / ${+v.alpha.toFixed(3)}` : "";
    if (v.colorSpace === "oklch") return `oklch(${c.join(" ")}${alpha})`;
    if (typeof v.hex === "string") return alpha ? `${v.hex}${Math.round(v.alpha * 255).toString(16).padStart(2, "0")}` : v.hex;
    return `color(${String(v.colorSpace)} ${c.join(" ")}${alpha})`;
  }
  if (leaf.$type === "dimension" && v && typeof v.value === "number") return `${v.value}${String(v.unit ?? "px")}`;
  if (leaf.$type === "shadow") return `a shadow of ${Array.isArray(v) ? v.length : 1} layer${Array.isArray(v) && v.length !== 1 ? "s" : ""}`;
  return JSON.stringify(v).slice(0, 80);
}
var kindOf = (k) => k === "color" ? "color" : k;
function mapTokens(system, target, named = {}) {
  const byName = new Map(target.map((t) => [t.name, t]));
  const used = /* @__PURE__ */ new Set();
  const rows = system.map((s) => {
    const pick = named[s.name];
    if (pick !== void 0) {
      const t2 = byName.get(pick);
      if (!pick) return { from: s.name, kind: s.kind, to: null, how: null, why: "left out by a person" };
      if (!t2) return { from: s.name, kind: s.kind, to: null, how: null, why: `the target has no token ${pick}` };
      if (kindOf(t2.kind) !== kindOf(s.kind)) return { from: s.name, kind: s.kind, to: null, how: null, why: `${pick} is a ${t2.kind}, not a ${s.kind}` };
      if (used.has(t2.name)) return { from: s.name, kind: s.kind, to: null, how: null, why: `${pick} is already reached by another token` };
      used.add(t2.name);
      return { from: s.name, kind: s.kind, to: t2.name, how: "named by a person", why: null };
    }
    const t = byName.get(s.name);
    if (t && kindOf(t.kind) === kindOf(s.kind) && !used.has(t.name) && !Object.values(named).includes(t.name)) {
      used.add(t.name);
      return { from: s.name, kind: s.kind, to: t.name, how: "same name", why: null };
    }
    if (t) return { from: s.name, kind: s.kind, to: null, how: null, why: `the target's ${s.name} is a ${t.kind}` };
    return { from: s.name, kind: s.kind, to: null, how: null, why: "no token of that name in the target; name one with src=dst" };
  });
  return { rows, untouched: target.map((t) => t.name).filter((n) => !used.has(n)) };
}
function parseMaps(list) {
  const out = {};
  for (const one of list) {
    const m = /^([A-Za-z_-][A-Za-z0-9_.-]*)=([A-Za-z_-][A-Za-z0-9_.-]*)?$/.exec(one.trim());
    if (!m) throw new Error(`--map takes source=target (a token of the system, a token of the app), not ${JSON.stringify(one)}`);
    out[m[1]] = m[2] ?? "";
  }
  return out;
}
function dtcgFor(system, mapping) {
  const contexts = { light: {}, dark: {} };
  const put = (tree, name, leaf) => {
    const segs = name.split(".");
    let t = tree;
    for (const s of segs.slice(0, -1)) t = t[s] ??= {};
    t[segs.at(-1)] = leaf;
  };
  const byName = new Map(system.tokens.map((t) => [t.name, t]));
  for (const row of mapping.rows) {
    if (!row.to) continue;
    const t = byName.get(row.from);
    if (!t) continue;
    for (const s of ["light", "dark"]) {
      const leaf = t[s] ?? t.light;
      if (leaf) put(contexts[s], row.to, leaf);
    }
  }
  const doc = {
    name: `${system.from.name} for the target`,
    version: "2025.10",
    sets: { exact: { sources: [{}] } },
    modifiers: { mode: { contexts: { light: [contexts.light], dark: [contexts.dark] }, default: "light" } },
    resolutionOrder: [{ $ref: "#/sets/exact" }, { $ref: "#/modifiers/mode" }]
  };
  return `${JSON.stringify(doc, null, 2)}
`;
}
function parseApplyAsk(text) {
  if (!text) return null;
  try {
    const v = JSON.parse(text);
    if (!Number.isFinite(v?.seq) || typeof v.app !== "string" || !v.app) return null;
    const map = v.map && typeof v.map === "object" ? Object.fromEntries(Object.entries(v.map).filter(([k, x]) => typeof k === "string" && typeof x === "string").slice(0, 64)) : {};
    return { seq: v.seq, by: typeof v.by === "string" ? v.by : null, app: v.app, map };
  } catch {
    return null;
  }
}
function parseApplyAnswer(text) {
  if (!text) return null;
  try {
    const v = JSON.parse(text);
    return Number.isFinite(v?.seq) ? v : null;
  } catch {
    return null;
  }
}
function stylesNote(styles) {
  if (styles.length === 0) return null;
  return `Not carried: the named style${styles.length === 1 ? "" : "s"} ${styles.map((s) => s.name).join(", ")}. Exact's held import (\`forma import dtcg\`) holds tokens only, so a style's rows (a translucent background, a hairline border, a material) stay in ${styles[0].file} of the source app; nothing writes them into the target.`;
}
function mappingMarkdown(system, target, mapping) {
  const byName = new Map(system.tokens.map((t) => [t.name, t]));
  const rows = mapping.rows.map((r) => {
    const t = byName.get(r.from);
    const value = t ? t.kind === "color" ? `${leafCss(t.light)} / ${leafCss(t.dark)}` : leafCss(t.light) : "";
    return `| \`${r.from}\` | ${r.kind} | ${r.to ? `\`${r.to}\`` : "\u2014"} | ${r.to ? r.how : `no match: ${r.why}`} | ${value} |`;
  });
  const mapped = mapping.rows.filter((r) => r.to).length;
  const note = stylesNote(system.styles);
  return [
    `# ${system.from.name} \u2192 ${target.name}`,
    "",
    `The design system extracted from ${system.from.name} (\`${system.from.id}\`, design digest \`${system.digest}\`), mapped onto ${target.name}'s tokens. ${mapped} of ${mapping.rows.length} tokens have a match; only those are sent, as Exact's held import, and arrive as a proposal. Nothing is written until a person keeps it.`,
    "",
    "| Source token | Kind | Becomes | How | Value (light / dark) |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
    "",
    mapping.untouched.length ? `Kept as they are in ${target.name} (no source token reaches them): ${mapping.untouched.map((n) => `\`${n}\``).join(", ")}.` : `Every token of ${target.name} is reached.`,
    ...note ? ["", note] : [],
    ""
  ].join("\n");
}
function systemRows(system) {
  return system.tokens.map((t) => `| \`${t.name}\` | ${t.kind} | ${leafCss(t.light) || t.source} | ${t.kind === "color" ? leafCss(t.dark) : ""} | ${system.edited?.[t.name] ? `edited by ${system.edited[t.name].by}` : "as extracted"} |`);
}

// packages/modules/exact/src/systems.ts
var id = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
var P = () => core.EXACT_PROPS;
var LOOP = /^http:\/\/127\.0\.0\.1:\d+$/;
function systemMarkdown(system) {
  const colors = {};
  const spacing = {};
  for (const t of system.tokens) {
    const hex = t.light?.$value?.hex;
    if (t.kind === "color" && typeof hex === "string" && /^#[0-9a-f]{6}$/i.test(hex)) colors[t.name] = hex.toLowerCase();
    else if (t.kind === "length" && /^\d+(\.\d+)?px$/.test(leafCss(t.light))) spacing[t.name] = leafCss(t.light);
  }
  const tokens = {
    name: `${system.from.name} design system`,
    description: `Extracted from the Exact app ${system.from.id} (${system.from.dir}) by \`forma ir\` and \`forma export dtcg\`, design digest ${system.digest}. It belongs to no app: Apply sends it to one as Exact's held import.`,
    ...Object.keys(colors).length ? { colors } : {},
    ...Object.keys(spacing).length ? { spacing } : {}
  };
  const styles = system.styles.map((s) => `- **${s.name}** (${s.file}:${s.line}): ${s.rows.map((r) => `${r.row}=${r.value}`).join(", ")}`);
  const note = stylesNote(system.styles);
  const body = [
    "## Overview",
    "",
    `The tokens of ${system.from.name}'s design, per scheme, and its named styles. Drag a chip to change a value here; Apply maps it onto another app's tokens and holds it there as a proposal.`,
    "",
    "## Colors",
    "",
    "| Token | Kind | Light | Dark | State |",
    "| --- | --- | --- | --- | --- |",
    ...systemRows(system),
    ...styles.length ? ["", "## Styles", "", ...styles, ...note ? ["", note] : []] : []
  ].join("\n");
  return serializeDesign(tokens, body);
}
function systemItems(snapshot) {
  return Object.values(snapshot.canvas.items).filter((i) => parseSystem(i.properties?.[P().system]) !== null);
}
async function extractVerb(kit, host, app, cmd) {
  const ctx = await host.ctxOf(cmd);
  const canvas = await host.resolveCanvas(ctx);
  const read = await kit.bridge(host, "system-extract", ["--app", app], "the design system's extract", ctx.json);
  const system = { from: read.from, digest: read.digest, tokens: read.tokens, styles: read.styles, at: (/* @__PURE__ */ new Date()).toISOString() };
  const snapshot = await ctx.client.snapshot(canvas.id);
  const existing = systemItems(snapshot).find((i) => parseSystem(i.properties?.[P().system])?.from.id === system.from.id) ?? null;
  const items = Object.values(snapshot.canvas.items);
  const at = existing ? { x: existing.x, y: existing.y } : items.length ? { x: Math.round(Math.max(...items.map((i) => i.x + i.width)) + 400), y: Math.round(Math.min(...items.map((i) => i.y))) } : { x: 0, y: 0 };
  const md = systemMarkdown(system);
  const properties = { ...designSystemProperties(), [P().system]: JSON.stringify(system) };
  const r = await kit.upsert(
    host,
    ctx,
    canvas.id,
    snapshot,
    existing,
    { bytes: Buffer.from(md), mime: "text/markdown", filename: `${system.from.dir}-system.md` },
    { title: `${system.from.name} \u2014 design system`, width: 560, height: 520, properties, at },
    id("exact-system")
  );
  if (ctx.json) return host.printJson({ itemId: r.itemId, status: r.status, from: system.from, digest: system.digest, tokens: system.tokens.length, styles: system.styles.map((s) => s.name), notes: read.notes ?? [] });
  console.log(`${r.itemId}  design system from ${system.from.name} (${r.status}): ${system.tokens.length} tokens, digest ${system.digest}${system.styles.length ? `; styles ${system.styles.map((s) => s.name).join(", ")} (shown, not carried by Exact's held import)` : ""}`);
  for (const n of read.notes ?? []) console.log(`  note: ${n}`);
}
function targetOf(snapshot, appId) {
  const index = core.indexItemOf(snapshot.canvas, appId);
  const raw = index?.properties?.[P().summary];
  const design = index ? (() => {
    try {
      return JSON.parse(raw ?? "null");
    } catch {
      return null;
    }
  })() : null;
  const tokens = targetTokens(snapshot, appId);
  if (!index || !tokens) return null;
  return { id: appId, name: design?.name ?? index.title, tokens };
}
function targetTokens(snapshot, appId) {
  const item = core.designItemOf(snapshot.canvas, appId);
  if (!item) return null;
  return designTokensCache.get(item.currentVersionId ?? "") ?? null;
}
var designTokensCache = /* @__PURE__ */ new Map();
async function loadTargetTokens(ctx, canvasId, snapshot, appId) {
  const item = core.designItemOf(snapshot.canvas, appId);
  const version = item?.versions.find((v) => v.id === item.currentVersionId) ?? item?.versions.at(-1);
  if (!item || !version || designTokensCache.has(item.currentVersionId ?? "")) return;
  const text = Buffer.from(await ctx.client.downloadBlob(canvasId, version.blobHash)).toString("utf8");
  const list = [];
  for (const line of text.split("\n")) {
    const m = /^\| `([^`]+)` \| ([a-z-]+) \|/.exec(line);
    if (m) list.push({ name: m[1], kind: m[2] });
  }
  designTokensCache.set(item.currentVersionId ?? "", list);
}
async function applyVerb(kit, host, ref, app, opts, cmd) {
  const ctx = await host.ctxOf(cmd);
  const canvas = await host.resolveCanvas(ctx);
  const snapshot = await ctx.client.snapshot(canvas.id);
  const item = host.resolveItem(snapshot, ref);
  const system = parseSystem(item.properties?.[P().system]);
  if (!system) throw new Error(`${item.title} is not a design system \`isocan exact system extract\` made (it carries exact.system)`);
  const info = await kit.appOf(app);
  if (info.id === system.from.id) throw new Error(`${item.title} came from ${info.name}: apply it to another app`);
  await loadTargetTokens(ctx, canvas.id, snapshot, info.id);
  const target = targetOf(snapshot, info.id);
  if (!target) throw new Error(`${info.name} is not on this canvas with its design \u2014 \`isocan exact open ${app}\` first`);
  const map = parseMaps(opts.map ?? []);
  const mapping = mapTokens(system.tokens, target.tokens, map);
  if (!ctx.json) {
    console.error(`${system.from.name} \u2192 ${info.name}:`);
    for (const r of mapping.rows) console.error(`  ${r.from.padEnd(18)} ${r.to ? `\u2192 ${r.to} (${r.how})` : `no match: ${r.why}`}`);
    if (mapping.untouched.length) console.error(`  kept in ${info.name}: ${mapping.untouched.join(", ")}`);
    const note = stylesNote(system.styles);
    if (note) console.error(`  ${note}`);
  }
  if (!mapping.rows.some((r) => r.to)) throw new Error("no token of the system has a match in the app: name some with --map source=target");
  const seq = Date.now();
  const ask = { seq, by: ctx.actor.name, app: info.id, map };
  await host.sendOp(ctx, canvas.id, { type: "item.update", itemId: item.id, patch: { properties: { [P().apply]: JSON.stringify(ask) } } }, id("exact-apply"));
  const wait = opts.wait === void 0 ? 600 : Number(opts.wait);
  if (!(wait >= 0)) throw new Error(`--wait takes seconds, not ${opts.wait}`);
  if (wait === 0) {
    if (ctx.json) return host.printJson({ asked: { system: item.id, app: info.id, seq }, mapping });
    console.log(`asked on ${item.title} \u2014 \`isocan exact live ${app}\` posts the mapping card, holds Exact's import and pictures it; read exact.applied there`);
    return;
  }
  if (!ctx.json) console.error(`waiting for \`isocan exact live\` on ${info.name} to hold the import and picture it on every device\u2026`);
  const deadline = Date.now() + wait * 1e3;
  for (; ; ) {
    const now = await ctx.client.snapshot(canvas.id);
    const answer = parseApplyAnswer(now.canvas.items[item.id]?.properties?.[P().applied]);
    if (answer && answer.seq === seq) {
      if (ctx.json) return host.printJson({ ...answer, mapping });
      if (!answer.ok) throw new Error(`not applied: ${answer.error}${answer.card ? ` (the mapping card is ${answer.card})` : ""}`);
      console.log(`${answer.card}  the mapping card: ${answer.mapped} tokens mapped, ${answer.unmatched.length} without a match`);
      console.log(`${answer.itemId}  proposed as Exact's held import ${answer.proposal} (${answer.class}, ${answer.previews} pictures) \u2014 a person's Keep writes it; nothing is written until then`);
      return;
    }
    if (Date.now() > deadline) throw new Error(`no answer in ${wait} s \u2014 is \`isocan exact live ${app}\` running for this canvas, without --no-frames? The ask stays on the system item`);
    await new Promise((r) => setTimeout(r, 2e3));
  }
}
function pendingApplies(entries, snapshot, appId) {
  const out = /* @__PURE__ */ new Map();
  for (const e of entries) {
    const op = e.envelope.op;
    if (op.type !== "item.update" || !op.itemId || !op.patch?.properties || !(P().apply in op.patch.properties)) continue;
    const item = snapshot.canvas.items[op.itemId];
    if (!item || !parseSystem(item.properties?.[P().system])) continue;
    const ask = parseApplyAsk(item.properties?.[P().apply]);
    const answered = parseApplyAnswer(item.properties?.[P().applied]);
    if (ask && ask.app === appId && (!answered || answered.seq < ask.seq)) out.set(item.id, { item, ask, seq: e.seq, actor: e.envelope.actor });
  }
  return [...out.values()];
}
function screenFor(snapshot, appId, uses) {
  const screens = Object.values(snapshot.canvas.items).filter((i) => core.appIdOf(i) === appId && i.properties?.[P().route] && !i.properties?.[P().branch] && (i.properties?.[P().host] ?? "web") === "web" && (i.properties?.[P().device] ?? "phone") === "phone" && (i.properties?.[P().scheme] ?? "light") === "light");
  const lines = new Set(uses.map((u) => `${u.file}:${u.line}`));
  const score = (i) => (core.parsePoints(i.properties?.[P().points])?.nodes ?? []).filter((n) => lines.has(`${n.file}:${n.line}`) || n.chain.some((c) => lines.has(`${c.file}:${c.line}`))).length;
  return screens.sort((a, b) => score(b) - score(a) || a.y - b.y || a.x - b.x)[0] ?? null;
}
async function answerApply(kit, host, ctx, canvasId, app, opts, pending) {
  const { item, ask, seq: askSeq, actor } = pending;
  const started = Date.now();
  const system = parseSystem(item.properties?.[P().system]);
  const answer = (a) => ({ seq: ask.seq, ok: false, app: ask.app, card: null, itemId: null, proposal: null, class: null, mapped: 0, unmatched: [], reported: [], styles: system.styles.map((s) => s.name), previews: 0, ms: Date.now() - started, ...a });
  let snapshot = await ctx.client.snapshot(canvasId);
  await loadTargetTokens(ctx, canvasId, snapshot, ask.app);
  const target = targetOf(snapshot, ask.app);
  if (!target) return answer({ error: "the app's design is not on this canvas: `isocan exact open` it first" });
  const mapping = mapTokens(system.tokens, target.tokens, ask.map);
  const unmatched = mapping.rows.filter((r) => !r.to).map((r) => r.from);
  const mapped = mapping.rows.filter((r) => r.to).length;
  const md = mappingMarkdown(system, target, mapping);
  const existingCard = Object.values(snapshot.canvas.items).find((i) => {
    try {
      const m = JSON.parse(i.properties?.[P().mapping] ?? "null");
      return m?.system === item.id && m.app === ask.app;
    } catch {
      return false;
    }
  }) ?? null;
  const card = await kit.upsert(
    host,
    ctx,
    canvasId,
    snapshot,
    existingCard,
    { bytes: Buffer.from(md), mime: "text/markdown", filename: `${system.from.dir}-to-${target.id}.md` },
    { title: `${system.from.name} \u2192 ${target.name}: token mapping`, width: 760, height: 120 + 34 * mapping.rows.length, properties: { [P().app]: JSON.stringify({ id: ask.app }), [P().mapping]: JSON.stringify({ system: item.id, app: ask.app, seq: ask.seq, rows: mapping.rows, untouched: mapping.untouched }) }, at: { x: item.x, y: item.y + item.height + 80 } },
    id("exact-mapping")
  );
  const base = { card: card.itemId, mapped, unmatched };
  if (mapped === 0) return answer({ ...base, error: "no token of the system has a match in the app; name some (src=dst) and apply again" });
  const loop = process.env.ISOCAN_EXACT_LOOP;
  if (!loop || !LOOP.test(loop)) return answer({ ...base, error: "Exact's held import goes to the dev loop's design server, and this `isocan exact live` runs none (--no-frames)" });
  snapshot = await ctx.client.snapshot(canvasId);
  const design = core.designItemOf(snapshot.canvas, ask.app);
  const usesOf = await (async () => {
    const v = design?.versions.find((x) => x.id === design.currentVersionId) ?? design?.versions.at(-1);
    if (!v) return [];
    const text = Buffer.from(await ctx.client.downloadBlob(canvasId, v.blobHash)).toString("utf8");
    const out = [];
    const to = new Set(mapping.rows.map((r) => r.to).filter(Boolean));
    for (const line of text.split("\n")) {
      const m = /^\| `([^`]+)` \|.*\| ([^|]*) \|$/.exec(line);
      if (!m || !to.has(m[1])) continue;
      for (const u of m[2].matchAll(/([\w./-]+\.contract):(\d+)/g)) out.push({ file: u[1], line: Number(u[2]) });
    }
    return out;
  })();
  const screen = screenFor(snapshot, ask.app, usesOf);
  if (!screen) return answer({ ...base, error: "no web phone screen of the app on this canvas to picture the proposal on" });
  const shots = screen.properties[P().reached] ?? screen.properties[P().shots] ?? `at "${screen.properties[P().url] ?? "/"}"`;
  const ios = opts.hosts.includes("ios") && !!opts.sim;
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-exact-apply-"));
  try {
    const job = path.join(dir, "job.json");
    await fs.writeFile(job, JSON.stringify({
      dtcg: dtcgFor(system, mapping),
      shots,
      ios,
      schemes: ["light", "dark"],
      devices: Object.keys(DEVICES).map((d) => ({ device: d, size: `${DEVICES[d].width}x${DEVICES[d].height}` }))
    }));
    let r;
    try {
      r = await kit.bridge(host, "system-apply", ["--app", app, "--dir", path.join(dir, "out"), "--job", job, "--dev-url", loop, ...ios ? ["--sim", opts.sim] : []], "the applied system's preview", true);
    } catch (err) {
      return answer({ ...base, error: err.message });
    }
    const reported = (r.review?.unmapped ?? []).map((u) => ({ name: u.name, why: u.why }));
    if (!r.ok || !r.proposal || !r.previews?.length) {
      if (r.proposal) await dropOnWire(kit, host, app, loop, r.proposal);
      return answer({ ...base, proposal: r.proposal ?? null, class: r.class ?? null, reported, error: r.error ?? "the import was not pictured" });
    }
    const isAgent = !!snapshot.canvas.agents?.[actor.id];
    const ops = r.ops ?? [];
    const posted = await postProposalItem(host, ctx, canvasId, screen, r, {
      seq: ask.seq,
      askSeq,
      asker: { id: actor.id, name: actor.name, kind: isAgent ? "agent" : "person" },
      scope: isAgent ? "propose" : "write",
      ops,
      why: `${system.from.name}'s design system applied to ${target.name} as Exact's held import: ${mapped} tokens mapped (the card ${card.itemId} says which).`.slice(0, 600),
      cites: [{ kind: "item", ref: item.id }, { kind: "item", ref: card.itemId }],
      in: null,
      title: `Applied by ${actor.name}: ${system.from.name}'s design system on ${target.name}`.slice(0, 160)
    });
    if ("error" in posted) {
      await dropOnWire(kit, host, app, loop, r.proposal);
      return answer({ ...base, proposal: r.proposal, class: r.class ?? null, reported, error: posted.error });
    }
    return answer({ ...base, ok: true, itemId: posted.itemId, proposal: r.proposal, class: r.class ?? null, reported, previews: posted.cells });
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

export {
  systemMarkdown,
  systemItems,
  extractVerb,
  targetTokens,
  loadTargetTokens,
  applyVerb,
  pendingApplies,
  answerApply
};
