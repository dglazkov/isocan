import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { rules, withoutComments } from "./cssrules.ts";

/**
 * **What happened before the last thing, without paying for it up front.**
 *
 * The card says the most recent act from the stamp the reducer keeps. Saying
 * what came BEFORE needs the canvas's log, and reading a log per canvas is
 * exactly the cost `lastOp` exists to keep off the home screen: at a hundred
 * canvases an eager version is a hundred log reads to draw a list.
 *
 * So the lazy read is not an optimisation, it is the feature's premise — and
 * that is what this guards.
 */
const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\/.*$/gm, "");

const lib = read("lib/cardpeek.ts");
const card = read("components/CardPeek.tsx");
const page = read("pages/CanvasListPage.tsx");

describe("the card's peek", () => {
  it("reads nothing until somebody asks", () => {
    /* `want` gates the fetch. Without it every card on the page opens a log
       the moment the list renders. */
    expect(lib).toMatch(/if \(!canvasId \|\| !want\) return;/);
  });

  it("remembers what it read, so pointing twice costs once", () => {
    expect(lib).toMatch(/seen\.get\(canvasId\)/);
    expect(lib).toMatch(/seen\.set\(canvasId/);
  });

  it("shows seams, not raw entries", () => {
    /* Forty moves are one ripple. A list of the last five entries would show
       the same drag five times — `majors` is the same significance function
       the timeline track and `isocan timeline` use, so a peek says what a tick
       would say. */
    expect(lib).toContain("majors(entries)");
  });

  it("opens on focus as well as on pointer", () => {
    /* A hover-only affordance does not exist for a keyboard or a touch
       screen, and this holds the only account of what happened before the
       last thing. */
    expect(page).toContain("onPointerEnter");
    expect(page).toContain("onFocus");
    expect(page).toMatch(/onBlur=\{\(e\) => \{[\s\S]{0,200}contains\(e\.relatedTarget/);
  });

  it("says nothing rather than showing an empty box", () => {
    /* A box that appears on hover and explains nothing is worse than no box,
       and "only the one thing" is a real answer about a canvas opened once. */
    expect(card).toMatch(/seams\.length <= 1\) return null/);
  });

  it("survives a log it cannot read", () => {
    /* The card still says what it last did, which is where the useful half
       already was. */
    expect(lib).toMatch(/catch \{/);
  });
});

describe("the peek's stylesheet", () => {
  const sheet = rules(withoutComments()).filter((r) => /\.card-peek/.test(r.selector));

  it("exists and takes its colours from tokens", () => {
    expect(sheet.length).toBeGreaterThan(0);
    for (const r of sheet) expect(r.body).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("sits inside the card rather than floating over the page", () => {
    /* A popover would have to be placed against the viewport; these are three
       short rows the card has room for. */
    for (const r of sheet) expect(r.body).not.toMatch(/position:\s*(absolute|fixed)/);
  });

  it("lines the times up", () => {
    const when = sheet.find((r) => r.selector.includes(".card-peek-when"));
    expect(when?.body).toMatch(/tabular-nums/);
  });
});
