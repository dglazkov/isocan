// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { HomesResponse } from "@isocan/core";

/**
 * **An answer about one canvas is never read as the answer about another**
 * (cleanup RH-1, 27 Sep 2026).
 *
 * `useCanvasHome` kept one answer and reset it inside an effect, so on an
 * in-app switch from A to B the render that first carried B still returned
 * A's settled "here". `CanvasPage` let `CanvasSurface` through on it, and the
 * surface ran its arrival effects with B's id over A's store: B's durable
 * seen-mark written at A's head (the home keeps the max, so B's inbox and
 * "since your last visit" went quiet on every machine), B's recents row given
 * A's title — and then the reset landed and the surface unmounted and mounted
 * again. The answer is keyed by the id it answers now, so no render pairs B
 * with A's answer.
 *
 * A real client root rather than `renderToStaticMarkup`: a server render runs
 * no effects, so the stale answer never exists there and the test is green
 * either way.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** One `/api/homes` read per canvas asked about, each settled by the test. */
const asked: Array<{ resolve: (homes: HomesResponse) => void; reject: (err: Error) => void }> = [];
vi.mock("../src/lib/api.ts", () => ({
  fetchHomes: () => new Promise<HomesResponse>((resolve, reject) => asked.push({ resolve, reject })),
}));
const { useCanvasHome } = await import("../src/lib/homes.ts");

const HERE: HomesResponse = { birth: null, canvases: {}, links: [] };
const ELSEWHERE: HomesResponse = { birth: null, canvases: { prj_widget: "https://acme.example" }, links: [] };

/** Every render the hook took part in: which canvas it was asked about, and what it said. */
let renders: Array<{ canvasId: string; state: string }>;
function Probe({ canvasId }: { canvasId: string }) {
  const where = useCanvasHome(canvasId);
  renders.push({ canvasId, state: where.state });
  return null;
}

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  asked.length = 0;
  renders = [];
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const show = (canvasId: string) => act(() => root.render(h(Probe, { canvasId })));
const settle = async (index: number, homes: HomesResponse) => {
  await act(async () => asked[index]!.resolve(homes));
};

describe("switching canvases in the app", () => {
  it("the first render with the new canvas is asking, not the old canvas's answer", async () => {
    show("prj_acme");
    await settle(0, HERE);
    expect(renders.at(-1)).toEqual({ canvasId: "prj_acme", state: "here" });

    renders = [];
    show("prj_widget");
    const withB = renders.filter((r) => r.canvasId === "prj_widget");
    expect(withB.length).toBeGreaterThan(0);
    expect(
      withB.filter((r) => r.state !== "asking"),
      "a render carried the new canvas's id with the old canvas's answer",
    ).toEqual([]);

    // And B's own answer, when it lands, is B's.
    await settle(1, ELSEWHERE);
    expect(renders.at(-1)).toEqual({ canvasId: "prj_widget", state: "elsewhere" });
  });

  it("a late answer about the canvas left behind does not land on the one arrived at", async () => {
    show("prj_acme");
    show("prj_widget");
    await settle(0, ELSEWHERE); // A's read, answering after the switch
    expect(renders.filter((r) => r.canvasId === "prj_widget" && r.state !== "asking")).toEqual([]);
    await settle(1, HERE);
    expect(renders.at(-1)).toEqual({ canvasId: "prj_widget", state: "here" });
  });

  it("a daemon that does not answer still means here — for the canvas asked about", async () => {
    show("prj_acme");
    await act(async () => asked[0]!.reject(new Error("offline")));
    expect(renders.at(-1)).toEqual({ canvasId: "prj_acme", state: "here" });
    renders = [];
    show("prj_widget");
    expect(renders.filter((r) => r.canvasId === "prj_widget" && r.state !== "asking")).toEqual([]);
  });
});
