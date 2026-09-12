import { afterEach, expect, it, vi } from "vitest";
import { glideToBox, shiftCamera, stopGlide } from "../src/lib/zoomactions.ts";
import { useUiStore } from "../src/stores/uiStore.ts";
vi.mock("../src/lib/stage.ts", () => ({ stageRect: () => ({ x: 0, y: 0, width: 390, height: 219 }) }));
afterEach(() => { stopGlide(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("finishes initial framing when a pane resizes before its first animation frame", () => {
  let now = 0, id = 0;
  const frames = new Map<number, FrameRequestCallback>();
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { frames.set(++id, cb); return id; });
  vi.stubGlobal("cancelAnimationFrame", (key: number) => frames.delete(key));
  vi.spyOn(performance, "now").mockImplementation(() => now);
  useUiStore.setState({ viewport: { tx: 10, ty: -1200, scale: 0.05 } });
  glideToBox({ minX: -180, minY: -116, maxX: 180, maxY: 116 }, 0.9);
  shiftCamera(20, 10);
  for (let i = 0; i < 40; i++) {
    now += 16;
    const batch = [...frames.values()]; frames.clear(); batch.forEach(cb => cb(now));
  }
  const camera = useUiStore.getState().viewport;
  expect(camera.tx).toBe(215);
  expect(camera.ty).toBe(119.5);
  expect(camera.scale).toBeGreaterThan(0.7);
  expect(frames.size).toBe(0);
  glideToBox({ minX: -180, minY: -116, maxX: 180, maxY: 116 }, 0.9);
  shiftCamera(20, 10, { x: 0, y: 0, width: 390, height: 219 });
  for (let i = 0; i < 40; i++) {
    now += 16; const batch = [...frames.values()]; frames.clear(); batch.forEach(cb => cb(now));
  }
  expect(useUiStore.getState().viewport).toMatchObject({ tx: 195, ty: 109.5 });
  glideToBox({ minX: 800, minY: 800, maxX: 900, maxY: 900 });
  stopGlide();
  expect(frames.size).toBe(0);
});
