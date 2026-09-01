import type { Canvas } from "./model.js";
/**
 * **How a list of canvases is ordered, at ten and at a hundred.**
 *
 * The list was sorted by `createdAt` ascending — oldest first, forever. At ten
 * canvases that is a quirk; at a hundred it is a wall, and it already caused a
 * bug: a newly made canvas landed at the far end of a list somebody was
 * standing at the top of, so `Create` read as a button that did nothing.
 *
 * **`recent` is the default, and it is a different claim than it used to be.**
 * It sorts by `updatedAt`, which until now moved only when a canvas was
 * RENAMED — so "recent" would have meant "recently retitled" and ordered the
 * list by something nobody was thinking about. The reducer now stamps the
 * canvas on every operation, which is what makes this ordering mean what its
 * name says.
 *
 * The order lives in core because both surfaces show this list, and a home
 * screen and `isocan canvas list` disagreeing about which canvas is most
 * recent is the same class of drift the significance function is kept here to
 * prevent.
 */
export type CanvasSort = "recent" | "name" | "created";
/** Every ordering there is, in the order a chooser should offer them. */
export declare const CANVAS_SORTS: readonly CanvasSort[];
/** What each ordering is called where somebody has to choose one. */
export declare const CANVAS_SORT_LABEL: Record<CanvasSort, string>;
/** Whether a stored preference or a `--sort` argument names a real ordering.
 *  Both surfaces take this from outside themselves, so neither may trust it. */
export declare function isCanvasSort(value: unknown): value is CanvasSort;
/**
 * Sorted, without mutating the input.
 *
 * **Ties break by id**, which is not fussiness: two canvases created in the
 * same millisecond, or never touched since the same import, would otherwise
 * swap places between renders and between surfaces. A list that reorders
 * itself when nothing changed is a list nobody trusts.
 *
 * `name` uses `localeCompare` so that accented and non-Latin titles land where
 * a reader expects rather than where their code points fall, and it is
 * case-insensitive because a person scanning for "Roadmap" does not think
 * about which case they typed.
 */
export declare function sortCanvases(canvases: readonly Canvas[], sort: CanvasSort): Canvas[];
/**
 * **Filtering is what actually saves somebody at a hundred canvases**, and a
 * sort only rearranges the haystack. Title and description, case-insensitive,
 * every term must match — so "lake rules" finds "Rules of the Lake" without
 * anybody guessing the word order somebody else used.
 */
export declare function filterCanvases(canvases: readonly Canvas[], query: string): Canvas[];
