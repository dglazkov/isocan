import type { CanvasContents, Item } from "./model.ts";
import { canvasIdOf, isCanvasItem } from "./canvasitem.ts";
import { areasOf } from "./area.ts";
import { PLACEMENT_GAP } from "./placement.ts";
import { designSystem } from "./designsystem.ts";
import { pinnedItems } from "./contextmark.ts";
import { type ContextExtras, type ContextPiece, contextPieces } from "./context.ts";

/**
 * **Memory, in layers you can see** (`docs/projects/memory/design.md`).
 *
 * Memory is canvases. An agent's context here was one canvas's worth; this
 * makes it layers of the same thing — **this canvas**, and **the canvases it
 * links** — each an ordinary canvas, joined by one kind of item and read by
 * one function. The link is a canvas card (`canvasitem.ts`) wearing one more
 * property, `memory=inherit`; a linked canvas contributes its *context
 * pieces* here, read-only: its design system (this canvas's own wins when
 * both exist, and the list says so), its pinned items, and how big it is.
 * Not its Chat and not its items wholesale — context is what somebody
 * decided matters, and the link inherits exactly that decision.
 *
 * **Zero new op types**: one property value on an item another project
 * defines, set and cleared by `item.update` the way a pin is. The record is
 * never hidden: the link is an item anyone on the canvas can see.
 */

export const MEMORY_PROP = "memory";
export const MEMORY_INHERIT = "inherit";
/** Phase 2's value — the person's own canvas, read only by their actors. */
export const MEMORY_PERSONAL = "personal";

export type MemoryLink = "inherit" | "personal";

/** What a canvas card says about the memory behind it, or nothing. */
export function memoryOf(item: Item): MemoryLink | null {
  if (!isCanvasItem(item)) return null;
  const raw = item.properties?.[MEMORY_PROP];
  return raw === MEMORY_INHERIT || raw === MEMORY_PERSONAL ? raw : null;
}

/**
 * The canvases this one inherits from, **in the order the room reads them**:
 * top to bottom, then left to right. Several links compose in that order,
 * so the first design system found governs when this canvas has none.
 */
export function memoryLinks(canvas: CanvasContents): Item[] {
  return Object.values(canvas.items)
    .filter((item) => memoryOf(item) === MEMORY_INHERIT)
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

/** The patch that sets or clears the link — one spelling for both surfaces,
 *  cleared with `removeProperties` for the reason `markPatch` records. */
export function memoryPatch(
  memory: MemoryLink | null,
): { properties: Record<string, string> } | { removeProperties: string[] } {
  return memory === null ? { removeProperties: [MEMORY_PROP] } : { properties: { [MEMORY_PROP]: memory } };
}

/** A linked canvas as the reader could fetch it — or could not, with the
 *  reason in words, because a blank heading is the site item's first lesson. */
export interface LinkedCanvas {
  /** The card on this canvas that made the link. */
  item: Item;
  canvasId: string;
  /** The linked canvas's own title when it was read; the card's otherwise. */
  title: string;
  canvas: CanvasContents | null;
  /** Why it could not be read, when it could not. */
  refused?: string;
}

/** One heading in the Context view: whose pieces these are. */
export interface ContextLayer {
  /** Null for this canvas itself. */
  canvasId: string | null;
  heading: string;
  pieces: ContextPiece[];
  /** Set when the layer could not be read — the heading stands, with why. */
  refused?: string;
}

/**
 * What a linked canvas contributes: its design system, its pins, its size.
 * `localHasDesign` is the override rule — when this canvas has its own, the
 * inherited one is listed struck, with *this canvas's wins* beside it.
 */
export function inheritedPieces(
  linked: CanvasContents,
  from: { canvasId: string; title: string },
  localHasDesign: boolean,
): ContextPiece[] {
  const pieces: ContextPiece[] = [];
  const design = designSystem(linked);
  if (design) {
    pieces.push({
      name: "Design system",
      source: "canvas",
      present: true,
      size: `v${design.versions.length}`,
      updatedAt: design.updatedAt,
      from,
      ...(localHasDesign ? { overridden: "this canvas's wins" } : {}),
    });
  }
  const pinned = pinnedItems(linked);
  if (pinned.length > 0) {
    pieces.push({
      name: "Pinned items",
      source: "canvas",
      present: true,
      size: pinned.map((item) => item.title).join(", "),
      from,
    });
  }
  const items = Object.values(linked.items);
  pieces.push({
    name: "The canvas",
    source: "canvas",
    present: items.length > 0,
    size: `${items.length} item${items.length === 1 ? "" : "s"}`,
    from,
  });
  return pieces;
}

/**
 * The Context view in layers: this canvas first, then one heading per linked
 * canvas in reading order. `contextPieces` is unchanged underneath — the
 * first layer is exactly what the view showed before there were layers.
 */
export function contextLayers(
  canvas: CanvasContents,
  linked: LinkedCanvas[],
  extras: ContextExtras = {},
  nowMs: number = Date.now(),
): ContextLayer[] {
  const layers: ContextLayer[] = [
    { canvasId: null, heading: "This canvas", pieces: contextPieces(canvas, extras, nowMs) },
  ];
  const localHasDesign = designSystem(canvas) !== null;
  for (const link of linked) {
    if (!link.canvas) {
      layers.push({
        canvasId: link.canvasId,
        heading: link.title,
        pieces: [],
        refused: link.refused ?? "could not be read",
      });
      continue;
    }
    layers.push({
      canvasId: link.canvasId,
      heading: link.title,
      pieces: inheritedPieces(link.canvas, { canvasId: link.canvasId, title: link.title }, localHasDesign),
    });
  }
  return layers;
}

/**
 * The design system that governs here: this canvas's own, else the first a
 * linked canvas contributes, in reading order. `design check` on a canvas
 * with none of its own checks against the inherited one, and says whose.
 */
export function governingDesign(
  canvas: CanvasContents,
  linked: LinkedCanvas[],
): { item: Item; from: { canvasId: string; title: string } | null } | null {
  const own = designSystem(canvas);
  if (own) return { item: own, from: null };
  for (const link of linked) {
    if (!link.canvas) continue;
    const theirs = designSystem(link.canvas);
    if (theirs) return { item: theirs, from: { canvasId: link.canvasId, title: link.title } };
  }
  return null;
}

/** The layers as a terminal prints them: a heading per source, the pieces
 *  under it the way `contextReport` prints them, and a refusal in words. */
export function layersReport(layers: ContextLayer[], report: (pieces: ContextPiece[]) => string): string {
  const out: string[] = [];
  for (const layer of layers) {
    out.push(layer.canvasId ? `${layer.heading} — inherited (${layer.canvasId})` : layer.heading);
    if (layer.refused) out.push(`  ${layer.refused}`);
    else if (layer.pieces.length === 0) out.push("  nothing to inherit");
    else out.push(report(layer.pieces).replace(/^/gm, "  "));
    out.push("");
  }
  return out.join("\n").trimEnd();
}

/** The canvas a card links, when it is a memory link — for a reader that
 *  walks a canvas's cards deciding what to fetch. */
export function linkedCanvasId(item: Item): string | null {
  return memoryOf(item) === MEMORY_INHERIT ? canvasIdOf(item) : null;
}

/**
 * **The Context sheet** (phase 3): the corner where a canvas's inheritance
 * sits, so a newcomer reads it first. A sheet named *Context*, laid by
 * whoever links the first canvas, at the canvas's origin when the origin is
 * clear and otherwise to the left of everything, level with the top — a
 * region beside the work, never over it, the same rule `area new` keeps.
 * One title, one place both surfaces look for it, and a convention rather
 * than a kind: any sheet somebody names Context is the Context sheet.
 */
export const CONTEXT_SHEET_TITLE = "Context";
/** Room for two cards side by side, and a third below. */
export const CONTEXT_SHEET_SIZE = { width: 1760, height: 1400 };

export function contextSheet(canvas: CanvasContents): Item | null {
  return areasOf(canvas).find((area) => area.title === CONTEXT_SHEET_TITLE) ?? null;
}

export function contextSheetSpot(
  canvas: CanvasContents,
  size: { width: number; height: number } = CONTEXT_SHEET_SIZE,
): { x: number; y: number } {
  const all = Object.values(canvas.items);
  const clear = all.every(
    (item) => item.x >= size.width || item.y >= size.height || item.x + item.width <= 0 || item.y + item.height <= 0,
  );
  if (clear) return { x: 0, y: 0 };
  const left = Math.min(...all.map((item) => item.x)) - PLACEMENT_GAP - size.width;
  const top = Math.min(...all.map((item) => item.y));
  return { x: left, y: top };
}
