/**
 * **What changed, said to the person who uses this — not to the person who
 * built it.**
 *
 * `docs/changelog/` already exists and is deliberately not this. It is written
 * for whoever has to maintain the thing: it names functions, records the
 * arguments that were had, and keeps the roads not taken. That is the right
 * document and the wrong one to put in front of somebody who just wants to
 * know whether the canvas does anything new today.
 *
 * So a day's entry may carry a `## What's new` section, and this reads it. Two
 * consequences worth stating, because both are the point:
 *
 * - **It lives in the same file as the day it describes**, so the two cannot
 *   drift. Writing the day up and saying what a person got out of it is one
 *   act, not two things to remember.
 * - **It is optional.** A day of refactoring, a day of tests, a day spent
 *   chasing a flake — those genuinely have nothing a user would notice, and
 *   the honest thing is for them not to appear. A "what's new" that has an
 *   entry every day is one nobody believes by the second week.
 */

export interface NewsDay {
  /** `YYYY-MM-DD`, from the filename — the sortable half. */
  day: string;
  /** What a person reads: "29 August 2026", from the file's own heading. */
  title: string;
  /** One line per thing, in the words a user would use. */
  items: string[];
}

const HEADING = /^#\s+(.+?)\s*$/m;
const SECTION = /^##\s+What's new\s*$/im;

/**
 * Read one day's file. `null` when the day has nothing to say, which is a
 * normal answer and not a missing one.
 */
export function newsFrom(day: string, markdown: string): NewsDay | null {
  const start = markdown.search(SECTION);
  if (start === -1) return null;
  const after = markdown.slice(start);
  const body = after.slice(after.indexOf("\n") + 1);
  // Up to the next heading of any level: the section owns its bullets and
  // nothing below them.
  const end = body.search(/^#{1,6}\s/m);
  const items = (end === -1 ? body : body.slice(0, end))
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- ") || line.startsWith("* "))
    .map((line) => line.slice(2).trim())
    .filter(Boolean);
  if (items.length === 0) return null;
  return { day, title: markdown.match(HEADING)?.[1]?.trim() ?? day, items };
}

/** Every day that has something to say, newest first. */
export function news(files: readonly { day: string; markdown: string }[]): NewsDay[] {
  return files
    .map((f) => newsFrom(f.day, f.markdown))
    .filter((d): d is NewsDay => d !== null)
    .sort((a, b) => b.day.localeCompare(a.day));
}

/**
 * **What somebody has not read yet.**
 *
 * Keyed on the DAY rather than on a count or a hash: days are the unit here,
 * they only ever move forward, and a reader who saw everything up to the 29th
 * has seen it whatever was added to the 29th afterwards. A count would be
 * wrong the moment a day gained a second line; a hash would mark everything
 * unread when a typo was fixed.
 *
 * `null` — never read anything — is deliberately not "everything is new". A
 * first-time visitor met with fifty unread notices has been handed a chore,
 * so the caller gets the whole list and decides; `unseen` is for the dot, and
 * a dot on somebody's first visit is a lie about their attention.
 */
export function unseen(days: readonly NewsDay[], lastSeenDay: string | null): NewsDay[] {
  if (lastSeenDay === null) return [];
  return days.filter((d) => d.day > lastSeenDay);
}

/** The newest day there is, for marking everything read. */
export function newestDay(days: readonly NewsDay[]): string | null {
  return days[0]?.day ?? null;
}
