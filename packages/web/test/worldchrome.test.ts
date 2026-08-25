import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Chrome drawn inside the zoomed world is measured in WORLD pixels.
 *
 * `.world` carries `scale(viewport.scale)`, so everything inside it is in
 * world units: a literal `2px` outline is two world pixels, which is two
 * screen pixels at 100% and — measured — **0.11** at 5%. The selection ring
 * vanished and the resize handles went from 12px to 3px, which is smaller than
 * the pointer that has to hit them.
 *
 * The titlebar never had this problem because ItemView counter-scales it with
 * `transform: scale(1 / scale)`. An outline cannot be counter-scaled that way
 * — the box has to stay in world coordinates — so the length divides by
 * `--scale` instead, which is the same idea arriving through CSS.
 *
 * This test names the selectors that live in world space and sit under the
 * pointer. A hardcoded pixel on any of them is the bug coming back.
 */

const css = readFileSync(fileURLToPath(new URL("../src/styles.css", import.meta.url)), "utf8");

/** Every rule in the file, as (selector list, body), comments stripped. */
function allRules(): Array<{ selectors: string[]; body: string }> {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: Array<{ selectors: string[]; body: string }> = [];
  for (const rule of bare.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    out.push({
      selectors: (rule[1] ?? "").split(",").map((one) => one.trim()),
      body: rule[2] ?? "",
    });
  }
  return out;
}

/**
 * Does this selector text MENTION that class, as that class?
 *
 * `includes` was the first version and it could not say no. `.item.peeked`
 * is a substring of `.item.peeked-x`, and `.resize-handle` of
 * `.resize-handle-nw` — so renaming a rule to a superstring of its own name
 * left every check here satisfied by rules that are not the rule. A class name
 * ends where an identifier character stops.
 */
function mentions(selector: string, text: string): boolean {
  let from = 0;
  for (;;) {
    const at = text.indexOf(selector, from);
    if (at < 0) return false;
    const after = text[at + selector.length] ?? " ";
    if (!/[-\w]/.test(after)) return true;
    from = at + 1;
  }
}

/** Declarations for every rule that mentions this class, variants included —
 *  `.item.selected` picks up `.item.selected:hover`, which draws the same
 *  ring and can regress on its own. */
function rulesFor(selector: string): string[] {
  return allRules()
    .filter((rule) => rule.selectors.some((one) => mentions(selector, one)))
    .map((rule) => rule.body);
}

/**
 * The rule for exactly this class and nothing else — the one that gives it its
 * size.
 *
 * `rulesFor` cannot tell "the ring is drawn in world pixels" from "there is no
 * ring any more", because a DESCENDANT rule keeps the list non-empty:
 * deleting `.item.peeked { outline: … }` outright left
 * `.item.peeked .item-titlebar { opacity: 1 }` behind, the existence check
 * passed, the sizing sweep then had no lengths to look at, and the whole web
 * suite stayed green with the peek ring gone.
 */
function ownRule(selector: string): string | null {
  const found = allRules().filter((rule) => rule.selectors.includes(selector));
  return found.length === 0 ? null : found.map((rule) => rule.body).join(";");
}

/**
 * Lengths that decide how big a thing LOOKS or where it sits. Colour, radius
 * and z-index are not sizes somebody has to see or hit.
 *
 * `padding` is here because the title row's inset is one: ItemView subtracts
 * `CHROME_INSET` screen pixels from the name's width, so the padding that
 * produces that inset has to BE screen pixels. `font-size` is deliberately
 * NOT here — the row's two ends carry their own counter-scale, so their type
 * is already screen-sized and a literal `11px` is right.
 */
const SIZING =
  /(?:^|[;{\s])(width|height|top|right|bottom|left|outline|outline-width|outline-offset|border|border-width|padding|padding-top|padding-right|padding-bottom|padding-left)\s*:\s*([^;]+)/g;

describe("chrome inside the zoomed world", () => {
  /**
   * Everything drawn inside `.world` that somebody has to see or hit.
   *
   * The four corner handles are named one by one rather than as
   * `.resize-handle`, because each carries its OWN offset: the shared rule
   * gives them their size and four separate rules give them their positions,
   * and a rule with four copies gets its regression in one of them
   * (lessons.md #10).
   *
   * `.item-titlebar` was NOT on this list, and the very next commit found the
   * bug it would have caught: the row's SIZE was screen-measured (ItemView
   * counter-scales both ends) while its OFFSET and INSET were world lengths,
   * so the gap above the card was 3.6 screen px at 100% and half a pixel at
   * 13%, and selecting an item made the row hop.
   */
  const WORLD_CHROME = [
    ".resize-handle",
    ".resize-handle-nw",
    ".resize-handle-ne",
    ".resize-handle-sw",
    ".resize-handle-se",
    ".item.selected",
    ".item.peeked",
    ".item-titlebar",
    /* The two badge corners, named separately for the same reason the handles
       are: the shared `.version-badge` rule gives the badge its size and these
       two give it its position, and the bug was in the position.

       This is the titlebar's bug in the sibling beside it, found the run after.
       ItemView counter-scales all three of these elements; two had been moved
       to screen units and the badge had not, so its gap below the card ran
       11.93 screen px at 149% and 1.60 at 20% and it slid under the SE handle
       below 43% zoom. `.version-badge` itself is deliberately NOT on this list
       — its `padding: 3px 7px` is screen pixels already, by the counter-scale,
       exactly as the titlebar's two ends are. */
    ".version-badge-se",
    ".version-badge-ne",
  ];

  it("has rules for every selector it claims to check", () => {
    // Without this the whole file passes vacuously the day a class is renamed.
    for (const selector of WORLD_CHROME) {
      expect(rulesFor(selector).length, `no rule found for ${selector}`).toBeGreaterThan(0);
    }
  });

  /**
   * The existence check above is not enough on its own and this is the half
   * that makes it mean something.
   *
   * Two mutations walked past it. Deleting `.item.peeked`'s ring entirely left
   * `.item.peeked .item-titlebar` to satisfy "a rule was found", and with no
   * lengths left there was nothing for the sizing sweep to reject — the web
   * suite stayed green, 226/226, with the peek ring gone. Renaming
   * `.resize-handle` to `.resize-handle-base` did the same through the four
   * corner rules, taking every handle's size and border with it.
   *
   * So each of these must have a rule of its OWN, and that rule must carry at
   * least one length that divides by `--scale`. That is what "this is world
   * chrome and it holds its screen size" MEANS; a rule with no such length is
   * either gone or was never world chrome.
   */
  it("gives each one a rule of its own that holds a screen-measured length", () => {
    for (const selector of WORLD_CHROME) {
      const own = ownRule(selector);
      expect(own, `${selector} has no rule of its own — renamed, or deleted`).not.toBeNull();
      expect(
        own,
        `${selector} carries no length divided by --scale, so it is not holding its screen size`,
      ).toMatch(/calc\([^)]*var\(--scale/);
    }
  });

  it("sizes itself in screen pixels, not world pixels", () => {
    for (const selector of WORLD_CHROME) {
      for (const body of rulesFor(selector)) {
        for (const declaration of body.matchAll(SIZING)) {
          const [, property, value] = declaration;
          if (!/\dpx/.test(value ?? "")) continue; // `auto`, `0`, a percentage
          expect(
            value,
            `${selector} { ${property}: ${value?.trim()} } is in WORLD pixels — divide by var(--scale)`,
          ).toMatch(/var\(--scale/);
        }
      }
    }
  });

  /**
   * The badge clears the corner handle by a distance that does not shrink.
   *
   * "Both are screen-measured" is not the invariant — two screen-measured
   * numbers can still overlap. The rule is that the badge's right edge sits
   * FURTHER in than the handle reaches, and the handles offset from the same
   * padding box the badge does, so the item's border cancels and this is one
   * comparison rather than a box-model argument.
   *
   * Stated as the inequality rather than as `14` and `6`, so moving either
   * number is allowed and closing the gap is not.
   */
  it("keeps the badge clear of the corner handle at every zoom", () => {
    const screenPx = (body: string, property: string): number => {
      const found = body.match(
        new RegExp(`(?:^|[;{\\s])${property}\\s*:\\s*calc\\(\\s*(-?[\\d.]+)px\\s*/\\s*var\\(--scale`),
      );
      expect(found, `${property} is not a screen-measured length`).not.toBeNull();
      return Number(found![1]);
    };

    const badgeIn = screenPx(ownRule(".version-badge-se") ?? "", "right");
    // The handle hangs OUTSIDE the corner, so its offset is negative and the
    // distance it reaches back inside the edge is its width plus that offset.
    const handleOut = -screenPx(ownRule(".resize-handle-se") ?? "", "right");
    const handleSize = screenPx(ownRule(".resize-handle") ?? "", "width");
    const handleIn = handleSize - handleOut;

    expect(
      badgeIn,
      `the badge's right edge is ${badgeIn}px in and the handle reaches ${handleIn}px in — a press near the badge resizes`,
    ).toBeGreaterThan(handleIn);
  });

  it("gives the outline a visible width at every zoom", () => {
    // 2 world px at 5% is 0.11 on screen; 2px / --scale is 2 at any zoom.
    const rules = rulesFor(".item.selected");
    expect(rules.length).toBeGreaterThan(0);
    for (const body of rules) {
      if (!/outline\s*:/.test(body)) continue;
      expect(body, "an outline in world pixels").toMatch(
        /outline:\s*calc\(\s*[\d.]+px\s*\/\s*var\(--scale/,
      );
    }
  });

  it("publishes the scale for CSS to divide by", () => {
    const viewport = readFileSync(
      fileURLToPath(new URL("../src/components/CanvasViewport.tsx", import.meta.url)),
      "utf8",
    );
    expect(viewport, "--scale must be set where the world transform is").toMatch(
      /"--scale":\s*viewport\.scale/,
    );
  });

  /**
   * The star is always on the right, whatever else is in the row.
   *
   * Hiding the name at small sizes sent it to the LEFT edge, because
   * `space-between` puts a lone child at the start — the exact swap ItemView's
   * own comment says must never happen ("a name that grows rightward from
   * there runs off the item entirely"). `margin-left: auto` pins it regardless
   * of siblings, so the rule does not depend on what else happens to render.
   */
  it("keeps the star on the right when it is the only thing in the row", () => {
    const right = rulesFor(".chrome-right").join(" ");
    expect(right, ".chrome-right must not rely on a sibling to sit right").toMatch(
      /margin-left:\s*auto/,
    );
  });
});

/**
 * **Every piece of item chrome holds its screen size by ONE of two means.**
 *
 * The sweep above guards one of them — a box that must stay in world
 * coordinates divides its lengths by `var(--scale)`. The other is a
 * counter-scaling transform applied in JS, and until now nothing checked it,
 * because the rule for it lived as `{ transform: scale(1 / scale) }` written
 * inline at each render site. A site that simply did not write it was
 * indistinguishable from one that had no need to.
 *
 * That is exactly what happened to the reaction row. It shipped with
 * `transform-origin: left top` in its CSS — the half of the pattern that does
 * nothing on its own — and no transform, so the chips were drawn in WORLD
 * pixels: correct at 100% zoom, where it was verified, and under two pixels
 * tall on a canvas at 15%, where it was reported. Every other piece of chrome
 * in the same component was right, which is why review read past it.
 *
 * So the transform has one home, `counterScale`, and this asks each chrome
 * element which of the two it uses. A new one that answers neither fails.
 */
describe("chrome holds its size, by transform or by --scale", () => {
  const sources: Record<string, string> = {
    ItemView: readFileSync(
      fileURLToPath(new URL("../src/components/ItemView.tsx", import.meta.url)),
      "utf8",
    ),
    Reactions: readFileSync(
      fileURLToPath(new URL("../src/components/Reactions.tsx", import.meta.url)),
      "utf8",
    ),
  };
  const everySource = Object.values(sources).join("\n");

  /**
   * The chrome an item wears that holds its size with a TRANSFORM, and the
   expression each one's own JSX has to carry.
   *
   * Asked per ELEMENT, not per file. The first version of this searched the
   * whole source for `style={chrome}` and asked it once per entry — so every
   * entry passed as long as ANY element in the file was counter-scaled, which
   * is lesson #16's shape exactly: a check a relative can satisfy. It went
   * green for `.item-titlebar`, which is not counter-scaled by JS at all, and
   * it stayed green through a refactor that changed which elements carry a
   * transform. Now each entry names the expression it must be holding.
   */
  const CHROME: { className: string; where: string; carries: RegExp }[] = [
    { className: "item-under", where: "ItemView", carries: /style=\{underRow\(/ },
    { className: "chrome-left", where: "ItemView", carries: /\.\.\.chrome,/ },
  ];

  it("renders each one with the counter-scale from its one home", () => {
    for (const { className, where, carries } of CHROME) {
      const source = sources[where]!;
      // The element exists where we say it does — otherwise this whole
      // describe passes by looking for nothing (#16).
      expect(source, `${className} is not rendered in ${where}`).toContain(className);
      expect(carries.test(source), `${where} renders ${className} but never counter-scales`).toBe(
        true,
      );
    }
  });

  it("keeps that home a single function, not a transform written out again", () => {
    // The failure mode this replaces: `{ transform: `scale(${1 / scale})` }`
    // typed at each site, which is a rule with no name and therefore no way
    // to notice a site that skipped it.
    expect(everySource).not.toMatch(/transform:\s*`scale\(\$\{1 \/ scale\}\)`/);
    expect(everySource).toMatch(/counterScale/);
  });

  it("pairs a transform-origin with an actual transform", () => {
    // `transform-origin` alone is the tell that somebody meant to scale and
    // did not: it is inert without a transform, so it never looks wrong. It
    // was the only trace the reaction row's bug left in the stylesheet.
    //
    // A transform may arrive from either side, and both are legitimate — the
    // chrome list above counter-scales in JS, and `.item-thumb-page` takes a
    // fit-to-thumb `scale()` the same way. So the requirement is only that
    // ONE of them exists: this rule declares a transform, or the component
    // that renders the class applies one.
    const named = new Set(CHROME.map((c) => c.className));
    const components = readdirSync(
      fileURLToPath(new URL("../src/components", import.meta.url)),
    ).filter((f) => f.endsWith(".tsx"));
    const appliesTransform = (cls: string): boolean =>
      components.some((file) => {
        const text = readFileSync(
          fileURLToPath(new URL(`../src/components/${file}`, import.meta.url)),
          "utf8",
        );
        return text.includes(cls) && /transform:|counterScale|style=\{chrome\}/.test(text);
      });

    for (const rule of allRules()) {
      if (!/transform-origin/.test(rule.body)) continue;
      for (const selector of rule.selectors) {
        const cls = selector.match(/^\.([-\w]+)$/)?.[1];
        if (!cls || !cls.startsWith("item-")) continue;
        if (named.has(cls)) continue;
        if (/transform:/.test(rule.body)) continue;
        expect(
          appliesTransform(cls),
          `.${cls} sets transform-origin and nothing ever transforms it`,
        ).toBe(true);
      }
    }
  });
});

/**
 * **The `+` waits for a click, not a hover.**
 *
 * It sits under the item and opens a picker under ITSELF, so the trip from
 * the button to the emoji leaves the item's own box. On hover that ends the
 * hover, `visible` goes false, and the picker unmounts partway through the
 * journey — you could open it every time and click it never, which is worse
 * than a control that plainly does not work, because it looks like it does.
 *
 * The usual patches are a close-delay or an invisible bridge across the gap.
 * Selection is the sticky version of the same signal and was already being
 * passed in, so gating on it alone makes the bug unreachable rather than
 * narrow. Frozen here because "also show it on hover" is a one-word change
 * that reads like an improvement.
 */
describe("the react button is gated on selection", () => {
  const itemView = readFileSync(
    fileURLToPath(new URL("../src/components/ItemView.tsx", import.meta.url)),
    "utf8",
  );

  it("passes selection alone as the reason to show it", () => {
    const call = itemView.match(/<Reactions[\s\S]*?\/>/);
    expect(call, "ItemView no longer renders <Reactions>").toBeTruthy();
    expect(call![0]).toMatch(/visible=\{selected\}/);
    expect(call![0], "hover cannot survive the trip to the picker").not.toMatch(
      /visible=\{[^}]*(hovered|peeked)/,
    );
  });

  it("keeps worn marks visible without any of that", () => {
    // The gate is only the `+`. An item wearing marks shows them to everyone
    // at all times — that is the whole point of putting them on the canvas.
    const reactions = readFileSync(
      fileURLToPath(new URL("../src/components/Reactions.tsx", import.meta.url)),
      "utf8",
    );
    expect(reactions).toMatch(/if \(reactions\.length === 0 && !visible\) return null;/);
  });
});

/**
 * **One row under the item, carrying everything that goes there.**
 *
 * It was two absolutely-positioned elements. The marks row appeared whenever
 * an item was selected (that is when the `+` shows) but the strip below only
 * stepped out of its way when the item WORE marks — so a selected unmarked
 * item, which is every item on a fresh canvas the moment you click it, drew
 * the `+` straight through "Full screen". Keying the clearance on selection
 * too fixed the overlap and left two half-empty rows of chrome instead.
 *
 * One flex row fixes both, and deletes the clearance rule rather than
 * correcting it. Frozen here because splitting it again is the obvious way to
 * add the next thing that wants to live under an item.
 */
describe("the row under an item is one row", () => {
  const itemView = readFileSync(
    fileURLToPath(new URL("../src/components/ItemView.tsx", import.meta.url)),
    "utf8",
  );

  it("puts the marks and the strip in the same wrapper", () => {
    const row = itemView.match(/<div className="item-under"[\s\S]*?\n {8}<\/div>/);
    expect(row, "no .item-under wrapper").toBeTruthy();
    expect(row![0]).toContain("<Reactions");
    expect(row![0]).toContain("item-hint");
  });

  it("has no clearance rule left to get wrong", () => {
    // The fix was deleting the workaround, not tuning it.
    expect(css).not.toContain("under-reactions");
    expect(itemView).not.toContain("under-reactions");
  });

  it("anchors that row to the item's left edge, and scales from that corner", () => {
    // The marks are always in the same place: the row grows rightward and the
    // `+` never moves. Centring made the whole group shift every time a mark
    // was added or the size chip changed width.
    //
    // The pin and the origin are ONE decision. A box pinned to both edges is
    // the item's WORLD width, and scaling that from anywhere but the corner it
    // is pinned to throws the contents off the side of the item — which is
    // what `flex-end` did, and what `flex-start` in a `left: 0; right: 0` box
    // does in the other direction. Shrink-wrapped, pinned left, scaled from
    // left: the row lands where it looks like it will.
    const rule = allRules().find((r) => r.selectors.includes(".item-under"));
    expect(rule, ".item-under has no rule").toBeTruthy();
    expect(rule!.body).toMatch(/left:\s*0/);
    expect(rule!.body, "a right pin makes this the item's full world width").not.toMatch(
      /right:\s*0/,
    );
    expect(rule!.body).toMatch(/transform-origin:\s*left top/);
  });

  it("gives the row the item's SCREEN width, which is what makes it a row", () => {
    // A centre and a right edge only exist if the row knows how wide the item
    // is. Pinning it to both edges would give it the item's WORLD width, which
    // counter-scaling then multiplies by 1/scale — at 20% zoom that box is
    // five times the item and every alignment but centre lands off it.
    const itemView = readFileSync(
      fileURLToPath(new URL("../src/components/ItemView.tsx", import.meta.url)),
      "utf8",
    );
    expect(itemView).toMatch(/style=\{underRow\(width, scale\)\}/);
  });

  it("holds the three slots apart: marks left, hint centred, size right", () => {
    // The whole arrangement, stated as the three rules that produce it.
    const body = (selector: string) => {
      const rule = allRules().find((r) => r.selectors.includes(selector));
      expect(rule, `${selector} has no rule`).toBeTruthy();
      return rule!.body;
    };
    // Left: never moves, never shrinks.
    expect(body(".item-reactions")).toMatch(/flex:\s*none/);
    // Middle: takes the REMAINING room and centres in it, so it starts centred
    // under the item and is nudged right as marks accumulate. A fixed centre
    // would let the hint sit under the marks.
    expect(body(".item-hint.under-mid")).toMatch(/flex:\s*1/);
    expect(body(".item-hint.under-mid")).toMatch(/justify-content:\s*center/);
    // Right: hard against the item's right edge.
    expect(body(".item-hint.under-right")).toMatch(/margin-left:\s*auto/);
  });

  it("puts the marks FIRST in that row, so they are the leftmost thing", () => {
    const row = readFileSync(
      fileURLToPath(new URL("../src/components/ItemView.tsx", import.meta.url)),
      "utf8",
    ).match(/<div className="item-under"[\s\S]*?\n {8}<\/div>/)![0];
    expect(row.indexOf("<Reactions")).toBeLessThan(row.indexOf("item-hint"));
  });

  it("keeps the transient half fading on its own", () => {
    // Marks are persistent; the hint is not. One opacity for both would fade
    // the marks with it.
    const hint = allRules().find((r) => r.selectors.includes(".item-hint"));
    expect(hint!.body).toMatch(/opacity:\s*0/);
    expect(rulesFor(".item-reactions").join(";")).not.toMatch(/opacity:\s*0/);
  });
});
