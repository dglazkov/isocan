import { QUICK_REACTIONS } from "@isocan/core";

/**
 * The marks you reached for last, most recent first.
 *
 * **Per browser, not per canvas and not on the canvas.** A recents list is a
 * fact about a hand, not about the work: it should follow you between canvases
 * and it should not appear on anybody else's screen. That makes it the one
 * part of reactions that is deliberately NOT an operation — the marks
 * themselves are canvas state and replicate, this is a convenience that lives
 * where the convenience is used.
 *
 * It also means the CLI does not maintain one, which is correct rather than a
 * gap: `isocan react 🚧 <item>` names the mark outright, so there is nothing
 * for a recents list to save anybody there.
 */
const KEY = "isocan:recent-emoji";
const KEEP = 16;

export function recentEmoji(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed)) return [...QUICK_REACTIONS];
    const clean = parsed.filter((one): one is string => typeof one === "string" && one.length > 0);
    // An empty history shows the starter set rather than an empty shelf: the
    // first thing a picker says should be a suggestion, not a blank.
    return clean.length > 0 ? clean.slice(0, KEEP) : [...QUICK_REACTIONS];
  } catch {
    // A browser with storage denied still gets a working picker.
    return [...QUICK_REACTIONS];
  }
}

/** Remember one, at the front, without duplicating it further down. */
export function rememberEmoji(emoji: string): void {
  try {
    const next = [emoji, ...recentEmoji().filter((one) => one !== emoji)].slice(0, KEEP);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Not being able to remember is not a reason to fail the reaction.
  }
}
