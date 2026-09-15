import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { expect, it } from "vitest";

// Execute the real close implementation without requiring Chrome to exit within
// a wall-clock deadline on a loaded test runner. Actual Chrome/process ownership
// remains the browser journeys' proof; this guard controls only event ordering.
const file = ts.createSourceFile("browser.mjs", readFileSync(new URL("../scripts/lib/browser.mjs", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const implementations: string[] = [];
function visit(node: ts.Node) {
  if (ts.isPropertyAssignment(node) && node.name.getText(file) === "close") implementations.push(node.initializer.getText(file));
  ts.forEachChild(node, visit);
}
visit(file);
assert.equal(implementations.length, 1, "read the browser's one close implementation");
const implementation = implementations[0]!;
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
};

class ProcessEvents extends EventEmitter {
  exitCode: number | null = null;
  signalCode: string | null = null;
  signals: string[] = [];
  stopped = deferred();
  killed = deferred();
  kill(signal: string) {
    this.signals.push(signal);
    (signal === "SIGTERM" ? this.stopped : this.killed).resolve();
  }
  exit() { this.exitCode = 0; this.emit("exit", 0, null); }
}

function clock() {
  let id = 0;
  const timers = new Map<number, { done: () => void; ms: number }>();
  return {
    setTimeout: (done: () => void, ms: number) => { timers.set(++id, { done, ms }); return id; },
    clearTimeout: (key: number) => { timers.delete(key); },
    expire: () => { for (const { done } of [...timers.values()]) done(); },
    timers,
  };
}

function closeWith(source: string, proc: ProcessEvents, time: ReturnType<typeof clock>, remove: () => Promise<void>, removeSync = () => {}) {
  // The sockets have already closed: the subject is the unchanged TERM/KILL
  // sequencing and profile cleanup, not a second simulated websocket protocol.
  const make = new Function("io", `const { proc, rm, rmSync, setTimeout, clearTimeout } = io;
    const listeners = new Map(), ws = { readyState: 3 }, browserWs = ws, WebSocket = { CLOSED: 3 }, dir = "owned-profile";
    let closing; return ${source};`);
  return make({ proc, rm: remove, rmSync: removeSync, ...time }) as () => Promise<void>;
}

it("delivers a concurrent exit while awaiting retried profile removal", async () => {
  const time = clock(), first = new ProcessEvents(), second = new ProcessEvents();
  const removing = deferred(), release = deferred(), removed: unknown[][] = [];
  const firstClose = closeWith(implementation, first, time, async (...args: unknown[]) => {
    removed.push(args); removing.resolve(); await release.promise;
  });
  const secondClose = closeWith(implementation, second, time, async (...args: unknown[]) => { removed.push(args); });
  let firstFinished = false;
  const one = firstClose().then(() => { firstFinished = true; }), two = secondClose();
  await Promise.all([first.stopped.promise, second.stopped.promise]);
  expect([...time.timers.values()].map((timer) => timer.ms)).toEqual([2000, 2000]);
  first.exit(); await removing.promise;
  second.exit(); await two;
  time.expire();
  expect(firstFinished).toBe(false);
  expect(first.signals).toEqual(["SIGTERM"]);
  expect(second.signals).toEqual(["SIGTERM"]);
  expect(time.timers.size).toBe(0);
  expect(removed).toEqual(Array(2).fill(["owned-profile", { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }]));
  release.resolve(); await one;
  await firstClose();
  expect(removed).toHaveLength(2);
});

it("negative control exposes escalation when synchronous cleanup delays a queued exit", async () => {
  const synchronous = implementation.replace("await rm(dir,", "rmSync(dir,");
  assert.notEqual(synchronous, implementation, "the control restores the old cleanup in memory only");
  const time = clock(), first = new ProcessEvents(), second = new ProcessEvents();
  const firstClose = closeWith(synchronous, first, time, async () => {}, () => {
    // Model the observed ordering: a synchronous removal consumes the stop
    // deadline while the second process's normal exit notification is queued.
    // This is a deterministic ordering control, not a wall-clock reproduction.
    time.expire();
  });
  const secondClose = closeWith(synchronous, second, time, async () => {});
  const one = firstClose(), two = secondClose();
  await Promise.all([first.stopped.promise, second.stopped.promise]);
  first.exit(); await second.killed.promise;
  second.exit(); await Promise.all([one, two]);
  expect(second.signals).toEqual(["SIGTERM", "SIGKILL"]);
  expect(second.exitCode).toBe(0);
  expect(time.timers.size).toBe(0);
});

it("still refuses profile removal when the owned process never exits", async () => {
  const time = clock(), proc = new ProcessEvents();
  let removed = false;
  const close = closeWith(implementation, proc, time, async () => { removed = true; });
  const rejected = expect(close()).rejects.toThrow("the owned Chrome process did not exit");
  await proc.stopped.promise; time.expire();
  await proc.killed.promise; time.expire();
  await rejected;
  expect(proc.signals).toEqual(["SIGTERM", "SIGKILL"]);
  expect(removed).toBe(false);
  expect(time.timers.size).toBe(0);
});
