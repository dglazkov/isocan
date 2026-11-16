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

import type { Paper } from "./textnode.ts";

/**
 * The surfaces words land on, by theme — the stylesheet's `--ground` and the
 * five papers. Copied here (and held equal to `styles.css` by
 * `web/test/textcolour.test.ts`) so the CLI can say where a hex will not
 * read without a browser.
 */
export const TEXT_SURFACES: {
  light: { ground: string; papers: Record<Paper, string> };
  dark: { ground: string; papers: Record<Paper, string> };
} = {
  light: {
    ground: "#fbfbf9",
    papers: { yellow: "#fdf3c3", pink: "#fbdce6", blue: "#d8ebf9", green: "#d9f0dc", grey: "#e6e7e3" },
  },
  dark: {
    ground: "#0e0f12",
    papers: { yellow: "#e6dba8", pink: "#e4c3ce", blue: "#c3d6e4", green: "#c2d8c6", grey: "#cdcec9" },
  },
};
