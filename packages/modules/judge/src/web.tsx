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

import type { WebModule } from "@isocan/core";
import { judgeModule } from "./record.ts";

/**
 * **The web half is the record and nothing else**, on purpose. The corpus
 * reader writes to no canvas and draws nothing; it is a terminal act by the
 * person whose verdicts it reads (`isocan judge corpus`). The record is here
 * because a module lives in both lists or neither (`test/modules.test.ts`),
 * and it is the size of a name — no slot, no chunk, nothing first paint pays
 * for beyond the record itself.
 */
export const judgeWeb: WebModule<never> = { core: judgeModule };

export default judgeWeb;
