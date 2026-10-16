import { resolveKey } from "@isocan/core/keystore";
import { IMAGE_UPSTREAM, imageModel } from "@isocan/core/mood";
import { warnRefusedKeys } from "./text.ts";

/**
 * **The image model, spent with this home's Gemini key** — the other half of
 * `POST /api/image` (moodboard phase 0; `docs/projects/moodboard/design.md`
 * §2). One call draws one picture; the route asks once per tile.
 *
 * Spoken by hand over REST, as `live-token.ts` speaks the Live token
 * endpoint, so the server takes no SDK for one POST. The shape is Google's
 * Interactions API as the image-generation guide spells it on 16 Oct 2026
 * (https://ai.google.dev/gemini-api/docs/image-generation): `POST
 * /v1beta/interactions` with the key in `x-goog-api-key`, a body of `model`,
 * `input` (text and image blocks, an image block being `{ type: "image",
 * mime_type, data }` in base64) and `response_format: { type: "image",
 * mime_type, aspect_ratio, image_size }`. The answer carries `status` and
 * `steps`, each `model_output` step a `content` list whose image blocks hold
 * the bytes. **What the live endpoint answers was not proved here** — the
 * suite has no key, and spending needs a person's yes — so the reading below
 * is lenient about where an image block sits and says plainly when it finds
 * none.
 *
 * The key is read per call (env `GEMINI_API_KEY` wins, else keys.json under
 * `keysHome`) and scrubbed from every word this sends back.
 */
export interface ImageOptions {
  /** The key, read per call. Default: `resolveKey("gemini")` under `keysHome`. A key handed in here counts as the environment's (the operator's). */
  key?: () => string | undefined;
  /** Whose `keys.json` the default key reads: the daemon's home, or `null` when this daemon has no workstation. */
  keysHome?: string | null | undefined;
  /** The transport — the seam a test fakes Google through. */
  fetch?: typeof fetch;
  /** The model id. Default `ISOCAN_IMAGE_MODEL`, else core's `IMAGE_MODEL_DEFAULT`. */
  model?: string;
  /** Runs per badge per minute. Default `IMAGE_RUNS_PER_MINUTE`. */
  perMinute?: number;
  now?: () => number;
}

/** Where pictures are drawn. */
export const IMAGE_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
/** A run is up to twelve pictures: a few a minute is a person exploring, more is a loop spending their key. */
const IMAGE_RUNS_PER_MINUTE = 3;
const WINDOW_MS = 60_000;

/** One drawing's outcome: the bytes, or the model's own words for why there are none. */
export type Drawn =
  | { ok: true; bytes: Buffer; mimeType: string }
  | { ok: false; why: string; status: number; code: string };

interface Block { type?: unknown; data?: unknown; mime_type?: unknown; text?: unknown }

/** Every content block in an answer, wherever the step list put it. */
function blocksOf(answer: Record<string, unknown>): Block[] {
  const out: Block[] = [];
  const steps = Array.isArray(answer.steps) ? answer.steps : [];
  for (const step of steps as Array<{ content?: unknown }>) if (Array.isArray(step?.content)) out.push(...(step.content as Block[]));
  // The SDK's `output_image` convenience, should the wire ever carry it.
  const direct = answer.output_image as Block | undefined;
  if (direct && typeof direct === "object") out.push({ type: "image", ...direct });
  return out;
}

export class ImageModel {
  private asked = new Map<string, number[]>();

  constructor(private readonly opts: ImageOptions = {}) {}

  private resolve(): { key: string; source: "env" | "file" } | undefined {
    if (this.opts.key) {
      const key = this.opts.key()?.trim();
      return key ? { key, source: "env" } : undefined;
    }
    const found = warnRefusedKeys(() => resolveKey("gemini", this.opts.keysHome !== undefined ? { home: this.opts.keysHome } : {}));
    return found ? { key: found.key, source: found.source } : undefined;
  }

  /** Whose key a picture would be drawn with now: `file` is the machine's person's (owner-only spend), `env` the operator's. */
  keySource(): "env" | "file" | undefined {
    return this.resolve()?.source;
  }

  /** The model id a run draws with, read per call. */
  model(): string {
    return this.opts.model ?? imageModel(process.env);
  }

  /** Spend one of this badge's runs for the minute, or say it has none left. */
  take(badgeId: string): boolean {
    const now = (this.opts.now ?? Date.now)();
    const recent = (this.asked.get(badgeId) ?? []).filter((t) => now - t < WINDOW_MS);
    if (recent.length >= (this.opts.perMinute ?? IMAGE_RUNS_PER_MINUTE)) {
      this.asked.set(badgeId, recent);
      return false;
    }
    recent.push(now);
    this.asked.set(badgeId, recent);
    return true;
  }

  /** Draw one picture for this prompt, with `image` beside it when given. Any failure carries Google's words, never the key. */
  async draw(prompt: string, image?: { bytes: Buffer; mimeType: string }): Promise<Drawn> {
    const resolved = this.resolve();
    if (!resolved) throw new Error("the image route has no key");
    const { key } = resolved;
    const scrub = (text: string) => text.split(key).join("[key]");
    const input: unknown[] = [{ type: "text", text: prompt }];
    if (image) input.push({ type: "image", mime_type: image.mimeType, data: image.bytes.toString("base64") });
    try {
      const res = await (this.opts.fetch ?? fetch)(IMAGE_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          model: this.model(),
          input,
          response_format: { type: "image", mime_type: "image/jpeg", aspect_ratio: "1:1", image_size: "1K" },
        }),
      });
      const text = await res.text();
      if (!res.ok) {
        let said = text.slice(0, 300);
        try {
          said = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? said;
        } catch {
          // not JSON: the first words of it
        }
        return { ok: false, status: 502, code: IMAGE_UPSTREAM, why: scrub(`Google refused the request (${res.status}): ${said}`) };
      }
      const answer = JSON.parse(text) as Record<string, unknown>;
      const blocks = blocksOf(answer);
      const picture = blocks.find((b) => b.type === "image" && typeof b.data === "string" && b.data);
      if (picture) {
        return { ok: true, bytes: Buffer.from(picture.data as string, "base64"), mimeType: typeof picture.mime_type === "string" ? picture.mime_type : "image/jpeg" };
      }
      // No picture: the model's own words, verbatim, when it said any.
      const said = blocks.filter((b) => b.type === "text" && typeof b.text === "string").map((b) => b.text as string).join(" ").trim();
      const errors = Array.isArray(answer.errors) ? (answer.errors as Array<{ message?: unknown }>).map((e) => (typeof e?.message === "string" ? e.message : "")).filter(Boolean).join("; ") : "";
      const why = said || errors || `Google answered ${typeof answer.status === "string" ? answer.status : "without a status"} and no picture`;
      return { ok: false, status: 502, code: IMAGE_UPSTREAM, why: scrub(why) };
    } catch (error) {
      return { ok: false, status: 502, code: IMAGE_UPSTREAM, why: scrub(`Google could not be reached for a picture: ${(error as Error).message}`) };
    }
  }
}
