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
import { type Shortcut } from "./shortcuts.js";
/**
 * **The keys loaded modules add** — each `ModuleMark` with a `key` answers
 * ⇧ and that letter (the wireframes' ⇧K keeps a screen). They are not in
 * `SHORTCUTS` because they exist only while their module is loaded; this
 * turns the loaded ones into rows in the same shape, so the help panel and
 * `isocan shortcuts` say them in the same words (24 Sep 2026: ⇧K was in the
 * panel and not in the CLI's list).
 */
export declare function markShortcuts(): Shortcut[];
/** The whole list as text, for a terminal or a comment: the same answer the
 * overlay gives, in the medium an agent can pass on — the loaded modules'
 * keys included (`markShortcuts`). */
export declare function shortcutsAsText(): string;
