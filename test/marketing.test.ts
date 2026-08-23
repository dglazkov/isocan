import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The marketing page ships a screenshot, and a stretched screenshot of a
 * design tool is the worst possible first impression.
 *
 * It shipped stretched. `width`/`height` attributes on an <img> are
 * presentational hints with a USED value, so a stylesheet that sets `width`
 * and says nothing about height leaves the attribute's height in force: the
 * picture was drawn 1158 wide by 1346 tall, to a ratio nobody chose. The
 * attributes are still worth having — they reserve the right box before the
 * bytes arrive — but only `height: auto` turns them back into a hint.
 *
 * Both halves are checked here, because either one alone is a stretched
 * image: the attributes have to match the file on disk, and the stylesheet
 * has to let the intrinsic ratio win.
 */

const repo = fileURLToPath(new URL("..", import.meta.url));
const read = (rel: string) => fs.readFile(path.join(repo, rel), "utf8");

/** Every rule in the stylesheet whose selector list mentions <img>. */
async function imageRules(): Promise<{ selectors: string[]; body: string }[]> {
  const css = (await read("marketing/style.css")).replace(/\/\*[\s\S]*?\*\//g, "");
  const out: { selectors: string[]; body: string }[] = [];
  for (const rule of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const selectors = (rule[1] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    // `img` as its own element token — not `.image-frame`, not `imgx`.
    if (!selectors.some((s) => /(^|[\s>+~])img\b/.test(s))) continue;
    out.push({ selectors, body: rule[2] ?? "" });
  }
  return out;
}

/** Width and height out of a PNG's IHDR, which is always the first chunk. */
async function pngSize(rel: string): Promise<{ width: number; height: number }> {
  const head = await fs.readFile(path.join(repo, rel));
  expect(head.subarray(1, 4).toString(), `${rel} is not a PNG`).toBe("PNG");
  return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
}

describe("the marketing page", () => {
  it("declares each image at the size it actually is", async () => {
    const html = await read("marketing/index.html");
    const tags = [...html.matchAll(/<img[^>]*>/g)].map((m) => m[0]);
    expect(tags.length).toBeGreaterThan(0);
    for (const tag of tags) {
      const src = /src="([^"]+)"/.exec(tag)?.[1];
      const width = Number(/width="(\d+)"/.exec(tag)?.[1]);
      const height = Number(/height="(\d+)"/.exec(tag)?.[1]);
      expect(src, `an <img> with no src: ${tag}`).toBeTruthy();
      expect(Number.isFinite(width) && Number.isFinite(height), `${src} declares no size`).toBe(true);
      const real = await pngSize(path.join("marketing", src!));
      expect({ width, height }, `${src} is declared at the wrong size`).toEqual(real);
    }
  });

  /**
   * Stated as an invariant rather than as "don't repeat my mistake".
   *
   * The first version of this checked that any rule setting an image's WIDTH
   * also set `height: auto`, which is the exact keystroke that caused the bug
   * and almost nothing else. Mutation testing found the hole in a minute:
   * size the image with `max-width` instead and the picture squashes to the
   * same 1158x1346, with the test green. A presentational hint loses to ANY
   * author height declaration, so the real invariant is not about width at
   * all — every image gets `height: auto`, and nothing takes it away.
   */
  it("gives every image height: auto, so the attribute stays a hint", async () => {
    const rules = await imageRules();
    const blanket = rules.filter((r) => r.selectors.includes("img"));
    expect(blanket.length, "no bare `img` rule to carry height: auto").toBeGreaterThan(0);
    expect(
      blanket.some((r) => /(^|[;{\s])height\s*:\s*auto/.test(r.body)),
      "no rule applies `height: auto` to all images — an <img> added tomorrow " +
        "would be drawn to whatever its height attribute says",
    ).toBe(true);
  });

  it("never pins an image's height", async () => {
    for (const rule of await imageRules()) {
      // max-height, min-height and line-height are different properties and
      // none of them overrides the intrinsic ratio.
      const height = /(?:^|[;{\s])height\s*:\s*([^;}]+)/.exec(rule.body)?.[1]?.trim();
      if (height === undefined) continue;
      expect(height, `${rule.selectors.join(", ")} pins an image's height`).toBe("auto");
    }
  });

  it("has no build step to forget", async () => {
    const html = await read("marketing/index.html");
    // Relative, self-contained, openable from file:// — which is how anybody
    // reviewing it will actually open it.
    expect(html).toContain('href="style.css"');
    expect(html).not.toMatch(/src="\/(?!\/)/);
  });
});
