import type { CanvasContents, Item } from "./model.ts";
import { mainThread } from "./model.ts";
import type { PresenceSession } from "./protocol.ts";
import { parseSlashCommand } from "./commands.ts";
import { AREA_KIND, inArea } from "./area.ts";
import type { Paper } from "./textnode.ts";

/**
 * **The design sprint, as state the canvas can derive.**
 *
 * `docs/research/2026-09-01-design-sprint.md`: a sprint is a script a
 * facilitator runs over a small ritual vocabulary — phase, timebox, silence,
 * quota, vote, reveal, decide — and almost all of it is verbs the canvas
 * already has. What was missing was a clock somebody can see, a hand-in
 * count, and a heat map that hides its numbers while the vote is open.
 *
 * **Phase is derived, not stored.** `/ask` is the precedent (roster.ts): an
 * open question is not a flag somebody sets and forgets, it is read off the
 * thread. The current phase is the most recent `/sprint <phase> [duration]`
 * in the Chat, and its end is that comment's daemon-stamped `createdAt` plus
 * the duration — so two browsers and a CLI compute the same countdown from
 * the same clock. No `sprint.setPhase` op exists and none should: the record
 * is the conversation, which is where the room would look anyway.
 *
 * **Hand-ins are a property.** `sprint=<phase>` on an item says it was handed
 * in for that phase — `item.update`, the same shape `slide`, `context` and
 * `paper` took, replicating and undoing like any other fact.
 *
 * **A vote is a reaction.** Per actor, undoable, one op. What this module adds
 * is the rendering rule: while a vote phase is open, counts and names are
 * hidden BY LENS and never by record — `isocan ls --json` keeps saying who
 * reacted, and the app simply does not draw it until the bell. The curtain is
 * etiquette, and the research note says so in as many words.
 */

export const SPRINT_PROP = "sprint";

/** What kind of moment a phase is — decides what the surfaces hide. */
type PhaseKind = "group" | "silent" | "vote" | "decide";

interface PhaseSpec {
  /** The word after `/sprint`. */
  name: string;
  /** What the clock chip says. */
  label: string;
  kind: PhaseKind;
  /** The mark a vote phase counts, or null. Announced by the facilitator
   * too, but one constant so the chip and `isocan sprint` agree. */
  mark: string | null;
  /** Knapp's timebox, in seconds, used when the command names none. Null
   * means the phase runs until the next one — a museum walk has no clock. */
  defaultSeconds: number | null;
  /** Which sheet of the board this phase happens on — a key into
   * `SPRINT_BOARD`. Several phases share a sheet: notes, ideas, crazy8s and
   * sketch are all "Sketches", the whole of Wednesday's choosing is "Vote". */
  area: BoardKey;
}

/**
 * **The board: one sheet per stretch of the week, in the order it runs.**
 *
 * `docs/projects/sprint/journey.md`, Scene 0: a facilitator's first move is
 * to cover the wall in labelled sheets so the week is visible before it
 * starts and everyone always knows where to stand. This is that wall, as
 * data both surfaces lay out identically — `isocan sprint board` and the
 * `/sprint` skill read the same table, so a board laid from a terminal and
 * one laid by an agent are the same board.
 *
 * Each sheet is an AREA (`core/area.ts`) wearing `board=<key>`, which is
 * how a phase finds its sheet later even after somebody renames it: the
 * title is for people, the key is for the phase table. The card is the
 * three lines a person reads standing in front of it — what happens here,
 * how long, what you do — so nobody has to know the method to follow it.
 *
 * Sizes are rough room for what each holds, top-aligned in one row with a
 * gap, because a board is read left to right as a story: brief → map →
 * questions → target → … → wrap. Not a grid: the order IS the week.
 */
export type BoardKey =
  | "brief"
  | "map"
  | "experts"
  | "target"
  | "demos"
  | "sketches"
  | "vote"
  | "storyboard"
  | "prototype"
  | "test"
  | "wrap";

export interface BoardArea {
  key: BoardKey;
  title: string;
  tint: Paper;
  width: number;
  height: number;
  /** The card: what happens here, in a few lines of markdown. */
  card: string;
}

/** `board=<key>` on an area item says which sheet of the board it is. */
export const BOARD_PROP = "board";
/** Between sheets, in world units. */
export const BOARD_GAP = 200;

export const SPRINT_BOARD: readonly BoardArea[] = [
  {
    key: "brief",
    title: "Brief",
    tint: "grey",
    width: 1200,
    height: 900,
    card: "**What we are designing, and who decides.**\n\nThe goal in a sentence, the two or three questions the week has to answer, the Decider, the sketchers, the cut. Done before the first bell — react ✅ on the brief when it is right.",
  },
  {
    key: "map",
    title: "Map",
    tint: "blue",
    width: 2400,
    height: 1400,
    card: "**Monday · Map · 45 min.**\n\nThe customer's path in 5–15 steps, actors on the left, the ending on the right. Say the steps; the facilitator draws them. Drag a node and the arrows follow.",
  },
  {
    key: "experts",
    title: "Experts & HMW",
    tint: "yellow",
    width: 2000,
    height: 1400,
    card: "**Monday · Ask the Experts, then How Might We · 10 min.**\n\nInterviews pin here, one thread each. While listening, write *How might we…* on yellow notes — one idea per note, silently. **New note** on the clock chip puts one here.",
  },
  {
    key: "target",
    title: "Target",
    tint: "pink",
    width: 1200,
    height: 900,
    card: "**Monday · Pick a target.**\n\nTwo ⭐ each on the HMW notes, silently. Then the Decider's 🎯 on one step of the map — that step and its notes come here. One thing on this sheet.",
  },
  {
    key: "demos",
    title: "Demos",
    tint: "blue",
    width: 1600,
    height: 1000,
    card: "**Tuesday · Lightning Demos · 3 min each.**\n\nA site worth stealing from, as an item, with one pink note under it saying what to steal.",
  },
  {
    key: "sketches",
    title: "Sketches",
    tint: "yellow",
    width: 2400,
    height: 1400,
    card: "**Tuesday · Notes, Ideas, Crazy 8s, Solution sketch.**\n\nWork alone, on your desk — nothing lands here until the bell. Then **Hand in**: one solution sketch each, three panels, a title that says the idea. The wall arrives together.",
  },
  {
    key: "vote",
    title: "Vote",
    tint: "pink",
    width: 2400,
    height: 1400,
    card: "**Wednesday · Museum, Heat Map, Critique, Straw Poll, Supervote.**\n\nWalk the wall in silence. 🔴 on the parts you like, as many as you want. Three minutes of critique per sketch, the author last. One ⭐ each. The Decider's 🏆 decides. Votes are hidden until the bell.",
  },
  {
    key: "storyboard",
    title: "Storyboard",
    tint: "grey",
    width: 3200,
    height: 900,
    card: "**Wednesday · Storyboard · 60 min.**\n\nFifteen frames in a row. Move the winning sketches in; a missing frame is a yellow note saying what goes there. The row is the deck.",
  },
  {
    key: "prototype",
    title: "Prototype",
    tint: "green",
    width: 2400,
    height: 1400,
    card: "**Thursday · Prototype.**\n\nA façade, frame by frame: one maker per stretch of frames, named in the Chat first; a Stitcher owns consistency. Each frame lands here as a screen. The trial run is the deck full screen.",
  },
  {
    key: "test",
    title: "Test",
    tint: "blue",
    width: 3200,
    height: 1400,
    card: "**Friday · Test · five people.**\n\nRows are people, columns are frames. One note per cell, from what was said — never invented. A pattern needs three of five.",
  },
  {
    key: "wrap",
    title: "Wrap",
    tint: "grey",
    width: 1200,
    height: 900,
    card: "**Friday · Wrap-up · 30 min.**\n\nQuote Monday's questions and answer each with a # to the thing that answers it. `isocan recap` writes the page. The board stays: it is the record.",
  },
];

export function boardArea(key: BoardKey): BoardArea {
  return SPRINT_BOARD.find((one) => one.key === key)!;
}

/**
 * Where each sheet goes: one row from `origin`, top-aligned, a gap between.
 * Pure, so the CLI's `sprint board` and a test agree to the pixel.
 */
export function boardLayout(origin: { x: number; y: number }): (BoardArea & { x: number; y: number })[] {
  let x = origin.x;
  return SPRINT_BOARD.map((one) => {
    const placed = { ...one, x, y: origin.y };
    x += one.width + BOARD_GAP;
    return placed;
  });
}

/** The sheet wearing `board=<key>`, or null when the board has not been
 *  laid (or that sheet was deleted). By the property, not the title: a
 *  renamed sheet is still the sheet. */
export function boardAreaFor(canvas: CanvasContents, key: BoardKey): Item | null {
  return (
    Object.values(canvas.items).find(
      (item) => item.properties.kind === AREA_KIND && item.properties[BOARD_PROP] === key,
    ) ?? null
  );
}

/** Every sheet of the board that exists here, in board order. */
export function boardOf(canvas: CanvasContents): Item[] {
  return SPRINT_BOARD.map((one) => boardAreaFor(canvas, one.key)).filter((one): one is Item => one !== null);
}

/**
 * **The brief, as a card.** What the setup round answered, written once as
 * markdown the Brief sheet holds — a text node wearing `brief=1` so the
 * facilitator can find it again and write the next version rather than a
 * second card. Empty fields are left out, not written as "TBD": a brief
 * that says less is honest, and the next version fills it.
 */
export const BRIEF_PROP = "brief";

export interface Brief {
  goal?: string;
  questions?: string[];
  decider?: string;
  sketchers?: string[];
  cut?: string;
}

export function briefCard(brief: Brief): string {
  const lines: string[] = ["# Brief", ""];
  if (brief.goal) lines.push(`**Goal.** ${brief.goal}`, "");
  if (brief.questions && brief.questions.length > 0) {
    lines.push("**Sprint questions.**");
    for (const q of brief.questions) lines.push(`- ${q}`);
    lines.push("");
  }
  if (brief.decider) lines.push(`**Decider.** ${brief.decider}`, "");
  if (brief.sketchers && brief.sketchers.length > 0) lines.push(`**Sketching.** ${brief.sketchers.join(", ")}`, "");
  if (brief.cut) lines.push(`**Cut.** ${brief.cut}`, "");
  return lines.join("\n").trimEnd() + "\n";
}

/** The brief card on this canvas, or null. */
export function briefItem(canvas: CanvasContents): Item | null {
  return Object.values(canvas.items).find((item) => item.properties[BRIEF_PROP] === "1") ?? null;
}

/**
 * **The desk** (sprint phase 3, journey Scene 2): a private canvas per
 * sketcher, born by the facilitator, that knows which sprint it belongs to.
 *
 * `sprintOf=<canvas id>` on the DESK canvas's own properties is the whole
 * record. The privacy is real rather than a courtesy: the desk's link grant
 * is turned off at birth and one single-use pass admits one browser, so
 * the daemon refuses everyone else at the door — the answer the 1 Sep
 * research chose over a veil. What the desk's chip shows (the sprint's
 * phase and clock) it reads from the sprint canvas by asking for it; what
 * *Hand in* does from a desk is a cross-canvas copy onto the sprint's
 * sheet, stamped for the phase. Nothing on a desk is on the wall until its
 * sketcher says so.
 */
export const DESK_OF_PROP = "sprintOf";

/** The sprint this canvas is a desk for, or null when it is not a desk. */
export function deskOf(project: { properties?: Record<string, string> }): string | null {
  return project.properties?.[DESK_OF_PROP] ?? null;
}

/** What a desk is called: the sketcher's name, possessive. */
export function deskTitle(name: string): string {
  const trimmed = name.trim();
  return /s$/i.test(trimmed) ? `${trimmed}' desk` : `${trimmed}'s desk`;
}

/**
 * The phases, in the order a five-day sprint runs them. A word not in this
 * table is NOT a phase — `/sprint make onboarding better` is a brief for the
 * facilitator, not a state change — which is what keeps a typo from starting
 * a timer. `end` closes the sprint.
 */
export const PHASES: readonly PhaseSpec[] = [
  { name: "map", label: "Map", kind: "group", mark: null, defaultSeconds: 45 * 60, area: "map" },
  { name: "experts", label: "Ask the Experts", kind: "group", mark: null, defaultSeconds: 20 * 60, area: "experts" },
  { name: "hmw", label: "How Might We", kind: "silent", mark: null, defaultSeconds: 10 * 60, area: "experts" },
  { name: "target", label: "Pick a target", kind: "decide", mark: "🎯", defaultSeconds: null, area: "target" },
  { name: "demos", label: "Lightning Demos", kind: "group", mark: null, defaultSeconds: 3 * 60, area: "demos" },
  { name: "notes", label: "Notes", kind: "silent", mark: null, defaultSeconds: 20 * 60, area: "sketches" },
  { name: "ideas", label: "Ideas", kind: "silent", mark: null, defaultSeconds: 20 * 60, area: "sketches" },
  { name: "crazy8s", label: "Crazy 8s", kind: "silent", mark: null, defaultSeconds: 8 * 60, area: "sketches" },
  { name: "sketch", label: "Solution sketch", kind: "silent", mark: null, defaultSeconds: 30 * 60, area: "sketches" },
  { name: "museum", label: "Art Museum", kind: "group", mark: null, defaultSeconds: null, area: "vote" },
  { name: "heatmap", label: "Heat Map", kind: "vote", mark: "🔴", defaultSeconds: 5 * 60, area: "vote" },
  { name: "critique", label: "Speed Critique", kind: "group", mark: null, defaultSeconds: 3 * 60, area: "vote" },
  { name: "poll", label: "Straw Poll", kind: "vote", mark: "⭐", defaultSeconds: 2 * 60, area: "vote" },
  { name: "supervote", label: "Supervote", kind: "decide", mark: "🏆", defaultSeconds: null, area: "vote" },
  { name: "storyboard", label: "Storyboard", kind: "group", mark: null, defaultSeconds: 60 * 60, area: "storyboard" },
  { name: "prototype", label: "Prototype", kind: "group", mark: null, defaultSeconds: null, area: "prototype" },
  { name: "test", label: "Test", kind: "group", mark: null, defaultSeconds: null, area: "test" },
  { name: "wrap", label: "Wrap-up", kind: "group", mark: null, defaultSeconds: 30 * 60, area: "wrap" },
];

/** The word that closes a sprint. Not a phase: after it there is no clock. */
export const SPRINT_END = "end";

export function phaseSpec(name: string): PhaseSpec | null {
  const key = name.toLowerCase();
  return PHASES.find((p) => p.name === key) ?? null;
}

/**
 * `8m`, `90s`, `1h`, `1h30m`, `20` (minutes) → seconds; null for anything
 * else. Minutes are the bare unit because every timebox in the method is
 * said in minutes — "Crazy 8s, eight minutes" — and a facilitator typing
 * `/sprint crazy8s 8` should get the box they meant.
 */
export function parseDuration(text: string): number | null {
  const t = text.trim().toLowerCase();
  if (t === "") return null;
  if (/^\d+$/.test(t)) return Number(t) * 60;
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!m || (m[1] === undefined && m[2] === undefined && m[3] === undefined)) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

/** Seconds → `14:02`, or `1:05:00` past an hour. What the chip shows. */
export function clockLabel(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(rest).padStart(2, "0")}`;
}

interface SprintCommand {
  /** A phase name, or `end`. */
  phase: string;
  /** Explicit duration, or null to take the phase's default. */
  seconds: number | null;
  /** Whatever followed — the brief for the box, shown on the chip. */
  note: string;
}

/**
 * What a `/sprint …` comment asks for, or null when it is not a phase change.
 * `/sprint` alone and `/sprint <free words>` are requests to a facilitator
 * (the slash command's body says what to do with them) and derive no state.
 */
export function parseSprintCommand(body: string): SprintCommand | null {
  const parsed = parseSlashCommand(body);
  if (!parsed || parsed.name !== "sprint") return null;
  const words = parsed.args.split(/\s+/).filter(Boolean);
  const first = words[0]?.toLowerCase();
  if (!first) return null;
  if (first === SPRINT_END) return { phase: SPRINT_END, seconds: null, note: words.slice(1).join(" ") };
  if (!phaseSpec(first)) return null;
  const seconds = words[1] !== undefined ? parseDuration(words[1]) : null;
  const rest = seconds === null ? words.slice(1) : words.slice(2);
  return { phase: first, seconds, note: rest.join(" ") };
}

export interface SprintState {
  phase: PhaseSpec;
  note: string;
  /** Who posted the phase — the facilitator's chair, by definition. */
  facilitatorId: string;
  /** Their name as stamped on the comment — what to say when no live
   * session names them better. */
  facilitatorName: string;
  threadId: string;
  commentId: string;
  /** ISO, the daemon's stamp on the comment. */
  startedAt: string;
  /** ISO, or null for a phase with no clock. */
  endsAt: string | null;
  /** Items wearing `sprint=<this phase>`. */
  handedIn: Item[];
  /** The sheet of the board this phase happens on, or null when no board
   * has been laid here — a sprint run with no board still has a clock. */
  area: Item | null;
}

/**
 * The sprint the Chat says is running, or null — no Chat, no `/sprint`
 * phase yet, or the last one was `end`. Newest phase wins; nothing else in
 * the conversation matters, so a room talking over the facilitator cannot
 * change the clock.
 */
export function sprintState(canvas: CanvasContents): SprintState | null {
  const chat = mainThread(canvas);
  if (!chat) return null;
  for (let i = chat.comments.length - 1; i >= 0; i--) {
    const comment = chat.comments[i]!;
    const cmd = parseSprintCommand(comment.body);
    if (!cmd) continue;
    if (cmd.phase === SPRINT_END) return null;
    const phase = phaseSpec(cmd.phase)!;
    const seconds = cmd.seconds ?? phase.defaultSeconds;
    const startedMs = Date.parse(comment.createdAt);
    return {
      phase,
      note: cmd.note,
      facilitatorId: comment.author.id,
      facilitatorName: comment.author.name,
      threadId: chat.id,
      commentId: comment.id,
      startedAt: comment.createdAt,
      endsAt: seconds === null ? null : new Date(startedMs + seconds * 1000).toISOString(),
      handedIn: Object.values(canvas.items).filter(
        (item) => item.properties[SPRINT_PROP] === phase.name,
      ),
      area: boardAreaFor(canvas, phase.area),
    };
  }
  return null;
}

/** Seconds left on the clock; null when the phase has none; 0 once it rang. */
export function remainingSeconds(state: SprintState, nowMs: number): number | null {
  if (state.endsAt === null) return null;
  return Math.max(0, Math.round((Date.parse(state.endsAt) - nowMs) / 1000));
}

/** Has the clock run out? A phase with no clock never has. */
export function phaseOver(state: SprintState, nowMs: number): boolean {
  return remainingSeconds(state, nowMs) === 0;
}

/**
 * **Whether the surfaces should hide who voted and how many** — the lens
 * half of the curtain. True exactly while a vote phase's clock is running:
 * the bell reveals, and a vote phase with no clock reveals when the next
 * phase is called. The record is untouched either way.
 */
export function hidesVotes(state: SprintState | null, nowMs: number): boolean {
  return state !== null && state.phase.kind === "vote" && !phaseOver(state, nowMs);
}

/** The patch that hands an item in for a phase — one spelling for both
 * surfaces. `phase` is the name; the current one comes from `sprintState`. */
export function handInPatch(phase: string): { properties: Record<string, string> } {
  return { properties: { [SPRINT_PROP]: phase } };
}

/** The phase an item was handed in for, or null. */
export function handedInFor(item: Item): string | null {
  return item.properties[SPRINT_PROP] ?? null;
}

/**
 * **Which actors on this canvas are agents**, for the split tally. An agent
 * is a cli session that names its harness (roster.ts's rule: a bare terminal
 * is "terminal", never guessed into an agent) or a standing enrolment. A
 * person at a browser is neither. Callers without presence pass `[]` and get
 * the enrolled set alone, which under-claims rather than guesses.
 */
export function agentActorIds(
  sessions: readonly PresenceSession[],
  canvas: CanvasContents,
): Set<string> {
  const ids = new Set<string>();
  for (const s of sessions) if (s.kind === "cli" && s.harness) ids.add(s.actor.id);
  for (const id of Object.keys(canvas.agents ?? {})) ids.add(id);
  return ids;
}

interface Tally {
  item: Item;
  humans: number;
  agents: number;
  /** Actor ids who wore the mark, for the reveal and for `--who`. */
  actorIds: string[];
}

/**
 * **Two tallies on one sketch.** A reaction records who, so the heat map can
 * show human dots and agent dots apart — the room reads the humans' as the
 * vote and the agents' as a second opinion from readers who saw every
 * sketch. A query over data already kept; no other canvas can make it
 * because their votes are anonymous by design. Sorted most-voted first,
 * humans deciding ties, then id so a wall that did not change does not
 * reorder.
 */
export function tally(
  items: readonly Item[],
  mark: string,
  agents: ReadonlySet<string>,
): Tally[] {
  return items
    .map((item) => {
      const actorIds = item.reactions?.[mark] ?? [];
      const agentCount = actorIds.filter((id) => agents.has(id)).length;
      return { item, humans: actorIds.length - agentCount, agents: agentCount, actorIds };
    })
    .filter((t) => t.actorIds.length > 0)
    .sort(
      (a, b) =>
        b.humans + b.agents - (a.humans + a.agents) ||
        b.humans - a.humans ||
        a.item.id.localeCompare(b.item.id),
    );
}

/**
 * The wall a vote is about. With a board laid, it is what is ON THE VOTE
 * SHEET — the wall is a sheet now, which is what closes the 1 Sep build's
 * one departure (hiding counts on every item because "the wall" had no
 * precise meaning). Without a board, or with an empty Vote sheet: what was
 * handed in for the most recent silent phase before this one, or — with
 * nothing handed in — every item, so a heat map over a sprint that never
 * used hand-in still works, on everything.
 */
export function wallFor(canvas: CanvasContents, state: SprintState): Item[] {
  const chat = mainThread(canvas);
  const items = Object.values(canvas.items);
  const vote = boardAreaFor(canvas, "vote");
  if (vote) {
    const onSheet = items.filter((item) => inArea(vote, item));
    if (onSheet.length > 0) return onSheet;
  }
  if (!chat) return items;
  // Walk back from the current phase's comment to the nearest silent phase.
  const at = chat.comments.findIndex((c) => c.id === state.commentId);
  for (let i = at - 1; i >= 0; i--) {
    const cmd = parseSprintCommand(chat.comments[i]!.body);
    if (!cmd || cmd.phase === SPRINT_END) continue;
    const spec = phaseSpec(cmd.phase)!;
    if (spec.kind !== "silent") continue;
    const handed = items.filter((item) => item.properties[SPRINT_PROP] === spec.name);
    if (handed.length > 0) return handed;
  }
  return items;
}
