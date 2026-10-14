import { promises as fs } from "node:fs";
import path from "node:path";
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
  leftOpen,
  mainThread,
  namedByOthers,
  newGroupId,
  newItemId,
  newThreadId,
  newVersionId,
  nightAnswerable,
  nightLead,
  handoffProperties,
  handoffSpot,
  noteText,
  parseCite,
  planNight,
  promiseProperties,
  promisedPlaceholder,
  proposalRoom,
  readyAt,
  sameActor,
  settledToday,
  handoffBox,
  textLookProperties,
  untickLine,
  type Actor,
  type Canvas,
  type CanvasContents,
  type CanvasSnapshotResponse,
  type Item,
  type NewComment,
  type NightAsk,
  type NightCited,
  type NightNote,
  type NightSeen,
  type Operation,
} from "@isocan/core";
import type { Ctx } from "./ctx.ts";
import { beneath } from "./propose.ts";

/**
 * **`isocan goodnight`** (proactive-agent phase 2, design §4) — the night
 * watch from a terminal, both halves of it:
 *
 * - **the person's**: `goodnight` opens the conversation (a `/goodnight` in
 *   the Chat, to the lead agent), `plan` ends it ("That's the plan"),
 *   `untick` takes a line off tonight's list, `show` reads the note;
 * - **the lead agent's**: `read` is everything the night reads, `note`
 *   writes the note and its promised frames from what was agreed, `fill`
 *   answers one promise (or fails it, with a reason), `done` posts the brief.
 *
 * The rules are core's (`goodnight.ts`) so the web and this file cannot
 * disagree; this is the wire. Loaded on these verbs only, with main's
 * helpers handed in (`propose.ts`'s reason: a module shared with main's chunk
 * would become a chunk `--version` loads).
 */
export interface GoodnightDeps {
  canvasAndSnapshot: (ctx: Ctx) => Promise<{ canvas: Canvas; snapshot: CanvasSnapshotResponse }>;
  resolveItem: (snapshot: CanvasSnapshotResponse, ref: string) => Item;
  sendOp: (ctx: Ctx, canvasId: string, op: Operation, group?: string) => Promise<unknown>;
  /** A comment as main writes one: mentions and #-references resolved. */
  newComment: (ctx: Ctx, canvasId: string, snapshot: CanvasSnapshotResponse, body: string) => Promise<NewComment>;
  mimeFor: (filename: string) => string;
  printJson: (value: unknown) => void;
}

/** Who is listening, as this terminal can see it. */
async function seeing(ctx: Ctx, canvasId: string, snapshot: CanvasSnapshotResponse): Promise<NightSeen> {
  const [answering, sessions] = await Promise.all([
    ctx.client.rcAnswering(canvasId).catch(() => null),
    ctx.client.listSessions(canvasId).catch(() => []),
  ]);
  return { answering, sessions, ...(snapshot.joined ? { joined: snapshot.joined } : {}) };
}

/** Say something in the Chat, with machinery's data on it; the thread is born if this is the first word. */
async function sayInChat(ctx: Ctx, deps: GoodnightDeps, canvasId: string, snapshot: CanvasSnapshotResponse, body: string, extra: Partial<NewComment> = {}) {
  const comment = { ...(await deps.newComment(ctx, canvasId, snapshot, body)), ...extra };
  const main = mainThread(snapshot.canvas);
  if (main) {
    await deps.sendOp(ctx, canvasId, { type: "thread.reply", threadId: main.id, comment });
    return { threadId: main.id, commentId: comment.id };
  }
  const threadId = newThreadId();
  await deps.sendOp(ctx, canvasId, { type: "thread.create", threadId, x: 0, y: 0, anchorItemId: null, main: true, comment });
  return { threadId, commentId: comment.id };
}

/** Local midnight: where "today" starts for *settled today*. */
function startOfToday(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** A person named on this canvas — by id or name — among the people who said `/goodnight` here or wrote anything. */
function personOn(snapshot: CanvasSnapshotResponse, ref: string): Actor {
  const want = ref.trim().toLowerCase();
  const seen = new Map<string, Actor>();
  for (const thread of Object.values(snapshot.canvas.threads)) for (const c of thread.comments) seen.set(c.author.id, c.author);
  for (const item of Object.values(snapshot.canvas.items)) seen.set(item.createdBy.id, item.createdBy);
  const named = (a: Actor) => (snapshot.names?.[a.id] ?? a.name).toLowerCase();
  const found = [...seen.values()].find((a) => a.id === ref || named(a) === want);
  if (!found) throw new Error(`nobody called "${ref}" has written on this canvas`);
  return { id: found.id, name: snapshot.names?.[found.id] ?? found.name };
}

/**
 * Whose goodnight the agent means: `--for`, else whoever's conversation is
 * the most recent one with no note written after it.
 */
function whose(snapshot: CanvasSnapshotResponse, ref: string | undefined): Actor {
  if (ref) return personOn(snapshot, ref);
  const thread = mainThread(snapshot.canvas);
  const asks = (thread?.comments ?? []).filter((c) => /^\s*\/goodnight(\s|$)/.test(c.body)).reverse();
  const notes = goodnightNotes(snapshot.canvas);
  for (const ask of asks) {
    const written = notes.find(({ note }) => sameActor(snapshot.joined, note.person.id, ask.author.id));
    if (!written || written.item.createdAt < ask.createdAt) return { id: ask.author.id, name: snapshot.names?.[ask.author.id] ?? ask.author.name };
  }
  throw new Error("nobody has said /goodnight here — name the person with --for <name>");
}

/** `<item> | <text> | <budget>`, as `--promise` and `--edit` take a line. */
function parseLine(snapshot: CanvasSnapshotResponse, raw: string, edit: boolean): NightAsk {
  const [ref, text, budget] = raw.split("|").map((part) => part.trim());
  if (!ref || !text) throw new Error(`"${raw}" is not a line — write "<item> | <what you will do> | <budget>"`);
  return { on: snapshot.canvas.items[ref] ? ref : resolveRef(snapshot, ref), text, edit, ...(budget ? { budget } : {}) };
}

function resolveRef(snapshot: CanvasSnapshotResponse, ref: string): string {
  const want = ref.toLowerCase();
  const hit = Object.values(snapshot.canvas.items).find((item) => item.title.toLowerCase() === want);
  return hit?.id ?? ref;
}

/** `kind:ref | words`, as `--open` takes a doubt the agent read today. */
function parseOpen(raw: string): NightCited {
  const at = raw.indexOf("|");
  const cite = parseCite(at > 0 ? raw.slice(0, at).trim() : "");
  if ("refused" in cite || at < 0 || !raw.slice(at + 1).trim()) {
    throw new Error(`"${raw}" is not a doubt — write "comment:<id> | what was said", citing where you read it`);
  }
  return { what: raw.slice(at + 1).trim(), cite };
}

async function upload(ctx: Ctx, canvasId: string, bytes: Buffer, mimeType: string, filename: string) {
  const blob = await ctx.client.uploadBlob(canvasId, bytes, mimeType, filename);
  return { id: newVersionId(), blobHash: blob.blobHash, mimeType, filename, size: blob.size };
}

/**
 * **Write a note and its promised frames, as one undo.** Each ticked
 * proposal line gets an empty dashed frame beneath its item (placed the way
 * `propose` places one, clear of everything already there and of each
 * other); the note goes to the right of the work it concerns, clear of all
 * of it. With no lines, it stands beside everything.
 */
async function writeNote(ctx: Ctx, deps: GoodnightDeps, p: Canvas, snapshot: CanvasSnapshotResponse, note: NightNote): Promise<{ itemId: string; note: NightNote }> {
  const noteId = newItemId();
  const group = newGroupId();
  const canvas: CanvasContents = { ...snapshot.canvas, items: { ...snapshot.canvas.items } };
  const frames: Operation[] = [];
  const lines = note.lines.map((line) => ({ ...line }));
  for (const line of lines) {
    if (line.edit || !line.ticked) continue;
    const source = canvas.items[line.on]!;
    const html = /html/.test(source.versions.find((v) => v.id === source.currentVersionId)?.mimeType ?? "");
    const filename = html ? "promised.html" : TEXT_FILENAME;
    const mimeType = html ? "text/html" : TEXT_MIME;
    const version = await upload(ctx, p.id, Buffer.from(promisedPlaceholder(line, html), "utf8"), mimeType, filename);
    const size = { width: source.width, height: source.height };
    const at = beneath(canvas, source, size);
    line.frame = newItemId();
    // The frame is on the canvas for every later placement in this note.
    canvas.items[line.frame] = { ...source, id: line.frame, x: at.x, y: at.y, properties: {} };
    frames.push({
      type: "item.add",
      itemId: line.frame,
      version,
      ...size,
      placement: at,
      title: `${source.title || "Untitled"} — promised tonight`,
      properties: promiseProperties(noteId, line),
    });
  }
  const done: NightNote = { ...note, lines };
  const body = noteText(done);
  const box = handoffBox(body);
  const spot = handoffSpot(canvas, lines.map((l) => l.on), box);
  await deps.sendOp(ctx, p.id, {
    type: "item.add",
    itemId: noteId,
    version: await upload(ctx, p.id, Buffer.from(body, "utf8"), TEXT_MIME, TEXT_FILENAME),
    ...box,
    placement: { ...spot, chosen: true },
    title: `Goodnight, ${note.person.name}`,
    properties: { ...textLookProperties({ style: "body", face: "sans", paper: null, colour: null, font: null }), ...handoffProperties(done) },
  }, group);
  for (const op of frames) await deps.sendOp(ctx, p.id, op, group);
  return { itemId: noteId, note: done };
}

/** The note's text and model, rewritten together — one more version, so the night's history is the note's. */
async function rewriteNote(ctx: Ctx, deps: GoodnightDeps, canvasId: string, item: Item, note: NightNote, group: string): Promise<void> {
  const body = noteText(note);
  await deps.sendOp(ctx, canvasId, { type: "item.addVersion", itemId: item.id, version: await upload(ctx, canvasId, Buffer.from(body, "utf8"), TEXT_MIME, TEXT_FILENAME) }, group);
  await deps.sendOp(ctx, canvasId, { type: "item.update", itemId: item.id, patch: { properties: handoffProperties(note) } }, group);
  const box = handoffBox(body);
  if (box.height > item.height) await deps.sendOp(ctx, canvasId, { type: "item.resize", itemId: item.id, width: Math.max(item.width, box.width), height: box.height }, group);
}

// ---------- the person's half

/** `isocan goodnight [words…]` — stopping for the day: open the conversation with the lead. */
export async function start(ctx: Ctx, deps: GoodnightDeps, words: string[]): Promise<void> {
  const { canvas: p, snapshot } = await deps.canvasAndSnapshot(ctx);
  const seen = await seeing(ctx, p.id, snapshot);
  const lead = nightLead(snapshot.canvas, p.properties ?? {}, seen);
  const cannot = nightAnswerable(lead, ctx.actor.id, seen);
  const said = words.join(" ").trim();
  const asked = await sayInChat(ctx, deps, p.id, snapshot, `/goodnight${lead.agent ? ` @${lead.agent.actor.name}` : ""}${said ? ` ${said}` : ""}`);
  if (cannot) {
    // Nothing will answer the conversation, so nothing could be agreed: the
    // note is written here, from what the canvas says, and promises nothing.
    const now = Date.now();
    const entries = await ctx.client.getLog(p.id, 0).catch(() => []);
    const plan = planNight({ canvas: snapshot.canvas, person: ctx.actor, lead: lead.agent?.actor ?? ctx.actor, cannotAnswer: cannot, asks: [], named: [], settled: [], others: new Map() });
    const note: NightNote = {
      person: ctx.actor,
      lead: lead.agent?.actor ?? null,
      settled: settledToday(snapshot.canvas, entries, ctx.actor.id, startOfToday(now), snapshot.joined),
      open: leftOpen(snapshot.canvas),
      lines: [],
      wont: [],
      ready: readyAt("8:00", now)!,
      ...("nothing" in plan && plan.nothing ? { nothing: plan.nothing } : {}),
      named: [],
      titles: {},
    };
    const written = await writeNote(ctx, deps, p, snapshot, note);
    if (ctx.json) return deps.printJson({ ...asked, answerable: false, why: cannot, noteId: written.itemId, promised: 0 });
    console.log(`Nothing can answer overnight: ${cannot}.`);
    console.log(`The note says so and promises nothing (${written.itemId}).`);
    return;
  }
  const name = lead.agent!.actor.name;
  if (ctx.json) return deps.printJson({ ...asked, answerable: true, lead: lead.agent!.actor, how: lead.how });
  console.log(`asked ${name} in the Chat${lead.how === "named" ? "" : " (the canvas's standing agent — name a lead with `isocan canvas edit --prop proactive=<name>`)"}.`);
  console.log(`${name} opens with what it read and what it could try; steer it with \`isocan comment reply ${asked.threadId} "…"\`, and when that's the plan: \`isocan goodnight plan\`.`);
}

/** `isocan goodnight plan [words…]` — "That's the plan": the conversation ends, and the lead writes the note. */
export async function plan(ctx: Ctx, deps: GoodnightDeps, words: string[]): Promise<void> {
  const { canvas: p, snapshot } = await deps.canvasAndSnapshot(ctx);
  const talk = goodnightTalk(snapshot.canvas, mainThread(snapshot.canvas), ctx.actor.id, snapshot.joined);
  if (!talk) throw new Error("you have not said /goodnight here — `isocan goodnight` opens the conversation first");
  if (talk.planned) throw new Error("you already said that's the plan — the note is the lead's to write now");
  const seen = await seeing(ctx, p.id, snapshot);
  const lead = nightLead(snapshot.canvas, p.properties ?? {}, seen);
  const said = words.join(" ").trim();
  const asked = await sayInChat(ctx, deps, p.id, snapshot, `That's the plan.${lead.agent ? ` @${lead.agent.actor.name}` : ""}${said ? ` ${said}` : ""}`, { goodnight: { step: "plan" } });
  if (ctx.json) return deps.printJson({ ...asked, lead: lead.agent?.actor ?? null });
  console.log(`that's the plan — ${lead.agent?.actor.name ?? "the lead"} writes the note and starts the night's work. Untick a line with \`isocan goodnight untick <n>\`.`);
}

/** The person's latest note, or the one `--for` names. */
function latestNote(snapshot: CanvasSnapshotResponse, person: Actor): { item: Item; note: NightNote } {
  const found = goodnightNotes(snapshot.canvas).find(({ note }) => sameActor(snapshot.joined, note.person.id, person.id));
  if (!found) throw new Error(`${person.name} has no goodnight note on this canvas`);
  return found;
}

/** `isocan goodnight show [--for <who>]` — the note, as the person reads it. */
export async function show(ctx: Ctx, deps: GoodnightDeps, opts: { for?: string }): Promise<void> {
  const { snapshot } = await deps.canvasAndSnapshot(ctx);
  const person = opts.for ? personOn(snapshot, opts.for) : ctx.actor;
  const { item, note } = latestNote(snapshot, person);
  if (ctx.json) return deps.printJson({ itemId: item.id, ...note });
  console.log(noteText(note));
}

/** `isocan goodnight untick <n>` — line n stays on the note as an offer, and its empty frame goes; one undo. */
export async function untick(ctx: Ctx, deps: GoodnightDeps, n: string): Promise<void> {
  const { canvas: p, snapshot } = await deps.canvasAndSnapshot(ctx);
  const { item, note } = latestNote(snapshot, ctx.actor);
  const out = untickLine(note, Number(n));
  if ("refused" in out) throw new Error(out.refused);
  const group = newGroupId();
  await rewriteNote(ctx, deps, p.id, item, out.note, group);
  if (out.frame && snapshot.canvas.items[out.frame]) await deps.sendOp(ctx, p.id, { type: "item.delete", itemId: out.frame }, group);
  if (ctx.json) return deps.printJson({ itemId: item.id, line: Number(n), removed: out.frame ?? null });
  console.log(`unticked line ${n} — an offer now, not a promise${out.frame ? "; its frame is gone" : ""}.`);
}

// ---------- the lead's half

/** `isocan goodnight read [--for <who>]` — everything the night reads, for the lead's opener. */
export async function read(ctx: Ctx, deps: GoodnightDeps, opts: { for?: string }): Promise<void> {
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
    ...(cannot ? { why: cannot } : {}),
    room: roomFor,
    settled: settledToday(snapshot.canvas, entries, person.id, startOfToday(now), snapshot.joined),
    open: leftOpen(snapshot.canvas),
    conversation: talk ? { askId: talk.ask.id, planned: talk.planned, named: talk.named.map((id) => ({ itemId: id, title: snapshot.canvas.items[id]?.title ?? id })) } : null,
    namedByOthers: others,
  };
  if (ctx.json) return deps.printJson(out);
  console.log(`${person.name}'s goodnight — ${out.lead ? `${out.lead.name} leads${youLead ? " (you)" : ""}` : "nobody leads"}; ${out.answerable ? "something can answer overnight" : `nothing can answer: ${cannot}`}; room for ${roomFor} proposal${roomFor === 1 ? "" : "s"}.`);
  console.log("Settled today:");
  for (const s of out.settled) console.log(`  - ${s.what}  [${s.cite.kind}:${s.cite.ref}]`);
  if (!out.settled.length) console.log("  - nothing yet");
  console.log("Left open:");
  for (const s of out.open) console.log(`  - ${s.what}  [${s.cite.kind}:${s.cite.ref}]`);
  if (!out.open.length) console.log("  - nothing");
  if (out.conversation) console.log(`They have named: ${out.conversation.named.map((n) => n.title).join(", ") || "nothing yet"}${out.conversation.planned ? " — and said that's the plan: write the note" : ""}.`);
  for (const o of others) console.log(`Not yours tonight: “${o.title}” is in ${o.by}'s goodnight.`);
}

/** `isocan goodnight note …` — the lead writes the agreed note and its promised frames, once the person said that's the plan. */
export async function note(
  ctx: Ctx,
  deps: GoodnightDeps,
  opts: { for?: string; promise?: string[]; edit?: string[]; open?: string[]; wont?: string[]; thought?: string; ready?: string },
): Promise<void> {
  const { canvas: p, snapshot } = await deps.canvasAndSnapshot(ctx);
  const person = whose(snapshot, opts.for);
  const thread = mainThread(snapshot.canvas);
  const talk = goodnightTalk(snapshot.canvas, thread, person.id, snapshot.joined);
  if (!talk) throw new Error(`${person.name} has not said /goodnight here — the note follows a conversation`);
  if (!talk.planned) {
    throw new Error(`${person.name} has not said "That's the plan" yet — keep talking; the note is written only when they end the conversation`);
  }
  const seen = await seeing(ctx, p.id, snapshot);
  const lead = nightLead(snapshot.canvas, p.properties ?? {}, seen);
  if (!lead.agent || !sameActor(snapshot.joined, lead.agent.actor.id, ctx.actor.id)) {
    throw new Error(`${lead.agent?.actor.name ?? "nobody"} leads this canvas's night, not you — the lead writes the note`);
  }
  const now = Date.now();
  const ready = readyAt(opts.ready ?? "8:00", now);
  if (!ready) throw new Error(`"${opts.ready}" is not a time — write --ready 08:00`);
  const asks = [...(opts.promise ?? []).map((raw) => parseLine(snapshot, raw, false)), ...(opts.edit ?? []).map((raw) => parseLine(snapshot, raw, true))];
  const entries = await ctx.client.getLog(p.id, 0).catch(() => []);
  const settled = settledToday(snapshot.canvas, entries, person.id, startOfToday(now), snapshot.joined);
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
  });
  if ("refused" in planned) throw new Error(planned.refused);
  const titles: Record<string, string> = {};
  for (const line of planned.lines) titles[line.on] = snapshot.canvas.items[line.on]?.title ?? line.on;
  const written = await writeNote(ctx, deps, p, snapshot, {
    person,
    lead: ctx.actor,
    settled,
    open: [...leftOpen(snapshot.canvas), ...(opts.open ?? []).map(parseOpen)],
    lines: planned.lines,
    wont: (opts.wont ?? []).map((w) => w.trim()).filter(Boolean),
    ...(opts.thought?.trim() ? { thought: opts.thought.trim() } : {}),
    ready,
    ...(planned.nothing ? { nothing: planned.nothing } : {}),
    named: talk.named,
    titles,
  });
  if (ctx.json) return deps.printJson({ noteId: written.itemId, lines: written.note.lines, nothing: written.note.nothing ?? null });
  console.log(`wrote ${person.name}'s note (${written.itemId})${written.note.nothing ? ` — ${written.note.nothing}` : ""}`);
  for (const line of written.note.lines) {
    console.log(`  ${line.n}. ${line.text} — ${line.edit ? `edit ${line.on}: isocan goodnight fill ${line.on} <file>` : `frame ${line.frame}: isocan goodnight fill ${line.frame} <file>`}`);
  }
}

/** `isocan goodnight fill <item> [file] [--hunch] [--why …] [--failed <reason>]` — answer one promise. */
export async function fill(ctx: Ctx, deps: GoodnightDeps, ref: string, file: string | undefined, opts: { hunch?: boolean; why?: string; failed?: string }): Promise<void> {
  const { canvas: p, snapshot } = await deps.canvasAndSnapshot(ctx);
  const item = deps.resolveItem(snapshot, ref);
  const target = fillTarget(snapshot.canvas, ctx.actor.id, item.id, Date.now());
  if ("refused" in target) throw new Error(target.refused);
  const reason = opts.failed?.replace(/\s+/g, " ").trim();
  if (opts.failed !== undefined && !reason) throw new Error("a promise that did not work says why — --failed \"<the reason>\"");
  if (!reason && !file) throw new Error("fill it with the work — a file — or fail it with --failed \"<the reason>\"");
  const group = newGroupId();
  const version = file
    ? await upload(ctx, p.id, await fs.readFile(file), deps.mimeFor(path.basename(file)), path.basename(file))
    : await upload(ctx, p.id, Buffer.from(`Nothing worth showing: ${reason}\n`, "utf8"), TEXT_MIME, TEXT_FILENAME);
  if (target.kind === "frame") {
    await deps.sendOp(ctx, p.id, { type: "item.addVersion", itemId: item.id, version }, group);
    const properties = reason
      ? { [PROPOSAL_PROP]: "failed", [PROPOSAL_WHY_PROP]: reason.slice(0, 400), ...(file ? { [PROMISE_TAKE_PROP]: "1" } : {}) }
      : { [PROPOSAL_PROP]: opts.hunch ? "hunch" : "sure", [PROPOSAL_WHY_PROP]: (opts.why?.trim() || target.line.text).replace(/\s+/g, " ").slice(0, 400) };
    await deps.sendOp(ctx, p.id, { type: "item.update", itemId: item.id, patch: { properties, title: `${snapshot.canvas.items[target.line.on]?.title ?? "Untitled"} — tonight` } }, group);
  } else if (!reason) {
    // An original the person named for editing: a new version of it, so the
    // one before the night is one step back in its history.
    await deps.sendOp(ctx, p.id, { type: "item.addVersion", itemId: item.id, version }, group);
  }
  const answered = answerLine(target.note, target.line.n, reason ? { failed: reason } : { done: true });
  await rewriteNote(ctx, deps, p.id, target.noteItem, answered, group);
  if (ctx.json) return deps.printJson({ itemId: item.id, line: target.line.n, kind: target.kind, failed: reason ?? null });
  console.log(`line ${target.line.n} ${reason ? `did not work: ${reason}` : target.kind === "edit" ? `— a new version of “${item.title}”` : "— filled"}.`);
}

/** `isocan goodnight done <brief…>` — every promise answered: the night's brief, a record the morning finds. */
export async function done(ctx: Ctx, deps: GoodnightDeps, words: string[], opts: { for?: string }): Promise<void> {
  const { canvas: p, snapshot } = await deps.canvasAndSnapshot(ctx);
  const mine = goodnightNotes(snapshot.canvas).filter(({ note }) => note.lead && sameActor(snapshot.joined, note.lead.id, ctx.actor.id));
  const found = opts.for ? mine.find(({ note }) => sameActor(snapshot.joined, note.person.id, personOn(snapshot, opts.for!).id)) : mine[0];
  if (!found) throw new Error("you have written no goodnight note here");
  const refused = briefRefusal(found.note);
  if (refused) throw new Error(refused);
  const brief = words.join(" ").trim();
  if (!brief) throw new Error("say how the night went — highest confidence first, and what you left alone");
  const said = await sayInChat(ctx, deps, p.id, snapshot, brief, { record: true, goodnight: { step: "brief", note: found.item.id } });
  if (ctx.json) return deps.printJson({ ...said, noteId: found.item.id });
  console.log(`the night's brief is in the Chat for ${found.note.person.name} (${said.commentId}).`);
}
