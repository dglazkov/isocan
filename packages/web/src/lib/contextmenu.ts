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

import type { MenuEntry } from "../components/ContextMenu.tsx";
import { useUiStore } from "../stores/uiStore.ts";

/**
 * Open and close from anywhere, the way the other popovers are driven.
 *
 * Its own file so that opening a menu does not pin the menu into the first
 * paint: the three callers are all eager, and while this lived beside the
 * component, a static import of it carried `ContextMenu` and `Submenu` into
 * every visit. The component now arrives on the first right-click.
 */
export function openContextMenu(at: { x: number; y: number }, entries: MenuEntry[]): void {
  useUiStore.getState().setContextMenu({ at, entries });
}
