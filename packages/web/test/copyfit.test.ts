import { describe, expect, it } from "vitest";
import { copyDeck } from "@isocan/core/copy-deck";
import { fitMeasuredOf, fitMisses, withFitProbe } from "../src/lib/copyfit.ts";

/**
 * **The compare's fit probe** (copy-edit phase 4, journey scene 3). The
 * measuring runs inside a sandboxed frame, so only a browser proves it — the
 * `copy-fit` journey in `scripts/journeys.mjs` does. Here: the probe is
 * written into the srcdoc and nowhere else, it is handed each string's
 * address and words (never an attribute string, which has no line boxes),
 * and what a frame reports is judged by core's rule. Synthetic: Acme.
 */

const SCREEN = `<!doctype html><html><head><title>Acme</title></head><body><h1>Review your order</h1><input placeholder="Card"><button>Pay now</button></body></html>`;
const deck = copyDeck(SCREEN);

describe("withFitProbe", () => {
  it("writes the probe before </body> and leaves every other byte alone", () => {
    const probed = withFitProbe(SCREEN, deck);
    const at = SCREEN.lastIndexOf("</body>");
    expect(probed.slice(0, at)).toBe(SCREEN.slice(0, at));
    expect(probed.endsWith(SCREEN.slice(at))).toBe(true);
    expect(probed).toContain("<script data-isocan-fit>");
    expect(probed).toContain('"a":"t1","t":"Review your order","n":1');
    expect(probed).not.toContain("@placeholder");
  });

  it("cannot be closed early by a string's words", () => {
    const evil = copyDeck(`<!doctype html><html><body><p>&lt;/script&gt;&lt;b&gt;</p></body></html>`);
    const probed = withFitProbe("<body></body>", evil);
    expect(probed.match(/<\/script>/g)).toHaveLength(1);
  });
});

describe("fitMisses — what the frame measured, judged by core's rule", () => {
  it("marks the button that wrapped and the heading that overflowed; leaves the rest", () => {
    const measured = fitMeasuredOf({ isocanCopyFit: [{ a: "t1", lines: 1, overflow: true }, { a: "t2", lines: 2, overflow: false }, { a: "nope", lines: 9, overflow: true }, { a: "t2", lines: "x" }] })!;
    expect(measured).toHaveLength(3);
    expect(fitMisses(deck, measured)).toEqual([
      { address: "t1", role: "heading", why: "overflows its box — the heading's words run past the room the layout gives them" },
      { address: "t2", role: "button", why: "two lines in a one-line button" },
    ]);
    expect(fitMeasuredOf({ isocanDiffSize: [1, 2] })).toBeNull();
  });
});
