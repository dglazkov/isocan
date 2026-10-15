import { type Actor, type CanvasContents, type Comment, type Item, homageNameProblems } from "@isocan/core";
import {
  CRITIC_PROP,
  criticSlug,
  critiqueRead,
  gist,
  lensWords,
  readNote,
  readWords,
  type CriticDraft,
  type CritiqueNote,
  type CritiqueRead,
  type NoteKind,
} from "./core.ts";

/**
 * **Critics in the room** (proactive-agent phase 8, `docs/projects/proactive-agent/design.md` §9).
 *
 * The critique module's critics are agents of their own, each enrolled on
 * the asker's runner and capped at notes (`isocan critique --by`). The room
 * reuses everything a critic IS — the card on the canvas (`readCritic`), the
 * note's shape (`noteBody`), the fold (`critiqueRead`) and its words — and
 * changes only who speaks: **the lead agent wears the lens.** Its notes are
 * ordinary threads on the screen whose first comment carries
 * `persona: <card name>`, so one actor is accountable, and the canvas paints
 * the pin in the critic's colour. Critics never edit; the lead acts only when
 * the person asks (*build both* is two proposals).
 *
 * What this file adds is what a person switches and what a lead is told:
 * the card's three settings (on, *how loud*, *when*), a handful of starter
 * lenses with no person in their names, a lens a person describes, the ask
 * in the Chat and how it is found again, the read posted back, and when a
 * pause asks by itself. All pure; both surfaces read it.
 */

/** Switched on for the room (`on`), or not — absent is off, so a critic added before the room existed stays quiet. */
export const CRITIC_ON = "critique.on";
/** *How loud*: `blockers`, `studio` or `everything` — see `LOUDNESS`. */
export const CRITIC_LOUD = "critique.loud";
/** *When*: `pause`, `share` or `asked` — see `WHENS`. */
export const CRITIC_WHEN = "critique.when";
/** The pin colour, mirrored from the card's front matter so a pin can be painted without reading the card's bytes. */
export const CRITIC_COLOR = "critique.color";

/**
 * **How loud a critic is**: what kinds it may say, and how many notes on one
 * screen per crit. *Blockers only* says only what stops the screen doing its
 * job; *studio crit* says the few that matter, of any kind; *everything*
 * says all it sees, up to a ceiling that keeps a room from burying a screen.
 */
export const LOUDNESS = {
  blockers: { label: "Blockers only", kinds: ["blocker"], cap: 3 },
  studio: { label: "Studio crit", kinds: ["working", "risk", "blocker"], cap: 3 },
  everything: { label: "Everything", kinds: ["working", "risk", "blocker"], cap: 8 },
} as const satisfies Record<string, { label: string; kinds: readonly NoteKind[]; cap: number }>;
/** One of `LOUDNESS`'s keys. */
export type Loudness = keyof typeof LOUDNESS;

/** **When a critic speaks**: when the person pauses, before they share, or only when asked (the default). */
export const WHENS = {
  pause: "When I pause",
  share: "Before I share",
  asked: "Only when asked",
} as const;
/** One of `WHENS`' keys. */
export type When = keyof typeof WHENS;

/** One critic card's room settings, read off its properties. */
export interface RoomSettings {
  on: boolean;
  loud: Loudness;
  when: When;
  color: string | null;
}

/** A card's settings, with the defaults — off, studio crit, only when asked. */
export function roomSettings(item: Pick<Item, "properties">): RoomSettings {
  const p = item.properties;
  const loud = p[CRITIC_LOUD];
  const when = p[CRITIC_WHEN];
  const color = p[CRITIC_COLOR];
  return {
    on: p[CRITIC_ON] === "on",
    loud: loud && loud in LOUDNESS ? (loud as Loudness) : "studio",
    when: when && when in WHENS ? (when as When) : "asked",
    color: color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : null,
  };
}

/**
 * **The properties a settings change writes** — one `item.update`, so one
 * undo, the same op from the terminal's `critic set` and the panel's toggles.
 * Refuses, in words, a loudness or a when that is not one of the three.
 */
export function settingsPatch(change: { on?: boolean; loud?: string; when?: string }): Record<string, string> | { refused: string } {
  const out: Record<string, string> = {};
  if (change.on !== undefined) out[CRITIC_ON] = change.on ? "on" : "off";
  if (change.loud !== undefined) {
    if (!(change.loud in LOUDNESS)) return { refused: `how loud is ${Object.keys(LOUDNESS).join(", ")} — not "${change.loud}"` };
    out[CRITIC_LOUD] = change.loud;
  }
  if (change.when !== undefined) {
    if (!(change.when in WHENS)) return { refused: `when is ${Object.keys(WHENS).join(", ")} — not "${change.when}"` };
    out[CRITIC_WHEN] = change.when;
  }
  return out;
}

/**
 * **Why a lens may not say this note**, or null — its loudness. A critic on
 * *blockers only* writing a risk, or a critic past its count on this screen
 * for this crit, is refused, so the room's volume is the person's setting and
 * not the lead's mood.
 */
export function loudRefusal(agentName: string, loud: Loudness, kind: NoteKind, already: number): string | null {
  const l = LOUDNESS[loud];
  if (!(l.kinds as readonly NoteKind[]).includes(kind)) return `${agentName} is set to ${l.label.toLowerCase()} — a ${kind} note is quieter than it speaks`;
  if (already >= l.cap) return `${agentName} has said ${already} ${already === 1 ? "thing" : "things"} about this screen in this crit, and ${l.label.toLowerCase()} is at most ${l.cap}`;
  return null;
}

/** A lens the room offers before anyone describes one: named for what it looks for, never for a person. */
export interface StarterLens {
  id: string;
  agentName: string;
  line: string;
  color: string;
  questions: [string, string, string];
  looksFor: string;
  ranks: string;
}

/** **The starter lenses** (`critic add reductionist`). Synthetic, and principles, not people. */
export const STARTER_LENSES: readonly StarterLens[] = [
  {
    id: "reductionist",
    agentName: "The Reductionist",
    line: "Cut until it breaks, then add one thing back.",
    color: "#3056c8",
    questions: ["What can go without the screen losing its job?", "What is here twice, saying the same thing?", "Cut to the bone, what one thing would it miss most?"],
    looksFor: "Repetition, ornament, and anything that competes with the one action.",
    ranks: "What can be removed first; what must stay, last.",
  },
  {
    id: "brand-voice",
    agentName: "The Brand Voice",
    line: "Would you know whose app this is with the logo covered?",
    color: "#b5452a",
    questions: ["With the logo covered, whose app is this?", "Do the words sound like one company, in one mood?", "Where does it look like every other app?"],
    looksFor: "The type, the colour and the words that only this product would use.",
    ranks: "Anything generic first; anything off-voice next.",
  },
  {
    id: "newcomer",
    agentName: "The Newcomer",
    line: "Here for the first time, with nobody to ask.",
    color: "#0f766e",
    questions: ["What would a first visit not understand?", "What must they already know to act?", "Where would they stop and leave?"],
    looksFor: "Jargon, unlabelled controls, and steps that assume a past visit.",
    ranks: "What stops someone first; what slows them next.",
  },
  {
    id: "craftsperson",
    agentName: "The Craftsperson",
    line: "Every gap, edge and weight on purpose.",
    color: "#7a3ec2",
    questions: ["Which spacing, alignment or size looks accidental?", "Does the type keep to one scale?", "What would a careful hand fix first?"],
    looksFor: "Uneven gaps, near-misses in alignment, and sizes off the scale.",
    ranks: "What the eye trips on first.",
  },
];

/** A starter lens by what somebody types: its id, its name, or its name without the article. */
export function findStarter(ref: string): StarterLens | null {
  const q = ref.trim().toLowerCase();
  return STARTER_LENSES.find((l) => l.id === q || l.agentName.toLowerCase() === q || lensWords(l.agentName).toLowerCase() === q || criticSlug(l.agentName) === q) ?? null;
}

const ORIGINAL = "a lens; original, not affiliated with anyone";

/** A starter lens as a card draft. */
export function starterDraft(lens: StarterLens): CriticDraft {
  return {
    name: criticSlug(lens.agentName),
    agentName: lens.agentName,
    credit: ORIGINAL,
    color: lens.color,
    line: lens.line,
    lens: { questions: [...lens.questions], looksFor: lens.looksFor, ranks: lens.ranks },
  };
}

/** The colours a described lens takes, in turn, after the starters' — readable under white text in both themes. */
const DESCRIBED_COLOURS = ["#9a5b00", "#2e7d32", "#ad1457", "#455a9c", "#6d4c41"] as const;

/**
 * **A lens a person describes** — a name for what it looks for, the one line,
 * and, when they point at work they admire, the references it is after. Its
 * one question is the line, until somebody writes more on the card. The name
 * may carry no word of the references (`homageNameProblems`, the rule every
 * critic's name is held to): a critic is a principle, never a person.
 */
export function describedDraft(input: { agentName: string; line: string; refs?: string; taken?: number }): CriticDraft | { refused: string } {
  const agentName = input.agentName.trim();
  const line = input.line.trim();
  const refs = input.refs?.trim() ?? "";
  if (!line && !refs) return { refused: "a lens says what it looks for in one line (--lens), or points at work you admire (--refs) for the lead to draft one from" };
  const credit = refs ? `after ${refs}; a lens, not affiliated with anyone it references` : ORIGINAL;
  const problems = homageNameProblems({ agentName, person: refs, affiliation: credit }, { noun: "critic", subject: "the critic", line: "the credit line" });
  if (problems.length) return { refused: problems.join("; ") };
  return {
    name: criticSlug(agentName),
    agentName,
    credit,
    color: DESCRIBED_COLOURS[(input.taken ?? 0) % DESCRIBED_COLOURS.length]!,
    ...(line ? { line } : {}),
    lens: { questions: line ? [line] : [""], looksFor: refs ? `What ${refs} gets right.` : "", ranks: "" },
  };
}

/* ---- the ask, and finding it again ------------------------------------- */

const ASK_MARK = "Crit, please";
const READ_HEAD = "Read of the room";
const BOTH_MARK = "Build both, please";

/** A critic as the ask names it: its card name and title, and how loud it is. */
export interface AskedLens {
  name: string;
  agentName: string;
  loud: Loudness;
}

/** Why the room was asked: the person asked, the person paused, or they are about to share. */
export type AskWhy = "asked" | "pause" | "share";

const AND = (xs: readonly string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

/**
 * **What the room's crit posts to the lead** — an ordinary summons in the
 * Chat, naming each screen at its version and each lens with how loud it is,
 * how to answer, and the rule that the lenses speak alone. `(itm@ver, …)`
 * after the mark and the `Critics:` line are what `roomAsks` reads back.
 * Before a share it carries the desk check's findings for the critics to read.
 */
export function roomAskBody(lead: Pick<Actor, "name">, screens: readonly { id: string; title: string; versionId: string }[], critics: readonly AskedLens[], why: AskWhy, deskCheck: readonly string[] = []): string {
  const at = screens.map((s) => `${s.id}@${s.versionId}`).join(", ");
  const names = screens.map((s) => `“${s.title || "Untitled"}”`);
  const lenses = critics.map((c) => `${c.agentName} (${LOUDNESS[c.loud].label.toLowerCase()})`);
  const first = screens[0]?.id ?? "<item>";
  const occasion = why === "pause" ? " — they paused" : why === "share" ? " — before they share" : "";
  return [
    `@${lead.name} ${ASK_MARK} (${at}): ${AND(names)} as ${AND(lenses)}${occasion}.`,
    `Critics: ${critics.map((c) => c.name).join(", ")}.`,
    ...(deskCheck.length ? [`The desk check found: ${deskCheck.join(" ")}`] : []),
    `Wear each lens on its own, from the screen alone and never from another lens's notes; each says only what its volume allows: \`isocan critique note ${first} --as <critic> --at <fx,fy> --kind working|risk|blocker "<what you see. One move.>"\`. Then the read of the room, once per screen: \`isocan critique read ${first} --post --say "<the tension, in design words>"\`. Critics never edit, and you build nothing unless asked.`,
  ].join("\n");
}

/** A crit the room was asked for, read back off its comment. */
export interface RoomAsk {
  commentId: string;
  createdAt: string;
  by: Actor;
  screens: { itemId: string; versionId: string }[];
  critics: string[];
  why: AskWhy;
}

function allComments(canvas: Pick<CanvasContents, "threads">): Comment[] {
  return Object.values(canvas.threads).flatMap((t) => t.comments).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

const ASK_RE = new RegExp(`${ASK_MARK} \\(([^)]+)\\):`);

/** One comment as a room ask, or null. */
function readAsk(c: Comment): RoomAsk | null {
  const m = ASK_RE.exec(c.body);
  const named = /^Critics: ([a-z0-9, -]+)\.$/m.exec(c.body);
  if (!m || !named) return null;
  const screens = m[1]!.split(",").map((s) => s.trim()).flatMap((s) => {
    const [itemId, versionId] = s.split("@");
    return itemId && versionId ? [{ itemId, versionId }] : [];
  });
  const head = c.body.split("\n")[0] ?? "";
  const why: AskWhy = head.endsWith("— they paused.") ? "pause" : head.endsWith("— before they share.") ? "share" : "asked";
  return { commentId: c.id, createdAt: c.createdAt, by: c.author, screens, critics: named[1]!.split(",").map((s) => s.trim()).filter(Boolean), why };
}

/** Every crit the room was asked for on this canvas, oldest first. */
export function roomAsks(canvas: Pick<CanvasContents, "threads">): RoomAsk[] {
  return allComments(canvas).flatMap((c) => {
    const a = readAsk(c);
    return a ? [a] : [];
  });
}

/** The newest crit asked about this screen, or null. */
export function roomAskFor(canvas: Pick<CanvasContents, "threads">, itemId: string): RoomAsk | null {
  return roomAsks(canvas).filter((a) => a.screens.some((s) => s.itemId === itemId)).at(-1) ?? null;
}

/**
 * **The notes a crit drew** — the lens notes on this screen, by the lenses
 * that crit asked, written since it was asked. What the read folds, from the
 * terminal and the browser alike.
 */
export function roomNotes(canvas: Pick<CanvasContents, "threads" | "items">, ask: RoomAsk, itemId: string): CritiqueNote[] {
  const who = new Set(ask.critics);
  return Object.values(canvas.threads)
    .map((t) => readNote(t, canvas.items))
    .filter((n): n is CritiqueNote => n !== null && n.persona !== undefined && who.has(n.persona) && n.item === itemId && n.createdAt >= ask.createdAt);
}

/** The read of the room for one screen: the fold, and the lenses that said nothing at their volume. */
export interface RoomRead {
  ask: RoomAsk;
  itemId: string;
  notes: CritiqueNote[];
  read: CritiqueRead;
  silent: string[];
}

/** **The read of the room** — `critiqueRead` over a crit's lens notes: agree, split and blocker, a split surfaced and never averaged. */
export function roomRead(canvas: Pick<CanvasContents, "threads" | "items">, ask: RoomAsk, itemId: string): RoomRead {
  const notes = roomNotes(canvas, ask, itemId);
  const spoke = new Set(notes.map((n) => n.persona));
  return { ask, itemId, notes, read: critiqueRead(notes), silent: ask.critics.filter((c) => !spoke.has(c)) };
}

/**
 * **The read the lead posts** — a record in the Chat: the head names the
 * screen and the crit it answers, then the lead's words naming each tension,
 * then the fold's own words, which carry each split's *build both*.
 */
export function roomReadBody(item: Pick<Item, "id" | "title">, ask: RoomAsk, say: string, read: CritiqueRead, silentNames: readonly string[]): string {
  return [
    `${READ_HEAD} — “${item.title || "Untitled"}” (${item.id}, after ${ask.commentId})`,
    ...(say.trim() ? [say.trim(), ""] : []),
    readWords(read),
    ...(silentNames.length ? [`Nothing to say at their volume: ${AND(silentNames)}.`] : []),
  ].join("\n");
}

/** The read the lead posted for this crit and screen: who, which comment, and its words above the fold. */
export interface PostedRoomRead {
  commentId: string;
  by: Actor;
  say: string;
}

/** The lead's posted read for this crit and screen, or null. */
export function postedRoomRead(canvas: Pick<CanvasContents, "threads">, ask: RoomAsk, itemId: string): PostedRoomRead | null {
  const head = `(${itemId}, after ${ask.commentId})`;
  const c = allComments(canvas).filter((x) => x.record && x.body.startsWith(READ_HEAD) && x.body.split("\n")[0]!.endsWith(head)).at(-1);
  if (!c) return null;
  const rest = c.body.split("\n").slice(1);
  const fold = rest.findIndex((l) => l.startsWith("**They") || l.startsWith("**Blocker:**"));
  return { commentId: c.id, by: c.author, say: rest.slice(0, fold < 0 ? rest.length : fold).join("\n").trim() };
}

/**
 * **Build both, asked of the lead** — two proposals beneath the screen, one
 * answering each side of the split, each citing the critic's note it answers
 * (`critic:<thread>`), so the cap and the dashed mark hold them like any
 * other proposal. Nothing changes until the person keeps one.
 */
export function roomBothBody(lead: Pick<Actor, "name">, item: Pick<Item, "id" | "title">, a: CritiqueNote, b: CritiqueNote): string {
  const side = (n: CritiqueNote) => `${n.critic} (critic:${n.threadId}): “${gist(n.text, 200)}” → \`isocan propose ${item.id} <file> --cites critic:${n.threadId} --why "<what it tries, in design words>"\``;
  return [
    `@${lead.name} ${BOTH_MARK} (${a.threadId}+${b.threadId}): two proposals beneath “${item.title || "Untitled"}”, one for each side of the split, each doing what its note asks and nothing else.`,
    `1. ${side(a)}`,
    `2. ${side(b)}`,
    `Leave “${item.title || "Untitled"}” as it is; the person keeps one, both or neither.`,
  ].join("\n");
}

/** Whether build-both was already asked for this split. */
export function bothAsked(canvas: Pick<CanvasContents, "threads">, ref: string): boolean {
  return allComments(canvas).some((c) => c.body.includes(`${BOTH_MARK} (${ref})`));
}

/* ---- when the person pauses -------------------------------------------- */

/** A pause is a minute of quiet after the person's last edit to a screen. */
export const PAUSE_MS = 60_000;
/** A pause older than this is not news: the room does not wake for yesterday's edit. */
export const PAUSE_STALE_MS = 30 * 60_000;

/**
 * **Whether the person's pause should wake the room**, and over what — the
 * screen they last edited, at its version, with the critics set to *when I
 * pause*. Null while they are still working (under `PAUSE_MS` since their
 * last edit), when the edit is stale, when that version was already
 * critted, or when no critic is set to speak on a pause. Pure: the person's
 * own client asks once, as the ripple's settle does.
 */
export function pauseDue(canvas: CanvasContents, personId: string, now: number, critics: readonly { itemId: string; name: string }[]): { itemId: string; versionId: string; critics: string[] } | null {
  const pausing = critics.filter((c) => {
    const card = canvas.items[c.itemId];
    if (!card) return false;
    const s = roomSettings(card);
    return s.on && s.when === "pause";
  });
  if (!pausing.length) return null;
  let last: { item: Item; versionId: string; at: number } | null = null;
  for (const item of Object.values(canvas.items)) {
    if (item.properties[CRITIC_PROP] !== undefined || item.properties.proposal !== undefined) continue;
    const v = item.versions.find((x) => x.id === item.currentVersionId);
    if (!v || v.mimeType !== "text/html" || v.createdBy.id !== personId) continue;
    const at = Date.parse(v.createdAt);
    if (!last || at > last.at) last = { item, versionId: v.id, at };
  }
  if (!last || now - last.at < PAUSE_MS || now - last.at > PAUSE_STALE_MS) return null;
  const version = last.versionId;
  const itemId = last.item.id;
  if (roomAsks(canvas).some((a) => a.screens.some((s) => s.itemId === itemId && s.versionId === version))) return null;
  return { itemId, versionId: version, critics: pausing.map((c) => c.name) };
}
