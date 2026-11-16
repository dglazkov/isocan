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

import type { CoreModule, ModuleKind } from "@isocan/core";

/**
 * **Diagrams as text** (`docs/projects/modules/design.md`, phase 2).
 *
 * A Mermaid file is the whole item: `text/vnd.mermaid`, the mime GitHub,
 * Obsidian and Notion already agree on, with `.mmd` as its extension. The
 * module adds one KIND and nothing else — no property key, no verb, no op.
 * `isocan add diagram.mmd` lands one because the CLI's mime table asks the
 * registry; a dropped file lands one because the web app's does; the card
 * and the stage draw it because the module's renderer claims the mime; and
 * with the module gone the same file is a document, readable as the text it
 * always was. That is the shape every node-type module should have, which is
 * why this is the first.
 */
export const MERMAID_MIME = "text/vnd.mermaid";

export const DIAGRAM_KIND: ModuleKind = {
  id: "diagram",
  mimes: [MERMAID_MIME],
  extensions: ["mmd", "mermaid"],
  label: "Diagrams",
  noun: "diagram",
  icon: "drawing",
};


export const mermaidModule: CoreModule = {
  name: "@isocan/mermaid",
  kinds: [DIAGRAM_KIND],
};

export default mermaidModule;
