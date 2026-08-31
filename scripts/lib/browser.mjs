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

export async function browser() {
  const dir = mkdtempSync(path.join(tmpdir(), "isocan-cdp-"));
  const proc = spawn(chromeOrDie(), ["--headless=new", "--remote-debugging-port=0",
    `--user-data-dir=${dir}`, "--no-first-run", "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
  // Ordinary resolution first, and the explicit path only as the fallback it
  // was meant to be. The hardcoded one alone fails in a git WORKTREE, whose
  // `node_modules` is the main checkout's and not `repo/node_modules` — so the
  // graders could not run there at all, which reads exactly like a flake to
  // whoever meets it.
  const { default: WebSocket } = await import("ws").catch(() =>
    import(new URL("../../node_modules/ws/index.js", import.meta.url).href),
  );
  let endpoint;
  try {
    endpoint = await devtoolsEndpoint(dir, proc);
  } catch (err) {
    proc.kill(); rmSync(dir, { recursive: true, force: true }); throw err;
  }
  // The browser endpoint, then a page target of our own — created rather than
  // discovered, so nothing depends on which targets happen to exist.
  const browserWs = new WebSocket(endpoint, { maxPayload: 1 << 28 });
  await new Promise((r, j) => { browserWs.once("open", r); browserWs.once("error", j); });
  let bid = 0; const bpending = new Map();
  browserWs.on("message", (d) => {
    const m = JSON.parse(d.toString());
    if (m.id && bpending.has(m.id)) { bpending.get(m.id)(m); bpending.delete(m.id); }
  });
  const bsend = (method, params = {}) => {
    const mid = ++bid; browserWs.send(JSON.stringify({ id: mid, method, params }));
    return new Promise((res, rej) => bpending.set(mid, (m) => (m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result))));
  };
  const { targetId } = await bsend("Target.createTarget", { url: "about:blank" });
  const { targetInfos } = await bsend("Target.getTargets");
  const mine = targetInfos.find((t) => t.targetId === targetId);
  if (!mine) throw new Error("chrome would not make a page target");
  const wsUrl = endpoint.replace(/\/devtools\/browser\/.*$/, `/devtools/page/${targetId}`);
  const ws = new WebSocket(wsUrl, { maxPayload: 1 << 28 });
  await new Promise((r, j) => { ws.once("open", r); ws.once("error", j); });
  let id = 0; const pending = new Map(); let errors = [];
  /** Callers waiting on a CDP EVENT rather than a reply — see `once`. */
  const waiters = new Map();
  ws.on("message", (d) => {
    const m = JSON.parse(d.toString());
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === "Runtime.exceptionThrown") errors.push((m.params.exceptionDetails?.exception?.description ?? "").split("\n")[0]);
    const w = waiters.get(m.method);
    if (w) { waiters.delete(m.method); w(m.params); }
  });
  const send = (method, params = {}) => {
    const mid = ++id; ws.send(JSON.stringify({ id: mid, method, params }));
    return new Promise((res, rej) => pending.set(mid, (m) => (m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result))));
  };
  await send("Page.enable"); await send("Runtime.enable");
  return {
    send,
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
    takeErrors: () => { const e = errors; errors = []; return e; },
    close: async () => {
      try { ws.close(); } catch {}
      proc.kill();
      await new Promise((r) => { proc.once("exit", r); setTimeout(r, 2000); });
      try { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch {}
    },
  };
}
