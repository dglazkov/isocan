import { afterEach, describe, expect, it, vi } from "vitest";
import type { InboxResponse } from "@isocan/core";
import { INBOX_POLL_MS, startInboxPoll } from "../src/lib/inboxpoll.ts";
import { availableActions } from "../src/lib/actions.ts";

const empty = (): InboxResponse => ({ entries: [], marks: {}, homes: {}, unavailable: [] });
class Visibility extends EventTarget {
  visibilityState: DocumentVisibilityState = "visible";
  set(value: DocumentVisibilityState) { this.visibilityState = value; this.dispatchEvent(new Event("visibilitychange")); }
}
afterEach(() => vi.useRealTimers());

describe("the one visible-tab inbox poll", () => {
  it("waits thirty seconds after a read, cancels while hidden, and refreshes on return", async () => {
    vi.useFakeTimers();
    const visibility = new Visibility();
    const read = vi.fn(async () => empty());
    const changed = vi.fn();
    const poll = startInboxPoll({ visibility, read, changed });
    await vi.advanceTimersByTimeAsync(0);
    expect(read).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(INBOX_POLL_MS - 1);
    expect(read).toHaveBeenCalledTimes(1);
    visibility.set("hidden");
    await vi.advanceTimersByTimeAsync(INBOX_POLL_MS * 3);
    expect(read).toHaveBeenCalledTimes(1);
    visibility.set("visible");
    await vi.advanceTimersByTimeAsync(0);
    expect(read).toHaveBeenCalledTimes(2);
    poll.stop();
    await vi.advanceTimersByTimeAsync(INBOX_POLL_MS * 2);
    expect(read).toHaveBeenCalledTimes(2);
  });
  it("aborts an in-flight read and never publishes its late answer for an old identity", async () => {
    const visibility = new Visibility();
    let finish!: (value: InboxResponse) => void;
    let signal!: AbortSignal;
    const changed = vi.fn();
    const poll = startInboxPoll({ visibility, changed, read: (given) => { signal = given; return new Promise((resolve) => { finish = resolve; }); } });
    poll.stop();
    expect(signal.aborted).toBe(true);
    finish(empty());
    await Promise.resolve();
    expect(changed).not.toHaveBeenCalled();
  });
  it("replaces stale rows with explicit unavailable state on a failed refresh", async () => {
    const visibility = new Visibility();
    const changed = vi.fn();
    const read = vi.fn().mockResolvedValueOnce(empty()).mockRejectedValueOnce(new Error("home offline"));
    const poll = startInboxPoll({ visibility, changed, read });
    await Promise.resolve();
    poll.refresh();
    await Promise.resolve();
    expect(changed).toHaveBeenLastCalledWith({ data: null, error: "home offline", loading: false });
    poll.stop();
  });
  it("offers exactly the actions home and lens can execute, even with stale canvas selection", () => {
    const actions = availableActions({ canvasId: null, actor: { id: "u", name: "Acme" }, selection: ["stale-item"], navigate: () => {} });
    expect(actions.map((action) => action.id)).toEqual(["open-lens", "switch-canvas", "open-canvases"]);
  });
});
