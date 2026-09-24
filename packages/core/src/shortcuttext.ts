import { renderKeys } from "./shortcut.ts";
import { moduleMarks } from "./modules.ts";
import { SHORTCUTS, SHORTCUT_GROUPS, shortcutsIn, type Shortcut } from "./shortcuts.ts";

/*
 * Apart from `shortcuts.ts` on purpose (24 Sep 2026): the table is first
 * paint's (menus look their accelerators up in it), and anything beside it
 * that a lazy chunk imports rides the entry chunk as a shared export. The
 * lazy help panel and the CLI are the only readers of what is here, so it
 * costs first paint nothing.
 */

/**
 * **The keys loaded modules add** — each `ModuleMark` with a `key` answers
 * ⇧ and that letter (the wireframes' ⇧K keeps a screen). They are not in
 * `SHORTCUTS` because they exist only while their module is loaded; this
 * turns the loaded ones into rows in the same shape, so the help panel and
 * `isocan shortcuts` say them in the same words (24 Sep 2026: ⇧K was in the
 * panel and not in the CLI's list).
 */
export function markShortcuts(): Shortcut[] {
  return moduleMarks().filter((mark) => mark.key).map((mark) => ({
    keys: [`⇧${mark.key}`],
    // The menu's two phrases as they are — "Use in prototype" / "Remove from prototype" — rather than spliced into a sentence.
    does: `${mark.emoji} ${mark.on}, or ${mark.off.toLowerCase()} — on the selection`,
    group: "Items" as const,
    note: "A property on the item, so anybody can take it off",
  }));
}

/** The whole list as text, for a terminal or a comment: the same answer the
 * overlay gives, in the medium an agent can pass on — the loaded modules'
 * keys included (`markShortcuts`). */
export function shortcutsAsText(): string {
  // The column is measured, not guessed: a fixed 24 ran "Double-click the
  // name" straight into its description, and the next long key would have done
  // it again. One width for the whole list so the descriptions line up.
  /* Rendered here because this IS the display: it is what `isocan shortcuts`
     prints and what an agent is handed. The table stays canonical. */
  const keysOf = (s: Shortcut) => s.keys.map((key) => renderKeys(key)).join(" / ");
  const column = Math.max(...SHORTCUTS.map((s) => keysOf(s).length)) + 2;
  return SHORTCUT_GROUPS.map((group) => {
    const rows = [...shortcutsIn(group), ...markShortcuts().filter((s) => s.group === group)].map((s) => {
      const head = `  ${keysOf(s).padEnd(column)}${s.does}`;
      return s.note ? `${head}\n  ${"".padEnd(column)}${s.note}` : head;
    });
    return `${group}\n${rows.join("\n")}`;
  }).join("\n\n");
}
