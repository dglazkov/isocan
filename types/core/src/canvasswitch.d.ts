import type { Canvas } from "./model.js";
import { type ShelfScope } from "./shelf.js";
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
    /** Whether this one is archived (#194). Only ever true when the scope
     *  reached in, and the row that carries it says so on screen: a canvas
     *  somebody put away arriving unmarked among the live ones is the shelf
     *  failing quietly. */
    shelved: boolean;
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
export declare function fuzzyMatch(query: string, text: string): {
    score: number;
    positions: number[];
} | null;
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
 *
 * ## Archived canvases: a scope, and the default is not everything (#194)
 *
 * `scope` is the same `ShelfScope` the home screen's `Archived` toggle and
 * `isocan canvas list --archived / --with-archived` pass to `inScope`, so
 * "archived" cannot come to mean one set in the switcher and another in the
 * terminal. The switcher offers two of the three: `"live"`, the default, and
 * `"all"` — its **Include archived** toggle, which is `--with-archived` in the
 * app's words.
 *
 * **`"live"` means live whether or not anything is typed.** The shelf is a
 * fix for a list that only grows, and a search that quietly reached in would
 * make Archive a change to the list and not to the search — the issue asked
 * for a search whose default scope is not everything, and for a control that
 * widens it.
 *
 * **Under `"all"` an archived canvas is ranked like any other, and marked.**
 * The person asked for the shelf, so it is not a second chance any more: the
 * one they are most likely looking for is an archived one, and ordering every
 * weaker live match above it would make the thing they widened the search to
 * find its last row. One order, a mark on the rows that are away — which is
 * exactly what `--with-archived` prints, a column in one table rather than a
 * second table under the first.
 *
 * What makes mixing them safe is the marking: `shelved` rides on the row, and
 * a surface that draws these must say so, or a canvas somebody put away comes
 * back indistinguishable from one they did not. `"shelved"` works too, and
 * the switcher uses it only to count what the live scope is hiding.
 */
export declare function rankCanvases(canvases: readonly Canvas[], query: string, recentIds: readonly string[], except?: string | null, scope?: ShelfScope): SwitchRow[];
/**
 * A title split into the runs the highlight paints: `[text, lit]` pairs, in
 * order, with adjacent lit letters joined so "Lake" is one mark rather than
 * four. Pure so the web app's row and a test can agree on what lights up.
 */
export declare function litRuns(text: string, positions: readonly number[]): Array<[string, boolean]>;
