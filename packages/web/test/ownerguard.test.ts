import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

/**
 * **The two halves of one rule, on the two sides that have to agree.**
 *
 * Changing what the link admits to is the owner's alone. The daemon is what
 * ENFORCES that — a client-side check is a habit — but the app must not offer
 * a control that is going to refuse, and it must say whose canvas it is, or
 * "why can I not press this" has no answer on screen.
 */
describe("only the owner may change what the link allows", () => {
  const dialog = read("../src/components/ShareDialog.tsx");
  const http = read("../../server/src/http.ts");

  it("is refused by the daemon, not merely hidden by the app", () => {
    expect(http).toContain("ownsThisCanvas(desk, snapshot.project, req.badge!)");
    expect(http).toContain("code: NOT_OWNER");
  });

  it("is refused only for a CHANGE, so inviting and turning it off stay open", () => {
    // Additive or undoable-by-whoever-did-it. Capability is neither: it
    // sweeps everybody, including the person who pressed it.
    expect(http).toContain(
      'const changingCapability = live ? capabilityOf(live) !== capability : capability === "view";',
    );
  });

  it("asks core who the owner is, rather than deciding again in the app", () => {
    expect(dialog).toContain("ownsCanvas(record, actor.id)");
  });

  it("disables the control for everybody else instead of hiding it", () => {
    // What the link currently allows is worth knowing whoever you are, and a
    // setting that vanishes reads as a bug.
    expect(dialog).toContain("disabled={busy || !owned}");
    expect(dialog).toContain("ownerNote");
  });

  it("says who made the canvas", () => {
    expect(dialog).toContain("Made by");
  });
});

describe("a slide that cannot be photographed is not animated", () => {
  const flip = read("../src/lib/deckflip.ts");
  const full = read("../src/components/FullScreen.tsx");
  const viewer = read("../src/components/Viewer.tsx");

  it("cuts when either side of the flip is a frame", () => {
    /**
     * A view transition animates a SNAPSHOT, and a sandboxed cross-origin
     * iframe captures as a blank rectangle — so the push was a white flash
     * across the screen on every flip. Caching never touched it: the frame
     * was loaded the whole time, it just cannot be photographed.
     */
    expect(flip).toMatch(/framed = false/);
    expect(flip).toMatch(/if \(\s*framed \|\|/);
  });

  it("is asked on both faces of the deck, which flip the same way", () => {
    for (const [name, src] of [["full screen", full], ["the viewer", viewer]] as const) {
      expect(src, `${name} does not pass framed`).toContain("isFramedItem(next)");
      expect(src, `${name} ignores the slide being left`).toContain("isFramedItem(here)");
    }
  });
});
