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

import guideText from "../agent-guide.md";
import type { CliModule } from "@isocan/cli/modulehost";
import { mermaidModule } from "./core.ts";

/**
 * **The CLI half of a kind that needs no verb.** `isocan add diagram.mmd` is
 * the way in, because the CLI's mime table asks the registry this record is
 * in; `isocan ls --kind diagram` filters by it; `isocan edit` opens the text.
 * Registering the record is the whole job, and the guide section says how
 * the kind is used from the terminal — the rule that a kind nobody is told
 * about does not exist, applied to a kind with no family of its own.
 */
export const mermaidCli: CliModule = {
  core: mermaidModule,
  register: () => {},
  guide: guideText,
};

export default mermaidCli;
