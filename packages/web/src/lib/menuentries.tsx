import type { Actor, Item } from "@isocan/core";
import { contextMark, itemKind, itemPath, markPatch, workbenchItemPath, keyFor} from "@isocan/core";
import type { ReactNode } from "react";
import type { MenuEntry } from "../components/ContextMenu.tsx";
import {
  AgentsGlyph,
  ChatGlyph,
  ContextGlyph,
  PersonaGlyph,
  FilesGlyph,
  MinimapGlyph,
  TrashGlyph,
  WorkbenchGlyph,
} from "../components/Glyphs.tsx";
import { blobUrl } from "./api.ts";
import { cutItems, deleteItems, downloadItem, itemAddress, pasteInto } from "./itemactions.ts";
import { browserClipboard, copyToClipboard, type CopyState } from "./copy.ts";
import { flashNotice, sendEchoed, setNotice, useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { type Panel, openPanel } from "./panels.ts";
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
      /* The accelerator is looked up from `SHORTCUTS`, never spelled here —
         a rebound key cannot leave the menu telling somebody the old one. */
      shortcutFor: "Download",
      disabled: !one || !version,
      run: () => {
        if (!one || !version) return;
        void downloadItem(blobUrl(ctx.canvasId, version.blobHash), version.filename).catch(
          (err: Error) => setNotice(err.message),
        );
      },
    },
    { separator: "" },
    /**
     * **Stage 2 of the context view, on the surface that is not a terminal.**
     *
     * `isocan context pin` and `exclude` act on an item, so the app's home for
     * them is the item's own menu rather than the Context panel — that panel
     * lists PIECES, and pinning a piece is not a thing. Without this the CLI
     * would hold a verb the app does not, which is the gap the whole project
     * exists to close.
     *
     * One entry that toggles, not two that contradict: an item is pinned or it
     * is not, and a menu offering "Pin" beside "Unpin" makes the reader work
     * out which one is true.
     */
    {
      label: contextMark(items[0]!) === "pinned" ? "Unpin from context" : "Pin into context",
      disabled: many,
      run: () => {
        const item = items[0];
        if (!item) return;
        const next = contextMark(item) === "pinned" ? null : "pinned";
        void sendEchoed(ctx.canvasId, ctx.actor, {
          type: "item.update",
          itemId: item.id,
          patch: markPatch(next),
        });
        flashNotice(next ? `"${item.title}" is pinned into context` : `"${item.title}" is no longer pinned`);
      },
    },
    {
      // Excluded is not deleted: the item stays, its versions stay, its
      // comments stay. Only what a reader assembling context is told changes.
      label: contextMark(items[0]!) === "excluded" ? "Put back in context" : "Keep out of context",
      disabled: many,
      run: () => {
        const item = items[0];
        if (!item) return;
        const next = contextMark(item) === "excluded" ? null : "excluded";
        void sendEchoed(ctx.canvasId, ctx.actor, {
          type: "item.update",
          itemId: item.id,
          patch: markPatch(next),
        });
        flashNotice(
          next ? `"${item.title}" is kept out of context — it is still on the canvas` : `"${item.title}" is back in context`,
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
 * `drawer.test.ts` asserts every control this drawer swallowed is in here,
 * because "we moved it into a menu" is the sentence that precedes a feature
 * nobody can find again.
 *
 * **The rail's three panels are offered as the two you are NOT looking at.**
 *
 * They were toggles — "Hide files" while Files was open — which named what
 * you already had and said nothing about where else you could go. The dock
 * holds ONE of three, so the useful question is never "hide this", it is
 * "which of the other two". Always the same order, Chat then Files then
 * Agents, minus whichever is showing: a menu whose items move about is a menu
 * you have to read every time.
 *
 * Chat is in here now, and the argument for leaving it out was wrong. It said
 * Chat already had two doors — the strip and ⌘J — and missed that THE STRIP
 * IS THE SHUT RAIL. With Files open there is no strip, so Chat had no visible
 * door at all from the one place you would most want it. Found by somebody
 * looking at the menu and asking why the thing that was missing was not in
 * the list of things you could have.
 *
 * Closing the rail is the panel's own ✕ and ⌘J, which is where a close
 * belongs: on the thing being closed.
 */
export function chromeMenu(ctx: {
  canvasId: string;
  filesOpen: boolean;
  agentsOpen: boolean;
  contextOpen: boolean;
  personasOpen: boolean;
  mainOpen: boolean;
  trashOpen: boolean;
  trashCount: number;
  minimapOpen: boolean;
  /** Navigation belongs to the caller: this module builds entries and has no
   *  business holding a router. */
  toWorkbench: () => void;
}): MenuEntry[] {
  const ui = () => useUiStore.getState();
  /* The same mark the surface itself wears, so the row and the thing it opens
     are recognisably one item. Only these three carry icons: a menu where
     every row has one is a menu where none of them means anything. */
  const rail: { label: string; open: boolean; panel: Panel; icon: ReactNode }[] = [
    { label: "Chat", open: ctx.mainOpen, panel: "main", icon: <ChatGlyph size={14} /> },
    { label: "Files", open: ctx.filesOpen, panel: "files", icon: <FilesGlyph size={14} /> },
    { label: "Agents", open: ctx.agentsOpen, panel: "agents", icon: <AgentsGlyph size={14} /> },
    { label: "Context", open: ctx.contextOpen, panel: "context", icon: <ContextGlyph size={14} /> },
    {
      label: "Personas",
      open: ctx.personasOpen,
      panel: "personas",
      icon: <PersonaGlyph size={14} />,
    },
  ];
  return [
    ...rail
      .filter((one) => !one.open)
      .map((one) => ({
        label: one.label,
        icon: one.icon,
        run: () => openPanel(ctx.canvasId, one.panel),
      })),
    { separator: "" },
    {
      /* The way into the other room. It was a button in the bar, said out
         loud because `W` alone was a door only people who had read the
         shortcut list could find — and saying it out loud is what the menu
         does for everything else in here. Above the trash because it is a
         place you GO, and the two below are things you look at. */
      label: "Workbench",
      icon: <WorkbenchGlyph size={14} />,
      shortcutFor: "Workbench — the agent room",
      run: () => ctx.toWorkbench(),
    },
    { separator: "" },
    {
      label: `${ctx.trashOpen ? "Hide trash" : "Trash"}${ctx.trashCount > 0 ? ` (${ctx.trashCount})` : ""}`,
      icon: <TrashGlyph size={14} />,
      run: () => ui().setTrashOpen(!ctx.trashOpen),
    },
    {
      label: ctx.minimapOpen ? "Hide minimap" : "Show minimap",
      icon: <MinimapGlyph size={14} />,
      run: () => ui().setMinimapOpen(!ctx.minimapOpen),
    },
    { separator: "" },
    {
      label: "Keyboard shortcuts",
      /* The key IS this row's mark, so it goes in the icon column with the
         others rather than alone at the far right. Every other row now has
         something in that column; a lone accelerator across the gap was the
         last thing pulling the eye sideways. */
      icon: <span className="menu-key">{keyFor("This list") ?? "?"}</span>,
      run: () => ui().setHelpOpen(!ui().helpOpen),
    },
  ];
}
