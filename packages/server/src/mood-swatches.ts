import type { JsonSchema } from "@isocan/core/jev";
import { ownerOnlySentence, TEXT_OWNER_ONLY } from "@isocan/core/keys";
import {
  IMAGE_SWATCHES_UNAVAILABLE,
  parseMoodSwatches,
  swatchesFromRgba,
  type SwatchesResponse,
} from "@isocan/core/mood";
import { TEXT_RATE_LIMITED } from "@isocan/core/text";
import { pictureToSend } from "./summary-pictures.ts";
import type { TextModel } from "./text.ts";

type Sharp = typeof import("sharp").default;
type ImportSharp = () => Promise<{ default: Sharp }>;

const importSharp: ImportSharp = () => import("sharp");
let installedSharp: Promise<Sharp | null> | undefined;

function loadSharp(load: ImportSharp): Promise<Sharp | null> {
  const attempt = () => load().then((m) => m.default, () => null);
  return load === importSharp ? (installedSharp ??= attempt()) : attempt();
}

const SWATCH_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["swatches"],
  properties: {
    swatches: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["hex", "share"],
        properties: {
          hex: { type: "string" },
          share: { type: "number" },
        },
      },
    },
  },
};

const SWATCH_PROMPT =
  "Look at this image and return up to 6 dominant colour swatches as { hex, share }, " +
  "ordered from largest share to smallest. Each hex must be #rrggbb and share must be a fraction between 0 and 1.";

/**
 * Extract up to six dominant colour swatches for an image blob using `sharp`
 * when installed, falling back to a picture-capable text model (`estimated: true`)
 * or refusing with `503 image-swatches-unavailable`.
 */
export async function extractMoodSwatches(input: {
  bytes: Buffer;
  mimeType: string;
  loadSharpOption?: ImportSharp | undefined;
  textModel: TextModel;
  badgeId: string;
  notTheOwners: () => Promise<{ owner: string | null } | null>;
}): Promise<{ status: number; body: unknown }> {
  const sharp = await loadSharp(input.loadSharpOption ?? importSharp);
  if (sharp) {
    try {
      const { data, info } = await sharp(input.bytes, { limitInputPixels: 100_000_000, failOn: "error" })
        .rotate()
        .resize({ width: 64, height: 64, fit: "inside", withoutEnlargement: true })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const rgba = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      const swatches = swatchesFromRgba(rgba, info.width, info.height);
      return { status: 200, body: { swatches, source: "sharp" } satisfies SwatchesResponse };
    } catch (err) {
      return {
        status: 503,
        body: {
          error: `sharp could not decode this picture: ${(err as Error).message}`,
          code: IMAGE_SWATCHES_UNAVAILABLE,
        },
      };
    }
  }

  // Fallback when `sharp` is absent: ask the picture-capable text model and mark `estimated: true`.
  if (!input.textModel.available() || !input.textModel.takesImages()) {
    return {
      status: 503,
      body: {
        error:
          "this home has neither sharp nor a picture-capable text model — swatches cannot be read here (install sharp on the home, or set an Anthropic key)",
        code: IMAGE_SWATCHES_UNAVAILABLE,
      },
    };
  }
  const source = input.textModel.keySource();
  const refused = source === "file" ? await input.notTheOwners() : null;
  if (refused) {
    return { status: 403, body: { error: ownerOnlySentence(refused.owner), code: TEXT_OWNER_ONLY } };
  }
  const ready = await pictureToSend(input.bytes, input.mimeType, input.loadSharpOption ?? importSharp);
  if (!ready) {
    return {
      status: 503,
      body: {
        error: "this picture cannot be prepared without sharp at this home",
        code: IMAGE_SWATCHES_UNAVAILABLE,
      },
    };
  }
  if (!input.textModel.take(input.badgeId)) {
    return {
      status: 429,
      body: {
        error: "this badge has asked for enough words this minute — wait a moment and ask again",
        code: TEXT_RATE_LIMITED,
      },
    };
  }
  const written = await input.textModel.write(
    { prompt: SWATCH_PROMPT, schema: SWATCH_SCHEMA },
    { images: [{ mediaType: ready.mediaType, data: ready.data }] },
  );
  if (written.status !== 200) return written;
  const raw = (written.body as { value?: { swatches?: unknown } } | null)?.value?.swatches;
  const parsed = parseMoodSwatches(JSON.stringify(Array.isArray(raw) ? raw : []));
  const swatches = parsed
    .map((s) => ({ ...s, estimated: true }))
    .sort((a, b) => b.share - a.share || a.hex.localeCompare(b.hex))
    .slice(0, 6);
  return { status: 200, body: { swatches, source: "estimated" } satisfies SwatchesResponse };
}
