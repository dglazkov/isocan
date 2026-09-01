import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  fileURLToPath(new URL("../src/styles.css", import.meta.url)),
  "utf8",
);

/**
 * **A control inside the pill is a smaller copy of the pill — lit or not.**
 *
 * Reported as "the Share button when it's blue breaks out of the ( ) behind
 * it and looks janky", and it was self-inflicted the same day. One rule
 * carried BOTH the pill's shape (height, flat padding, 999px corners) and
 * its paint (transparent fill, no border). Fixing an unrelated contrast bug
 * added `:not(.primary):not(.active)` to that rule so the variants would keep
 * their fill — and silently took the SHAPE off them too. A lit button fell
 * back to the base `.btn`: 6px corners and 6px of vertical padding, taller
 * than the pill's inside, square against a curve.
 *
 * The lesson is the shape of the rule, not the pixels: **a selector that
 * excludes variants must not be the one carrying the geometry everything
 * needs.** So the guard is structural — find the rule that sets the pill's
 * height and insist it applies to every button in the cluster.
 */
describe("the pill's shape belongs to every control in it", () => {
  const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].map((m) => ({
    selector: m[1]!.trim(),
    body: m[2]!,
  }));

  const shaping = rules.filter(
    (rule) =>
      rule.selector.includes(".bar-cluster") &&
      rule.selector.includes(".btn") &&
      /--pill-h/.test(rule.body),
  );

  it("is set somewhere, or this guard is watching nothing", () => {
    expect(shaping.length, "no .bar-cluster .btn rule sets a height from --pill-h").toBeGreaterThan(
      0,
    );
  });

  it("is not withheld from the lit or primary ones", () => {
    for (const rule of shaping) {
      expect(
        rule.selector,
        `"${rule.selector}" carries the pill geometry but excludes a variant — ` +
          `a lit button will fall back to the base .btn and break out of the pill`,
      ).not.toMatch(/:not\(\.(active|primary)\)/);
    }
  });

  it("keeps the paint on its own selector, where excluding variants is right", () => {
    // The contrast fix this regressed out of is still the correct rule: only
    // the QUIET buttons go transparent, or a primary washes out to white on
    // white. It just must not be the rule that shapes them.
    const painting = rules.filter(
      (rule) =>
        rule.selector.includes(".bar-cluster") &&
        rule.selector.includes(".btn") &&
        /background:\s*none/.test(rule.body),
    );
    expect(painting.length).toBeGreaterThan(0);
    for (const rule of painting) {
      expect(rule.selector, `"${rule.selector}" washes out every variant`).toMatch(
        /:not\(\.primary\)/,
      );
      expect(rule.selector).toMatch(/:not\(\.active\)/);
    }
  });
});
