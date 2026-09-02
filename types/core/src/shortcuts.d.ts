/**
 * Every key the canvas answers to, written down once.
 *
 * The list lives in core rather than in the overlay that shows it, because
 * three things need the same answer and must not drift: the help panel, the
 * `/help` command, and an agent asked "how do I do that without a mouse?".
 * A shortcut that exists in the code and not here is invisible; one that is
 * here and not in the code is a lie, which is worse. Both are cheap to check
 * against this file, and impossible to check against a screenshot.
 */
interface Shortcut {
    /** As a person would say it, e.g. "⌘K" or "Shift-drag". Several when the
     * same act has more than one key. */
    keys: string[];
    /** What it does, in the imperative, from the user's side of the screen. */
    does: string;
    group: ShortcutGroup;
    /** The part that is not obvious from the name — a hold that differs from a
     * tap, a rule about when it applies. */
    note?: string;
}
type ShortcutGroup = "Tools" | "Moving around" | "Items" | "Talking" | "Ink";
export declare const SHORTCUT_GROUPS: ShortcutGroup[];
export declare const SHORTCUTS: Shortcut[];
/** The shortcuts of one group, in the order they were written — which is
 * roughly the order somebody learns them. */
export declare function shortcutsIn(group: ShortcutGroup): Shortcut[];
/**
 * **The key printed beside an act, wherever that act is offered.**
 *
 * A context menu that spells its own accelerators is a menu that goes stale:
 * somebody rebinds a key in one place and the menu keeps promising the old
 * one, which is worse than promising nothing. So a menu asks THIS, by the
 * same `does` text the `?` overlay and `isocan shortcuts` print, and there is
 * one answer for all three.
 *
 * Null when the act has no key. That is a fine and common answer — most of
 * what a menu offers has never had one — and it is the reason this returns
 * rather than throws.
 */
export declare function keyFor(does: string): string | null;
/** The whole list as text, for a terminal or a comment: the same answer the
 * overlay gives, in the medium an agent can pass on. */
export declare function shortcutsAsText(): string;
export {};
