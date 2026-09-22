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
export function applePlatform(hint?: string): boolean {
  const raw =
    hint ??
    (typeof navigator !== "undefined"
      ? (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform ||
        navigator.platform ||
        navigator.userAgent
      : /* A terminal has no navigator, and `isocan shortcuts` prints this
           list into one. Answering "Ctrl" on a Mac's own terminal would be
           exactly the bug this file exists to remove, in the other
           direction.

           Read off `globalThis` rather than the `process` global: core is
           browser-safe and carries no node types, and a bare `process` here
           would make every surface that bundles core depend on them. */
        (globalThis as { process?: { platform?: string } }).process?.platform ?? "");
  return /mac|darwin|iphone|ipad|ipod/i.test(raw);
}

/** The modifier's name on its own: `⌘` or `Ctrl`. */
export function cmdKey(hint?: string): string {
  return applePlatform(hint) ? "⌘" : "Ctrl";
}

/** The shift key's name: `⇧` or `Shift`. */
export function shiftKey(hint?: string): string {
  return applePlatform(hint) ? "⇧" : "Shift";
}

/**
 * The keys a Mac writes as a glyph and everywhere else writes as a word.
 * Anything not here is passed through, so `shortcut("K")` is `⌘K` / `Ctrl+K`.
 */
const SPELLED: Record<string, string> = { "⏎": "Enter", "⌫": "Backspace", "⎋": "Esc" };

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
export function shortcut(
  key: string,
  options: { shift?: boolean; hint?: string } = {},
): string {
  const apple = applePlatform(options.hint);
  const named = apple ? key : (SPELLED[key] ?? key);
  if (apple) return `${options.shift ? "⇧" : ""}⌘${named}`;
  return `Ctrl+${options.shift ? "Shift+" : ""}${named}`;
}

/** A click with the modifier held, for a tooltip: `⌘-click` / `Ctrl-click`. */
export function modifierClick(hint?: string): string {
  return `${cmdKey(hint)}-click`;
}

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
export function renderKeys(keys: string, hint?: string): string {
  if (applePlatform(hint)) return keys;
  const mods: string[] = [];
  let rest = keys;
  for (const [glyph, word] of [["⌘", "Ctrl"], ["⌃", "Ctrl"], ["⇧", "Shift"], ["⌥", "Alt"]] as const) {
    if (rest.includes(glyph)) {
      if (!mods.includes(word)) mods.push(word);
      rest = rest.split(glyph).join("");
    }
  }
  const key = SPELLED[rest] ?? rest;
  const parts = [...mods, key].filter((part) => part !== "");
  /* `⌘+` joined with a plus is `Ctrl++`, which reads as a typo and is
     ambiguous about which plus is the key. A space is how the convention
     writes a shortcut whose key IS a separator. */
  const separator = /^[+\-−=]$/.test(key) ? " " : "+";
  return parts.join(separator);
}
