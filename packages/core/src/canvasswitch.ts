import type { Canvas } from "./model.ts";
import { sortCanvases } from "./canvassort.ts";

/**
 * **Jumping to another canvas, from wherever you are.**
 *
 * The home screen is a place you go to choose; the switcher is for when you
 * already know where you are going and the trip through the home screen is
 * the tax. So it opens over the canvas you are on, leads with the canvases
 * you were on most recently — which is nearly always the answer — and takes a
 * few typed letters to find the rest.
 *
 * **This is fuzzy, and the launcher's matcher deliberately is not.** The
 * launcher matches whole terms, because a matcher that scores letters
 * anywhere is how a palette starts offering "Delete everything" for "de".
 * That danger is about what a wrong match DOES. Switching canvases does
 * nothing to any of them, and Back undoes it — so here the trade goes the
 * other way, and "lkh" reaching "Lake House" is worth more than the certainty
 * that every typed letter began a word. The scoring below still prefers the
 * certain reading: a run of letters together, or letters that start words,
 * beats the same letters scattered.
 *
 * In core rather than the web app because the ordering is a fact both
 * surfaces could show — `isocan canvas list --filter` already reads the
 * launcher's term filter from here — and a matcher is exactly the kind of
 * pure logic a test can hold still.
 */

/** One canvas the switcher offers, and why it is where it is. */
export interface SwitchRow {
  canvas: Canvas;
  /** Indices into the title that the query matched, for the highlight.
   *  Empty when there was no query. */
  positions: number[];
  /** Whether it is here because it was visited lately, not only because it
   *  exists. With a query the ranking is by match and this is a hint; without
   *  one it is the group the row sits in. */
  recent: boolean;
}

/**
 * Where a query's letters land in a title, and how well.
 *
 * Every non-space character of the query must appear in the title, in order.
 * The score rewards the two readings a person would call obvious — letters
 * that sit together, and letters that start a word — and is a small penalty
 * per skipped character otherwise, so that among titles that all contain the
 * letters the shortest, tightest one wins. `null` is "does not match", which
 * is a different answer from a low score: a title missing a letter is not
 * offered at all.
 *
 * Greedy left to right, taking the earliest position for each letter but
 * preferring a word start when one is within reach. That is not the best
 * possible alignment in every case; it is the one a person scanning the title
 * would also find, and it is linear.
 */
export function fuzzyMatch(query: string, text: string): { score: number; positions: number[] } | null {
  const needle = query.replace(/\s+/g, "").toLowerCase();
  if (needle.length === 0) return { score: 0, positions: [] };
  const hay = text.toLowerCase();
  const positions: number[] = [];
  let score = 0;
  let from = 0;
  for (const ch of needle) {
    const at = hay.indexOf(ch, from);
    if (at === -1) return null;
    // A word start further along beats a mid-word hit right here: "hs" over
    // "Home screen" should land on the two capitals, not on the "h" and the
    // "s" of "Home". Only within a short reach, so a common letter does not
    // wander to the far end of a long title.
    let pick = at;
    if (!startsWord(hay, at)) {
      for (let i = at + 1; i < Math.min(hay.length, at + 12); i++) {
        if (hay[i] === ch && startsWord(hay, i)) {
          pick = i;
          break;
        }
      }
    }
    const previous = positions[positions.length - 1];
    if (previous !== undefined && pick === previous + 1) score += 4; // together
    else if (startsWord(hay, pick)) score += 3; // starts a word
    else score += 1; // present, at least
    score -= (pick - from) * 0.1; // each letter skipped costs a little
    positions.push(pick);
    from = pick + 1;
  }
  // A prefix match is what most people mean by "starts typing the name".
  if (positions[0] === 0) score += 2;
  // Shorter titles that fit the same letters are the tighter reading.
  score -= hay.length * 0.01;
  return { score, positions };
}

function startsWord(text: string, at: number): boolean {
  if (at === 0) return true;
  const before = text[at - 1]!;
  return !/[\p{L}\p{N}]/u.test(before);
}

/**
 * **The list the switcher shows.**
 *
 * With no query: the canvases in `recentIds`, in that order — most recent
 * first is the caller's job, since only the browser knows when it was where
 * — and then everything else by activity, which is the home screen's default
 * order and therefore the one somebody has already learned. With a query: one
 * ranked list, best match first, and among equal matches the recently visited
 * one, so that "de" on a home with six design canvases lands on the one you
 * were in an hour ago.
 *
 * `except` is the canvas you are on. Offering it is a row that does nothing.
 * An id in `recentIds` that no canvas carries is skipped rather than shown:
 * a canvas deleted, or one whose home is not this origin, is not somewhere
 * this list can take you.
 */
export function rankCanvases(
  canvases: readonly Canvas[],
  query: string,
  recentIds: readonly string[],
  except: string | null = null,
): SwitchRow[] {
  const byId = new Map(canvases.map((canvas) => [canvas.id, canvas]));
  const rank = new Map(recentIds.map((id, i) => [id, i]));
  const candidates = canvases.filter((canvas) => canvas.id !== except);
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    const recent = recentIds
      .map((id) => byId.get(id))
      .filter((canvas): canvas is Canvas => canvas !== undefined && canvas.id !== except);
    const rest = sortCanvases(
      candidates.filter((canvas) => !rank.has(canvas.id)),
      "recent",
    );
    return [
      ...recent.map((canvas) => ({ canvas, positions: [], recent: true })),
      ...rest.map((canvas) => ({ canvas, positions: [], recent: false })),
    ];
  }
  const hits = candidates.flatMap((canvas) => {
    const onTitle = fuzzyMatch(trimmed, canvas.title);
    if (onTitle) return [{ canvas, positions: onTitle.positions, score: onTitle.score }];
    // The description is a second chance, not a first: a match there ranks
    // under any match on a title, and lights nothing up.
    const onDescription = canvas.description ? fuzzyMatch(trimmed, canvas.description) : null;
    if (onDescription) return [{ canvas, positions: [], score: onDescription.score - 100 }];
    return [];
  });
  hits.sort(
    (a, b) =>
      b.score - a.score ||
      (rank.get(a.canvas.id) ?? Infinity) - (rank.get(b.canvas.id) ?? Infinity) ||
      b.canvas.updatedAt.localeCompare(a.canvas.updatedAt) ||
      a.canvas.id.localeCompare(b.canvas.id),
  );
  return hits.map(({ canvas, positions }) => ({
    canvas,
    positions,
    recent: rank.has(canvas.id),
  }));
}

/**
 * A title split into the runs the highlight paints: `[text, lit]` pairs, in
 * order, with adjacent lit letters joined so "Lake" is one mark rather than
 * four. Pure so the web app's row and a test can agree on what lights up.
 */
export function litRuns(text: string, positions: readonly number[]): Array<[string, boolean]> {
  const lit = new Set(positions);
  const runs: Array<[string, boolean]> = [];
  for (let i = 0; i < text.length; i++) {
    const on = lit.has(i);
    const last = runs[runs.length - 1];
    if (last && last[1] === on) last[0] += text[i]!;
    else runs.push([text[i]!, on]);
  }
  return runs;
}
