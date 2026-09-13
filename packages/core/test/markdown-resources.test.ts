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
