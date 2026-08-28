import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

const store = async () => import("../src/stores/canvasStore.ts");

/**
 * **⌘C did nothing, and the reason is a shape this file has seen before.**
 *
 * The copy branch read `canvas` from the component's closure. The keydown
 * effect's dependency array is `[canvasId, actor, itemId, onWorkbench]` —
 * `canvas` is not in it — so the handler kept the value from when the effect
 * last ran, which is BEFORE the canvas loaded: `null`. Every lookup missed,
 * the selection came back empty, and the branch returned silently. Nothing
 * was broken visibly; ⌘C simply did nothing at all, which is how it was
 * reported.
 *
 * Every other handler in that file already reads
 * `useCanvasStore.getState().canvas` for exactly this reason. This is the
 * same class as the cursor colour bug earlier the same day — a one-shot read
 * standing where a live one belongs — and it gets the same kind of guard.
 */
describe("the copy branch reads the canvas that exists now", () => {
  const src = readFileSync(
    fileURLToPath(new URL("../src/pages/CanvasPage.tsx", import.meta.url)),
    "utf8",
  );
  const branch = src.slice(src.indexOf('e.key.toLowerCase() === "c"'));
  const copyBranch = branch.slice(0, branch.indexOf("return;"));

  it("takes the canvas from the store, not from the closure", () => {
    expect(copyBranch, "a closed-over canvas is null when the effect last ran").toContain(
      "useCanvasStore.getState().canvas",
    );
  });

  it("does not read the component's `canvas` binding", () => {
    // The exact spelling that broke it: `canvas?.items[...]`.
    expect(copyBranch).not.toMatch(/[^.]\bcanvas\?\.items\[/);
  });
});

/**
 * **A confirmation takes itself away; a problem waits to be seen.**
 *
 * Every other caller of `setNotice` is reporting something that went wrong —
 * a file that could not be added, text that could not be read — and those
 * stay until dismissed. "Copied 2 items" left in the same bar becomes a
 * message about a failure that never happened, with an ✕ beside it.
 */
describe("a flashed notice", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("clears itself", async () => {
    vi.useFakeTimers();
    const { flashNotice, useCanvasStore } = await store();
    flashNotice("Copied 2 items", 2500);
    expect(useCanvasStore.getState().notice).toBe("Copied 2 items");
    vi.advanceTimersByTime(2501);
    expect(useCanvasStore.getState().notice).toBe(null);
  });

  it("never takes away a message that arrived after it", async () => {
    // A real problem landing during the flash must not be swept up by the
    // flash's own timeout — that would be a confirmation deleting an error.
    //
    // The mechanism is CANCELLATION: `setNotice` clears the pending flash
    // timer, so the later message owns the bar outright. (There is an
    // equality check in the timeout too, but it is unreachable while both
    // writers cancel — belt-and-braces, and not what this asserts.)
    vi.useFakeTimers();
    const { flashNotice, setNotice, useCanvasStore } = await store();
    flashNotice("Copied 2 items", 2500);
    setNotice("That file could not be added.");
    vi.advanceTimersByTime(5000);
    expect(useCanvasStore.getState().notice).toBe("That file could not be added.");
  });
});
