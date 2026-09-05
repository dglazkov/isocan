import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const view = read("../src/components/ItemView.tsx");
const css = read("../src/styles.css");

/**
 * **The blank rectangle, explained.** The daemon warns before an item is
 * made for a site whose headers refuse framing; a site that starts and
 * stops, or whose headers lie, still ended as a white box with no account
 * of itself. A cross-origin frame tells the page nothing about what it
 * drew, but it fires `load` — so a frame that has not loaded after eight
 * seconds says so, with the one door that always works, and the note
 * leaves the moment the frame loads.
 */
describe("a site that will not frame says so", () => {
  it("waits a stated while for load, then says what may be happening, with the tab as the door", () => {
    expect(view).toContain("const SITE_SLOW_MS = 8000;");
    expect(view).toContain('onLoad={() => setState("loaded")}');
    expect(view).toContain('{state === "slow" && (');
    expect(view).toContain("some sites refuse to be shown in a frame");
    expect(view).toContain("Open it in a tab ↗");
  });

  it("never claims to know what the frame drew — only that it has not loaded", () => {
    const frame = view.slice(view.indexOf("function SiteFrame"), view.indexOf("function SiteFrame") + 2200);
    expect(frame).not.toMatch(/contentDocument|contentWindow/);
    expect(frame).toContain("a browser does not say which");
  });

  it("hangs under the frame, in the item's own panel colours", () => {
    expect(css).toContain(".browser-slow {");
    expect(css).toContain("position: absolute; left: 10px; right: 10px; bottom: 10px;");
  });
});
