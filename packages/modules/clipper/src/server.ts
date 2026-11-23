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

import {
  newItemId,
  newVersionId,
  type Actor,
  type ModuleRequest,
  type ModuleResponse,
  type ServerHost,
  type ServerModule,
} from "@isocan/core";
import {
  CLIPPER_MAX_PAYLOAD_BYTES,
  CLIPPER_PROPS,
  validateClipPayload,
  type ClipCaptureResponse,
} from "./core.ts";

const BAD_REQUEST = "clipper-bad-request";

async function resolveActor(actor: Actor | undefined, host: ServerHost): Promise<Actor | null> {
  if (actor) {
    await host.speaksFor(actor.id);
    return { id: actor.id, name: actor.name };
  }
  return (await host.defaultActor?.()) ?? null;
}

function checkCapture({ body }: { body: unknown }): ModuleResponse | null {
  const checked = validateClipPayload(body);
  if (!checked.ok) {
    return { status: 400, body: { error: checked.error, code: BAD_REQUEST } };
  }
  return null;
}

async function handleCapture(req: ModuleRequest, host: ServerHost): Promise<ModuleResponse> {
  const checked = validateClipPayload(req.body);
  if (!checked.ok) {
    return { status: 400, body: { error: checked.error, code: BAD_REQUEST } };
  }
  const clip = checked.payload;
  const actor = await resolveActor(clip.actor, host);
  if (!actor) {
    return { status: 400, body: { error: "an actor is required to save a web clip", code: BAD_REQUEST } };
  }

  let bytes: Uint8Array;
  let mimeType: string;
  let filename: string;

  if (clip.kind === "image" && clip.imageBase64) {
    mimeType = clip.mimeType && clip.mimeType.startsWith("image/") ? clip.mimeType : "image/png";
    const ext = mimeType.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "png";
    filename = `clip.${ext}`;
    bytes = Uint8Array.from(Buffer.from(clip.imageBase64, "base64"));
  } else if (clip.kind === "site" && clip.html) {
    mimeType = "text/html";
    filename = "clip.html";
    bytes = new TextEncoder().encode(clip.html);
  } else {
    mimeType = "text/markdown";
    filename = "clip.md";
    const md = [
      `# ${clip.title}`,
      "",
      `Source: <${clip.url}>`,
      "",
      clip.selection?.trim() ? clip.selection.trim() : "_Clipped bookmark._",
      "",
    ].join("\n");
    bytes = new TextEncoder().encode(md);
  }

  const blob = await host.putBlob(req.canvasId, bytes, { mimeType, filename });
  const itemId = newItemId();
  const capturedAt = new Date(host.now()).toISOString();

  await host.submit({
    canvasId: req.canvasId,
    actor,
    op: {
      type: "item.add",
      itemId,
      title: clip.title,
      width: 440,
      height: 320,
      placement: { x: 0, y: 0 },
      version: {
        id: newVersionId(),
        blobHash: blob.blobHash,
        mimeType,
        filename,
        size: blob.size,
      },
      properties: {
        [CLIPPER_PROPS.sourceUrl]: clip.url,
        [CLIPPER_PROPS.capturedAt]: capturedAt,
        [CLIPPER_PROPS.kind]: clip.kind,
      },
    },
  });

  return {
    status: 200,
    body: {
      itemId,
      kind: clip.kind,
      sourceUrl: clip.url,
      capturedAt,
      mimeType,
    } satisfies ClipCaptureResponse,
  };
}

export const clipperServer: ServerModule = {
  name: "@isocan/clipper",
  routes: [
    {
      method: "POST",
      path: "capture",
      spend: "none",
      bodyLimit: CLIPPER_MAX_PAYLOAD_BYTES + 2 * 1024 * 1024,
      says: {
        badRequest: { code: BAD_REQUEST, error: "a clipper capture names `canvasId` and an http(s) `url`" },
      },
      check: checkCapture,
      handler: handleCapture,
    },
  ],
};

export default clipperServer;
