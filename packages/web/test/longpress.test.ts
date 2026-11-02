import { afterEach, expect, it, vi } from "vitest";
import { longPress } from "../src/lib/longpress.ts";
afterEach(() => vi.useRealTimers());
const finger = (pointerId = 1, pointerType = "touch") => ({ pointerId, pointerType, clientX: 100, clientY: 100, target: null });
it("offers one stationary touch and suppresses its synthetic click", () => {
  vi.useFakeTimers(); const show = vi.fn(); const hold = longPress(show);
  hold.down(finger()); vi.advanceTimersByTime(550); expect(show).toHaveBeenCalledTimes(1);
  hold.up(1); expect(hold.consumeClick()).toBe(true); expect(hold.consumeClick()).toBe(false);
});
it.each(["move", "second", "release", "cancel", "dispose"])("cancels a pending menu on %s", (action) => {
  vi.useFakeTimers(); const show = vi.fn(); const hold = longPress(show); hold.down(finger());
  if (action === "move") hold.move({ ...finger(), clientX: 110 });
  if (action === "second") hold.down(finger(2));
  if (action === "release") hold.up(1);
  if (action === "cancel") hold.cancel();
  if (action === "dispose") hold.dispose();
  vi.advanceTimersByTime(1000); expect(show).not.toHaveBeenCalled();
});
it("invalidates an async menu after a competing gesture and ignores a mouse", () => {
  vi.useFakeTimers(); const show = vi.fn(); const hold = longPress(show);
  hold.down(finger(1, "mouse")); vi.advanceTimersByTime(1000); expect(show).not.toHaveBeenCalled();
  hold.down(finger()); vi.advanceTimersByTime(550); const current = show.mock.calls[0]![1];
  expect(current()).toBe(true); hold.down(finger(2)); expect(current()).toBe(false);
});
