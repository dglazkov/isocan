/**
 * Which items an operation touches, and whether an op type matches a filter.
 *
 * An agent parked on a canvas should be able to say what it cares about —
 * "this item", "new versions" — instead of waking on every drag anyone makes
 * and spending a turn deciding it does not care. A turn is the scarce thing.
 *
 * It lives in core because both clients ask the same question: the CLI's
 * `wait --item/--op` filters here, and the web app has the same question to
 * answer whenever it highlights what just changed.
 */
import type { CanvasContents } from "./model.js";
import type { Operation, OperationType } from "./ops.js";
/**
 * Every item id this op is about. Comment ops count: a comment ON an item is
 * something happening to that item, which is exactly what a watcher means.
 * Thread ops need the canvas to resolve a thread back to what it is pinned to;
 * without one they contribute nothing rather than guessing.
 */
export declare function itemsTouchedBy(op: Operation, canvas?: CanvasContents | null): string[];
/**
 * Does this op type match one of the wanted patterns? A pattern is a type
 * (`item.addVersion`) or a family (`item.*`) — the two ways a person actually
 * thinks about it. An empty list means "no filter", not "nothing".
 */
export declare function opTypeMatches(type: OperationType, wanted: readonly string[]): boolean;
/** Does this op pass both filters? Items and types narrow independently: an op
 * has to touch one of the items AND be one of the types, when each is given. */
export declare function opMatchesFilters(op: Operation, filters: {
    items?: readonly string[];
    types?: readonly string[];
}, canvas?: CanvasContents | null): boolean;
