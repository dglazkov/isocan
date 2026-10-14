// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";

/**
 * **At rest, a person sees the real page** (14 Oct 2026).
 *
 * 82af97d4a gave every HTML screen a still picture and, once the picture had
 * loaded, unmounted the live frame of every screen that was not entered — at
 * any zoom. The picture is drawn without the page's scripts, linked sheets,
 * remote assets and `body` rules, so a storefront at rest on the canvas was
 * an older-looking, shorter page with no photos, and only double-clicking it
 * showed the real one. The rule now: the picture only where the page cannot
 * be read (far away), the live page everywhere a person could read it.
 *
 * The picture is made by a real browser (SVG foreignObject → canvas), which
 * jsdom has not got, so the hook is replaced by one that answers at once and
 * the `<img>`'s load is fired by hand — what is under test is which surface
 * is MOUNTED when, not how the picture is drawn.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../src/lib/htmlsnapshot.ts", async (importActual) => {
  const actual = await importActual<typeof import("../src/lib/htmlsnapshot.ts")>();
  return { ...actual, useHtmlSnapshot: (_c: string, _b: string, _w: number, _h: number, enabled: boolean) => (enabled ? "blob:acme-picture" : null) };
});

const { VersionContent } = await import("../src/components/ItemView.tsx");
const { useUiStore } = await import("../src/stores/uiStore.ts");
const { showsLiveFrame, readabilityBand, PICTURE_BELOW_SCALE } = await import("../src/lib/htmlsnapshot.ts");

const actor = { id: "usr_acme", name: "Acme" };
const page = "a".repeat(64);

describe("showsLiveFrame", () => {
  const rest = { picture: true, entered: false, warm: 0, pictureReady: true, band: 2 as const, panning: false, wasLive: true };

  it("is the live page at any zoom a person can read, at rest and mid-pan", () => {
    expect(showsLiveFrame(rest)).toBe(true);
    expect(showsLiveFrame({ ...rest, panning: true })).toBe(true);
  });

  it("is the picture only too far away to read", () => {
    expect(showsLiveFrame({ ...rest, band: 0 })).toBe(false);
    expect(readabilityBand(PICTURE_BELOW_SCALE)).toBe(2);
    expect(readabilityBand(PICTURE_BELOW_SCALE * 0.5)).toBe(0);
  });

  it("keeps a live page through the band between, and starts none in it", () => {
    expect(showsLiveFrame({ ...rest, band: 1, wasLive: true })).toBe(true);
    expect(showsLiveFrame({ ...rest, band: 1, wasLive: false })).toBe(false);
  });

  it("starts a live page only once the camera stops", () => {
    expect(showsLiveFrame({ ...rest, wasLive: false, panning: true })).toBe(false);
    expect(showsLiveFrame({ ...rest, wasLive: false, panning: false })).toBe(true);
  });

  it("is always live entered, as a deck, off the canvas, and before a picture exists", () => {
    const far = { ...rest, band: 0 as const, wasLive: false };
    expect(showsLiveFrame({ ...far, entered: true })).toBe(true);
    expect(showsLiveFrame({ ...far, warm: 2 })).toBe(true);
    expect(showsLiveFrame({ ...far, picture: false })).toBe(true);
    expect(showsLiveFrame({ ...far, pictureReady: false })).toBe(true);
  });
});

describe("which surface an HTML screen on the canvas mounts", () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    useUiStore.setState({ viewport: { tx: 0, ty: 0, scale: 0.6 }, panning: false });
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  function show(props: { entered?: boolean; picture?: boolean } = {}) {
    const entered = props.entered ?? false;
    act(() => root.render(h(VersionContent, {
      canvasId: "prj_acme", blobHash: page, mimeType: "text/html", filename: "Acme store.html",
      entered, itemId: "itm_acme", actor: entered ? actor : undefined, canvasOf: null, canvasSource: null,
      size: { width: 1440, height: 3000 }, picture: props.picture ?? true,
    })));
  }
  const frames = () => [...host.querySelectorAll("iframe")];
  const picture = () => host.querySelector<HTMLImageElement>("img.html-snapshot");
  /** The picture finished decoding: its load, then the frame after it. */
  async function pictureLoads() {
    const img = picture();
    expect(img, "the canvas drew no picture to load").not.toBeNull();
    await act(async () => {
      img!.dispatchEvent(new Event("load"));
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });
  }
  const zoom = (scale: number, panning = false) => act(() => useUiStore.setState({ viewport: { tx: 0, ty: 0, scale }, panning }));

  it("keeps the live page at rest at a readable zoom once its picture has loaded", async () => {
    show();
    await pictureLoads();
    expect(frames()).toHaveLength(1);
    // Mid-pan too: the frame is not swapped for a picture that differs from it.
    zoom(0.6, true);
    expect(frames()).toHaveLength(1);
  });

  it("shows only the picture too far away to read, and the page again on the way back", async () => {
    show();
    await pictureLoads();
    zoom(0.1);
    expect(frames()).toHaveLength(0);
    expect(picture()).not.toBeNull();
    // Zoomed back in during the gesture: held until it settles…
    zoom(0.6, true);
    expect(frames()).toHaveLength(0);
    // …then mounted unseen over its picture until its document has loaded.
    zoom(0.6, false);
    expect(frames()).toHaveLength(1);
    expect(frames()[0]!.className).toContain("arriving");
    act(() => { frames()[0]!.dispatchEvent(new Event("load")); });
    expect(frames()[0]!.className).not.toContain("arriving");
  });

  it("is the live page when entered, however far away", async () => {
    show();
    await pictureLoads();
    zoom(0.1);
    expect(frames()).toHaveLength(0);
    show({ entered: true });
    expect(frames()).toHaveLength(1);
  });

  it("is always the live page off the canvas, and draws no picture there", () => {
    zoom(0.1);
    show({ picture: false });
    expect(picture()).toBeNull();
    expect(frames()).toHaveLength(1);
  });
});

describe("the frame's surface on the canvas", () => {
  const css = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/styles.css"), "utf8");

  it("never takes a document selection, which would paint over the whole page as a veil", () => {
    expect(css).toMatch(/\.html-view-surface \{[^}]*user-select: none/);
  });

  it("has no rule hiding a live frame while the camera moves", () => {
    expect(css).not.toMatch(/\.panning[^{]*\.html-view-stack \{ display: none/);
  });
});
