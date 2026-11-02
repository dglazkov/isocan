import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * **A reset that lists some controls leaves the rest to the platform.**
 *
 * `style.css` dresses this workspace's controls itself — font, colour, ground,
 * border, radius, padding — because it is a room with its own look inside an
 * app with another. It named `button`, `input` and `textarea`, and `select`
 * appeared only in the `:focus-visible` line, which paints nothing.
 *
 * So every dropdown in here rendered as the platform's widget: on macOS a dark
 * popup with a leading ✓ and its own metrics, dropped into a light custom
 * header with no padding of its own. Dion's words were "broken and has weird
 * sizing throughout", which is what a control from a different app looks like.
 * `appearance: none` is what makes any of the rest apply — with the native
 * appearance on, the ground and the border are simply ignored.
 *
 * The rule this asserts is the general one, not the fix: a control this module
 * renders has a base rule, not only a focus rule. The next one added — a
 * range, a date — fails here rather than shipping wearing the OS.
 */
const src = fileURLToPath(new URL("../src", import.meta.url));
const css = readFileSync(path.join(src, "style.css"), "utf8");
const tsx = readdirSync(src)
  .filter((name) => name.endsWith(".tsx"))
  .map((name) => readFileSync(path.join(src, name), "utf8"))
  .join("\n");

/** A rule that paints, as opposed to one that only outlines on focus. */
const dressed = (tag: string): boolean =>
  new RegExp(`\\.anatomy-workspace ${tag}[^{:]*(,[^{]*)?\\{`, "m").test(
    css.replace(/\.anatomy-workspace [a-z]+:focus-visible[^{]*\{[^}]*\}/g, ""),
  );

describe("the workspace dresses every control it renders", () => {
  const used = ["button", "input", "textarea", "select"].filter((tag) =>
    new RegExp(`<${tag}\\b`).test(tsx),
  );

  it("finds the controls at all — a search over nothing always passes", () => {
    expect(used).toContain("select");
    expect(used.length).toBeGreaterThan(2);
  });

  it("gives each one a rule that paints, not only one that outlines on focus", () => {
    const bare = used.filter((tag) => !dressed(tag));
    expect(
      bare,
      "these fall through to the platform widget inside a custom room",
    ).toEqual([]);
  });

  it("turns the native appearance off for select, or the rest is ignored", () => {
    // A macOS select with `appearance: auto` paints itself: the ground, the
    // border and the radius above it are decoration the OS never reads.
    expect(css).toMatch(/\.anatomy-workspace select \{[^}]*appearance: none/);
  });

  it("draws the caret it took away, in tokens rather than a literal", () => {
    // Removing the appearance removes the platform's own arrow, so a select
    // with no caret reads as a text box that mysteriously opens a menu.
    expect(css).toContain(".anatomy-select::after");
    expect(css).toMatch(/\.anatomy-select::after \{[^}]*var\(--ink-soft\)/);
    expect(tsx, "the project picker is the one that shows a caret").toContain(
      '<span className="anatomy-select">',
    );
  });
});
