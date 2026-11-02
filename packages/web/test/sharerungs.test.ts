import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { capabilityWord } from "@isocan/core";

const src = fileURLToPath(new URL("../src", import.meta.url));
const css = readFileSync(path.join(src, "styles.css"), "utf8");

function rule(selector: string): string {
  const at = css.indexOf(selector);
  expect(at, `${selector} is in styles.css`).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf("}", at) + 1);
}

/**
 * **The three link rungs are three positions of one control, so they live on
 * one row.** Measured in a browser: Editor / Canvas Viewer / Presentation
 * Viewer want 309px at their natural size and the 340px Share popover leaves
 * them 306, so a `flex-wrap: wrap` row broke "Presentation Viewer" onto a line
 * of its own — two rungs above one, which reads as a group and an afterthought
 * rather than a ladder.
 *
 * The fix is a row that never wraps and rungs that shrink, so the failure mode
 * on a machine whose font measures wider is a label wrapping INSIDE its own
 * box — three cells of equal height — rather than a lopsided row. That needs
 * three properties together, and dropping any one of them brings the old look
 * back, which is why they are asserted rather than trusted.
 */
describe("the link's rungs sit on one row", () => {
  it("never wraps the row, whatever a machine's font measures", () => {
    expect(rule(".share-link-mode {")).toContain("flex-wrap: nowrap");
  });

  it("lets a rung shrink and its label wrap inside it, rather than spill", () => {
    const rung = rule(".share-link-mode .btn {");
    // `.btn` is inline-flex, and a flex item's anonymous text box has an
    // automatic minimum size: it would overflow a narrowed rung, not wrap.
    expect(rung).toContain("display: block");
    expect(rung).toContain("min-width: 0");
    expect(rung).toContain("white-space: normal");
    expect(rung).not.toContain("white-space: nowrap");
  });

  it("shares the row out by label length, so the shortest rung is not given a third", () => {
    expect(rule(".share-link-mode .btn {")).toContain("flex: 1 1 auto");
  });

  it("is measured against the words the dialog actually renders", () => {
    // The row's budget was measured from these three; a longer word would
    // spend it, and this is the test that would be looked at when it does.
    expect([capabilityWord.dialog.edit, capabilityWord.dialog.read, capabilityWord.dialog.view]).toEqual([
      "Editor",
      "Canvas Viewer",
      "Presentation Viewer",
    ]);
  });
});
