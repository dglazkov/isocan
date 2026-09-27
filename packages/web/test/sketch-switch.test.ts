import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Actor, InkStroke } from "@isocan/core";
import { useCanvasStore } from "../src/stores/canvasStore.ts";
import { useUiStore } from "../src/stores/uiStore.ts";

/**
 * **Ink placed on one canvas is not placed again on the next** (cleanup RH-2,
 * 27 Sep 2026).
 *
 * `place()` checked "are we still on this canvas?" BEFORE dropping the strokes
 * it had just placed, and returned early when the answer was no. Leave within
 * the settle window — draw, then switch within 1.5 s — and the upload landed
 * on A while the strokes stayed in the sketch, so the next canvas's settle
 * timer or leave handler placed the same ink AGAIN there, in front of what may
 * be a different audience. The strokes are A's item the moment the op lands;
 * dropping them does not depend on where the tab is. Only what follows — the
 * selection and the composer — belongs to A's screen and waits on being there.
 *
 * And the half found while fixing it: leaving while a commit was in flight was
 * REFUSED (one commit at a time), so ink drawn on A during the upload stayed
 * wet into B, and B's settle timer placed it on B. Leaving now takes all of A's
 * ink with it, to A.
 */

/** Every upload asked for, held open until the test settles it. */
type Upload = { canvasId: string; strokes: InkStroke[]; resolve: (itemId: string) => void; reject: (err: Error) => void };
let uploads: Upload[];
vi.mock("../src/lib/upload.ts", () => ({
  addDrawing: (canvasId: string, _actor: Actor, strokes: InkStroke[]) =>
    new Promise<string>((resolve, reject) => uploads.push({ canvasId, strokes, resolve, reject })),
}));
const { arriveSketch, placeSketch } = await import("../src/lib/sketch.ts");
const { commitSketch } = await import("../src/lib/sketchplace.ts");

const actor: Actor = { id: "usr_acme", name: "Acme" };
const stroke = (x: number): InkStroke => ({ points: [{ x, y: 0 }, { x: x + 10, y: 10 }], color: "#000", width: 2 });
/** Let the promise chains — the placing half's `import()`, the queue behind a
 * settled upload — run to their ends. */
const settled = async () => {
  for (let tick = 0; tick < 5; tick++) await new Promise((resolve) => setTimeout(resolve, 0));
};

beforeEach(() => {
  uploads = [];
  useCanvasStore.setState({ canvasId: "prj_acme", canvas: null });
  useUiStore.setState({ sketch: [], sketchError: null, selectedItemIds: [], pendingComment: null });
  arriveSketch("prj_acme");
});
afterEach(() => {
  useCanvasStore.setState({ canvasId: null, canvas: null });
  useUiStore.setState({ sketch: [], sketchError: null, selectedItemIds: [], pendingComment: null });
});

describe("placing ink while the canvas changes under it", () => {
  it("drops the placed strokes even when the tab has moved to another canvas", async () => {
    const drawn = stroke(0);
    useUiStore.getState().beginStroke(drawn);

    const placing = commitSketch("prj_acme", actor, useUiStore.getState().sketch);
    await settled();
    expect(uploads, "the upload never started").toHaveLength(1);

    // Mid-flight: a stroke drawn while the upload runs, then the switch.
    const meanwhile = stroke(100);
    useUiStore.getState().beginStroke(meanwhile);
    useCanvasStore.setState({ canvasId: "prj_widget" });

    uploads[0]!.resolve("itm_drawing");
    expect(await placing).toBe("itm_drawing");

    const { sketch, selectedItemIds } = useUiStore.getState();
    expect(sketch, "the placed ink is still wet, and the next canvas would place it again").not.toContain(drawn);
    // Drawn while the upload ran, so not part of this item: it stays wet.
    expect(sketch).toEqual([meanwhile]);
    // A's item is not selected on B's screen.
    expect(selectedItemIds).toEqual([]);
  });

  it("still selects what it placed when the tab stayed put", async () => {
    const drawn = stroke(0);
    useUiStore.getState().beginStroke(drawn);
    const placing = commitSketch("prj_acme", actor, useUiStore.getState().sketch);
    await settled();
    uploads[0]!.resolve("itm_drawing");
    await placing;
    expect(useUiStore.getState().sketch).toEqual([]);
    expect(useUiStore.getState().selectedItemIds).toEqual(["itm_drawing"]);
  });

  it("leaving mid-upload takes the ink drawn meanwhile to the canvas it was drawn on", async () => {
    const first = stroke(0);
    useUiStore.getState().beginStroke(first);
    placeSketch("prj_acme", actor); // the settle timer
    await settled();
    expect(uploads).toHaveLength(1);

    const meanwhile = stroke(100);
    useUiStore.getState().beginStroke(meanwhile);
    // Leaving, exactly as CanvasPage's cleanup does it, then the switch.
    placeSketch("prj_acme", actor, true);
    arriveSketch("prj_widget");
    useCanvasStore.setState({ canvasId: "prj_widget" });
    const onB = stroke(200);
    useUiStore.getState().beginStroke(onB);

    uploads[0]!.resolve("itm_first");
    await settled();
    uploads[1]?.resolve("itm_meanwhile");
    await settled();

    expect(
      uploads.map((u) => ({ canvasId: u.canvasId, strokes: u.strokes })),
      "every stroke placed once, each on the canvas it was drawn on",
    ).toEqual([
      { canvasId: "prj_acme", strokes: [first] },
      { canvasId: "prj_acme", strokes: [meanwhile] },
    ]);
    // B's own ink is B's, and still wet.
    expect(useUiStore.getState().sketch).toEqual([onB]);
  });

  it("B starts with none of A's ink, placed or not", async () => {
    useUiStore.getState().beginStroke(stroke(0));
    placeSketch("prj_acme", actor, true);
    expect(useUiStore.getState().sketch, "A's ink came along to B").toEqual([]);
    await settled();
    uploads[0]!.resolve("itm_left");
    await settled();
  });
});

describe("the placing half loads lazily, and a leave does not wait for it", () => {
  it("a settle still loading when the canvas is left places nothing of the next canvas's ink", async () => {
    const first = stroke(0);
    useUiStore.getState().beginStroke(first);
    placeSketch("prj_acme", actor); // the settle timer, its import() not yet resolved
    placeSketch("prj_acme", actor, true); // …and the leave, in the same tick
    arriveSketch("prj_widget");
    useCanvasStore.setState({ canvasId: "prj_widget" });
    const onB = stroke(200);
    useUiStore.getState().beginStroke(onB);

    await settled();
    uploads[0]?.resolve("itm_first");
    await settled();
    expect(uploads.map((u) => ({ canvasId: u.canvasId, strokes: u.strokes }))).toEqual([
      { canvasId: "prj_acme", strokes: [first] },
    ]);
    expect(useUiStore.getState().sketch).toEqual([onB]);
  });
});

describe("a placement that fails after its canvas was left", () => {
  it("keeps the ink for that canvas, and does not show it — or its error — on the next", async () => {
    const first = stroke(0);
    useUiStore.getState().beginStroke(first);
    placeSketch("prj_acme", actor, true);

    // B: its own ink, its own screen.
    arriveSketch("prj_widget");
    useCanvasStore.setState({ canvasId: "prj_widget" });
    const onB = stroke(200);
    useUiStore.getState().beginStroke(onB);

    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    await settled();
    uploads[0]!.reject(new Error("daemon went away"));
    await settled();
    errors.mockRestore();

    expect(useUiStore.getState().sketch).toEqual([onB]);
    expect(useUiStore.getState().sketchError, "A's failure was shown on B's screen").toBeNull();

    // Leave B (its ink placed there), come back to A: A's ink is back, with why.
    placeSketch("prj_widget", actor, true);
    await settled();
    uploads[1]!.resolve("itm_b");
    await settled();
    arriveSketch("prj_acme");
    useCanvasStore.setState({ canvasId: "prj_acme" });
    await settled();
    expect(useUiStore.getState().sketch).toEqual([first]);
    expect(useUiStore.getState().sketchError).toBe("daemon went away");
    expect(uploads.map((u) => u.canvasId)).toEqual(["prj_acme", "prj_widget"]);
  });
});
