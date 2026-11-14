#!/usr/bin/env node
import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);

// scripts/exact-live.mjs
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
var argv = process.argv.slice(2);
var flag = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : void 0;
};
var json = argv.includes("--json");
var app = flag("--app") ? path.resolve(flag("--app")) : null;
if (!app) {
  console.error("usage: exact-live.mjs --app <dir> [--child '<argv json>'] [--bridge-port <n>] [--frames-port <n>] [--loop-port <n>] [--design-port <n>] [--json]");
  process.exit(2);
}
var launcher = path.join(app, "exact.mjs");
if (!existsSync(launcher)) {
  console.error(`${app} has no exact.mjs \u2014 is it an Exact app?`);
  process.exit(1);
}
var manifest = JSON.parse(readFileSync(path.join(app, "app.json"), "utf8"));
var appInfo = { id: manifest.app?.id ?? manifest.id ?? path.basename(app), name: manifest.app?.name ?? manifest.name ?? path.basename(app) };
var designPort = Number(flag("--design-port") ?? 5173);
var driveHosts = (flag("--hosts") ?? "web").split(",").map((h) => h.trim()).filter((h) => ["web", "ios", "macos"].includes(h));
var sim = flag("--sim") && /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i.test(flag("--sim")) ? flag("--sim") : null;
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
var say = (text, data) => {
  if (json) process.stdout.write(`${JSON.stringify({ bridge: data ?? { text } })}
`);
  else process.stdout.write(`${(/* @__PURE__ */ new Date()).toISOString().slice(11, 19)}  ${text}
`);
};
function freePort(asked) {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.once("error", reject);
    s.listen(asked ?? 0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}
function loopbackOrigin(origin) {
  try {
    const u = new URL(origin);
    return (u.protocol === "http:" || u.protocol === "https:") && ["127.0.0.1", "localhost", "[::1]"].includes(u.hostname);
  } catch {
    return false;
  }
}
var children = [];
var stopping = false;
function stop(code2 = 0) {
  if (stopping) return;
  stopping = true;
  for (const c of children) {
    try {
      process.kill(-c.pid, "SIGTERM");
    } catch {
      try {
        c.kill("SIGTERM");
      } catch {
      }
    }
  }
  setTimeout(() => process.exit(code2), 300);
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
var loopPort = await freePort(flag("--loop-port") ? Number(flag("--loop-port")) : void 0);
var loopBase = `http://127.0.0.1:${loopPort}`;
var loop = spawn("/bin/sh", [launcher, "web", "--port", String(loopPort)], {
  cwd: app,
  detached: true,
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, EXACT_TOOL_PORT: String(designPort) }
});
children.push(loop);
var loopSaid = "";
var keep = (d) => {
  loopSaid = (loopSaid + d).slice(-8e3);
};
loop.stdout.on("data", keep);
loop.stderr.on("data", keep);
loop.on("exit", (code2) => {
  if (stopping) return;
  say(`the dev loop stopped (exit ${code2}): ${loopSaid.trim().split("\n").slice(-3).join(" | ")}`);
  stop(1);
});
say(`starting ${appInfo.name}'s dev loop with its own Exact, on this machine\u2026`);
for (let i = 0; ; i++) {
  try {
    if ((await fetch(loopBase, { redirect: "manual" })).status < 500) break;
  } catch {
  }
  if (i > 2400) {
    say(`the dev loop did not answer on ${loopBase} in ten minutes`);
    stop(1);
  }
  await sleep(250);
}
var tamberToken = null;
try {
  const r = await fetch(`${loopBase}/__tamber/token`, { redirect: "error" });
  if (r.ok) tamberToken = (await r.json()).token;
} catch {
}
var CLIENT = "isocan";
async function tamber(body) {
  if (!tamberToken) return { status: 503, answer: { error: { message: "this app has no app.tamber, so its dev loop mounts no Tamber wire: inspect and outline need one" } } };
  const r = await fetch(`${loopBase}/__tamber`, { method: "POST", headers: { "content-type": "application/json", "x-exact-tamber-token": tamberToken }, body: JSON.stringify(body) });
  return { status: r.status, answer: await r.json().catch(() => null) };
}
var queue = [];
var seq = 0;
var waiting = /* @__PURE__ */ new Set();
function publish(event) {
  queue.push({ seq: ++seq, ...event });
  while (queue.length > 200) queue.shift();
  for (const w of waiting) w();
}
var sha256File = (rel) => {
  const abs = path.resolve(app, rel);
  if (!abs.startsWith(app + path.sep) || !existsSync(abs)) return null;
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
};
async function follow() {
  let cursor = null;
  while (!stopping && tamberToken) {
    try {
      const r = cursor ? await fetch(`${loopBase}/__tamber/events?after=${encodeURIComponent(cursor)}&client=${CLIENT}`, { headers: { "x-exact-tamber-token": tamberToken } }) : await fetch(`${loopBase}/__tamber/events`, { method: "POST", headers: { "content-type": "application/json", "x-exact-tamber-token": tamberToken }, body: JSON.stringify({ client: CLIENT }) });
      if (r.status === 204) continue;
      const answer = await r.json().catch(() => null);
      if (!answer) {
        await sleep(500);
        continue;
      }
      if (answer.cursor) cursor = answer.cursor;
      for (const e of answer.events ?? []) {
        if (e.event === "selection" && e.source) {
          publish({ type: "selection", build: e.build, source: { ...e.source, sha256: sha256File(e.source.file) }, rows: (e.rows ?? []).map((row) => ({ name: row.name, value: row.value, origin: row.origin ?? null, source: row.source ?? null })), readOnly: e.readOnly ?? false });
        } else if (e.event === "inspect") {
          publish({ type: "inspect", on: e.on, builds: e.builds ?? [] });
        }
      }
    } catch {
      await sleep(1e3);
    }
  }
}
void follow();
var CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
var tokens = /* @__PURE__ */ new Map();
var framers = /* @__PURE__ */ new Set();
var code = null;
var attempts = [];
var bridgePort = 0;
function mint() {
  const bytes = randomBytes(10);
  let text = "";
  for (let i = 0; i < 10; i++) text += CROCKFORD[bytes[i] % 32];
  code = { text: `${text.slice(0, 5)}-${text.slice(5)}`, expires: Date.now() + 12e4, wrong: 0 };
  say(`pair a browser: on an Exact screen press Live and enter  ${bridgePort}-${code.text}  (one use, two minutes)`, { pair: { code: `${bridgePort}-${code.text}`, expires: code.expires } });
}
var normal = (c) => String(c ?? "").toUpperCase().replace(/[IL]/g, "1").replace(/O/g, "0").replace(/[^0-9A-Z]/g, "");
var framesOff = argv.includes("--no-frames");
var framesPort = null;
if (!framesOff) {
  const proxy = http.createServer((req, res) => {
    const headers = { ...req.headers, host: `127.0.0.1:${loopPort}` };
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
    up.on("error", () => {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
    req.pipe(up);
  });
  framesPort = await freePort(flag("--frames-port") ? Number(flag("--frames-port")) : void 0);
  await new Promise((r) => proxy.listen(framesPort, "127.0.0.1", r));
}
var DRIVE_OP = /^(?:tap [A-Za-z0-9_.:-]{1,80}|type [A-Za-z0-9_.:-]{1,80} "(?:[^"\\\n\r]|\\.){0,400}"|back)$/;
var SHOT_LINE = /^(tap|type|clock|back|fail fetch|pass fetch|prefer)\b/;
function driveShots(text) {
  let url = null;
  const ops = [];
  for (const raw of String(text ?? "").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("//")) continue;
    const at = /^at\s+"([^"]*)"$/.exec(line);
    if (at && url === null && at[1].startsWith("/") && !at[1].startsWith("//") && !at[1].includes("..") && !/[\s\\]/.test(at[1])) {
      url = at[1];
      continue;
    }
    if (!SHOT_LINE.test(line) || /\bcolor-scheme\b/.test(line)) return null;
    ops.push(line);
  }
  return url ? { url, ops } : null;
}
var driving = Promise.resolve();
function drive(body) {
  const run = driving.then(() => driveOnce(body));
  driving = run.catch(() => {
  });
  return run;
}
function driveOnce(job) {
  return new Promise((resolve) => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "isocan-exact-drive-"));
    const done = (answer) => {
      rmSync(dir, { recursive: true, force: true });
      resolve(answer);
    };
    try {
      writeFileSync(path.join(dir, "job.json"), JSON.stringify(job));
      const bridgeScript = path.join(path.dirname(fileURLToPath(import.meta.url)), "exact-bridge.mjs");
      const child = spawn(process.execPath, [bridgeScript, "drive", "--app", app, "--report", path.join(dir, "report.json"), "--dir", dir, "--job", path.join(dir, "job.json"), ...sim ? ["--sim", sim] : []], { stdio: ["ignore", "ignore", "pipe"] });
      let err = "";
      child.stderr.on("data", (d) => {
        err = (err + d).slice(-4e3);
      });
      child.on("close", () => {
        let r;
        try {
          r = JSON.parse(readFileSync(path.join(dir, "report.json"), "utf8"));
        } catch {
          return done({ ok: false, png: null, points: null, results: [], ms: 0, error: err.trim().split("\n").slice(-3).join("\n") || "the drive did not answer" });
        }
        const png = r.file ? readFileSync(r.file).toString("base64") : null;
        done({ ok: r.ok, code: r.code, png, points: r.points, results: r.results, ms: r.ms, ...r.error ? { error: r.error } : {} });
      });
    } catch (e) {
      done({ ok: false, png: null, points: null, results: [], ms: 0, error: e.message });
    }
  });
}
function facts(job) {
  const run = driving.then(() => new Promise((resolve) => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "isocan-exact-facts-"));
    const done = (answer) => {
      rmSync(dir, { recursive: true, force: true });
      resolve(answer);
    };
    try {
      writeFileSync(path.join(dir, "job.json"), JSON.stringify(job));
      const bridgeScript = path.join(path.dirname(fileURLToPath(import.meta.url)), "exact-bridge.mjs");
      const child = spawn(process.execPath, [bridgeScript, "facts", "--app", app, "--report", path.join(dir, "report.json"), "--job", path.join(dir, "job.json"), ...sim ? ["--sim", sim] : []], { stdio: ["ignore", "ignore", "pipe"] });
      let err = "";
      child.stderr.on("data", (d) => {
        err = (err + d).slice(-4e3);
      });
      child.on("close", () => {
        try {
          done(JSON.parse(readFileSync(path.join(dir, "report.json"), "utf8")));
        } catch {
          done({ ok: false, ms: 0, error: err.trim().split("\n").slice(-3).join("\n") || "the inspection did not answer" });
        }
      });
    } catch (e) {
      done({ ok: false, ms: 0, error: e.message });
    }
  }));
  driving = run.catch(() => {
  });
  return run;
}
function filmOnce(job) {
  const run = driving.then(() => new Promise((resolve) => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "isocan-exact-film-"));
    const done = (answer) => {
      rmSync(dir, { recursive: true, force: true });
      resolve(answer);
    };
    try {
      writeFileSync(path.join(dir, "job.json"), JSON.stringify(job));
      const bridgeScript = path.join(path.dirname(fileURLToPath(import.meta.url)), "exact-bridge.mjs");
      const child = spawn(process.execPath, [bridgeScript, "film", "--app", app, "--report", path.join(dir, "report.json"), "--dir", dir, "--job", path.join(dir, "job.json"), ...sim ? ["--sim", sim] : []], { stdio: ["ignore", "ignore", "pipe"] });
      let err = "";
      child.stderr.on("data", (d) => {
        err = (err + d).slice(-4e3);
      });
      child.on("close", () => {
        let r;
        try {
          r = JSON.parse(readFileSync(path.join(dir, "report.json"), "utf8"));
        } catch {
          return done({ ok: false, error: err.trim().split("\n").slice(-3).join("\n") || "the film did not answer" });
        }
        const apng = r.ok && r.file ? readFileSync(r.file).toString("base64") : null;
        const { file: _file, ...rest } = r;
        done({ ...rest, apng });
      });
    } catch (e) {
      done({ ok: false, error: e.message });
    }
  }));
  driving = run.catch(() => {
  });
  return run;
}
function runOnce(job) {
  const run = driving.then(() => new Promise((resolve) => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "isocan-exact-run-"));
    const done = (answer) => {
      rmSync(dir, { recursive: true, force: true });
      resolve(answer);
    };
    try {
      writeFileSync(path.join(dir, "job.json"), JSON.stringify(job));
      const bridgeScript = path.join(path.dirname(fileURLToPath(import.meta.url)), "exact-bridge.mjs");
      const child = spawn(process.execPath, [bridgeScript, "run", "--app", app, "--report", path.join(dir, "report.json"), "--dir", dir, "--job", path.join(dir, "job.json"), ...sim ? ["--sim", sim] : []], { stdio: ["ignore", "ignore", "pipe"] });
      let err = "";
      child.stderr.on("data", (d) => {
        err = (err + d).slice(-4e3);
      });
      child.on("close", () => {
        let r;
        try {
          r = JSON.parse(readFileSync(path.join(dir, "report.json"), "utf8"));
        } catch {
          return done({ ok: false, verdict: "error", error: err.trim().split("\n").slice(-3).join("\n") || "the run did not answer" });
        }
        const inline = (f) => f?.file && existsSync(f.file) ? { sha256: f.sha256, png: readFileSync(f.file).toString("base64") } : f ? { sha256: f.sha256 } : null;
        done({ ...r, steps: r.steps.map((s) => ({ ...s, frame: inline(s.frame) })), failed: r.failed ? { ...r.failed, frame: inline(r.failed.frame) } : null, end: inline(r.end) });
      });
    } catch (e) {
      done({ ok: false, verdict: "error", error: e.message });
    }
  }));
  driving = run.catch(() => {
  });
  return run;
}
var scrubbing = null;
async function scrubTo(ops) {
  if (!tamberToken) return { status: 503, answer: { error: "this app's dev loop mounts no Tamber wire (no app.tamber)" } };
  if (!scrubbing) {
    const h = await tamber({ method: "hello" });
    if (!h.answer?.ok) return h;
    scrubbing = { id: null, files: h.answer.ok.files, ops };
  }
  scrubbing.ops = ops;
  const r = await tamber({ method: "scrub", client: CLIENT, ops, files: scrubbing.files, ...scrubbing.id ? { scrub: scrubbing.id } : {} });
  if (r.answer?.ok?.scrub) scrubbing.id = r.answer.ok.scrub;
  else if (!r.answer?.ok?.superseded) scrubbing = null;
  if (scrubbing) say(`scrub: ${ops.map((o) => `${o.name}=${o.value}`).join(", ")} on every build of the loop`);
  return { status: r.status, answer: { ...r.answer ?? {}, builds: await buildCount() } };
}
async function scrubEnd() {
  if (!scrubbing?.id) {
    scrubbing = null;
    return { status: 200, answer: { ok: { cancelled: null } } };
  }
  const r = await tamber({ method: "scrub-cancel", client: CLIENT, scrub: scrubbing.id });
  say("scrub let go: every build back on the committed design, nothing written");
  scrubbing = null;
  return r;
}
async function buildCount() {
  const h = await tamber({ method: "hello" });
  return (h.answer?.ok?.builds ?? []).map((b) => ({ id: b.id, host: b.host ?? b.target ?? null }));
}
var native = null;
function nativeFrame(shots, scheme) {
  const key = JSON.stringify([shots.url, shots.ops, scheme]);
  if (native && native.key === key && !native.ended) return { state: native.ready ? "ready" : "starting" };
  nativeStop();
  const dir = mkdtempSync(path.join(os.tmpdir(), "isocan-exact-native-"));
  const root = (() => {
    const text = existsSync(path.join(app, "app.contract")) ? readFileSync(path.join(app, "app.contract"), "utf8") : "";
    const lines = text.split("\n");
    const at = lines.findIndex((l) => /\bnavigate=/.test(l));
    return /\btestId="([A-Za-z0-9_-]+)"/.exec(at >= 0 ? lines.slice(at, at + 3).join(" ") : "")?.[1] ?? null;
  })();
  const fixed = ["--json", "--seed", "1", "--locale", "en-US", "--time-zone", "UTC", "--epoch", "2026-01-01"];
  const ops = ["clock data", ...shots.url !== "/" && root ? [`type ${root} ${shots.url}`, "clock settle"] : [], ...shots.ops, `prefer color-scheme ${scheme}`, "clock settle", `clock +1800000 real until ${path.join(dir, "stop")}`];
  const child = spawn("/bin/sh", [launcher, "agent", "ios", ...fixed, "--url", loopBase, ...ops], { cwd: app, detached: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, EXACT_SIM: sim, EXACT_SHOW_SIMULATOR: "0" } });
  const state = { key, child, dir, said: "", replies: 0, ready: false, ended: false };
  const need = ops.length - 1;
  child.stdout.on("data", (d) => {
    state.said = (state.said + d).slice(-4e3);
    state.replies += String(d).split("\n").filter((l) => l.startsWith("{")).length;
    if (!state.ready && state.replies >= need) {
      state.ready = true;
      say(`native frame: iOS at ${shots.url} (${scheme}), joined to the loop`);
    }
  });
  child.stderr.on("data", (d) => {
    state.said = (state.said + d).slice(-4e3);
  });
  child.on("exit", () => {
    state.ended = true;
  });
  children.push(child);
  native = state;
  return { state: "starting" };
}
function nativeStop() {
  if (!native) return;
  try {
    writeFileSync(path.join(native.dir, "stop"), "");
  } catch {
  }
  const old = native;
  setTimeout(() => {
    try {
      process.kill(-old.child.pid, "SIGTERM");
    } catch {
    }
    rmSync(old.dir, { recursive: true, force: true });
  }, 3e3);
  native = null;
}
function nativeShot() {
  if (!native) return Promise.resolve({ ok: false, error: "no native frame is running \u2014 ask for one first" });
  if (native.ended) return Promise.resolve({ ok: false, error: `the native frame ended: ${native.said.trim().split("\n").filter((l) => !l.startsWith("{")).slice(-2).join(" | ")}` });
  if (!native.ready) return Promise.resolve({ ok: false, starting: true, error: "the app is starting on the simulator" });
  return new Promise((resolve) => {
    const file = path.join(native.dir, `shot-${Date.now()}.png`);
    const c = spawn("xcrun", ["simctl", "io", sim, "screenshot", "--type=png", file], { stdio: "ignore" });
    c.on("close", () => {
      try {
        const png = readFileSync(file).toString("base64");
        rmSync(file, { force: true });
        resolve({ ok: true, png, at: Date.now() });
      } catch {
        resolve({ ok: false, error: "the simulator gave no picture" });
      }
    });
  });
}
function designLink(route) {
  const q = new URLSearchParams({ connect: loopBase, name: appInfo.name, viewports: "Core" });
  if (route) q.set("show", route);
  return `http://127.0.0.1:${designPort}/?${q}`;
}
async function designUp() {
  try {
    return (await fetch(`http://127.0.0.1:${designPort}/`, { signal: AbortSignal.timeout(800) })).status < 500;
  } catch {
    return false;
  }
}
var readBody = (req) => new Promise((resolve) => {
  let text = "";
  req.on("data", (d) => {
    text += d;
    if (text.length > 65536) req.destroy();
  });
  req.on("end", () => {
    try {
      resolve(text ? JSON.parse(text) : {});
    } catch {
      resolve(null);
    }
  });
});
var api = http.createServer(async (req, res) => {
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
    res.end(body === void 0 ? "" : JSON.stringify(body));
  };
  if (origin && !loopbackOrigin(origin)) return answer(403, { error: "a bridge answers pages on this machine only" });
  if (!/^127\.0\.0\.1:\d+$/.test(req.headers.host ?? "")) return answer(421, { error: "ask 127.0.0.1" });
  if (req.method === "OPTIONS") return answer(204);
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${bridgePort}`);
  if (url.pathname === "/pair" && req.method === "POST") {
    const now = Date.now();
    attempts = attempts.filter((t) => now - t < 6e4);
    if (attempts.length >= 5) return answer(429, { error: "too many wrong codes \u2014 wait a minute" });
    const body = await readBody(req);
    if (!code || code.expires < now) {
      mint();
      return answer(403, { error: "that code has expired \u2014 the bridge has printed a new one" });
    }
    if (!body || normal(body.code) !== normal(code.text)) {
      attempts.push(now);
      code.wrong++;
      if (code.wrong >= 5) {
        say("five wrong codes: that one is burned");
        mint();
      }
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
    return answer(200, { app: appInfo, dir: app, frames: framesPort, loop: loopBase, tamber: !!tamberToken, design: { port: designPort, up: await designUp() }, drive: { hosts: driveHosts.filter((h) => h !== "ios" || sim) }, scrub: !!tamberToken, native: driveHosts.includes("ios") && sim ? ["ios"] : [], seq });
  }
  if (url.pathname === "/scrub" && req.method === "POST") {
    const body = await readBody(req);
    const ops = Array.isArray(body?.ops) ? body.ops : [];
    if (ops.length === 0 || ops.length > 8 || ops.some((o) => o?.op !== "set-token" || typeof o.name !== "string" || !/^[A-Za-z_][A-Za-z0-9_.-]{0,80}$/.test(o.name) || typeof o.value !== "string" || !/^[^\n\r\0]{1,120}$/.test(o.value))) return answer(400, { error: "a scrub is one to eight set-token operations" });
    const r = await scrubTo(ops);
    return answer(r.status, r.answer);
  }
  if (url.pathname === "/scrub-cancel" && req.method === "POST") {
    const r = await scrubEnd();
    return answer(r.status, r.answer);
  }
  if (url.pathname === "/native" && req.method === "POST") {
    const body = await readBody(req);
    if (body?.host !== "ios" || !sim || !driveHosts.includes("ios")) return answer(400, { error: "this bridge keeps a native frame on iOS only, on its own simulator: `isocan exact live --hosts \u2026,ios --sim <udid>`" });
    const shots = driveShots(body.shots);
    if (!shots) return answer(400, { error: `a native frame starts where the screen's exact.shots say: one at "<path>" first` });
    const scheme = body.scheme === "dark" ? "dark" : "light";
    return answer(200, nativeFrame(shots, scheme));
  }
  if (url.pathname === "/native/shot" && req.method === "GET") {
    const r = await nativeShot();
    return answer(r.ok ? 200 : 409, r);
  }
  if (url.pathname === "/native/stop" && req.method === "POST") {
    nativeStop();
    return answer(200, { stopped: true });
  }
  if (url.pathname === "/events" && req.method === "GET") {
    const after = Number(url.searchParams.get("after") ?? 0);
    const ready = () => queue.filter((e) => e.seq > after);
    if (ready().length === 0) {
      await new Promise((resolve) => {
        const done = () => {
          waiting.delete(done);
          clearTimeout(t);
          resolve();
        };
        const t = setTimeout(done, 25e3);
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
    const editor = process.env.ISOCAN_EDITOR?.trim();
    if (editor) {
      const [cmd, ...args] = editor.split(/\s+/);
      const child = spawn(cmd, [...args, `${abs}:${line}:${col}`], { detached: true, stdio: "ignore" });
      child.on("error", () => {
      });
      child.unref();
      return answer(200, { opened: `${body.file}:${line}:${col}`, with: cmd });
    }
    return answer(200, { url: `vscode://file${abs}:${line}:${col}` });
  }
  if (url.pathname === "/drive" && req.method === "POST") {
    const body = await readBody(req);
    const host = body?.host;
    if (!driveHosts.includes(host)) return answer(400, { error: `this bridge drives ${driveHosts.join(", ")} \u2014 \`isocan exact live --hosts \u2026\` names the hosts` });
    if (host === "ios" && !sim) return answer(400, { error: "this bridge has no simulator of its own to drive iOS on: `isocan exact live --hosts \u2026,ios --sim <udid>`" });
    const shots = driveShots(body.shots);
    if (!shots) return answer(400, { error: `a drive starts where the screen's exact.shots say: one at "<path>", then tap, type, clock, back, fail fetch, pass fetch or prefer` });
    const ops = Array.isArray(body.ops) ? body.ops : [];
    if (ops.length > 40 || ops.some((op) => typeof op !== "string" || !DRIVE_OP.test(op))) return answer(400, { error: 'Drive mode sends tap <testId>, type <testId> "<text>" and back \u2014 nothing else, and at most 40' });
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
    if (!driveHosts.includes(host)) return answer(400, { error: `this bridge films ${driveHosts.join(", ")} \u2014 \`isocan exact live --hosts \u2026\` names the hosts` });
    if (host === "ios" && !sim) return answer(400, { error: "this bridge has no simulator of its own to film iOS on: `isocan exact live --hosts \u2026,ios --sim <udid>`" });
    if (!driveShots(body.shots)) return answer(400, { error: `a film starts where the screen's exact.shots say: one at "<path>" first` });
    const ops = Array.isArray(body.ops) ? body.ops : [];
    if (ops.length > 40 || ops.some((op) => typeof op !== "string" || !DRIVE_OP.test(op))) return answer(400, { error: `a film's press is tap <testId>, type <testId> "<text>" or back \u2014 nothing else, and at most 40` });
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
    if (!driveHosts.includes(host)) return answer(400, { error: `this bridge inspects ${driveHosts.join(", ")} \u2014 \`isocan exact live --hosts \u2026\` names the hosts` });
    if (host === "ios" && !sim) return answer(400, { error: "this bridge has no simulator of its own to inspect iOS on: `isocan exact live --hosts \u2026,ios --sim <udid>`" });
    if (!driveShots(body.shots)) return answer(400, { error: `an inspection starts where the screen's exact.shots say: one at "<path>", then tap, type, clock, back, fail fetch, pass fetch or prefer` });
    const size = /^\d{2,4}x\d{2,4}$/.test(body.size ?? "") ? body.size : "390x844";
    const scheme = body.scheme === "dark" ? "dark" : "light";
    say(`inspect on ${host}`);
    const r = await facts({ host, size, scheme, shots: String(body.shots) });
    say(`inspect on ${host}: ${r.ok ? `tree --ax, layout, perf and logs in ${r.ms} ms` : r.error}`);
    return answer(r.ok ? 200 : 422, r);
  }
  if (url.pathname === "/run" && req.method === "POST") {
    const body = await readBody(req);
    const host = body?.host;
    if (!driveHosts.includes(host)) return answer(400, { error: `this bridge runs on ${driveHosts.join(", ")} \u2014 \`isocan exact live --hosts \u2026\` names the hosts` });
    if (host === "ios" && !sim) return answer(400, { error: "this bridge has no simulator of its own to run iOS on: `isocan exact live --hosts \u2026,ios --sim <udid>`" });
    if (typeof body.file !== "string" || !/^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,80}\.test\.contract$/.test(body.file)) return answer(400, { error: "a run names one of the app's *.test.contract files" });
    if (typeof body.test !== "string" || !body.test || body.test.length > 200) return answer(400, { error: "a run names its test" });
    say(`run on ${host}: test "${body.test}" in ${body.file}`);
    const r = await runOnce({ host, file: body.file, test: body.test });
    say(`run on ${host}: ${r.verdict === "ok" ? "ok" : r.verdict === "fail" ? `FAIL at ${body.file}:${r.failed?.line ?? "?"}` : r.error ?? r.verdict}`);
    return answer(r.ok ? 200 : 422, r);
  }
  if (url.pathname === "/design" && req.method === "GET") {
    return answer(200, { link: designLink(url.searchParams.get("route") ?? ""), up: await designUp(), port: designPort });
  }
  return answer(404, { error: "no such door" });
});
bridgePort = await freePort(flag("--bridge-port") ? Number(flag("--bridge-port")) : void 0);
await new Promise((r) => api.listen(bridgePort, "127.0.0.1", r));
say(
  framesPort ? `live: ${appInfo.name}'s dev loop at ${loopBase}, framed through http://127.0.0.1:${framesPort}; the bridge is http://127.0.0.1:${bridgePort}` : `live, no frames: ${appInfo.name}'s dev loop at ${loopBase}; the bridge is http://127.0.0.1:${bridgePort} (pointing and the editor only)`,
  { live: { app: appInfo, loop: loopBase, frames: framesPort, bridge: bridgePort, tamber: !!tamberToken } }
);
say(`open in Exact Design: ${designLink("")}  (start it with \`bun run dev\` in its checkout)`, { design: { link: designLink(""), port: designPort } });
mint();
setInterval(() => {
  if (code && code.expires < Date.now()) mint();
}, 5e3).unref();
var childArgv = flag("--child") ? JSON.parse(flag("--child")) : null;
if (Array.isArray(childArgv) && childArgv.length > 1) {
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
