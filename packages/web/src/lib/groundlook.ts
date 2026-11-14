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

import { sampledGround } from "@isocan/core";
import { useGroundSamples } from "./groundsample.ts";

const looking = new Set<string>();

/** Look at the picture at `url` (sha256 `hash`), once per tab. The bytes come
 *  through the same address the ground draws from, so the canvas is not
 *  tainted and `getImageData` may read it. */
export function sampleGround(hash: string, url: string): void {
  if (looking.has(hash) || useGroundSamples.getState().byHash[hash]) return;
  looking.add(hash);
  const img = new Image();
  img.decoding = "async";
  img.onload = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 16;
      canvas.height = 16;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, 16, 16);
      const hex = sampledGround(ctx.getImageData(0, 0, 16, 16).data);
      useGroundSamples.setState((s) => ({ byHash: { ...s.byHash, [hash]: hex } }));
    } catch {
      // Unreadable (tainted, or no canvas): the worst case stands, which is
      // what the scrim guarantees anyway.
    }
  };
  img.onerror = () => looking.delete(hash);
  img.src = url;
}
