import type { Actor, CanvasContents, Item } from "./model.js";
import type { Operation } from "./ops.js";
/** The route's path. */
export declare const IMAGE_ROUTE = "/api/image";
/** The body is malformed: no canvas, no words, `n` out of range, an actor missing. */
export declare const IMAGE_BAD_REQUEST = "image-bad-request";
/** The machine's person's own Gemini key, asked for by somebody else with sharing off. */
export declare const IMAGE_OWNER_ONLY = "image-owner-only";
/** This home holds no Gemini key. */
export declare const IMAGE_UNAVAILABLE = "image-unavailable";
/** The badge asked for enough images this minute. */
export declare const IMAGE_RATE_LIMITED = "image-rate-limited";
/** The words name something the template refuses (`deniedIn`), before any spend. */
export declare const IMAGE_REFUSED = "image-refused";
/** Google refused, failed, or answered with no picture — its words, never the key. */
export declare const IMAGE_UPSTREAM = "image-upstream";
/** Nine tiles a spread (design §8, Dion 16 Oct 2026). */
export declare const MOOD_DEFAULT_N = 9;
/** Four tiles for More like this / Push (journey Scene 1). */
export declare const MOOD_MORE_N = 4;
/** The per-run cap (design §2): twelve images, the way critique caps a critic per run. */
export declare const MOOD_MAX_N = 12;
/** The Mood board's title when created on first Keep. */
export declare const MOOD_BOARD_TITLE: "Mood";
/** Minimal card bytes for a new Mood board (the server refuses empty blobs). */
export declare const MOOD_BOARD_BYTES = "\n";
/** The eight Push dials (design §3, journey Scene 1). */
export declare const MOOD_DIALS: readonly ["warmer", "cooler", "quieter", "louder", "older", "newer", "rougher", "finer"];
export type MoodDial = (typeof MOOD_DIALS)[number];
export declare function isMoodDial(value: unknown): value is MoodDial;
/**
 * **The image model, and what one picture costs — the one place both are
 * written.** Read from Google's own pages on 16 Oct 2026:
 *
 * - the model list, https://ai.google.dev/gemini-api/docs/models (updated
 *   2026-10-13): `gemini-nano-banana-2.1`, "Nano Banana 2.1", Stable — the
 *   Flash-tier workhorse the image-generation guide uses in every example
 *   (https://ai.google.dev/gemini-api/docs/image-generation);
 * - the price list, https://ai.google.dev/gemini-api/docs/pricing (updated
 *   2026-10-15): paid tier, $30 per 1M image output tokens, 1120 tokens per
 *   1K (1024×1024) image — **$0.0336 an image**.
 *
 * Dion decided Flash by default (§8); Pro (`gemini-3-pro-image`, $0.134 a 1K
 * image on the same page) is for *Redraw in Pro*, a later phase. The id is
 * configuration — `ISOCAN_IMAGE_MODEL` wins — because Google's naming moves.
 */
export declare const IMAGE_MODEL_DEFAULT = "gemini-nano-banana-2.1";
/** The model a run draws with: `ISOCAN_IMAGE_MODEL` when set, else the default. */
export declare function imageModel(env?: Readonly<Record<string, string | undefined>>): string;
/**
 * **"9 images ≈ $0.30"** — what a run will cost, said before it is spent
 * (design §2). A model this build has no price for says so rather than
 * guessing.
 */
export declare function moodCostLine(n: number, model: string): string;
/**
 * **The axes a spread reaches along** (design §3): what each tile's
 * `moodAxis` records. `reach` is the phrase the template asks for; `axis` is
 * the short line shown under the tile.
 */
export declare const MOOD_AXES: readonly {
    axis: string;
    reach: string;
}[];
/** `n` axes for one spread: every axis once before any twice, in order. */
export declare function spreadAxes(n: number): {
    axis: string;
    reach: string;
}[];
/**
 * **The template: a feeling, not a screen** (design §3). The person's words
 * go in the middle; the not-UI clause and the refusals are never left out,
 * because the model's pull toward drawing an app screen is strong.
 */
export declare function moodPrompt(words: string, reach: string): string;
/**
 * **A Push variation's prompt** (design §3, journey Scene 1): keeps the
 * original subject words, adds the named dial's concrete material and lighting
 * direction, and preserves the non-UI / safety clauses.
 */
export declare function moodPushPrompt(words: string, dial: MoodDial, reach: string): string;
/**
 * Extract the person's original subject words from a saved `moodPrompt` (either
 * `moodPrompt` or `moodPushPrompt`), falling back to the raw string or the
 * item's title when the tile came from a dropped reference image.
 */
export declare function moodWordsFromPrompt(prompt: string | undefined, fallbackTitle?: string): string;
/** The refusal sentence for words the deny-list catches, or null. */
export declare function deniedIn(words: string): string | null;
/** The properties a tile or Mood board carries (design §1). Not namespaced: the design names them, and the mood board owns them. */
export declare const MOOD_PROPS: {
    readonly mood: "mood";
    readonly prompt: "moodPrompt";
    readonly axis: "moodAxis";
    readonly parent: "moodParent";
    readonly model: "moodModel";
    readonly run: "moodRun";
    readonly board: "moodBoard";
};
/** `POST /api/image`'s body. `prompt` is the person's own words; the template is the home's. */
export interface ImageRequest {
    canvasId: string;
    /** Who the tiles are added as — a claim on the asking badge, as `/api/ops` asks. */
    actor: {
        id: string;
        name: string;
    };
    prompt: string;
    /** Default `MOOD_DEFAULT_N`, at most `MOOD_MAX_N`. */
    n?: number;
    /** An image item whose picture goes in beside the words (More like this). */
    parent?: string;
    /** A Push dial (warmer, cooler, quieter, louder, older, newer, rougher, finer). */
    push?: MoodDial;
}
/** `POST /api/image`'s answer: the tiles added, in spread order, and the run they share. */
export interface ImageResponse {
    run: string;
    model: string;
    group: string;
    items: {
        itemId: string;
        axis: string;
    }[];
    /** Tiles the model would not draw, with its own words. */
    refused: {
        axis: string;
        why: string;
    }[];
}
/** A tile's footprint on the canvas. */
export declare const MOOD_TILE: {
    readonly width: 320;
    readonly height: 320;
};
/**
 * **Where a tray goes** — `n` tiles in rows of three, as one block to the
 * right of everything on the canvas, top-aligned with it, nudged clear by
 * core's free-spot search so both surfaces would put it in the same place.
 * Each answer is a tile's top-left, sent unchosen: the spots are clear of
 * everything and of each other by more than the reducer's clearance, so its
 * own free-spot pass leaves them where they are — and should somebody's
 * write land in the tray's way mid-run, it moves that tile rather than
 * stacking it on theirs.
 */
export declare function moodTray(canvas: CanvasContents, n: number, tile?: {
    width: number;
    height: number;
}): {
    x: number;
    y: number;
}[];
/** Whether `item` is the Mood board area/group (`properties.moodBoard === "true"`). */
export declare function isMoodBoardItem(item: Item): boolean;
/** The canvas's Mood board, if one already exists. */
export declare function findMoodBoard(canvas: CanvasContents): Item | null;
export interface MoodBoardBlob {
    blobHash: string;
    size: number;
    mimeType?: string;
    filename?: string;
}
/**
 * **Keep tiles into the Mood board, as ops** — creates the Mood board on first
 * Keep (`properties.moodBoard = "true"`), moves each kept tile into it, and
 * marks `properties.mood = "kept"`. Works on both legacy (`kind = "area"` +
 * `freeSpotIn`) and group-mode (`group.change` `{ kind: "create" }` /
 * `{ kind: "reparent" }`) canvases, so the CLI and the web tray share one plan
 * and one undo group.
 */
export declare function moodKeepPlan(input: {
    canvas: CanvasContents;
    groupMode: "legacy" | "groups";
    itemIds: readonly string[];
    boardBlob?: MoodBoardBlob;
    newBoardId?: string;
}): {
    boardId: string;
    createdBoard: boolean;
    ops: Operation[];
};
/**
 * **Drop candidate tiles to the trash, as ops** — either named tiles, or every
 * remaining `mood: "candidate"` tile in a run (`--run <run>` / Close tray).
 */
export declare function moodDropOps(canvas: CanvasContents, opts: {
    itemIds?: readonly string[];
    run?: string;
}): {
    droppedIds: string[];
    ops: Operation[];
};
/** One active candidate tray on the canvas (`moodRun` with at least one `mood: "candidate"` tile). */
interface MoodTrayRun {
    run: string;
    words: string;
    candidates: Item[];
    kept: Item[];
    createdAt: string;
    createdBy: Actor;
    box: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}
/** Active candidate trays on the canvas, oldest first. */
export declare function moodTrays(canvas: CanvasContents): MoodTrayRun[];
export {};
