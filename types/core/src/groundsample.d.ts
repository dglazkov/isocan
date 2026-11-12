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
/**
 * **What colour a picture actually is under the scrim** (smart contrast
 * phase 3, design §4: "take a look"). `pixels` is RGBA, as a canvas hands
 * them back — the web draws the decoded picture into 16×16 once. Averaged in
 * linear light, because that is the mean an eye sees (an sRGB average of half
 * white and half black is too dark), then composited under black at `scrim`
 * the way the browser blends the scrim element, in sRGB. A transparent pixel
 * is the black the picture is laid on (`--ground-under`).
 *
 * Under today's 0.7 every picture lands `dark` — flat white is
 * `BRIGHTEST_PICTURE` exactly — so this changes nothing anyone sees. It is
 * what makes a lighter scrim for pale pictures a one-number change.
 */
export declare function sampledGround(pixels: Uint8ClampedArray | number[], scrim?: number): string;
