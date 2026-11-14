#!/usr/bin/env node
import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);

// scripts/exact-bridge.mjs
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, accessSync, constants } from "node:fs";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
var [verb, ...argv] = process.argv.slice(2);
var flag = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : void 0;
};
var flags = (name) => argv.flatMap((a, i) => a === name && argv[i + 1] !== void 0 ? [argv[i + 1]] : []);
if (!["doctor", "read", "capture", "inputs", "diagnose", "check", "compare", "drive", "film", "facts"].includes(verb ?? "") || !flag("--app") || !flag("--report")) {
  console.error("usage: exact-bridge.mjs doctor|read|capture|inputs|diagnose|check --app <dir> --report <file.json> [--hosts web,ios] [--jobs <jobs.json>] [--dir <out> --size <w>x<h> --url <path>\u2026]");
  process.exit(2);
}
var app = path.resolve(flag("--app"));
var report = path.resolve(flag("--report"));
var launcher = path.join(app, "exact.mjs");
if (!existsSync(launcher)) fail(`${app} has no exact.mjs \u2014 is it an Exact app? (\`bun <exact>/scripts/exact.mjs new <dir>\` makes one)`);
function fail(message) {
  console.error(message);
  process.exit(1);
}
function exact(args, { allowFail = false, timeoutMs = 6e5, env = {} } = {}) {
  const started = Date.now();
  const done = spawnSync("/bin/sh", [launcher, ...args], { cwd: app, encoding: "utf8", maxBuffer: 64 << 20, timeout: timeoutMs, env: { ...process.env, ...env } });
  const ms = Date.now() - started;
  if (done.error) fail(`exact.mjs ${args[0]} could not start: ${done.error.message}`);
  if (done.status !== 0 && !allowFail) {
    const said = (done.stderr || done.stdout || "").trim().split("\n").slice(-6).join("\n");
    fail(`\`bun exact.mjs ${args.join(" ")}\` failed (exit ${done.status ?? done.signal}):
${said}`);
  }
  return { code: done.status, stdout: done.stdout ?? "", stderr: done.stderr ?? "", ms };
}
function checkout() {
  const text = readFileSync(launcher, "utf8");
  const literal = /process\.env\.EXACT2\s*\?\?\s*("(?:[^"\\]|\\.)*")/.exec(text)?.[1];
  const named = process.env.EXACT ?? process.env.EXACT2 ?? (literal ? JSON.parse(literal) : void 0);
  if (!named) fail(`${launcher} names no Exact checkout, and neither EXACT nor EXACT2 is set`);
  const dir = path.resolve(app, named);
  if (!existsSync(path.join(dir, "scripts/app-cli.mjs"))) fail(`no Exact checkout at ${dir} (no scripts/app-cli.mjs) \u2014 EXACT names the checkout`);
  const pin = /ensureBun\("([^"]+)"\)/.exec(text)?.[1] ?? null;
  return { dir, pin };
}
function git(dir, args) {
  const done = spawnSync("git", ["-C", dir, ...args], { encoding: "utf8" });
  return done.status === 0 ? done.stdout.trim() : null;
}
function bunOf(pin) {
  const pinned = pin ? path.join(os.homedir(), `.bun-${pin}`, "bin", "bun") : null;
  const executable = (p) => {
    try {
      accessSync(p, constants.X_OK);
      return true;
    } catch {
      return false;
    }
  };
  const bin = process.env.BUN || (pinned && executable(pinned) ? pinned : "bun");
  const v = spawnSync(bin, ["--version"], { encoding: "utf8" });
  return { bin, version: v.status === 0 ? v.stdout.trim() : null };
}
var sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
function freePort() {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}
async function withDesignServer(questions) {
  const design2 = existsSync(path.join(app, "app.tamber"));
  if (!design2) return { ok: false, note: "no app.tamber: the app has no design, so no Tamber wire is mounted" };
  const port = await freePort();
  const child = spawn("/bin/sh", [launcher, "tamber", "serve", ".", "--port", String(port)], { cwd: app, stdio: ["ignore", "pipe", "pipe"], detached: true });
  let said = "";
  child.stdout.on("data", (d) => {
    said += d;
  });
  child.stderr.on("data", (d) => {
    said += d;
  });
  const base = `http://127.0.0.1:${port}`;
  try {
    const deadline = Date.now() + 6e4;
    let token = null;
    while (Date.now() < deadline && !token) {
      try {
        const r = await fetch(`${base}/__tamber/token`, { redirect: "error" });
        if (r.ok) token = (await r.json()).token;
      } catch {
      }
      if (!token) await new Promise((r) => setTimeout(r, 250));
    }
    if (!token) return { ok: false, note: `the design server did not answer on ${base}: ${said.trim().split("\n").at(-1) ?? ""}` };
    const ask = async (body) => {
      const r = await fetch(`${base}/__tamber`, { method: "POST", headers: { "content-type": "application/json", "x-exact-tamber-token": token }, body: JSON.stringify(body) });
      const answer = await r.json().catch(() => null);
      return { status: r.status, answer };
    };
    return { ok: true, value: await questions(ask) };
  } finally {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
    }
  }
}
async function tamberHello() {
  const done = await withDesignServer(async (ask) => {
    const { status, answer } = await ask({ method: "hello" });
    if (!answer?.ok) return { protocol: null, note: `hello answered ${status}: ${answer?.error?.message ?? "nothing"}` };
    return { protocol: answer.ok.protocol ?? null, format: answer.ok.format ?? null, note: null };
  });
  return done.ok ? done.value : { protocol: null, note: done.note };
}
async function design() {
  if (!existsSync(path.join(app, "app.tamber"))) return null;
  const ir = JSON.parse(exact(["tamber", "ir", "."]).stdout);
  const done = await withDesignServer(async (ask) => {
    const uses = {};
    for (const t of ir.tokens ?? []) {
      const { status, answer } = await ask({ method: "uses", token: t.name });
      uses[t.name] = answer?.ok ? { sites: answer.ok.sites ?? [], aliases: answer.ok.aliases ?? [] } : { error: `uses answered ${status}: ${answer?.error?.message ?? "nothing"}` };
    }
    return uses;
  });
  if (!done.ok) fail(`could not ask the app's design server where its tokens are used: ${done.note}`);
  return { ir, uses: done.value };
}
function inputsDigest(exactDir) {
  const skip = /* @__PURE__ */ new Set(["target", ".exact", "node_modules", ".git", ".vscode"]);
  const files = [];
  const walk = (dir, rel, depth) => {
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (skip.has(e.name) || e.name.startsWith("dist") || e.name.endsWith(".d.ts") || e.name === ".DS_Store") continue;
      const p = path.join(dir, e.name);
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (depth < 4) walk(p, r, depth + 1);
      } else if (e.isFile()) files.push(`${r}\0${sha256(readFileSync(p))}`);
    }
  };
  walk(app, "", 0);
  const commit = git(exactDir, ["rev-parse", "HEAD"]) ?? "";
  const dirty = git(exactDir, ["diff", "HEAD", "--stat"]) ?? "";
  return sha256([`exact\0${commit}\0${sha256(dirty)}`, ...files].join("\n"));
}
function setupCheck(dir, bin, hosts) {
  const rows = [];
  for (const host of hosts) {
    const done = spawnSync(bin, [path.join(dir, "scripts/exact.mjs"), "setup", "--check", "--platform", host], { cwd: dir, encoding: "utf8", maxBuffer: 8 << 20 });
    const lines = `${done.stdout ?? ""}${done.stderr ?? ""}`.split("\n");
    for (const line of lines) {
      const m = /^(ok|MISSING|warn|WARN|differs|old)\s+([^:]+):\s*(.*)$/.exec(line);
      if (m) rows.push({ host, status: m[1].toLowerCase() === "ok" ? "ok" : m[1].toLowerCase(), what: m[2].trim(), detail: m[3].trim() });
    }
    rows.push({ host, status: done.status === 0 ? "ready" : "not ready", what: "setup --check", detail: `exit ${done.status}` });
  }
  return rows;
}
async function doctor() {
  const { dir, pin } = checkout();
  const bun = bunOf(pin);
  const hosts = (flag("--hosts") ?? "web").split(",").map((h) => h.trim()).filter(Boolean);
  const pkg = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8"));
  const tamber = await tamberHello();
  return {
    app: path.basename(app),
    checkout: dir,
    commit: git(dir, ["rev-parse", "HEAD"]),
    subject: git(dir, ["log", "-1", "--format=%s"]),
    dirty: (git(dir, ["status", "--porcelain", "--untracked-files=no"]) ?? "").split("\n").filter(Boolean).length,
    bun: { path: bun.bin, version: bun.version, pin, engines: pkg.engines?.bun ?? null, packageManager: pkg.packageManager ?? null },
    setup: setupCheck(dir, bun.bin, hosts),
    tamber
  };
}
async function read() {
  const { dir } = checkout();
  const inputs = inputsDigest(dir);
  const build = exact(["web-build"]);
  const dist = path.join(app, "target", "web-dist");
  const routesFile = path.join(dist, "routes.json");
  if (!existsSync(routesFile)) fail(`web-build wrote no ${routesFile} \u2014 Exact changed where its routes go`);
  const symbols = exact(["contract", "symbols", "app.contract"]);
  const parsed = JSON.parse(symbols.stdout);
  const sources = {};
  for (const file of new Set(parsed.definitions.map((d) => d.file))) {
    if (file.includes(":") || !file.endsWith(".contract")) continue;
    const at = path.resolve(app, file);
    if (!at.startsWith(app + path.sep)) continue;
    sources[file] = readFileSync(at, "utf8");
  }
  const tests = [];
  for (const name of readdirSync(app).filter((f) => f.endsWith(".test.contract")).sort()) {
    const run = exact(["contract", "test", name], { allowFail: true });
    try {
      tests.push({ file: name, tests: JSON.parse(run.stdout).tests ?? [] });
    } catch {
      tests.push({ file: name, tests: [], error: (run.stderr || run.stdout).trim().split("\n").slice(-3).join("\n") });
    }
  }
  const appTs = path.join(app, "app.ts");
  const grantsLine = existsSync(appTs) ? /export\s+const\s+grants\s*(?::[^=]+)?=\s*(['"`])((?:(?!\1)[^\\]|\\.)*)\1/.exec(readFileSync(appTs, "utf8")) : null;
  const manifest = JSON.parse(readFileSync(path.join(app, "app.json"), "utf8"));
  const planFile = path.join(dist, "app.plan");
  const started = Date.now();
  const designReading = argv.includes("--no-design") ? null : await design();
  return {
    app: { id: manifest.app?.id ?? manifest.id ?? path.basename(app), name: manifest.app?.name ?? manifest.name ?? path.basename(app) },
    exact: { commit: git(dir, ["rev-parse", "HEAD"]), protocol: null },
    plan: existsSync(planFile) ? sha256(readFileSync(planFile)) : null,
    routesJson: JSON.parse(readFileSync(routesFile, "utf8")),
    symbols: parsed,
    sources,
    tests,
    grants: grantsLine ? grantsLine[2] : null,
    design: designReading,
    inputs,
    ms: { build: build.ms, symbols: symbols.ms, design: Date.now() - started }
  };
}
var SHOT_OP = /^(tap|type|clock|back|fail fetch|pass fetch|prefer)\b/;
var HOSTS = ["web", "ios", "macos"];
function checkJob(job) {
  if (!HOSTS.includes(job.host ?? "web")) fail(`a capture job's host is one of ${HOSTS.join(", ")}, not ${JSON.stringify(job.host)}`);
  if (typeof job.url !== "string" || !job.url.startsWith("/") || job.url.startsWith("//") || job.url.includes("..")) fail(`a capture job's url must be one of the app's own paths, not ${JSON.stringify(job.url)}`);
  for (const op of job.ops ?? []) {
    if (typeof op !== "string" || !SHOT_OP.test(op) || /[\n\r\0]/.test(op) || /\bcolor-scheme\b/.test(op)) fail(`a capture job carries an operation this bridge does not run: ${JSON.stringify(op)}`);
  }
  for (const shot of job.shots ?? []) {
    if (!/^\d+x\d+$/.test(shot.size ?? "") || !["light", "dark"].includes(shot.scheme)) fail(`a capture is <w>x<h> in light or dark, not ${JSON.stringify(shot)}`);
  }
}
function captureJobs(out, jobs) {
  const shots = [];
  const sim = simulator(jobs);
  for (const [j, job] of jobs.entries()) {
    checkJob(job);
    const host = job.host ?? "web";
    const ops = [];
    const files = [];
    for (const [i, shot] of job.shots.entries()) {
      const file = path.join(out, `job-${j}-${i}.png`);
      files.push(file);
      ops.push(...host === "ios" ? [] : [`resize ${shot.size}`], `prefer color-scheme ${shot.scheme}`, "clock settle", `screenshot ${file}`, "tree", "layout", ...host === "web" ? [] : ["tree --ax"]);
    }
    const run = drive(host, job.url, job.ops ?? [], ops, { size: job.shots[0].size, sim });
    const replies = jsonReplies(run.stdout);
    const trees = replies.filter((r) => Array.isArray(r.nodes) && !r.env);
    const layouts = replies.filter((r) => Array.isArray(r.nodes) && r.env);
    const axes = replies.filter((r) => r.ax);
    for (const [i, file] of files.entries()) {
      if (!existsSync(file)) fail(`agent ${host} wrote no screenshot for ${job.url} at ${job.shots[i].size} ${job.shots[i].scheme}:
${(run.stderr + run.stdout).trim().split("\n").slice(-6).join("\n")}`);
      const bytes = readFileSync(file);
      const png = pngSize(bytes);
      const points = pointsOf(trees[i], layouts[i], axes[i]);
      if (points && host !== "web" && png) points.size = png;
      shots.push({ job: j, index: i, host, url: job.url, size: job.shots[i].size, scheme: job.shots[i].scheme, file, sha256: sha256(bytes), png, ms: Math.round(run.ms / files.length), points });
    }
  }
  return { shots };
}
var jsonReplies = (stdout) => stdout.split("\n").flatMap((line) => {
  if (!line.startsWith("{")) return [];
  try {
    return [JSON.parse(line)];
  } catch {
    return [];
  }
});
function pngSize(bytes) {
  return bytes.length > 24 && bytes.toString("latin1", 12, 16) === "IHDR" ? { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) } : null;
}
function simulator(jobs) {
  if (!jobs.some((j) => j.host === "ios")) return null;
  const sim = flag("--sim");
  if (!sim || !/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i.test(sim)) fail('an iOS capture needs a simulator of its own, by UDID: `xcrun simctl create "isocan-exact" com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro <runtime>`, then --sim <udid>. A booted simulator may be somebody\'s own, so none is guessed.');
  spawnSync("xcrun", ["simctl", "status_bar", sim, "override", "--time", "9:41", "--batteryLevel", "100", "--batteryState", "charged"], { encoding: "utf8" });
  return sim;
}
function compare(out, jobs) {
  const compares = [];
  for (const [j, job] of jobs.entries()) {
    checkJob({ ...job, host: "web", shots: [] });
    if (typeof job.reference !== "string" || !job.reference.startsWith(out + path.sep) || !existsSync(job.reference)) fail(`a compare job's reference is one of this run's captures, not ${JSON.stringify(job.reference)}`);
    if (!/^\d+x\d+$/.test(job.size ?? "")) fail(`a compare job's size is <w>x<h>, not ${JSON.stringify(job.size)}`);
    const file = path.join(out, `compare-${j}.png`);
    const run = drive("web", job.url, job.ops ?? [], ["clock settle", `screenshot ${file} compare ${job.reference}`, "tree", "layout"], { size: job.size, sim: null });
    const replies = jsonReplies(run.stdout);
    const said = replies.find((r) => r.compare);
    const tree = replies.find((r) => Array.isArray(r.nodes) && !r.env);
    const layout = replies.find((r) => Array.isArray(r.nodes) && r.env);
    compares.push({
      route: job.route,
      host: job.host,
      size: job.size,
      compare: said ? { match: said.compare.match, regions: said.compare.regions ?? [], more: said.compare.more ?? 0 } : null,
      text: said?.text ?? "",
      web: pointsOf(tree, layout),
      ...said ? {} : { error: (run.stderr || run.stdout).trim().split("\n").slice(-3).join("\n") }
    });
  }
  return { compares };
}
var rootTestId;
function rootOf() {
  if (rootTestId !== void 0) return rootTestId;
  const text = existsSync(path.join(app, "app.contract")) ? readFileSync(path.join(app, "app.contract"), "utf8") : "";
  const lines = text.split("\n");
  const at = lines.findIndex((l) => /\bnavigate=/.test(l));
  const near = at >= 0 ? lines.slice(at, at + 3).join(" ") : "";
  rootTestId = /\btestId="([A-Za-z0-9_-]+)"/.exec(near)?.[1] ?? null;
  return rootTestId;
}
function drive(host, url, before, after, { size, sim, allowFail = false }) {
  const args = driveArgs(host, url, before, after, size);
  const env = host === "ios" ? { EXACT_SIM: sim, EXACT_SHOW_SIMULATOR: "0" } : {};
  return exact(args, { env, allowFail, timeoutMs: host === "web" ? 6e5 : 18e5 });
}
function driveArgs(host, url, before, after, size) {
  const fixed = ["--json", "--seed", "1", "--locale", "en-US", "--time-zone", "UTC", "--epoch", "2026-01-01"];
  let args;
  if (host === "web") args = ["agent", "web", ...fixed, "--size", size, "--url", url, "clock data", ...before, ...after];
  else {
    const root = rootOf();
    if (url !== "/" && !root) fail(`a native drive opens ${url} by typing it into the node that carries navigate=, and app.contract names none with a testId`);
    const dev = flag("--dev-url");
    const joined = dev && /^http:\/\/127\.0\.0\.1:\d+\/?$/.test(dev) ? ["--url", dev] : [];
    args = ["agent", host, ...fixed, ...joined, ...host === "macos" ? ["--size", size] : [], "clock data", ...url !== "/" ? [`type ${root} ${url}`, "clock settle"] : [], ...before, ...after];
  }
  return args;
}
var DRIVE_OP = /^(?:tap [A-Za-z0-9_.:-]{1,80}|type [A-Za-z0-9_.:-]{1,80} "(?:[^"\\\n\r]|\\.){0,400}"|back)$/;
function driveJob(out, job) {
  const host = job.host ?? "web";
  if (!HOSTS.includes(host)) fail(`a drive runs on ${HOSTS.join(", ")}, not ${JSON.stringify(host)}`);
  let url = null;
  const shots = [];
  for (const raw of String(job.shots ?? "").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("//")) continue;
    const at = /^at\s+"([^"]*)"$/.exec(line);
    if (at && url === null) {
      url = at[1];
      continue;
    }
    shots.push(line);
  }
  if (!url) fail(`a drive starts where the screen's shots say: one at "<path>" first`);
  checkJob({ host, url, ops: shots, shots: [] });
  const ops = Array.isArray(job.ops) ? job.ops : [];
  if (ops.length > 40 || ops.some((op) => typeof op !== "string" || !DRIVE_OP.test(op))) fail('Drive mode sends tap <testId>, type <testId> "<text>" and back \u2014 nothing else, and at most 40');
  const size = /^\d{2,4}x\d{2,4}$/.test(job.size ?? "") ? job.size : "390x844";
  const scheme = job.scheme === "dark" ? "dark" : "light";
  const sim = host === "ios" ? simulator([{ host }]) : null;
  const file = path.join(out, "drive.png");
  const tail = [`prefer color-scheme ${scheme}`, ...ops.flatMap((op) => [op, "clock settle"]), "clock settle", `screenshot ${file}`, "tree", "layout", ...host === "web" ? [] : ["tree --ax"]];
  const started = Date.now();
  const run = drive(host, url, shots, tail, { size, sim, allowFail: true });
  const replies = jsonReplies(run.stdout);
  const before = 1 + (host !== "web" && url !== "/" ? 2 : 0) + shots.length + 1;
  const tree = replies.find((r) => Array.isArray(r.nodes) && !r.env);
  const layout = replies.find((r) => Array.isArray(r.nodes) && r.env);
  const ax = replies.find((r) => r.ax) ?? null;
  const bytes = existsSync(file) ? readFileSync(file) : null;
  const png = bytes ? pngSize(bytes) : null;
  const points = bytes ? pointsOf(tree, layout, ax) : null;
  if (points && png) points.size = png;
  const said = (run.stderr || run.stdout).trim().split("\n").filter((l) => !l.startsWith("{")).slice(-4).join("\n");
  return {
    ok: run.code === 0 && !!bytes,
    code: run.code,
    file: bytes ? file : null,
    png,
    points,
    results: ops.map((op, i) => ({ op, reply: replies[before + i * 2] ?? null })),
    ms: Date.now() - started,
    ...run.code === 0 && bytes ? {} : { error: said || `agent ${host} exited ${run.code}` }
  };
}
function startOf(job) {
  const host = job.host ?? "web";
  if (!HOSTS.includes(host)) fail(`this runs on ${HOSTS.join(", ")}, not ${JSON.stringify(host)}`);
  let url = null;
  const shots = [];
  for (const raw of String(job.shots ?? "").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("//")) continue;
    const at = /^at\s+"([^"]*)"$/.exec(line);
    if (at && url === null) {
      url = at[1];
      continue;
    }
    shots.push(line);
  }
  if (!url) fail(`it starts where the screen's shots say: one at "<path>" first`);
  checkJob({ host, url, ops: shots, shots: [] });
  const size = /^\d{2,4}x\d{2,4}$/.test(job.size ?? "") ? job.size : "390x844";
  const scheme = job.scheme === "dark" ? "dark" : "light";
  const sim = host === "ios" ? simulator([{ host }]) : null;
  if (host === "web") exact(["web-build"]);
  return { host, url, shots, size, scheme, sim };
}
function filmJob(out, job) {
  const { host, url, shots, size, scheme, sim } = startOf(job);
  const ops = Array.isArray(job.ops) ? job.ops : [];
  if (ops.length > 40 || ops.some((op) => typeof op !== "string" || !DRIVE_OP.test(op))) fail(`a film's interaction is tap <testId>, type <testId> "<text>" and back \u2014 nothing else, and at most 40`);
  const over = Number(job.over), every = Number(job.every);
  if (!(Number.isInteger(over) && over >= 0 && over <= 1e4 && Number.isInteger(every) && every >= 1 && every <= 1e3)) fail("a film is over 0\u201310000 ms, every 1\u20131000 ms, whole milliseconds");
  const steps = Math.floor(over / every) + 1;
  if (steps > 240) fail(`over ${over} every ${every} is ${steps} frames; Exact films at most 240`);
  const watch = job.watch === void 0 || job.watch === null ? null : String(job.watch);
  if (watch !== null && !/^[A-Za-z0-9_.:-]{1,80}$/.test(watch)) fail(`--watch names a node by its testId, not ${JSON.stringify(watch)}`);
  const file = path.join(out, "film.apng");
  const interaction = ops.flatMap((op, i) => i < ops.length - 1 ? [op, "clock settle"] : [op]);
  const lead = [`prefer color-scheme ${scheme}`, "clock settle", ...interaction];
  const started = Date.now();
  const filmed = drive(host, url, shots, [...lead, `screenshot ${file} over ${over} every ${every}`], { size, sim, allowFail: true });
  const filmMs = Date.now() - started;
  const replies = jsonReplies(filmed.stdout);
  const told = replies.find((r) => r.form === "animated" || r.frames !== void 0 && r.screenshot === file) ?? null;
  const bytes = existsSync(file) ? readFileSync(file) : null;
  const said = (run) => (run.stderr || run.stdout).trim().split("\n").filter((l) => !l.startsWith("{")).slice(-4).join("\n");
  if (!bytes || filmed.code !== 0) return { ok: false, error: said(filmed) || `agent ${host} exited ${filmed.code}`, ms: filmMs };
  const reads = [];
  for (let i = 0; i < steps; i++) {
    if (i) reads.push(`clock +${every}`);
    reads.push("state");
    if (watch) reads.push(`layout ${watch}`);
  }
  const stateStarted = Date.now();
  const stated = drive(host, url, shots, [...lead, ...reads], { size, sim, allowFail: true });
  const stateReplies = jsonReplies(stated.stdout);
  const states = stateReplies.filter((r) => r.slots && typeof r.slots === "object");
  const layouts = stateReplies.filter((r) => r.node && r.viewport);
  const clocks = stateReplies.filter((r) => Object.keys(r).length <= 3 && Number.isFinite(r.clock));
  const frames = [];
  for (let i = 0; i < steps; i++) {
    const st = states[i];
    const node = layouts[i]?.node ?? null;
    frames.push({
      at: told?.at?.[i] ?? null,
      slots: st?.slots ?? null,
      derives: st?.derives ?? null,
      ...watch ? { watch: node ? watchedOf(node) : null } : {}
    });
  }
  return {
    ok: true,
    file,
    sha256: sha256(bytes),
    bytes: bytes.length,
    png: pngSize(bytes),
    host,
    url,
    size,
    scheme,
    ops,
    over,
    every,
    steps,
    frames: told?.frames ?? null,
    at: told?.at ?? null,
    form: told?.form ?? null,
    clock: clocks.length ? clocks.at(-1).clock : null,
    states: frames,
    ...states.length === steps ? {} : { stateError: `state answered ${states.length} of ${steps} frames: ${said(stated)}` },
    ms: { film: filmMs, state: Date.now() - stateStarted }
  };
}
function watchedOf(node) {
  const style = {};
  for (const key of ["translate", "scale", "rotate", "opacity"]) {
    const v = node.style?.[key]?.computed;
    if (v !== void 0) style[key] = v;
  }
  const box = node.space?.viewport ?? null;
  return { testId: node.testId ?? node.props?.testId ?? null, box: box ? { x: box.x, y: box.y, w: box.w, h: box.h } : null, style, visible: node.visible ? { inViewport: node.visible.inViewport, clipped: node.visible.clipped, hidden: node.visible.hidden } : null };
}
function factsJob(job) {
  const { host, url, shots, size, scheme, sim } = startOf(job);
  const started = Date.now();
  const run = drive(host, url, shots, [`prefer color-scheme ${scheme}`, "clock settle", "tree --ax", "layout", "perf", "logs"], { size, sim, allowFail: true });
  const replies = jsonReplies(run.stdout);
  const ax = replies.find((r) => r.ax) ?? null;
  const layout = replies.find((r) => Array.isArray(r.nodes) && r.env) ?? null;
  const perf = replies.find((r) => Array.isArray(r.sites)) ?? null;
  const logs = replies.find((r) => Array.isArray(r.lines)) ?? null;
  const ok = run.code === 0 && !!ax;
  return {
    ok,
    host,
    url,
    size,
    scheme,
    shots,
    // The command an agent runs to print the same tree: the proof compares the two.
    command: driveArgs(host, url, shots, [`prefer color-scheme ${scheme}`, "clock settle", "tree --ax"], size),
    ax,
    layout,
    perf,
    logs,
    ms: Date.now() - started,
    ...ok ? {} : { error: (run.stderr || run.stdout).trim().split("\n").filter((l) => !l.startsWith("{")).slice(-4).join("\n") || `agent ${host} exited ${run.code}` }
  };
}
var fileText = /* @__PURE__ */ new Map();
function pointsOf(tree, layout, ax = null) {
  if (!tree || !layout) return null;
  const hidden = new Set(tree.nodes.filter((n) => n.hidden || n.inactive).map((n) => n.id));
  const rel = (file) => typeof file === "string" && file.startsWith(app + path.sep) ? path.relative(app, file) : null;
  const files = {};
  const nodes = [];
  for (const n of layout.nodes) {
    const m = n.sourceMap;
    const file = rel(m?.file);
    if (hidden.has(n.id) || !file || !(n.w > 0 && n.h > 0) || m.status !== "compatible") continue;
    if (!fileText.has(file)) fileText.set(file, readFileSync(path.join(app, file), "utf8"));
    files[file] ??= sha256(fileText.get(file));
    const lineText = fileText.get(file).split("\n")[m.line - 1] ?? "";
    const cls = /\bclass=\(([^)]*)\)/.exec(lineText)?.[1]?.match(/\b[A-Z][A-Za-z0-9_]*\b/g) ?? (/\bclass=([A-Za-z_][A-Za-z0-9_]*)/.exec(lineText) ? [/\bclass=([A-Za-z_][A-Za-z0-9_]*)/.exec(lineText)[1]] : []);
    nodes.push({
      x: Math.round(n.x),
      y: Math.round(n.y),
      w: Math.round(n.w),
      h: Math.round(n.h),
      type: n.type,
      ...n.testId ? { testId: n.testId } : {},
      file,
      line: m.line,
      col: m.col,
      component: m.component ?? null,
      chain: (m.chain ?? []).map((c) => ({ file: rel(c.file) ?? c.file, line: c.line, col: c.col, component: c.component ?? null })),
      ...cls.length ? { classes: cls } : {}
    });
  }
  nodes.push(...platformControls(tree, layout, ax, (_n, l) => {
    const file = rel(l?.sourceMap?.file);
    if (!file || l.sourceMap.status !== "compatible") return null;
    if (!fileText.has(file)) fileText.set(file, readFileSync(path.join(app, file), "utf8"));
    files[file] ??= sha256(fileText.get(file));
    return { file, line: l.sourceMap.line, col: l.sourceMap.col, component: l.sourceMap.component ?? null, chain: [] };
  }));
  return { files, nodes };
}
function platformControls(tree, layout, ax, nodeOf) {
  if (!tree || !layout || !Array.isArray(ax?.ax?.elements)) return [];
  const shown = tree.nodes.filter((n) => !n.hidden && !n.inactive && n.props?.testId && typeof n.props.accessibilityLabel === "string");
  const out = [];
  for (const e of ax.ax.elements) {
    const cls = e.native?.class ?? "";
    if (e.role !== "button" || !e.name || !(e.frame?.w > 0 && e.frame?.h > 0) || !/^_?(UI|NS)/.test(cls)) continue;
    const named = shown.filter((n) => n.props.accessibilityLabel === e.name);
    if (named.length !== 1) continue;
    const node = nodeOf(named[0], layout.nodes.find((l) => l.id === named[0].id));
    if (node) out.push({ ...node, x: Math.round(e.frame.x), y: Math.round(e.frame.y), w: Math.round(e.frame.w), h: Math.round(e.frame.h), type: "button", testId: named[0].props.testId });
  }
  return out;
}
function capture() {
  const out = path.resolve(flag("--dir") ?? fail("capture needs --dir"));
  mkdirSync(out, { recursive: true });
  if (flag("--jobs")) return captureJobs(out, JSON.parse(readFileSync(path.resolve(flag("--jobs")), "utf8")));
  const size = flag("--size") ?? "390x844";
  if (!/^\d+x\d+$/.test(size)) fail(`--size is <w>x<h>, not ${size}`);
  mkdirSync(out, { recursive: true });
  const shots = [];
  for (const [i, url] of flags("--url").entries()) {
    const file = path.join(out, `screen-${i}.png`);
    const run = exact([
      "agent",
      "web",
      "--size",
      size,
      "--seed",
      "1",
      "--locale",
      "en-US",
      "--time-zone",
      "UTC",
      "--epoch",
      "2026-01-01",
      "--url",
      url,
      "clock data",
      "clock settle",
      `screenshot ${file}`
    ]);
    if (!existsSync(file)) fail(`agent web wrote no screenshot for ${url}:
${run.stdout.trim().split("\n").slice(-4).join("\n")}`);
    shots.push({ url, file, sha256: sha256(readFileSync(file)), ms: run.ms });
  }
  return { size, shots };
}
function diagnose() {
  const build = exact(["contract", "build", "app.contract", "--json"], { allowFail: true });
  let diagnostics;
  try {
    diagnostics = JSON.parse(build.stdout.trim().split("\n").filter((l) => l.startsWith("[")).at(-1) ?? "null");
  } catch {
    diagnostics = null;
  }
  if (!Array.isArray(diagnostics)) fail(`\`contract build --json\` printed no diagnostics list (exit ${build.code}):
${(build.stderr || build.stdout).trim().split("\n").slice(-4).join("\n")}`);
  const sym = exact(["contract", "symbols", "app.contract"], { allowFail: true });
  let symbols = null;
  try {
    symbols = JSON.parse(sym.stdout);
  } catch {
  }
  const sources = {};
  const digests = {};
  const files = /* @__PURE__ */ new Set(["app.contract", ...diagnostics.map((d) => d.file), ...(symbols?.definitions ?? []).map((d) => d.file)]);
  for (const file of files) {
    if (typeof file !== "string" || file.includes(":")) continue;
    const at = path.resolve(app, file);
    if (!at.startsWith(app + path.sep) || !existsSync(at)) continue;
    const bytes = readFileSync(at);
    digests[file] = sha256(bytes);
    if (file.endsWith(".contract")) sources[file] = bytes.toString("utf8");
  }
  return { diagnostics, symbols, sources, digests, ms: build.ms + sym.ms };
}
function check() {
  const out = [];
  for (const url of flags("--url")) {
    checkJob({ url, ops: [], shots: [] });
    const run = exact(["agent", "web", "--json", "--size", "390x844", "--seed", "1", "--locale", "en-US", "--time-zone", "UTC", "--epoch", "2026-01-01", "--url", url, "clock data", "clock settle", "check both"], { allowFail: true });
    let found = null;
    for (const line of run.stdout.split("\n")) {
      if (!line.startsWith("{")) continue;
      try {
        const v = JSON.parse(line);
        if (Array.isArray(v.check)) found = v.check;
      } catch {
      }
    }
    if (!found) fail(`agent check on ${url} answered nothing (exit ${run.code}):
${(run.stderr || run.stdout).trim().split("\n").slice(-4).join("\n")}`);
    out.push({ url, check: found, ms: run.ms });
  }
  return { checks: out };
}
var result = verb === "film" ? filmJob(path.resolve(flag("--dir") ?? fail("film needs --dir")), JSON.parse(readFileSync(path.resolve(flag("--job") ?? fail("film needs --job")), "utf8"))) : verb === "facts" ? factsJob(JSON.parse(readFileSync(path.resolve(flag("--job") ?? fail("facts needs --job")), "utf8"))) : verb === "drive" ? driveJob(path.resolve(flag("--dir") ?? fail("drive needs --dir")), JSON.parse(readFileSync(path.resolve(flag("--job") ?? fail("drive needs --job")), "utf8"))) : verb === "compare" ? compare(path.resolve(flag("--dir") ?? fail("compare needs --dir")), JSON.parse(readFileSync(path.resolve(flag("--jobs") ?? fail("compare needs --jobs")), "utf8"))) : verb === "diagnose" ? diagnose() : verb === "check" ? check() : verb === "doctor" ? await doctor() : verb === "read" ? await read() : verb === "inputs" ? { inputs: inputsDigest(checkout().dir) } : capture();
writeFileSync(report, JSON.stringify(result, null, 2));
