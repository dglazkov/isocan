// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error The journey helper is a plain Node module.
import { observeGroundSleep, finishGroundSleep, movePointerFor } from "../scripts/lib/ground-timing.mjs";

const b = { ev: (expression: string) => window.eval(expression) };
let canvas: HTMLCanvasElement;
let pointer: (event: { isTrusted: boolean }) => void;
beforeEach(async () => {
  vi.useFakeTimers();
  document.body.innerHTML = '<canvas class="ground-canvas" data-ground-state="asleep"></canvas>';
  canvas = document.querySelector("canvas")!;
  const added = vi.spyOn(window, "addEventListener");
  await observeGroundSleep(b);
  pointer = added.mock.calls.find(([name]) => name === "pointermove")![1] as typeof pointer;
});
afterEach(() => {
  b.ev("window.__journeyGroundClock?.close(); delete window.__journeyGroundClock");
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.body.innerHTML = "";
});

async function move() {
  pointer({ isTrusted: true });
  canvas.dataset.groundState = "awake";
  await Promise.resolve();
}
async function sleepAt(ms: number) {
  await vi.advanceTimersByTimeAsync(ms);
  canvas.dataset.groundState = "asleep";
  await Promise.resolve();
}

describe("ground sleep measured in the browser", () => {
  it("retains the transition time when the host reads it much later", async () => {
    await move();
    await sleepAt(2500);
    await vi.advanceTimersByTimeAsync(4000);
    await expect(finishGroundSleep(b, "Acme")).resolves.toMatchObject({ sleptAfterMs: 2500, moves: 1 });
  });
  it("still fails an actual sleep beyond the unchanged 3500ms bound", async () => {
    await move();
    await sleepAt(3501);
    await expect(finishGroundSleep(b, "Acme")).rejects.toThrow(/3501ms.*3500/);
  });
  it("restarts the measurement at the last real move", async () => {
    await move();
    await sleepAt(1000);
    await vi.advanceTimersByTimeAsync(500);
    await move();
    await sleepAt(2000);
    await expect(finishGroundSleep(b, "Acme")).resolves.toMatchObject({ sleptAfterMs: 2000, inputDurationMs: 1500, moves: 2 });
  });
  it("never reports success without a trusted move and a sleep transition", async () => {
    pointer({ isTrusted: false });
    const failure = expect(finishGroundSleep(b, "Acme")).rejects.toThrow(/never slept after trusted input/);
    await vi.advanceTimersByTimeAsync(6000);
    await failure;
  });
});

it("counts response latency inside the movement duration and uses real CDP input", async () => {
  const send = vi.fn(async (_method: string, _params: object, _sessionId: undefined, _options: { timeoutMs: number }) => {
    await new Promise((resolve) => setTimeout(resolve, 80));
  });
  const result = movePointerFor({ send }, (i: number) => ({ x: i % 2, y: 0 }), 3000);
  await vi.advanceTimersByTimeAsync(3100);
  const sample = await result;
  expect(sample.moves).toBeGreaterThan(20);
  expect(sample.moves).toBeLessThan(30);
  expect(sample.dispatchDurationMs).toBeLessThan(3081);
  expect(send).toHaveBeenCalledWith("Input.dispatchMouseEvent", expect.objectContaining({ type: "mouseMoved", buttons: 0 }),
    undefined, { timeoutMs: expect.any(Number) });
  const timeouts = send.mock.calls.map((call) => call[3].timeoutMs);
  expect(timeouts[0]).toBe(4000);
  expect(timeouts.at(-1)).toBeGreaterThanOrEqual(1000);
  expect(timeouts.at(-1)).toBeLessThan(1200);
});
