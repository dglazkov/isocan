import { useUiStore } from "../stores/uiStore.ts";

/**
 * **Chrome you can turn off** (`docs/research/2026-09-02-chrome-you-can-turn-off.md`).
 *
 * One list of the controls a person may hide. The rule for what may be in
 * it: a control may be hidden only if the thing it does is reachable another
 * way — `shortcut` names the entry in core's `SHORTCUTS` (its `does` text)
 * or `command` names the ⌘K action's id, and `web/test/hideable.test.ts`
 * refuses an entry with neither. Hiding is per control, not per group: the
 * zoom number is how you know where you are and has no other door, so it is
 * not here.
 *
 * Local, per browser (`uiStore.hiddenChrome`), beside the theme and the text
 * style: the same person may want the rail bare on a laptop and full on a
 * desk, and a canvas is not the place to record anybody's taste. Not a
 * capability — a hidden control changes nothing an op can see.
 *
 * (`chrome.ts` beside this is the item chrome's geometry — a different
 * "chrome"; this file is the controls a person may turn off.)
 */
export interface HideableEntry {
  id: string;
  /** What it is called where a person reads it. */
  name: string;
  /** Where on the screen it lives — the area a right-click would show it from. */
  where: string;
  /** How to do the thing once the control is gone — one of the two. */
  shortcut?: string;
  command?: string;
  /** What the menu says beside "Hide …", so nothing is hidden without being
   *  told where the door is. */
  stillReachable: string;
}

export const HIDEABLE: readonly HideableEntry[] = [
  {
    id: "zoom.undo",
    name: "Undo and redo",
    where: "the zoom cluster",
    shortcut: "Undo and redo",
    stillReachable: "⌘Z still undoes; Settings brings the buttons back",
  },
  {
    id: "rail.history",
    name: "History",
    where: "the rail",
    command: "open-history",
    stillReachable: "⌘K “Open History” still opens it; Settings brings the button back",
  },
  /**
   * **The top fade**: a wash of the page's ground under the top controls, so
   * the title, the faces and Share read over a busy canvas — the effect
   * Stitch has at the top of a scrolled canvas, in this app's own ground
   * colour so it is white on light and near-black on dark. Chrome, not
   * canvas: it is in the registry because a person who wants every pixel of
   * their work should be able to switch it off and get it back.
   */
  {
    id: "canvas.topfade",
    name: "Top fade",
    where: "the top edge",
    command: "top-fade",
    stillReachable: "⌘K “Top fade” brings it back, and so does Settings",
  },
];

export function hideableEntry(id: string): HideableEntry | undefined {
  return HIDEABLE.find((entry) => entry.id === id);
}

/** Read in a component: `const hidden = useChromeHidden("zoom.undo")`. */
export function useChromeHidden(id: string): boolean {
  return useUiStore((s) => s.hiddenChrome.includes(id));
}

export function hideChrome(id: string): void {
  useUiStore.getState().setChromeHidden(id, true);
}

export function showChrome(id: string): void {
  useUiStore.getState().setChromeHidden(id, false);
}

/** The bottom of the Settings list, and a ⌘K command that cannot itself be
 *  hidden: a person who hid everything still has a working app. */
export function showAllChrome(): void {
  for (const entry of HIDEABLE) useUiStore.getState().setChromeHidden(entry.id, false);
}
