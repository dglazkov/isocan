import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  sayInChat
} from "./chunk-KQFUOKET.mjs";
import {
  propose
} from "./chunk-GVV2HBNT.mjs";
import {
  PROPOSAL_PROP,
  critiqueCannot,
  itemKind,
  newGroupId,
  nightLead,
  proposalCites,
  proposalMarked
} from "./chunk-NGNONKZX.mjs";
import {
  parentOf
} from "./chunk-GUY4UN4O.mjs";
import "./chunk-K4TDP4L5.mjs";
import "./chunk-JYOOXWJZ.mjs";

// packages/core/src/ripple.ts
var RIPPLE_PROP = "ripple";
var RIPPLE_RUN = 3;
var RIPPLE_QUIET_MS = 6e4;
var RIPPLE_GAP_MS = 30 * 6e4;
function isScreen(item) {
  return itemKind(item) === "screen" && !proposalMarked(item);
}
function isAgent(canvas, actorId) {
  return Boolean(canvas.agents?.[actorId]);
}
function rippleRun(canvas, itemId, now, explicit = false) {
  const item = canvas.items[itemId];
  if (!item || !isScreen(item)) return null;
  const vs = item.versions;
  const last = vs.at(-1);
  if (!last || last.id !== item.currentVersionId || isAgent(canvas, last.createdBy.id)) return null;
  let start = vs.length - 1;
  while (start > 0) {
    const prev = vs[start - 1];
    if (prev.createdBy.id !== last.createdBy.id || Date.parse(vs[start].createdAt) - Date.parse(prev.createdAt) > RIPPLE_GAP_MS) break;
    start -= 1;
  }
  const fromIndex = start === 0 ? 0 : start - 1;
  const edits = vs.length - 1 - fromIndex;
  if (edits < (explicit ? 1 : RIPPLE_RUN)) return null;
  const lastAt = Date.parse(last.createdAt);
  const settlesAt = lastAt + RIPPLE_QUIET_MS;
  return {
    itemId,
    title: item.title || "Untitled",
    by: last.createdBy,
    fromVersionId: vs[fromIndex].id,
    toVersionId: last.id,
    from: fromIndex + 1,
    to: vs.length,
    edits,
    lastAt,
    settled: explicit || now >= settlesAt,
    settlesAt
  };
}
function rippleRuns(canvas, now) {
  return Object.values(canvas.items).map((item) => {
    const run = rippleRun(canvas, item.id, now);
    if (run && !run.settled) return rippleRun(canvas, item.id, now, true) && rippleAsked(canvas, rippleAt(run)) ? { ...run, settled: true } : run;
    return run ?? explicitRun(canvas, item.id, now);
  }).filter((r) => r !== null).sort((a, b) => b.lastAt - a.lastAt);
}
function explicitRun(canvas, itemId, now) {
  const run = rippleRun(canvas, itemId, now, true);
  return run && rippleAsked(canvas, rippleAt(run)) ? run : null;
}
function rippleAt(run) {
  return `${run.itemId}@v${run.from}..v${run.to}`;
}
var TRACKED = /* @__PURE__ */ new Set([
  "color",
  "background",
  "background-color",
  "border-color",
  "font-size",
  "font-weight",
  "font-family",
  "line-height",
  "letter-spacing",
  "border-radius",
  "padding",
  "margin",
  "gap"
]);
function normValue(raw) {
  const v = raw.replace(/!important/i, "").trim().toLowerCase().replace(/\s+/g, " ");
  return /^#[\da-f]{3}$/.test(v) ? `#${[...v.slice(1)].map((c) => c + c).join("")}` : v;
}
function readScreen(html) {
  const css = [];
  for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) css.push(m[1]);
  for (const m of html.matchAll(/\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) css.push(m[1] ?? m[2] ?? "");
  const out = { tokens: /* @__PURE__ */ new Map(), refs: /* @__PURE__ */ new Set(), values: /* @__PURE__ */ new Map(), words: /* @__PURE__ */ new Set(), spelled: /* @__PURE__ */ new Map() };
  const text = css.join(";").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of text.matchAll(/(--[\w-]+|[a-z-]+)\s*:\s*([^;{}]+)/gi)) {
    const prop = m[1].toLowerCase();
    const value = normValue(m[2]);
    if (prop.startsWith("--")) {
      if (!out.tokens.has(prop)) out.tokens.set(prop, value);
    } else if (TRACKED.has(prop) && !value.includes("var(")) {
      if (!out.values.has(prop)) out.values.set(prop, /* @__PURE__ */ new Set());
      out.values.get(prop).add(value);
    }
  }
  for (const m of text.matchAll(/var\(\s*(--[\w-]+)/gi)) out.refs.add(m[1].toLowerCase());
  const visible = html.replace(/<(style|script|title|head)\b[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&(nbsp|middot|amp|times);/g, " ");
  for (const m of visible.matchAll(new RegExp("\\p{L}[\\p{L}'\u2019-]*", "gu"))) {
    const word = m[0];
    if (word.length < 3) continue;
    const key = word.toLowerCase();
    out.words.add(key);
    if (!out.spelled.has(key)) out.spelled.set(key, word);
  }
  return out;
}
var minus = (a, b) => [...a].filter((x) => !b.has(x));
function rippleChanges(beforeHtml, afterHtml) {
  const a = readScreen(beforeHtml);
  const b = readScreen(afterHtml);
  const out = [];
  for (const [name, was] of a.tokens) {
    const now = b.tokens.get(name);
    if (now !== void 0 && now !== was) out.push({ kind: "token", name, before: [was], after: [now], tag: `${name} ${was} \u2192 ${now}` });
  }
  for (const [prop, was] of a.values) {
    const now = b.values.get(prop) ?? /* @__PURE__ */ new Set();
    const gone2 = minus(was, now);
    const came2 = minus(now, was);
    if (gone2.length && came2.length) out.push({ kind: "value", name: prop, before: gone2, after: came2, tag: `${prop} ${gone2.join(", ")} \u2192 ${came2.join(", ")}` });
  }
  const gone = minus(a.words, b.words);
  const came = minus(b.words, a.words);
  if (gone.length >= 1 && gone.length <= 3 && came.length >= 1 && came.length <= 3) {
    const say = (words, r) => words.map((w) => r.spelled.get(w) ?? w).join(" ");
    out.push({ kind: "term", name: "", before: gone, after: came, tag: `\u201C${say(gone, a)}\u201D \u2192 \u201C${say(came, b)}\u201D` });
  }
  return out;
}
function touches(change, s) {
  if (change.kind === "token") {
    const def = s.tokens.get(change.name);
    if (def !== void 0) return change.after.includes(def) ? "sync" : "would";
    return s.refs.has(change.name) ? "would" : null;
  }
  if (change.kind === "value") {
    const vals = s.values.get(change.name);
    if (!vals) return null;
    if (change.before.some((v) => vals.has(v))) return "would";
    return change.after.some((v) => vals.has(v)) ? "sync" : null;
  }
  if (change.before.every((w) => s.words.has(w))) return "would";
  return change.after.every((w) => s.words.has(w)) ? "sync" : null;
}
var isOff = (item) => item.properties?.[RIPPLE_PROP] === "off";
function previews(item, sourceId) {
  return proposalCites(item).some((c) => c.kind === "version" && c.ref.startsWith(`${sourceId}@`));
}
function scopeOf(canvas, source) {
  return Object.values(canvas.items).filter((item) => item.id !== source.id && isScreen(item) && (item.containerId ?? null) === (source.containerId ?? null)).sort((a, b) => a.y - b.y || a.x - b.x);
}
function rippleVersions(canvas, runs) {
  const out = /* @__PURE__ */ new Map();
  const add = (v) => v && out.set(v.blobHash, v);
  for (const run of runs) {
    const source = canvas.items[run.itemId];
    if (!source) continue;
    add(source.versions.find((v) => v.id === run.fromVersionId));
    add(source.versions.find((v) => v.id === run.toVersionId));
    for (const s of scopeOf(canvas, source)) add(s.versions.find((v) => v.id === s.currentVersionId));
  }
  return [...out.values()];
}
function rippleRead(canvas, run, textOf, exceptions = []) {
  const source = canvas.items[run.itemId];
  if (!source) return null;
  const fromV = source.versions.find((v) => v.id === run.fromVersionId);
  const toV = source.versions.find((v) => v.id === run.toVersionId);
  const before = fromV && textOf(fromV);
  const after = toV && textOf(toV);
  if (before === void 0 || after === void 0) return null;
  const base = { source: { itemId: source.id, title: source.title || "Untitled" }, run, at: rippleAt(run), cite: `${run.itemId}@v${run.to}` };
  if (isOff(source)) return { ...base, changes: [], screens: [], untouched: 0, off: true };
  const changes = rippleChanges(before, after);
  const kept = (p) => {
    const hash = p.versions.find((v) => v.id === p.currentVersionId)?.blobHash;
    return Boolean(hash && canvas.items[parentOf(p) ?? ""]?.versions.some((v) => v.blobHash === hash));
  };
  const deleted = new Set(canvas.trash.filter((t) => t.item.properties?.[PROPOSAL_PROP] && previews(t.item, source.id) && !kept(t.item)).map((t) => parentOf(t.item)));
  const screens = [];
  let untouched = 0;
  for (const screen of scopeOf(canvas, source)) {
    const current = screen.versions.find((v) => v.id === screen.currentVersionId);
    const html = current && textOf(current);
    if (html === void 0) return null;
    const read = readScreen(html);
    const would = [];
    const sync = [];
    for (const c of changes) {
      const t = touches(c, read);
      if (t === "would") would.push(c.tag);
      else if (t === "sync") sync.push(c.tag);
    }
    if (!would.length && !sync.length) {
      untouched += 1;
      continue;
    }
    const preview = Object.values(canvas.items).find((p) => proposalMarked(p) && parentOf(p) === screen.id && previews(p, source.id));
    const argued = exceptions.find((e) => e.itemId === screen.id);
    const because = isOff(screen) ? "marked a one-off" : deleted.has(screen.id) ? "a preview of it was deleted" : argued ? argued.why : void 0;
    screens.push({
      itemId: screen.id,
      title: screen.title || "Untitled",
      state: because ? "disagrees" : would.length ? "would change" : "in sync",
      would,
      sync,
      ...because ? { because } : {},
      ...preview ? { previewId: preview.id } : {}
    });
  }
  return { ...base, changes, screens, untouched, off: false };
}
function ripplePulse(canvas, reads) {
  const ticks = [];
  const screens = Object.values(canvas.items).filter(isScreen).sort((a, b) => a.y - b.y || a.x - b.x);
  for (const screen of screens) {
    const title = screen.title || "Untitled";
    if (isOff(screen)) {
      ticks.push({ itemId: screen.id, title, state: "conflict", why: "marked a one-off" });
      continue;
    }
    const rows = reads.flatMap((r) => r.screens.filter((s) => s.itemId === screen.id).map((s) => ({ r, s })));
    const against = rows.find((x) => x.s.state === "disagrees");
    const behind = rows.find((x) => x.s.state === "would change");
    if (against) ticks.push({ itemId: screen.id, title, state: "conflict", why: `disagrees with \u201C${against.r.source.title}\u201D: ${against.s.because}` });
    else if (behind) ticks.push({ itemId: screen.id, title, state: "behind", why: `behind \u201C${behind.r.source.title}\u201D: ${behind.s.would.join("; ")}` });
    else ticks.push({ itemId: screen.id, title, state: "current" });
  }
  return ticks;
}
var ASK_MARK = "Ripple, please";
var BACK_HEAD = "Ripple read-back";
var SYSTEM_MARK = "Ripple into the design system, please";
var names = (rows) => rows.map((r) => `\u201C${r.title}\u201D`).join(", ") || "none";
function rippleAsk(lead, read) {
  const by = (s) => read.screens.filter((x) => x.state === s);
  return `@${lead.name} ${ASK_MARK} (${read.at}): ${read.run.by.name}'s run on \u201C${read.source.title}\u201D settled \u2014 ${read.run.edits} edit${read.run.edits === 1 ? "" : "s"}. Changed: ${read.changes.map((c) => c.tag).join("; ") || "nothing another screen shares"}. Would change: ${names(by("would change"))}. Already in sync: ${names(by("in sync"))}. Disagrees: ${names(by("disagrees"))}. Nothing on any other screen has changed. Read the edits back as at most three decisions in design words, preview each screen that would change as a proposal citing version:${read.cite}, argue any exception in one line, and sketch one idea set apart \u2014 \`isocan ripple ${read.source.itemId} --read-back \u2026\`.`;
}
function systemAsk(lead, read) {
  return `@${lead.name} ${SYSTEM_MARK} (${read.at}): put \u201C${read.source.title}\u201D's change in the design system \u2014 ${read.changes.map((c) => c.tag).join("; ")}. Propose it beneath the DESIGN.md that governs it, citing version:${read.cite}; nothing changes until it is kept.`;
}
function comments(canvas) {
  return Object.values(canvas.threads).flatMap((t) => t.comments).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
function rippleAsked(canvas, at) {
  return comments(canvas).some((c) => c.body.includes(`${ASK_MARK} (${at})`));
}
function systemAsked(canvas, at) {
  return comments(canvas).some((c) => c.body.includes(`${SYSTEM_MARK} (${at})`));
}
function readBackRefusal(canvas, read, back) {
  if (!back.decisions.length) return 'read the edits back as at least one decision, in design words: --decision "\u2026"';
  if (back.decisions.length > 3) return "three decisions at most \u2014 a read-back names what mattered, not every edit";
  if (back.decisions.some((d) => d.length > 120)) return 'a decision is a phrase ("a tighter type scale"), not a paragraph';
  for (const e of back.exceptions) {
    if (!read.screens.some((s) => s.itemId === e.itemId)) return `\u201C${e.title}\u201D is not one of the screens this ripple reaches \u2014 an exception names one of them`;
    if ((e.why.match(/[.!?](\s|$)/g) ?? []).length > 1) return "an exception is argued in one line";
  }
  if (back.good) {
    const n = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (comments(canvas).some((c) => c.record && c.body.startsWith(BACK_HEAD) && c.body.split("\n").some((l) => l.startsWith("Caught doing it right: ") && n(l.slice(23)) === n(back.good)))) {
      return "that good move was already named on this canvas \u2014 name one once, sparingly";
    }
  }
  if (back.sketch && (back.sketch.match(/[.!?](\s|$)/g) ?? []).length > 2) return "the sketch is two sentences at most";
  return null;
}
function readBackBody(at, back) {
  const one = (s) => s.replace(/\s+/g, " ").trim();
  return [
    `${BACK_HEAD} (${at})`,
    ...back.decisions.map((d) => `Decision: ${one(d)}`),
    ...back.good ? [`Caught doing it right: ${one(back.good)}`] : [],
    ...back.exceptions.map((e) => `Exception: \u201C${e.title}\u201D (${e.itemId}) \u2014 ${one(e.why)}`),
    ...back.sketch ? [`Sketch: ${one(back.sketch)}`] : []
  ].join("\n");
}
function readBackOf(canvas, at) {
  const head = `${BACK_HEAD} (${at})`;
  const c = comments(canvas).filter((one) => one.record && one.body.startsWith(head)).at(-1);
  if (!c) return null;
  const lines = c.body.split("\n");
  const after = (label) => lines.filter((l) => l.startsWith(label)).map((l) => l.slice(label.length).trim());
  return {
    by: c.author,
    commentId: c.id,
    decisions: after("Decision: "),
    good: after("Caught doing it right: ")[0] ?? null,
    exceptions: after("Exception: ").flatMap((l) => {
      const m = /^“(.*)” \((itm_[\w-]+)\) — (.*)$/.exec(l);
      return m ? [{ title: m[1], itemId: m[2], why: m[3] }] : [];
    }),
    sketch: after("Sketch: ")[0] ?? null
  };
}
function rippleSections(read, back, waits) {
  const out = [];
  out.push({
    key: "back",
    heading: "What you decided",
    lines: back ? [...back.decisions.map((d) => ({ text: d })), ...back.good ? [{ text: `Caught doing it right: ${back.good}` }] : []] : [{ text: waits ? `The read-back waits: ${waits}` : "Asked the lead; the read-back has not come yet." }]
  });
  if (read.off) {
    out.push({ key: "changes", heading: "A one-off", lines: [{ text: `\u201C${read.source.title}\u201D is marked a one-off, so its changes stay where they are. Undo takes it back.` }] });
    return out;
  }
  out.push({ key: "changes", heading: "What changed", lines: read.changes.length ? read.changes.map((c) => ({ text: c.tag })) : [{ text: "Nothing another screen shares: no token, value or term." }] });
  const rows = (state) => read.screens.filter((s) => s.state === state);
  const row = (s, text) => ({ text, itemId: s.itemId, ...s.previewId ? { previewId: s.previewId } : {} });
  out.push({ key: "would", heading: "Would change", lines: rows("would change").map((s) => row(s, `\u201C${s.title}\u201D \u2014 ${s.would.join("; ")}${s.previewId ? " \xB7 previewed" : ""}`)) });
  out.push({ key: "sync", heading: "Already in sync", lines: rows("in sync").map((s) => row(s, `\u201C${s.title}\u201D \u2014 ${s.sync.join("; ")}`)) });
  out.push({ key: "disagrees", heading: "Disagrees, your call", lines: rows("disagrees").map((s) => row(s, `\u201C${s.title}\u201D \u2014 ${s.because}`)) });
  if (read.untouched) out[out.length - 1].lines.push({ text: `${read.untouched} other screen${read.untouched === 1 ? " uses" : "s use"} none of it.` });
  out.push({
    key: "altitude",
    heading: "Where it goes \u2014 your choice",
    lines: [
      { text: "Screen by screen (the default): keep each preview you want; nothing changes until you do." },
      { text: "Put it in the design system: the lead proposes it as a new version of the DESIGN.md." },
      { text: `This one is a one-off: \u201C${read.source.title}\u201D stops rippling (ripple=off; undo takes it back).` }
    ]
  });
  if (back?.sketch) out.push({ key: "sketch", heading: "One idea this makes possible \u2014 a sketch, set apart", lines: [{ text: back.sketch }] });
  return out;
}

// packages/cli/src/ripple.ts
async function leadFor(ctx, canvas, snapshot) {
  const [answering, sessions] = await Promise.all([ctx.client.rcAnswering(canvas.id).catch(() => null), ctx.client.listSessions(canvas.id).catch(() => [])]);
  const seen = { answering, sessions, ...snapshot.joined ? { joined: snapshot.joined } : {} };
  const lead = nightLead(snapshot.canvas, canvas.properties ?? {}, seen);
  return { lead: lead.agent?.actor ?? null, cannot: critiqueCannot(lead, ctx.actor.id, seen) ?? (lead.agent ? null : "no lead") };
}
async function texts(ctx, canvasId, snapshot, runs) {
  const out = /* @__PURE__ */ new Map();
  await Promise.all(rippleVersions(snapshot.canvas, runs).map(async (v) => {
    out.set(v.blobHash, Buffer.from(await ctx.client.downloadBlob(canvasId, v.blobHash)).toString("utf8"));
  }));
  return (v) => out.get(v.blobHash);
}
async function readOf(ctx, canvasId, snapshot, run) {
  const back = readBackOf(snapshot.canvas, rippleAt(run));
  const read = rippleRead(snapshot.canvas, run, await texts(ctx, canvasId, snapshot, [run]), back?.exceptions ?? []);
  if (!read) throw new Error("a version this ripple needs could not be read");
  return read;
}
function header(read) {
  const r = read.run;
  return `Ripple from \u201C${read.source.title}\u201D (${read.at}) \xB7 ${r.by.name}'s run, ${r.edits} edit${r.edits === 1 ? "" : "s"} \xB7 ${r.settled ? "settled" : `settles ${new Date(r.settlesAt).toLocaleTimeString()}`}`;
}
async function ripple(ctx, deps, ref, opts) {
  const { canvas: p, snapshot } = await deps.canvasAndSnapshot(ctx);
  const now = Date.now();
  if (!ref) {
    const all = rippleRuns(snapshot.canvas, now);
    const runs = all.filter((r) => r.settled);
    const textOf = await texts(ctx, p.id, snapshot, runs);
    const reads = runs.flatMap((run2) => {
      const r = rippleRead(snapshot.canvas, run2, textOf, readBackOf(snapshot.canvas, rippleAt(run2))?.exceptions ?? []);
      return r ? [r] : [];
    });
    const ticks = ripplePulse(snapshot.canvas, reads);
    if (ctx.json) return deps.printJson({ ticks, sources: reads.map((r) => ({ itemId: r.source.itemId, at: r.at })), settling: all.filter((r) => !r.settled) });
    const mark = { current: "\u25CF", behind: "\u25D0", conflict: "\u2715" };
    const count = (s) => ticks.filter((t) => t.state === s).length;
    console.log(`Pulse: ${ticks.map((t) => mark[t.state]).join(" ")}  ${count("current")} current \xB7 ${count("behind")} behind \xB7 ${count("conflict")} in conflict`);
    for (const t of ticks) console.log(`  ${mark[t.state]} ${t.title}${t.why ? ` \u2014 ${t.why}` : ""}`);
    for (const r of all.filter((x) => !x.settled)) console.log(`${r.by.name}'s run on \u201C${r.title}\u201D is still settling \u2014 quiet until ${new Date(r.settlesAt).toLocaleTimeString()}, or \`isocan ripple ${r.itemId} --ask\``);
    if (!reads.length) console.log("No settled run to ripple from: a screen ripples after a run of edits settles, or `isocan ripple <item> --ask`.");
    return;
  }
  const item = deps.resolveItem(snapshot, ref);
  const run = rippleRun(snapshot.canvas, item.id, now, true);
  if (!run) throw new Error(`\u201C${item.title}\u201D has no run of edits to ripple \u2014 a screen ripples after somebody edits it, and its newest version is the one showing (an agent's edits are not a run)`);
  const read = await readOf(ctx, p.id, snapshot, run);
  const said = [opts.ask, opts.altitude !== void 0, opts.readBack || (opts.preview?.length ?? 0) > 0].filter(Boolean).length;
  if (said > 1) throw new Error("one act at a time: --ask, --altitude, or the lead's --read-back / --preview");
  if (opts.ask) {
    const found = await leadFor(ctx, p, snapshot);
    if (found.cannot || !found.lead) throw new Error(`nothing can read it back here: ${found.cannot ?? "no lead"}. The ripple stands without one \u2014 \`isocan ripple ${item.id}\``);
    if (rippleAsked(snapshot.canvas, read.at)) throw new Error(`${found.lead.name} was already asked about this run \u2014 \`isocan ripple ${item.id}\` shows the read-back when it comes`);
    const posted = await sayInChat(ctx, deps, p.id, snapshot, rippleAsk(found.lead, read), { items: [item.id] });
    if (ctx.json) return deps.printJson({ commentId: posted.commentId, lead: found.lead, at: read.at });
    console.log(`asked ${found.lead.name} to read back your run on \u201C${item.title}\u201D (${posted.commentId}); nothing on any other screen has changed`);
    return;
  }
  if (opts.altitude !== void 0) {
    const altitude = opts.altitude;
    if (altitude === "screens") {
      const previews2 = read.screens.filter((s) => s.previewId);
      if (ctx.json) return deps.printJson({ altitude, previews: previews2.map((s) => s.previewId) });
      console.log(`screen by screen: keep each preview you want (${previews2.length ? previews2.map((s) => `\`isocan choose ${s.previewId}\` for \u201C${s.title}\u201D`).join(", ") : "none has arrived yet"}); nothing changes until you do`);
      return;
    }
    if (altitude === "system") {
      const found = await leadFor(ctx, p, snapshot);
      if (found.cannot || !found.lead) throw new Error(`nothing can put it in the design system for you here: ${found.cannot ?? "no lead"}`);
      if (systemAsked(snapshot.canvas, read.at)) throw new Error(`${found.lead.name} was already asked to put this run in the design system`);
      const posted = await sayInChat(ctx, deps, p.id, snapshot, systemAsk(found.lead, read), { items: [item.id] });
      if (ctx.json) return deps.printJson({ altitude, commentId: posted.commentId });
      console.log(`asked ${found.lead.name} to propose \u201C${item.title}\u201D's change in the design system (${posted.commentId}); it arrives as a proposal, and nothing changes until you keep it`);
      return;
    }
    if (altitude === "one-off") {
      if (item.properties[RIPPLE_PROP] === "off") throw new Error(`\u201C${item.title}\u201D is already a one-off`);
      const group = newGroupId();
      await deps.sendOp(ctx, p.id, { type: "item.update", itemId: item.id, patch: { properties: { [RIPPLE_PROP]: "off" } } }, group);
      const open = openPreviews(snapshot.canvas.items, item.id);
      for (const one of open) await deps.sendOp(ctx, p.id, { type: "item.delete", itemId: one.id }, group);
      if (ctx.json) return deps.printJson({ altitude, itemId: item.id, cleared: open.map((o) => o.id) });
      console.log(`\u201C${item.title}\u201D is a one-off: it stops rippling${open.length ? `, and its ${open.length} open preview${open.length === 1 ? "" : "s"} went to the trash` : ""} \u2014 one undo takes it back`);
      return;
    }
    throw new Error(`--altitude is system, screens or one-off \u2014 not "${altitude}"`);
  }
  if (opts.readBack || opts.preview?.length) {
    let back2 = null;
    let posted = null;
    if (opts.readBack) {
      back2 = {
        decisions: (opts.decision ?? []).map((d) => d.trim()).filter(Boolean),
        good: opts.good?.trim() || null,
        exceptions: (opts.exception ?? []).map((raw) => {
          const at = raw.indexOf("|");
          if (at < 0) throw new Error(`an exception is "<screen> | why, in one line" \u2014 not "${raw}"`);
          const screen = deps.resolveItem(snapshot, raw.slice(0, at).trim());
          return { itemId: screen.id, title: screen.title || "Untitled", why: raw.slice(at + 1).trim() };
        }),
        sketch: opts.sketch?.trim() || null
      };
      if (opts.sketchFile && !back2.sketch) throw new Error("--sketch-file draws the idea --sketch says");
      const refused = readBackRefusal(snapshot.canvas, read, back2);
      if (refused) throw new Error(refused);
      posted = await sayInChat(ctx, deps, p.id, snapshot, readBackBody(read.at, back2), { record: true, items: [item.id, ...back2.exceptions.map((e) => e.itemId)] });
    }
    const why = opts.why?.trim() || back2?.decisions[0] || readBackOf(snapshot.canvas, read.at)?.decisions[0];
    const made = [];
    for (const raw of opts.preview ?? []) {
      const at = raw.lastIndexOf("=");
      if (at < 1) throw new Error(`a preview is "<screen>=<file>" \u2014 not "${raw}"`);
      const screen = deps.resolveItem(snapshot, raw.slice(0, at).trim());
      const row = read.screens.find((s) => s.itemId === screen.id);
      const argued = back2?.exceptions.find((e) => e.itemId === screen.id);
      if (argued) throw new Error(`\u201C${screen.title}\u201D disagrees (${argued.why}) \u2014 argue it, do not preview it`);
      if (!row || row.state !== "would change") {
        throw new Error(`\u201C${screen.title}\u201D ${row ? row.state === "in sync" ? "is already in sync" : `disagrees (${row.because}) \u2014 argue it, do not preview it` : "does not use what changed"}: preview only a screen that would change`);
      }
      if (!why) throw new Error("a preview says why in design words: --why, or read it back first (--read-back --decision \u2026)");
      const one = await propose(ctx, deps, screen.id, raw.slice(at + 1).trim(), { cites: [`version:${read.cite}`], why, ...opts.hunch ? { hunch: true } : {} }, true);
      if (one) made.push({ screen: screen.id, itemId: one.itemId });
    }
    let sketched = null;
    if (opts.sketchFile && back2?.sketch) {
      const one = await propose(ctx, deps, item.id, opts.sketchFile, { cites: [`version:${read.cite}`], why: back2.sketch, hunch: true, title: `${item.title || "Untitled"} \u2014 a sketch` }, true);
      if (one) sketched = one.itemId;
    }
    if (ctx.json) return deps.printJson({ commentId: posted?.commentId ?? null, previews: made, sketch: sketched });
    if (posted) console.log(`the read-back is in the Chat (${posted.commentId})`);
    for (const m of made) console.log(`previewed \u201C${snapshot.canvas.items[m.screen]?.title}\u201D beneath it (${m.itemId}), citing version:${read.cite}`);
    if (sketched) console.log(`the sketch hangs beneath \u201C${item.title}\u201D as a hunch (${sketched}), set apart from the previews`);
    return;
  }
  const back = readBackOf(snapshot.canvas, read.at);
  let waits = null;
  if (!back && !rippleAsked(snapshot.canvas, read.at)) waits = (await leadFor(ctx, p, snapshot)).cannot ?? `nobody has asked the lead yet \u2014 \`isocan ripple ${item.id} --ask\``;
  const sections = rippleSections(read, back, waits);
  if (ctx.json) return deps.printJson({ read, back, waits, sections });
  console.log(header(read));
  for (const s of sections) {
    if (!s.lines.length) continue;
    console.log(`
${s.heading}`);
    for (const l of s.lines) console.log(`  ${l.text}${l.previewId ? ` (preview ${l.previewId})` : ""}`);
  }
}
function openPreviews(items, sourceId) {
  return Object.values(items).filter((one) => one.properties[PROPOSAL_PROP] && parentOf(one) !== sourceId && proposalCites(one).some((c) => c.kind === "version" && c.ref.startsWith(`${sourceId}@`)));
}
export {
  ripple
};
