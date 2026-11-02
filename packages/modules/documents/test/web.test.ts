import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { documentsFocusFacet, documentsWeb, isDocumentsFocusMatch } from "../src/web.tsx";
import { reorderMarkdownSection } from "../src/focus.tsx";

/**
 * **The two new slots, filled**: an inspector for documents beside the
 * stage, a Documents page with an address. Structurally: the module fills
 * them with facts only, and the shell mounts them where the design said.
 */
const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8");
const workbench = read("../../../web/src/components/Workbench.tsx");
const page = read("../../../web/src/pages/CanvasPage.tsx");
const modules = read("../../../web/src/modules.ts");
const web = read("../src/web.tsx");

describe("documents fill the inspector and page slots", () => {
  it("declares an inspector for the document kind and a page at docs", () => {
    expect(documentsWeb.inspectors?.map((i) => [i.kinds, i.label])).toEqual([[["document"], "Outline"]]);
    expect(documentsWeb.pages?.map((p) => [p.segment, p.label])).toEqual([["docs", "Documents"]]);
    expect(web).not.toMatch(/useCanvasStore|useUiStore/);
  });

  it("the workbench mounts an inspector beside the stage for the open item's kind", () => {
    expect(workbench).toContain("moduleInspectorsFor(");
    expect(workbench).toContain('className="wb-inspector"');
    expect(modules).toContain("export function moduleInspectorsFor(kind: string)");
  });

  it("a page is a cover route mounted in the canvas page, with the shell's own bar", () => {
    expect(page).toContain("useMatch(MODULE_PAGE_ROUTE)");
    /* The mount, not its exact spelling. This named the whole JSX line and
       broke on 9 Sep when the page grew an `actor` prop so a module could be
       handed a host to write through (#156) — a component that was still
       correct. The invariant is that the segment reaches ModulePage. */
    expect(page).toMatch(/<ModulePage[^>]*segment=\{pageSegment\}/);
    expect(modules).toContain("export function modulePage(segment: string)");
  });

  it("declares a ModuleFocus facet (module.documents) and reorders markdown sections cleanly", () => {
    expect(documentsFocusFacet.id).toBe("module.documents");
    expect(documentsFocusFacet.priority).toBe(15);
    const md = "# Overview\nIntro text.\n\n## Architecture\nDetails A.\n\n## Rollout\nDetails B.";
    const reordered = reorderMarkdownSection(md, 2, -1);
    expect(reordered.indexOf("## Rollout")).toBeLessThan(reordered.indexOf("## Architecture"));
    expect(typeof isDocumentsFocusMatch).toBe("function");
  });
});
