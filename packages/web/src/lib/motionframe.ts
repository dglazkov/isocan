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

import { motionMessage, motionSeek } from "@isocan/core";
import { noteMotionTime } from "./motionclock.ts";

/**
 * **The canvas's half of a motion player's conversation** (motion phase 2),
 * fetched the first time a frame says something in motion's words — so a
 * canvas with no motion on it downloads none of this. `ItemView` owns the
 * listener and which frame is whose; this reads what was said and answers.
 */

/** A frame of this item spoke: remember where its person paused it, or — once it is ready — scrub it to the open comment's moment. */
export function heardFromMotion(itemId: string, data: unknown, from: Window | null, openAt: number | null): void {
  const said = motionMessage(data);
  if (!said) return;
  if (said.kind === "time") noteMotionTime(itemId, said.at);
  else if (openAt !== null) from?.postMessage(motionSeek(openAt), "*");
}

/** Scrub every frame of an item to a comment's moment — the frames that are already listening. */
export function seekMotion(frames: readonly (Window | null)[], at: number): void {
  for (const f of frames) f?.postMessage(motionSeek(at), "*");
}
