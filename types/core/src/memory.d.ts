import type { CanvasContents, Item, ItemVersion } from "./model.js";
import { canvasItemOf } from "./canvasitem.js";
import { type DesignScopeOptions, type DesignSystemSelection } from "./designsystem.js";
import { type ContextExtras, type ContextPiece } from "./context.js";
import type { RecapHeadResponse } from "./recap-head.js";
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
export declare const MEMORY_PROP = "memory";
export declare const MEMORY_INHERIT = "inherit";
/** Phase 2's value — the person's own canvas, read only by their actors. */
export declare const MEMORY_PERSONAL = "personal";
export type MemoryLink = "inherit" | "personal";
/** What a canvas card says about the memory behind it, or nothing. */
export declare function memoryOf(item: Item): MemoryLink | null;
/**
 * The canvases this one inherits from, **in the order the room reads them**:
 * top to bottom, then left to right. Several links compose in that order,
 * so the first design system found governs when this canvas has none.
 * An excluded card or ancestor removes that edge before any source is read.
 */
export declare function memoryLinks(canvas: CanvasContents): Item[];
/** Personal candidates are visible edges, not authority: the home checks concrete consent. */
export declare function personalMemoryLinks(canvas: CanvasContents): Item[];
/** The authorized home reads only these current contributions, never a source's Chat. */
interface PersonalContribution {
    kind: "design" | "pin";
    item: Item;
    version: ItemVersion | null;
}
/** Personal memory contributes its design and ambient pins once, with ancestor exclusions. */
export declare function personalContributions(canvas: CanvasContents): PersonalContribution[];
/** A shared personal card discloses only its owner's label and source address. */
export declare function personalCanvasItemOf(home: string, sourceCanvasId: string, owner: {
    name: string;
}): ReturnType<typeof canvasItemOf> & {
    title: string;
};
/** The patch that sets or clears the link — one spelling for both surfaces,
 *  cleared with `removeProperties` for the reason `markPatch` records. */
export declare function memoryPatch(memory: MemoryLink | null): {
    properties: Record<string, string>;
} | {
    removeProperties: string[];
};
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
    /** Only Context assembly asks for history; a failed head does not discard readable pieces. */
    recap?: {
        value: RecapHeadResponse;
    } | {
        refused: string;
    };
}
interface LayerContents {
    heading: string;
    pieces: ContextPiece[];
    /** Set when the layer could not be read — the heading stands, with why. */
    refused?: string;
}
/** Layer identity distinguishes personal owner provenance from inherited design authority. */
export type ContextLayer = LayerContents & ({
    kind: "local";
    canvasId: null;
} | {
    kind: "inherited";
    canvasId: string;
    itemId: string;
} | {
    kind: "personal";
    canvasId: string;
    itemId: string;
    owner: {
        id: string;
        name: string;
    } | null;
});
/**
 * What a linked canvas contributes: its design system, its pins, its size.
 * `localHasDesign` is the override rule — when this canvas has its own, the
 * inherited one is listed struck, with *this canvas's wins* beside it.
 */
export declare function inheritedPieces(linked: CanvasContents, from: {
    canvasId: string;
    title: string;
}, localHasDesign: boolean, recap?: LinkedCanvas["recap"]): ContextPiece[];
/**
 * The Context view in layers: this canvas first, then one heading per linked
 * canvas in reading order. `contextPieces` is unchanged underneath — the
 * first layer is exactly what the view showed before there were layers.
 */
export declare function contextLayers(canvas: CanvasContents, linked: LinkedCanvas[], extras?: ContextExtras, nowMs?: number): ContextLayer[];
/**
 * The design system that governs here: the area's own when `at` names a place
 * in one (scoped design systems, 11 Sep 2026), else this canvas's own, else
 * the first a linked canvas contributes, in reading order — **area → canvas →
 * linked**. `design check` on a canvas with none of its own checks against the
 * inherited one, and says whose.
 */
export declare function governingDesign(canvas: CanvasContents, linked: LinkedCanvas[], opts?: DesignScopeOptions): {
    item: Item;
    from: {
        canvasId: string;
        title: string;
    } | null;
} | null;
/** Inherited candidates retain their source and refused predecessors; exemption never hides an incumbent. */
export interface GoverningDesignSelection extends Omit<DesignSystemSelection, "level"> {
    level: DesignSystemSelection["level"] | "inherited";
    from: {
        canvasId: string;
        title: string;
    } | null;
    exempt: boolean;
    refusedSources: Array<{
        canvasId: string;
        itemId: string;
        reason: string;
    }>;
}
/** One ordered governing selection supports creation, checking and standing without merging distinct documents. */
export declare function selectGoverningDesign(canvas: CanvasContents, linked: LinkedCanvas[], opts?: DesignScopeOptions & {
    project?: {
        properties?: Record<string, string>;
    };
}): GoverningDesignSelection;
/** The layers as a terminal prints them: a heading per source, the pieces
 *  under it the way `contextReport` prints them, and a refusal in words. */
export declare function layersReport(layers: ContextLayer[], report: (pieces: ContextPiece[]) => string): string;
/** A visible link's identity distinguishes repeated sources and private/inherited headings. */
export declare function contextLayerKey(layer: ContextLayer): string;
/** The canvas a card links, when it is a memory link — for a reader that
 *  walks a canvas's cards deciding what to fetch. */
export declare function linkedCanvasId(item: Item): string | null;
/**
 * **The Context sheet** (phase 3): the corner where a canvas's inheritance
 * sits, so a newcomer reads it first. A sheet named *Context*, laid by
 * whoever links the first canvas, at the canvas's origin when the origin is
 * clear and otherwise to the left of everything, level with the top — a
 * region beside the work, never over it, the same rule `area new` keeps.
 * One title, one place both surfaces look for it, and a convention rather
 * than a kind: any sheet somebody names Context is the Context sheet.
 */
export declare const CONTEXT_SHEET_TITLE = "Context";
/** Room for two cards side by side, and a third below. */
export declare const CONTEXT_SHEET_SIZE: {
    width: number;
    height: number;
};
export declare function contextSheet(canvas: CanvasContents): Item | null;
export declare function contextSheetSpot(canvas: CanvasContents, size?: {
    width: number;
    height: number;
}): {
    x: number;
    y: number;
};
export {};
