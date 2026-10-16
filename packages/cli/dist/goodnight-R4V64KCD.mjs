import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  beneath
} from "./chunk-J3XEFIMP.mjs";
import {
  PROMISE_TAKE_PROP,
  PROPOSAL_PROP,
  PROPOSAL_WHY_PROP,
  TEXT_FILENAME,
  TEXT_MIME,
  answerLine,
  briefRefusal,
  fillTarget,
  goodnightNotes,
  goodnightTalk,
  handoffBox,
  handoffProperties,
  handoffSpot,
  leftOpen,
  mainThread,
  midwayItems,
  morningDue,
  morningText,
  namedByOthers,
  newGroupId,
  newItemId,
  newThreadId,
  newVersionId,
  nightAnswerable,
  nightLead,
  nightReview,
  noteText,
  parseCite,
  planNight,
  promiseProperties,
  promisedPlaceholder,
  proposalRoom,
  readyAt,
  sameActor,
  settledToday,
  textLookProperties,
  untickLine
} from "./chunk-QCT42IYK.mjs";
import "./chunk-GUY4UN4O.mjs";
import "./chunk-K4TDP4L5.mjs";
import "./chunk-JYOOXWJZ.mjs";

// packages/cli/src/goodnight.ts
import { promises as fs } from "node:fs";
import path from "node:path";
async function seeing(ctx, canvasId, snapshot) {
  const [answering, sessions] = await Promise.all([
    ctx.client.rcAnswering(canvasId).catch(() => null),
    ctx.client.listSessions(canvasId).catch(() => [])
  ]);
  return { answering, sessions, ...snapshot.joined ? { joined: snapshot.joined } : {} };
}
async function sayInChat(ctx, deps, canvasId, snapshot, body, extra = {}) {
  const comment = { ...await deps.newComment(ctx, canvasId, snapshot, body), ...extra };
  const main = mainThread(snapshot.canvas);
  if (main) {
    await deps.sendOp(ctx, canvasId, { type: "thread.reply", threadId: main.id, comment });
    return { threadId: main.id, commentId: comment.id };
  }
  const threadId = newThreadId();
  await deps.sendOp(ctx, canvasId, { type: "thread.create", threadId, x: 0, y: 0, anchorItemId: null, main: true, comment });
  return { threadId, commentId: comment.id };
}
function startOfToday(now) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function personOn(snapshot, ref) {
  const want = ref.trim().toLowerCase();
  const seen = /* @__PURE__ */ new Map();
  for (const thread of Object.values(snapshot.canvas.threads)) for (const c of thread.comments) seen.set(c.author.id, c.author);
  for (const item of Object.values(snapshot.canvas.items)) seen.set(item.createdBy.id, item.createdBy);
  const named = (a) => (snapshot.names?.[a.id] ?? a.name).toLowerCase();
  const found = [...seen.values()].find((a) => a.id === ref || named(a) === want);
  if (!found) throw new Error(`nobody called "${ref}" has written on this canvas`);
  return { id: found.id, name: snapshot.names?.[found.id] ?? found.name };
}
function whose(snapshot, ref) {
  if (ref) return personOn(snapshot, ref);
  const thread = mainThread(snapshot.canvas);
  const asks = (thread?.comments ?? []).filter((c) => /^\s*\/goodnight(\s|$)/.test(c.body)).reverse();
  const notes = goodnightNotes(snapshot.canvas);
  for (const ask of asks) {
    const written = notes.find(({ note: note2 }) => sameActor(snapshot.joined, note2.person.id, ask.author.id));
    if (!written || written.item.createdAt < ask.createdAt) return { id: ask.author.id, name: snapshot.names?.[ask.author.id] ?? ask.author.name };
  }
  throw new Error("nobody has said /goodnight here \u2014 name the person with --for <name>");
}
function parseLine(snapshot, raw, edit) {
  const [ref, text, budget] = raw.split("|").map((part) => part.trim());
  if (!ref || !text) throw new Error(`"${raw}" is not a line \u2014 write "<item> | <what you will do> | <budget>"`);
  return { on: snapshot.canvas.items[ref] ? ref : resolveRef(snapshot, ref), text, edit, ...budget ? { budget } : {} };
}
function resolveRef(snapshot, ref) {
  const want = ref.toLowerCase();
  const hit = Object.values(snapshot.canvas.items).find((item) => item.title.toLowerCase() === want);
  return hit?.id ?? ref;
}
function parseOpen(raw) {
  const at = raw.indexOf("|");
  const cite = parseCite(at > 0 ? raw.slice(0, at).trim() : "");
  if ("refused" in cite || at < 0 || !raw.slice(at + 1).trim()) {
    throw new Error(`"${raw}" is not a doubt \u2014 write "comment:<id> | what was said", citing where you read it`);
  }
  return { what: raw.slice(at + 1).trim(), cite };
}
async function upload(ctx, canvasId, bytes, mimeType, filename) {
  const blob = await ctx.client.uploadBlob(canvasId, bytes, mimeType, filename);
  return { id: newVersionId(), blobHash: blob.blobHash, mimeType, filename, size: blob.size };
}
async function writeNote(ctx, deps, p, snapshot, note2) {
  const noteId = newItemId();
  const group = newGroupId();
  const canvas = { ...snapshot.canvas, items: { ...snapshot.canvas.items } };
  const frames = [];
  const lines = note2.lines.map((line) => ({ ...line }));
  for (const line of lines) {
    if (line.edit || !line.ticked) continue;
    const source = canvas.items[line.on];
    const html = /html/.test(source.versions.find((v) => v.id === source.currentVersionId)?.mimeType ?? "");
    const filename = html ? "promised.html" : TEXT_FILENAME;
    const mimeType = html ? "text/html" : TEXT_MIME;
    const version = await upload(ctx, p.id, Buffer.from(promisedPlaceholder(line, html), "utf8"), mimeType, filename);
    const size = { width: source.width, height: source.height };
    const at = beneath(canvas, source, size);
    line.frame = newItemId();
    canvas.items[line.frame] = { ...source, id: line.frame, x: at.x, y: at.y, properties: {} };
    frames.push({
      type: "item.add",
      itemId: line.frame,
      version,
      ...size,
      placement: at,
      title: `${source.title || "Untitled"} \u2014 promised tonight`,
      properties: promiseProperties(noteId, line)
    });
  }
  const done2 = { ...note2, lines };
  const body = noteText(done2);
  const box = handoffBox(body);
  const spot = handoffSpot(canvas, lines.map((l) => l.on), box);
  await deps.sendOp(ctx, p.id, {
    type: "item.add",
    itemId: noteId,
    version: await upload(ctx, p.id, Buffer.from(body, "utf8"), TEXT_MIME, TEXT_FILENAME),
    ...box,
    placement: { ...spot, chosen: true },
    title: `Goodnight, ${note2.person.name}`,
    properties: { ...textLookProperties({ style: "body", face: "sans", paper: null, colour: null, font: null }), ...handoffProperties(done2) }
  }, group);
  for (const op of frames) await deps.sendOp(ctx, p.id, op, group);
  return { itemId: noteId, note: done2 };
}
async function rewriteNote(ctx, deps, canvasId, item, note2, group) {
  const body = noteText(note2);
  await deps.sendOp(ctx, canvasId, { type: "item.addVersion", itemId: item.id, version: await upload(ctx, canvasId, Buffer.from(body, "utf8"), TEXT_MIME, TEXT_FILENAME) }, group);
  await deps.sendOp(ctx, canvasId, { type: "item.update", itemId: item.id, patch: { properties: handoffProperties(note2) } }, group);
  const box = handoffBox(body);
  if (box.height > item.height) await deps.sendOp(ctx, canvasId, { type: "item.resize", itemId: item.id, width: Math.max(item.width, box.width), height: box.height }, group);
}
async function start(ctx, deps, words) {
  const { canvas: p, snapshot } = await deps.canvasAndSnapshot(ctx);
  const seen = await seeing(ctx, p.id, snapshot);
  const lead = nightLead(snapshot.canvas, p.properties ?? {}, seen);
  const cannot = nightAnswerable(lead, ctx.actor.id, seen);
  const said = words.join(" ").trim();
  const asked = await sayInChat(ctx, deps, p.id, snapshot, `/goodnight${lead.agent ? ` @${lead.agent.actor.name}` : ""}${said ? ` ${said}` : ""}`);
  if (cannot) {
    const now = Date.now();
    const entries = await ctx.client.getLog(p.id, 0).catch(() => []);
    const plan2 = planNight({ canvas: snapshot.canvas, person: ctx.actor, lead: lead.agent?.actor ?? ctx.actor, cannotAnswer: cannot, asks: [], named: [], settled: [], others: /* @__PURE__ */ new Map() });
    const note2 = {
      person: ctx.actor,
      lead: lead.agent?.actor ?? null,
      settled: settledToday(snapshot.canvas, entries, ctx.actor.id, startOfToday(now), snapshot.joined),
      open: leftOpen(snapshot.canvas),
      lines: [],
      wont: [],
      ready: readyAt("8:00", now),
      ..."nothing" in plan2 && plan2.nothing ? { nothing: plan2.nothing } : {},
      named: [],
      titles: {}
    };
    const written = await writeNote(ctx, deps, p, snapshot, note2);
    if (ctx.json) return deps.printJson({ ...asked, answerable: false, why: cannot, noteId: written.itemId, promised: 0 });
    console.log(`Nothing can answer overnight: ${cannot}.`);
    console.log(`The note says so and promises nothing (${written.itemId}).`);
    return;
  }
  const name = lead.agent.actor.name;
  if (ctx.json) return deps.printJson({ ...asked, answerable: true, lead: lead.agent.actor, how: lead.how });
  console.log(`asked ${name} in the Chat${lead.how === "named" ? "" : " (the canvas's standing agent \u2014 name a lead with `isocan canvas edit --prop proactive=<name>`)"}.`);
  console.log(`${name} opens with what it read and what it could try; steer it with \`isocan comment reply ${asked.threadId} "\u2026"\`, and when that's the plan: \`isocan goodnight plan\`.`);
}
async function plan(ctx, deps, words) {
  const { canvas: p, snapshot } = await deps.canvasAndSnapshot(ctx);
  const talk = goodnightTalk(snapshot.canvas, mainThread(snapshot.canvas), ctx.actor.id, snapshot.joined);
  if (!talk) throw new Error("you have not said /goodnight here \u2014 `isocan goodnight` opens the conversation first");
  if (talk.planned) throw new Error("you already said that's the plan \u2014 the note is the lead's to write now");
  const seen = await seeing(ctx, p.id, snapshot);
  const lead = nightLead(snapshot.canvas, p.properties ?? {}, seen);
  const said = words.join(" ").trim();
  const asked = await sayInChat(ctx, deps, p.id, snapshot, `That's the plan.${lead.agent ? ` @${lead.agent.actor.name}` : ""}${said ? ` ${said}` : ""}`, { goodnight: { step: "plan" } });
  if (ctx.json) return deps.printJson({ ...asked, lead: lead.agent?.actor ?? null });
  console.log(`that's the plan \u2014 ${lead.agent?.actor.name ?? "the lead"} writes the note and starts the night's work. Untick a line with \`isocan goodnight untick <n>\`.`);
}
function latestNote(snapshot, person) {
  const found = goodnightNotes(snapshot.canvas).find(({ note: note2 }) => sameActor(snapshot.joined, note2.person.id, person.id));
  if (!found) throw new Error(`${person.name} has no goodnight note on this canvas`);
  return found;
}
async function show(ctx, deps, opts) {
  const { snapshot } = await deps.canvasAndSnapshot(ctx);
  const person = opts.for ? personOn(snapshot, opts.for) : ctx.actor;
  const { item, note: note2 } = latestNote(snapshot, person);
  if (ctx.json) return deps.printJson({ itemId: item.id, ...note2 });
  console.log(noteText(note2));
}
async function untick(ctx, deps, n) {
  const { canvas: p, snapshot } = await deps.canvasAndSnapshot(ctx);
  const { item, note: note2 } = latestNote(snapshot, ctx.actor);
  const out = untickLine(note2, Number(n));
  if ("refused" in out) throw new Error(out.refused);
  const group = newGroupId();
  await rewriteNote(ctx, deps, p.id, item, out.note, group);
  if (out.frame && snapshot.canvas.items[out.frame]) await deps.sendOp(ctx, p.id, { type: "item.delete", itemId: out.frame }, group);
  if (ctx.json) return deps.printJson({ itemId: item.id, line: Number(n), removed: out.frame ?? null });
  console.log(`unticked line ${n} \u2014 an offer now, not a promise${out.frame ? "; its frame is gone" : ""}.`);
}
async function read(ctx, deps, opts) {
  const { canvas: p, snapshot } = await deps.canvasAndSnapshot(ctx);
  const person = whose(snapshot, opts.for);
  const now = Date.now();
  const seen = await seeing(ctx, p.id, snapshot);
  const lead = nightLead(snapshot.canvas, p.properties ?? {}, seen);
  const thread = mainThread(snapshot.canvas);
  const talk = goodnightTalk(snapshot.canvas, thread, person.id, snapshot.joined);
  const entries = await ctx.client.getLog(p.id, 0).catch(() => []);
  const youLead = Boolean(lead.agent && sameActor(snapshot.joined, lead.agent.actor.id, ctx.actor.id));
  const cannot = youLead ? null : nightAnswerable(lead, person.id, seen);
  const others = [...namedByOthers(snapshot.canvas, thread, person.id, now, snapshot.joined)].map(([itemId, by]) => ({ itemId, title: snapshot.canvas.items[itemId]?.title ?? itemId, by: by.name }));
  const roomFor = lead.agent ? proposalRoom(snapshot.canvas, lead.agent.actor.id) : 0;
  const out = {
    person,
    lead: lead.agent ? { ...lead.agent.actor, how: lead.how } : null,
    youLead,
    answerable: cannot === null,
    ...cannot ? { why: cannot } : {},
    room: roomFor,
    settled: settledToday(snapshot.canvas, entries, person.id, startOfToday(now), snapshot.joined),
    open: leftOpen(snapshot.canvas),
    conversation: talk ? { askId: talk.ask.id, planned: talk.planned, named: talk.named.map((id) => ({ itemId: id, title: snapshot.canvas.items[id]?.title ?? id })) } : null,
    namedByOthers: others
  };
  if (ctx.json) return deps.printJson(out);
  console.log(`${person.name}'s goodnight \u2014 ${out.lead ? `${out.lead.name} leads${youLead ? " (you)" : ""}` : "nobody leads"}; ${out.answerable ? "something can answer overnight" : `nothing can answer: ${cannot}`}; room for ${roomFor} proposal${roomFor === 1 ? "" : "s"}.`);
  console.log("Settled today:");
  for (const s of out.settled) console.log(`  - ${s.what}  [${s.cite.kind}:${s.cite.ref}]`);
  if (!out.settled.length) console.log("  - nothing yet");
  console.log("Left open:");
  for (const s of out.open) console.log(`  - ${s.what}  [${s.cite.kind}:${s.cite.ref}]`);
  if (!out.open.length) console.log("  - nothing");
  if (out.conversation) console.log(`They have named: ${out.conversation.named.map((n) => n.title).join(", ") || "nothing yet"}${out.conversation.planned ? " \u2014 and said that's the plan: write the note" : ""}.`);
  for (const o of others) console.log(`Not yours tonight: \u201C${o.title}\u201D is in ${o.by}'s goodnight.`);
}
async function note(ctx, deps, opts) {
  const { canvas: p, snapshot } = await deps.canvasAndSnapshot(ctx);
  const person = whose(snapshot, opts.for);
  const thread = mainThread(snapshot.canvas);
  const talk = goodnightTalk(snapshot.canvas, thread, person.id, snapshot.joined);
  if (!talk) throw new Error(`${person.name} has not said /goodnight here \u2014 the note follows a conversation`);
  if (!talk.planned) {
    throw new Error(`${person.name} has not said "That's the plan" yet \u2014 keep talking; the note is written only when they end the conversation`);
  }
  const seen = await seeing(ctx, p.id, snapshot);
  const lead = nightLead(snapshot.canvas, p.properties ?? {}, seen);
  if (!lead.agent || !sameActor(snapshot.joined, lead.agent.actor.id, ctx.actor.id)) {
    throw new Error(`${lead.agent?.actor.name ?? "nobody"} leads this canvas's night, not you \u2014 the lead writes the note`);
  }
  const now = Date.now();
  const iso = opts.ready && /\dT\d/.test(opts.ready) && !Number.isNaN(Date.parse(opts.ready)) ? new Date(opts.ready).toISOString() : null;
  const ready = iso ?? readyAt(opts.ready ?? "8:00", now);
  if (!ready) throw new Error(`"${opts.ready}" is not a time \u2014 write --ready 08:00`);
  const asks = [...(opts.promise ?? []).map((raw) => parseLine(snapshot, raw, false)), ...(opts.edit ?? []).map((raw) => parseLine(snapshot, raw, true))];
  const entries = await ctx.client.getLog(p.id, 0).catch(() => []);
  const settled = settledToday(snapshot.canvas, entries, person.id, startOfToday(now), snapshot.joined);
  const midway = midwayItems(snapshot.canvas, entries, person.id, Date.parse(talk.ask.createdAt), snapshot.joined);
  const planned = planNight({
    canvas: snapshot.canvas,
    person,
    lead: ctx.actor,
    // The lead is answering now — this turn is the night's work.
    cannotAnswer: null,
    asks,
    named: talk.named,
    settled,
    others: namedByOthers(snapshot.canvas, thread, person.id, now, snapshot.joined),
    midway
  });
  if ("refused" in planned) throw new Error(planned.refused);
  const titles = {};
  for (const line of planned.lines) titles[line.on] = snapshot.canvas.items[line.on]?.title ?? line.on;
  const written = await writeNote(ctx, deps, p, snapshot, {
    person,
    lead: ctx.actor,
    settled,
    open: [...leftOpen(snapshot.canvas), ...(opts.open ?? []).map(parseOpen)],
    lines: planned.lines,
    wont: (opts.wont ?? []).map((w) => w.trim()).filter(Boolean),
    ...opts.thought?.trim() ? { thought: opts.thought.trim() } : {},
    ready,
    ...planned.nothing ? { nothing: planned.nothing } : {},
    named: talk.named,
    titles: { ...titles, ...Object.fromEntries(midway.map((id) => [id, snapshot.canvas.items[id]?.title ?? id])) },
    ...midway.length ? { midway } : {}
  });
  if (ctx.json) return deps.printJson({ noteId: written.itemId, lines: written.note.lines, nothing: written.note.nothing ?? null });
  console.log(`wrote ${person.name}'s note (${written.itemId})${written.note.nothing ? ` \u2014 ${written.note.nothing}` : ""}`);
  for (const line of written.note.lines) {
    console.log(`  ${line.n}. ${line.text} \u2014 ${line.edit ? `edit ${line.on}: isocan goodnight fill ${line.on} <file>` : `frame ${line.frame}: isocan goodnight fill ${line.frame} <file>`}`);
  }
}
async function fill(ctx, deps, ref, file, opts) {
  const { canvas: p, snapshot } = await deps.canvasAndSnapshot(ctx);
  const item = deps.resolveItem(snapshot, ref);
  const target = fillTarget(snapshot.canvas, ctx.actor.id, item.id, Date.now());
  if ("refused" in target) throw new Error(target.refused);
  const reason = opts.failed?.replace(/\s+/g, " ").trim();
  if (opts.failed !== void 0 && !reason) throw new Error('a promise that did not work says why \u2014 --failed "<the reason>"');
  if (!reason && !file) throw new Error('fill it with the work \u2014 a file \u2014 or fail it with --failed "<the reason>"');
  const group = newGroupId();
  const version = file ? await upload(ctx, p.id, await fs.readFile(file), deps.mimeFor(path.basename(file)), path.basename(file)) : await upload(ctx, p.id, Buffer.from(`Nothing worth showing: ${reason}
`, "utf8"), TEXT_MIME, TEXT_FILENAME);
  if (target.kind === "frame") {
    await deps.sendOp(ctx, p.id, { type: "item.addVersion", itemId: item.id, version }, group);
    const properties = reason ? { [PROPOSAL_PROP]: "failed", [PROPOSAL_WHY_PROP]: reason.slice(0, 400), ...file ? { [PROMISE_TAKE_PROP]: "1" } : {} } : { [PROPOSAL_PROP]: opts.hunch ? "hunch" : "sure", [PROPOSAL_WHY_PROP]: (opts.why?.trim() || target.line.text).replace(/\s+/g, " ").slice(0, 400) };
    await deps.sendOp(ctx, p.id, { type: "item.update", itemId: item.id, patch: { properties, title: `${snapshot.canvas.items[target.line.on]?.title ?? "Untitled"} \u2014 tonight` } }, group);
  } else if (!reason) {
    await deps.sendOp(ctx, p.id, { type: "item.addVersion", itemId: item.id, version }, group);
  }
  const answered = answerLine(target.note, target.line.n, reason ? { failed: reason } : { done: true });
  await rewriteNote(ctx, deps, p.id, target.noteItem, answered, group);
  if (ctx.json) return deps.printJson({ itemId: item.id, line: target.line.n, kind: target.kind, failed: reason ?? null });
  console.log(`line ${target.line.n} ${reason ? `did not work: ${reason}` : target.kind === "edit" ? `\u2014 a new version of \u201C${item.title}\u201D` : "\u2014 filled"}.`);
}
async function done(ctx, deps, words, opts) {
  const { canvas: p, snapshot } = await deps.canvasAndSnapshot(ctx);
  const mine = goodnightNotes(snapshot.canvas).filter(({ note: note2 }) => note2.lead && sameActor(snapshot.joined, note2.lead.id, ctx.actor.id));
  const found = opts.for ? mine.find(({ note: note2 }) => sameActor(snapshot.joined, note2.person.id, personOn(snapshot, opts.for).id)) : mine[0];
  if (!found) throw new Error("you have written no goodnight note here");
  const refused = briefRefusal(found.note);
  if (refused) throw new Error(refused);
  const brief = words.join(" ").trim();
  if (!brief) throw new Error("say how the night went \u2014 highest confidence first, and what you left alone");
  const left = (opts.left ?? []).map((raw) => {
    const [what, why] = raw.split("|").map((part) => part.replace(/\s+/g, " ").trim());
    if (!what || !why) throw new Error(`"${raw}" is not a line \u2014 write "<what you left alone> | <why>"`);
    return { what, why };
  });
  if (left.length) await rewriteNote(ctx, deps, p.id, found.item, { ...found.note, left: [...found.note.left ?? [], ...left] }, newGroupId());
  const said = await sayInChat(ctx, deps, p.id, snapshot, brief, { record: true, goodnight: { step: "brief", note: found.item.id } });
  if (ctx.json) return deps.printJson({ ...said, noteId: found.item.id });
  console.log(`the night's brief is in the Chat for ${found.note.person.name} (${said.commentId}).`);
}
async function review(ctx, deps, opts) {
  const { canvas: p, snapshot } = await deps.canvasAndSnapshot(ctx);
  const person = opts.for ? personOn(snapshot, opts.for) : ctx.actor;
  const { item } = latestNote(snapshot, person);
  const now = Date.now();
  const mark = sameActor(snapshot.joined, person.id, ctx.actor.id) ? (await ctx.client.seen(ctx.actor.id, p.id).catch(() => null))?.marks[p.id] ?? null : null;
  const due = morningDue(snapshot.canvas, person.id, mark, now, snapshot.joined);
  const out = nightReview(snapshot.canvas, item.id, now, snapshot.joined);
  if (ctx.json) return deps.printJson({ ...out, due: "noteId" in due, ..."not" in due ? { notDue: due.not } : {} });
  console.log(morningText(out));
  if ("not" in due) console.log(`
(the canvas would not show this now: ${due.not})`);
}
export {
  done,
  fill,
  note,
  plan,
  read,
  review,
  show,
  start,
  untick
};
