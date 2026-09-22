/**
 * **What the modifier key is CALLED, where this person is reading.**
 *
 * The app spelled `⌘` into seventy-odd labels — "Send (⌘⏎)", "Undo (⌘Z)",
 * "ctrl-click to configure" — and every one of them is wrong on the other
 * platform. The behaviour was never wrong: the handlers check `metaKey ||
 * ctrlKey` and always did. Only the words were, which is the kind of bug that
 * survives because the people who write the labels are all on one machine.
 *
 * It lives in core rather than in the web app because a MODULE needs it too,
 * and a module may import nothing but core.
 *
 * **Nothing here reads a keyboard event.** This names a key for a human; the
 * decision about which modifier was actually held belongs at the event, where
 * both are accepted.
 */
/**
 * Is this an Apple keyboard, where the modifier is ⌘ and shortcuts are
 * written without a separator?
 *
 * The platform is passed in wherever a caller has one, so this is testable
 * without a browser; unset, it asks the navigator. `userAgentData.platform` is
 * the modern spelling and `platform` the deprecated one that still answers
 * everywhere, and the user agent is the last resort.
 *
 * **With no navigator at all it answers false**, so a label rendered on a
 * server or in a test says "Ctrl" rather than claiming a Mac it cannot see.
 */
export declare function applePlatform(hint?: string): boolean;
/** The modifier's name on its own: `⌘` or `Ctrl`. */
export declare function cmdKey(hint?: string): string;
/** The shift key's name: `⇧` or `Shift`. */
export declare function shiftKey(hint?: string): string;
/**
 * One shortcut, written the way this platform writes it.
 *
 * ```
 * shortcut("Z")              // ⌘Z        · Ctrl+Z
 * shortcut("⏎")              // ⌘⏎        · Ctrl+Enter
 * shortcut("Z", { shift: true })  // ⇧⌘Z  · Ctrl+Shift+Z
 * ```
 *
 * The two conventions differ in more than the name: a Mac runs the glyphs
 * together and puts shift FIRST, while Windows and Linux join with `+` and put
 * the modifiers in the order they are pressed. Spelling one and translating
 * only the word would produce `Ctrl+⇧Z`, which is neither.
 */
export declare function shortcut(key: string, options?: {
    shift?: boolean;
    hint?: string;
}): string;
/** A click with the modifier held, for a tooltip: `⌘-click` / `Ctrl-click`. */
export declare function modifierClick(hint?: string): string;
/**
 * **A shortcut from the table, written for this platform.**
 *
 * `SHORTCUTS` is authored in the Mac glyphs — that is the canonical spelling
 * and the one the table has always held — so this translates on the way OUT
 * rather than forking the data. One place to change, and the help panel, the
 * palette and `isocan shortcuts` cannot come to disagree, which is what
 * `switcher.test.ts` is watching for.
 *
 * Modifiers come out in the order Windows and Linux write them (Ctrl first),
 * not in the order the glyphs happened to be typed — `⇧⌘Z` is `Ctrl+Shift+Z`,
 * never `Shift+Ctrl+Z`.
 */
export declare function renderKeys(keys: string, hint?: string): string;
