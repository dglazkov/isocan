import type { Actor, Item } from "@isocan/core";
import { contextMark, isNote, isSlide, itemKind, itemPath, markPatch, newGroupId, noteFor, slideIntent, slidePatch, workbenchItemPath, keyFor, SLIDE_EMOJI, sprintState } from "@isocan/core";
import type { ReactNode } from "react";
import type { MenuEntry } from "../components/ContextMenu.tsx";
import {
  AgentsGlyph,
  ChatGlyph,
  ContextGlyph,
  PersonaGlyph,
  FilesGlyph,
  HistoryGlyph,
  NewsGlyph,
  MinimapGlyph,
  TrashGlyph,
  WorkbenchGlyph,
} from "../components/Glyphs.tsx";
import { cutItems, deleteItems, downloadItem, itemAddress, pasteInto } from "./itemactions.ts";
import { browserClipboard, copyToClipboard, type CopyState } from "./copy.ts";
import { flashNotice, sendEchoed, setNotice, useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { type Panel, openPanel } from "./panels.ts";
import { glideToBox, revealItem } from "./zoomactions.ts";
import { addSpeakerNote, noteStarter } from "./notes.ts";
import { handIn, handable } from "./sprint.ts";
import { canEditNow } from "./capability.ts";

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

interface MenuContext {
  canvasId: string;
  actor: Actor;
  /** Where the right-click landed, in world coordinates — where a paste goes. */
  world: { x: number; y: number };
  navigate: (to: string) => void;
}

/**
 * **The read-only canvas's menu** (roles phase 1): the entries marked
 * `writes` are dropped for a reader, and a separator left with nothing on
 * either side goes with them. Dropped rather than dimmed, because dimmed
 * says "not right now" and a reader's answer is "not at this rung" — and
 * because a menu of eleven grey rows and three live ones is a menu that
 * teaches people to stop reading it.
 */
function offered(entries: MenuEntry[]): MenuEntry[] {
  if (canEditNow()) return entries;
  const kept = entries.filter((entry) => "separator" in entry || !entry.writes);
  return kept.filter(
    (entry, i) =>
      !("separator" in entry) ||
      (i > 0 && i < kept.length - 1 && !("separator" in kept[i - 1]!)),
  );
}

/** The menu for one or more selected items. */
export function itemMenu(items: Item[], ctx: MenuContext): MenuEntry[] {
  const one = items.length === 1 ? items[0]! : null;
  const ids = items.map((i) => i.id);
  const many = items.length > 1;
  const version = one?.versions.find((v) => v.id === one.currentVersionId) ?? null;

  return offered([
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
      writes: true,
      run: () => void cutItems(ctx.canvasId, ctx.actor, ids),
    },
    {
      label: "Duplicate",
      writes: true,
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
      writes: true,
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
        void downloadItem(ctx.canvasId, version.blobHash, version.filename).catch((err: Error) =>
          setNotice(err.message),
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
      writes: true,
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
      writes: true,
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
    /**
     * **The deck** (#87): mark an item as a slide and full screen's bare
     * arrows flip through just the marked ones, in reading order. The same
     * toggling shape as the context marks above, and the same op underneath —
     * `item.update` with a property, so the CLI's `isocan slides add` and
     * this entry cannot disagree.
     */
    {
      /**
       * **A whole selection at once**, which is how a deck actually gets
       * made: ten screens are marked in one gesture, not ten. This entry was
       * `disabled: many`, so the app could not do what `isocan slides add
       * <items...>` had done since the day it shipped — a rule the CLI
       * enforced and the app did not know about.
       *
       * `slideIntent` decides, in core, so the two surfaces cannot drift:
       * already-all-slides turns off, anything else turns ON and skips the
       * ones that are already right. A mixed selection reading as "turn
       * everything off" would throw away marks somebody meant.
       */
      label: slideLabel(items),
      writes: true,
      run: () => {
        const { on, changing } = slideIntent(items);
        if (changing.length === 0) return;
        // One gesture, one ⌘Z — however many items it turns out to be.
        const group = newGroupId();
        for (const item of changing) {
          void sendEchoed(
            ctx.canvasId,
            ctx.actor,
            { type: "item.update", itemId: item.id, patch: slidePatch(on) },
            group,
          );
        }
        const what =
          changing.length === 1 ? `"${changing[0]!.title}"` : `${changing.length} items`;
        // Says what MOVED, not what was selected: "3 of 10" is the honest
        // sentence when seven were already slides, and it is the one that
        // tells somebody the gesture did what they meant.
        const of = changing.length === items.length ? "" : ` of ${items.length}`;
        flashNotice(
          on
            ? `${what}${of} — arrows in full screen stop here`
            : `${what}${of} out of the deck`,
        );
      },
    },
    /**
     * **Speaker notes** (`core/slides.ts`): a text item under the slide that
     * points at it. One slide selected: make its note, or go to the one it
     * has. The same item `isocan slides note` makes, so nothing here is a
     * second kind of thing.
     */
    ...(items.length === 1 && isSlide(items[0]!) && !isNote(items[0]!)
      ? [
          (() => {
            const slide = items[0]!;
            const existing = noteFor(useCanvasStore.getState().canvas ?? { items: {}, threads: {} } as never, slide.id);
            return existing
              ? {
                  label: "Go to speaker notes",
                  run: () => {
                    useUiStore.getState().select(existing.id);
                    revealItem(existing.id);
                  },
                }
              : {
                  label: "Add speaker notes",
                  writes: true,
                  run: async () => {
                    const id = await addSpeakerNote(ctx.canvasId, ctx.actor, slide, noteStarter(slide));
                    useUiStore.getState().select(id);
                    revealItem(id);
                    flashNotice(`Notes for "${slide.title}" — under the slide; N shows them in full screen`);
                  },
                };
          })(),
        ]
      : []),
    // Handing in to a sprint (core/sprint.ts): one property, the same op
    // `isocan sprint handin` sends. Offered only while a phase is running —
    // there is nothing to hand in to otherwise — and only for items not
    // already in, so the label is the count that will move.
    ...sprintHandIn(items, ctx),
    { separator: "" },
    {
      label: many ? `Delete ${items.length} items` : "Delete",
      shortcutFor: "Move the selection to the trash",
      danger: true,
      writes: true,
      run: () => void deleteItems(ctx.canvasId, ctx.actor, ids),
    },
  ]);
}

/**
 * What the deck entry is called for THIS selection.
 *
 * One entry that says what pressing it does, never two that contradict — the
 * same rule the context-mark entries above follow. The count is the count
 * that will MOVE, so a selection of ten where seven are already slides reads
 * "Make 3 slides" and nobody presses it expecting ten.
 */
function slideLabel(items: readonly Item[]): string {
  const { on, changing } = slideIntent(items);
  if (changing.length === 0) {
    // Everything is already the way pressing it would leave it. Naming the
    // state beats an entry that looks live and does nothing.
    return on ? `${SLIDE_EMOJI} Make a slide` : `${SLIDE_EMOJI} No longer a slide`;
  }
  if (items.length === 1) {
    return on ? `${SLIDE_EMOJI} Make this a slide` : `${SLIDE_EMOJI} No longer a slide`;
  }
  return on
    ? `${SLIDE_EMOJI} Make ${changing.length} slides`
    : `${SLIDE_EMOJI} Take ${changing.length} out of the deck`;
}

/** The hand-in entry, or nothing when no sprint phase is running. */
function sprintHandIn(items: readonly Item[], ctx: MenuContext): MenuEntry[] {
  const canvas = useCanvasStore.getState().canvas;
  const state = canvas ? sprintState(canvas) : null;
  if (!state) return [];
  const pending = handable(items, state);
  if (pending.length === 0) return [];
  const what = pending.length === 1 ? (items.length === 1 ? "this" : "1") : String(pending.length);
  return [
    {
      label: `Hand ${what} in for ${state.phase.label}`,
      writes: true,
      // The same act the clock chip's button does — one helper, so a hand-in
      // from the menu and from the chip land the same way (on the sheet).
      run: () => {
        void handIn(ctx.canvasId, ctx.actor, pending, state);
      },
    },
  ];
}

/** The menu for the canvas itself — a right-click on open ground. */
export function canvasMenu(ctx: MenuContext): MenuEntry[] {
  const held = useUiStore.getState().clipboard;
  return offered([
    {
      label: held ? `Paste ${held.items.length} item${held.items.length === 1 ? "" : "s"}` : "Paste",
      shortcutFor: "Paste",
      writes: true,
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
      writes: true,
      run: () => {
        const ui = useUiStore.getState();
        ui.setPendingText({
          x: Math.round(ctx.world.x),
          y: Math.round(ctx.world.y),
          itemId: null,
          body: "",
          style: ui.lastTextStyle,
          face: ui.lastTextFace,
          paper: ui.lastPaper,
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
  ]);
}

/** Only used to keep the import honest when a kind-specific entry is added. */
const _itemKind = itemKind;

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
  historyOpen: boolean;
  /** Days of release notes this reader has not seen — 0 hides the count. */
  unreadNews: number;
  minimapOpen: boolean;
  /** Whether this tab may write (roles phase 1). The trash is a write's
   *  aftermath and a way to undo one, so a reader is not offered it. Absent
   *  means yes, so a caller from before the rung sees the drawer it had. */
  canEdit?: boolean;
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
      /**
       * **History was reachable and not findable**, which are different
       * things. It had a clock in the tool rail and a ⌘K entry, and a person
       * who has not gone looking for either has no reason to know the canvas
       * remembers anything at all.
       *
       * Here rather than beside Workbench because this and Trash ask the same
       * question — what was here before — and they read as a pair. The label
       * says "History timeline" rather than "History" so the row promises the
       * thing you get: a track you scrub, not a list you read.
       */
      label: ctx.historyOpen ? "Hide history timeline" : "History timeline",
      icon: <HistoryGlyph size={14} />,
      run: () => ui().setHistoryOpen(!ctx.historyOpen),
    },
    ...(ctx.canEdit === false
      ? []
      : [
          {
            label: `${ctx.trashOpen ? "Hide trash" : "Trash"}${ctx.trashCount > 0 ? ` (${ctx.trashCount})` : ""}`,
            icon: <TrashGlyph size={14} />,
            run: () => ui().setTrashOpen(!ctx.trashOpen),
          },
        ]),
    {
      label: ctx.minimapOpen ? "Hide minimap" : "Show minimap",
      icon: <MinimapGlyph size={14} />,
      run: () => ui().setMinimapOpen(!ctx.minimapOpen),
    },
    { separator: "" },
    {
      /* Release notes belong beside the shortcut list: both are things you
         consult about the product rather than about this canvas. The count is
         the notification — a number that is there when something is unread and
         gone when it is not, rather than a badge that has to be dismissed. */
      label: ctx.unreadNews > 0 ? `What's new (${ctx.unreadNews})` : "What's new",
      icon: <NewsGlyph size={14} />,
      run: () => ui().setNewsOpen(true),
    },
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
