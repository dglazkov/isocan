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
export declare const IMAGE_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
/** One drawing's outcome: the bytes, or the model's own words for why there are none. */
export type Drawn = {
    ok: true;
    bytes: Buffer;
    mimeType: string;
} | {
    ok: false;
    why: string;
    status: number;
    code: string;
};
export declare class ImageModel {
    private readonly opts;
    private asked;
    constructor(opts?: ImageOptions);
    private resolve;
    /** Whose key a picture would be drawn with now: `file` is the machine's person's (owner-only spend), `env` the operator's. */
    keySource(): "env" | "file" | undefined;
    /** The model id a run draws with, read per call. */
    model(): string;
    /** Spend one of this badge's runs for the minute, or say it has none left. */
    take(badgeId: string): boolean;
    /** Draw one picture for this prompt, with `image` beside it when given. Any failure carries Google's words, never the key. */
    draw(prompt: string, image?: {
        bytes: Buffer;
        mimeType: string;
    }): Promise<Drawn>;
}
