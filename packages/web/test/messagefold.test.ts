import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { rules, withoutComments } from "./cssrules.ts";

/**
 * **Folding a MESSAGE, and saying where it went.**
 *
 * Named `messagefold` and not `fold` because `packages/web/test/fold.test.ts`
 * was already taken by a different feature — *"Fold into <name>"* on the
 * identity roster, where folding is one persona being taken up by another.
 * Two meanings for one word in one product, and the file name was the first
 * place they collided (this file was written as `fold.test.ts` and clobbered
 * the other one for ten minutes).
 *
 * The fold was asked for on 7 Sep — *"collapse a section in chat… maybe by
 * clicking on the date"* — and the same day: *"sometimes it jumps and hard to
 * know what just happened. What if the item gets a background fade for a
 * second IF the location jumps… so you know where the item is?"*
 *
 * **Measured rather than believed, and it is worse than a jump.** Folding a
 * long agent report in a panel scrolled 1,015px down took the content from
 * 1,728px to 713px; `scrollTop` was clamped to 0 because that much scroll no
 * longer existed, and every message in the thread moved **1,205 screen pixels**
 * at once.
 */
const source = readFileSync(
  fileURLToPath(new URL("../src/components/CommentWhen.tsx", import.meta.url)),
  "utf8",
);
const bare = source
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  .replace(/\/\/.*$/gm, "");

describe("a fold that moved the thread says so", () => {
  it("asks whether the SCROLLER was forced, not how far anything moved", () => {
    /**
     * Two wrong answers were measured first, and this guard exists so neither
     * comes back looking reasonable.
     *
     * A pixel threshold fired on a fold that shifted the thread 18px — the
     * Chat's list settles against the bottom, so nearly every fold moves
     * everything a little, and a light that goes off every time is one people
     * stop reading.
     *
     * "Does it still overlap where it was" is worse, because it fails for
     * exactly the message this exists for: a report taller than the panel has
     * an old rectangle covering wherever the new one lands, so the fold that
     * threw the thread a thousand pixels reported no movement at all.
     */
    expect(bare).toContain("const was = scroller?.scrollTop;");
    expect(bare).toContain("if (scroller.scrollTop === was) return;");
    // Neither of the two answers that were measured and rejected.
    expect(bare).not.toMatch(/MOVED_BY/);
    expect(bare).not.toMatch(/now\.bottom > was\.top/);
  });

  it("measures after the browser has re-laid the panel out, not just after React", () => {
    // One frame gets React's commit and not the scroller's reflow, so the
    // reading would be taken against the layout that is about to change.
    expect(bare).toMatch(/requestAnimationFrame\(\(\) =>\s*requestAnimationFrame\(/);
  });

  it("does nothing at all where nothing can scroll", () => {
    /* A pin popover holds one short comment and never lurches. `scrollerOf`
       returning null is the ordinary case there, not a failure. */
    expect(bare).toContain("function scrollerOf(");
    expect(bare).toMatch(/if \(!message \|\| was === undefined \|\| !scroller\) return;/);
  });

  it("restarts the flash rather than ignoring a second fold mid-fade", () => {
    expect(bare).toContain('message.classList.remove("moved");');
    expect(bare).toContain("void message.offsetWidth;");
  });

  it("is one toggle, used by the date and by the folded line", () => {
    /* `CommentWhen.tsx`'s own argument, applied to the flash: the decision
       about what a fold DOES belongs in one place rather than twice, because
       both the Chat panel and the pin popover render a comment and neither
       owns the other. */
    expect((bare.match(/useFoldToggle\(comment\.id\)/g) ?? [])).toHaveLength(2);
    expect(bare).not.toMatch(/onClick=\{\(\) => toggle\(comment\.id\)\}/);
  });
});

describe("the flash itself", () => {
  const sheet = rules(withoutComments());

  it("fades, and holds still for somebody who asked for no motion", () => {
    const moved = sheet.find((r) => r.selector === ".comment.moved" && r.at.length === 0);
    expect(moved?.body, "a fade by default").toContain("animation: comment-moved");
    const reduced = sheet.find(
      (r) => r.selector === ".comment.moved" && r.at.some((a) => /prefers-reduced-motion/.test(a)),
    );
    // A step rather than a fade — and it still goes away, because the class is
    // removed on the same timer either way.
    expect(reduced?.body).toContain("animation: none");
    expect(reduced?.body).toContain("background: var(--accent-wash)");
  });

  it("paints a tint, not an outline", () => {
    // An outline at this size reads as a selection, and nothing was selected.
    const frames = withoutComments().slice(withoutComments().indexOf("@keyframes comment-moved"));
    expect(frames.slice(0, 200)).toContain("var(--accent-wash)");
    expect(frames.slice(0, 200)).toContain("transparent");
  });
});
