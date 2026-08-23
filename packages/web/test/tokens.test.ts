import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Colours come from tokens, so both themes work by construction.
 *
 * The bug this exists to prevent is quiet: a literal that happens to read on
 * one ground and vanishes on the other. It shipped as black-on-graphite text
 * in a card, and it was not even a colour declaration — it was a <button> with
 * no `color`, taking the UA's black.
 *
 * Two literals are allowed and both are argued for in the file: an alpha mask
 * (where #000 means "keep this pixel"), and the white behind an iframe showing
 * somebody else's page.
 */

const css = readFileSync(fileURLToPath(new URL("../src/styles.css", import.meta.url)), "utf8");

/** The :root blocks are where literal colour belongs. */
const outsideTokens = css.replace(/:root[^{]*\{[^}]*\}/gs, "");
/** Comments discuss colours by name; they do not set them. */
const declarations = outsideTokens.replace(/\/\*.*?\*\//gs, "");

const ALLOWED = [
  // An alpha mask: black keeps the pixel, transparent drops it.
  /mask-image:[^;]*#000/g,
  // A real page assumes a white canvas; see the note in the file.
  /\.(html|browser)-view\s*\{[^}]*#fff/g,
];

describe("colours come from tokens", () => {
  it("declares no literal colour outside the token blocks", () => {
    let text = declarations;
    for (const allowed of ALLOWED) text = text.replace(allowed, "");
    const literals = text.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\([^)]*\)|:\s*(white|black)\b/g) ?? [];
    expect(
      literals,
      "use a token, or add a token — a literal reads on one ground and vanishes on the other",
    ).toEqual([]);
  });

  it("gives every token a value in both themes", () => {
    const names = (block: string) => new Set([...block.matchAll(/--([a-z-]+):/g)].map((m) => m[1]!));
    const light = /:root,\s*:root\[data-theme="light"\]\s*\{(.*?)\n\}/s.exec(css);
    const dark = /:root\[data-theme="dark"\]\s*\{(.*?)\n\}/s.exec(css);
    expect(light && dark).toBeTruthy();
    const missing = [...names(light![1]!)].filter((n) => !names(dark![1]!).has(n));
    // Sizes and radii are theme-independent; colours are not.
    const colourish = missing.filter((n) => !["radius"].includes(n));
    expect(colourish, "these tokens have no dark value").toEqual([]);
  });

  it("makes buttons inherit their colour", () => {
    // The actual bug: a <button> with a background and no colour paints the
    // UA's buttontext. Black on white looks deliberate; black on graphite is
    // an empty card.
    expect(css).toMatch(/button[^{]*\{[^}]*color:\s*inherit/);
  });
});
