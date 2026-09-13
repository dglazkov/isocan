/**
 * **Ending a surface, and meaning it** — the shared half of
 * `docs/projects/operator/design.md`, "End a badge" (operator phase 4).
 *
 * Kill-a-badge has tombstoned since multiuser phase 9, and the tombstone
 * held: a killed badge cannot authenticate and drops out of every query. What
 * it did NOT do was reach anything the badge was holding at the moment it
 * died — its open sockets kept receiving broadcasts, its parked wait heard
 * silence, a pass it had minted was still redeemable, and the 401 its holder
 * met said only *this home does not know that badge*, which is what a wiped
 * home says too. Four gaps, each a bug in the owner's own stolen-laptop path,
 * each fixed for everyone before the operator's verb is built on top.
 *
 * This file is the words and the codes, so a daemon, a tab and a terminal
 * cannot each invent their own reading of what happened. Everything here is
 * data and pure functions; the acting lives in `packages/server`.
 *
 * **Two kinds of end, one shape.** A surface is ended by its own holder — a
 * sign-out, a lost laptop ended from the phone — or by the operator of the
 * home, for a reason category the affected person is shown. The sentence
 * differs; the mechanism does not. `by` says which, and it is what the CLI
 * branches on: an end by the holder keeps the quiet re-badge that lost-badge
 * recovery is made of, and an end by the operator prints the sentence and
 * stops.
 */

import { takedownDate, TAKEDOWN_REASONS, type TakedownReason } from "./takedown.ts";

/**
 * **The close reason, and the `reason` beside `not-admitted` on a woken
 * wait, for a badge that has been ended.**
 *
 * One word and short on purpose, for `TAKEN_DOWN`'s reason: a WebSocket close
 * reason is capped at 123 bytes and throws rather than truncating, so the
 * socket carries this and the sentence is fetched by whoever renders it — off
 * the 401, which is the one answer a dead badge is still given.
 *
 * It rides where `withdrawn` and `taken-down` ride because it is the same
 * kind of fact about the same kind of moment — a connection that was inside
 * and is now refused — and every client that already branches on those two
 * is already looking in the right place. What it must never be is
 * `withdrawn`: nobody removed this person from a canvas, they were ended
 * everywhere at once, and sending them to an owner who did nothing would be
 * the wrong sentence.
 */
export const ENDED = "ended";

/**
 * **The 401 a dead badge meets**, distinct from `bad-badge`.
 *
 * `bad-badge` means *this home does not know that badge* — a wiped home, or a
 * credential from somewhere else — and its remedy is to throw the badge away
 * and knock again. An ended badge is one this home knows perfectly well and
 * has a record about, and the difference is the whole message: *this surface
 * was ended, on this date, by this hand*. The `reason` beside the code is
 * `holder` or `operator`, and the body carries the notice whole.
 */
export const BADGE_ENDED = "badge-ended";

/** Who ended it. The two values the CLI's re-badge branches on — read off
 * `BadgeEnd.by`, which is why the alias itself is not exported. */
type EndedBy = "holder" | "operator";

/**
 * **What a surface is handed about a badge that was ended** — on the 401,
 * and rendered by the tab and the terminal.
 *
 * Thin, like `TakedownNotice`, and for the same reason: this crosses the wire
 * to whoever held the badge. No ledger act id, no operator's note — the
 * reason category and the address are what the design says the affected
 * person reads, and nothing else is.
 */
export interface BadgeEnd {
  badgeId: string;
  /** When it was ended, ISO. The date in the sentence. */
  at: string;
  by: EndedBy;
  /** The category, for an end by the operator. Absent for the holder's own. */
  reason?: TakedownReason;
  /** The operator's address, for the sentence's *Write to …*. Absent for the
   * holder's own. */
  address?: string;
  /** The sentence itself, rendered by the HOME, so a tab running last month's
   * bundle says what this home says today. */
  sentence: string;
}

/**
 * **The operator's half of a tombstone**, as the desk keeps it beside
 * `killedAt` and `killedBy` (operator phase 4).
 *
 * `by` is the attribute that was proved — `email:olu@example.test` — and it
 * is the operator who ACTED rather than a name read out of configuration, for
 * the takedown row's reason: a home with two operators must not send the
 * ended person to whichever one is first in the list. The act id is how the
 * sentence and the proof that justified it are one lookup apart.
 */
export interface OperatorEnd {
  reason: TakedownReason;
  by: string;
  actId: string;
}

/**
 * **What ending a badge reached, counted at the moment of acting** — the
 * numbers `isocan badges --kill` and `isocan operator end` print, so the
 * person who pressed the control can check them rather than trust *it has
 * been handled*. At this instance, which is the sweep hub's bound: a second
 * instance during a rollout is not reached, and the verb says *here*.
 */
export interface EndReach {
  /** Sockets closed with {@link ENDED} — the dead badge's tabs and daemons. */
  sockets: number;
  /** Parked `isocan wait` calls the dead badge held, woken and refused. */
  waits: number;
}

/** The notice, from what the desk holds. */
export function badgeEndNotice(badgeId: string, at: string, operator: OperatorEnd | null): BadgeEnd {
  if (!operator) {
    return { badgeId, at, by: "holder", sentence: endedSentence({ at, by: "holder" }) };
  }
  const address = addressOf(operator.by);
  return {
    badgeId,
    at,
    by: "operator",
    reason: operator.reason,
    address,
    sentence: endedSentence({ at, by: "operator", reason: operator.reason, address }),
  };
}

/**
 * **The sentence** (design, "Words", verbatim for the operator's end):
 *
 * > This surface was ended by the operator of this home on 12 September
 * > 2026: harassment. Write to olu@example.com.
 *
 * And for the holder's own — a sign-out, or a machine ended from another of
 * the same person's surfaces — a sentence that names neither an operator nor
 * an address, because there is nobody to write to but yourself:
 *
 * > This surface was ended on 12 September 2026 from another of its holder's
 * > surfaces.
 *
 * Rendered here rather than in each surface, for the takedown sentence's
 * reason: three spellings of one sentence is three sentences, and the one
 * that drifts is the one somebody reads. The date is UTC and absolute, not
 * relative, because this sentence is quoted months later in an email.
 */
export function endedSentence(end: {
  at: string;
  by: EndedBy;
  reason?: TakedownReason;
  address?: string;
}): string {
  const date = takedownDate(end.at);
  if (end.by === "operator" && end.reason && end.address) {
    return (
      `This surface was ended by the operator of this home on ${date}: ` +
      `${TAKEDOWN_REASONS[end.reason]}. Write to ${end.address}.`
    );
  }
  return `This surface was ended on ${date} from another of its holder's surfaces.`;
}

/** `email:olu@example.com` → `olu@example.com`, as the takedown sentence
 * does: the reader is about to write an email. */
function addressOf(attribute: string): string {
  return attribute.replace(/^email:/, "");
}

// ---- what the operator's verb sends and is answered ----

/**
 * `POST /api/operator/end/:target` — a badge id, an actor id, or an address
 * (`email:…`), which is the id a report names (design, "End a badge").
 *
 * **Deliberately not a listing.** The target is resolved to the badges it
 * reaches, and only those are described; there is no shape of this route
 * that enumerates the home, for the reason `http.ts` gives about badges: a
 * listing would be a roster of people to end.
 */
export const OPERATOR_END_ROUTE = "/api/operator/end/:target";

/** What `isocan operator end` sends — twice: once to read the reach, once to
 * act on it. */
export interface OperatorEndRequest {
  /** Why, from {@link TAKEDOWN_REASONS}: the category the ended person is
   * shown. Required to act; the preview records it too. */
  reason?: string;
  /** The operator's own note — recorded, shown to nobody. */
  note?: string;
  /**
   * **Read the reach and act on nothing** (journey 7 step 2: *the terminal
   * lists what that address reaches before it acts*). A preview is still an
   * act in the ledger — somebody with a proof asked this home what an address
   * reaches — and settles as `previewed`.
   */
  preview?: boolean;
  /** End the enrolments too: the badges the target's own passes let in, which
   * would otherwise outlive it (innkeeper.md; journey 7 step 2's question). */
  withEnrolments?: boolean;
}

/** One surface the target reaches, as the verb prints it. Thin, like
 * `BadgeSummary`, and for the same reason: a count of rooms, not the rooms. */
export interface EndedSurface {
  badgeId: string;
  kind: string;
  /** Who it may speak as — the names, because the operator is reading a
   * report that names a person. */
  actors: { id: string; name: string }[];
  canvases: number;
  lastSeen: string;
}

/**
 * **What the target reaches, listed before the act** (design, "End a
 * badge": *the verb lists what the target reaches before it acts, including
 * the registrations and enrolments a badge created*).
 *
 * `registrations` is deliberately absent: Scene 7's dispatch registrations
 * are not built in this tree, and a field that is always empty would be a
 * seam somebody eventually fills in. When they exist, they belong here.
 */
export interface OperatorEndReach {
  /** How the target was read: by badge id, by actor (folded identities
   * resolved through `actor.join`), or by proved address. */
  target: { kind: "badge" | "actor" | "address"; id: string };
  /** The live badges the target names. */
  badges: EndedSurface[];
  /** The live badges those badges enrolled by pass, which outlive them
   * unless `withEnrolments` says otherwise. */
  enrolments: EndedSurface[];
  /** Passes minted by the target badges that are unspent and unexpired —
   * each one refused from the moment of the act. */
  passes: number;
}

/** What the route answers: the reach it read, and — unless previewing —
 * what it did. */
export interface OperatorEndResponse {
  reach: OperatorEndReach;
  /** The badge ids ended by this act. Empty on a preview. */
  ended: string[];
  /** The sockets closed and waits woken, summed over every badge ended. */
  reached: EndReach;
  /** What the sweeps of their rooms did to everybody else. */
  swept: { expelled: number; rerooted: number };
  /** The sentence the ended people read, or null on a preview. */
  sentence: string | null;
}
