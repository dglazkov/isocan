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

import type { ContextPinPort } from "@isocan/api/context-pin";
import { getSnapshot, uploadBlob } from "./api.ts";
import { personalApi, sourceBytes, sourceSnapshot } from "./personal.ts";
import { sendEchoedResult } from "../stores/canvasStore.ts";

/** sha256 hex, the spelling the store addresses blobs by. The browser's digest
 *  is async where Node's is not, which is exactly why the shared copy path
 *  takes this as a port instead of reaching for `node:crypto`. */
async function digest(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * The browser's transport for the shared pin-from-source act.
 *
 * Every SOURCE request — classification, snapshot and each blob — carries the
 * immutable automatic-exclusion policy and the expected home, the same way the
 * inherited preview and the inherited design text already do. The DESTINATION
 * goes through the ordinary badged routes and the ordinary write queue, so the
 * copy is refused by the same rules as any other act: the past does not take
 * writes, and a queued write is not a landed one.
 */
export const contextPinIO: ContextPinPort = {
  classifySource: personalApi.classifySource,
  sourceSnapshot,
  snapshot: (canvasId, signal) => getSnapshot(canvasId, signal),
  copyBytes: (source, destinationCanvasId) => ({
    downloadBlob: (hash, signal) => sourceBytes(source.canvasId, hash, source.expectedHome, signal),
    uploadBlob: (bytes, mimeType, filename, signal) =>
      uploadBlob(destinationCanvasId, new Blob([new Uint8Array(bytes)], { type: mimeType }), filename, signal ? { signal } : {}),
    digest,
  }),
  submit: async (canvasId, actor, action, _opId, originGroupMode) => {
    const result = await sendEchoedResult(canvasId, actor, { type: "group.change", action }, undefined, originGroupMode);
    if (result.status === "accepted") return {};
    // A queued copy is not a refusal and not a success: saying "copied" here
    // is how somebody presses the button twice and gets two copies.
    throw new Error(result.status === "queued"
      ? "The copy is queued. It will appear when the home accepts it; do not copy a second time."
      : result.message ?? "The copy was refused.");
  },
};
