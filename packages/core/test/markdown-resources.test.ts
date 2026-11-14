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
import { markdownResource } from "../src/markdown-resources.ts";
import { seedState } from "./helpers.ts";
it("resolves relative files exactly, including parents, fragments and ambiguity", () => {
  const { canvas } = seedState(); const source = canvas.items.itm_1!, target = canvas.items.itm_2!;
  source.properties.sourcePath = "docs/guide.md"; target.properties.sourcePath = "images/diagram.png";
  expect(markdownResource(canvas, source, "ver_1", "../images/diagram.png#detail")).toMatchObject({ kind: "item", itemId: target.id, fragment: "detail" });
  expect(markdownResource(canvas, source, "ver_1", "diagram.png").kind).toBe("missing");
  expect(markdownResource(canvas, source, "ver_1", "../../outside").kind).toBe("unsafe");
  expect(markdownResource(canvas, source, "ver_1", "javascript:alert(1)").kind).toBe("unsafe");
  expect(markdownResource(canvas, source, "ver_1", "https://example.com").kind).toBe("external");
  expect(markdownResource(canvas, source, "ver_1", "/p/prj_test/i/itm_2").kind).toBe("external");
  expect(markdownResource(canvas, source, "ver_1", "#heading").kind).toBe("fragment");
  canvas.items.duplicate = { ...target, id: "duplicate" };
  expect(markdownResource(canvas, source, "ver_1", "../images/diagram.png").kind).toBe("ambiguous");
});
it("prefers explicit backing paths and never assumes a duplicate basename", () => {
  const { canvas } = seedState(); const source = canvas.items.itm_1!, target = canvas.items.itm_2!;
  source.properties.file = "docs/guide.md"; source.properties.sourcePath = "old/guide.md";
  target.properties.file = "docs/a b.md";
  expect(markdownResource(canvas, source, "ver_1", "a%20b.md")).toMatchObject({ kind: "item", itemId: target.id });
});
