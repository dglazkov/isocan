import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  undoneSeqs
} from "./chunk-DMRD2WBH.mjs";
import {
  PARENT_PROP
} from "./chunk-GUY4UN4O.mjs";

// packages/core/src/stuck.ts
var STUCK_TRIES = 3;
var STUCK_WINDOW_MS = 15 * 6e4;
var STUCK_QUICK_MS = 2 * 6e4;
var STUCK_AXES = [
  { id: "density", name: "Density" },
  { id: "brand", name: "Brand expression" },
  { id: "layout", name: "Layout" },
  { id: "tone", name: "Tone of voice" }
];
var STUCK_MARK = "Stuck question";
var ANSWER_MARK = "Stuck answer";
function words(body) {
  return body.replace(/@[\w'’.-]+/g, " ").replace(/#[\w'’.-]+/g, " ").replace(/[^\p{L}\p{N}']+/gu, " ").trim().split(" ").filter(Boolean);
}
function asksIn(entries, undone) {
  const anchor = /* @__PURE__ */ new Map();
  const main = /* @__PURE__ */ new Map();
  const last = /* @__PURE__ */ new Map();
  const out = [];
  for (const entry of entries) {
    const op = entry.envelope.op;
    if (op.type === "thread.setAnchor") anchor.set(op.threadId, op.anchorItemId ?? null);
    if (op.type === "thread.setMain" && op.threadId) main.set(op.threadId, true);
    if (op.type !== "thread.create" && op.type !== "thread.reply") continue;
    if (op.type === "thread.create") {
      anchor.set(op.threadId, op.anchorItemId);
      if (op.main) main.set(op.threadId, true);
    }
    if (entry.cause || undone.has(entry.seq)) continue;
    const comment = op.comment;
    if (comment.record || comment.click || comment.deleted || comment.goodnight) continue;
    const inMain = main.get(op.threadId);
    const summons = (comment.mentions?.length ?? 0) > 0 || inMain === true || inMain === void 0 && (comment.items?.length ?? 0) > 0;
    if (!summons) continue;
    const person = entry.envelope.actor;
    const key = `${person.id} ${op.threadId}`;
    const named = /* @__PURE__ */ new Set([...comment.items ?? [], ...anchor.get(op.threadId) ? [anchor.get(op.threadId)] : []]);
    const items = named.size ? named : new Set(last.get(key) ?? []);
    if (named.size) last.set(key, named);
    out.push({ seq: entry.seq, commentId: comment.id, ts: Date.parse(entry.envelope.ts), at: entry.envelope.ts, body: comment.body, person, items, answer: comment.body.includes(`${ANSWER_MARK} (`) });
  }
  return out;
}
function resultOf(entry, itemId) {
  const op = entry.envelope.op;
  const base = { seq: entry.seq, ts: Date.parse(entry.envelope.ts), itemId, by: entry.envelope.actor };
  if ((op.type === "item.addVersion" || op.type === "item.edit") && op.itemId === itemId) return { ...base, versionId: op.version.id };
  if (op.type === "item.add" && op.properties?.[PARENT_PROP] === itemId) return { ...base, childId: op.itemId };
  return null;
}
function goneAt(entries, undone, r, horizon) {
  const undo = undone.get(r.seq);
  let best = null;
  const take = (fate, ts) => {
    if (!best || ts < best.ts) best = { fate, ts };
  };
  if (undo !== void 0) {
    const e = entries.find((x) => x.seq === undo);
    if (e) take("undone", Date.parse(e.envelope.ts));
  }
  for (const e of entries) {
    if (e.seq <= r.seq || e.seq >= horizon || e.cause || undone.has(e.seq)) continue;
    const op = e.envelope.op;
    if (r.versionId && op.type === "item.setCurrentVersion" && op.itemId === r.itemId && op.versionId !== r.versionId) take("set aside", Date.parse(e.envelope.ts));
    if (r.childId && (op.type === "item.delete" && op.itemId === r.childId || op.type === "items.delete" && op.itemIds.includes(r.childId))) take("deleted", Date.parse(e.envelope.ts));
  }
  return best;
}
var FATE_WORDS = {
  undone: "undone",
  "set aside": "set aside",
  deleted: "deleted",
  "asked again": "asked for again within two minutes",
  "asked shorter": "asked for again in fewer words"
};
var minutes = (ms) => Math.max(1, Math.round(ms / 6e4));
var plural = (n, unit) => `${n} ${unit}${n === 1 ? "" : "s"}`;
var quote = (s) => `\u201C${s.replace(/\s+/g, " ").trim().slice(0, 60)}${s.trim().length > 60 ? "\u2026" : ""}\u201D`;
var COUNT = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
var count = (n) => COUNT[n] ?? String(n);
function triesAt(entries, itemId, actorId) {
  const undone = undoneSeqs(entries);
  const asks = asksIn(entries, undone).filter((a) => a.person.id === actorId && a.items.has(itemId));
  const tries = [];
  const answered = asks.map((ask, i) => {
    const next = asks[i + 1];
    const results = [];
    for (const e of entries) {
      if (e.seq <= ask.seq || next && e.seq >= next.seq) continue;
      if (e.cause || e.envelope.actor.id === actorId) continue;
      const r = resultOf(e, itemId);
      if (r) results.push(r);
    }
    return results;
  });
  for (const [i, ask] of asks.entries()) {
    const next = asks[i + 1];
    const results = answered[i];
    if (!results.length) continue;
    const horizon = answered.slice(i + 1).find((r) => r.length)?.[0]?.seq ?? Infinity;
    const lastTs = Math.max(...results.map((r) => r.ts));
    const gone = results.map((r) => goneAt(entries, undone, r, horizon));
    let fate = null;
    let afterMs = 0;
    if (gone.every((g) => g !== null)) {
      const latest = gone.reduce((a, b) => b.ts > a.ts ? b : a);
      fate = latest.fate;
      afterMs = Math.max(0, latest.ts - lastTs);
    } else if (next && next.ts - lastTs <= STUCK_QUICK_MS) {
      fate = "asked again";
      afterMs = Math.max(0, next.ts - lastTs);
    } else if (next && !next.answer && words(next.body).length < words(ask.body).length) {
      fate = "asked shorter";
      afterMs = Math.max(0, next.ts - lastTs);
    }
    tries.push({
      askId: ask.commentId,
      askSeq: ask.seq,
      ask: ask.body,
      at: ask.at,
      by: results[0].by,
      versionIds: results.flatMap((r) => r.versionId ? [r.versionId] : []),
      childIds: results.flatMap((r) => r.childId ? [r.childId] : []),
      fate: fate ?? "asked again",
      afterMs,
      kept: fate === null,
      answer: ask.answer
    });
  }
  return { tries, asks };
}
function stuckOn(entries, itemId, actorId, now) {
  const { tries, asks } = triesAt(entries, itemId, actorId);
  let start = tries.length;
  while (start > 0) {
    const t = tries[start - 1];
    if (t.kept) break;
    start -= 1;
    if (t.answer) break;
  }
  const run = tries.slice(start);
  if (run.length < STUCK_TRIES) return null;
  const lastTry = run.at(-1);
  const after = asks.filter((a) => a.seq > lastTry.askSeq);
  if (after.some((a) => a.answer)) return null;
  const pendingAsk = after.find((a) => !tries.some((t) => t.askSeq === a.seq)) ?? null;
  const counted = run.slice(-STUCK_TRIES);
  const first = Date.parse(counted[0].at);
  const newest = pendingAsk ? pendingAsk.ts : Date.parse(lastTry.at) + lastTry.afterMs;
  if (newest - first > STUCK_WINDOW_MS) return null;
  const clock = now ?? Date.parse(entries.at(-1)?.envelope.ts ?? (/* @__PURE__ */ new Date(0)).toISOString());
  if (clock - newest > STUCK_WINDOW_MS) return null;
  const said = [...run.map((t) => t.ask), ...pendingAsk ? [pendingAsk.body] : []].map((b) => words(b).length);
  const shorter = said.length > 1 && said.every((n, i) => i === 0 || n <= said[i - 1]) && said.at(-1) < said[0];
  const person = asks[0].person;
  const fates = /* @__PURE__ */ new Map();
  for (const t of run) fates.set(t.fate, (fates.get(t.fate) ?? 0) + 1);
  const how = [...fates].map(([f, n]) => `${count(n)} ${FATE_WORDS[f]}`).join(", ");
  const quickest = Math.min(...run.map((t) => t.afterMs));
  const facts = [
    `${count(run.length).replace(/^./, (c) => c.toUpperCase())} tries in ${plural(minutes(newest - Date.parse(run[0].at)), "minute")}, and none of them landed: ${how}.`,
    `The quickest went after ${quickest < 6e4 ? plural(Math.max(1, Math.round(quickest / 1e3)), "second") : plural(minutes(quickest), "minute")}.`,
    ...shorter ? [`The asks got shorter: ${[...run.map((t) => t.ask), ...pendingAsk ? [pendingAsk.body] : []].map((b) => quote(words(b).join(" ") || b)).join(" \u2192 ")}.`] : []
  ];
  return {
    itemId,
    person,
    tries: run.map(({ askSeq: _s, kept: _k, answer: _a, ...t }) => t),
    pending: pendingAsk ? { commentId: pendingAsk.commentId, at: pendingAsk.at, ask: pendingAsk.body } : null,
    shorter,
    at: `${itemId} \xB7 ${pendingAsk?.commentId ?? lastTry.askId}`,
    facts
  };
}
function stuckAll(entries, now) {
  const undone = undoneSeqs(entries);
  const pairs = /* @__PURE__ */ new Map();
  for (const ask of asksIn(entries, undone)) for (const itemId of ask.items) pairs.set(`${ask.person.id} ${itemId}`, { itemId, actorId: ask.person.id });
  return [...pairs.values()].flatMap(({ itemId, actorId }) => {
    const s = stuckOn(entries, itemId, actorId, now);
    return s ? [s] : [];
  }).sort((a, b) => Date.parse(b.pending?.at ?? b.tries.at(-1).at) - Date.parse(a.pending?.at ?? a.tries.at(-1).at));
}
var axisName = (id) => STUCK_AXES.find((a) => a.id === id).name;
function stuckAxis(raw) {
  const k = raw.trim().toLowerCase();
  return STUCK_AXES.find((a) => a.id === k || a.name.toLowerCase() === k || a.name.toLowerCase().split(" ")[0] === k)?.id ?? null;
}
function stuckQuestionRefusal(stuck, title, q) {
  if (!stuck) return `nobody is stuck on \u201C${title}\u201D: ask a question when ${STUCK_TRIES} tries in a row have missed \u2014 until then, answer the ask with a take`;
  if (!q.observations.length) return 'say what you noticed in what they kept and undid: --observe "You kept the photo every time." (one to three)';
  if (q.observations.length > 3) return "three observations at most \u2014 what you noticed, not everything that happened";
  for (const o of q.observations) {
    if (o.length > 160 || (o.match(/[.!?](\s|$)/g) ?? []).length > 1) return "an observation is one sentence";
    if (/\b(you|you're|you are|they|they're)\b[^.!?]*\bstuck\b/i.test(o)) return "never say the person is stuck \u2014 you have been guessing; say what you noticed";
  }
  const seen = /* @__PURE__ */ new Set();
  for (const t of q.tiles) {
    if (seen.has(t.axis)) return `\u201C${axisName(t.axis)}\u201D is asked twice`;
    seen.add(t.axis);
    if (!t.now.trim() || !t.instead.trim()) return `\u201C${axisName(t.axis)}\u201D says both sides: now and instead`;
    if (t.now.length > 80 || t.instead.length > 80) return `\u201C${axisName(t.axis)}\u201D is a tile, not a paragraph \u2014 eighty characters a side`;
    if ([t.now, t.instead].some((s) => s.includes(" \xB7 ") || s.includes("\n"))) return "a tile's words are one line, without \u201C \xB7 \u201D";
  }
  const missing = STUCK_AXES.filter((a) => !seen.has(a.id));
  if (missing.length) return `the question has four pairs \u2014 ${missing.map((a) => a.name).join(", ")} ${missing.length === 1 ? "is" : "are"} missing: --tile "${missing[0].id} | now | instead" --guess ${missing[0].id}=now|instead`;
  return null;
}
function stuckQuestionBody(stuck, title, q) {
  const one = (s) => s.replace(/\s+/g, " ").trim();
  const tiles = STUCK_AXES.map((a) => q.tiles.find((t) => t.axis === a.id));
  return [
    `${STUCK_MARK} (${stuck.at})`,
    `I've been guessing at \u201C${one(title)}\u201D, so I've stopped making new takes. Here is what I noticed, and a question instead.`,
    ...q.observations.map((o) => `Noticed: ${one(o)}`),
    ...tiles.map((t) => `${axisName(t.axis)} \u2014 now: ${one(t.now)} \xB7 instead: ${one(t.instead)} \xB7 my guess: ${t.guess}`),
    "Or: show me extremes \xB7 name a product that gets it right"
  ].join("\n");
}
function comments(canvas) {
  return Object.values(canvas.threads).flatMap((t) => t.comments).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
function stuckQuestionOf(canvas, at) {
  const head = `${STUCK_MARK} (${at})`;
  const c = comments(canvas).filter((one) => one.record && one.body.startsWith(head)).at(-1);
  if (!c) return null;
  const lines = c.body.split("\n");
  const tiles = [];
  for (const l of lines) {
    const m = /^(.+?) — now: (.*) · instead: (.*) · my guess: (now|instead)$/.exec(l);
    const axis = m && STUCK_AXES.find((a) => a.name === m[1])?.id;
    if (m && axis) tiles.push({ axis, now: m[2], instead: m[3], guess: m[4] });
  }
  return { by: c.author, commentId: c.id, observations: lines.filter((l) => l.startsWith("Noticed: ")).map((l) => l.slice(9)), tiles };
}
function stuckAnswerBody(lead, at, q, a) {
  const head = `@${lead.name} ${ANSWER_MARK} (${at}):`;
  if (a.kind === "extremes") return `${head} show me extremes \u2014 one take at each end of every pair, side by side, so I can point.`;
  if (a.kind === "product") return `${head} a product that gets it right \u2014 ${a.name.replace(/\s+/g, " ").trim()}. Work from what it does, not from my last asks.`;
  const said = a.picks.map((p) => {
    const tile = q?.tiles.find((t) => t.axis === p.axis);
    return `${axisName(p.axis)}: ${p.side}${tile ? ` (${p.side === "now" ? tile.now : tile.instead})` : ""}`;
  });
  return `${head} ${said.join("; ")}. Make one take from these.`;
}
function stuckAnswered(canvas, at) {
  return comments(canvas).some((c) => c.body.includes(`${ANSWER_MARK} (${at})`));
}
function stuckSections(stuck, title, q, lead, waits) {
  const who = q ? "I've" : `${stuck.tries.at(-1).by.name} has`;
  const out = [{ key: "guessing", heading: `${who} been guessing at \u201C${title}\u201D`, lines: stuck.facts.map((text) => ({ text })) }];
  if (!q) {
    out.push({ key: "waits", heading: "The question", lines: [{ text: waits ? `The question waits: ${waits}` : `Asked ${lead ?? "the lead"}: a question instead of another take, on its way.` }] });
    return out;
  }
  out.push({ key: "noticed", heading: "What I noticed \u2014 say if I'm wrong", lines: q.observations.map((text) => ({ text })) });
  out.push({
    key: "tiles",
    heading: "Now, or instead?",
    lines: STUCK_AXES.flatMap((a) => {
      const t = q.tiles.find((x) => x.axis === a.id);
      return t ? [{ text: `${a.name} \u2014 now: ${t.now} \xB7 instead: ${t.instead} \xB7 my guess: ${t.guess}`, axis: a.id, now: t.now, instead: t.instead, guess: t.guess }] : [];
    })
  });
  out.push({ key: "ways", heading: "Or", lines: [{ text: "Show me extremes" }, { text: "Name a product that gets it right" }] });
  return out;
}

export {
  STUCK_TRIES,
  STUCK_WINDOW_MS,
  STUCK_QUICK_MS,
  STUCK_AXES,
  stuckOn,
  stuckAll,
  stuckAxis,
  stuckQuestionRefusal,
  stuckQuestionBody,
  stuckQuestionOf,
  stuckAnswerBody,
  stuckAnswered,
  stuckSections
};
