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
import type { Paper } from "./textnode.js";
/**
 * The surfaces words land on, by theme — the stylesheet's `--ground` and the
 * five papers. Copied here (and held equal to `styles.css` by
 * `web/test/textcolour.test.ts`) so the CLI can say where a hex will not
 * read without a browser.
 */
export declare const TEXT_SURFACES: {
    light: {
        ground: string;
        papers: Record<Paper, string>;
    };
    dark: {
        ground: string;
        papers: Record<Paper, string>;
    };
};
