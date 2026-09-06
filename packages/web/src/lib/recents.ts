/**
 * **The canvases this browser was on lately**, most recent first.
 *
 * The switcher leads with these because they are nearly always the answer:
 * the canvas you were on ten minutes ago is the one you are going back to.
 * "Lately" is a fact only this browser knows — the daemon sees writes, not
 * visits, and a canvas somebody read for an hour without touching anything
 * is exactly the kind they come back to — so it lives in `localStorage`, per
 * browser, like the home screen's sort.
 *
 * The title rides along so the list can paint before the canvas list has
 * been fetched, and so it can paint at all when the fetch fails: offline, the
 * recents are the whole list, and every one of them opens from the replica.
 * A title that has since changed is corrected the moment the fetch lands,
 * because the row is drawn from the fetched canvas whenever there is one.
 */
export interface RecentCanvas {
  id: string;
  title: string;
}

export const RECENT_KEY = "isocan.canvases.recent";

/** Beyond this many, a "recent" canvas is not recent. */
export const RECENT_LIMIT = 20;

/**
 * The list after a visit. Pure, so the rule can be tested without a browser:
 * the visited canvas goes to the front, a previous entry for it goes away
 * (one row per canvas, at its latest place), and the list is capped.
 */
export function rememberVisit(list: readonly RecentCanvas[], visited: RecentCanvas): RecentCanvas[] {
  return [visited, ...list.filter((entry) => entry.id !== visited.id)].slice(0, RECENT_LIMIT);
}

/** What this browser remembers. Anything unreadable is an empty memory, not
 *  a broken switcher. */
export function readRecents(): RecentCanvas[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is RecentCanvas =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as RecentCanvas).id === "string" &&
        typeof (entry as RecentCanvas).title === "string",
    );
  } catch {
    return [];
  }
}

/** Note a visit. Called when a canvas has loaded far enough to have a title,
 *  which is also the moment it is a canvas you were actually on. */
export function recordVisit(visited: RecentCanvas): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(rememberVisit(readRecents(), visited)));
  } catch {
    // A browser refusing storage costs the recents, not the switcher.
  }
}
