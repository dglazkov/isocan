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

import { expect, it } from "vitest";
import { summonsPrompt } from "../src/helpers.ts";

it("directs the actual canvas summons to the shared on-demand design procedure", () => {
  const prompt = summonsPrompt("Acme Board", "Acme Designer", { reason: "Acme design request", entries: [] });
  expect(prompt).toContain("isocan design workflow");
  expect(prompt).toContain("designed screen, HTML node or connected app");
  expect(prompt).toContain("precise edits and archive imports do not start a new interview");
  expect(prompt).toContain("isocan --agent-help");
  expect(prompt).not.toContain("zero to three");
});
