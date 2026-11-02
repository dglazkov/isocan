import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import { EventEmitter, once } from "node:events";
import { fetchInbox, onReBadge } from "../src/lib/api.ts";
import { loadSeen } from "../src/lib/seen.ts";
import { startInboxPoll, type InboxPollState } from "../src/lib/inboxpoll.ts";

class Visibility extends EventTarget {
  visibilityState: DocumentVisibilityState = "visible";
  set(value: DocumentVisibilityState) { this.visibilityState = value; this.dispatchEvent(new Event("visibilitychange")); }
}
const httpFetch = globalThis.fetch.bind(globalThis);
let server: Server;
let base: string;
let mode: "hold" | "pass" | "heal";
let events: EventEmitter;
let paths: string[];
let polls: ReturnType<typeof startInboxPoll>[];
let identity = 0;
beforeEach(async () => {
  mode = "hold"; events = new EventEmitter(); paths = []; polls = [];
  server = createServer((req, res) => {
    const path = new URL(req.url!, "http://localhost").pathname;
    paths.push(path);
    let closed!: () => void;
    const closure = new Promise<void>((resolve) => { closed = resolve; });
    res.on("close", closed);
    events.emit("request", { path, closed: closure });
    if (path === "/api/seen" && mode === "hold") return;
    res.setHeader("Content-Type", "application/json");
    if (path === "/api/seen" && mode === "heal") {
      res.statusCode = 400;
      res.end(JSON.stringify({ code: "not-your-actor", error: "claim needed" }));
    } else if (path === "/claim") {
      mode = "pass"; res.end("{}");
    } else if (path === "/api/seen") res.end(JSON.stringify({ marks: {} }));
    else res.end(JSON.stringify({ entries: [], marks: {}, homes: {}, unavailable: [] }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  // Resolve the browser's relative URLs while retaining the actual API
  // request, its recovery, and native fetch's socket cancellation.
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => httpFetch(new URL(String(input), base), init));
});
afterEach(async () => {
  for (const poll of polls) poll.stop();
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  vi.unstubAllGlobals();
});
function start(visibility: Visibility, actorId = `usr_setup_${++identity}`) {
  const poll = startInboxPoll({
    visibility,
    prepare: async (signal) => {
      if (!await loadSeen(actorId, { signal })) throw new Error("Seen read unavailable");
    },
    read: (signal) => fetchInbox(actorId, signal),
    changed: (state) => events.emit("changed", state),
  });
  polls.push(poll);
  return { poll, actorId };
}

it.each(["hidden", "unmounted"])("closes stalled seen HTTP when %s and permits a fresh attempt", async (reason) => {
  const visibility = new Visibility();
  const requested = once(events, "request");
  const { poll, actorId } = start(visibility);
  const [held] = await requested;
  expect(held.path).toBe("/api/seen");
  expect(paths).toEqual(["/api/seen"]); // no inbox before claim preparation
  if (reason === "hidden") visibility.set("hidden"); else poll.stop();
  await held.closed;
  expect(paths).toEqual(["/api/seen"]);
  mode = "pass";
  const changed = once(events, "changed");
  if (reason === "hidden") visibility.set("visible"); else start(visibility, actorId);
  const [state] = await changed as [InboxPollState];
  expect(state.error).toBeNull();
  expect(state.data).not.toBeNull();
  expect(paths).toEqual(["/api/seen", "/api/seen", "/api/inbox"]);
});

it("bounds a stalled initial read, shows failure, and lets manual refresh recover", async () => {
  const visibility = new Visibility();
  const requested = once(events, "request");
  const changed = once(events, "changed");
  const started = performance.now();
  const { poll } = start(visibility);
  const [held] = await requested;
  const [state] = await changed as [InboxPollState];
  expect(state).toMatchObject({ data: null, loading: false, error: "Seen read unavailable" });
  expect(performance.now() - started).toBeGreaterThanOrEqual(8000 - 100);
  expect(performance.now() - started).toBeLessThan(8000 + 5000);
  await held.closed;
  expect(paths).toEqual(["/api/seen"]);
  mode = "pass";
  const recovered = once(events, "changed");
  poll.refresh();
  const [next] = await recovered as [InboxPollState];
  expect(next.error).toBeNull();
  expect(next.data).not.toBeNull();
  expect(paths).toEqual(["/api/seen", "/api/seen", "/api/inbox"]);
}, 20_000);

it("finishes claim recovery and the replayed seen read before asking for the inbox", async () => {
  mode = "heal";
  onReBadge(async () => { await fetch("/claim"); });
  const changed = once(events, "changed");
  start(new Visibility());
  const [state] = await changed as [InboxPollState];
  expect(state.error).toBeNull();
  expect(paths).toEqual(["/api/seen", "/claim", "/api/seen", "/api/inbox"]);
});

it("manual refresh cancels and replaces a still-pending initial seen read", async () => {
  const requested = once(events, "request");
  const { poll } = start(new Visibility());
  const [held] = await requested;
  expect(held.path).toBe("/api/seen");
  mode = "pass";
  const changed = once(events, "changed");
  poll.refresh();
  const [state] = await changed as [InboxPollState];
  expect(state.error).toBeNull();
  expect(state.data).not.toBeNull();
  await held.closed;
  expect(paths).toEqual(["/api/seen", "/api/seen", "/api/inbox"]);
}, 15_000);

it("heals concurrent unscoped and canvas-scoped reads with one shared claim", async () => {
  mode = "heal";
  let twoSeen!: () => void;
  const bothRequested = new Promise<void>((resolve) => { twoSeen = resolve; });
  events.on("request", () => { if (paths.filter((path) => path === "/api/seen").length === 2) twoSeen(); });
  let claims = 0;
  onReBadge(async () => { claims++; await bothRequested; await fetch("/claim"); });
  const actorId = `usr_setup_${++identity}`;
  const result = await Promise.all([
    loadSeen(actorId, { refresh: true }),
    loadSeen(actorId, { refresh: true, canvasId: "prj_target" }),
  ]);
  expect(result).toEqual([true, true]);
  expect(claims).toBe(1);
  expect(paths.filter((path) => path === "/api/seen")).toHaveLength(4);
});

it("does not replay a canceled seen waiter after another scope's shared claim completes", async () => {
  mode = "heal";
  let twoSeen!: () => void;
  const bothRequested = new Promise<void>((resolve) => { twoSeen = resolve; });
  events.on("request", () => { if (paths.filter((path) => path === "/api/seen").length === 2) twoSeen(); });
  let release!: () => void;
  const claiming = new Promise<void>((resolve) => { release = resolve; });
  onReBadge(async () => { await claiming; await fetch("/claim"); });
  const actorId = `usr_setup_${++identity}`;
  const controller = new AbortController();
  const leaving = loadSeen(actorId, { signal: controller.signal });
  const active = loadSeen(actorId, { canvasId: "prj_target" });
  await bothRequested;
  controller.abort();
  await expect(leaving).rejects.toThrow();
  release();
  expect(await active).toBe(true);
  expect(paths.filter((path) => path === "/api/seen")).toHaveLength(3);
  expect(paths.filter((path) => path === "/claim")).toHaveLength(1);
});
