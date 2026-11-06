import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";

// Execute the shipped channel with controlled socket events. There is no
// reimplementation of its timers or request bookkeeping in this fixture.
const source = ts.createSourceFile("browser.mjs", readFileSync(new URL("../scripts/lib/browser.mjs", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const channelSource = source.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "cdpChannel")!.getText(source);
interface Channel {
  opened: Promise<void>;
  send(method: string, params?: object, sessionId?: string, options?: { timeoutMs: number }): Promise<unknown>;
  once(method: string, options?: { timeoutMs: number }): Promise<unknown>;
  on(method: string, listener: (params: unknown, sessionId?: string) => void): () => void;
  dispose(): void;
}
const channel = new Function(`${channelSource}; return cdpChannel;`)() as (socket: Socket, label: string, timeoutMs: number) => Channel;
class Socket extends EventEmitter {
  readyState = 0;
  sent: { id: number; method: string; params: object; sessionId?: string }[] = [];
  sendError?: Error;
  send(text: string, callback: (error?: Error) => void) {
    this.sent.push(JSON.parse(text)); callback(this.sendError);
  }
  open() { this.readyState = 1; this.emit("open"); }
  close() { this.readyState = 3; this.emit("close"); }
  message(value: unknown) { this.emit("message", Buffer.from(JSON.stringify(value))); }
}
const opened = async (label = "page") => {
  const socket = new Socket(), c = channel(socket, label, 100);
  socket.open(); await c.opened;
  return { socket, c };
};
afterEach(() => vi.useRealTimers());

describe("bounded CDP transport", () => {
  it("bounds an opening that never completes and removes its open listener", async () => {
    vi.useFakeTimers();
    const socket = new Socket(), c = channel(socket, "browser", 100);
    const rejected = expect(c.opened).rejects.toThrow("browser CDP timed out waiting for socket opening after 100ms");
    await vi.advanceTimersByTimeAsync(100); await rejected;
    expect(socket.listenerCount("open")).toBe(0);
    c.dispose(); socket.close();
    expect(socket.eventNames()).toEqual([]); expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["browser", "page"])("bounds an unanswered %s command, ignores its late reply and can complete the next one", async (label) => {
    vi.useFakeTimers();
    const { socket, c } = await opened(label);
    const rejected = expect(c.send("Runtime.evaluate", { expression: "new Promise(() => {})" })).rejects.toThrow(`${label} CDP timed out waiting for Runtime.evaluate after 100ms`);
    await vi.advanceTimersByTimeAsync(100); await rejected;
    const next = c.send("Browser.getVersion", {}, "worker-1");
    socket.message({ id: 1, result: "late" });
    socket.message({ id: 2, result: "current" });
    await expect(next).resolves.toBe("current");
    expect(socket.sent[1]?.sessionId).toBe("worker-1");
    expect(vi.getTimerCount()).toBe(0);
    c.dispose(); socket.close();
  });

  it.each(["close", "error", "dispose"])("rejects outstanding commands and armed event waits on %s", async (how) => {
    vi.useFakeTimers();
    const { socket, c } = await opened();
    const call = expect(c.send("Page.navigate")).rejects.toThrow(/page CDP/);
    const event = expect(c.once("Page.loadEventFired")).rejects.toThrow(/page CDP/);
    const listener = vi.fn(); c.on("Runtime.exceptionThrown", listener);
    if (how === "dispose") c.dispose();
    else if (how === "close") socket.close();
    else socket.emit("error", new Error("connection reset"));
    await call; await event;
    await expect(c.send("Page.enable")).rejects.toThrow(/page CDP/);
    await expect(c.once("Page.loadEventFired")).rejects.toThrow(/page CDP/);
    socket.message({ method: "Runtime.exceptionThrown", params: {} });
    expect(listener).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    socket.close(); expect(socket.eventNames()).toEqual([]);
  });

  it("settles every waiter for an event, supports repeated listeners and clears their deadlines", async () => {
    vi.useFakeTimers();
    const { socket, c } = await opened();
    const first = c.once("Page.loadEventFired"), second = c.once("Page.loadEventFired");
    const observer = vi.fn(), off = c.on("Page.loadEventFired", observer);
    socket.message({ method: "Page.loadEventFired", params: { timestamp: 10 }, sessionId: "worker-2" });
    await expect(first).resolves.toEqual({ timestamp: 10 });
    await expect(second).resolves.toEqual({ timestamp: 10 });
    expect(observer).toHaveBeenCalledWith({ timestamp: 10 }, "worker-2");
    off(); socket.message({ method: "Page.loadEventFired", params: {} });
    expect(observer).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
    c.dispose(); socket.close();
  });

  it("a repeated unsubscribe cannot remove a newer subscription to the same event", async () => {
    vi.useFakeTimers();
    const { socket, c } = await opened();
    const firstOff = c.on("Page.loadEventFired", () => {});
    firstOff();
    const observer = vi.fn(); c.on("Page.loadEventFired", observer);
    firstOff();
    socket.message({ method: "Page.loadEventFired", params: {} });
    expect(observer).toHaveBeenCalledTimes(1); c.dispose(); socket.close();
  });

  it("times out an event without creating an unhandled rejection when its triggering action failed", async () => {
    vi.useFakeTimers();
    const { socket, c } = await opened();
    const event = c.once("Page.loadEventFired");
    // Intentionally await only after expiration, like navigation failing
    // before the caller reaches `await loaded`.
    await vi.advanceTimersByTimeAsync(100);
    await expect(event).rejects.toThrow("event Page.loadEventFired after 100ms");
    expect(vi.getTimerCount()).toBe(0); c.dispose(); socket.close();
  });

  it("clears a failed send without waiting for its deadline", async () => {
    vi.useFakeTimers();
    const { socket, c } = await opened();
    socket.sendError = new Error("broken pipe");
    await expect(c.send("Page.enable")).rejects.toThrow("Page.enable send failed: broken pipe");
    expect(vi.getTimerCount()).toBe(0); c.dispose(); socket.close();
  });

  it("permits a finite per-command bound for long batches and rejects unbounded durations", async () => {
    vi.useFakeTimers();
    const { socket, c } = await opened();
    const long = c.send("Runtime.evaluate", {}, undefined, { timeoutMs: 250 });
    await vi.advanceTimersByTimeAsync(100);
    socket.message({ id: 1, result: "batch" });
    await expect(long).resolves.toBe("batch");
    for (const timeoutMs of [0, Infinity, NaN, -1, 2 ** 31]) {
      expect(() => c.send("Runtime.evaluate", {}, undefined, { timeoutMs })).toThrow("positive finite");
    }
    expect(vi.getTimerCount()).toBe(0); c.dispose(); socket.close();
  });
});

// Polling must pass its remaining budget down to the real RPC; checking the
// clock only between calls cannot stop an evaluate that never answers.
it("bounds one hung evaluate by the poll's own deadline", async () => {
  vi.useFakeTimers();
  // @ts-expect-error — the shared browser helper is a plain .mjs module.
  const { until } = await import("../scripts/lib/browser.mjs");
  const { socket, c } = await opened();
  const budgets: number[] = [];
  const b = { ev: (expression: string, options: { timeoutMs: number }) => {
    budgets.push(options.timeoutMs);
    return c.send("Runtime.evaluate", { expression }, undefined, options);
  } };
  const rejected = expect(until(b, "never", "the ready canvas", 75)).rejects.toThrow(/the ready canvas: page CDP timed out.*75ms/);
  await vi.advanceTimersByTimeAsync(75); await rejected;
  expect(budgets).toEqual([75]); expect(vi.getTimerCount()).toBe(0);
  c.dispose(); socket.close();
});
