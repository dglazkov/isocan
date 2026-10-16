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
import type { CanvasContents } from "./model.ts";
import { nearestFreeSpot, PLACEMENT_GAP } from "./placement.ts";

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
/** The per-run cap (design §2): twelve images, the way critique caps a critic per run. */
export const MOOD_MAX_N = 12;

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

/** The properties a tile carries (design §1). Not namespaced: the design names them, and the mood board owns them. */
export const MOOD_PROPS = {
  mood: "mood",
  prompt: "moodPrompt",
  axis: "moodAxis",
  parent: "moodParent",
  model: "moodModel",
  run: "moodRun",
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
