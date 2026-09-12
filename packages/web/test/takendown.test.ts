import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { rules } from "./cssrules.ts";

/**
 * **What a tab does when its canvas has been taken down** — operator phase 2,
 * journey 4 step 1.
 *
 * The thing that must be true here is a thing that is easiest to get wrong by
 * REUSING something: a takedown looks, from a client's point of view, very
 * like the three refusals beside it, and every one of the three does something
 * this one must not. `canvas-deleted` erases the browser's replica.
 * `withdrawn` says an owner removed you. `absent` says there is nothing here.
 *
 * So these read the source for the two properties a rendered assertion would
 * not catch either: that `forgetReplica` is NOT on this path, and that the
 * sentence shown is the HOME's rather than one this bundle composed.
 */

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const strip = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\/.*$/gm, "");

const store = strip(read("../src/stores/canvasStore.ts"));
const canvasPage = strip(read("../src/pages/CanvasPage.tsx"));
const viewer = strip(read("../src/components/Viewer.tsx"));
const list = strip(read("../src/pages/CanvasListPage.tsx"));

describe("the tab, when the home has stopped serving its canvas", () => {
  it("has a state of its own, told apart from deleted, withdrawn and absent", () => {
    expect(store).toMatch(/\|\s*"taken-down"/);
    expect(store).toMatch(/event\.reason === TAKEN_DOWN/);
  });

  it("does NOT forget the replica — that is what a delete does, and this is not one", () => {
    /**
     * The load-bearing negative. `forgetReplica` erases this browser's copy of
     * the canvas; a takedown that called it would be the operator reaching
     * into somebody's browser, which the design says the operator cannot do.
     * It must appear exactly where `canvas-deleted` is handled, and nowhere
     * near the close handler that reads `taken-down`.
     */
    const deleted = store.slice(store.indexOf('message.type === "canvas-deleted"'));
    expect(deleted.slice(0, 400)).toMatch(/forgetReplica/);
    const takenDown = store.slice(store.indexOf("event.reason === TAKEN_DOWN"));
    expect(takenDown.slice(0, 800)).not.toMatch(/forgetReplica/);
  });

  it("asks the HOME for the sentence rather than composing one", () => {
    // A WebSocket close reason is 123 bytes and throws rather than truncating,
    // so the word travels on the socket and the sentence is fetched. The words
    // come from the home, not from whichever bundle is drawing them.
    expect(store).toMatch(/fetchTakedown\(canvasId\)/);
    expect(store).toMatch(/takenDown: TakedownNotice \| null/);
    // And it is per canvas: carrying one across would tell somebody a canvas
    // they just opened had been taken down.
    expect(store.match(/takenDown: null/g) ?? []).toHaveLength(2);
  });

  it("shows the home's sentence on the canvas page, and never says `not found`", () => {
    expect(canvasPage).toMatch(/"taken-down":/);
    expect(canvasPage).toMatch(/takenDown\?\.sentence/);
    // The fallback, for a home that could not be asked, still says the one
    // thing that is certainly true — and still not the two that are not.
    expect(canvasPage).toMatch(/taken down by the operator of this home/);
    const branch = canvasPage.slice(canvasPage.indexOf('"taken-down":'));
    expect(branch.slice(0, 600)).not.toMatch(/not found|was deleted|access .* withdrawn/);
    // And it tells the one thing a person on a laptop most needs to know.
    expect(branch.slice(0, 600)).toMatch(/Nothing has been erased/);
  });

  it("shows it on the viewer too, which is where a view link lands", () => {
    expect(viewer).toMatch(/connection === "taken-down"/);
    expect(viewer).toMatch(/takenDown\?\.sentence/);
  });
});

describe("the canvas list", () => {
  it("keeps the canvas, greyed, with the sentence — rather than hiding it", () => {
    /**
     * Journey 4 step 3. Hiding it was the obvious alternative and is the wrong
     * one: Priya's canvas vanishing from her own list is indistinguishable
     * from her having lost it.
     */
    expect(list).toMatch(/fetchTakedowns\(\)/);
    expect(list).toMatch(/takenDown\.get\(canvas\.id\)/);
    expect(list).toMatch(/down \? " taken-down" : ""/);
    expect(list).toMatch(/down\.sentence/);
  });

  it("does not open it: the card's link is replaced, not merely styled", () => {
    // A card that looks clickable and is not is a worse lie than one that
    // looks disabled.
    expect(list).toMatch(/down \? \(\s*<div className="card-open">/);
  });

  it("reads the takedowns BESIDE the canvases, so a home that cannot answer costs nothing", () => {
    expect(list).toMatch(/fetchTakedowns\(\)\.catch\(/);
  });

  it("greys the card and takes the pointer off it", () => {
    const sheet = rules();
    const card = sheet.filter((rule) => rule.selector === ".canvas-card.taken-down");
    expect(card.length, ".canvas-card.taken-down should be styled").toBeGreaterThan(0);
    // A card with no link in it must not go on offering a pointer.
    expect(card.map((rule) => rule.body).join("\n")).toMatch(/cursor:\s*default/);
    expect(sheet.some((rule) => rule.selector === ".card-taken-down")).toBe(true);
  });
});
