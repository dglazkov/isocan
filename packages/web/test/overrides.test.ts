import { describe, expect, it } from "vitest";

import { rules, withoutComments } from "./cssrules.ts";

/**
 * **A container that flattens its children will flatten the one that declared
 * itself, and the tie is invisible until somebody looks at it.**
 *
 * `.bar-cluster .btn { background: none }` and `.btn.primary { background:
 * var(--accent) }` are both specificity (0,2,0). Source order decides, the
 * container rule is later, and so a primary button placed in the bar lost its
 * fill while keeping `--accent-ink` — white text on a white panel, invisible
 * until hover, at which point the container's `:hover` painted `--chip` behind
 * it and it became white on pale grey.
 *
 * The Rename button in the identity menu was exactly this. What makes it worth
 * a guard rather than a fix is the SHAPE: the previous author hit the same tie
 * on `.active`, and solved it by re-adding the fill for `.active` alone —
 * which works, and leaves every other variant to be discovered one bug report
 * at a time.
 *
 * So this finds the ties rather than listing the variants. A container rule
 * that paints a component must exclude the variants that paint themselves, or
 * out-specify them on purpose.
 */
const VARIANT_PAINTS = /(^|;)\s*(background|background-color|border-color|border)\s*:/;

interface Painter {
  selector: string;
  index: number;
  base: string;
  variant: string | null;
}

/** `(a,b,c)` for a selector, counting ids, classes/attrs/pseudo-classes, and
 *  elements. Enough to compare two selectors that differ only in shape. */
function specificity(selector: string): number {
  const ids = (selector.match(/#[\w-]+/g) ?? []).length;
  const classes = (selector.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) ?? []).length;
  return ids * 100 + classes * 10;
}

describe("a container does not flatten a component that paints itself", () => {
  const sheet = rules(withoutComments()).filter((r) => VARIANT_PAINTS.test(r.body));

  /** Rules of the form `.base.variant` — a component saying what it is. */
  const variants: Painter[] = [];
  /** Rules of the form `.container .base` — somebody else restyling it. */
  const containers: Painter[] = [];

  sheet.forEach((rule, index) => {
    for (const one of rule.selector.split(",").map((s) => s.trim())) {
      const compound = one.match(/^\.([\w-]+)\.([\w-]+)$/);
      if (compound) {
        variants.push({ selector: one, index, base: compound[1]!, variant: compound[2]! });
        continue;
      }
      const descendant = one.match(/^\.([\w-]+)\s+\.([\w-]+)$/);
      if (descendant) {
        containers.push({ selector: one, index, base: descendant[2]!, variant: null });
      }
    }
  });

  it("finds both kinds — a search over nothing always passes", () => {
    expect(variants.length, "no `.base.variant` painters found").toBeGreaterThan(2);
    expect(containers.length, "no `.container .base` painters found").toBeGreaterThan(0);
  });

  it("has no container rule that silently beats a variant of the same thing", () => {
    const ties: string[] = [];
    for (const container of containers) {
      for (const variant of variants) {
        if (variant.base !== container.base) continue;
        if (specificity(container.selector) < specificity(variant.selector)) continue;
        if (container.index < variant.index) continue; // the variant wins on order
        // Excluding the variant by name is the fix, and it is visible here.
        if (container.selector.includes(`:not(.${variant.variant})`)) continue;
        ties.push(`${container.selector} beats ${variant.selector}`);
      }
    }
    expect(
      ties,
      "a container rule paints a component AFTER the variant that paints itself, at equal or " +
        "higher specificity — exclude the variant with :not(), or the variant loses its fill",
    ).toEqual([]);
  });
});
