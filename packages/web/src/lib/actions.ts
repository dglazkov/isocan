import type { NavigateFunction } from "react-router-dom";
import type { Actor } from "@isocan/core";
import { canvasPath, itemPath } from "@isocan/core";
import { sendEchoed } from "../stores/canvasStore.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { openPanel } from "./panels.ts";
import { zoomBy, zoomTo100, zoomToFit, zoomToSelection } from "./zoomactions.ts";
import { formatMoves, mapOf, mapsOn, tidyMap } from "@isocan/core";

/**
 * **The things the app does itself.**
 *
 * A slash command is a MESSAGE: `/format` posts a comment, an agent reads it,
 * and the same request works from a terminal — which is the whole reason the
 * vocabulary is shared. "Fit to screen" is not that. There is no agent in it,
 * nothing to send, no terminal equivalent worth having, and `/fit-to-screen`
 * would be a message asking somebody else to move your own viewport.
 *
 * So they are a separate vocabulary, and deliberately NOT in core: an action
 * here moves a camera, opens a panel, arms a tool. None of that is a fact two
 * surfaces must agree on — it is one surface being operated. Putting them in
 * core would mean inventing a CLI meaning for "zoom to 100%" to justify the
 * location.
 *
 * The launcher shows both, in that order, because they answer different
 * questions: *do this now* comes before *ask somebody to do this*.
 */

/** What an action needs to know about the moment it is run in. */
export interface ActionContext {
  canvasId: string | null;
  actor: Actor;
  navigate: NavigateFunction;
  /** What is selected right now — several actions only mean something with a
   *  selection, and offering them empty is a menu that lies. */
  selection: readonly string[];
}

/** One thing the app can do, named the way somebody would ask for it. */
export interface Action {
  id: string;
  name: string;
  /** One line, in the same voice the panel headers use. */
  hint?: string;
  /** The keystroke that already does this, when there is one. The palette
   *  SHOWS it and does not bind it — teaching the shortcut is most of the
   *  value of a launcher, and a second binding here would be a second answer
   *  to one key. */
  keys?: string;
  group: "View" | "Tools" | "Open" | "Canvas";
  /** Whether it makes sense at this moment. */
  available?: (ctx: ActionContext) => boolean;
  run: (ctx: ActionContext) => void | Promise<void>;
}

const onCanvas = (ctx: ActionContext) => ctx.canvasId !== null;
const withSelection = (ctx: ActionContext) => ctx.selection.length > 0;

/** Everything the launcher can do, grouped in the order it shows them. */
export const ACTIONS: readonly Action[] = [
  // ---- View ----
  {
    id: "fit",
    name: "Fit to screen",
    hint: "everything on the canvas at once",
    keys: "⇧1",
    group: "View",
    available: onCanvas,
    run: () => zoomToFit(),
  },
  {
    id: "zoom-selection",
    name: "Zoom to selection",
    hint: "fill the screen with what is selected",
    keys: "⇧2",
    group: "View",
    available: (ctx) => onCanvas(ctx) && withSelection(ctx),
    run: () => zoomToSelection(),
  },
  {
    id: "zoom-100",
    name: "Actual size",
    hint: "back to 100%",
    keys: "⇧0",
    group: "View",
    available: onCanvas,
    run: () => zoomTo100(),
  },
  {
    id: "zoom-in",
    name: "Zoom in",
    group: "View",
    available: onCanvas,
    run: () => zoomBy(1.25),
  },
  {
    id: "zoom-out",
    name: "Zoom out",
    group: "View",
    available: onCanvas,
    run: () => zoomBy(0.8),
  },
  {
    id: "minimap",
    name: "Show or hide the minimap",
    group: "View",
    available: onCanvas,
    run: () => {
      const ui = useUiStore.getState();
      ui.setMinimapOpen(!ui.minimapOpen);
    },
  },
  {
    id: "theme",
    name: "Switch light and dark",
    hint: "or follow the system",
    group: "View",
    /* Imported where it runs, not at the top. `theme.ts` calls
       `window.matchMedia` at module scope, and a registry that cannot be
       imported without a DOM is a registry no test can read — which is how a
       list of what the app can do goes unchecked. */
    run: async () => {
      const { useTheme } = await import("./theme.ts");
      const { resolved, setPref } = useTheme.getState();
      setPref(resolved === "dark" ? "light" : "dark");
    },
  },
  // ---- Tools ----
  ...(["select", "hand", "pen", "text", "comment"] as const).map(
    (tool): Action => ({
      id: `tool-${tool}`,
      name: `${tool.charAt(0).toUpperCase()}${tool.slice(1)} tool`,
      keys: { select: "V", hand: "H", pen: "P", text: "T", comment: "C" }[tool],
      group: "Tools",
      available: onCanvas,
      run: () => useUiStore.getState().setActiveTool(tool),
    }),
  ),
  // ---- Open ----
  ...(
    [
      ["main", "Chat", "everyone here, agents included"],
      ["files", "Files", "everything on this canvas"],
      ["agents", "Agents", "who is here, and what they are doing"],
      ["context", "Context", "what an agent reads before it starts"],
      ["personas", "Personas", "the lenses this canvas can be reviewed through"],
    ] as const
  ).map(
    ([panel, name, hint]): Action => ({
      id: `open-${panel}`,
      name: `Open ${name}`,
      hint,
      group: "Open",
      available: onCanvas,
      run: (ctx) => openPanel(ctx.canvasId!, panel),
    }),
  ),
  {
    id: "open-history",
    name: "Open History",
    hint: "the canvas as it was, on a track you can scrub",
    group: "Open",
    available: onCanvas,
    run: () => useUiStore.getState().setHistoryOpen(true),
  },
  {
    id: "open-lens",
    name: "Open the Lens",
    hint: "who has made what, across every canvas",
    group: "Open",
    run: (ctx) => ctx.navigate("/lens"),
  },
  {
    id: "open-canvases",
    name: "All canvases",
    hint: "back to the home screen",
    group: "Open",
    run: (ctx) => ctx.navigate("/"),
  },
  {
    id: "open-help",
    name: "Keyboard shortcuts",
    keys: "?",
    group: "Open",
    run: () => useUiStore.getState().setHelpOpen(true),
  },
  // ---- Canvas ----
  {
    id: "format-grid",
    name: "Format: grid",
    hint: "straighten the lines, decide nothing",
    group: "Canvas",
    available: onCanvas,
    run: (ctx) => runFormat(ctx, "grid"),
  },
  {
    id: "format-smart",
    name: "Format: smart",
    hint: "screens across, what came from each beneath it",
    group: "Canvas",
    available: onCanvas,
    run: (ctx) => runFormat(ctx, "smart"),
  },
  {
    id: "tidy-map",
    name: "Tidy the mind map",
    hint: "a column per depth, parents centred on their children",
    group: "Canvas",
    /* Offered only where there is one to tidy: a menu that lists what it
       cannot do teaches people to stop reading it. */
    available: (ctx) => onCanvas(ctx) && mapsHere().length > 0,
    run: (ctx) => runTidy(ctx),
  },
  {
    id: "full-screen",
    name: "Full screen this",
    hint: "the selected item, filling the screen",
    keys: "↵",
    group: "Canvas",
    available: (ctx) => onCanvas(ctx) && ctx.selection.length === 1,
    run: (ctx) => ctx.navigate(itemPath(ctx.canvasId!, ctx.selection[0]!)),
  },
  {
    id: "download",
    name: "Download",
    hint: "the selected item's current version",
    keys: "⇧D",
    group: "Canvas",
    /* One item. A "download" of six is a different feature — a zip, a naming
       scheme, a progress bar — and quietly saving the first of them would be
       the worst answer available. */
    available: (ctx) => onCanvas(ctx) && ctx.selection.length === 1,
    run: async (ctx) => {
      const { downloadItem } = await import("./itemactions.ts");
      const { setNotice } = await import("../stores/canvasStore.ts");
      const item = useCanvasStore.getState().canvas?.items[ctx.selection[0]!];
      const version = item?.versions.find((v) => v.id === item.currentVersionId);
      if (!item || !version) return;
      await downloadItem(ctx.canvasId!, version.blobHash, version.filename).catch((err: Error) =>
        setNotice(err.message),
      );
    },
  },
  {
    id: "workbench",
    name: "Open the workbench",
    keys: "W",
    group: "Canvas",
    available: onCanvas,
    run: (ctx) => ctx.navigate(`${canvasPath(ctx.canvasId!)}/w`),
  },
];

/**
 * The tidy, run from here rather than asked for.
 *
 * ONE `items.move`, which is one undo — a tidy you cannot take back in one
 * press is a tidy nobody dares run from a menu they were only browsing.
 */
async function runFormat(ctx: ActionContext, mode: "grid" | "smart"): Promise<void> {
  const canvas = useCanvasStore.getState().canvas;
  if (!canvas || !ctx.canvasId) return;
  const moves = formatMoves(canvas, { mode });
  if (moves.length === 0) return;
  await sendEchoed(ctx.canvasId, ctx.actor, { type: "items.move", moves });
}

/** The maps on the canvas in front of us, for the availability check and for
 *  deciding which one a tidy means. */
function mapsHere() {
  const canvas = useCanvasStore.getState().canvas;
  return canvas ? mapsOn(canvas) : [];
}

/**
 * **Tidy the map the selection is in, or the only one there is.**
 *
 * Ambiguity is refused rather than guessed, the same rule `resolveMap` follows
 * in the CLI: with two maps on a canvas and nothing selected, tidying one of
 * them at random rearranges work somebody did not ask about.
 *
 * One `items.move`, so one undo — the first thing anybody does after an
 * automatic layout is decide they preferred it before.
 */
async function runTidy(ctx: ActionContext): Promise<void> {
  const canvas = useCanvasStore.getState().canvas;
  if (!canvas || !ctx.canvasId) return;
  const maps = mapsOn(canvas);
  const selected = useUiStore.getState().selectedItemIds;
  const fromSelection = selected
    .map((id) => canvas.items[id])
    .map((item) => (item ? mapOf(item) : null))
    .find((mapId): mapId is string => mapId !== null);
  const mapId = fromSelection ?? (maps.length === 1 ? maps[0]!.id : null);
  if (!mapId) return;
  const moves = tidyMap(canvas, mapId);
  if (moves.length === 0) return;
  await sendEchoed(ctx.canvasId, ctx.actor, { type: "items.move", moves });
}

/** What can be run right now, in the order the groups are declared. */
export function availableActions(ctx: ActionContext): Action[] {
  return ACTIONS.filter((action) => action.available?.(ctx) ?? true);
}
