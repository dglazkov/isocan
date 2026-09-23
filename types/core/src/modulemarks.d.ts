import type { Item } from "./model.js";
import type { ModuleMark } from "./modules.js";
/** Whether a mark is offered on this item — its `offeredOn` properties all match. A mark already on is always offered, so it can come off. */
export declare function markOffered(mark: ModuleMark, item: Item): boolean;
/**
 * **What a mark gesture on a selection does** — `slideIntent`'s rule for any
 * mark: a mixed selection turns them all ON, and only one that is already all
 * marked turns off, so a gesture never throws away marks somebody meant.
 * `changing` is only the items that move.
 */
export declare function moduleMarkIntent(items: readonly Item[], property: string): {
    on: boolean;
    changing: Item[];
};
/** The patch that puts a mark on or takes it off — `removeProperties`, because `properties` merges. */
export declare function moduleMarkPatch(property: string, on: boolean): {
    properties: Record<string, string>;
} | {
    removeProperties: string[];
};
