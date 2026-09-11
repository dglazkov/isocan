import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { css, rules, selectorsOf, withoutComments } from "./cssrules.ts";
import { PEEK_CAP } from "../src/lib/peekplace.ts";

/**
 * **The home-grid peek overlays; it never reflows.**
 *
 * The first peek was a plain flex child of the card: every hover grew the
 * card by the peek's height and pushed the whole grid down, so the page
 * jumped under the pointer (measured 2026-09-09: hovering one card moved the
 * row below it by 187px). The fix is placement, not content: the card's
 * footprint is fixed, the preview is absolutely positioned over its
 * neighbours on an opaque ground, opens upward when the bottom edge is
 * constrained, and answers Escape. These guards hold the placements and the
 * dismissal; the geometry itself is proven by driving a real browser
 * (scripts in the change's evidence), which a stylesheet cannot assert.
 */
const page = readFileSync(
  fileURLToPath(new URL("../src/pages/CanvasListPage.tsx", import.meta.url)),
  "utf8",
);
const component = readFileSync(
  fileURLToPath(new URL("../src/components/CardPeek.tsx", import.meta.url)),
  "utf8",
);
const sheet = rules(withoutComments());

/** The rule under EXACTLY this selector — a substring match can be satisfied
 *  by a descendant or a suffix while the rule it guards is gone. */
const exact = (selector: string) => sheet.find((r) => r.selector === selector);
/**
 * Every rule whose selector LIST contains exactly this selector.
 *
 * `exact` asks for a rule written under this selector alone, which is the
 * right question for `.card-peek.up` and the wrong one for a state two
 * selectors share: hover and focus are one appearance here, written once as
 * a group, and a guard that demanded a rule of its own for each would be
 * insisting on the copy rather than on the behaviour. Still exact per
 * selector — `selectorsOf` splits the list, so nothing matches by suffix.
 */
const under = (selector: string) => sheet.filter((r) => selectorsOf(r).includes(selector));
/** …and the declaration it sets, wherever in the list it was written. */
const declares = (selector: string, what: RegExp) =>
  under(selector).some((r) => what.test(r.body));

describe("the grid never moves", () => {
  it("the peek is out of flow, hung below its card", () => {
    const peek = exact(".card-peek");
    expect(peek?.body).toMatch(/position:\s*absolute/);
    expect(peek?.body).toMatch(/top:\s*100%/);
  });

  it("the card does not clip what leaves its box", () => {
    /* `overflow: hidden` on the card clipped nothing in flow; over an
       absolutely positioned preview it would cut the overlay off at the
       card's own bottom edge. */
    expect(exact(".canvas-card")?.body).not.toMatch(/overflow:\s*hidden/);
  });

  it("the card a preview hangs from stacks above the cards it covers", () => {
    expect(declares(".canvas-card:hover", /z-index:\s*var\(--z-popover\)/)).toBe(true);
    /* Focus is the second way a preview opens, and a focused card is not
       necessarily hovered. */
    expect(declares(".canvas-card:focus-within", /z-index:\s*var\(--z-popover\)/)).toBe(true);
  });

  it("carries an opaque ground, because it opens over other cards", () => {
    /* The menu's lesson (8 Sep 2026): a surface that can open over anything
       owes its states a ground that renders one value everywhere. */
    expect(exact(".card-peek")?.body).toContain(
      "linear-gradient(var(--panel), var(--panel)), var(--card)",
    );
  });

  it("is bounded and scrolls rather than running off a short window", () => {
    const peek = exact(".card-peek");
    expect(peek?.body).toMatch(/max-height:/);
    expect(peek?.body).toMatch(/overflow-y:\s*auto/);
  });

  it("caps at the number `PEEK_CAP` says it caps at", () => {
    /* Two files hold one measurement: the stylesheet paints the cap, and
       `peekPlacement` clamps against it. They were 240 together; the day one
       moves without the other, the clamp is arguing with the paint and the
       peek is either short of its own limit or over it. */
    const declared = /max-height:\s*(\d+)px/.exec(exact(".card-peek")?.body ?? "")?.[1];
    expect(Number(declared)).toBe(PEEK_CAP);
  });
});

describe("one continuous surface", () => {
  it("gives the open card and preview the same opaque ground and border", () => {
    const card = exact(".canvas-card:has(> .card-peek)");
    expect(card?.body).toContain("linear-gradient(var(--panel), var(--panel)), var(--card)");
    expect(exact(".card-peek")?.body).toMatch(/border-color:\s*inherit/);
    // Separate shadows cast a dark line across the otherwise continuous join.
    expect(card?.body).toMatch(/box-shadow:\s*none/);
    expect(exact(".card-peek")?.body).toMatch(/box-shadow:\s*none/);
  });

  it("removes the joining corners and border below, without shrinking the card", () => {
    const card = exact(".canvas-card:has(> .card-peek:not(.up))");
    expect(card?.body).toMatch(/border-bottom-left-radius:\s*0/);
    expect(card?.body).toMatch(/border-bottom-right-radius:\s*0/);
    expect(card?.body).not.toMatch(/border(?:-bottom)?(?:-width)?:/);
    expect(exact(".card-peek")?.body).toMatch(/border-top-width:\s*0/);
  });

  it("joins the opposite edges for an upward preview", () => {
    const card = exact(".canvas-card:has(> .card-peek.up)");
    expect(card?.body).toMatch(/border-top-left-radius:\s*0/);
    expect(card?.body).toMatch(/border-top-right-radius:\s*0/);
    expect(card?.body).not.toMatch(/border(?:-top)?(?:-width)?:/);
    expect(exact(".card-peek.up")?.body).toMatch(/border-top-width:\s*1px/);
    expect(exact(".card-peek.up")?.body).toMatch(/border-bottom-width:\s*0/);
  });
});

/**
 * **A surface that covers another owes it a shadow.**
 *
 * The overlay landed flat: the peek covered most of the card beneath it and
 * left that card's last few pixels showing under its bottom edge, with
 * nothing anywhere saying which of the two was in front. Reported as "the
 * middle card overlays the card below" — read as a rendering fault rather
 * than as a preview, which is exactly what a covering surface with no depth
 * looks like.
 *
 * Depth, not decoration, so the guard holds the two things that make it read
 * as depth and would each be easy to undo by accident: ONE shadow around the
 * pair (a `filter`, because two `box-shadow`s draw a line across the join the
 * rest of this file works to hide), and a scale, because a thing that is
 * nearer is bigger and a shadow alone says "raised" without saying "yours".
 */
describe("the lift", () => {
  const LIFTED = [".canvas-card:hover", ".canvas-card:focus-within"];

  it("shades the card and its preview as one silhouette", () => {
    for (const state of LIFTED) {
      expect(declares(state, /filter:\s*var\(--lift\)/), state).toBe(true);
      /* The `filter` REPLACES the box-shadow rather than joining it: both at
         once is the card's own outline drawn twice, once around the pair and
         once around the top half. */
      expect(declares(state, /box-shadow:\s*none/), state).toBe(true);
    }
  });

  it("draws that shadow with `filter`, which no box-shadow can do", () => {
    /* `--lift` is the whole reason this works — `drop-shadow` follows what was
       painted, so a card plus an absolutely positioned child is one shape. A
       `box-shadow` value here would silently go back to shading two boxes. */
    expect(css).toMatch(/--lift:\s*drop-shadow\(/);
  });

  it("comes toward you as well as up", () => {
    for (const state of LIFTED) {
      expect(declares(state, /transform:[^;]*scale\(/), state).toBe(true);
    }
  });

  it("moves nothing: the scale is paint, and the grid is measured elsewhere", () => {
    /* The premise of the whole overlay. A `scale` cannot reflow — but a
       `width`, `padding` or `margin` in the same rule could, and that is the
       mistake this sits next to. */
    for (const state of LIFTED) {
      for (const rule of under(state)) {
        expect(rule.body, state).not.toMatch(/(?:^|;)\s*(?:width|height|padding|margin)\s*:/);
      }
    }
  });

  it("gives the approach back to anyone who asked for less motion", () => {
    const still = sheet.filter(
      (r) => r.at.some((a) => /prefers-reduced-motion/.test(a)) && selectorsOf(r).includes(".canvas-card:hover"),
    );
    expect(still.some((r) => /transform:\s*none/.test(r.body))).toBe(true);
    /* The shadow stays: it is depth, not movement, and taking it away would
       take the answer to "which one is in front" with it. */
    expect(still.every((r) => !/filter:/.test(r.body))).toBe(true);
  });

  it("leaves the create card alone — a form does not lift while you type in it", () => {
    expect(declares(".canvas-card.create:focus-within", /filter:\s*none/)).toBe(true);
    expect(declares(".canvas-card.create:focus-within", /transform:\s*none/)).toBe(true);
  });
});

describe("the bottom edge", () => {
  it("has an upward-opening variant", () => {
    expect(exact(".card-peek.up")?.body).toMatch(/bottom:\s*100%/);
  });

  it("opens toward the room, measured when the peek opens", () => {
    /* The side decision and the real cap are one pure function — the
       executing cases are in peekplace.test.ts; this guard holds the
       WIRING: the component calls it with the card's box and the window,
       wears its side, and hands its cap to the style. */
    expect(component).toMatch(/peekPlacement\(r\.top, r\.bottom, window\.innerHeight\)/);
    expect(component).toMatch(/place\.up \? " up"/);
    expect(component).toMatch(/maxHeight: place\.maxHeight/);
  });

  it("re-measures on resize, because the window can shrink under an open peek", () => {
    expect(component).toMatch(/window\.addEventListener\("resize", measure\)/);
  });

  it("places BEFORE the browser paints, not after", () => {
    /* `useEffect` runs after paint, so the first frame carried the previous
       placement — side down, cap `PEEK_CAP` — and the correction was a
       visible jump: 353px at 900×700, and at 800×240 a box hanging 134px
       below the fold before it clamped to 97. A peek that moves after you
       see it is the bug this component exists to stop, wearing a different
       hat. No SSR here, so there is no hydration cost to paying for it. */
    expect(component).toMatch(/useLayoutEffect\(\(\) => \{/);
    expect(component).not.toMatch(/\buseEffect\(/);
  });
});

describe("the dismissal", () => {
  it("answers Escape", () => {
    expect(page).toMatch(/window\.addEventListener\("keydown", dismiss\)/);
    expect(page).toMatch(/e\.key === "Escape"/);
  });

  it("is not taken away by the pointer while the keyboard is reading it", () => {
    expect(page).toMatch(/contains\(document\.activeElement\)/);
  });

  it("keeps the rows where Tab expects them: between the open link and the ··· row", () => {
    const openAt = page.indexOf('className="card-open"');
    const peekAt = page.indexOf("<CardPeek");
    const moreAt = page.indexOf('className="card-more"');
    expect(openAt).toBeGreaterThan(-1);
    expect(openAt).toBeLessThan(peekAt);
    expect(peekAt).toBeLessThan(moreAt);
  });
});
