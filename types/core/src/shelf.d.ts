import type { MetaPatch } from "./ops.js";
/**
 * **A canvas you are done with leaves the list without leaving the record**
 * (#194).
 *
 * The canvas list is the front door and it only grows: every scratch canvas,
 * every finished sprint, every demo stays in it forever, until "my canvases"
 * means "every canvas I have ever made". Deleting is the only exit today, and
 * deleting is the wrong verb for something you may want to read again.
 *
 * ## Why the property is `shelved` and the verb is "archive"
 *
 * Because **`archive` is already taken**, and taking it twice is how this
 * project gets bugs. `export.ts`, `recap.ts` and `evals.ts` all say archive to
 * mean the gc'd oplog — "the WHOLE history in seq order, what gc archived" —
 * which is a different thing about a different noun. One word for two
 * meanings in one codebase is exactly how `faceMark`/`initial` and
 * `backingOf`/`writeBound` happened, and both cost a day.
 *
 * So the code says `shelved` and the person says Archive. That is not a fudge:
 * "archive" is the word people reach for and the UI should use it, while the
 * property is read by grep and needs to be unambiguous. The two never meet —
 * nothing in the oplog's archive has a `shelved` property, and nothing here
 * touches the log.
 *
 * ## It is a property, not an op
 *
 * `project.update` already carries a `MetaPatch` with merged `properties` and
 * `removeProperties`, and `sprint.ts` already keeps a canvas-level fact this
 * way. The op vocabulary is a ratcheted bound — `op-types`, `at most: 33` —
 * and a feature that needs no new op costs nothing there.
 *
 * ## An instant, not a flag
 *
 * `"2026-09-06T18:20:00.000Z"` rather than `"true"`, because "when did this
 * leave the list" is the question anybody looking at a shelf actually has,
 * and a boolean cannot answer it. A canvas without the property is in the
 * list, which is what every canvas is today — so there is no migration.
 *
 * **Visibility only.** A shelved canvas still accepts ops, still serves its
 * address, still answers agents parked on it, and a `view` link to it still
 * opens the deck. Anything more would make this a second kind of delete, and
 * a second kind of delete needs a second kind of undo.
 */
export declare const SHELVED_PROP = "shelved";
/** When this canvas was put away, or null if it is in the list. */
export declare function shelvedAt(canvas: {
    properties?: Record<string, string>;
}): string | null;
/** Is it off the list? */
export declare function isShelved(canvas: {
    properties?: Record<string, string>;
}): boolean;
/**
 * The patch that puts a canvas away, stamped with when.
 *
 * The caller passes the instant rather than this reading a clock, for the
 * reason every other op in this codebase does: a time the client chose is a
 * time a test can choose too, and one both surfaces can agree on.
 */
export declare function shelvePatch(when: string): MetaPatch;
/** And the patch that brings it back — a removal, so nothing is left behind
 *  to mean "was shelved once", which is a fact nobody asked to keep. */
export declare function unshelvePatch(): MetaPatch;
/** What a list should show, given what was asked for. `"live"` is the
 *  default everywhere: the whole point is that the shelf is not in the way. */
export type ShelfScope = "live" | "shelved" | "all";
/** Does this canvas belong in a list asking for that scope — the one
 *  comparison every surface makes, so "archived" means the same thing in the
 *  app's list, `canvas list --archived`, and anything asked later. */
export declare function inScope(canvas: {
    properties?: Record<string, string>;
}, scope: ShelfScope): boolean;
