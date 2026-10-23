import { selectCreatedItems } from "./groupplacement.ts";
import type { Actor, CanvasCursor, CanvasTheme, DeckTransition, Item, ModuleMark, ThemeAnchor } from "@isocan/core";
import { DECK_TRANSITIONS, deckTransitionLabel, isDeckTransition3d } from "@isocan/core";
import { markOffered, moduleMarkIntent, moduleMarkPatch, moduleMarks } from "@isocan/core";
import { canvasScopes, isDesignSystem, parentOf } from "@isocan/core";
import { isDesignFile } from "@isocan/core/design-use";
import { CURSORS, cursorLabel, contextMark, isGroupItem, isNote, isSlide, itemPath, markPatch, newGroupId, nodeCapabilitiesFor, noteFor, THEMES, themeLabel, ALIGN_EDGES, alignLabel, slideIntent, slidePatch, workbenchItemPath, keyFor, SLIDE_EMOJI, sprintState } from "@isocan/core";
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
  TrashGlyph,
  WorkbenchGlyph,
} from "../components/Glyphs.tsx";
import { cutItems, deleteItems, downloadItem, explainItem, itemAddress, pasteInto, walkItem } from "./itemactions.ts";
import { PAINTED } from "../components/themes/PaintedGround.tsx";
import { MOTIONS, MOTION_LABELS, currentMotion, writeMotion } from "./groundmotion.ts";
import { captureClipboard } from "./clipboard.ts";
import { alignItems, distributeGroupItems, tidyItems } from "./actions.ts";
import { browserClipboard, copyToClipboard, type CopyState } from "./copy.ts";
import { flashNotice, sendEchoed, setNotice, useCanvasStore } from "../stores/canvasStore.ts";
import { fetchBlobText } from "./blobtext.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { type Panel, chatHiddenNow, extensionPanelKey, openPanel } from "./panels.ts";
import { extensionColor, panelExtensionItems } from "@isocan/core";
import { glideToBox, revealItem } from "./zoomactions.ts";
import { addSpeakerNote, noteStarter } from "./notes.ts";
import { handIn, handable } from "./sprint.ts";
import { canEditNow } from "./capability.ts";
import { modules as shellModules } from "../modules.ts";
import { canvasGroupEntries, groupDeleteLabel } from "./canvasgroupmenus.ts";
import { openGroupCreation, groupTask, groupsEnabled } from "./canvasgroups.ts";
import { openUiDevtools } from "./uitweaks.ts";

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
  return settled(canEditNow() ? entries : entries.filter((entry) => "separator" in entry || !entry.writes));
}

/**
 * **Rules and headings only where they separate something** (14 Oct 2026).
 * Blocks come and go with the selection now — the single-item rows are not
 * there for four items, and nothing in "For agents" is — so a heading or a
 * rule that ends up with no rows under it goes. Where two meet, the later
 * one stands: it is the one that names the rows that follow.
 */
function settled(entries: MenuEntry[]): MenuEntry[] {
  return entries.filter((entry, i) => {
    if (!("separator" in entry)) return true;
    const next = entries[i + 1];
    if (!next || "separator" in next) return false;
    // A bare rule at the very top separates nothing; a heading there still names.
    return Boolean(entry.separator) || entries.slice(0, i).some((e) => !("separator" in e));
  });
}

/**
 * The menu for one or more selected items.
 *
 * **Shown when it can run on this selection, left out when it cannot**
 * (14 Oct 2026). Dion, on four selected items: *"the context menu is
 * confusing and long"* — twenty-four rows, a third of them grey. The single
 * item's acts were shown dimmed on a multi-selection, on the argument that a
 * menu whose shape changes between opens cannot be learned. That argument no
 * longer holds: the shape already changed with the selection (a group's own
 * rows, the copy rows, a module's marks, the hand-in), and eleven grey rows
 * taught people to stop reading. So a row that cannot apply to THIS selection
 * is not on the menu, and `disabled` is kept for "not right now" — a row that
 * would run once something about the canvas changed, where seeing it dimmed is
 * the hint. The read-only canvas already worked this way (`offered`).
 *
 * The order is most-used first, and the same skeleton for one item and for
 * many, so the blocks stay where the hand learnt them: groups; tidy and
 * arrange; copy, cut, duplicate; looking at it; the one item's own acts; what
 * agents read; the deck and the modules' marks; delete, last and apart.
 */
export function itemMenu(items: Item[], ctx: MenuContext): MenuEntry[] {
  const one = items.length === 1 ? items[0]! : null;
  const ids = items.map((i) => i.id);
  const many = items.length > 1;
  const version = one?.versions.find((v) => v.id === one.currentVersionId) ?? null;
  const caps = one && version ? nodeCapabilitiesFor(one, version) : null;
  const entered = one ? useUiStore.getState().enteredItemId === one.id : false;

  return offered([
    ...canvasGroupEntries(items, ctx),
    /**
     * **Tidy, on the ones you picked** (#196).
     *
     * Offered only with two or more selected, because tidying one item is
     * arranging it with respect to itself. It runs the same fold `isocan tidy
     * <items...>` runs, and lands them in the box they already occupy rather
     * than at the canvas's own origin — a menu must not shove somebody's work
     * across the room, or through whatever was standing there.
     *
     * **Tidy keeps the arrangement** (14 Oct 2026). It used to run `grid`,
     * which re-deals the selection onto a new lattice; Dion pressed it on four
     * loosely-arranged items wanting the alignment cleaned up, and got a
     * different arrangement with a title on top of a neighbour's name. The row
     * is `in-place` now — lines snapped, gaps evened, nothing re-dealt,
     * nothing overlapping.
     */
    ...(many
      ? [
          { separator: "" },
          {
            label: `Tidy ${items.length} items`,
            writes: true,
            run: () => groupTask(() => tidyItems(ctx.canvasId, ctx.actor, ids, "in-place")),
          },
          arrangeEntry(items, ctx),
        ]
      : []),
    { separator: "" },
    {
      label: many ? `Copy ${items.length} items` : "Copy",
      shortcutFor: "Copy the selection",
      run: () => {
        const copied = captureClipboard(ctx.canvasId, ids);
        useUiStore.getState().setClipboard(copied);
        flashNotice(`Copied ${copied.items.length} item${copied.items.length === 1 ? "" : "s"}`);
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
        void pasteInto(captureClipboard(ctx.canvasId, ids), ctx.canvasId, ctx.actor).then((made) => {
          if (made.length) selectCreatedItems(ctx.canvasId, made);
        });
      },
    },
    { separator: "" },
    ...(one && !isGroupItem(one) && caps?.view ? [{
      label: "View",
      shortcutFor: "View the selection",
      run: () => ctx.navigate(itemPath(ctx.canvasId, one.id)),
    }] : []),
    ...(one && !isGroupItem(one) && caps?.edit ? [{
      label: "Edit",
      shortcutFor: "Edit the selection",
      writes: true,
      run: () => ctx.navigate(workbenchItemPath(ctx.canvasId, one.id)),
    }] : []),
    ...(one && !isGroupItem(one) && caps?.enter ? [{
      label: entered ? "Leave" : "Enter",
      ...(entered ? {} : { shortcutFor: "Step inside it: scroll it, click its links" }),
      run: () => useUiStore.getState().setEntered(entered ? null : one.id),
    }] : []),
    {
      label: "Fit",
      shortcutFor: "Fit the selection",
      run: () =>
        glideToBox({
          minX: Math.min(...items.map((i) => i.x)),
          minY: Math.min(...items.map((i) => i.y)),
          maxX: Math.max(...items.map((i) => i.x + i.width)),
          maxY: Math.max(...items.map((i) => i.y + i.height)),
        }),
    },
    ...(one ? oneItemEntries(one, version, ctx) : []),
    ...(one ? contextEntries(one, ctx) : []),
    /**
     * **The deck** (#87): mark an item as a slide and full screen's bare
     * arrows flip through just the marked ones, in reading order. The same
     * op underneath as the context marks above — `item.update` with a
     * property, so the CLI's `isocan slides add` and
     * this entry cannot disagree. Its own block rather than under "For
     * agents": a deck is for the people in the room.
     */
    { separator: "" },
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
                    if (!selectCreatedItems(ctx.canvasId, [id])) return;
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
    // A module's marks (the wireframe's 📐 keep): the deck entry's shape for
    // any mark a loaded module declares, and the same `item.update` its CLI sends.
    ...moduleMarks().filter((mark) => items.every((item) => markOffered(mark, item))).map((mark): MenuEntry => {
      const { on, changing } = moduleMarkIntent(items, mark.property);
      const n = changing.length > 1 ? ` (${changing.length})` : "";
      return {
        label: `${mark.emoji} ${on ? mark.on : mark.off}${n}`,
        writes: true,
        run: () => void toggleModuleMark(mark, items, ctx.canvasId, ctx.actor),
      };
    }),
    // A loaded module's own rows (the wireframes' Style ▸): built by its lazy half; a pick opens its dialog.
    ...shellModules().flatMap((m) => m.menu?.({ canvas: useCanvasStore.getState().canvas!, items, open: useUiStore.getState().openModuleDialog }) ?? []),
    ...(one ? designSystemEntry(one, ctx) : []),
    ...(one ? chooseEntry(one, ctx) : []),
    { separator: "" },
    {
      label: groupDeleteLabel(items) ?? (many ? `Delete ${items.length} items` : "Delete"),
      shortcutFor: "Move the selection to the trash",
      danger: true,
      writes: true,
      run: () => void deleteItems(ctx.canvasId, ctx.actor, ids),
    },
  ]);
}

/**
 * **Arrange ›: the ways of putting a selection in order that need an answer
 * first** (14 Oct 2026).
 *
 * Tidy decides for you, so it stays a row of its own. Everything in here asks
 * "to what?" — which edge, which direction, what shape — so it opens, and
 * showing the answers IS the explanation. This replaced an "Arrange" heading
 * over six rows (Tidy, Tidy — grid, Tidy — smart, Align ›, Distribute ×2):
 * Dion's question was *"what does Tidy — smart mean? Why would I choose
 * that?"*, and a row whose name has to be looked up is not a door.
 *
 * - **Align left … bottom**: `isocan align --to <edge>`. The edge's word is
 *   core's `alignLabel`, so the CLI and the app name one edge one way; the
 *   menu adds the verb, because inside a submenu called Arrange a row reading
 *   only "Left" does not say what it does.
 * - **Space evenly across / down**: `isocan distribute --axis h|v`, worded for
 *   the effect rather than the operation. Only at three or more, where there
 *   is a middle to move — two items are already evenly spaced — and only on a
 *   canvas with groups, where the web has the act at all.
 * - **Pack into a grid**: `isocan tidy grid <items...>` — re-deals them onto a
 *   lattice, the one Tidy used to be.
 *
 * `smart` is not here: it hangs variations under their source and gathers
 * media below, which is a canvas-wide reading order, not a way to arrange four
 * cards. It stays in ⌘K ("Format: smart") and as `isocan tidy smart`.
 */
function arrangeEntry(items: readonly Item[], ctx: MenuContext): MenuEntry {
  const ids = items.map((i) => i.id);
  return {
    label: "Arrange",
    writes: true,
    run: () => {},
    submenu: [
      ...ALIGN_EDGES.map((edge) => ({
        label: `Align ${alignLabel(edge).toLowerCase()}`,
        writes: true,
        run: () => groupTask(() => alignItems(ctx.canvasId, ctx.actor, ids, edge)),
      })),
      ...(groupsEnabled() && ids.length >= 3 ? [
        { separator: "" },
        { label: "Space evenly across", writes: true, run: () => groupTask(() => distributeGroupItems(ctx.canvasId, ctx.actor, ids, "h")) },
        { label: "Space evenly down", writes: true, run: () => groupTask(() => distributeGroupItems(ctx.canvasId, ctx.actor, ids, "v")) },
      ] : []),
      { separator: "" },
      {
        label: "Pack into a grid",
        writes: true,
        run: () => groupTask(() => tidyItems(ctx.canvasId, ctx.actor, ids, "grid")),
      },
    ],
  };
}

/** The acts only one item has: its name, its versions, its words, its address and its bytes. */
function oneItemEntries(one: Item, version: Item["versions"][number] | null, ctx: MenuContext): MenuEntry[] {
  const history = one.versions.length > 1;
  return [
    { separator: "" },
    {
      label: "Rename",
      shortcutFor: "Rename",
      writes: true,
      run: () => useUiStore.getState().setRenaming(one.id),
    },
    // The stack is only a thing when there is more than one wording of it.
    ...(history ? [{
      label: "Version history",
      shortcutFor: "Show the version stack",
      run: () => useUiStore.getState().setFanned(one.id),
    }] : []),
    // What changed (docs/projects/version-diff/design.md): the last edit, or
    // a variation against its source. The inspector loads on the click.
    ...(history || parentOf(one) ? [{
      label: "Compare versions",
      run: () => void import("../components/VersionCompare.tsx").then((m) => m.openCompare({ canvasId: ctx.canvasId, actor: ctx.actor, itemId: one.id })),
    }] : []),
    // How it got here (proactive-agent phase 4) — `isocan explain`; a panel beside the canvas, loaded on the click.
    { label: "Explain", run: () => explainItem(ctx.canvasId, ctx.actor, one.id) },
    // Walk it as someone else (proactive-agent phase 9) — `isocan walk`; a group of screens, a prototype or a screen, loaded on the click.
    ...(version?.mimeType === "text/html" || one.properties.kind === "group" ? [{ label: "Walk it as someone else…", run: () => walkItem(ctx.canvasId, ctx.actor, one.id) }] : []),
    // N voices for a screen's words, each a variation (copy-edit phase 2) — `isocan words vary` — and, once
    // it has voices (on the screen or on one of them), all of them side by side to mix (phase 3) — `isocan
    // words mix`. Both load on the click, through the one lazy file. "Compare the copy…" stays dimmed until
    // there are voices: that is "not yet", and seeing it beside "Vary the copy…" says what comes next.
    ...(version?.mimeType === "text/html"
      ? ["Vary the copy…", "Compare the copy…"].map((label, i) => ({
          label,
          writes: !i,
          disabled: i > 0 && !Object.values(useCanvasStore.getState().canvas!.items).some((o) => o.properties.copyStance !== undefined && (o.id === one.id || o.properties.parent === one.id)),
          run: () => void import("../components/VaryCopy.tsx").then((m) => (i ? m.openCopyCompare : m.openVaryCopy)({ canvasId: ctx.canvasId, actor: ctx.actor, itemId: one.id })),
        }))
      : []),
    // A voice for a whole wire flow (copy-edit phase 5) — `isocan wire voice` — on any screen of a fleshed flow or
    // its prototype, as the module that draws flows says (`WebCopyWriter.flow.offers`). Loads on the click.
    ...(shellModules().some((m) => m.copy?.flow?.offers(useCanvasStore.getState().canvas!, one))
      ? [{
          label: "Choose a voice…",
          writes: true,
          run: () => void import("../components/VaryCopy.tsx").then((m) => m.openChooseVoice({ canvasId: ctx.canvasId, actor: ctx.actor, itemId: one.id })),
        }]
      : []),
    { separator: "" },
    {
      label: "Copy link",
      run: () => {
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
    ...(version ? [{
      label: "Download",
      /* The accelerator is looked up from `SHORTCUTS`, never spelled here —
         a rebound key cannot leave the menu telling somebody the old one. */
      shortcutFor: "Download",
      run: () => {
        void downloadItem(ctx.canvasId, version.blobHash, version.filename).catch((err: Error) =>
          setNotice(err.message),
        );
      },
    }] : []),
  ];
}

/**
 * **Stage 2 of the context view, on the surface that is not a terminal.**
 *
 * `isocan context pin` and `exclude` act on an item, so the app's home for
 * them is the item's own menu rather than the Context panel — that panel
 * lists PIECES, and pinning a piece is not a thing. Without this the CLI
 * would hold a verb the app does not, which is the gap the whole project
 * exists to close.
 *
 * **Said as what agents do, not as "context"** (14 Oct 2026). The rows read
 * "Pin into context" and "Keep out of context", and Dion asked what the
 * context stuff was about: "context" is the CLI's noun for what an agent
 * reads before it starts, and the app had never said so. So the heading names
 * who it is for, and each row says what an agent will do with this item. The
 * CLI keeps its verbs — `context pin`, `context exclude` — and its own words
 * (`markLabel`), because an agent reading `isocan context` is reading about
 * context; the agent guide says what the app calls them.
 *
 * **Two ticks, not labels that turn over.** A mark is one of three states —
 * always read, skipped, neither — so the rows are a set: the tick says which
 * is true now, and pressing a ticked row takes the mark off. A row whose
 * label flipped between "Pin" and "Unpin" made the reader work out which was
 * true, and a set of two flipping rows doubled it.
 *
 * "Agents skip this" rather than "Hide from agents": the item is not hidden —
 * `isocan ls` still lists it and an agent asked about it can read it. Only
 * what an agent is TOLD to read changes, and a row must not promise more.
 *
 * One item only, as `isocan context pin <item>` is: on a multi-selection the
 * block is not offered rather than dimmed.
 */
function contextEntries(item: Item, ctx: MenuContext): MenuEntry[] {
  const now = contextMark(item);
  const toggle = (mark: "pinned" | "excluded") => {
    const next = now === mark ? null : mark;
    void sendEchoed(ctx.canvasId, ctx.actor, { type: "item.update", itemId: item.id, patch: markPatch(next) });
    // Excluded is not deleted: the item stays, its versions stay, its
    // comments stay. Only what a reader assembling context is told changes.
    flashNotice(
      mark === "pinned"
        ? next ? `Agents always read "${item.title}"` : `Agents no longer always read "${item.title}"`
        : next ? `Agents skip "${item.title}" — it is still on the canvas` : `Agents no longer skip "${item.title}"`,
    );
  };
  return [
    { separator: "For agents" },
    { label: "Agents always read this", checked: now === "pinned", writes: true, run: () => toggle("pinned") },
    { label: "Agents skip this", checked: now === "excluded", writes: true, run: () => toggle("excluded") },
  ];
}

/**
 * **Which DESIGN.md governs, chosen where you are looking at it** — the web's
 * door to `isocan design use`. Offered on a markdown item called DESIGN.md
 * (every note on a canvas offering to become its design system would be a
 * menu nobody reads), and on a system, to stop it. The scope is where the
 * item sits, because that is what a DESIGN.md governs by; the label names it.
 * The op is built on the click, in its own chunk (`designuse.ts`).
 */
function designSystemEntry(item: Item, ctx: MenuContext): MenuEntry[] {
  const on = !isDesignSystem(item);
  if (on && !isDesignFile(item)) return [];
  const canvas = useCanvasStore.getState().canvas;
  const scope = canvas && canvasScopes(canvas, item)[0];
  return [{
    // Short, because a group's title in the label widened the whole menu;
    // the notice the click raises names the group in full.
    label: `${on ? "Use as" : "Stop using as"} ${scope ? "this group's " : ""}design system`,
    writes: true,
    run: () => void import("./designuse.ts").then((m) => m.chooseDesignSystem(ctx.canvasId, ctx.actor, item.id, on)),
  }];
}

/**
 * **This one won** — the web's door to `isocan choose`. Offered on a
 * variation whose source is still on the canvas (an item made from nothing,
 * or from something since deleted, has nowhere to fold back into). The ops
 * are built on the click, in their own chunk (`choose.ts`), by the same core
 * plan the CLI uses, and undo as one.
 */
function chooseEntry(item: Item, ctx: MenuContext): MenuEntry[] {
  const parent = parentOf(item);
  if (!parent || !useCanvasStore.getState().canvas?.items[parent]) return [];
  return [{
    label: "Choose this variation",
    writes: true,
    run: () => void import("./choose.ts").then((m) => m.chooseVariation(ctx.canvasId, ctx.actor, item.id)),
  }];
}

/**
 * What the deck entry is called for THIS selection.
 *
 * One entry that says what pressing it does, never two that contradict. The
 * context marks became a ticked pair on 14 Oct because they are a set of
 * three states; a slide is on or off, so its label still says the act. The count is the count
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

/**
 * **Put a module's mark on a selection, or take it off** — the menu entry and
 * the mark's key both land here, so the two doors are one act. One gesture is
 * one op group, so one ⌘Z; the items already right are not written.
 */
export async function toggleModuleMark(mark: ModuleMark, items: readonly Item[], canvasId: string, actor: Actor): Promise<void> {
  const { on, changing } = moduleMarkIntent(items, mark.property);
  if (changing.length === 0) return;
  const group = newGroupId();
  // Signed: the mark says who put it on (`<property>By`), so a person's pick reads apart from a machine's.
  const sent = changing.map((item) => sendEchoed(canvasId, actor, { type: "item.update", itemId: item.id, patch: moduleMarkPatch(mark.property, on, actor.id) }, group));
  const what = changing.length === 1 ? `"${changing[0]!.title}"` : `${changing.length} items`;
  // What the item now IS, in the mark's own words: "in the prototype", "not in the prototype".
  flashNotice(`${mark.emoji} ${what} — ${on ? "" : "not "}${mark.title.toLowerCase()}`);
  await Promise.all(sent);
  if (!mark.follow) return;
  // What the mark sets off (the wireframes' prototype re-versioning) rides the same group, so one ⌘Z takes
  // both back — and runs only now, after the marks are in the replica, so it reads the canvas they left.
  // `modulehost` is lazy and stays so; `fetchBlobText` is first paint's already, so it is imported, not fetched —
  // a dynamic import of an entry module mints a namespace object in the entry chunk (measured: +129 bytes).
  const { webHostFor } = await import("./modulehost.ts");
  const host = { ...webHostFor(canvasId, actor), readText: (hash: string) => fetchBlobText(canvasId, hash), getCanvas: () => useCanvasStore.getState().canvas! };
  await mark.follow({ canvasId, group, changed: changing, on, host }).catch((error: unknown) => flashNotice(`${mark.emoji} ${(error as Error)?.message ?? String(error)}`));
}

/** ⇧ and a mark's letter on the selection (`CanvasPage`'s keys), by `KeyboardEvent.code`. */
export async function markByKey(code: string, ids: readonly string[], canvasId: string, actor: Actor): Promise<void> {
  const mark = moduleMarks().find((m) => `Key${m.key}` === code);
  const canvas = useCanvasStore.getState().canvas;
  if (mark && canvas) await toggleModuleMark(mark, ids.flatMap((id) => canvas.items[id] ?? []).filter((item) => markOffered(mark, item)), canvasId, actor);
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
    { label: "New group", writes: true, disabled: !groupsEnabled(), ...(!groupsEnabled() ? { value: "Not enabled on this canvas" } : {}), run: () => openGroupCreation([], ctx.world) },
    {
      label: held ? `Paste ${held.items.length} item${held.items.length === 1 ? "" : "s"}` : "Paste",
      shortcutFor: "Paste",
      writes: true,
      disabled: !held,
      run: () => {
        if (!held) return;
        void pasteInto(held, ctx.canvasId, ctx.actor, ctx.world).then((made) => {
          if (made.length > 0) selectCreatedItems(ctx.canvasId, made);
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
          colour: ui.lastTextColour,
          font: ui.lastTextFont,
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
    { separator: "" },
    {
      label: "Customize UI…",
      shortcutFor: "Customize UI",
      run: () => openUiDevtools("layers"),
    },
  ]);
}

/**
 * **The deck's transition, as a set you can see** — the drawer's "Slide
 * transition" rows. Full screen's bar offers the same `DECK_TRANSITIONS`
 * in its own dropdown, since this menu sits under full screen. A canvas fact (`deckTransitionPatch`,
 * one `project.update`), so every row writes; the 3D ones say so beside
 * their names, because "Cube" alone does not tell you it will turn.
 */
function deckTransitionEntries(
  current: DeckTransition,
  set: (transition: DeckTransition) => void | Promise<void>,
): MenuEntry[] {
  return DECK_TRANSITIONS.map((transition) => ({
    label: deckTransitionLabel(transition),
    ...(isDeckTransition3d(transition) ? { value: "3D" } : {}),
    checked: current === transition,
    writes: true,
    run: () => void set(transition),
  }));
}

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
  /** What ground this canvas is wearing, or null for the dot grid. */
  theme: CanvasTheme | null;
  /**
   * Put a named ground on, or `null` to clear it. The caller owns the write,
   * because this module builds entries and sends no ops.
   *
   * Replaced `cycleTheme` on 7 Sep: a submenu names each ground, so "the next
   * one along" stopped being a thing anybody asks for.
   */
  setTheme: (theme: CanvasTheme | null) => void | Promise<void>;
  /** Whether this canvas stands on a picture somebody supplied (#204 phase 2). */
  ownGround: boolean;
  /** Ask for a file and stand the canvas on it. The caller owns the picker
   *  and the upload for `setTheme`'s reason: this module builds entries. */
  pickGround: () => void | Promise<void>;
  /** The pointer this canvas wears, when it is standing on a picture of its
   *  own — null when nothing has been chosen (#204 phase 3). */
  cursor: CanvasCursor | null;
  setCursor: (cursor: CanvasCursor | null) => void | Promise<void>;
  /** How this canvas's deck moves between slides, and the write that changes
   *  it. Absent from a caller that does not offer the choice. */
  deckTransition?: DeckTransition;
  setDeckTransition?: (transition: DeckTransition) => void | Promise<void>;
  /** Open the switcher — the same face ⌘O opens. */
  openSwitcher: () => void;
  /** Whether the ground travels with the canvas or stays behind the glass. */
  anchor: ThemeAnchor;
  toggleAnchor: () => void | Promise<void>;
  /** Whether this tab may write (roles phase 1). The trash is a write's
   *  aftermath and a way to undo one, so a reader is not offered it. Absent
   *  means yes, so a caller from before the rung sees the drawer it had. */
  canEdit?: boolean;
  /** Navigation belongs to the caller: this module builds entries and has no
   *  business holding a router. */
  toWorkbench: () => void;
  /**
   * The Groups rows, built by the caller because they need the current
   * selection and a `navigate`. A submenu rather than a flattened block:
   * selecting items and right-clicking is how grouping actually gets done
   * (the same `canvasGroupEntries` are already in the item menu above), so
   * this is the findable way in rather than the fast one, and a fast way in
   * that costs five rows of a menu everybody opens is the wrong trade.
   */
  groups?: MenuEntry[];
  /** What the parent row says to the right of "Groups" — how many items the
   *  submenu would act on, so the count is legible without opening it. */
  groupsValue?: string;
  projectViews?: Array<{ label: string; icon?: ReactNode; run: () => void }>;
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
  const liveCanvas = useCanvasStore.getState().canvas;
  const extPanels = liveCanvas ? panelExtensionItems(liveCanvas) : [];
  return [
    ...rail
      // Inside a pane that hides the Chat (`?embed=1`) its row would open nothing.
      .filter((one) => !one.open && !(one.panel === "main" && chatHiddenNow()))
      .map((one) => ({
        label: one.label,
        icon: one.icon,
        run: () => openPanel(ctx.canvasId, one.panel),
      })),
    ...extPanels
      .filter((item) => !(ui().extensionPanelOpen && ui().extensionPanelId === item.id))
      .map((item) => ({
        label: item.title,
        icon: (
          <span
            className="extension-menu-dot"
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: extensionColor(item.id),
            }}
            aria-hidden
          />
        ),
        run: () => openPanel(ctx.canvasId, extensionPanelKey(item.id)),
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
    /* **Groups left the bar on 13 Sep.** It was a top-level button beside the
       title, which put a feature most people reach by right-clicking a
       selection in the one place that is always on screen. The rows are
       unchanged and the item menu still carries them; this is where you look
       when nothing is selected, or when you do not yet know the gesture. */
    /* A module's workspace IS a take-over, the same kind of thing Workbench
       is, so it sits with Workbench rather than adrift below Groups. Anatomy
       is the one that exists today; anything with an `x/<segment>` lands here
       beside it. */
    ...(ctx.projectViews ?? []),
    {
      /**
       * **Switching canvases, where somebody can find it** (6 Sep 2026).
       *
       * It lived only on a caret beside the canvas's name, and that caret was
       * unreadable for a reason worth writing down: clicking the NAME opens
       * the rename editor, so the two controls sit adjacent and mean entirely
       * different things. Every app with several documents puts a caret next
       * to the title, but there it is ONE control opening a menu — here it was
       * a second button whose only label was its shape, beside a `···` whose
       * only label was its shape.
       *
       * A row here carries a word and, through `shortcutFor`, the key — which
       * is the part the caret could never do. Somebody who finds this once
       * learns ⌘O and stops needing the menu, which is the right direction for
       * a thing done many times a day.
       */
      label: "Switch canvas…",
      shortcutFor: "Switch canvas",
      run: () => ctx.openSwitcher(),
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
    /* **Groups moved down here on 14 Sep.** It had been sitting between
       Workbench and the module rooms, which read as a place you GO — it is
       not. It is something about this canvas: what is on it, how it is
       arranged, and (until a canvas is converted) which model it uses. That
       puts it with the history and the trash rather than with the rooms. */
    ...(ctx.groups?.length
      ? [{ label: "Groups", value: ctx.groupsValue ?? "", run: () => {}, submenu: ctx.groups }]
      : []),
    /* **Slide transition** — how full screen moves from one slide to the
       next, for everybody watching. Beside Groups because it is the same kind
       of row: something about this canvas, not a place to go. */
    ...(ctx.deckTransition && ctx.setDeckTransition
      ? [
          {
            label: "Slide transition",
            value: deckTransitionLabel(ctx.deckTransition),
            writes: true,
            run: () => {},
            submenu: deckTransitionEntries(ctx.deckTransition, ctx.setDeckTransition),
          },
        ]
      : []),
    { separator: "" },
    {
      /**
       * **The canvas's ground, as a set you can see** (#195, reshaped 7 Sep).
       *
       * This was one row that CYCLED — click it and you got the next ground,
       * wrapping through none. The argument was that the set is small and the
       * answer is visible the moment it changes, so a picker would be a dialog
       * for the developer's benefit.
       *
       * Dion asked for a submenu instead, and using it makes the reason plain:
       * cycling never shows you the SET. To see three grounds you clicked three
       * times, and to get back to the one you liked you kept going. A submenu
       * shows what there is, marks what is on, and the parent row carries the
       * current name so the answer needs no opening at all.
       *
       * A canvas fact, not a browser one: everybody on it sees the same
       * ground. That is the opposite of the glow below, and the two still sit
       * together so the difference stays legible.
       */
      label: "Background",
      value: ctx.ownGround ? "Yours" : ctx.theme === null ? "None" : themeLabel(ctx.theme),
      writes: true,
      run: () => {},
      submenu: [
        ...THEMES.map((theme) => ({
          label: themeLabel(theme),
          checked: !ctx.ownGround && ctx.theme === theme,
          writes: true,
          // Each ground shows itself: its tile, or a living ground's still.
          ...(PAINTED[theme] ? { preview: `/grounds/${theme}.jpg` } : {}),
          run: () => void ctx.setTheme(theme),
        })),
        {
          /**
           * **A ground of your own** (#204 phase 2). The ellipsis is the
           * promise: this one opens a file picker rather than changing the
           * canvas the moment it is clicked, which is the one row here that
           * does not.
           *
           * It sits with the seeded grounds and not under a separate heading
           * because it is the same choice — what is this canvas standing on —
           * and its tick reads the same way theirs do. What it does NOT get is
           * a size warning beside it: the refusal names the number if the file
           * is too big, and a menu row is not where somebody reads a budget.
           */
          label: "A picture of yours…",
          checked: ctx.ownGround,
          writes: true,
          run: () => void ctx.pickGround(),
        },
        {
          label: "Clear",
          checked: !ctx.ownGround && ctx.theme === null,
          writes: true,
          run: () => void ctx.setTheme(null),
        },
        { separator: "" },
        {
          /**
           * **The cursor half of "a tile and cursor"** (#204 phase 3).
           *
           * Only for a picture of your own, and that is #195's rule rather
           * than a limitation: a seeded ground NAMES its cursor, because
           * "galaxy" is the fact — a canvas cannot be a galaxy with a fish.
           * A picture names nothing, so there is nothing to contradict and
           * this is the missing name rather than a second one competing.
           *
           * Chosen, never uploaded: every shape is filled with the viewer's
           * own colour, and an uploaded image cannot be tinted — six people
           * would share one pointer, which deletes the only signal saying who
           * is who.
           */
          label: "Cursor",
          value: ctx.cursor ? cursorLabel(ctx.cursor) : "Arrow",
          writes: true,
          disabled: !ctx.ownGround,
          run: () => {},
          submenu: CURSORS.map((cursor) => ({
            label: cursorLabel(cursor),
            checked: (ctx.cursor ?? "arrow") === cursor,
            writes: true,
            run: () => void ctx.setCursor(cursor === "arrow" ? null : cursor),
          })),
        },
        { separator: "" },
        {
          /**
           * **Sticky: the ground stays behind the glass** (#195's two modes,
           * named the way Dion names them).
           *
           * Unticked, the ground belongs to the canvas — a field stays under
           * whatever is standing in it, and a pen is somewhere you can come
           * back to. Ticked, the ground never moves and the items travel
           * across it — which IS what says where you are, together with the
           * minimap. The dot grid does not come back; every ground covers it,
           * pinned or not, and putting it back over a starfield or a
           * photograph was measured and is worse. See `THEME_ANCHOR_PROP` in
           * core.
           *
           * A tick rather than the sentence it replaced: inside a set, a row
           * whose label changes under the pointer is harder to read than one
           * whose MARK does.
           */
          label: "Sticky",
          checked: ctx.anchor === "window",
          writes: true,
          /**
           * Off for a picture of your own, and that is the feature rather than
           * a gap: a ground that travels with the canvas REPEATS, and a
           * photograph that is not seamless repeats as a grid of its own edges
           * — the one failure a person cannot debug and did not cause. So a
           * custom ground is pinned and stays pinned. Un-pinning it is #204
           * phase 4, for somebody who has actually made a tile, with the seam
           * risk stated where they choose it.
           */
          disabled: ctx.ownGround || ctx.theme === null,
          run: () => void ctx.toggleAnchor(),
        },
        /**
         * **Motion: this viewer's, not the canvas's** (living grounds phase 4,
         * journey.md scene 5). Everything above changes what everybody on the
         * canvas stands on; these three change only how much it moves on THIS
         * screen — a localStorage key like the Chat's placement, no op, so no
         * `writes` and no undo. Under reduced motion every choice draws the
         * still, and the system setting wins.
         */
        { separator: "Motion" },
        ...MOTIONS.map((motion) => ({
          label: MOTION_LABELS[motion],
          checked: currentMotion() === motion,
          run: () => writeMotion(motion),
        })),
      ],
    },
    {
      label: "Customize UI…",
      shortcutFor: "Customize UI",
      run: () => openUiDevtools("glass"),
    },
    /* **The cursor glow left this menu on 13 Sep** (#195 put it here). Its
       own note said it belonged "beside the minimap because it is the same
       kind of choice: what this browser draws, for this person, on every
       canvas" — which is the description of the Controls list in Settings,
       where every other switch of that kind already was. One category, two
       homes, and neither naming the other. It is a row in `DISPLAY_SWITCHES`
       now, reading and writing the same store key. */
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
