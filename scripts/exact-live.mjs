#!/usr/bin/env node
/**
 * **The live bridge between a browser and an Exact app on this machine**
 * (exact phase 2; `docs/projects/exact/design.md` §2, §5, §6).
 *
 *   node scripts/exact-live.mjs --app <dir> [--child '<argv json>'] [--bridge-port <n>] [--frames-port <n>]
 *                               [--loop-port <n>] [--design-port 5173] [--json]
 *
 * `isocan exact live <app>` runs this through `runPackageScript` (a module
 * never spawns), and it stays up until ctrl-c. It owns, for one app:
 *
 * - **the dev loop** — `bun exact.mjs web`, the app's own launcher, on a
 *   loopback port, with `EXACT_TOOL_PORT` set to Exact Design's port so
 *   *Open in Exact Design* can frame it too;
 * - **the frames proxy** — the dev page on a loopback port of our own, its
 *   `frame-ancestors` rewritten to name the canvas pages that paired, and the
 *   page's own requests' `Origin` rewritten to the loop's (exact phase 0,
 *   fact 1: without that the page's registration is refused 421);
 * - **the bridge API** — pairing, Tamber's `inspect` and `outline` through
 *   the loop's local token, the `selection` events relayed with the file's
 *   digest, and *Open in editor*. Loopback only; every request but `/pair`
 *   carries a token a pairing minted, kept in memory (a restart revokes it);
 * - **Drive mode** (exact phase 3; design §7) — `/drive` replays a drive on
 *   any host this session captures (`--hosts`; iOS only on the simulator
 *   `--sim` names): a cold `agent <host>` at the capture's fixed seed, the
 *   screen reached as its shots say, then each press and each text the
 *   browser sent (a closed list: `tap <testId>`, `type <testId> "<text>"`,
 *   `back`), each followed by `clock settle`, then a fresh screenshot with
 *   its nodes. The browser keeps the drive; the bridge keeps nothing.
 * - **the inspector** (exact phase 4; design §8) — `/facts` answers one
 *   screen's `tree --ax`, `layout`, `perf` and `logs` from a cold driver at
 *   its shots, by the capture bridge's own `facts`, in the drive queue.
 * - **films** (exact phase 4) — `/film` films a press on a screen by the
 *   capture bridge's own `film` and answers the strip's bytes and the state at
 *   each frame; the paired browser lands it beside the map.
 * - **the capture loop** — `--child` is the CLI's own `isocan exact live
 *   --no-frames`, which keeps the map's captures, versions and compile
 *   errors true on every save; its output is passed through.
 *
 * Nothing here came off a canvas, and nothing is written to one: the child
 * CLI does the writing, through the ops the CLI always sends.
 *
 * Node built-ins only: the release bundles this file (RELEASE_SCRIPTS).
 */
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const json = argv.includes("--json");
const app = flag("--app") ? path.resolve(flag("--app")) : null;
if (!app) {
  console.error("usage: exact-live.mjs --app <dir> [--child '<argv json>'] [--bridge-port <n>] [--frames-port <n>] [--loop-port <n>] [--design-port <n>] [--json]");
  process.exit(2);
}
const launcher = path.join(app, "exact.mjs");
if (!existsSync(launcher)) {
  console.error(`${app} has no exact.mjs — is it an Exact app?`);
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(path.join(app, "app.json"), "utf8"));
const appInfo = { id: manifest.app?.id ?? manifest.id ?? path.basename(app), name: manifest.app?.name ?? manifest.name ?? path.basename(app) };
const designPort = Number(flag("--design-port") ?? 5173);
const driveHosts = (flag("--hosts") ?? "web").split(",").map((h) => h.trim()).filter((h) => ["web", "ios", "macos"].includes(h));
const sim = flag("--sim") && /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i.test(flag("--sim")) ? flag("--sim") : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (text, data) => {
  if (json) process.stdout.write(`${JSON.stringify({ bridge: data ?? { text } })}\n`);
  else process.stdout.write(`${new Date().toISOString().slice(11, 19)}  ${text}\n`);
};

function freePort(asked) {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.once("error", reject);
    s.listen(asked ?? 0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

/** Is this an origin on this machine — the only pages a bridge answers? */
function loopbackOrigin(origin) {
  try {
    const u = new URL(origin);
    return (u.protocol === "http:" || u.protocol === "https:") && ["127.0.0.1", "localhost", "[::1]"].includes(u.hostname);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- children

const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const c of children) {
    try { process.kill(-c.pid, "SIGTERM"); } catch { try { c.kill("SIGTERM"); } catch { /* gone */ } }
  }
  setTimeout(() => process.exit(code), 300);
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

const loopPort = await freePort(flag("--loop-port") ? Number(flag("--loop-port")) : undefined);
const loopBase = `http://127.0.0.1:${loopPort}`;
const loop = spawn("/bin/sh", [launcher, "web", "--port", String(loopPort)], {
  cwd: app,
  detached: true,
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, EXACT_TOOL_PORT: String(designPort) },
});
children.push(loop);
let loopSaid = "";
const keep = (d) => { loopSaid = (loopSaid + d).slice(-8000); };
loop.stdout.on("data", keep);
loop.stderr.on("data", keep);
loop.on("exit", (code) => {
  if (stopping) return;
  say(`the dev loop stopped (exit ${code}): ${loopSaid.trim().split("\n").slice(-3).join(" | ")}`);
  stop(1);
});

say(`starting ${appInfo.name}'s dev loop with its own Exact, on this machine…`);
for (let i = 0; ; i++) {
  try { if ((await fetch(loopBase, { redirect: "manual" })).status < 500) break; } catch { /* not yet */ }
  if (i > 2400) { say(`the dev loop did not answer on ${loopBase} in ten minutes`); stop(1); }
  await sleep(250);
}

// ---------------------------------------------------------------- Tamber, through the loop's local token

let tamberToken = null;
try {
  const r = await fetch(`${loopBase}/__tamber/token`, { redirect: "error" });
  if (r.ok) tamberToken = (await r.json()).token;
} catch { /* an app with no design mounts no wire */ }
const CLIENT = "isocan";

async function tamber(body) {
  if (!tamberToken) return { status: 503, answer: { error: { message: "this app has no app.tamber, so its dev loop mounts no Tamber wire: inspect and outline need one" } } };
  const r = await fetch(`${loopBase}/__tamber`, { method: "POST", headers: { "content-type": "application/json", "x-exact-tamber-token": tamberToken }, body: JSON.stringify(body) });
  return { status: r.status, answer: await r.json().catch(() => null) };
}

/** What the browsers read, in order: selections and inspect mode as they move. */
const queue = [];
let seq = 0;
const waiting = new Set();
function publish(event) {
  queue.push({ seq: ++seq, ...event });
  while (queue.length > 200) queue.shift();
  for (const w of waiting) w();
}

const sha256File = (rel) => {
  const abs = path.resolve(app, rel);
  if (!abs.startsWith(app + path.sep) || !existsSync(abs)) return null;
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
};

/** Presence and the change stream: a long poll naming our client, as Tamber's long-poll clients hold the wire. */
async function follow() {
  let cursor = null;
  while (!stopping && tamberToken) {
    try {
      const r = cursor
        ? await fetch(`${loopBase}/__tamber/events?after=${encodeURIComponent(cursor)}&client=${CLIENT}`, { headers: { "x-exact-tamber-token": tamberToken } })
        : await fetch(`${loopBase}/__tamber/events`, { method: "POST", headers: { "content-type": "application/json", "x-exact-tamber-token": tamberToken }, body: JSON.stringify({ client: CLIENT }) });
      if (r.status === 204) continue;
      const answer = await r.json().catch(() => null);
      if (!answer) { await sleep(500); continue; }
      if (answer.cursor) cursor = answer.cursor;
      for (const e of answer.events ?? []) {
        if (e.event === "selection" && e.source) {
          publish({ type: "selection", build: e.build, source: { ...e.source, sha256: sha256File(e.source.file) }, rows: (e.rows ?? []).map((row) => ({ name: row.name, value: row.value, origin: row.origin ?? null, source: row.source ?? null })), readOnly: e.readOnly ?? false });
        } else if (e.event === "inspect") {
          publish({ type: "inspect", on: e.on, builds: e.builds ?? [] });
        }
      }
    } catch {
      await sleep(1000);
    }
  }
}
void follow();

// ---------------------------------------------------------------- pairing

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const tokens = new Map(); // token → { origin, at }
const framers = new Set(); // origins that paired: the frames' ancestors
let code = null;
let attempts = []; // timestamps of refused attempts, for the bucket
let bridgePort = 0;

function mint() {
  const bytes = randomBytes(10);
  let text = "";
  for (let i = 0; i < 10; i++) text += CROCKFORD[bytes[i] % 32];
  code = { text: `${text.slice(0, 5)}-${text.slice(5)}`, expires: Date.now() + 120_000, wrong: 0 };
  say(`pair a browser: on an Exact screen press Live and enter  ${bridgePort}-${code.text}  (one use, two minutes)`, { pair: { code: `${bridgePort}-${code.text}`, expires: code.expires } });
}

const normal = (c) => String(c ?? "").toUpperCase().replace(/[IL]/g, "1").replace(/O/g, "0").replace(/[^0-9A-Z]/g, "");

// ---------------------------------------------------------------- the frames proxy

const framesOff = argv.includes("--no-frames");
let framesPort = null;
if (!framesOff) {
  const proxy = http.createServer((req, res) => {
    const headers = { ...req.headers, host: `127.0.0.1:${loopPort}` };
    // The page's own requests name the proxy as their origin; the loop's development gate answers 421 to anything
    // but its own (exact phase 0, fact 1), so they are sent on as the loop's.
    if (headers.origin) headers.origin = loopBase;
    if (headers.referer) headers.referer = String(headers.referer).replace(/^http:\/\/127\.0\.0\.1:\d+/, loopBase);
    const up = http.request({ host: "127.0.0.1", port: loopPort, path: req.url, method: req.method, headers }, (r) => {
      const out = { ...r.headers };
      const csp = out["content-security-policy"];
      if (csp) {
        const ancestors = ["'self'", ...framers, `http://127.0.0.1:${designPort}`].join(" ");
        out["content-security-policy"] = String(csp).replace(/frame-ancestors[^;,]*/i, `frame-ancestors ${ancestors}`);
      }
      res.writeHead(r.statusCode ?? 502, out);
      r.pipe(res);
    });
    up.on("error", () => { if (!res.headersSent) res.writeHead(502); res.end(); });
    req.pipe(up);
  });
  framesPort = await freePort(flag("--frames-port") ? Number(flag("--frames-port")) : undefined);
  await new Promise((r) => proxy.listen(framesPort, "127.0.0.1", r));
}

// ---------------------------------------------------------------- Drive mode

const DRIVE_OP = /^(?:tap [A-Za-z0-9_.:-]{1,80}|type [A-Za-z0-9_.:-]{1,80} "(?:[^"\\\n\r]|\\.){0,400}"|back)$/;
const SHOT_LINE = /^(tap|type|clock|back|fail fetch|pass fetch|prefer)\b/;

/** A drive's shots, checked: one `at "<path>"`, then the closed list of operations a screen's shots may hold. */
function driveShots(text) {
  let url = null;
  const ops = [];
  for (const raw of String(text ?? "").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("//")) continue;
    const at = /^at\s+"([^"]*)"$/.exec(line);
    if (at && url === null && at[1].startsWith("/") && !at[1].startsWith("//") && !at[1].includes("..") && !/[\s\\]/.test(at[1])) { url = at[1]; continue; }
    if (!SHOT_LINE.test(line) || /\bcolor-scheme\b/.test(line)) return null;
    ops.push(line);
  }
  return url ? { url, ops } : null;
}

let driving = Promise.resolve();
/** One drive at a time: a simulator runs one app. */
function drive(body) {
  const run = driving.then(() => driveOnce(body));
  driving = run.catch(() => {});
  return run;
}

/**
 * **One drive, by the capture bridge's own `drive`** — the same code
 * `isocan exact live` runs for a drive asked for on the canvas, so the two
 * doors cannot drift: the screen reached, the operations replayed on a cold
 * driver, and a fresh screenshot with its nodes. Asynchronous here, so the
 * bridge keeps answering while a drive runs.
 */
function driveOnce(job) {
  return new Promise((resolve) => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "isocan-exact-drive-"));
    const done = (answer) => { rmSync(dir, { recursive: true, force: true }); resolve(answer); };
    try {
      writeFileSync(path.join(dir, "job.json"), JSON.stringify(job));
      const bridgeScript = path.join(path.dirname(fileURLToPath(import.meta.url)), "exact-bridge.mjs");
      const child = spawn(process.execPath, [bridgeScript, "drive", "--app", app, "--report", path.join(dir, "report.json"), "--dir", dir, "--job", path.join(dir, "job.json"), ...(sim ? ["--sim", sim] : [])], { stdio: ["ignore", "ignore", "pipe"] });
      let err = "";
      child.stderr.on("data", (d) => { err = (err + d).slice(-4000); });
      child.on("close", () => {
        let r;
        try { r = JSON.parse(readFileSync(path.join(dir, "report.json"), "utf8")); } catch { return done({ ok: false, png: null, points: null, results: [], ms: 0, error: err.trim().split("\n").slice(-3).join("\n") || "the drive did not answer" }); }
        const png = r.file ? readFileSync(r.file).toString("base64") : null;
        done({ ok: r.ok, code: r.code, png, points: r.points, results: r.results, ms: r.ms, ...(r.error ? { error: r.error } : {}) });
      });
    } catch (e) {
      done({ ok: false, png: null, points: null, results: [], ms: 0, error: e.message });
    }
  });
}

/**
 * **One inspection, by the capture bridge's own `facts`** (exact phase 4) —
 * the code `isocan exact live` runs for an inspection asked for on the
 * canvas: a cold driver at the screen's shots, then `tree --ax`, `layout`,
 * `perf` and `logs`, passed back as the driver printed them. In the drive
 * queue: a simulator runs one app at a time.
 */
function facts(job) {
  const run = driving.then(() => new Promise((resolve) => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "isocan-exact-facts-"));
    const done = (answer) => { rmSync(dir, { recursive: true, force: true }); resolve(answer); };
    try {
      writeFileSync(path.join(dir, "job.json"), JSON.stringify(job));
      const bridgeScript = path.join(path.dirname(fileURLToPath(import.meta.url)), "exact-bridge.mjs");
      const child = spawn(process.execPath, [bridgeScript, "facts", "--app", app, "--report", path.join(dir, "report.json"), "--job", path.join(dir, "job.json"), ...(sim ? ["--sim", sim] : [])], { stdio: ["ignore", "ignore", "pipe"] });
      let err = "";
      child.stderr.on("data", (d) => { err = (err + d).slice(-4000); });
      child.on("close", () => {
        try { done(JSON.parse(readFileSync(path.join(dir, "report.json"), "utf8"))); } catch { done({ ok: false, ms: 0, error: err.trim().split("\n").slice(-3).join("\n") || "the inspection did not answer" }); }
      });
    } catch (e) {
      done({ ok: false, ms: 0, error: e.message });
    }
  }));
  driving = run.catch(() => {});
  return run;
}

/**
 * **One film, by the capture bridge's own `film`** (exact phase 4) — the code
 * `isocan exact film` and `isocan exact live` run: the press, then the strip
 * on the virtual clock and the state at each frame. Answered with the strip's
 * bytes; the browser lands it on the canvas (this bridge writes to none).
 */
function filmOnce(job) {
  const run = driving.then(() => new Promise((resolve) => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "isocan-exact-film-"));
    const done = (answer) => { rmSync(dir, { recursive: true, force: true }); resolve(answer); };
    try {
      writeFileSync(path.join(dir, "job.json"), JSON.stringify(job));
      const bridgeScript = path.join(path.dirname(fileURLToPath(import.meta.url)), "exact-bridge.mjs");
      const child = spawn(process.execPath, [bridgeScript, "film", "--app", app, "--report", path.join(dir, "report.json"), "--dir", dir, "--job", path.join(dir, "job.json"), ...(sim ? ["--sim", sim] : [])], { stdio: ["ignore", "ignore", "pipe"] });
      let err = "";
      child.stderr.on("data", (d) => { err = (err + d).slice(-4000); });
      child.on("close", () => {
        let r;
        try { r = JSON.parse(readFileSync(path.join(dir, "report.json"), "utf8")); } catch { return done({ ok: false, error: err.trim().split("\n").slice(-3).join("\n") || "the film did not answer" }); }
        const apng = r.ok && r.file ? readFileSync(r.file).toString("base64") : null;
        const { file: _file, ...rest } = r;
        done({ ...rest, apng });
      });
    } catch (e) {
      done({ ok: false, error: e.message });
    }
  }));
  driving = run.catch(() => {});
  return run;
}

// ---------------------------------------------------------------- the bridge API

function designLink(route) {
  const q = new URLSearchParams({ connect: loopBase, name: appInfo.name, viewports: "Core" });
  if (route) q.set("show", route);
  return `http://127.0.0.1:${designPort}/?${q}`;
}

async function designUp() {
  try { return (await fetch(`http://127.0.0.1:${designPort}/`, { signal: AbortSignal.timeout(800) })).status < 500; } catch { return false; }
}

const readBody = (req) => new Promise((resolve) => {
  let text = "";
  req.on("data", (d) => { text += d; if (text.length > 65536) req.destroy(); });
  req.on("end", () => { try { resolve(text ? JSON.parse(text) : {}); } catch { resolve(null); } });
});

const api = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  const answer = (status, body) => {
    const h = { "content-type": "application/json", "cache-control": "no-store", vary: "Origin" };
    if (origin && loopbackOrigin(origin)) {
      h["access-control-allow-origin"] = origin;
      h["access-control-allow-headers"] = "authorization, content-type";
      h["access-control-allow-methods"] = "GET, POST, OPTIONS";
      if (req.headers["access-control-request-private-network"]) h["access-control-allow-private-network"] = "true";
    }
    res.writeHead(status, h);
    res.end(body === undefined ? "" : JSON.stringify(body));
  };
  // Only this machine's pages, and only to this machine's address.
  if (origin && !loopbackOrigin(origin)) return answer(403, { error: "a bridge answers pages on this machine only" });
  if (!/^127\.0\.0\.1:\d+$/.test(req.headers.host ?? "")) return answer(421, { error: "ask 127.0.0.1" });
  if (req.method === "OPTIONS") return answer(204);
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${bridgePort}`);

  if (url.pathname === "/pair" && req.method === "POST") {
    const now = Date.now();
    attempts = attempts.filter((t) => now - t < 60_000);
    if (attempts.length >= 5) return answer(429, { error: "too many wrong codes — wait a minute" });
    const body = await readBody(req);
    if (!code || code.expires < now) { mint(); return answer(403, { error: "that code has expired — the bridge has printed a new one" }); }
    if (!body || normal(body.code) !== normal(code.text)) {
      attempts.push(now);
      code.wrong++;
      if (code.wrong >= 5) { say("five wrong codes: that one is burned"); mint(); }
      return answer(403, { error: "that is not the code the bridge printed" });
    }
    const token = randomBytes(32).toString("base64url");
    tokens.set(token, { origin: origin ?? null, at: now });
    if (origin) framers.add(origin);
    say(`paired ${origin ?? "a client"}${framesPort ? "; its frames may load now" : ""}`, { paired: { origin: origin ?? null } });
    mint();
    return answer(200, { token, app: appInfo });
  }

  const auth = /^Bearer (\S+)$/.exec(req.headers.authorization ?? "")?.[1];
  if (!auth || !tokens.has(auth)) return answer(401, { error: "not paired with this bridge (a bridge that restarted forgets its pairings)" });

  if (url.pathname === "/hello" && req.method === "GET") {
    return answer(200, { app: appInfo, dir: app, frames: framesPort, loop: loopBase, tamber: !!tamberToken, design: { port: designPort, up: await designUp() }, drive: { hosts: driveHosts.filter((h) => h !== "ios" || sim) }, seq });
  }
  if (url.pathname === "/events" && req.method === "GET") {
    const after = Number(url.searchParams.get("after") ?? 0);
    const ready = () => queue.filter((e) => e.seq > after);
    if (ready().length === 0) {
      await new Promise((resolve) => {
        const done = () => { waiting.delete(done); clearTimeout(t); resolve(); };
        const t = setTimeout(done, 25_000);
        waiting.add(done);
        req.on("close", done);
      });
    }
    return answer(200, { events: ready(), next: seq });
  }
  if (url.pathname === "/inspect" && req.method === "POST") {
    const body = await readBody(req);
    const r = await tamber({ method: "inspect", client: CLIENT, on: body?.on === true });
    return answer(r.status, r.answer);
  }
  if (url.pathname === "/outline" && req.method === "POST") {
    const body = await readBody(req);
    const at = Array.isArray(body?.at) ? body.at.filter((a) => typeof a?.file === "string" && Number.isInteger(a.line) && Number.isInteger(a.col)).slice(0, 16) : [];
    const r = await tamber(at.length ? { method: "outline", client: CLIENT, at } : { method: "outline", client: CLIENT, at: [] });
    return answer(r.status, r.answer);
  }
  if (url.pathname === "/open" && req.method === "POST") {
    const body = await readBody(req);
    const abs = typeof body?.file === "string" ? path.resolve(app, body.file) : null;
    if (!abs || !abs.startsWith(app + path.sep) || !existsSync(abs)) return answer(400, { error: "a file of this app, by its path in it" });
    const line = Number.isInteger(body.line) ? body.line : 1;
    const col = Number.isInteger(body.col) ? body.col : 1;
    // A person's own editor, named by them: ISOCAN_EDITOR is a command that takes `<file>:<line>:<col>` (`code -g`,
    // `cursor -g`, `zed`). Without one, the browser follows a vscode:// link — the commonest editor's own door.
    const editor = process.env.ISOCAN_EDITOR?.trim();
    if (editor) {
      const [cmd, ...args] = editor.split(/\s+/);
      const child = spawn(cmd, [...args, `${abs}:${line}:${col}`], { detached: true, stdio: "ignore" });
      child.on("error", () => {});
      child.unref();
      return answer(200, { opened: `${body.file}:${line}:${col}`, with: cmd });
    }
    return answer(200, { url: `vscode://file${abs}:${line}:${col}` });
  }
  if (url.pathname === "/drive" && req.method === "POST") {
    const body = await readBody(req);
    const host = body?.host;
    if (!driveHosts.includes(host)) return answer(400, { error: `this bridge drives ${driveHosts.join(", ")} — \`isocan exact live --hosts …\` names the hosts` });
    if (host === "ios" && !sim) return answer(400, { error: "this bridge has no simulator of its own to drive iOS on: `isocan exact live --hosts …,ios --sim <udid>`" });
    const shots = driveShots(body.shots);
    if (!shots) return answer(400, { error: "a drive starts where the screen's exact.shots say: one at \"<path>\", then tap, type, clock, back, fail fetch, pass fetch or prefer" });
    const ops = Array.isArray(body.ops) ? body.ops : [];
    if (ops.length > 40 || ops.some((op) => typeof op !== "string" || !DRIVE_OP.test(op))) return answer(400, { error: "Drive mode sends tap <testId>, type <testId> \"<text>\" and back — nothing else, and at most 40" });
    const size = /^\d{2,4}x\d{2,4}$/.test(body.size ?? "") ? body.size : "390x844";
    const scheme = body.scheme === "dark" ? "dark" : "light";
    say(`drive on ${host}: ${ops.at(-1) ?? "the screen as captured"}`);
    const r = await drive({ host, size, scheme, shots: String(body.shots), ops });
    say(`drive on ${host}: ${r.ok ? `a fresh screenshot in ${r.ms} ms` : r.error}`);
    return answer(r.ok ? 200 : 422, r);
  }
  if (url.pathname === "/film" && req.method === "POST") {
    const body = await readBody(req);
    const host = body?.host;
    if (!driveHosts.includes(host)) return answer(400, { error: `this bridge films ${driveHosts.join(", ")} — \`isocan exact live --hosts …\` names the hosts` });
    if (host === "ios" && !sim) return answer(400, { error: "this bridge has no simulator of its own to film iOS on: `isocan exact live --hosts …,ios --sim <udid>`" });
    if (!driveShots(body.shots)) return answer(400, { error: "a film starts where the screen's exact.shots say: one at \"<path>\" first" });
    const ops = Array.isArray(body.ops) ? body.ops : [];
    if (ops.length > 40 || ops.some((op) => typeof op !== "string" || !DRIVE_OP.test(op))) return answer(400, { error: "a film's press is tap <testId>, type <testId> \"<text>\" or back — nothing else, and at most 40" });
    const size = /^\d{2,4}x\d{2,4}$/.test(body.size ?? "") ? body.size : "390x844";
    const scheme = body.scheme === "dark" ? "dark" : "light";
    const over = Number(body.over ?? 600), every = Number(body.every ?? 16);
    const watch = typeof body.watch === "string" && body.watch ? body.watch : null;
    say(`film on ${host}: ${ops.join(", ") || "the screen"}, ${over} ms every ${every}`);
    const r = await filmOnce({ host, size, scheme, shots: String(body.shots), ops, over, every, watch });
    say(`film on ${host}: ${r.ok ? `sha256 ${r.sha256}` : r.error}`);
    return answer(r.ok ? 200 : 422, r);
  }
  if (url.pathname === "/facts" && req.method === "POST") {
    const body = await readBody(req);
    const host = body?.host;
    if (!driveHosts.includes(host)) return answer(400, { error: `this bridge inspects ${driveHosts.join(", ")} — \`isocan exact live --hosts …\` names the hosts` });
    if (host === "ios" && !sim) return answer(400, { error: "this bridge has no simulator of its own to inspect iOS on: `isocan exact live --hosts …,ios --sim <udid>`" });
    if (!driveShots(body.shots)) return answer(400, { error: "an inspection starts where the screen's exact.shots say: one at \"<path>\", then tap, type, clock, back, fail fetch, pass fetch or prefer" });
    const size = /^\d{2,4}x\d{2,4}$/.test(body.size ?? "") ? body.size : "390x844";
    const scheme = body.scheme === "dark" ? "dark" : "light";
    say(`inspect on ${host}`);
    const r = await facts({ host, size, scheme, shots: String(body.shots) });
    say(`inspect on ${host}: ${r.ok ? `tree --ax, layout, perf and logs in ${r.ms} ms` : r.error}`);
    return answer(r.ok ? 200 : 422, r);
  }
  if (url.pathname === "/design" && req.method === "GET") {
    return answer(200, { link: designLink(url.searchParams.get("route") ?? ""), up: await designUp(), port: designPort });
  }
  return answer(404, { error: "no such door" });
});
bridgePort = await freePort(flag("--bridge-port") ? Number(flag("--bridge-port")) : undefined);
await new Promise((r) => api.listen(bridgePort, "127.0.0.1", r));

say(framesPort
  ? `live: ${appInfo.name}'s dev loop at ${loopBase}, framed through http://127.0.0.1:${framesPort}; the bridge is http://127.0.0.1:${bridgePort}`
  : `live, no frames: ${appInfo.name}'s dev loop at ${loopBase}; the bridge is http://127.0.0.1:${bridgePort} (pointing and the editor only)`,
  { live: { app: appInfo, loop: loopBase, frames: framesPort, bridge: bridgePort, tamber: !!tamberToken } });
say(`open in Exact Design: ${designLink("")}  (start it with \`bun run dev\` in its checkout)`, { design: { link: designLink(""), port: designPort } });
mint();
setInterval(() => { if (code && code.expires < Date.now()) mint(); }, 5_000).unref();

// ---------------------------------------------------------------- the capture loop

const childArgv = flag("--child") ? JSON.parse(flag("--child")) : null;
if (Array.isArray(childArgv) && childArgv.length > 1) {
  // The capture loop joins its native captures to this dev loop (`agent ios|macos --url`): each generation the loop
  // publishes is what they show (exact phase 3).
  const capture = spawn(childArgv[0], childArgv.slice(1), { stdio: ["ignore", "pipe", "pipe"], detached: true, env: { ...process.env, ISOCAN_EXACT_LOOP: loopBase } });
  children.push(capture);
  capture.stdout.on("data", (d) => process.stdout.write(d));
  capture.stderr.on("data", (d) => process.stdout.write(d));
  capture.on("exit", (exit) => {
    if (stopping) return;
    say(`the capture loop ended (exit ${exit}); the bridge stops with it`);
    stop(exit ?? 0);
  });
}
