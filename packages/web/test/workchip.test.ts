import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **Both ends of the title row hold their size, or neither does.**
 *
 * The row's own stylesheet comment has always said it: "each side holds its
 * size about its OWN edge. Counter-scaling the whole row instead makes the
 * row wider than the item — five times wider at 20% zoom." The name obeyed
 * that and the work chip did not, so the two ends of one row behaved
 * differently at every zoom but 100%.
 *
 * The cost lands where it hurts most. At 30% the title reads at 11px and the
 * chip saying an agent is working here reads at 3 — gone at exactly the zoom
 * somebody uses to scan a whole canvas and find out where the work is.
 */
const view = readFileSync(
  fileURLToPath(new URL("../src/components/ItemView.tsx", import.meta.url)),
  "utf8",
);

describe("the title row's two ends behave the same way", () => {
  it("counter-scales the work chip, as it does the name", () => {
    const chip = view.slice(view.indexOf('className="work-chip"') - 900, view.indexOf('className="work-chip"') + 200);
    expect(chip, "the chip must take the same counter-scale the name takes").toMatch(
      /\.\.\.chrome,/,
    );
  });

  it("anchors it to its own edge, not the name's", () => {
    /**
     * `right bottom`. Anchored at the left it would grow leftward across the
     * name as you zoom out — which is precisely the failure the row's comment
     * describes for counter-scaling the whole row at once, reproduced inside
     * one element.
     */
    const chip = view.slice(view.indexOf('className="work-chip"'), view.indexOf('className="work-chip"') + 220);
    expect(chip).toMatch(/transformOrigin: "right bottom"/);
    const name = view.slice(view.indexOf('className="chrome-left"'), view.indexOf('className="chrome-left"') + 260);
    expect(name, "and the name still holds its own left edge").toMatch(
      /transformOrigin: "left bottom"/,
    );
  });
});
