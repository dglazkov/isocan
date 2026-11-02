import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GUIDE_CANVASES } from "../src/lib/guides.ts";
import { GuideLinks } from "../src/components/HelpPanel.tsx";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/**
 * The guide canvases are addresses a stranger follows from a README or a help
 * panel. A dead one is worse than none, so the list holds its shape here, and
 * the README is read back so the prose and the app name the same canvases.
 */
describe("guide canvases", () => {
  it("every guide is a canvas at isocan.io, with a title and a line about it", () => {
    expect(GUIDE_CANVASES.length).toBeGreaterThan(0);
    for (const guide of GUIDE_CANVASES) {
      expect(guide.url).toMatch(/^https:\/\/isocan\.io\/p\/prj_[A-Za-z0-9_-]{10}$/);
      expect(guide.title.trim()).toBe(guide.title);
      expect(guide.title.length).toBeGreaterThan(0);
      expect(guide.about.length).toBeGreaterThan(0);
    }
    expect(new Set(GUIDE_CANVASES.map((g) => g.url)).size).toBe(GUIDE_CANVASES.length);
  });

  it("the README points at the same canvases the app does", () => {
    const readme = readFileSync(path.join(repo, "README.md"), "utf8");
    for (const guide of GUIDE_CANVASES) expect(readme).toContain(guide.url);
  });

  /**
   * The front page deliberately carries no link but the repo — Scene 0's
   * rule, held by `frontdoor.test.ts` — so the app's door to these canvases
   * is the help panel, behind ?. Each opens in a new tab: a guide must not
   * replace the canvas the reader was working on.
   */
  it("the help panel lists every guide, each opening in a new tab", () => {
    const html = renderToStaticMarkup(h(GuideLinks));
    for (const guide of GUIDE_CANVASES) {
      expect(html).toContain(`href="${guide.url}" target="_blank" rel="noreferrer"`);
      expect(html).toContain(guide.title);
    }
  });
});
