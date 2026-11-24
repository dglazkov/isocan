/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { newGroupId, newId, newItemId, newVersionId, type ModuleRequest, type ModuleResponse, type ServerHost, type ServerModule } from "@isocan/core";
import type { JsonSchema } from "@isocan/core/jev";
import { CREDENTIAL_REF_PROP } from "@isocan/core/keys";
import {
  deniedIn,
  IMAGE_BAD_REQUEST,
  IMAGE_ENDPOINT,
  IMAGE_OWNER_ONLY,
  IMAGE_RATE_LIMITED,
  IMAGE_REFUSED,
  IMAGE_SWATCHES_UNAVAILABLE,
  IMAGE_UNAVAILABLE,
  IMAGE_UPSTREAM,
  imageModel,
  isMoodDial,
  MOOD_DEFAULT_N,
  MOOD_DIALS,
  MOOD_MAX_N,
  MOOD_PROPS,
  MOOD_TILE,
  moodPrompt,
  moodPushPrompt,
  moodTray,
  parseMoodSwatches,
  spreadAxes,
  swatchesFromRgba,
  type ImageRequest,
  type ImageResponse,
  type SwatchesRequest,
  type SwatchesResponse,
} from "@isocan/core/mood";

/**
 * **Mood's server half: `POST /api/m/mood/image` and `POST /api/m/mood/swatches`**
 * (moodboard phases 0 and 2; `docs/projects/moodboard/design.md` §2, §4 —
 * the module's own routes since Open Stitch phase 0.1, 19 Nov 2026, when
 * they left `packages/server/src/image.ts`, `mood-swatches.ts` and a block
 * of `model-routes.ts`).
 *
 * **`image`** — a spread of mood-board pictures, drawn with the home's Gemini
 * key: the person's words, wrapped in core's template once per axis, `n`
 * pictures (nine by default, twelve at most), each uploaded as a blob and
 * added as an image item carrying its provenance (§1), laid out as a tray
 * beside the canvas's content — all one undoable group. Spoken by hand over
 * REST, as talk speaks the Live token endpoint, so the home takes no SDK for
 * one POST. The shape is Google's Interactions API as the image-generation
 * guide spells it on 16 Oct 2026 (https://ai.google.dev/gemini-api/docs/image-generation):
 * `POST /v1beta/interactions` with the key in `x-goog-api-key`, a body of
 * `model`, `input` (text and image blocks, an image block being `{ type:
 * "image", mime_type, data }` in base64) and `response_format: { type:
 * "image", mime_type, aspect_ratio, image_size }`. The answer carries
 * `status` and `steps`, each `model_output` step a `content` list whose image
 * blocks hold the bytes. **What the live endpoint answers was not proved
 * here** — the suite has no key, and spending needs a person's yes — so the
 * reading below is lenient about where an image block sits and says plainly
 * when it finds none.
 *
 * **`swatches`** — up to six dominant colour swatches from an image item,
 * read by `sharp` when the home lends it (`host.options.loadSharp`), else by
 * the home's picture-capable text model with every swatch `estimated: true`.
 * It spends no key of its own, so it is `spend: "none"`; the text model's
 * own rules apply inside `host.text`.
 *
 * Two refusals cost nothing and run before the door (`check`): the shape —
 * an `n` past the cap is refused, never trimmed — and the deny-list
 * (`deniedIn`), so a request naming a brand is told so before anything is
 * spent. The door itself — the canvas, whose key it is, the badge's rate —
 * is the home's. The key is scrubbed from every word this sends back.
 */

/** A run is up to twelve pictures: a few a minute is a person exploring, more is a loop spending their key. */
const IMAGE_RUNS_PER_MINUTE = 3;

/** One drawing's outcome: the bytes, or the model's own words for why there are none. */
type Drawn =
  | { ok: true; bytes: Buffer; mimeType: string }
  | { ok: false; why: string };

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

/** The model id a run draws with: the home's seam, else `ISOCAN_IMAGE_MODEL`, else core's default. */
function modelOf(host: ServerHost): string {
  const seam = host.options.model;
  return typeof seam === "string" && seam ? seam : imageModel(process.env);
}

/** Draw one picture for this prompt, with `image` beside it when given. Any failure carries Google's words, never the key. */
async function draw(host: ServerHost, key: string, prompt: string, image?: { bytes: Buffer; mimeType: string }): Promise<Drawn> {
  const scrub = (text: string) => text.split(key).join("[key]");
  const input: unknown[] = [{ type: "text", text: prompt }];
  if (image) input.push({ type: "image", mime_type: image.mimeType, data: image.bytes.toString("base64") });
  try {
    const res = await host.fetch(IMAGE_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        model: modelOf(host),
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
      return { ok: false, why: scrub(`Google refused the request (${res.status}): ${said}`) };
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
    return { ok: false, why: scrub(why) };
  } catch (error) {
    return { ok: false, why: scrub(`Google could not be reached for a picture: ${(error as Error).message}`) };
  }
}

/** The shape, and the deny-list — before the door, before anything is spent. */
function checkImage({ body: raw }: { body: unknown }): ModuleResponse | null {
  const body = raw as Partial<ImageRequest> | null;
  const bad = (error: string): ModuleResponse => ({ status: 400, body: { error, code: IMAGE_BAD_REQUEST } });
  if (!body || typeof body !== "object" || typeof body.canvasId !== "string" || !body.canvasId) {
    return bad("an image request names the canvas it is for (`canvasId`)");
  }
  if (typeof body.prompt !== "string" || !body.prompt.trim() || body.prompt.length > 2000) {
    return bad("an image request carries the person's words (`prompt`), at most 2000 characters");
  }
  const actor = body.actor;
  if (!actor || typeof actor !== "object" || typeof actor.id !== "string" || !actor.id || typeof actor.name !== "string") {
    return bad("an image request names who the tiles are added as (`actor`)");
  }
  const n = body.n ?? MOOD_DEFAULT_N;
  if (!Number.isInteger(n) || n < 1 || n > MOOD_MAX_N) {
    return bad(`a spread is 1 to ${MOOD_MAX_N} images — ${String(body.n)} is past the per-run cap`);
  }
  if (body.parent !== undefined && (typeof body.parent !== "string" || !body.parent)) {
    return bad("`parent` names the image item the spread varies");
  }
  if (body.push !== undefined && !isMoodDial(body.push)) {
    return bad(`\`push\` must be one of ${MOOD_DIALS.join(", ")} — got ${JSON.stringify(body.push)}`);
  }
  const denied = deniedIn(body.prompt);
  if (denied) return { status: 422, body: { error: denied, code: IMAGE_REFUSED } };
  return null;
}

/** The checked body, as the handler reads it. */
function askedOf(body: unknown): ImageRequest {
  const b = body as ImageRequest;
  return {
    canvasId: b.canvasId,
    actor: { id: b.actor.id, name: b.actor.name },
    prompt: b.prompt,
    n: b.n ?? MOOD_DEFAULT_N,
    ...(b.parent ? { parent: b.parent } : {}),
    ...(b.push ? { push: b.push } : {}),
  };
}

async function spread(req: ModuleRequest, host: ServerHost): Promise<ModuleResponse> {
  const asked = askedOf(req.body);
  const { canvasId } = req;
  const resolved = await host.resolveKey("gemini");
  if (!resolved) throw new Error("the image route has no key");
  const { key, credentialRef } = resolved;
  // That the badge speaks for the actor the tiles are added as — before any key is spent on their behalf.
  await host.speaksFor(asked.actor.id);
  const snapshot = await host.canvas(canvasId);
  let parentImage: { bytes: Buffer; mimeType: string } | undefined;
  if (asked.parent) {
    const item = snapshot.canvas.items[asked.parent];
    const version = item?.versions.find((v) => v.id === item.currentVersionId);
    if (!item || !version || !version.mimeType.startsWith("image/")) {
      return { status: 400, body: { error: `${asked.parent} is not an image on this canvas — More like this varies a picture`, code: IMAGE_BAD_REQUEST } };
    }
    const bytes = await host.readBlob(canvasId, version.blobHash);
    if (!bytes) return { status: 404, body: { error: `the picture of ${asked.parent} is not at this home`, code: IMAGE_BAD_REQUEST } };
    parentImage = { bytes: Buffer.from(bytes), mimeType: version.mimeType };
  }
  const model = modelOf(host);
  const axes = spreadAxes(asked.n ?? MOOD_DEFAULT_N);
  // Three at a time: a spread arrives in seconds, not a burst of twelve.
  const drawn: Drawn[] = new Array(axes.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(3, axes.length) }, async () => {
    while (next < axes.length) {
      const i = next++;
      const prompt = asked.push
        ? moodPushPrompt(asked.prompt, asked.push, axes[i]!.reach)
        : moodPrompt(asked.prompt, axes[i]!.reach);
      drawn[i] = await draw(host, key, prompt, parentImage);
    }
  }));
  const answer: ImageResponse = { run: newId("mood"), model, group: newGroupId(), items: [], refused: [] };
  const spots = moodTray(snapshot.canvas, drawn.filter((d) => d.ok).length);
  for (const [i, result] of drawn.entries()) {
    const { axis, reach } = axes[i]!;
    const axisLabel = asked.push ? `push: ${asked.push} · ${axis}` : asked.parent ? `more: ${axis}` : axis;
    const prompt = asked.push ? moodPushPrompt(asked.prompt, asked.push, reach) : moodPrompt(asked.prompt, reach);
    if (!result.ok) {
      answer.refused.push({ axis: axisLabel, why: result.why });
      continue;
    }
    const filename = `mood-${axis.replace(/\W+/g, "-")}.${result.mimeType === "image/jpeg" ? "jpg" : result.mimeType.split("/")[1] ?? "png"}`;
    const put = await host.putBlob(canvasId, result.bytes, { mimeType: result.mimeType, filename });
    const itemId = newItemId();
    await host.submit({
      canvasId, actor: asked.actor, group: answer.group,
      op: {
        type: "item.add", itemId,
        version: { id: newVersionId(), blobHash: put.blobHash, mimeType: put.mimeType, filename, size: put.size },
        ...MOOD_TILE,
        placement: spots[answer.items.length]!,
        title: `${asked.prompt.trim().slice(0, 60)} — ${axisLabel}`,
        properties: {
          [MOOD_PROPS.mood]: "candidate",
          [MOOD_PROPS.prompt]: prompt,
          [MOOD_PROPS.axis]: axisLabel,
          [MOOD_PROPS.model]: model,
          [MOOD_PROPS.run]: answer.run,
          [CREDENTIAL_REF_PROP]: credentialRef,
          ...(asked.parent ? { [MOOD_PROPS.parent]: asked.parent } : {}),
        },
      },
    });
    answer.items.push({ itemId, axis: axisLabel });
  }
  if (answer.items.length === 0) {
    return { status: 502, body: { error: answer.refused[0]?.why ?? "Google drew nothing", code: IMAGE_UPSTREAM } };
  }
  return { status: 200, body: answer };
}

// ---- swatches ----

/** The part of `sharp` this reads, so the module names no dependency: the home lends the import through `host.options.loadSharp`. */
interface SharpLike {
  (input: Buffer, options: { limitInputPixels: number; failOn: string }): {
    rotate(): { resize(o: { width: number; height: number; fit: string; withoutEnlargement: boolean }): { ensureAlpha(): { raw(): { toBuffer(o: { resolveWithObject: true }): Promise<{ data: Buffer; info: { width: number; height: number } }> } } } };
  };
}
type LoadSharp = () => Promise<{ default: SharpLike }>;

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

function checkSwatches({ body: raw }: { body: unknown }): ModuleResponse | null {
  const body = raw as Partial<SwatchesRequest> | null;
  if (!body || typeof body !== "object" || typeof body.canvasId !== "string" || !body.canvasId || typeof body.itemId !== "string" || !body.itemId) {
    return { status: 400, body: { error: "a swatches request names `canvasId` and `itemId`", code: IMAGE_BAD_REQUEST } };
  }
  return null;
}

async function swatches(req: ModuleRequest, host: ServerHost): Promise<ModuleResponse> {
  const { canvasId } = req;
  const { itemId } = req.body as SwatchesRequest;
  const snapshot = await host.canvas(canvasId);
  const item = snapshot.canvas.items[itemId];
  const version = item?.versions.find((v) => v.id === item.currentVersionId);
  if (!item || !version || !version.mimeType.startsWith("image/")) {
    return { status: 400, body: { error: `${itemId} is not an image on this canvas`, code: IMAGE_BAD_REQUEST } };
  }
  const read = await host.readBlob(canvasId, version.blobHash);
  if (!read) return { status: 404, body: { error: `the picture of ${itemId} is not at this home`, code: IMAGE_BAD_REQUEST } };
  const bytes = Buffer.from(read);
  const load = host.options.loadSharp as LoadSharp | undefined;
  const sharp = load ? await load().then((m) => m.default, () => null) : null;
  if (sharp) {
    try {
      const { data, info } = await sharp(bytes, { limitInputPixels: 100_000_000, failOn: "error" })
        .rotate()
        .resize({ width: 64, height: 64, fit: "inside", withoutEnlargement: true })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const rgba = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      return { status: 200, body: { swatches: swatchesFromRgba(rgba, info.width, info.height), source: "sharp" } satisfies SwatchesResponse };
    } catch (err) {
      return { status: 503, body: { error: `sharp could not decode this picture: ${(err as Error).message}`, code: IMAGE_SWATCHES_UNAVAILABLE } };
    }
  }
  // Without `sharp`: the home's picture-capable text model, every swatch `estimated: true`.
  if (!host.text.available() || !host.text.takesImages()) {
    return {
      status: 503,
      body: {
        error: "this home has neither sharp nor a picture-capable text model — swatches cannot be read here (install sharp on the home, or set an Anthropic key)",
        code: IMAGE_SWATCHES_UNAVAILABLE,
      },
    };
  }
  const written = await host.text.write({ prompt: SWATCH_PROMPT, schema: SWATCH_SCHEMA }, [{ bytes, mimeType: version.mimeType }]);
  if (written.status !== 200) return written;
  const raw = (written.body as { value?: { swatches?: unknown } } | null)?.value?.swatches;
  const parsed = parseMoodSwatches(JSON.stringify(Array.isArray(raw) ? raw : []));
  const found = parsed
    .map((s) => ({ ...s, estimated: true }))
    .sort((a, b) => b.share - a.share || a.hex.localeCompare(b.hex))
    .slice(0, 6);
  return { status: 200, body: { swatches: found, source: "estimated" } satisfies SwatchesResponse };
}

export const moodServer: ServerModule = {
  name: "@isocan/mood",
  routes: [
    {
      method: "POST",
      path: "image",
      spend: "owner",
      provider: "gemini",
      rate: { perMinute: IMAGE_RUNS_PER_MINUTE },
      bodyLimit: 16 * 1024,
      says: {
        badRequest: { code: IMAGE_BAD_REQUEST, error: "an image request names the canvas it is for (`canvasId`)" },
        ownerOnly: IMAGE_OWNER_ONLY,
        unavailable: { code: IMAGE_UNAVAILABLE, error: "this home has no Gemini key — pictures can't be drawn here (`isocan keys set gemini`, or Model keys…, on the machine that holds this canvas)" },
        rateLimited: { code: IMAGE_RATE_LIMITED, error: "this badge has explored enough this minute — wait a moment and ask again" },
      },
      check: checkImage,
      handler: spread,
    },
    {
      method: "POST",
      path: "swatches",
      spend: "none",
      bodyLimit: 4096,
      says: { badRequest: { code: IMAGE_BAD_REQUEST, error: "a swatches request names `canvasId` and `itemId`" } },
      check: checkSwatches,
      handler: swatches,
    },
  ],
};

export default moodServer;
