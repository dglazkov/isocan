// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error Plain Node helper shared with the real journey runner.
import { waitForCanvas } from "../scripts/lib/canvas-ready.mjs";

const route = "/p/prj_acme";
// Execute the shipped page expression against a DOM, not a parallel predicate.
const b = { ev: (expression: string) => window.eval(expression) };

beforeEach(() => {
  vi.useFakeTimers();
  history.replaceState(null, "", route);
  document.body.innerHTML = "";
});
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("canvas readiness at the real navigation boundary", () => {
  it("also bounds a frozen renderer at the CDP call, with delivery headroom", async () => {
    document.body.innerHTML = '<div class="world"></div>';
    const ev = vi.fn(b.ev);
    await waitForCanvas({ ev }, route, 200);
    expect(ev).toHaveBeenCalledWith(expect.any(String), { timeoutMs: 1200 });
  });

  it("waits for the world to mount, then succeeds", async () => {
    const ready = waitForCanvas(b, route, 200);
    await vi.advanceTimersByTimeAsync(50);
    document.body.innerHTML = '<div class="world"></div>';
    await vi.advanceTimersByTimeAsync(50);
    await expect(ready).resolves.toMatchObject({ at: route, world: true, arrival: [] });
  });

  it("does not mistake mounted controls beneath the arrival surface for readiness", async () => {
    document.body.innerHTML = '<div class="world"><button>Undo</button></div><div class="canvas-finding"></div>';
    let settled = false;
    const ready = waitForCanvas(b, route, 300).then(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(100);
    expect(settled).toBe(false);
    // Even the fade is observed through completion rather than a guessed sleep.
    document.querySelector(".canvas-finding")!.classList.add("fading-out");
    await vi.advanceTimersByTimeAsync(50);
    expect(settled).toBe(false);
    document.querySelector(".canvas-finding")!.remove();
    await vi.advanceTimersByTimeAsync(50);
    await ready;
    expect(settled).toBe(true);
    expect(document.querySelector("button")!.textContent).toBe("Undo");
  });

  it("fails when the arrival surface never leaves, without removing it", async () => {
    document.body.innerHTML = '<div class="world"></div><div class="canvas-finding"></div>';
    const failure = expect(waitForCanvas(b, route, 100)).rejects.toThrow(/canvas not ready within 100ms:.*canvas-finding/);
    await vi.advanceTimersByTimeAsync(100);
    await failure;
    expect(document.querySelector(".canvas-finding")).not.toBeNull();
  });

  it("does not accept the previous canvas during navigation", async () => {
    document.body.innerHTML = '<div class="world"></div>';
    history.replaceState(null, "", "/p/prj_previous");
    const failure = expect(waitForCanvas(b, route, 100)).rejects.toThrow(/prj_previous/);
    await vi.advanceTimersByTimeAsync(100);
    await failure;
  });

  it("fails if a canvas world never mounts", async () => {
    const failure = expect(waitForCanvas(b, route, 100)).rejects.toThrow(/"world":false/);
    await vi.advanceTimersByTimeAsync(100);
    await failure;
  });
});
