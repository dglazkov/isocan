/**
 * **The mood board's shared vocabulary** — `POST /api/image`'s path, body and
 * refusal codes, the prompt template, the axes a spread reaches along, the
 * deny-list a request is checked against before anything is spent, the image
 * model's default id and price, and where a tray of tiles goes
 * (`docs/projects/moodboard/design.md` §1–§3, §6; moodboard phase 0).
 *
 * Pure, and a subpath of its own (`@isocan/core/mood`), never the barrel: the
 * server's route and the CLI's `isocan mood explore` both read it, the web
 * does not yet, and nothing here belongs in a first visit.
 */
import { annotationsOf } from "./annotation.ts";
import { AREA_FILENAME, AREA_MIME, AREA_PROPERTIES, freeSpotIn, inArea } from "./area.ts";
import { isGroupItem } from "./canvas-group-kit.ts";
import { newItemId, newVersionId } from "./ids.ts";
import type { Actor, CanvasContents, Item } from "./model.ts";
import type { Operation } from "./ops.ts";
import { nearestFreeSpot, PLACEMENT_GAP } from "./placement.ts";
import { spokenColour, type SpokenColour } from "./colour.ts";
import {
  deltaE,
  formatMoodSwatches,
  parseMoodSwatches,
  rgbToLab,
  type MoodSwatch,
} from "./mood-swatches.ts";

export {
  deltaE,
  formatMoodSwatches,
  IMAGE_SWATCHES_UNAVAILABLE,
  parseMoodSwatches,
  rgbToLab,
  SWATCHES_ROUTE,
  swatchesFromRgba,
  type MoodSwatch,
  type SwatchesRequest,
  type SwatchesResponse,
} from "./mood-swatches.ts";

/** The route's path. */
export const IMAGE_ROUTE = "/api/image";

/** The body is malformed: no canvas, no words, `n` out of range, an actor missing. */
export const IMAGE_BAD_REQUEST = "image-bad-request";
/** The machine's person's own Gemini key, asked for by somebody else with sharing off. */
export const IMAGE_OWNER_ONLY = "image-owner-only";
/** This home holds no Gemini key. */
export const IMAGE_UNAVAILABLE = "image-unavailable";
/** The badge asked for enough images this minute. */
export const IMAGE_RATE_LIMITED = "image-rate-limited";
/** The words name something the template refuses (`deniedIn`), before any spend. */
export const IMAGE_REFUSED = "image-refused";
/** Google refused, failed, or answered with no picture — its words, never the key. */
export const IMAGE_UPSTREAM = "image-upstream";

/** Nine tiles a spread (design §8, Dion 16 Oct 2026). */
export const MOOD_DEFAULT_N = 9;
/** Four tiles for More like this / Push (journey Scene 1). */
export const MOOD_MORE_N = 4;
/** The per-run cap (design §2): twelve images, the way critique caps a critic per run. */
export const MOOD_MAX_N = 12;
/** The Mood board's title when created on first Keep. */
export const MOOD_BOARD_TITLE = "Mood" as const;
/** Default size of a newly created Mood board. */
const MOOD_BOARD_SIZE = { width: 1200, height: 840 } as const;
/** Minimal card bytes for a new Mood board (the server refuses empty blobs). */
export const MOOD_BOARD_BYTES = "\n";

/** The eight Push dials (design §3, journey Scene 1). */
export const MOOD_DIALS = [
  "warmer",
  "cooler",
  "quieter",
  "louder",
  "older",
  "newer",
  "rougher",
  "finer",
] as const;
export type MoodDial = (typeof MOOD_DIALS)[number];

export function isMoodDial(value: unknown): value is MoodDial {
  return typeof value === "string" && (MOOD_DIALS as readonly string[]).includes(value);
}

const MOOD_DIAL_REACH: Readonly<Record<MoodDial, string>> = {
  warmer: "warmer light, sunlit amber, terracotta, brass, and sun-baked natural surfaces",
  cooler: "cooler north light, slate, mist, steel blue, brushed aluminium, and crisp mineral surfaces",
  quieter: "quieter space, generous calm, muted contrast, soft matte tones, and sparse composition",
  louder: "louder colour, bold saturation, sharp tonal contrast, assertive rhythm, and vivid focal shapes",
  older: "older craft, patinated heritage materials, worn linen, letterpress grain, and lived-in history",
  newer: "newer precision, crisp contemporary edges, fresh technical materials, and clean modern geometry",
  rougher: "rougher texture, coarse stone, unbleached fibre, visible tool marks, and weathered grain",
  finer: "finer finish, smooth paper grain, delicate hairline detail, polished craft, and close precision",
};

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
export const IMAGE_MODEL_DEFAULT = "gemini-nano-banana-2.1";

/** US dollars per 1K image, by model id, from the pricing page above. A model not listed has no price this build knows. */
const IMAGE_PRICE_USD: Readonly<Record<string, number>> = {
  "gemini-nano-banana-2.1": 0.0336,
  "gemini-3.1-flash-image": 0.067,
  "gemini-3.1-flash-lite-image": 0.0336,
  "gemini-3-pro-image": 0.134,
};

/** The model a run draws with: `ISOCAN_IMAGE_MODEL` when set, else the default. */
export function imageModel(env: Readonly<Record<string, string | undefined>> = {}): string {
  return env.ISOCAN_IMAGE_MODEL?.trim() || IMAGE_MODEL_DEFAULT;
}

/**
 * **"9 images ≈ $0.30"** — what a run will cost, said before it is spent
 * (design §2). A model this build has no price for says so rather than
 * guessing.
 */
export function moodCostLine(n: number, model: string): string {
  const each = IMAGE_PRICE_USD[model];
  const images = `${n} image${n === 1 ? "" : "s"}`;
  if (each === undefined) return `${images} with ${model} — this build has no price for that model`;
  return `${images} ≈ $${(each * n).toFixed(2)} (${model}, $${each} each)`;
}

/**
 * **The axes a spread reaches along** (design §3): what each tile's
 * `moodAxis` records. `reach` is the phrase the template asks for; `axis` is
 * the short line shown under the tile.
 */
export const MOOD_AXES: readonly { axis: string; reach: string }[] = [
  { axis: "light", reach: "the quality of the light" },
  { axis: "material", reach: "the materials it would be made of" },
  { axis: "texture", reach: "texture, seen up close" },
  { axis: "colour field", reach: "a field of colour it would live in" },
  { axis: "era", reach: "the era it belongs to" },
  { axis: "density", reach: "how dense or how sparse it feels" },
  { axis: "place", reach: "the place it lives" },
  { axis: "lettering", reach: "lettering as an object — a sign, a stamp, a label — its character, not a font" },
];

/** `n` axes for one spread: every axis once before any twice, in order. */
export function spreadAxes(n: number): { axis: string; reach: string }[] {
  return Array.from({ length: Math.max(0, n) }, (_, i) => MOOD_AXES[i % MOOD_AXES.length]!);
}

/**
 * **The template: a feeling, not a screen** (design §3). The person's words
 * go in the middle; the not-UI clause and the refusals are never left out,
 * because the model's pull toward drawing an app screen is strong.
 */
export function moodPrompt(words: string, reach: string): string {
  return (
    "An evocative photograph or still life — not a user interface, not a screen, no text overlays — " +
    `about: ${words.trim()}. Reach for ${reach}. Natural light, real materials. ` +
    "No logos, no brands, no recognisable people, nothing in a living artist's style."
  );
}

/**
 * **A Push variation's prompt** (design §3, journey Scene 1): keeps the
 * original subject words, adds the named dial's concrete material and lighting
 * direction, and preserves the non-UI / safety clauses.
 */
export function moodPushPrompt(words: string, dial: MoodDial, reach: string): string {
  return (
    "An evocative photograph or still life — not a user interface, not a screen, no text overlays — " +
    `about: ${words.trim()}. Push the look ${dial}: ${MOOD_DIAL_REACH[dial]}. Reach for ${reach}. ` +
    "Natural light, real materials. " +
    "No logos, no brands, no recognisable people, nothing in a living artist's style."
  );
}

/**
 * Extract the person's original subject words from a saved `moodPrompt` (either
 * `moodPrompt` or `moodPushPrompt`), falling back to the raw string or the
 * item's title when the tile came from a dropped reference image.
 */
export function moodWordsFromPrompt(prompt: string | undefined, fallbackTitle?: string): string {
  if (typeof prompt === "string" && prompt.trim()) {
    const match = /\babout:\s*(.+?)\.\s+(?:Reach for|Push the look)\b/s.exec(prompt);
    if (match?.[1]?.trim()) return match[1].trim();
    return prompt.trim();
  }
  const cleaned = (fallbackTitle ?? "").replace(/\s+—\s+[^—]+$/, "").trim();
  return cleaned || "reference study";
}

/**
 * **What a typed request is refused for, before any spend** (design §6).
 *
 * A short deny-list, and its limits are the point of saying so: it catches
 * the obvious spellings of a handful of living artists, brands, logos and
 * famous people, and nothing it does not list. It is a courtesy that keeps an
 * honest request from paying for a refusal — not the policy. The template's
 * last sentence, and the model's own refusals (passed through verbatim), are
 * what actually hold. A word with an innocent sense ("apple", "target",
 * "shell") is left off on purpose, because refusing "an apple orchard" would
 * teach a person the list is noise.
 */
const DENIED: readonly { pattern: RegExp; what: string }[] = [
  { pattern: /\blogos?\b|\btrademarks?\b|\bwordmarks?\b/i, what: "a logo" },
  { pattern: /\bin the style of\b|\bstyle of [A-Z]/, what: "an artist's style" },
  { pattern: /\b(banksy|kusama|hockney|koons|murakami|kaws|damien hirst|gerhard richter|leibovitz|ai weiwei|olafur eliasson|james turrell)\b/i, what: "a living artist" },
  { pattern: /\b(nike|adidas|coca[- ]?cola|pepsi|starbucks|mcdonald'?s|disney|pixar|marvel|lego|ikea|gucci|chanel|louis vuitton|airbnb|spotify|netflix|google|microsoft|instagram|tiktok)\b/i, what: "a brand" },
  { pattern: /\b(taylor swift|beyonc[eé]|elon musk|obama|trump|kim kardashian|oprah|zendaya|rihanna|king charles|pope francis)\b/i, what: "a real person" },
  { pattern: /\b(face|portrait|photo) of (a )?(real|famous|celebrity)\b/i, what: "a real person" },
];

/** The refusal sentence for words the deny-list catches, or null. */
export function deniedIn(words: string): string | null {
  for (const { pattern, what } of DENIED) {
    const hit = pattern.exec(words);
    if (hit) return `a mood board reaches for a feeling, not ${what} — "${hit[0]}" is refused before anything is spent; describe what it feels like instead`;
  }
  return null;
}

/** The properties a tile or Mood board carries (design §1). Not namespaced: the design names them, and the mood board owns them. */
export const MOOD_PROPS = {
  mood: "mood",
  prompt: "moodPrompt",
  axis: "moodAxis",
  parent: "moodParent",
  model: "moodModel",
  swatches: "moodSwatches",
  run: "moodRun",
  board: "moodBoard",
} as const;

/** `POST /api/image`'s body. `prompt` is the person's own words; the template is the home's. */
export interface ImageRequest {
  canvasId: string;
  /** Who the tiles are added as — a claim on the asking badge, as `/api/ops` asks. */
  actor: { id: string; name: string };
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
  items: { itemId: string; axis: string }[];
  /** Tiles the model would not draw, with its own words. */
  refused: { axis: string; why: string }[];
}

/** A tile's footprint on the canvas. */
export const MOOD_TILE = { width: 320, height: 320 } as const;
/** Tiles to a row in a tray. */
const TRAY_COLUMNS = 3;

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
export function moodTray(canvas: CanvasContents, n: number, tile: { width: number; height: number } = MOOD_TILE): { x: number; y: number }[] {
  const items = Object.values(canvas.items);
  const cols = Math.min(TRAY_COLUMNS, Math.max(1, n));
  const rows = Math.ceil(n / cols);
  const block = { width: cols * tile.width + (cols - 1) * PLACEMENT_GAP, height: rows * tile.height + (rows - 1) * PLACEMENT_GAP };
  const right = items.length ? Math.max(...items.map((i) => i.x + i.width)) + PLACEMENT_GAP * 2 : 0;
  const top = items.length ? Math.min(...items.map((i) => i.y)) : 0;
  const at = items.length ? nearestFreeSpot({ x: right, y: top, ...block }, items) : { x: 0, y: 0 };
  return Array.from({ length: n }, (_, i) => ({
    x: at.x + (i % cols) * (tile.width + PLACEMENT_GAP),
    y: at.y + Math.floor(i / cols) * (tile.height + PLACEMENT_GAP),
  }));
}

/** Whether `item` is the Mood board area/group (`properties.moodBoard === "true"`). */
export function isMoodBoardItem(item: Item): boolean {
  return item.properties[MOOD_PROPS.board] === "true" && (item.properties.kind === "area" || isGroupItem(item));
}

/** The canvas's Mood board, if one already exists. */
export function findMoodBoard(canvas: CanvasContents): Item | null {
  const matches = Object.values(canvas.items).filter(isMoodBoardItem);
  if (matches.length === 0) return null;
  return matches.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))[0]!;
}

/** Where a new Mood board is placed: to the right of existing content, top-aligned. */
function moodBoardOrigin(canvas: CanvasContents): { x: number; y: number } {
  const items = Object.values(canvas.items);
  if (items.length === 0) return { x: 0, y: 0 };
  const right = Math.max(...items.map((i) => i.x + i.width));
  const top = Math.min(...items.map((i) => i.y));
  return { x: Math.round(right + PLACEMENT_GAP * 2), y: Math.round(top) };
}

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
export function moodKeepPlan(input: {
  canvas: CanvasContents;
  groupMode: "legacy" | "groups";
  itemIds: readonly string[];
  boardBlob?: MoodBoardBlob;
  newBoardId?: string;
  swatchesByItem?: Readonly<Record<string, readonly MoodSwatch[]>>;
}): { boardId: string; createdBoard: boolean; ops: Operation[] } {
  const uniqueIds = [...new Set(input.itemIds)];
  const items = uniqueIds.map((id) => input.canvas.items[id]).filter((item): item is Item => item !== undefined);
  if (items.length === 0) throw new Error("mood keep needs at least one live item on the canvas");
  const keepProps = (itemId: string): Record<string, string> => {
    const swatches = input.swatchesByItem?.[itemId];
    return {
      [MOOD_PROPS.mood]: "kept",
      ...(swatches && swatches.length > 0 ? { [MOOD_PROPS.swatches]: formatMoodSwatches(swatches) } : {}),
    };
  };
  const existing = findMoodBoard(input.canvas);
  const createdBoard = existing === null;
  const boardId = existing?.id ?? input.newBoardId ?? newItemId();
  if (createdBoard && !input.boardBlob) {
    throw new Error("moodKeepPlan needs boardBlob when creating the Mood board");
  }
  const blob = input.boardBlob
    ? {
        blobHash: input.boardBlob.blobHash,
        size: input.boardBlob.size,
        mimeType: input.boardBlob.mimeType ?? AREA_MIME,
        filename: input.boardBlob.filename ?? (input.groupMode === "groups" ? "group.md" : AREA_FILENAME),
      }
    : null;
  const ops: Operation[] = [];

  if (input.groupMode === "groups") {
    if (createdBoard && blob) {
      const at = moodBoardOrigin(input.canvas);
      ops.push({
        type: "group.change",
        action: {
          kind: "create",
          group: {
            id: boardId,
            title: MOOD_BOARD_TITLE,
            description: "",
            version: { id: newVersionId(), ...blob },
            box: { ...at, ...MOOD_BOARD_SIZE },
            layout: { briefHeight: 0 },
            properties: { [MOOD_PROPS.board]: "true" },
          },
          containerId: null,
        },
      });
    }
    const toMove = items.filter((item) => item.containerId !== boardId).map((item) => item.id);
    if (toMove.length > 0) {
      ops.push({
        type: "group.change",
        action: {
          kind: "reparent",
          containerId: boardId,
          itemIds: toMove,
          place: true,
        },
      });
    }
    for (const item of items) {
      ops.push({
        type: "item.update",
        itemId: item.id,
        patch: { properties: keepProps(item.id) },
      });
    }
    return { boardId, createdBoard, ops };
  }

  // Legacy canvas (`kind = "area"`).
  const working: CanvasContents = { ...input.canvas, items: { ...input.canvas.items } };
  let board: Item;
  if (createdBoard && blob) {
    const at = moodBoardOrigin(working);
    const verId = newVersionId();
    ops.push({
      type: "item.add",
      itemId: boardId,
      version: { id: verId, ...blob },
      width: MOOD_BOARD_SIZE.width,
      height: MOOD_BOARD_SIZE.height,
      placement: { ...at, chosen: true },
      title: MOOD_BOARD_TITLE,
      properties: { ...AREA_PROPERTIES, [MOOD_PROPS.board]: "true" },
    });
    const now = new Date(0).toISOString();
    const who = items[0]!.createdBy;
    board = {
      id: boardId,
      title: MOOD_BOARD_TITLE,
      description: "",
      x: at.x,
      y: at.y,
      width: MOOD_BOARD_SIZE.width,
      height: MOOD_BOARD_SIZE.height,
      properties: { ...AREA_PROPERTIES, [MOOD_PROPS.board]: "true" },
      versions: [{ id: verId, ...blob, createdAt: now, createdBy: who }],
      currentVersionId: verId,
      createdAt: now,
      createdBy: who,
      updatedAt: now,
      updatedBy: who,
    };
    working.items[boardId] = board;
  } else {
    board = existing!;
  }

  for (const item of items) {
    const without: CanvasContents = { ...working, items: { ...working.items } };
    delete without.items[item.id];
    const spot = freeSpotIn(without, board, item.width, item.height);
    if (spot.shifts && spot.shifts.length > 0) {
      ops.push({ type: "items.move", moves: spot.shifts });
      for (const shift of spot.shifts) {
        const shifted = working.items[shift.itemId];
        if (shifted) working.items[shift.itemId] = { ...shifted, x: shift.x, y: shift.y };
      }
    }
    if (spot.resizedArea) {
      ops.push({
        type: "item.resize",
        itemId: boardId,
        width: spot.resizedArea.width,
        height: spot.resizedArea.height,
      });
      board = { ...board, width: spot.resizedArea.width, height: spot.resizedArea.height };
      working.items[boardId] = board;
    }
    const dx = spot.x - item.x;
    const dy = spot.y - item.y;
    if (dx !== 0 || dy !== 0) {
      const marks = annotationsOf(working, item.id);
      const moves = [
        { itemId: item.id, x: spot.x, y: spot.y },
        ...marks.map((mark) => ({ itemId: mark.id, x: mark.x + dx, y: mark.y + dy })),
      ];
      ops.push(moves.length === 1 ? { type: "item.move", ...moves[0]! } : { type: "items.move", moves });
      working.items[item.id] = { ...item, x: spot.x, y: spot.y };
      for (const mark of marks) {
        working.items[mark.id] = { ...mark, x: mark.x + dx, y: mark.y + dy };
      }
    }
    ops.push({
      type: "item.update",
      itemId: item.id,
      patch: { properties: keepProps(item.id) },
    });
  }

  return { boardId, createdBoard, ops };
}

/**
 * **Drop candidate tiles to the trash, as ops** — either named tiles, or every
 * remaining `mood: "candidate"` tile in a run (`--run <run>` / Close tray).
 */
export function moodDropOps(
  canvas: CanvasContents,
  opts: { itemIds?: readonly string[]; run?: string },
): { droppedIds: string[]; ops: Operation[] } {
  const fromRun = opts.run
    ? Object.values(canvas.items)
        .filter((item) => item.properties[MOOD_PROPS.run] === opts.run && item.properties[MOOD_PROPS.mood] === "candidate")
        .map((item) => item.id)
    : [];
  const named = (opts.itemIds ?? []).filter((id) => canvas.items[id] !== undefined);
  const droppedIds = [...new Set([...named, ...fromRun])];
  if (droppedIds.length === 0) return { droppedIds: [], ops: [] };
  const ops: Operation[] =
    droppedIds.length === 1
      ? [{ type: "item.delete", itemId: droppedIds[0]! }]
      : [{ type: "items.delete", itemIds: droppedIds }];
  return { droppedIds, ops };
}

/** One active candidate tray on the canvas (`moodRun` with at least one `mood: "candidate"` tile). */
interface MoodTrayRun {
  run: string;
  words: string;
  candidates: Item[];
  kept: Item[];
  createdAt: string;
  createdBy: Actor;
  box: { x: number; y: number; width: number; height: number };
}

/** Active candidate trays on the canvas, oldest first. */
export function moodTrays(canvas: CanvasContents): MoodTrayRun[] {
  const byRun = new Map<string, { candidates: Item[]; kept: Item[] }>();
  for (const item of Object.values(canvas.items)) {
    const run = item.properties[MOOD_PROPS.run];
    if (!run) continue;
    let bucket = byRun.get(run);
    if (!bucket) {
      bucket = { candidates: [], kept: [] };
      byRun.set(run, bucket);
    }
    if (item.properties[MOOD_PROPS.mood] === "candidate") bucket.candidates.push(item);
    else if (item.properties[MOOD_PROPS.mood] === "kept") bucket.kept.push(item);
  }
  const order = (a: Item, b: Item) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id);
  const trays: MoodTrayRun[] = [];
  for (const [run, { candidates, kept }] of byRun.entries()) {
    if (candidates.length === 0) continue;
    candidates.sort(order);
    kept.sort(order);
    const first = candidates[0]!;
    const minX = Math.min(...candidates.map((i) => i.x));
    const minY = Math.min(...candidates.map((i) => i.y));
    const maxX = Math.max(...candidates.map((i) => i.x + i.width));
    const maxY = Math.max(...candidates.map((i) => i.y + i.height));
    trays.push({
      run,
      words: moodWordsFromPrompt(first.properties[MOOD_PROPS.prompt], first.title),
      candidates,
      kept,
      createdAt: first.createdAt,
      createdBy: first.createdBy,
      box: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
    });
  }
  return trays.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.run.localeCompare(b.run));
}

/** One kept or reference tile on the Mood board, ready for `/design-system` or `isocan mood board`. */
export interface MoodBoardTile {
  itemId: string;
  title: string;
  mood: "kept" | "reference";
  axis: string | null;
  prompt: string | null;
  words: string;
  swatches: MoodSwatch[];
}

/** Snapshot of the canvas's Mood board (`moodBoardRead`). */
export interface MoodBoardRead {
  boardId: string | null;
  words: string[];
  tiles: MoodBoardTile[];
}

/**
 * **Read the canvas's Mood board** (`isocan mood board --json`, design §5) —
 * returns the board's `itemId`, every `kept` or `reference` tile on it in
 * reading order (top-to-bottom, left-to-right), each tile's swatches and
 * provenance, and the distinct subject `words` across kept tiles.
 */
export function moodBoardRead(
  canvas: CanvasContents,
  groupMode: "legacy" | "groups" = "legacy",
): MoodBoardRead {
  const board = findMoodBoard(canvas);
  if (!board) return { boardId: null, words: [], tiles: [] };
  const inGroup = groupMode === "groups" || isGroupItem(board);
  const onBoard = (item: Item): boolean => {
    if (item.id === board.id) return false;
    const mood = item.properties[MOOD_PROPS.mood];
    if (mood !== "kept" && mood !== "reference") return false;
    return inGroup ? item.containerId === board.id : inArea(board, item);
  };
  const items = Object.values(canvas.items)
    .filter(onBoard)
    .sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
  const tiles: MoodBoardTile[] = items.map((item) => ({
    itemId: item.id,
    title: item.title,
    mood: item.properties[MOOD_PROPS.mood] as "kept" | "reference",
    axis: item.properties[MOOD_PROPS.axis] ?? null,
    prompt: item.properties[MOOD_PROPS.prompt] ?? null,
    words: moodWordsFromPrompt(item.properties[MOOD_PROPS.prompt], item.title),
    swatches: parseMoodSwatches(item.properties[MOOD_PROPS.swatches]),
  }));
  const words: string[] = [];
  for (const tile of tiles) {
    if (tile.mood !== "kept" || !tile.words) continue;
    if (!words.includes(tile.words)) words.push(tile.words);
  }
  return { boardId: board.id, words, tiles };
}

/** A `board` critic draft built from the Mood board's kept tiles (`boardCriticDraft`). */
export interface BoardCriticDraft {
  name: "board";
  agentName: "Board";
  credit: string;
  color: string;
  line: string;
  lens: {
    questions: string[];
    looksFor: string;
    ranks: string;
  };
}

/** Maximum number of tiles listed verbatim on a `Board` critic card so it stays under the enrolment cap. */
const BOARD_CARD_MAX_TILES = 20;

/**
 * **The Mood board as a critic** (moodboard phase 4, design §5) — builds the
 * `board` critic card draft (`agentName: "Board"`) from the canvas's kept and
 * reference tiles and their swatches, or `null` when no tile sits on the Mood
 * board yet.
 */
export function boardCriticDraft(
  canvas: CanvasContents,
  groupMode: "legacy" | "groups" = "legacy",
): BoardCriticDraft | null {
  const board = moodBoardRead(canvas, groupMode);
  if (!board.boardId || board.tiles.length === 0) return null;
  const firstSwatch = board.tiles.flatMap((t) => t.swatches)[0]?.hex;
  const color = firstSwatch && /^#[0-9a-fA-F]{6}$/.test(firstSwatch) ? firstSwatch.toLowerCase() : "#b5651d";
  const shown = board.tiles.slice(0, BOARD_CARD_MAX_TILES);
  const tileLines = shown.map((tile) => {
    const meta = [tile.axis, tile.words].filter(Boolean).join(", ");
    const swatches = tile.swatches.length
      ? tile.swatches.map((s) => `${s.hex} (${Math.round(s.share * 100)}%)`).join(", ")
      : "no swatches yet";
    return `- "${tile.title}"${meta ? ` (${meta})` : ""}: ${swatches}`;
  });
  if (board.tiles.length > shown.length) {
    tileLines.push(`- …and ${board.tiles.length - shown.length} more tile(s) on the Mood board`);
  }
  const looksFor = [
    ...tileLines,
    "",
    "Every background, border, text, and button colour on the screen, compared against the swatches on the Mood board; any colour further than ΔE 18 from every kept swatch must name which tile justified it or be flagged as off-board. Every material, surface finish, typographic tone, and spacing rhythm the kept tiles establish.",
  ].join("\n");
  return {
    name: "board",
    agentName: "Board",
    credit: "from this canvas's kept tiles; original, not affiliated with anyone",
    color,
    line: "Does this screen feel like what was kept on the Mood board?",
    lens: {
      questions: [
        "Does this screen feel like the tiles kept on the Mood board?",
        "Which colours, materials, and proportions come from those tiles, and which came from nowhere on the board?",
        "Where did the screen drift from the warmth, texture, or restraint the kept tiles share?",
      ],
      looksFor,
      ranks:
        "Colours and finishes with no anchor on the Mood board rank first as risks; proportions and spacing that break the kept tiles' mood rank second; kept hues and material cues that land cleanly rank as working.",
    },
  };
}

/** Normalize `#rgb` or `#rrggbb` to lowercase `#rrggbb`, or `null` when invalid. */
function normalizeHexLiteral(raw: string): string | null {
  const clean = raw.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(clean)) return clean;
  if (/^#[0-9a-f]{3}$/.test(clean)) {
    const r = clean[1]!;
    const g = clean[2]!;
    const b = clean[3]!;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return null;
}

/** Distinct `#rgb` / `#rrggbb` literals in `html`, normalized to `#rrggbb`, skipping pure `#ffffff` and `#000000`. */
function extractScreenHexes(html: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const match of html.matchAll(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) {
    const hex = normalizeHexLiteral(match[0]);
    if (!hex || hex === "#ffffff" || hex === "#000000" || seen.has(hex)) continue;
    seen.add(hex);
    out.push(hex);
  }
  return out;
}

/** Closest swatch on the Mood board to `hex`, or `null` when the board has no swatches. */
function nearestBoardSwatch(
  hex: string,
  board: MoodBoardRead,
): { hex: string; tileId: string; tileTitle: string; deltaE: number } | null {
  let best: { hex: string; tileId: string; tileTitle: string; deltaE: number } | null = null;
  for (const tile of board.tiles) {
    for (const swatch of tile.swatches) {
      const swatchHex = normalizeHexLiteral(swatch.hex);
      if (!swatchHex) continue;
      const dist = deltaE(hex, swatchHex);
      if (!best || dist < best.deltaE) {
        best = {
          hex: swatchHex,
          tileId: tile.itemId,
          tileTitle: tile.title,
          deltaE: Math.round(dist * 10) / 10,
        };
      }
    }
  }
  return best;
}

/** A chromatic colour on a screen with no match within ΔE on the Mood board (`findOffBoardColours`). */
export interface OffBoardColour {
  hex: string;
  spoken: SpokenColour | null;
  nearestSwatch: string;
  nearestTileId: string;
  nearestTileTitle: string;
  deltaE: number;
}

/**
 * **Colours on a screen that came from nowhere on the Mood board** — extracts
 * `#rgb` and `#rrggbb` literals from `html` (ignoring pure `#ffffff` and
 * `#000000`), compares each against all swatches on `board.tiles` via CIELAB
 * `deltaE`, and returns every colour whose nearest board swatch is further than
 * `maxDeltaE` (default `18`).
 */
export function findOffBoardColours(
  html: string,
  board: MoodBoardRead,
  maxDeltaE = 18,
): OffBoardColour[] {
  const out: OffBoardColour[] = [];
  for (const hex of extractScreenHexes(html)) {
    const nearest = nearestBoardSwatch(hex, board);
    if (!nearest || nearest.deltaE <= maxDeltaE) continue;
    out.push({
      hex,
      spoken: spokenColour(hex),
      nearestSwatch: nearest.hex,
      nearestTileId: nearest.tileId,
      nearestTileTitle: nearest.tileTitle,
      deltaE: nearest.deltaE,
    });
  }
  return out;
}

/** Deterministic note suggestion comparing a screen's palette against the Mood board (`boardCritiqueNotes`). */
export interface BoardCritiqueSuggestion {
  kind: "working" | "risk";
  question: 1 | 2;
  hex: string;
  spoken: SpokenColour | null;
  tileId: string;
  tileTitle: string;
  deltaE: number;
  text: string;
}

/** CIE L*a*b* chroma (`sqrt(a*² + b*²)`) of a normalized `#rrggbb` string. */
function hexChroma(hex: string): number {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  const [, aStar, bStar] = rgbToLab(r, g, b);
  return Math.hypot(aStar, bStar);
}

/**
 * **Deterministic `Board` critique notes from a screen's HTML** — pairs at most
 * one `working` note for the strongest chromatic swatch match on the Mood board
 * with one `risk` note for every off-board colour (`deltaE > maxDeltaE`), each
 * ending in a concrete move (`Leave it.` or `Replace <off> with <on>.`).
 */
export function boardCritiqueNotes(
  html: string,
  board: MoodBoardRead,
  maxDeltaE = 18,
): BoardCritiqueSuggestion[] {
  const suggestions: BoardCritiqueSuggestion[] = [];
  let bestWorking: BoardCritiqueSuggestion | null = null;
  let bestWorkingChromatic = false;
  let bestWorkingChroma = -1;
  for (const hex of extractScreenHexes(html)) {
    const nearest = nearestBoardSwatch(hex, board);
    if (!nearest) continue;
    const spoken = spokenColour(hex);
    if (nearest.deltaE <= maxDeltaE) {
      const chroma = hexChroma(hex);
      const chromatic = spoken !== null && spoken !== "white" && spoken !== "black" && spoken !== "grey" && chroma >= 18;
      const candidate: BoardCritiqueSuggestion = {
        kind: "working",
        question: 1,
        hex,
        spoken,
        tileId: nearest.tileId,
        tileTitle: nearest.tileTitle,
        deltaE: nearest.deltaE,
        text: `The ${spoken ?? hex} accent (${hex}) comes straight from kept tile "${nearest.tileTitle}" (${nearest.hex}). Leave it.`,
      };
      if (
        !bestWorking ||
        (chromatic && !bestWorkingChromatic) ||
        (chromatic === bestWorkingChromatic &&
          (Math.abs(chroma - bestWorkingChroma) > 4 ? chroma > bestWorkingChroma : nearest.deltaE < bestWorking.deltaE))
      ) {
        bestWorking = candidate;
        bestWorkingChromatic = chromatic;
        bestWorkingChroma = chroma;
      }
      continue;
    }
    suggestions.push({
      kind: "risk",
      question: 2,
      hex,
      spoken,
      tileId: nearest.tileId,
      tileTitle: nearest.tileTitle,
      deltaE: nearest.deltaE,
      text: `The ${spoken ?? hex} (${hex}) is on no tile on the Mood board — nearest is ${nearest.hex} on "${nearest.tileTitle}" (ΔE ${nearest.deltaE}). Replace ${hex} with ${nearest.hex}.`,
    });
  }
  return bestWorking ? [bestWorking, ...suggestions] : suggestions;
}
