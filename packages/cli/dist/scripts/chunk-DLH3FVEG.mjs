import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);

// scripts/lib/browser.mjs
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
var CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  process.env.CHROME_BIN,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/opt/google/chrome/chrome"
].filter(Boolean);
function chromeOrDie() {
  for (const name of ["CHROME_PATH", "CHROME_BIN"]) {
    const asked = process.env[name];
    if (asked && !existsSync(asked)) throw new Error(`${name} is set to ${asked} \u2014 nothing there`);
  }
  for (const candidate of CHROME_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    "no Chrome found \u2014 set CHROME_PATH. Looked in:\n  " + CHROME_CANDIDATES.join("\n  ")
  );
}
async function devtoolsEndpoint(dir, proc) {
  const file = path.join(dir, "DevToolsActivePort");
  const deadline = Date.now() + 3e4;
  for (; ; ) {
    if (proc.exitCode !== null) throw new Error(`chrome exited (${proc.exitCode}) before it was ready`);
    try {
      const [port, wsPath] = readFileSync(file, "utf8").split("\n");
      if (port && wsPath) return `ws://127.0.0.1:${port.trim()}${wsPath.trim()}`;
    } catch (err) {
      if ((err instanceof Error && "code" in err && err.code === "ENOENT") === false) throw err;
    }
    if (Date.now() > deadline) throw new Error(`chrome did not write ${file} \u2014 no DevTools endpoint`);
    await sleep(50);
  }
}
async function until(b, expression, what, ms = 15e3) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await b.ev(expression).catch(() => false)) return;
    await sleep(200);
  }
  throw new Error(`timed out waiting for ${what}`);
}
async function throughTheDoor(b, origin, name, clientId = "browser") {
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
async function browser({ proxyServer = null } = {}) {
  if (proxyServer !== null && !/^http:\/\/127\.0\.0\.1:\d+$/.test(proxyServer)) throw new Error("Browser proxy must be an owned loopback endpoint");
  const { default: WebSocket } = await import("./wrapper-WSTJGJ5M.mjs").catch(
    () => import(new URL("../../node_modules/ws/index.js", import.meta.url).href)
  );
  const dir = mkdtempSync(path.join(tmpdir(), "isocan-cdp-"));
  const proc = spawn(chromeOrDie(), [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=${dir}`,
    "--no-first-run",
    "--hide-scrollbars",
    ...proxyServer ? [`--proxy-server=${proxyServer}`, "--proxy-bypass-list=<-loopback>", "--disable-quic", "--force-webrtc-ip-handling-policy=disable_non_proxied_udp"] : [],
    "about:blank"
  ], { stdio: "ignore" });
  const sockets = [];
  try {
    return await drive(proc, dir, WebSocket, sockets);
  } catch (err) {
    for (const socket of sockets) {
      socket.on("error", () => {
      });
      socket.terminate();
    }
    proc.kill("SIGKILL");
    rmSync(dir, { recursive: true, force: true });
    throw err;
  }
}
async function drive(proc, dir, WebSocket, sockets) {
  const endpoint = await devtoolsEndpoint(dir, proc);
  const browserWs = new WebSocket(endpoint, { maxPayload: 1 << 28 });
  sockets.push(browserWs);
  await new Promise((r, j) => {
    browserWs.once("open", r);
    browserWs.once("error", j);
  });
  let bid = 0;
  const bpending = /* @__PURE__ */ new Map();
  browserWs.on("message", (d) => {
    const m = JSON.parse(d.toString());
    if (m.id && bpending.has(m.id)) {
      bpending.get(m.id)(m);
      bpending.delete(m.id);
    }
  });
  const bsend = (method, params = {}) => {
    const mid = ++bid;
    browserWs.send(JSON.stringify({ id: mid, method, params }));
    return new Promise((res, rej) => bpending.set(mid, (m) => m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result)));
  };
  const { targetId } = await bsend("Target.createTarget", { url: "about:blank" });
  const { targetInfos } = await bsend("Target.getTargets");
  const mine = targetInfos.find((t) => t.targetId === targetId);
  if (!mine) throw new Error("chrome would not make a page target");
  const wsUrl = endpoint.replace(/\/devtools\/browser\/.*$/, `/devtools/page/${targetId}`);
  const ws = new WebSocket(wsUrl, { maxPayload: 1 << 28 });
  sockets.push(ws);
  await new Promise((r, j) => {
    ws.once("open", r);
    ws.once("error", j);
  });
  let id = 0;
  const pending = /* @__PURE__ */ new Map();
  let errors = [];
  const waiters = /* @__PURE__ */ new Map();
  const listeners = /* @__PURE__ */ new Map();
  ws.on("message", (d) => {
    const m = JSON.parse(d.toString());
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
      return;
    }
    for (const listener of listeners.get(m.method) ?? []) listener(m.params);
    if (m.method === "Runtime.exceptionThrown") errors.push((m.params.exceptionDetails?.exception?.description ?? "").split("\n")[0]);
    const w = waiters.get(m.method);
    if (w) {
      waiters.delete(m.method);
      w(m.params);
    }
  });
  const send = (method, params = {}) => {
    const mid = ++id;
    ws.send(JSON.stringify({ id: mid, method, params }));
    return new Promise((res, rej) => pending.set(mid, (m) => m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result)));
  };
  await send("Page.enable");
  await send("Runtime.enable");
  let closing;
  return {
    send,
    /** Observe every occurrence, including requests for images and frames.
     * Return an unsubscribe function so a journey can bound its observation. */
    on: (method, listener) => {
      if (!listeners.has(method)) listeners.set(method, /* @__PURE__ */ new Set());
      const group = listeners.get(method);
      group.add(listener);
      return () => {
        group.delete(listener);
        if (group.size === 0 && listeners.get(method) === group) listeners.delete(method);
      };
    },
    /**
     * **Arm a listener for one CDP event, BEFORE the thing that causes it.**
     *
     * The order is the whole point: arming after `Page.navigate` is a race
     * that a fast load wins, and the symptom of losing it is a wait that
     * never ends. So callers arm, then act, then await.
     */
    once: (method) => new Promise((res) => waiters.set(method, res)),
    ev: async (e) => {
      const r = await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) {
        const d = r.exceptionDetails;
        throw new Error(`probe threw: ${d.exception?.description ?? d.text}`.split("\n")[0]);
      }
      return r.result?.value;
    },
    takeErrors: () => {
      const e = errors;
      errors = [];
      return e;
    },
    close: () => closing ??= (async () => {
      listeners.clear();
      await Promise.all([ws, browserWs].map((socket) => new Promise((resolve) => {
        if (socket.readyState === WebSocket.CLOSED) return resolve();
        const done = () => {
          clearTimeout(timer);
          socket.off("close", done);
          resolve();
        };
        const timer = setTimeout(() => {
          socket.terminate();
          done();
        }, 500);
        socket.once("close", done);
        try {
          socket.close();
        } catch {
          socket.terminate();
          done();
        }
      })));
      const alive = () => proc.exitCode === null && proc.signalCode === null;
      const stop = (signal) => new Promise((resolve) => {
        if (!alive()) return resolve();
        const done = () => {
          clearTimeout(timer);
          proc.off("exit", done);
          resolve();
        };
        const timer = setTimeout(done, 2e3);
        proc.once("exit", done);
        proc.kill(signal);
      });
      await stop("SIGTERM");
      if (alive()) await stop("SIGKILL");
      if (alive()) throw new Error("the owned Chrome process did not exit");
      await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    })()
  };
}

export {
  until,
  throughTheDoor,
  browser
};
