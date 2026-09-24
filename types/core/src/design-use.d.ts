import type { CanvasContents, Item } from "./model.js";
import type { Operation } from "./ops.js";
/**
 * **Choosing which DESIGN.md governs, from an item already on the canvas.**
 *
 * `isocan design set <file>` was the only way to say "this is the system",
 * and it takes a FILE: a person looking at a DESIGN.md on the canvas had no
 * way to say it at all. This is that act for an item, shared by the web's
 * item menu and `isocan design use <item>`, so the two cannot send different
 * things. It is a subpath of core rather than a line in its index because
 * only a menu click and one CLI verb ever run it — the entry chunk pays for
 * the label, not for this.
 *
 * It sends what `design set` sends, never a new op. A DESIGN.md governs by
 * where it sits, so the scope is the one the item is already in:
 *
 * - **That scope already has its own system** — the item's words become a
 *   new VERSION of it: `item.addVersion`, byte for byte what `isocan design
 *   set <this file>` (with `--in` for a group) writes. A version, never a
 *   replacement, for design set's reason: the system you are moving away
 *   from is the one you will want to compare against tomorrow.
 * - **It has none** — the item itself takes the property `design set` gives
 *   the item it makes (`designSystemProperties`), as an `item.update`. Making
 *   a second copy of words that are already here would be a duplicate to
 *   tidy up, not a choice.
 *
 * The reverse takes the property off (`designSystemRemoval`): the item stays,
 * its words stay, and what governs that scope is whatever did before.
 * Either way it is one op, so one undo.
 */
export interface DesignUse {
    op: Operation;
    /** The group (or legacy area) it governs; null for the whole canvas. */
    scope: Item | null;
    /** The system that took a new version, when the scope already had one. */
    into: Item | null;
}
/** A markdown item called DESIGN.md — the one the item menu offers to make
 *  the design system, so a canvas of notes is not a canvas of offers. */
export declare function isDesignFile(item: Item): boolean;
/** The design system that belongs to exactly this level — the group's own, or
 *  the canvas's own for null. What `design set` versions; never an ancestor's. */
export declare function ownDesignSystemAt(canvas: CanvasContents, scopeId: string | null): Item | null;
/** Make `item` the design system of the scope it sits in. */
export declare function designUse(canvas: CanvasContents, item: Item, versionId?: string): DesignUse;
/** Stop `item` governing: the property comes off and the item stays. */
export declare function designUnuse(canvas: CanvasContents, item: Item): DesignUse;
