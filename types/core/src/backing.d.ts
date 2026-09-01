import type { Item } from "./model.js";
/**
 * **Items backed by files** (`docs/projects/workbench/files-on-disk.md`).
 *
 * `＋` carries a file from the disk onto the canvas; this is the other
 * direction, and the choice of whether to take it. A screen an agent runs up
 * to answer "let me see a view" wants to stay on the canvas; a screen that is
 * a new part of the system wants to be a file. Both a person and an agent
 * decide that per item.
 *
 * **Two facts, and keeping them apart is the whole design.** Where a file
 * belongs is a CANVAS fact — it replicates, it reaches a teammate who clones
 * the repo, and it lives here as an item property. Whether it is written is a
 * fact about ONE MACHINE — bindings are per-machine by construction, so the
 * same canvas on a laptop with no checkout has no disk to be written to. The
 * first is stored; the second is derived, every time, and never stored.
 */
/** The path this item is the file at, relative to the bound root. */
export declare const FILE_PROP = "file";
/**
 * Where this item belongs on disk, or null when it belongs nowhere — which
 * is the default and stays perfectly useful.
 *
 * Relative to the root, never absolute: an absolute path is one machine's
 * answer to a question the canvas is asking, and it would be wrong the
 * moment a teammate cloned the repo somewhere else.
 */
export declare function fileOf(item: Item): string | null;
/**
 * What one machine's disk says about a tracked item.
 *
 * - `written` — the file is there and matches the item's current version.
 * - `behind` — it is there and holds ANOTHER version of this same item. The
 *   canvas moved and the disk did not: `version promote` does exactly this,
 *   every time, because nothing writes a file on its own. An ordinary write
 *   catches it up and eats nobody's work.
 * - `drifted` — it is there and matches NO version this item has ever had:
 *   somebody edited it outside the canvas, so a write would eat their work
 *   and must say so first.
 * - `absent` — tracked, and never written on this machine.
 * - `unbound` — no directory here at all, which is every hosted canvas and
 *   every machine without the checkout. Not an error; a different question.
 *
 * **`behind` exists because the daemon already believed in it.** `writeBound`
 * refuses on "what is there is not anything this canvas EVER wrote" — it is
 * handed every version's hash — while this function compared against the
 * current one alone. So the two halves of one rule disagreed, and the client
 * called a promoted item's file drifted when the daemon would have written it
 * without complaint. The web read that and offered "Overwrite file", which
 * passes `force` — and `force` is what switches the real drift check OFF. The
 * one state that never needed the escape hatch was the one being handed it.
 */
export type BackingState = "written" | "behind" | "drifted" | "absent" | "unbound";
export interface Backing {
    path: string;
    state: BackingState;
}
/**
 * Combine the canvas's intent with a machine's answer.
 *
 * `onDisk` is what that machine found at the path — the content hash of the
 * file, or `null` when it is not there — and `bound` says whether the machine
 * has a directory for this canvas at all. Splitting those two is what keeps
 * "no checkout here" from reading as "somebody deleted your file".
 */
export declare function backingOf(item: Item, bound: boolean, onDisk: (path: string) => string | null): Backing | null;
/**
 * A path a canvas may name, or null.
 *
 * The canvas half of the jail — the daemon enforces the real one against a
 * real filesystem (`server/tree.ts`), and this refuses the shapes that are
 * wrong on their face so neither surface offers them. Absolute paths and
 * `..` are refused for the same reason: they are answers about a machine,
 * asked of a canvas. Dot segments are refused because `listable` will refuse
 * them at the far end and an affordance that leads to a refusal is worse
 * than one that never offered.
 */
export declare function cleanFilePath(raw: string): string | null;
