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

import type { Actor } from "@isocan/core";
import { buildWelcomeItemAddOp, welcomeItemSpec, type WelcomeItemOptions } from "@isocan/core/welcome";
import { sendOp, uploadBlob } from "../../lib/api.ts";

/**
 * Seed the opt-in "Welcome to Open Stitch" markdown card onto a newly created
 * canvas from the Home `+` flow. Lazy-imported only when explicitly requested
 * so empty-canvas flows keep creating 0 items and entry bytes stay unchanged.
 */
export async function seedWelcomeItem(
  canvasId: string,
  actor: Actor,
  opts?: WelcomeItemOptions,
): Promise<{ itemId: string }> {
  const spec = welcomeItemSpec(opts);
  const file = new Blob([spec.body], { type: spec.mimeType });
  const blob = await uploadBlob(canvasId, file, spec.filename);
  const op = buildWelcomeItemAddOp(spec, blob);
  await sendOp(canvasId, actor, op);
  return { itemId: op.itemId };
}
