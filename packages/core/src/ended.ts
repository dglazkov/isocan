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
