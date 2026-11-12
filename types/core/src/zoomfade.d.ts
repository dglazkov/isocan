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
 * The zoom rule as a ramp — the fourth of the four (#203, phase 1).
 *
 * `holdsAtZoom` in `zoomrule.ts` answers "is this big enough on screen?" with
 * a memory, because a yes/no that flips on the exact pixel flickers. A fade
 * has no edge to sit on, so it needs no memory — but it is the same idea, the
 * canvas going quiet as you stand back, and it lives in core beside the rule
 * so that "what changes with zoom" is one place to look. A separate file only
 * so the bundler can leave it in the theme chunk that uses it.
 */
/** 0 at or below `gone`, 1 at or above `full`, linear between. */
export declare function zoomFade(scale: number, gone: number, full: number): number;
