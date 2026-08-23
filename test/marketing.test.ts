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

  it("lets the intrinsic ratio win", async () => {
    const css = await read("marketing/style.css");
    // Every rule that gives an image a width must leave its height alone.
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const rule of bare.matchAll(/([^{}]*img[^{}]*)\{([^}]*)\}/g)) {
      const [, selector, body] = rule;
      if (!/(^|[;\s])width\s*:/.test(body ?? "")) continue;
      expect(body, `${selector?.trim()} sizes an image without height: auto`).toMatch(
        /height\s*:\s*auto/,
      );
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
