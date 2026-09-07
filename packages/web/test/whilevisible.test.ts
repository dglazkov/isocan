import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const src = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

/**
 * **Nothing polls a tab nobody is looking at.**
 *
 * Every repeating fetch here was a bare `setInterval`, so a background canvas
 * went on asking the daemon who was present and whether an rc was answering
 * for as long as the tab stayed open. Chrome throttles a hidden tab's timers
 * to about once a minute, which is why this never showed up as the thing that
 * froze a browser — but "the browser mostly stops us" is not stopping, and
 * the daemon answers either way.
 *
 * The list is short and closed on purpose: a fifth poll added as a bare
 * interval is the regression, and the only way to notice it is to count.
 */
describe("the repeating fetches stop when the tab is hidden", () => {
  const pollers = [
    "../src/lib/answerable.ts",
    "../src/lib/sprint.ts",
    "../src/pages/LensPage.tsx",
    "../src/components/CanvasCard.tsx",
  ];

  it("every poll of the daemon goes through everyWhileVisible", () => {
    for (const rel of pollers) {
      const text = src(rel);
      expect(text, `${rel} should poll through everyWhileVisible`).toContain("everyWhileVisible");
      // The bare interval is what this replaces; leaving one behind is how
      // half a fix looks, and this file has been bitten by half a fix before.
      expect(text, `${rel} still has a bare setInterval`).not.toContain("setInterval(");
    }
  });

  it("reads immediately when the tab comes back, rather than after a full period", () => {
    // The part that is a feature rather than a saving. Resuming the interval
    // alone leaves somebody who has just returned looking at an answer up to a
    // period old, and these answers ("is anybody listening right now") are
    // ones where stale is worse than absent.
    const text = src("../src/lib/whilevisible.ts");
    const onVisible = text.slice(text.indexOf("const onVisibility"));
    const readsFirst = onVisible.indexOf("fn();");
    const restarts = onVisible.indexOf("start();", readsFirst);
    expect(readsFirst).toBeGreaterThan(-1);
    expect(restarts).toBeGreaterThan(readsFirst);
  });

  it("does not pause on blur, only on hidden", () => {
    // A canvas beside a terminal is unfocused and fully visible, and somebody
    // watching an agent work on the other half of the screen is exactly who
    // needs presence to keep moving.
    expect(src("../src/lib/whilevisible.ts")).not.toContain('"blur"');
  });
});

/**
 * **A hold that outlives the window it was held in.**
 *
 * Space, Z and P are momentary: hold to borrow the tool, release to give it
 * back. Switch tabs mid-hold and the keyup lands somewhere else, so the tool
 * is never given back. The pen was fixed when it cost a lost drawing — a
 * stroke left wet and invisible to everyone — and the other two were left,
 * because a canvas stuck in Hand only costs confusion.
 */
describe("losing the window ends every momentary hold", () => {
  it("releases the pen, the Space grab and the Z zoom", () => {
    const text = src("../src/components/CanvasViewport.tsx");
    const onBlur = text.slice(text.indexOf("function onBlur()"));
    const body = onBlur.slice(0, onBlur.indexOf("\n    }") + 6);
    expect(body).toContain("penHeld");
    expect(body).toContain("spacePrevTool");
    expect(body).toContain("zoomPrevTool");
  });
});
