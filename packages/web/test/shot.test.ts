import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { CANVAS_SHOT } from "../src/lib/shot.ts";
import { FrontPage } from "../src/pages/FrontPage.tsx";

/**
 * **The screenshot guard, moved with the screenshot** (was `test/marketing.test.ts`).
 *
 * The front page ships a picture of a canvas, and a stretched picture of a
 * canvas is the worst possible first impression a design tool can make. It
 * shipped stretched once, on `marketing/`, which was the page this one
 * absorbed: `width`/`height` on an `<img>` are presentational hints with a USED
 * value, so a stylesheet that sets `width` and says nothing about height leaves
 * the attribute's height in force. The picture was drawn 1158 wide by 1346
 * tall, to a ratio nobody chose.
 *
 * `marketing/` is gone — a second front door for the same audience at the same
 * address, which nothing served — but the class of bug is not, so the guard
 * came across with the image rather than being deleted alongside the directory.
 * Three of its four cases are the same invariants against the new location:
 *
 *   - the declared size matches the file on disk, now read from `lib/shot.ts`
 *     rather than scraped out of static HTML;
 *   - the stylesheet gives every image `height: auto`;
 *   - and nothing in it pins an image's height.
 *
 * The fourth ("has no build step to forget") did NOT come across, and could
 * not: it asserted `href="style.css"` and no absolute `src`, which was the
 * static site's whole claim on itself — openable from `file://`, nothing to
 * install. The front page is part of an app that Vite builds. What that case
 * was really protecting is the page being self-contained, and that invariant
 * moved to `frontdoor.test.ts`'s "reaches no third-party host", where it is
 * stated against the thing that actually mattered and is stronger than the
 * original: no other origin by any mechanism, and nothing render-blocking at
 * all.
 *
 * The dimension reader below now speaks WebP as well as PNG, because the file
 * is one: 484KB of PNG became 49KB of WebP at half the pixel width, and the
 * bytes matter here in a way they did not on a static site nobody shipped —
 * this one is inside `packages/web/dist`, which every `npx isocan setup`
 * downloads.
 */

const web = fileURLToPath(new URL("..", import.meta.url));
const css = await fs.readFile(path.join(web, "src/styles.css"), "utf8");

/** Every rule in the app stylesheet whose selector list mentions <img>. */
function imageRules(): { selectors: string[]; body: string }[] {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: { selectors: string[]; body: string }[] = [];
  for (const rule of stripped.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const selectors = (rule[1] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    // `img` as its own element token — not `.img-view`, not `imgx`. A class
    // whose NAME contains "img" sizes a box it owns and clips with
    // `object-fit`; it is not an image drawn to a hint.
    if (!selectors.some((s) => /(^|[\s>+~])img\b/.test(s))) continue;
    out.push({ selectors, body: rule[2] ?? "" });
  }
  return out;
}

/**
 * The `height` a rule body actually declares, or nothing.
 *
 * One home for it because three cases ask the same question, and `max-height`,
 * `min-height` and `line-height` are different properties that none of them
 * mean — a substring match on "height" would answer yes for all three.
 */
function declaredHeight(body: string): string | undefined {
  return /(?:^|[;{\s])height\s*:\s*([^;}]+)/.exec(body)?.[1]?.trim();
}

/**
 * Width and height out of the file's own header, for the two formats a
 * screenshot on this page could plausibly be.
 *
 * PNG: IHDR is always the first chunk, so the numbers are at fixed offsets.
 * WebP: a RIFF container whose first chunk says which codec — `VP8 ` (lossy)
 * carries two 14-bit values after the start code, `VP8L` packs 14-bit
 * width-1/height-1 across a bit boundary, and `VP8X` (extended) carries
 * 24-bit width-1/height-1. All three are read, because a re-encode that
 * switched codec must not silently turn this check off (lessons.md #8).
 */
async function imageSize(file: string): Promise<{ width: number; height: number }> {
  const bytes = await fs.readFile(file);
  if (bytes.subarray(1, 4).toString("latin1") === "PNG") {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  expect(bytes.subarray(0, 4).toString("latin1"), `${file} is not a RIFF file`).toBe("RIFF");
  expect(bytes.subarray(8, 12).toString("latin1"), `${file} is not a WebP`).toBe("WEBP");
  const chunk = bytes.subarray(12, 16).toString("latin1");
  if (chunk === "VP8 ") {
    return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === "VP8L") {
    const bits = bytes.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X") {
    const read24 = (at: number) => bytes[at]! | (bytes[at + 1]! << 8) | (bytes[at + 2]! << 16);
    return { width: read24(24) + 1, height: read24(27) + 1 };
  }
  throw new Error(`${file}: unreadable WebP chunk "${chunk}" — teach this reader about it`);
}

describe("the picture on the front page", () => {
  it("declares the size it actually is", async () => {
    // Asserted before the join, so a src that wandered off-origin fails with a
    // sentence rather than with an ENOENT naming a mangled path.
    expect(CANVAS_SHOT.src.startsWith("/"), "the shot must be a same-origin path").toBe(true);
    const file = path.join(web, "public", CANVAS_SHOT.src);
    const real = await imageSize(file);
    expect(
      { width: CANVAS_SHOT.width, height: CANVAS_SHOT.height },
      `${CANVAS_SHOT.src} is declared at the wrong size`,
    ).toEqual(real);
  });

  it("is drawn on the page, at that size, with the words for somebody who cannot see it", () => {
    // Inside a router since phase 13.7: the page's footnote to the terms is a
    // client-side `<Link>`, which throws outside one. It adds no markup, so
    // every assertion below reads the page's own HTML exactly as before.
    const html = renderToStaticMarkup(
      h(MemoryRouter, { initialEntries: ["/"] }, h(FrontPage, { onIdentity: () => {} })),
    );
    const tags = html.match(/<img[^>]*>/g) ?? [];
    expect(tags.length, "the front page draws no image at all").toBe(1);
    const tag = tags[0]!;
    expect(tag).toContain(`src="${CANVAS_SHOT.src}"`);
    expect(tag).toContain(`width="${CANVAS_SHOT.width}"`);
    expect(tag).toContain(`height="${CANVAS_SHOT.height}"`);
    // Alt text is the picture's whole argument for anybody not looking at it,
    // so an empty or perfunctory one is the same failure as no picture.
    const alt = /alt="([^"]*)"/.exec(tag)?.[1] ?? "";
    expect(alt.length, "the screenshot's alt text is missing or thin").toBeGreaterThan(80);
  });

  /**
   * Stated as an invariant rather than as "don't repeat my mistake".
   *
   * The first version of this checked that any rule setting an image's WIDTH
   * also set `height: auto`, which is the exact keystroke that caused the bug
   * and almost nothing else. Mutation testing found the hole in a minute: size
   * the image with `max-width` instead and the picture squashes to the same
   * 1158x1346, with the test green. A presentational hint loses to ANY author
   * height declaration, so the real invariant is not about width at all —
   * every image gets `height: auto`, and nothing takes it away.
   */
  it("gives every image height: auto, so the attribute stays a hint", () => {
    const rules = imageRules();
    expect(rules.length, "no <img> rules found at all — this parse is wrong").toBeGreaterThan(0);
    const blanket = rules.filter((r) => r.selectors.includes("img"));
    expect(blanket.length, "no bare `img` rule to carry height: auto").toBeGreaterThan(0);
    expect(
      blanket.some((r) => /(^|[;{\s])height\s*:\s*auto/.test(r.body)),
      "no rule applies `height: auto` to all images — an <img> added tomorrow " +
        "would be drawn to whatever its height attribute says",
    ).toBe(true);
  });

  it("never pins an image's height", () => {
    for (const rule of imageRules()) {
      // max-height, min-height and line-height are different properties and
      // none of them overrides the intrinsic ratio.
      const height = declaredHeight(rule.body);
      if (height === undefined) continue;
      expect(height, `${rule.selectors.join(", ")} pins an image's height`).toBe("auto");
    }
  });

  /**
   * **The hole mutation testing found in the case above, closed.**
   *
   * `imageRules()` matches `img` as an ELEMENT token — deliberately, so
   * `.img-view` (a box that clips with `object-fit`) is not mistaken for an
   * image drawn to a hint. The cost is that a class NAMED for an image is
   * invisible to it: this page's shot was first written as
   * `.front-shot-img { width: 100%; height: auto }`, and pinning `height:
   * 400px` on that rule reproduced lesson #3 exactly with all 24 cases green.
   * The rule is `.front-shot img` now for that reason.
   *
   * A rename would put the hole straight back, so the frame gets its own
   * prohibition, and it is stated LOOSELY on purpose: any selector whose text
   * mentions `.front-shot` at all, which catches the descendant form, the
   * class-on-the-image form, and anything else somebody names after it.
   * Lessons.md #16 warns that a loose match makes an EXISTENCE check vacuous —
   * a relative answers on the thing's behalf. Here the direction is reversed:
   * over-matching a prohibition can only produce a loud false failure somebody
   * fixes, never a quiet pass. The existence half is the case below.
   */
  it("lets nothing in the shot's frame pin a height", () => {
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const frame = [...stripped.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter((r) =>
      r[1]!.includes(".front-shot"),
    );
    expect(frame.length, "no .front-shot rules found — this parse is wrong").toBeGreaterThan(0);
    for (const rule of frame) {
      const height = declaredHeight(rule[2] ?? "");
      if (height === undefined) continue;
      expect(height, `${rule[1]!.trim()} pins a height inside the shot's frame`).toBe("auto");
    }
  });

  /** And the other half of the pair: the rule that does the job still exists,
   *  under a selector the element-token guard above can actually see. */
  it("still has a rule that gives the shot its ratio back", () => {
    const shot = imageRules().filter((r) => r.selectors.some((s) => s.includes(".front-shot")));
    expect(shot.length, "no `.front-shot img` rule — the guard above sees nothing").toBe(1);
    expect(declaredHeight(shot[0]!.body), "the shot's own rule must say height: auto").toBe("auto");
  });

  /**
   * The bytes, with a number on them.
   *
   * `marketing/img/canvas.png` was 484KB at 2880x1346 and it was excluded from
   * the npm pack for exactly that reason (`.npmignore` said so in prose). The
   * front page's copy has no such escape: it lives under `packages/web/public`,
   * so it is in `dist`, so every `npx isocan setup` pulls it down. A ceiling
   * here is the difference between "we optimised it once" and "it stays
   * optimised" — re-export it at a lazy setting and this fails with the number.
   */
  it("stays small enough to sit inside the CLI's own download", async () => {
    const { size } = await fs.stat(path.join(web, "public", CANVAS_SHOT.src));
    expect(size, `${CANVAS_SHOT.src} is ${Math.round(size / 1024)}KB`).toBeLessThan(80 * 1024);
    // And it is a real picture rather than a placeholder that would make the
    // ceiling above trivially satisfiable.
    expect(size).toBeGreaterThan(10 * 1024);
  });
});
