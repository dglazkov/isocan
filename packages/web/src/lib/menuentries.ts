import type { Actor, Item } from "@isocan/core";
import { itemKind, itemPath, workbenchItemPath } from "@isocan/core";
import type { MenuEntry } from "../components/ContextMenu.tsx";
import { blobUrl } from "./api.ts";
import { cutItems, deleteItems, downloadItem, itemAddress, pasteInto } from "./itemactions.ts";
import { browserClipboard, copyToClipboard, type CopyState } from "./copy.ts";
import { useCanvasStore, flashNotice, setNotice } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { openPanel } from "./panels.ts";
import { glideToBox } from "./zoomactions.ts";

/**
 * **What the right-click menu offers, and why each thing is on it.**
 *
 * The rule: a menu entry is a door to something the canvas can already do.
 * Almost every line here has a key, a double-click or a CLI verb behind it,
 * and the menu exists so nobody has to have read the shortcut list to find
 * them. Two entries are genuinely new — **Download** and **Copy link** —
 * because they are what a person reaches for on a menu and has never had
 * here: bytes have only ever come out through `isocan get`.
 *
 * Kept out of a component so the list can be read, reasoned about and tested
 * as data. Nothing here draws anything.
 */

export interface MenuContext {
  canvasId: string;
  actor: Actor;
  /** Where the right-click landed, in world coordinates — where a paste goes. */
  world: { x: number; y: number };
  navigate: (to: string) => void;
}

/** The menu for one or more selected items. */
export function itemMenu(items: Item[], ctx: MenuContext): MenuEntry[] {
  const one = items.length === 1 ? items[0]! : null;
  const ids = items.map((i) => i.id);
  const many = items.length > 1;
  const version = one?.versions.find((v) => v.id === one.currentVersionId) ?? null;

  return [
    {
      label: many ? `Copy ${items.length} items` : "Copy",
      shortcutFor: "Copy the selection",
      run: () => {
        useUiStore.getState().setClipboard({ canvasId: ctx.canvasId, items });
        flashNotice(`Copied ${items.length} item${items.length === 1 ? "" : "s"}`);
      },
    },
    {
      label: "Cut",
      run: () => void cutItems(ctx.canvasId, ctx.actor, ids),
    },
    {
      label: "Duplicate",
      run: () => {
        // The clipboard is not disturbed: duplicating something should not
        // cost you what you had copied a minute ago.
        void pasteInto({ canvasId: ctx.canvasId, items }, ctx.canvasId, ctx.actor);
      },
    },
    { separator: "" },
    {
      label: "Open full screen",
      shortcutFor: "Open the selection full screen",
      disabled: !one,
      run: () => one && ctx.navigate(itemPath(ctx.canvasId, one.id)),
    },
    {
      label: "Open in the workbench",
      disabled: !one,
      run: () => one && ctx.navigate(workbenchItemPath(ctx.canvasId, one.id)),
    },
    {
      label: "Zoom to it",
      run: () =>
        glideToBox({
          minX: Math.min(...items.map((i) => i.x)),
          minY: Math.min(...items.map((i) => i.y)),
          maxX: Math.max(...items.map((i) => i.x + i.width)),
          maxY: Math.max(...items.map((i) => i.y + i.height)),
        }),
    },
    { separator: "" },
    {
      label: "Rename",
      shortcutFor: "Rename",
      disabled: !one,
      run: () => one && useUiStore.getState().setRenaming(one.id),
    },
    {
      label: "Version history",
      shortcutFor: "Show the version stack",
      // The stack is only a thing when there is more than one wording of it.
      disabled: !one || one.versions.length < 2,
      run: () => one && useUiStore.getState().setFanned(one.id),
    },
    { separator: "" },
    {
      label: "Copy link",
      disabled: !one,
      run: () => {
        if (!one) return;
        // `browserClipboard()` rather than `navigator.clipboard`: the module
        // exists because a refusal and an absent clipboard look identical at
        // the call site, and both end in "take it by hand".
        void copyToClipboard(itemAddress(ctx.canvasId, one.id), browserClipboard()).then(
          (state: CopyState) =>
            state === "copied"
              ? flashNotice("Link copied")
              : setNotice("The clipboard refused — the address is the item's full-screen URL."),
        );
      },
    },
    {
      label: "Download",
      disabled: !one || !version,
      run: () => {
        if (!one || !version) return;
        void downloadItem(blobUrl(ctx.canvasId, version.blobHash), version.filename).catch(
          (err: Error) => setNotice(err.message),
        );
      },
    },
    { separator: "" },
    {
      label: many ? `Delete ${items.length} items` : "Delete",
      shortcutFor: "Move the selection to the trash",
      danger: true,
      run: () => void deleteItems(ctx.canvasId, ctx.actor, ids),
    },
  ];
}

/** The menu for the canvas itself — a right-click on open ground. */
export function canvasMenu(ctx: MenuContext): MenuEntry[] {
  const held = useUiStore.getState().clipboard;
  return [
    {
      label: held ? `Paste ${held.items.length} item${held.items.length === 1 ? "" : "s"}` : "Paste",
      shortcutFor: "Paste",
      disabled: !held,
      run: () => {
        if (!held) return;
        void pasteInto(held, ctx.canvasId, ctx.actor, ctx.world).then((made) => {
          if (made.length > 0) useUiStore.getState().setSelection(made);
        });
      },
    },
    { separator: "" },
    {
      label: "Write text here",
      run: () => {
        const ui = useUiStore.getState();
        ui.setPendingText({
          x: Math.round(ctx.world.x),
          y: Math.round(ctx.world.y),
          itemId: null,
          body: "",
          style: ui.lastTextStyle,
          face: ui.lastTextFace,
        });
      },
    },
    { separator: "" },
    {
      label: "Fit everything on screen",
      shortcutFor: "Fit everything",
      run: () => {
        const canvas = useCanvasStore.getState().canvas;
        const all = Object.values(canvas?.items ?? {});
        if (all.length === 0) return;
        glideToBox({
          minX: Math.min(...all.map((i) => i.x)),
          minY: Math.min(...all.map((i) => i.y)),
          maxX: Math.max(...all.map((i) => i.x + i.width)),
          maxY: Math.max(...all.map((i) => i.y + i.height)),
        });
      },
    },
  ];
}

/** Only used to keep the import honest when a kind-specific entry is added. */
export const _itemKind = itemKind;

/**
 * **The `···` drawer: one handle instead of a row of buttons.**
 *
 * The bar had grown to eight always-present controls, each of which was right
 * on its own and none of which was worth the canvas it cost. The ones that
 * remain in the bar are the ones you look AT — where you are, who is here —
 * and the ones in here are the ones you occasionally reach FOR.
 *
 * **Nothing is lost, and that is a test rather than a promise.**
 * `chrome.test.ts` asserts every control this drawer swallowed is in here,
 * because "we moved it into a menu" is the sentence that precedes a feature
 * nobody can find again.
 *
 * Chat is deliberately NOT here. It has the strip when shut — a permanent
 * surface with its unread count on it — and ⌘J; putting it behind a handle as
 * well would give one thing three doors and make the strip look decorative.
 *
 * The counts travel with the labels. "Trash" alone is a question; "Trash (16)"
 * is the answer somebody opened the menu for, and it is the one thing the old
 * bar said that a bare handle cannot.
 */
export function chromeMenu(ctx: {
  canvasId: string;
  filesOpen: boolean;
  trashOpen: boolean;
  trashCount: number;
  minimapOpen: boolean;
}): MenuEntry[] {
  const ui = () => useUiStore.getState();
  return [
    {
      label: ctx.filesOpen ? "Hide files" : "Files",
      run: () => openPanel(ctx.canvasId, ctx.filesOpen ? null : "files"),
    },
    {
      label: `${ctx.trashOpen ? "Hide trash" : "Trash"}${ctx.trashCount > 0 ? ` (${ctx.trashCount})` : ""}`,
      run: () => ui().setTrashOpen(!ctx.trashOpen),
    },
    {
      label: ctx.minimapOpen ? "Hide the map" : "Show the map",
      run: () => ui().setMinimapOpen(!ctx.minimapOpen),
    },
    { separator: "" },
    {
      label: "Keyboard shortcuts",
      shortcutFor: "This list",
      run: () => ui().setHelpOpen(!ui().helpOpen),
    },
  ];
}
