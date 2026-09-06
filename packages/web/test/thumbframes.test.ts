import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Item } from "@isocan/core";
import { ItemThumb } from "../src/components/ItemThumb.tsx";

/**
 * **A thumbnail does not mount a document until somebody can see it.**
 *
 * 6 September 2026, and this is the guard for the worst bug this project has
 * shipped. A canvas with a long agent thread held **163 live iframes**, 132 of
 * them the same screen: the Chat panel mounts an `ItemThumb` per message card,
 * and a `text/html` thumbnail is the real document — scripts, animations, the
 * lot — in a box 61 pixels tall. 764MB, a pegged core, and a tab that loaded
 * fine and froze the longer it stayed open. It was found by counting iframes
 * in the DOM and asking what their ancestors were; no amount of reading the
 * code found it, which is exactly why the number is worth a test.
 *
 * What is asserted is the SHAPE that makes the bound hold: the box is always
 * drawn, and the document inside it is not. A static render runs no effects,
 * so `useOnScreen` has not fired here — which is precisely the state of every
 * thumbnail below the fold in a thread of nine hundred messages.
 *
 * An image thumbnail stays an `<img>` and always did: it costs a decode, not
 * a document, and nothing about it needed bounding.
 */
const screen: Item = {
  id: "itm_screen",
  title: "A screen",
  description: "",
  x: 0,
  y: 0,
  width: 1280,
  height: 720,
  properties: {},
  currentVersionId: "ver_1",
  versions: [
    {
      id: "ver_1",
      blobHash: "b9f69eee00000000000000000000000000000000000000000000000000000000",
      mimeType: "text/html",
      filename: "screen.html",
      createdAt: "2026-09-06T12:00:00.000Z",
      createdBy: { id: "usr_a", name: "A" },
    },
  ],
} as unknown as Item;

const picture: Item = {
  ...screen,
  id: "itm_image",
  versions: [{ ...screen.versions[0]!, mimeType: "image/png", filename: "shot.png" }],
} as unknown as Item;

describe("what a thumbnail costs before you look at it", () => {
  it("draws the box and not the document", () => {
    const html = renderToStaticMarkup(
      h(ItemThumb, { canvasId: "prj_1", itemId: screen.id, item: screen, width: 34, height: 34 }),
    );
    // The box, so nothing reflows when the content arrives.
    expect(html).toContain("item-thumb-live");
    // And nothing inside it: this is the 132 that froze a browser.
    expect(html).not.toContain("<iframe");
  });

  it("still draws an image directly, which never needed a gate", () => {
    const html = renderToStaticMarkup(
      h(ItemThumb, { canvasId: "prj_1", itemId: picture.id, item: picture, width: 34, height: 34 }),
    );
    expect(html).toContain("<img");
    expect(html).not.toContain("<iframe");
  });

  it("keeps the gate above the image branch, so hook order cannot depend on a mime type", () => {
    // Calling `useOnScreen` after the `image/` early return would change the
    // number of hooks between an image thumb and a screen thumb — React's one
    // unbreakable rule, and a crash that only appears on a mixed canvas.
    const source = ItemThumb.toString();
    const gate = source.indexOf("useOnScreen");
    const imageBranch = source.indexOf("image/");
    expect(gate).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(imageBranch);
  });
});
