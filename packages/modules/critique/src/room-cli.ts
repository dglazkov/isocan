import {
  anchorAtFraction,
  critiqueCannot,
  mainThread,
  newCommentId,
  newThreadId,
  nightLead,
  type Actor,
  type Canvas,
  type CanvasSnapshotResponse,
  type Item,
  type NewComment,
  type NightSeen,
} from "@isocan/core";
import type { CliHost, Ctx } from "@isocan/cli/modulehost";
import {
  CRITIC_PROP,
  NOTE_KINDS,
  criticItems,
  critiqueRead,
  findCritic,
  noteBody,
  readCritic,
  readNote,
  readWords,
  type CanvasCritic,
  type CritiqueNote,
  type NoteKind,
} from "./core.ts";
import {
  LOUDNESS,
  WHENS,
  bothAsked,
  loudRefusal,
  postedRoomRead,
  roomAskBody,
  roomAskFor,
  roomAsks,
  roomBothBody,
  roomRead,
  roomReadBody,
  roomSettings,
  settingsPatch,
  type RoomAsk,
} from "./room.ts";

/**
 * **Critics in the room, from a terminal** (proactive-agent phase 8) — the
 * bodies of `critic set`, `critique <item> --as`, `critique note --as`, and
 * the room's half of `critique read` and `critique both`. Loaded only when
 * one of them runs, so `isocan --version` reads none of it.
 *
 * Every critic here is a card on the canvas (the critique module's), worn by
 * the canvas's lead (`proactive=`, else its first standing agent): the
 * person asks, the lead writes each lens's notes as threads carrying
 * `persona`, and folds them into the read of the room. Nothing in this file
 * edits a screen.
 */

/** Every critic card on this canvas, read from its current bytes. */
async function cardsOn(ctx: Ctx, canvasId: string, snapshot: CanvasSnapshotResponse): Promise<(CanvasCritic & { item: Item })[]> {
  const out: (CanvasCritic & { item: Item })[] = [];
  for (const item of criticItems(snapshot.canvas.items)) {
    const v = item.versions.find((x) => x.id === item.currentVersionId) ?? item.versions[0];
    if (!v) continue;
    const critic = readCritic((await ctx.client.downloadBlob(canvasId, v.blobHash)).toString("utf8"), v.filename);
    if (critic) out.push({ itemId: item.id, critic, item });
  }
  return out;
}

/** The critic a ref names, or the refusal that lists what is here. */
function oneCritic<T extends CanvasCritic>(on: readonly T[], ref: string, canvasTitle: string): T {
  const hit = findCritic(on, ref, []);
  if (!hit) throw new Error(`no critic "${ref}" on ${canvasTitle} — \`isocan critic ls\` lists them; \`isocan critic add reductionist\` adds a starter lens`);
  return hit;
}

/** The canvas's lead, and why it cannot wear a lens for this person — null when it can. */
async function leadFor(ctx: Ctx, canvas: Canvas, snapshot: CanvasSnapshotResponse): Promise<{ lead: Actor | null; cannot: string | null }> {
  const [answering, sessions] = await Promise.all([ctx.client.rcAnswering(canvas.id).catch(() => null), ctx.client.listSessions(canvas.id).catch(() => [])]);
  const seen: NightSeen = { answering, sessions, ...(snapshot.joined ? { joined: snapshot.joined } : {}) };
  const lead = nightLead(snapshot.canvas, canvas.properties ?? {}, seen);
  return { lead: lead.agent?.actor ?? null, cannot: critiqueCannot(lead, ctx.actor.id, seen) ?? (lead.agent ? null : "no lead") };
}

/** Say something in the Chat; the thread is born if this is the first word. */
async function inChat(host: Pick<CliHost, "sendOp">, ctx: Ctx, canvasId: string, snapshot: CanvasSnapshotResponse, comment: NewComment): Promise<string> {
  const main = mainThread(snapshot.canvas);
  if (main) await host.sendOp(ctx, canvasId, { type: "thread.reply", threadId: main.id, comment } as never);
  else await host.sendOp(ctx, canvasId, { type: "thread.create", threadId: newThreadId(), x: 0, y: 0, anchorItemId: null, main: true, comment } as never);
  return comment.id;
}

/** `isocan critic set <critic> [--on|--off] [--loud …] [--when …]` — one `item.update`, one undo. */
export async function criticSet(host: CliHost, ctx: Ctx, ref: string, opts: { on?: boolean; off?: boolean; loud?: string; when?: string }): Promise<void> {
  if (opts.on && opts.off) throw new Error("--on or --off, not both");
  const canvas = await host.resolveCanvas(ctx);
  const snapshot = await ctx.client.snapshot(canvas.id);
  const hit = oneCritic(await cardsOn(ctx, canvas.id, snapshot), ref, canvas.title);
  const patch = settingsPatch({ ...(opts.on ? { on: true } : opts.off ? { on: false } : {}), ...(opts.loud !== undefined ? { loud: opts.loud } : {}), ...(opts.when !== undefined ? { when: opts.when } : {}) });
  if ("refused" in patch) throw new Error(patch.refused);
  if (Object.keys(patch).length) await host.sendOp(ctx, canvas.id, { type: "item.update", itemId: hit.itemId, patch: { properties: patch } } as never);
  const s = roomSettings({ properties: { ...hit.item.properties, ...patch } });
  if (ctx.json) return host.printJson({ itemId: hit.itemId, name: hit.critic.name, ...s });
  console.log(`${hit.critic.agentName}: ${s.on ? "on" : "off"} · ${LOUDNESS[s.loud].label.toLowerCase()} · ${WHENS[s.when].toLowerCase()}${Object.keys(patch).length ? "" : " (unchanged)"}`);
}

/**
 * `isocan critique <item> [--as <critic>…]` — the person asks the room. The
 * lenses named, or every critic switched on; the lead is asked in the Chat
 * to wear each one over the screen. Refused, writing nothing, when no lens
 * is on or nothing can wear them.
 */
export async function askRoom(host: CliHost, ctx: Ctx, ref: string, as: readonly string[]): Promise<void> {
  const canvas = await host.resolveCanvas(ctx);
  const snapshot = await ctx.client.snapshot(canvas.id);
  const item = host.resolveItem(snapshot, ref.replace(/^#/, ""));
  if (item.properties[CRITIC_PROP] !== undefined) throw new Error(`${item.title} is a critic's card — a crit is of a screen`);
  const on = await cardsOn(ctx, canvas.id, snapshot);
  const picked = as.length ? [...new Map(as.map((r) => oneCritic(on, r, canvas.title)).map((c) => [c.itemId, c])).values()] : on.filter((c) => roomSettings(c.item).on);
  if (!picked.length) throw new Error(`no critic is switched on in ${canvas.title} — \`isocan critic set <critic> --on\`, or name them: \`isocan critique ${item.id} --as reductionist,brand-voice\``);
  const off = picked.filter((c) => !roomSettings(c.item).on);
  if (off.length) throw new Error(`${off.map((c) => c.critic.agentName).join(" and ")} ${off.length === 1 ? "is" : "are"} switched off — \`isocan critic set ${off[0]!.critic.name} --on\` first`);
  const { lead, cannot } = await leadFor(ctx, canvas, snapshot);
  if (cannot || !lead) throw new Error(`nothing can wear the critics here: ${cannot ?? "no lead"}. Nothing was asked.`);
  const lenses = picked.map((c) => ({ name: c.critic.name, agentName: c.critic.agentName, loud: roomSettings(c.item).loud }));
  const commentId = await inChat(host, ctx, canvas.id, snapshot, {
    id: newCommentId(),
    body: roomAskBody(lead, [{ id: item.id, title: item.title, versionId: item.currentVersionId }], lenses, "asked"),
    mentions: [lead.id],
    items: [item.id],
  });
  if (ctx.json) return host.printJson({ commentId, lead, item: item.id, critics: lenses });
  console.log(`asked ${lead.name} to crit “${item.title}” as ${lenses.map((l) => l.agentName).join(" and ")} (${commentId}) — each lens on its own; its notes land as pins in the critic's colour, and \`isocan critique read ${item.id}\` sorts them`);
}

/**
 * `isocan critique note <item> --as <critic> --at <fx,fy> --kind … [--question n] "…"`
 * — the lead's note, worn as one critic: a thread on the screen whose first
 * comment carries `persona`. A comment, and nothing else: a lens cannot
 * edit. Refused for a critic switched off, and for a note quieter or one
 * more than its volume allows.
 */
export async function lensNote(host: CliHost, ctx: Ctx, ref: string, words: readonly string[], opts: { as: string; at: string; kind: string; question?: string }): Promise<void> {
  const canvas = await host.resolveCanvas(ctx);
  const snapshot = await ctx.client.snapshot(canvas.id);
  const item = host.resolveItem(snapshot, ref.replace(/^#/, ""));
  if (item.properties[CRITIC_PROP] !== undefined) throw new Error(`${item.title} is a critic's card — a note is pinned on a screen`);
  const hit = oneCritic(await cardsOn(ctx, canvas.id, snapshot), opts.as, canvas.title);
  const settings = roomSettings(hit.item);
  if (!settings.on) throw new Error(`${hit.critic.agentName} is switched off — the person switches a critic on (\`isocan critic set ${hit.critic.name} --on\`)`);
  const kind = opts.kind.trim().toLowerCase() as NoteKind;
  if (!NOTE_KINDS.includes(kind)) throw new Error(`--kind is one of ${NOTE_KINDS.join(", ")} — not "${opts.kind}"`);
  const questions = hit.critic.questions.length ? hit.critic.questions : [hit.critic.line];
  const question = opts.question === undefined ? 1 : Number(opts.question);
  if (!Number.isInteger(question) || question < 1 || question > questions.length) throw new Error(`--question is one of ${hit.critic.agentName}'s ${questions.length} questions, 1 to ${questions.length} — not "${opts.question}"`);
  const text = words.join(" ").trim();
  if (!text) throw new Error("a note says what the lens sees and one move — the text is empty");
  const ask = roomAskFor(snapshot.canvas, item.id);
  const said = Object.values(snapshot.canvas.threads)
    .map((t) => readNote(t, snapshot.canvas.items))
    .filter((n) => n !== null && n.persona === hit.critic.name && n.item === item.id && (!ask || n.createdAt >= ask.createdAt)).length;
  const refused = loudRefusal(hit.critic.agentName, settings.loud, kind, said);
  if (refused) throw new Error(refused);
  const [fx, fy] = opts.at.split(",").map((v) => Number(v.trim()));
  const offset = anchorAtFraction(item, { x: fx ?? Number.NaN, y: fy ?? Number.NaN });
  const threadId = newThreadId();
  const body = noteBody({ kind, question, questionText: questions[question - 1] ?? "", text });
  await host.sendOp(ctx, canvas.id, { type: "thread.create", threadId, ...offset, anchorItemId: item.id, comment: { id: newCommentId(), body, persona: hit.critic.name } } as never);
  if (ctx.json) return host.printJson({ threadId, item: item.id, persona: hit.critic.name, kind, question, at: { x: fx, y: fy } });
  console.log(`noted ${kind} on ${item.title} as ${hit.critic.agentName} at ${fx},${fy} (thread ${threadId})`);
}

/** The room's newest crit of this screen, when it is newer than any `--by` request — else null, and `critique read` reads the request. */
export function roomFor(snapshot: CanvasSnapshotResponse, itemId: string, requestAt: string | null): RoomAsk | null {
  const ask = roomAskFor(snapshot.canvas, itemId);
  return ask && (requestAt === null || ask.createdAt > requestAt) ? ask : null;
}

/**
 * The room's half of `isocan critique read <item> [--post --say "…"]` — the
 * read of the room for the newest crit of this screen: agree, split and
 * blocker, the lenses with nothing to say at their volume, and the lead's
 * words once posted. `--post` is the lead's: a record in the Chat.
 */
export async function readRoom(host: CliHost, ctx: Ctx, canvasId: string, snapshot: CanvasSnapshotResponse, item: Item, ask: RoomAsk, opts: { post?: boolean; say?: string }): Promise<void> {
  if (opts.say && !opts.post) throw new Error("--say is the words above a posted read — add --post");
  const r = roomRead(snapshot.canvas, ask, item.id);
  const title = (name: string) => criticItems(snapshot.canvas.items).find((i) => i.properties[CRITIC_PROP] === name)?.title || name;
  const silent = r.silent.map(title);
  const posted = postedRoomRead(snapshot.canvas, ask, item.id);
  if (opts.post) {
    if (posted) throw new Error(`the read of the room for this crit is already in the Chat (${posted.commentId})`);
    if (!r.notes.length) throw new Error(`no lens has said anything about ${item.title} since it was asked — write the notes first (\`isocan critique note ${item.id} --as <critic> …\`)`);
    const body = roomReadBody(item, ask, opts.say ?? "", r.read, silent);
    await inChat(host, ctx, canvasId, snapshot, { id: newCommentId(), body, record: true, items: [item.id] });
  }
  if (ctx.json) return host.printJson({ room: true, ask: ask.commentId, item: item.id, critics: ask.critics, silent: r.silent, notes: r.notes.length, read: r.read, posted: opts.post ? true : posted ? posted.commentId : false, say: posted?.say ?? opts.say ?? null });
  console.log(`Read of the room — “${item.title}” · asked ${ask.critics.map(title).join(", ")}; ${r.notes.length} ${r.notes.length === 1 ? "note" : "notes"}`);
  if (posted) console.log(`${posted.by.name}: ${posted.say}`);
  console.log(readWords(r.read));
  if (silent.length) console.log(`Nothing to say at their volume: ${silent.join(" and ")}.`);
  if (opts.post) console.log("posted in the Chat");
}

/**
 * The room's half of `isocan critique both <a>+<b>` — the lead is asked in
 * the Chat for two proposals beneath the screen, each citing the critic's
 * note it answers. Only a split the read shows, and only once.
 */
export async function roomBoth(host: CliHost, ctx: Ctx, canvas: Canvas, snapshot: CanvasSnapshotResponse, a: CritiqueNote, b: CritiqueNote): Promise<void> {
  const item = snapshot.canvas.items[a.item]!;
  const ask = roomAskFor(snapshot.canvas, item.id);
  const split = ask ? critiqueRead(roomRead(snapshot.canvas, ask, item.id).notes).split.find((s) => s.sides[0].some((n) => n.threadId === a.threadId) && s.sides[1].some((n) => n.threadId === b.threadId)) : undefined;
  if (!split) throw new Error(`${a.critic}'s and ${b.critic}'s notes are not a split in the read of the room for ${item.title} — \`isocan critique read ${item.id}\``);
  const ref = `${a.threadId}+${b.threadId}`;
  if (bothAsked(snapshot.canvas, ref)) throw new Error("build both was already asked for this split");
  const { lead, cannot } = await leadFor(ctx, canvas, snapshot);
  if (cannot || !lead) throw new Error(`nothing can build them here: ${cannot ?? "no lead"}. Nothing was asked.`);
  const commentId = await inChat(host, ctx, canvas.id, snapshot, { id: newCommentId(), body: roomBothBody(lead, item, a, b), mentions: [lead.id], items: [item.id] });
  if (ctx.json) return host.printJson({ commentId, lead, answers: [a.threadId, b.threadId], item: item.id });
  console.log(`asked ${lead.name} to build both (${commentId}) — two proposals beneath ${item.title}, one citing critic:${a.threadId} (${a.critic}), one citing critic:${b.threadId} (${b.critic}); nothing changes until you keep one`);
}

/**
 * **The critics set to *before I share*, asked once per screen version** —
 * the desk check's room (proactive-agent phase 8). The lead is asked in the
 * Chat to wear them over the screens, with the check's findings to read;
 * when nothing can wear them, each says why it waits. A second share with
 * nothing changed asks nobody again. The CLI's desk check asks it through
 * this module's `deskCheck.critics`, so removing the module removes the line.
 */
export async function beforeShare(host: Pick<CliHost, "sendOp">, ctx: Ctx, canvas: Canvas, snapshot: CanvasSnapshotResponse, screens: readonly string[], findings: readonly string[]): Promise<{ agentName: string; asked: boolean; why?: string }[]> {
  const cards = criticItems(snapshot.canvas.items).filter((item) => {
    const s = roomSettings(item);
    return s.on && s.when === "share";
  });
  if (!cards.length || !screens.length) return [];
  const lenses = cards.map((item) => ({ name: String(item.properties[CRITIC_PROP]), agentName: item.title, loud: roomSettings(item).loud }));
  const at = screens.flatMap((id) => {
    const item = snapshot.canvas.items[id];
    return item ? [{ id, title: item.title, versionId: item.currentVersionId }] : [];
  });
  const asked = roomAsks(snapshot.canvas).filter((a) => a.why === "share");
  const already = at.every((s) => asked.some((a) => a.screens.some((x) => x.itemId === s.id && x.versionId === s.versionId) && lenses.every((l) => a.critics.includes(l.name))));
  if (already) return lenses.map((l) => ({ agentName: l.agentName, asked: true }));
  const { lead, cannot } = await leadFor(ctx, canvas, snapshot);
  if (cannot || !lead) return lenses.map((l) => ({ agentName: l.agentName, asked: false, why: cannot ?? "no lead" }));
  await inChat(host, ctx, canvas.id, snapshot, { id: newCommentId(), body: roomAskBody(lead, at, lenses, "share", findings), mentions: [lead.id], items: at.map((s) => s.id) });
  return lenses.map((l) => ({ agentName: l.agentName, asked: true }));
}
