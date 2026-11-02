// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { VersionContent } from "../src/components/ItemView.tsx";
import { FrameAnchor, anchorFromMessage, nextSpot, type FrameSpot } from "../src/lib/frameanchor.ts";

/**
 * **A new version opens where the person was** (6 Oct 2026). An agent that
 * edits a prototype stacks a version, the version is a new blob, and the
 * frame used to start the new document at its first screen — so a person on
 * screen four went back to screen one on every update. The page now reports
 * its fragment with `isocan:anchor`, and the next version of the SAME item
 * opens at it.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const actor = { id: "usr_acme", name: "Acme" };
const v1 = "1".repeat(64);
const v2 = "2".repeat(64);
const v3 = "3".repeat(64);

describe("anchorFromMessage", () => {
  it("reads the fragment a page reports, with or without its #", () => {
    expect(anchorFromMessage({ type: "isocan:anchor", anchor: "screen=checkout" })).toBe("screen=checkout");
    expect(anchorFromMessage({ type: "isocan:anchor", anchor: "#checkout" })).toBe("checkout");
    expect(anchorFromMessage({ type: "isocan:anchor", anchor: "" })).toBe("");
  });

  it("ignores every other message", () => {
    expect(anchorFromMessage({ type: "isocan:click", element: "cta" })).toBeNull();
    expect(anchorFromMessage({ type: "isocan:anchor", anchor: 4 })).toBeNull();
    expect(anchorFromMessage("isocan:anchor")).toBeNull();
    expect(anchorFromMessage(null)).toBeNull();
  });

  it("refuses an anchor over 200 characters whole, rather than opening at half of it", () => {
    expect(anchorFromMessage({ type: "isocan:anchor", anchor: "s".repeat(200) })).toBe("s".repeat(200));
    expect(anchorFromMessage({ type: "isocan:anchor", anchor: "s".repeat(201) })).toBeNull();
  });
});

describe("nextSpot", () => {
  const opened: FrameSpot = { itemId: "itm_a", blobHash: v1, reported: "screen-3", carried: null };

  it("carries the last report to the next version of the same item", () => {
    expect(nextSpot(opened, "itm_a", v2)).toEqual({ itemId: "itm_a", blobHash: v2, reported: "screen-3", carried: "screen-3" });
  });

  it("does not move the frame already open when it reports", () => {
    expect(nextSpot(opened, "itm_a", v1)).toBe(opened);
  });

  it("starts another item clean", () => {
    expect(nextSpot(opened, "itm_b", v2)).toEqual({ itemId: "itm_b", blobHash: v2, reported: null, carried: null });
  });
});

describe("an HTML item's frame", () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  function show(itemId: string, blobHash: string, route = "") {
    const content = h(VersionContent, {
      canvasId: "prj_acme", blobHash, mimeType: "text/html", filename: "Prototype.html",
      entered: true, itemId, actor, canvasOf: null, canvasSource: null,
    });
    act(() => root.render(h(FrameAnchor.Provider, { value: route }, content)));
  }
  const frames = () => [...host.querySelectorAll("iframe")];
  const frameOf = (blobHash: string) => frames().find((one) => one.getAttribute("src")!.includes(blobHash))!;
  function report(from: HTMLIFrameElement | Window, anchor: string) {
    const source = from instanceof Window ? from : from.contentWindow!;
    act(() => window.dispatchEvent(new MessageEvent("message", { data: { type: "isocan:anchor", anchor }, source })));
  }

  it("opens the next version at the screen the person was on", () => {
    show("itm_a", v1);
    report(frameOf(v1), "screen-3");
    expect(frameOf(v1).getAttribute("src")).not.toContain("#");
    show("itm_a", v2);
    expect(frameOf(v2).getAttribute("src")).toMatch(/#screen-3$/);
  });

  it("wins over full screen's ?at= once the page has reported", () => {
    show("itm_a", v1, "screen=intro");
    expect(frameOf(v1).getAttribute("src")).toMatch(/#screen=intro$/);
    report(frameOf(v1), "screen=pay");
    show("itm_a", v2, "screen=intro");
    expect(frameOf(v2).getAttribute("src")).toMatch(/#screen=pay$/);
  });

  it("hears only its own frame", () => {
    show("itm_a", v1);
    report(window, "screen-3");
    show("itm_a", v2);
    expect(frameOf(v2).getAttribute("src")).not.toContain("#");
  });

  it("hears only the version on screen, not the one it replaced", () => {
    show("itm_a", v1);
    report(frameOf(v1), "screen-2");
    show("itm_a", v2);
    report(frameOf(v1), "screen-1");
    show("itm_a", v3);
    expect(frameOf(v3).getAttribute("src")).toMatch(/#screen-2$/);
  });

  it("does not carry one item's screen to another", () => {
    show("itm_a", v1);
    report(frameOf(v1), "screen-3");
    show("itm_b", v2);
    expect(frameOf(v2).getAttribute("src")).not.toContain("#");
  });
});
