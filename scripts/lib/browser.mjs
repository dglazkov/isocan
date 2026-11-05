#!/usr/bin/env node
/**
 * **One headless browser, for everything that has to actually look.**
 *
 * Lifted out of `scripts/grade.mjs` when the journeys runner needed the same
 * plumbing. Copying seventy lines of CDP setup would have been the exact
 * mistake `docs/development.md` now warns about: two copies, both correct on
 * the day they are made, and nothing anywhere that notices when one of them
 * stops being. Importing `grade.mjs` was not an option either — it runs its
 * whole main at top level, so an import would launch a browser and exit(2).
 *
 * The Chrome-finding below is not defensive noise. `release.yml` ran the
 * graders on every commit for weeks against a hardcoded path that ENOENT'd
 * every time, and `continue-on-error` turned that into a green tick — the
 * checks that exist to stop us believing a silent zero were themselves a
 * silent zero.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/** Local, so this module needs nothing from its callers. */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * **Where Chrome is, which is not one place.**
 *
 * This was a single macOS path, and the consequence was the lesson arriving a
 * third time. `release.yml` has run `--selftest` on every commit for weeks
 * under a comment reading "Chrome is on the GitHub runner already" — true, at
 * `/usr/bin/google-chrome`. The spawn ENOENT'd every single time, and
 * `continue-on-error` turned it into a green checkmark. The graders that exist
 * to stop us believing a silent zero were themselves a silent zero, in the one
 * place we pointed at when we said they were checked.
 *
 * `CHROME_PATH` first so a machine can always answer for itself; then the
 * ordinary places on both platforms. `chromeOrDie` says what it looked for
 * rather than throwing a bare ENOENT, because the whole failure above was
 * somebody reading an error that did not name its own cause.
 */
export const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  process.env.CHROME_BIN,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/opt/google/chrome/chrome",
].filter(Boolean);

export function chromeOrDie() {
  // An env var that is SET and wrong is a mistake, not a hint: falling
  // through to whatever else is on the machine would grade with a browser
  // nobody asked for and say nothing, which is the shape of the bug this
  // whole block exists to close.
  for (const name of ["CHROME_PATH", "CHROME_BIN"]) {
    const asked = process.env[name];
    if (asked && !existsSync(asked)) throw new Error(`${name} is set to ${asked} — nothing there`);
  }
  for (const candidate of CHROME_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    "no Chrome found — set CHROME_PATH. Looked in:\n  " + CHROME_CANDIDATES.join("\n  "),
  );
}

/**
 * **Chrome picks the port, and tells us which one it picked.**
 *
 * It used to be `9500 + (pid % 400)`, which is a guess with two ways to be
 * wrong and no way to notice either. Two graders whose pids differ by exactly
 * 400 want one port; and a Chrome left behind by an aborted run still HOLDS
 * that port, so the next grader's `/json/list` answers with the OLD browser's
 * target and it drives somebody else's browser. Two graders sharing one page,
 * each navigating under the other, is a reading of whatever happened to be
 * loaded — which is exactly the shape of "reported one failure on a page built
 * to break seven".
 *
 * `--remote-debugging-port=0` makes Chrome bind a free port and write it to
 * `DevToolsActivePort` in the profile directory. The profile is a fresh
 * mkdtemp, so that file cannot be anybody else's, and reading it is a fact
 * rather than a guess. Waiting for it is a condition — the file exists or it
 * does not — and never a duration.
 */
async function devtoolsEndpoint(dir, proc) {
  const file = path.join(dir, "DevToolsActivePort");
  // Bounded so a Chrome that never starts fails rather than hangs; the bound
  // is a deadline on a CONDITION, which is the honest use of a clock — the
  // loop exits the moment the file appears, not when a timer says it should.
  const deadline = Date.now() + 30_000;
  for (;;) {
    if (proc.exitCode !== null) throw new Error(`chrome exited (${proc.exitCode}) before it was ready`);
    try {
      const [port, wsPath] = readFileSync(file, "utf8").split("\n");
      if (port && wsPath) return `ws://127.0.0.1:${port.trim()}${wsPath.trim()}`;
    } catch (err) {
      /**
       * **Only "not there yet" is ordinary here.**
       *
       * This was a bare `catch {}`, and extracting this function proved why
       * that matters: `readFileSync` was missing from the new module's
       * imports, the resulting `ReferenceError` was swallowed as if it were a
       * file that had not appeared, and the loop spun for its full thirty
       * seconds before reporting "chrome did not write DevToolsActivePort" —
       * naming the one cause it was not. A catch that eats every error turns
       * a one-line mistake into a plausible thirty-second lie.
       */
      if ((err instanceof Error && "code" in err && err.code === "ENOENT") === false) throw err;
    }
    if (Date.now() > deadline) throw new Error(`chrome did not write ${file} — no DevTools endpoint`);
    await sleep(50);
  }
}

/** Poll an expression in the page until it is true, or say what was waited for. */
export async function until(b, expression, what, ms = 15_000) {
  const deadline = Date.now() + ms;
  let lastError;
  while (Date.now() < deadline) {
    try {
      if (await b.ev(expression, { timeoutMs: Math.max(1, deadline - Date.now()) })) return;
      lastError = undefined;
    } catch (error) { lastError = error; }
    const remaining = deadline - Date.now();
    if (remaining > 0) await sleep(Math.min(200, remaining));
  }
  throw new Error(`timed out waiting for ${what}${lastError ? `: ${lastError.message}` : ""}`);
}

/**
 * **Through the identity door, as a named actor.**
 *
 * A canvas page is behind the door, so a headless browser has to claim an
 * identity before it can look. The claim is made INSIDE the page — the
 * `/api/` strings below are the web client's own speech, evaluated in its
 * origin, not a Node-side client — and written to the key the app reads.
 * One copy here, shared by the journeys runner and the canvas screenshot,
 * because two copies of a door-crossing would be two doors.
 *
 * The page must already be AT `origin`: relative fetches from `about:blank`
 * fail with "Failed to fetch", which reads as a daemon that is down and is
 * nothing of the kind.
 */
export async function throughTheDoor(b, origin, name, clientId = "browser") {
  await until(b, `location.origin === ${JSON.stringify(origin)}`, `the page to be at ${origin}`);
  await b.ev(`(async () => {
    await fetch("/api/door", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ carrier: "cookie" }) });
    const r = await fetch("/api/ops", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canvasId: null, clientId: ${JSON.stringify(clientId)},
        op: { type: "actor.claim", name: ${JSON.stringify(name)} } }) });
    const j = await r.json();
    if (!j.envelope) throw new Error("the door did not hand out an identity: " + JSON.stringify(j).slice(0, 200));
    localStorage.setItem("isocan.identity", JSON.stringify(j.envelope.actor));
    return true;
  })()`);
}

/** One CDP socket: every opening, reply and event wait has its own deadline. */
function cdpChannel(socket, label, timeoutMs) {
  let nextId = 0, stopped = null;
  const pending = new Map(), waiters = new Map(), listeners = new Map();
  const deadline = (ms) => {
    if (!Number.isFinite(ms) || ms <= 0 || ms > 2 ** 31 - 1) throw new Error("CDP timeoutMs must be a positive finite timer duration");
    return ms;
  };
  deadline(timeoutMs);
  const waiting = (description, ms, remove) => {
    deadline(ms);
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    // Event waits are armed before their triggering command. If that command
    // fails, cleanup must not turn the abandoned event into an unhandled rejection.
    // The ORIGINAL promise still rejects when awaited by its owner.
    promise.catch(() => {});
    const timer = setTimeout(() => finish(new Error(`${label} CDP timed out waiting for ${description} after ${ms}ms`)), ms);
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true; clearTimeout(timer); remove();
      if (error) reject(error); else resolve(value);
    };
    return { promise, finish };
  };
  const fail = (error) => {
    if (stopped) return;
    stopped = error;
    opening.finish(error);
    for (const entry of [...pending.values()]) entry.finish(error);
    for (const group of [...waiters.values()]) for (const entry of [...group]) entry.finish(error);
    listeners.clear();
    socket.off("message", message);
  };
  const onOpen = () => opening.finish();
  const opening = waiting("socket opening", timeoutMs, () => socket.off("open", onOpen));
  const onError = (error) => fail(new Error(`${label} CDP socket error: ${error.message}`));
  const onClose = () => {
    fail(new Error(`${label} CDP socket closed`));
    socket.off("close", onClose); socket.off("error", onError);
  };
  const message = (data) => {
    let m;
    try { m = JSON.parse(data.toString()); } catch (error) { fail(new Error(`${label} CDP invalid reply: ${error.message}`)); return; }
    if (m.id) {
      pending.get(m.id)?.finish(m.error ? new Error(`${label} CDP ${JSON.stringify(m.error)}`) : null, m.result);
      return; // A late reply after timeout is not an event.
    }
    for (const listener of listeners.get(m.method) ?? []) listener(m.params, m.sessionId);
    for (const entry of [...(waiters.get(m.method) ?? [])]) entry.finish(null, m.params);
  };
  socket.on("open", onOpen); socket.on("error", onError); socket.on("close", onClose); socket.on("message", message);
  if (socket.readyState === 1) onOpen();
  else if (socket.readyState >= 2) onClose();
  return {
    opened: opening.promise,
    send: (method, params = {}, sessionId, { timeoutMs: ms = timeoutMs } = {}) => {
      if (stopped) return Promise.reject(stopped);
      if (socket.readyState !== 1) return Promise.reject(new Error(`${label} CDP socket is not open`));
      const id = ++nextId;
      const entry = waiting(method, ms, () => pending.delete(id));
      pending.set(id, entry); // Arm before send: even a synchronous reply belongs to this call.
      try {
        socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }), (error) => {
          if (error) entry.finish(new Error(`${label} CDP ${method} send failed: ${error.message}`));
        });
      } catch (error) { entry.finish(error); }
      return entry.promise;
    },
    once: (method, { timeoutMs: ms = timeoutMs } = {}) => {
      if (stopped) { const promise = Promise.reject(stopped); promise.catch(() => {}); return promise; }
      if (!waiters.has(method)) waiters.set(method, new Set());
      const group = waiters.get(method);
      const entry = waiting(`event ${method}`, ms, () => {
        group.delete(entry);
        if (!group.size) waiters.delete(method);
      });
      group.add(entry);
      return entry.promise;
    },
    on: (method, listener) => {
      if (stopped) throw stopped;
      if (!listeners.has(method)) listeners.set(method, new Set());
      const group = listeners.get(method);
      group.add(listener);
      return () => { group.delete(listener); if (!group.size && listeners.get(method) === group) listeners.delete(method); };
    },
    dispose: () => fail(new Error(`${label} CDP connection disposed`)),
  };
}

/**
 * `headless: false` omits `--headless=new`, so Chrome opens a visible window.
 * `args` are extra Chrome switches for a caller that measures something the
 * default browser cannot — `scripts/local-judge-measure.mjs` asks for WebGPU,
 * a resolver that reaches nothing but loopback, and a net log. They are
 * appended after the defaults and never replace them. `timeoutMs` bounds each
 * CDP open, reply and event wait (30 s by default). Long batch evaluations may
 * pass their own finite bound to `ev(expression, { timeoutMs })`; polling uses
 * its remaining budget instead, so a hung evaluate cannot outlive the poll.
 */
export async function browser({ proxyServer = null, args = [], headless = true, timeoutMs = 30_000 } = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2 ** 31 - 1) throw new Error("CDP timeoutMs must be a positive finite timer duration");
  if (proxyServer !== null && !/^http:\/\/127\.0\.0\.1:\d+$/.test(proxyServer)) throw new Error("Browser proxy must be an owned loopback endpoint");
  // **`ws` before Chrome** (cleanup phase 4, DC-1, 27 Sep 2026). This import
  // came after the spawn, so on the release tree — which had no `ws` to give
  // it — every `isocan canvas shot` and PDF export started a headless Chrome,
  // failed to import, and exited leaving that Chrome running. Nothing can be
  // left behind by a process that has not been started yet.
  //
  // Ordinary resolution first, and the explicit path only as the fallback it
  // was meant to be. The hardcoded one alone fails in a git WORKTREE, whose
  // `node_modules` is the main checkout's and not `repo/node_modules` — so the
  // graders could not run there at all, which reads exactly like a flake to
  // whoever meets it.
  const { default: WebSocket } = await import("ws").catch(() =>
    import(new URL("../../node_modules/ws/index.js", import.meta.url).href),
  );
  const dir = mkdtempSync(path.join(tmpdir(), "isocan-cdp-"));
  // `headless: false` opens a real window — for a measurement that must not be
  // taken in headless mode (the local judge's GPU timings). Every other caller
  // keeps the default.
  //
  // **No code-sign clone.** On macOS, Chrome copies itself into a temp folder
  // at every start and deletes the copy when it quits. A grader that kills
  // Chrome leaves the copy behind, and each copy that touches the network gets
  // its own "Google Chrome" row in System Settings' Local Network list — 117
  // copies and 13 extra rows built up this way before anyone noticed. The
  // feature only exists to survive an update mid-run, which a throwaway
  // profile never needs. A caller's own `--disable-features` would replace
  // this one (Chrome keeps the last), so pass more features here, not there.
  const proc = spawn(chromeOrDie(), [...(headless ? ["--headless=new"] : []), "--remote-debugging-port=0",
    `--user-data-dir=${dir}`, "--no-first-run", "--hide-scrollbars", "--disable-features=MacAppCodeSignClone",
    ...(proxyServer ? [`--proxy-server=${proxyServer}`, "--proxy-bypass-list=<-loopback>", "--disable-quic", "--force-webrtc-ip-handling-policy=disable_non_proxied_udp"] : []),
    ...args,
    "about:blank"], { stdio: "ignore" });
  // **Every failure from here to a working handle takes Chrome with it**
  // (DC-1). Only the DevTools wait had a cleanup; a socket that would not
  // open, or a target Chrome would not make, threw past a live browser that
  // nothing held a handle to any more.
  const sockets = [];
  try {
    return await drive(proc, dir, WebSocket, sockets, timeoutMs);
  } catch (err) {
    // A socket still connecting emits `error` when terminated, and with no
    // listener that would crash the process over the teardown of a failure
    // already being thrown below — which is the error worth reading.
    for (const socket of sockets) { socket.on("error", () => {}); socket.terminate(); }
    proc.kill("SIGKILL");
    rmSync(dir, { recursive: true, force: true });
    throw err;
  }
}

async function drive(proc, dir, WebSocket, sockets, timeoutMs) {
  const endpoint = await devtoolsEndpoint(dir, proc);
  // The browser endpoint, then a page target of our own — created rather than
  // discovered, so nothing depends on which targets happen to exist.
  const browserWs = new WebSocket(endpoint, { maxPayload: 1 << 28 });
  sockets.push(browserWs);
  const browserChannel = cdpChannel(browserWs, "browser", timeoutMs);
  await browserChannel.opened;
  const bsend = browserChannel.send;
  const { targetId } = await bsend("Target.createTarget", { url: "about:blank" });
  const { targetInfos } = await bsend("Target.getTargets");
  const mine = targetInfos.find((t) => t.targetId === targetId);
  if (!mine) throw new Error("chrome would not make a page target");
  const wsUrl = endpoint.replace(/\/devtools\/browser\/.*$/, `/devtools/page/${targetId}`);
  const ws = new WebSocket(wsUrl, { maxPayload: 1 << 28 });
  sockets.push(ws);
  const pageChannel = cdpChannel(ws, "page", timeoutMs);
  await pageChannel.opened;
  let errors = [];
  pageChannel.on("Runtime.exceptionThrown", (params) => errors.push((params.exceptionDetails?.exception?.description ?? "").split("\n")[0]));
  // sessionId addresses a flattened Worker target over this same socket.
  const send = pageChannel.send;
  await send("Page.enable"); await send("Runtime.enable");
  let closing;
  return {
    send,
    /** The Chrome process, so a caller can read its process tree's memory. */
    pid: proc.pid,
    /** Observe every occurrence, including requests for images and frames.
     * Return an unsubscribe function so a journey can bound its observation. */
    on: pageChannel.on,
    /**
     * **Arm a listener for one CDP event, BEFORE the thing that causes it.**
     *
     * The order is the whole point: arming after `Page.navigate` is a race
     * that a fast load wins, and the symptom of losing it is a wait that
     * never ends. So callers arm, then act, then await.
     */
    once: pageChannel.once,
    ev: async (e, options) => {
      const r = await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true }, undefined, options);
      if (r.exceptionDetails) {
        const d = r.exceptionDetails;
        throw new Error(`probe threw: ${d.exception?.description ?? d.text}`.split("\n")[0]);
      }
      return r.result?.value;
    },
    takeErrors: () => { const e = errors; errors = []; return e; },
    close: () => closing ??= (async () => {
      pageChannel.dispose(); browserChannel.dispose();
      // The browser control socket keeps Node alive just as the page socket
      // does. Close both, and terminate a peer that never finishes its close.
      await Promise.all([ws, browserWs].map((socket) => new Promise((resolve) => {
        if (socket.readyState === WebSocket.CLOSED) return resolve();
        const done = () => { clearTimeout(timer); socket.off("close", done); resolve(); };
        const timer = setTimeout(() => { socket.terminate(); done(); }, 500);
        socket.once("close", done);
        try { socket.close(); } catch { socket.terminate(); done(); }
      })));
      const alive = () => proc.exitCode === null && proc.signalCode === null;
      const stop = (signal) => new Promise((resolve) => {
        if (!alive()) return resolve();
        const done = () => { clearTimeout(timer); proc.off("exit", done); resolve(); };
        const timer = setTimeout(done, 2000);
        proc.once("exit", done);
        proc.kill(signal);
      });
      await stop("SIGTERM");
      if (alive()) await stop("SIGKILL");
      if (alive()) throw new Error("the owned Chrome process did not exit");
      // Several journeys close browsers together. Blocking profile removal can
      // hold the event loop past another browser’s exit timer, before its queued
      // exit event is delivered. Await removal without blocking that delivery.
      await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    })(),
  };
}
