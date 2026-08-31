import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The panel is small; what matters about it is the two judgements it encodes.
 */
const src = readFileSync(
  fileURLToPath(new URL("../src/components/WhatsNew.tsx", import.meta.url)),
  "utf8",
);

describe("what's new", () => {
  it("folds with core, so the CLI lists the same days", () => {
    expect(src).toContain("unseen(");
    expect(src).toContain("newestDay(");
  });

  it("marks read on OPEN, not on close", () => {
    /* A panel you opened and skimmed has been seen. Making somebody scroll to
       the bottom to clear a count is a toll rather than a record. */
    expect(src).toMatch(/markSeen\(newestDay\(r\.days\)\)/);
  });

  it("survives a browser that refuses storage", () => {
    /* Then the list still reads and the count simply never fires, which is
       the half that matters. */
    expect(src).toMatch(/catch \{/);
    expect(src).toContain("localStorage");
  });

  it("shows no count to a first-time reader", () => {
    /**
     * `unseen(days, null)` is empty by design in core, and the reason belongs
     * next to the surface that would otherwise greet somebody with fifty
     * unread notices: a dot is a claim about a person's attention, and on a
     * first visit it is a false one.
     */
    expect(src).toMatch(/lastSeen\(\)/);
  });
});
