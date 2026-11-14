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

import type { CoreModule } from "@isocan/core";

/**
 * **Talk — voice the canvas** (`@isocan/talk`).
 *
 * The browser-direct half of the voice product: a dialog that opens a Gemini
 * Live session from THIS browser with THIS person's key, and hands the model
 * the canvas's own operations as tools. The one spelling of the provider
 * contract — the setup, the tool surface, the call planner — lives in
 * `@isocan/voice-agent/live`, shared with the standing harness.
 *
 * The module rule, honoured exactly: no new op, no route, no server store.
 * The API key lives in this browser's own storage (per-user, per-origin),
 * tool calls become ordinary operations sent through the shell's host, and
 * nothing this module does is state the canvas keeps. Remove the module and
 * every word it ever said is an ordinary comment, every thing it made an
 * ordinary item.
 */
export const voiceCore: CoreModule = {
  name: "@isocan/talk",
};

/** The runtime loader reads `mod.default`; a named export alone builds and
 *  loads nothing. */
export default voiceCore;
