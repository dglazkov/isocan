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

import type { Operation } from "@isocan/core";
import { buildWelcomeItemAddOp, welcomeItemSpec, type WelcomeItemOptions } from "@isocan/core/welcome";

export interface WelcomeSeedTransport {
  uploadBlob(canvasId: string, data: Uint8Array, mimeType: string, filename: string): Promise<{ blobHash: string; size: number }>;
  sendOp(canvasId: string, op: Operation): Promise<unknown>;
}

/** Upload and place the opt-in "Welcome to Open Stitch" markdown card on a new canvas. */
export async function seedWelcomeItem(
  transport: WelcomeSeedTransport,
  canvasId: string,
  opts?: WelcomeItemOptions,
): Promise<{ itemId: string }> {
  const spec = welcomeItemSpec(opts);
  const bytes = new TextEncoder().encode(spec.body);
  const blob = await transport.uploadBlob(canvasId, bytes, spec.mimeType, spec.filename);
  const op = buildWelcomeItemAddOp(spec, blob);
  await transport.sendOp(canvasId, op);
  return { itemId: op.itemId };
}
