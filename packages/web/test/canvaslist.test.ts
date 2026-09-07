import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { rules, withoutComments } from "./cssrules.ts";

/**
 * **The home screen, at ten canvases and at a hundred.**
 *
 * It showed a date and a name — `8/17/2026 · Admiral One` — which says when
 * somebody was here and nothing about what they did. And the date was wrong:
 * `updatedAt` moved only on a RENAME, so a canvas worked on all week reported
 * the day it was last retitled. Sorting by "recent activity" on that field
 * would have ordered the list by something nobody was thinking about, quietly,
 * which is the worst way to be wrong.
 */
const page = readFileSync(
  fileURLToPath(new URL("../src/pages/CanvasListPage.tsx", import.meta.url)),
  "utf8",
);
const bare = page
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  .replace(/\/\/.*$/gm, "");

describe("what a card says", () => {
  it("names the act, not just the actor", () => {
    expect(bare).toMatch(/opWords\(canvas\.lastOp\)/);
  });

  it("says how long ago, and keeps the exact time within reach", () => {
    /* Relative is what a person reads; the stamp is what they check. Losing
       the second to gain the first would be a trade nobody asked for. */
    expect(bare).toMatch(/ago\(canvas\.updatedAt, nowMs\)/);
    expect(bare).toMatch(/title=\{new Date\(canvas\.updatedAt\)\.toLocaleString\(\)\}/);
  });

  it("keeps the clock running", () => {
    /* "8m ago" is a lie the moment it is painted. A stamp needs no clock,
       which is exactly what this screen used to be. */
    expect(bare).toMatch(/setInterval\(\(\) => setNowMs/);
  });

  it("takes its words from core, not from a list of its own", () => {
    /* The card, a timeline tick and `isocan canvas list` describe one event
       with one set of words, or they drift. */
    expect(bare).not.toMatch(/"added something"|"moved something"/);
  });
});

describe("browsing a hundred", () => {
  it("sorts and filters with the shared functions", () => {
    /* A home screen and `isocan canvas list` disagreeing about which canvas is
       most recent is the drift core exists to prevent. */
    expect(bare).toMatch(/sortCanvases\(/);
    expect(bare).toMatch(/filterCanvases\(/);
  });

  it("filters before it sorts, with the shelf narrowed before either", () => {
    /* Ordering what is about to be discarded is work nobody sees, and at a
       hundred canvases it is real. The archive scope (#194) narrows first for
       the same reason, and because the count on screen must describe the set
       on screen. Asserted as nesting rather than adjacency: `sortCanvases(`
       must OPEN before `filterCanvases(` does, which is what "sorts the
       filtered list" means however many scopes sit between them. */
    const sortAt = bare.indexOf("sortCanvases(");
    const filterAt = bare.indexOf("filterCanvases(");
    const scopeAt = bare.indexOf("inScope(");
    expect(sortAt).toBeGreaterThan(-1);
    expect(sortAt).toBeLessThan(filterAt);
    expect(filterAt).toBeLessThan(scopeAt);
  });

  it("shows the controls only when there are enough to need them", () => {
    /* A filter above four cards is furniture that makes a small home look
       like an admin console. */
    expect(bare).toMatch(/canvases\?\.length \?\? 0\) > BROWSE_FROM/);
  });

  it("counts what the person HAS, not what is showing", () => {
    /* Testing the filtered length would remove the box you are typing into
       the moment a query matched few enough canvases. */
    expect(bare).not.toMatch(/shown\.length > BROWSE_FROM/);
  });

  it("says so when a filter matches nothing", () => {
    /* An empty grid looks exactly like a home with no canvases, and one of
       those is somebody's whole afternoon missing. */
    expect(bare).toMatch(/Nothing matches/);
  });

  it("remembers the ordering, and survives a browser that refuses storage", () => {
    expect(bare).toMatch(/localStorage\.setItem\(SORT_KEY/);
    expect(bare).toMatch(/isCanvasSort\(raw\)/);
    expect(bare).toMatch(/catch \{/);
  });
});

/**
 * **Archive was a one-way door on a small home** (#194).
 *
 * `Archived` shipped nested inside the size gate, so on a home of
 * `BROWSE_FROM` canvases or fewer the control did not exist — archive one
 * there and it left the list with nothing anywhere in the app to bring it
 * back. Only the CLI could, which is the isomorphism failing in the direction
 * that strands a person rather than an agent.
 *
 * Found by opening the app on a home of four and clicking Archive, which is
 * the only way it could have been found: every unit here passed, because the
 * two conditions were each correct and only their NESTING was wrong.
 *
 * The rule the guard holds is the one the bug broke: **the shelf's control
 * asks about the shelf, and nothing else.**
 */
describe("the shelf's control does not depend on the list being long", () => {
  it("gates Archived on there being a shelf, on its own", () => {
    expect(bare).toMatch(/const hasShelf = \(canvases \?\? \[\]\)\.some\(isShelved\)/);
    expect(bare).toMatch(/\{hasShelf && \(/);
  });

  it("opens the row for either reason", () => {
    // `browsing || hasShelf` — a home with four canvases and one archived has
    // a row; a home with four and none has no furniture at all.
    expect(bare).toMatch(/\{\(browsing \|\| hasShelf\) && \(/);
  });

  it("still keeps the filter and the sort behind the size gate", () => {
    /* The other half of the split: a row that appeared because of a shelf must
       not bring a search box and a sort menu with it onto a home of four. */
    expect(bare).toMatch(/\{browsing && \(\s*<input/);
    expect(bare).toMatch(/\{browsing &&\s*CANVAS_SORTS\.map/);
  });
});

describe("the browse controls' stylesheet", () => {
  const sheet = rules(withoutComments()).filter((r) => /\.canvas-(browse|filter|sorts|none)/.test(r.selector));

  it("exists", () => {
    expect(sheet.length).toBeGreaterThan(0);
  });

  it("takes every colour from a token", () => {
    for (const r of sheet) expect(r.body).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("lets the filter shrink rather than pushing the row apart", () => {
    const filter = sheet.find((r) => r.selector.includes(".canvas-filter"));
    expect(filter?.body).toMatch(/min-width:\s*0/);
  });
});
