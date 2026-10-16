import type { Actor, CanvasContents, Comment, CommentThread, EnrolledAgent, Item } from "./model.ts";
import type { LogEntry } from "./ops.ts";
import type { PresenceSession, RcAnsweringResponse } from "./protocol.ts";
import type { ActorJoins } from "./identity.ts";
import { sameActor } from "./identity.ts";
import { PARENT_PROP, parentOf } from "./lineage.ts";
import { PROPOSAL_CAP, PROPOSAL_CITES_PROP, PROPOSAL_PROP, PROPOSAL_WHY_PROP, proposalRoom, proposalsOf, type ProposalCite } from "./proposal.ts";
import { isDesignSystem } from "./designsystem.ts";
import { openAsks } from "./roster.ts";
import { undoneSeqs } from "./undone.ts";
import { parseSlashCommand } from "./commands.ts";
import { mayWake } from "./inbox.ts";
import { listeners } from "./onit.ts";
import { ITEM_CHROME, itemChrome } from "./tidy.ts";
import { textRefit } from "./textnode.ts";
import { PLACEMENT_GAP, nearestFreeSpot } from "./placement.ts";

/**
 * **The night watch** (proactive-agent phase 2, design §4).
 *
 * A person says they are stopping — `/goodnight` in the Chat, `isocan
 * goodnight` in a terminal, and nothing else (no closed tab, no idle) — and
 * that opens a conversation with the canvas's lead agent about what to work
 * on overnight. The agent opens with what it read (settled today, left open,
 * a few things it could try), the person steers, and the conversation ends
 * when the person says so ("That's the plan", a comment carrying
 * `goodnight: { step: "plan" }`). Only then does the agent write the note
 * from what was agreed: a text node near the work, and under each item a
 * ticked line concerns an empty dashed frame (`proposal=promised`).
 *
 * Everything here is pure and reads only what the canvas and its log already
 * hold — no op, no stored field beyond the note's own properties — so the
 * CLI that writes a note, the web that unticks a line and the tests that hold
 * the rules all read one answer:
 *
 * - **Settled today** and **left open** are DERIVED (`settledToday`,
 *   `leftOpen`), each line cited, never written by hand.
 * - **The promise rules** (`planNight`): only lines the conversation agreed;
 *   at most the lead's free room under `PROPOSAL_CAP`, promised frames
 *   counted; an original is edited only when the person NAMED it in the
 *   conversation, and never the design system or what was settled today; one
 *   person's night never touches an item another person's open goodnight
 *   named.
 * - **Nothing can answer** (`nightAnswerable`): before anything is promised
 *   the note says whether the lead can answer overnight, and if not it says
 *   why and promises nothing.
 *
 * The note's whole model rides in one property (`handoffNote`, JSON), and its
 * text is regenerated from it (`noteText`) on every change, so the words a
 * person reads and the lines an agent fills cannot disagree.
 */

/** `handoff=<person id>`: whose goodnight a note is. */
export const HANDOFF_PROP = "handoff";
/** `handoffNote=<JSON NightNote>`: the note's model, which its text is made from. */
const HANDOFF_NOTE_PROP = "handoffNote";
/**
 * `handoffReviewed=<ISO>`: the person's morning review of this note was seen
 * (phase 3, `morning.ts`) — the note is closed from then on, so it stops
 * holding other people's goodnights off the items it named. Written by the
 * person's client on arrival, not by an act of theirs, so an `item.update`
 * setting only this has no inverse (`invert.ts`): it is on nobody's ⌘Z.
 */
export const HANDOFF_REVIEWED_PROP = "handoffReviewed";
/** On a failed promise: it still shows the take it would have made (`converge.ts` spells it too). */
export const PROMISE_TAKE_PROP = "promiseTake";

/** One cited line of *settled today* or *left open*. */
export interface NightCited {
  what: string;
  itemId?: string;
  cite: ProposalCite;
}

/** One line of *Tonight I will*. */
export interface NightLine {
  /** 1-based, stable for the note's life — `untick 2`, `promise:<note>#2`. */
  n: number;
  text: string;
  /** What it may spend: "three takes", "one new version". */
  budget: string;
  /** The item it concerns. */
  on: string;
  /** True: the agreed work edits `on` itself, as a new version. False: a proposal beside it. */
  edit: boolean;
  /** Only ticked lines are promises. */
  ticked: boolean;
  /** The promised frame's item id (a proposal line, while it stands). */
  frame?: string;
  /** How the night went for this line, once the agent has said. */
  result?: { done: true } | { failed: string };
}

/** A goodnight note's model. */
export interface NightNote {
  person: Actor;
  lead: Actor | null;
  settled: NightCited[];
  open: NightCited[];
  lines: NightLine[];
  /** What the agent added to *will not touch*. It may add, never remove. */
  wont: string[];
  /** The free line: a thought left for the morning. */
  thought?: string;
  /** ISO — when the morning may look. */
  ready: string;
  /** Why nothing is promised, when nothing is. */
  nothing?: string;
  /** Items the person named in the conversation. */
  named: string[];
  /** Titles at writing, for the words: the note still reads after a rename. */
  titles: Record<string, string>;
  /**
   * Items the person changed in the hour before their `/goodnight`
   * (`midwayItems`): off limits overnight unless a ticked line names one.
   */
  midway?: string[];
  /** What the agent saw and did not act on, each with its reason (`goodnight done --left`). */
  left?: { what: string; why: string }[];
}

// ---------- who leads, and whether it can answer

/** What a reader saw of who is listening — the CLI's `rcAnswering` and sessions, or the web's. */
export interface NightSeen {
  answering?: RcAnsweringResponse | null;
  sessions?: readonly PresenceSession[];
  joined?: ActorJoins;
}

/** The canvas's lead agent, and how it was chosen. */
export interface NightLead {
  agent: EnrolledAgent | null;
  /** `named`: the canvas's `proactive=` property; `standing`: the first answerable standing agent; `none`. */
  how: "named" | "standing" | "none";
  /** The name `proactive=` gave, when one did. */
  named?: string;
}

function answering(agentId: string, seen: NightSeen): boolean {
  if ((seen.answering?.actorIds ?? []).some((id) => sameActor(seen.joined, id, agentId))) return true;
  return listeners([...(seen.sessions ?? [])]).some((s) => sameActor(seen.joined, s.actor.id, agentId));
}

/**
 * **Who leads the night** (design §2.6): the agent the canvas names with
 * `proactive=<name>`, set by a person; with none named, the canvas's first
 * standing agent that something answers for (critics excluded — they never
 * act), else its first standing agent at all, so the refusal can name it.
 */
export function nightLead(canvas: CanvasContents, canvasProps: Record<string, string>, seen: NightSeen): NightLead {
  const agents = Object.values(canvas.agents ?? {});
  const named = canvasProps.proactive?.trim();
  if (named) {
    const agent = agents.find((a) => a.actor.id === named || a.actor.name.toLowerCase() === named.toLowerCase()) ?? null;
    return { agent, how: "named", named };
  }
  const standing = agents.filter((a) => a.ceiling !== "note");
  const agent = standing.find((a) => answering(a.actor.id, seen)) ?? standing[0] ?? null;
  return agent ? { agent, how: "standing" } : { agent: null, how: "none" };
}

/**
 * **Can anything answer overnight, for this person?** Null when the lead can
 * (an rc answers for it, or it is parked on `wait`, and its gate takes this
 * person's word); otherwise why not, in a sentence the note prints — the
 * night then promises nothing.
 */
export function nightAnswerable(lead: NightLead, personId: string, seen: NightSeen): string | null {
  if (!lead.agent) {
    return lead.how === "named"
      ? `"${lead.named}" is named to lead here (proactive=${lead.named}) but is not enrolled on this canvas`
      : "no agent stands on this canvas to work overnight — enrol one with `isocan rc add <name>`, or name one with `isocan canvas edit --prop proactive=<name>`";
  }
  const name = lead.agent.actor.name;
  if (!answering(lead.agent.actor.id, seen)) {
    return `nothing is answering for ${name} here — no rc holds it, and it is not parked on \`isocan wait\``;
  }
  const policy = seen.answering?.policies?.[lead.agent.actor.id];
  if (policy && !mayWake(policy, personId, seen.joined)) {
    return `${name} does not take your word here, so a goodnight would not wake it — ask ${policy.owner.name} to widen its gate`;
  }
  return null;
}

// ---------- what the day settled, and what it left open

/** The `version:<item>@vN` ref of a version, N counted from 1. */
function versionRef(item: Item, versionId: string): string {
  return `${item.id}@v${item.versions.findIndex((v) => v.id === versionId) + 1}`;
}

/**
 * **Settled today, by this person** (design §4): today's `choose`, design
 * decisions, kept *maybes* and `prefer` records, and every new DESIGN.md
 * version (whoever wrote it). Read from the canvas and the day's log; undone
 * acts do not count.
 *
 * A `choose` is read off the canvas itself: a version the person added to an
 * item today whose bytes are those of a child of it they trashed today — the
 * fold `converge.ts` makes — so it needs no marker that does not exist.
 */
export function settledToday(
  canvas: CanvasContents,
  entries: readonly LogEntry[],
  personId: string,
  sinceMs: number,
  joined?: ActorJoins,
): NightCited[] {
  const out: NightCited[] = [];
  const mine = (id: string) => sameActor(joined, id, personId);
  const today = (iso: string) => Date.parse(iso) >= sinceMs;
  for (const item of Object.values(canvas.items)) {
    for (const version of item.versions) {
      if (!today(version.createdAt)) continue;
      const chosen = canvas.trash.find(
        (t) =>
          parentOf(t.item) === item.id &&
          today(t.deletedAt) &&
          mine(t.deletedBy.id) &&
          t.item.versions.find((v) => v.id === t.item.currentVersionId)?.blobHash === version.blobHash,
      );
      if (chosen && mine(version.createdBy.id)) {
        out.push({ what: `chose “${chosen.item.title}” for ${item.title}`, itemId: item.id, cite: { kind: "version", ref: versionRef(item, version.id) } });
      } else if (isDesignSystem(item)) {
        out.push({ what: `a new version of ${item.title}`, itemId: item.id, cite: { kind: "design", ref: versionRef(item, version.id) } });
      }
    }
  }
  const undone = undoneSeqs(entries);
  for (const entry of entries) {
    if (undone.has(entry.seq) || entry.cause || !today(entry.envelope.ts) || !mine(entry.envelope.actor.id)) continue;
    const op = entry.envelope.op;
    if (op.type === "design.decide") {
      out.push({ what: "decided a design comparison", cite: { kind: "op", ref: String(entry.seq) } });
      continue;
    }
    if (op.type !== "item.update") continue;
    const item = canvas.items[op.itemId];
    if (!item) continue;
    const props = op.patch.properties ?? {};
    if (props.wireKeep) out.push({ what: `kept the maybe “${item.title}”`, itemId: item.id, cite: { kind: "op", ref: String(entry.seq) } });
    if (props.preferredOver) out.push({ what: `preferred “${item.title}”`, itemId: item.id, cite: { kind: "op", ref: String(entry.seq) } });
  }
  return out;
}

/**
 * **Left open** (design §4): the questions nobody has answered (`/ask`), the
 * wireframe *maybes* nobody kept, and the proposals still waiting on a keep
 * or a delete — each cited. Doubts the agent read in today's comments are its
 * own to add (`isocan goodnight note --open`), each with the comment it cites.
 */
export function leftOpen(canvas: CanvasContents): NightCited[] {
  const out: NightCited[] = [];
  for (const ask of openAsks(canvas)) {
    const words = ask.body.replace(/\s+/g, " ").trim();
    out.push({ what: `“${words.length > 80 ? `${words.slice(0, 79)}…` : words}” — an open question`, cite: { kind: "comment", ref: ask.commentId } });
  }
  for (const item of Object.values(canvas.items)) {
    if (item.properties.wireMaybe && !item.properties.wireKeep) {
      out.push({ what: `the maybe “${item.title}”, not kept yet`, itemId: item.id, cite: { kind: "version", ref: versionRef(item, item.currentVersionId) } });
    }
  }
  for (const item of proposalsOf(canvas)) {
    const state = item.properties[PROPOSAL_PROP];
    if (state !== "sure" && state !== "hunch") continue;
    out.push({ what: `the proposal “${item.title}”, waiting on a keep or a delete`, itemId: item.id, cite: { kind: "version", ref: versionRef(item, item.currentVersionId) } });
  }
  return out;
}

// ---------- the conversation

/** A person's goodnight conversation, as the Chat holds it. */
export interface GoodnightTalk {
  /** The `/goodnight` comment that opened it. */
  ask: Comment;
  /** Everything said after it, by anyone. */
  after: Comment[];
  /** The person said "That's the plan". */
  planned: boolean;
  /** Items the person named in it — by #-reference or by title. */
  named: string[];
}

/** Whether a comment is a `/goodnight`. */
function isGoodnight(comment: Comment): boolean {
  return parseSlashCommand(comment.body)?.name === "goodnight";
}

/** Items a person's words name: #-references, and titles said in so many words. */
function namedIn(canvas: CanvasContents, comments: readonly Comment[]): string[] {
  const named = new Set<string>();
  const titled = Object.values(canvas.items).filter(
    (item) => item.title.trim().length >= 3 && !item.properties[PROPOSAL_PROP] && !item.properties[HANDOFF_PROP],
  );
  for (const comment of comments) {
    for (const id of comment.items ?? []) if (canvas.items[id]) named.add(id);
    const body = comment.body.toLowerCase();
    for (const item of titled) {
      const title = item.title.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`(^|[^a-z0-9])${title}($|[^a-z0-9])`).test(body)) named.add(item.id);
    }
  }
  return [...named];
}

/**
 * **This person's latest goodnight conversation**, or null: from their last
 * `/goodnight` in the thread, through everything after it. Only the person's
 * own words name items — what the agent suggested is not what they agreed.
 */
export function goodnightTalk(canvas: CanvasContents, thread: CommentThread | undefined | null, personId: string, joined?: ActorJoins): GoodnightTalk | null {
  if (!thread) return null;
  const comments = thread.comments;
  let at = comments.length - 1;
  while (at >= 0 && !(sameActor(joined, comments[at]!.author.id, personId) && isGoodnight(comments[at]!))) at--;
  if (at < 0) return null;
  const ask = comments[at]!;
  const after = comments.slice(at + 1);
  const theirs = [ask, ...after].filter((c) => sameActor(joined, c.author.id, personId));
  return {
    ask,
    after,
    // The button carries `goodnight: plan`; typing the words is the same word.
    planned: theirs.some((c) => c.goodnight?.step === "plan" || /^\s*that['’]?s the plan\b/i.test(c.body)),
    named: namedIn(canvas, theirs),
  };
}

// ---------- notes on the canvas

/** A goodnight note's model, or null when the item is not one. */
export function readNote(item: Pick<Item, "properties">): NightNote | null {
  if (!item.properties[HANDOFF_PROP]) return null;
  try {
    const note = JSON.parse(item.properties[HANDOFF_NOTE_PROP] ?? "") as NightNote;
    return note && Array.isArray(note.lines) ? note : null;
  } catch {
    return null;
  }
}

/** The properties a note carries: whose it is, and its model. */
export function handoffProperties(note: NightNote): Record<string, string> {
  return { [HANDOFF_PROP]: note.person.id, [HANDOFF_NOTE_PROP]: JSON.stringify(note) };
}

/**
 * **Whether a note's night is still on**: before its ready-by, or while a
 * ticked line has not been answered. A note nobody reviewed stays on the
 * canvas as a record; it stops counting as *open* once the night is over.
 */
function noteOpen(note: NightNote, now: number, item?: Pick<Item, "properties">): boolean {
  if (item?.properties[HANDOFF_REVIEWED_PROP]) return false;
  return now < Date.parse(note.ready) || note.lines.some((line) => line.ticked && !line.result);
}

/** The goodnight notes on a canvas, each with its model — newest first. */
export function goodnightNotes(canvas: CanvasContents): { item: Item; note: NightNote }[] {
  return Object.values(canvas.items)
    .flatMap((item) => {
      const note = readNote(item);
      return note ? [{ item, note }] : [];
    })
    .sort((a, b) => b.item.createdAt.localeCompare(a.item.createdAt));
}

/**
 * **What other people's goodnights have named** — item id → the person —
 * from their open notes (every line's item, every item their conversation
 * named) and from a conversation still under way (asked after their latest
 * note). One person's promises never touch these (Dion, 14 Oct 2026).
 */
export function namedByOthers(
  canvas: CanvasContents,
  thread: CommentThread | undefined | null,
  personId: string,
  now: number,
  joined?: ActorJoins,
): Map<string, Actor> {
  const out = new Map<string, Actor>();
  const notes = goodnightNotes(canvas);
  for (const { item, note } of notes) {
    if (sameActor(joined, note.person.id, personId) || !noteOpen(note, now, item)) continue;
    for (const id of [...note.named, ...note.lines.map((l) => l.on)]) out.set(id, note.person);
  }
  const people = new Map<string, Actor>();
  for (const c of thread?.comments ?? []) if (isGoodnight(c) && !sameActor(joined, c.author.id, personId)) people.set(c.author.id, c.author);
  for (const person of people.values()) {
    const talk = goodnightTalk(canvas, thread, person.id, joined);
    const latest = notes.find(({ note }) => sameActor(joined, note.person.id, person.id));
    if (!talk || (latest && latest.item.createdAt > talk.ask.createdAt)) continue;
    for (const id of talk.named) out.set(id, person);
  }
  return out;
}

// ---------- the promise rules

/** One line the conversation agreed, as the agent hands it to `planNight`. */
export interface NightAsk {
  text: string;
  /** The item it concerns, by id. */
  on: string;
  /** Edit `on` itself — only when the person named it. */
  edit?: boolean;
  budget?: string;
}

/** What `planNight` reads. */
export interface NightInput {
  canvas: CanvasContents;
  person: Actor;
  lead: Actor;
  /** `nightAnswerable`'s answer: null, or why nothing can answer. */
  cannotAnswer: string | null;
  asks: readonly NightAsk[];
  /** Items the person named in the conversation (`goodnightTalk`). */
  named: readonly string[];
  /** Today's settled lines (`settledToday`): never edited overnight. */
  settled: readonly NightCited[];
  /** Other people's goodnights (`namedByOthers`). */
  others: ReadonlyMap<string, Actor>;
  /** What the person was mid-way through when they left (`midwayItems`). */
  midway?: readonly string[];
}

/**
 * **The promise rules, in one place** — the lines a note may promise, or why
 * it may not be written as asked, in a sentence that says what to do.
 *
 * - Nothing can answer overnight, or the lead has no room left under
 *   `PROPOSAL_CAP`: no lines, and `nothing` says why. The note still gets
 *   written; it promises nothing.
 * - Every line concerns an item on the canvas.
 * - No line touches an item another person's open goodnight named.
 * - An edit only of an item the person named in the conversation, and never
 *   the design system or something settled today.
 * - Proposal lines (each one promised frame) fit the lead's free room;
 *   promised frames count toward the cap, so a sixth is refused.
 * - Never on a screen the person was mid-way through (`midwayItems`, design
 *   §5): a line on one is the person's to agree, so it stands only when they
 *   named the item in the conversation — the line that then names it is the
 *   ticked consent the morning reads.
 */
export function planNight(input: NightInput): { lines: NightLine[]; nothing?: string } | { refused: string } {
  const { canvas } = input;
  if (input.cannotAnswer) return { lines: [], nothing: `Nothing can answer overnight: ${input.cannotAnswer}. Nothing is promised.` };
  const settled = new Set(input.settled.flatMap((s) => (s.itemId ? [s.itemId] : [])));
  const lines: NightLine[] = [];
  for (const [i, ask] of input.asks.entries()) {
    const item = canvas.items[ask.on];
    const text = ask.text.replace(/\s+/g, " ").trim();
    if (!text) return { refused: `line ${i + 1} says nothing — write what you will do, in a line` };
    if (text.length > 200) return { refused: `line ${i + 1} is longer than a line — say the rest in the conversation` };
    if (!item) return { refused: `line ${i + 1} names no item on this canvas` };
    const other = input.others.get(item.id);
    if (other) return { refused: `“${item.title}” is in ${other.name}'s goodnight tonight — one person's night never touches an item another's named` };
    if (input.midway?.includes(item.id) && !input.named.includes(item.id)) {
      return { refused: `${input.person.name} was still working on “${item.title}” in the hour before /goodnight, so it is off limits tonight unless they name it — leave it alone, or ask them` };
    }
    if (ask.edit) {
      if (isDesignSystem(item)) return { refused: `the design system is never edited overnight — propose beside “${item.title}” instead` };
      if (settled.has(item.id)) return { refused: `“${item.title}” was settled today, so it is on the will-not-touch list — propose beside it instead` };
      if (!input.named.includes(item.id)) {
        return { refused: `${input.person.name} did not name “${item.title}” in the conversation, so it may not be edited — propose beside it (drop the edit), or ask them` };
      }
    }
    lines.push({ n: i + 1, text, budget: ask.budget?.trim() || (ask.edit ? "one new version" : "one take"), on: item.id, edit: Boolean(ask.edit), ticked: true });
  }
  const proposals = lines.filter((l) => !l.edit).length;
  const room = proposalRoom(canvas, input.lead.id);
  if (proposals > 0 && room === 0) {
    return { lines: [], nothing: `Nothing new tonight: ${PROPOSAL_CAP} of my proposals are already waiting on you, and room frees only when you keep or delete one. Nothing is promised.` };
  }
  if (proposals > room) {
    return { refused: `room for ${room} more proposal${room === 1 ? "" : "s"} tonight, not ${proposals} — ${PROPOSAL_CAP} is the most one agent keeps open, promised frames included; agree fewer` };
  }
  return { lines };
}

/** How long before `/goodnight` an edit still counts as work in progress. */
const MIDWAY_MS = 3600_000;
/** The ops that change what an item SHOWS — an edit; placing, moving, renaming or marking one is not. */
const EDITS: readonly string[] = ["item.addVersion", "item.edit", "item.setCurrentVersion", "item.restoreVersion", "item.removeVersion"];

/**
 * **What the person was mid-way through when they left** (design §5): the
 * items whose content they changed in the hour before `/goodnight` — a new
 * version, a text edit, a version switched or restored; undone acts, adding,
 * moving and marking do not count — that are still on the canvas. The night
 * leaves these alone unless a ticked line names one.
 */
export function midwayItems(canvas: CanvasContents, entries: readonly LogEntry[], personId: string, leftAtMs: number, joined?: ActorJoins): string[] {
  const undone = undoneSeqs(entries);
  const out = new Set<string>();
  for (const entry of entries) {
    const op = entry.envelope.op;
    const at = Date.parse(entry.envelope.ts);
    if (undone.has(entry.seq) || entry.cause || at > leftAtMs || at < leftAtMs - MIDWAY_MS) continue;
    if (!EDITS.includes(op.type) || !("itemId" in op) || typeof op.itemId !== "string") continue;
    if (!sameActor(joined, entry.envelope.actor.id, personId)) continue;
    const item = canvas.items[op.itemId];
    if (item && !item.properties[HANDOFF_PROP] && !item.properties[PROPOSAL_PROP]) out.add(item.id);
  }
  return [...out];
}

/**
 * **Whether this agent's night may propose beside this item**, or why not:
 * while a note it leads is open, an item its person was mid-way through is
 * off limits unless a ticked line names it. `isocan propose` asks it, so a
 * night's extra proposal cannot land on a half-finished screen.
 */
export function midwayRefusal(canvas: CanvasContents, actorId: string, itemId: string, now: number): string | null {
  for (const { item, note } of goodnightNotes(canvas)) {
    if (note.lead?.id !== actorId || !noteOpen(note, now, item) || !note.midway?.includes(itemId)) continue;
    if (note.lines.some((l) => l.ticked && l.on === itemId)) continue;
    return `${note.person.name} was still working on “${canvas.items[itemId]?.title ?? itemId}” when they left, and no ticked line names it — leave it alone tonight`;
  }
  return null;
}

/** The properties a promised frame is born with: beneath its source, citing the line that promised it. */
export function promiseProperties(noteId: string, line: NightLine): Record<string, string> {
  return {
    [PARENT_PROP]: line.on,
    [PROPOSAL_PROP]: "promised",
    [PROPOSAL_CITES_PROP]: JSON.stringify([{ kind: "promise", ref: `${noteId}#${line.n}` }]),
    [PROPOSAL_WHY_PROP]: line.text.slice(0, 400),
  };
}

/** What an empty frame shows until the night fills it: the promise, quietly. */
export function promisedPlaceholder(line: NightLine, html: boolean): string {
  const words = line.text.replace(/[<&>]/g, (c) => (c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;"));
  return html
    ? `<!doctype html><meta charset="utf-8"><title>Promised</title><body style="margin:0;height:100vh;display:grid;place-items:center;font:15px system-ui,sans-serif;color:#8a8f98;background:transparent"><p style="max-width:80%;text-align:center">Tonight: ${words}</p></body>`
    : `Tonight: ${line.text}\n`;
}

// ---------- unticking, filling, the brief

/**
 * **Untick a line**: it stays on the note as an offer, not a promise, and its
 * empty frame goes. The note and the frame to delete, or why not.
 */
export function untickLine(note: NightNote, n: number): { note: NightNote; frame?: string } | { refused: string } {
  const line = note.lines.find((l) => l.n === n);
  if (!line) return { refused: `the note has no line ${n}` };
  if (!line.ticked) return { refused: `line ${n} is already unticked — an offer, not a promise` };
  if (line.result) return { refused: `line ${n} has already been worked — delete what it made instead` };
  const lines = note.lines.map(({ frame, ...l }) => (l.n === n ? { ...l, ticked: false } : { ...l, ...(frame ? { frame } : {}) }));
  return { note: { ...note, lines }, ...(line.frame ? { frame: line.frame } : {}) };
}

/** Where a fill lands: a promised frame, or an original the note may edit. */
export type FillTarget =
  | { kind: "frame"; noteItem: Item; note: NightNote; line: NightLine }
  | { kind: "edit"; noteItem: Item; note: NightNote; line: NightLine };

/**
 * **What filling this item would answer**, or why it may not be filled: a
 * promised frame of an open note of this lead's, or an original a ticked
 * edit line names. Anything else is the person's work, and the night never
 * edits it.
 */
export function fillTarget(canvas: CanvasContents, actorId: string, itemId: string, now: number): FillTarget | { refused: string } {
  const item = canvas.items[itemId];
  if (!item) return { refused: `no item ${itemId} on this canvas` };
  for (const { item: noteItem, note } of goodnightNotes(canvas)) {
    if (note.lead?.id !== actorId) continue;
    const frameLine = note.lines.find((l) => l.frame === itemId);
    if (frameLine) {
      if (frameLine.result) return { refused: `line ${frameLine.n} has already been answered` };
      return { kind: "frame", noteItem, note, line: frameLine };
    }
    if (!noteOpen(note, now, noteItem)) continue;
    const editLine = note.lines.find((l) => l.edit && l.on === itemId);
    if (editLine) {
      if (!editLine.ticked) return { refused: `${note.person.name} unticked line ${editLine.n} — it stays an offer, not a promise` };
      if (editLine.result) return { refused: `line ${editLine.n} has already been answered` };
      return { kind: "edit", noteItem, note, line: editLine };
    }
  }
  if (item.properties[PROPOSAL_PROP] === "promised") {
    return { refused: `“${item.title}” is a promise from another agent's note, or one that was unticked — it is not yours to fill` };
  }
  return { refused: `“${item.title}” is not a promised frame, and no goodnight of yours named it for editing — the night never edits anything else` };
}

/** The note with one line answered. */
export function answerLine(note: NightNote, n: number, result: NonNullable<NightLine["result"]>): NightNote {
  return { ...note, lines: note.lines.map((l) => (l.n === n ? { ...l, result } : l)) };
}

/**
 * **Whether the night may be reported done**, or which promise is still
 * empty: every ticked line filled or failed with a reason — an empty frame
 * never stays empty without one.
 */
export function briefRefusal(note: NightNote): string | null {
  const open = note.lines.find((l) => l.ticked && !l.result);
  return open ? `line ${open.n} (“${open.text}”) is still promised — fill it, or fail it with a reason` : null;
}

// ---------- where the note stands

/**
 * **The note's box**: a readable column (460 wide) and the height its words
 * need at that width, with a tenth spare — the estimate is a guess, and a
 * note whose last heading runs out of its box onto a promised frame's chip
 * is the failure this is for.
 */
export function handoffBox(body: string): { width: number; height: number } {
  const fit = textRefit({ width: 460, height: 0 }, body, "body", "sans") ?? { width: 460, height: 0 };
  return { width: fit.width, height: Math.ceil(fit.height * 1.1) };
}

/**
 * **Where a note stands**: above the work it concerns, at its left edge —
 * not beside it, where the promised frames' chips stand out to the right —
 * moved by core's free-spot search until its footprint (name strip and
 * marks row counted) lands on nobody's, so both surfaces put it in the same
 * place. Concerning nothing, it stands above everything. The answer is the
 * item's own top-left, sent as `chosen`.
 */
export function handoffSpot(canvas: CanvasContents, near: readonly string[], box: { width: number; height: number }): { x: number; y: number } {
  const items = Object.values(canvas.items);
  const close = near.length ? near.flatMap((id) => (canvas.items[id] ? [canvas.items[id]!] : [])) : items;
  const left = close.length ? Math.min(...close.map((i) => i.x)) : 0;
  const top = close.length ? Math.min(...close.map((i) => i.y - itemChrome(i).above)) : 0;
  const foot = (b: { x: number; y: number; width: number; height: number }, above: number, below: number) => ({ x: b.x, y: b.y - above, width: b.width, height: b.height + above + below });
  const want = foot({ x: left, y: top - PLACEMENT_GAP - ITEM_CHROME.below - box.height, ...box }, ITEM_CHROME.above, ITEM_CHROME.below);
  const spot = nearestFreeSpot(want, items.map((i) => { const c = itemChrome(i); return foot(i, c.above, c.below); }));
  return { x: spot.x, y: spot.y + ITEM_CHROME.above };
}

// ---------- the words

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** The next `HH:MM` after `now`, local time, as ISO — or null when `hhmm` is not a time. */
export function readyAt(hhmm: string, now: number): string | null {
  const m = /^(\d{1,2})(?::(\d{2}))?$/.exec(hhmm.trim());
  if (!m || Number(m[1]) > 23 || Number(m[2] ?? 0) > 59) return null;
  const at = new Date(now);
  at.setHours(Number(m[1]), Number(m[2] ?? 0), 0, 0);
  if (at.getTime() <= now) at.setDate(at.getDate() + 1);
  return at.toISOString();
}

function readyWords(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}, ${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/**
 * **The note's text**, made from its model — headings a person reads in
 * order: settled today, left open, tonight I will (a ticked list, each line
 * with its budget), will not touch, a thought, ready by.
 */
export function noteText(note: NightNote): string {
  const title = (id: string) => note.titles[id] ?? id;
  // Said before anything is promised: whether anything can answer tonight.
  const answers = note.nothing ? "nothing can answer tonight" : note.lead ? `${note.lead.name} is standing by overnight` : "";
  const out: string[] = [`# Goodnight, ${note.person.name}`, "", `${note.lead ? `${note.lead.name}'s` : "The"} note for tonight · ${answers ? `${answers} · ` : ""}ready by ${readyWords(note.ready)}`, ""];
  out.push("## Settled today", ...(note.settled.length ? note.settled.map((s) => `- ${s.what}`) : ["- nothing yet today"]), "");
  out.push("## Left open", ...(note.open.length ? note.open.map((s) => `- ${s.what}`) : ["- nothing open"]), "");
  out.push("## Tonight I will");
  if (note.nothing) out.push(note.nothing);
  for (const line of note.lines) {
    const where = line.edit ? `edits “${title(line.on)}”, as a new version` : `beside “${title(line.on)}”`;
    const state = !line.ticked
      ? " — unticked: an offer, not a promise"
      : line.result && "failed" in line.result
        ? ` — did not work: ${line.result.failed}`
        : line.result
          ? " — done"
          : "";
    out.push(`- [${line.ticked ? "x" : " "}] ${line.text} — ${where} · ${line.budget}${state}`);
  }
  if (!note.nothing && note.lines.length === 0) out.push("Nothing was agreed, so nothing is promised.");
  out.push("", "## Will not touch", "- what was settled today", "- the design system", "- every original you did not name for editing");
  const edits = note.lines.filter((l) => l.edit && l.ticked);
  if (edits.length) out.push(`- (named for editing: ${edits.map((l) => `“${title(l.on)}”`).join(", ")})`);
  const midway = (note.midway ?? []).filter((id) => !note.lines.some((l) => l.ticked && l.on === id));
  if (midway.length) out.push(`- what you were still working on: ${midway.map((id) => `“${title(id)}”`).join(", ")}`);
  out.push(...note.wont.map((w) => `- ${w}`));
  if (note.left?.length) out.push("", "## Left alone", ...note.left.map((l) => `- ${l.what} — ${l.why}`));
  if (note.thought) out.push("", "## A thought", note.thought);
  out.push("", "## Ready by", readyWords(note.ready), "");
  return out.join("\n");
}
