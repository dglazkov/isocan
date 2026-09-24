import { type Shortcut } from "./shortcuts.js";
/**
 * **The keys loaded modules add** — each `ModuleMark` with a `key` answers
 * ⇧ and that letter (the wireframes' ⇧K keeps a screen). They are not in
 * `SHORTCUTS` because they exist only while their module is loaded; this
 * turns the loaded ones into rows in the same shape, so the help panel and
 * `isocan shortcuts` say them in the same words (24 Sep 2026: ⇧K was in the
 * panel and not in the CLI's list).
 */
export declare function markShortcuts(): Shortcut[];
/** The whole list as text, for a terminal or a comment: the same answer the
 * overlay gives, in the medium an agent can pass on — the loaded modules'
 * keys included (`markShortcuts`). */
export declare function shortcutsAsText(): string;
