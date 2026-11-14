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

import type { CanvasContents, Operation } from "@isocan/core";

/**
 * **The canvas, as the composer sees it on any surface** (phase 5).
 *
 * Phases 1–4 wrote through the CLI's host — `ctx.client` for blobs, `sendOp`
 * for ops — so the composer lived in `*-cli.ts` and the web could not run it.
 * This is the seam that lets it: five things a surface can do, and nothing
 * the composer needs besides. The CLI implements it over its host and daemon
 * client (`cli-port.ts`); the web over the dialog's host (`web.tsx`). The
 * rounds, the variations, the prototype and the restyle are written once,
 * against this, so the two surfaces cannot compose different flows from the
 * same answers — the isomorphism, held by there being one composer.
 */
export interface WirePort {
  canvasId: string;
  /** The canvas as it is now — re-read, never cached across a write. */
  canvas(): Promise<CanvasContents>;
  /** A blob of this canvas, as text. */
  readText(blobHash: string): Promise<string>;
  /** Mint the bytes of a new version: the half no op carries. */
  put(text: string, mimeType: string, filename: string): Promise<{ blobHash: string; size: number }>;
  /**
   * Send one op in `group`. For an `item.add`, resolve to where the item
   * actually landed (a group's placement may move it); anything else, void.
   */
  send(op: Operation, group: string): Promise<{ x: number; y: number } | void>;
  /** Who the ops go out as — recorded on what the composer draws (`WireSpec.by`). Absent where the surface cannot say. */
  readonly actor?: { id: string; name: string } | undefined;
}

/** The current version of an item — the one it shows. */
export function currentVersionOf<V extends { id: string }>(item: { currentVersionId?: string; versions: readonly V[] }): V | undefined {
  return item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[item.versions.length - 1];
}
