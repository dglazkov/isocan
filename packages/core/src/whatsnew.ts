/**
 * **What changed, said to the person who uses this — not to the person who
 * built it.**
 *
 * This reads `WHATSNEW.md`, which is the ONLY document written for that
 * reader. `docs/changelog/` is the other one: a page per day for whoever
 * maintains this, naming functions and keeping the arguments that were had.
 *
 * **They are separate files on purpose, and the first attempt had them in
 * one.** A `## What's new` section inside each day's changelog cannot drift
 * from the day it describes, which was the argument for it — and it was the
 * wrong trade twice. It puts user-facing text inside a document full of
 * internal reasoning, one careless read away from serving the engineering
 * narrative to everybody; and `docs/` is excluded from the production image
 * deliberately, so a home could never have read it anyway. The route answered
 * `{"days":[]}` on prod while working perfectly on a checkout.
 *
 * So: one public file, which ships because nothing excludes it, holding
 * nothing that is not meant to be read.
 *
 * **Days with nothing a person would notice are simply absent.** A day of
 * refactoring or of chasing a flake is a real day's work and an empty notice,
 * and a what's-new with an entry every day is one nobody believes by the
 * second week.
 */

export interface NewsDay {
  /** `YYYY-MM-DD`, derived from the heading — the sortable half. */
  day: string;
  /** What a person reads: "29 August 2026", the heading as written. */
  title: string;
  /** One line per thing, in the words a user would use. */
  items: string[];
}

const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];

/**
 * `"29 August 2026"` → `"2026-08-29"`.
 *
 * The heading is what a person reads, so it stays prose; the sortable form is
 * derived rather than written twice. A heading that is not a date sorts by its
 * own text, which keeps an odd entry visible instead of dropping it.
 */
export function dayOf(title: string): string {
  const m = title.trim().match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (!m) return title.trim();
  const month = MONTHS.indexOf(m[2]!.toLowerCase());
  if (month < 0) return title.trim();
  return `${m[3]}-${String(month + 1).padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
}

/**
 * Every day the file names, newest first.
 *
 * The file is authored newest-first and this sorts anyway, so an entry added
 * in the wrong place lands where it belongs rather than where it was typed.
 */
export function news(markdown: string): NewsDay[] {
  const days: NewsDay[] = [];
  // `## <heading>` starts a day; everything until the next `##` belongs to it.
  const parts = markdown.split(/^##\s+/m).slice(1);
  for (const part of parts) {
    const [heading = "", ...rest] = part.split("\n");
    const items = rest
      .map((line) => line.trim())
      .filter((line) => line.startsWith("- ") || line.startsWith("* "))
      .map((line) => line.slice(2).trim())
      .filter(Boolean);
    if (items.length === 0) continue; // a heading with nothing under it is not news
    days.push({ day: dayOf(heading), title: heading.trim(), items });
  }
  return days.sort((a, b) => b.day.localeCompare(a.day));
}

/**
 * **What somebody has not read yet.**
 *
 * Keyed on the DAY rather than on a count or a hash: days only move forward,
 * and a reader who saw everything up to the 29th has seen it whatever was
 * added to the 29th afterwards. A count would be wrong the moment a day gained
 * a second line; a hash would mark everything unread when a typo was fixed.
 *
 * `null` — never read anything — is deliberately not "everything is new". A
 * first-time visitor met with fifty unread notices has been handed a chore, so
 * the caller still gets the whole list; what is suppressed is the CLAIM that
 * they are behind on something never offered to them.
 */
export function unseen(days: readonly NewsDay[], lastSeenDay: string | null): NewsDay[] {
  if (lastSeenDay === null) return [];
  return days.filter((d) => d.day > lastSeenDay);
}

/** The newest day there is, for marking everything read. */
export function newestDay(days: readonly NewsDay[]): string | null {
  return days[0]?.day ?? null;
}
