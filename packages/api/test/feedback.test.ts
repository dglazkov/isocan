import { expect, it, vi } from "vitest";
import { waitForFeedback } from "../src/feedback.ts";
import type { DaemonRoutes } from "../src/routes.ts";

const actor = { id: "usr_acme", name: "Acme" };

it("bounds even an initial snapshot that never answers, without leaving a watch", async () => {
  let aborted = false;
  const snapshot = vi.fn((_id: string, signal?: AbortSignal) => new Promise((_resolve, reject) => {
    signal!.addEventListener("abort", () => { aborted = true; reject(signal!.reason); }, { once: true });
  }));
  const watchLog = vi.fn();
  const result = await waitForFeedback({ snapshot, watchLog } as unknown as DaemonRoutes, "prj_acme", actor, { timeoutMs: 20 });
  expect(result).toEqual({ status: "timeout", cursor: 0, entries: [] });
  expect(aborted).toBe(true);
  expect(watchLog).not.toHaveBeenCalled();
});

it("a cancellation already delivered before setup performs no read or subscription", async () => {
  const snapshot = vi.fn();
  const watchLog = vi.fn();
  const controller = new AbortController(); controller.abort();
  const result = await waitForFeedback({ snapshot, watchLog } as unknown as DaemonRoutes, "prj_acme", actor, { since: 17, signal: controller.signal });
  expect(result).toEqual({ status: "cancelled", cursor: 17, entries: [] });
  expect(snapshot).not.toHaveBeenCalled();
  expect(watchLog).not.toHaveBeenCalled();
});
