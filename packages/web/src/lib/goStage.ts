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

import { useUiStore } from "../stores/uiStore.ts";

/**
 * Every stage navigation a PERSON makes goes through here: grabbing the
 * wheel clears the watch, in one spelling — the canvas's setViewport rule
 * ("the user grabbing the wheel always wins"), restated for a stage that
 * navigates instead of panning. Follow-driven navigation deliberately does
 * NOT use this; it navigates with `replace` and must not clear itself.
 */
export function goStage(navigate: (path: string) => void, path: string): void {
  useUiStore.getState().setFollow(null);
  navigate(path);
}
