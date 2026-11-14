#!/usr/bin/env node
import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);

// scripts/exact-bridge.mjs
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, accessSync, constants } from "node:fs";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
var [verb, ...argv] = process.argv.slice(2);
var flag = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : void 0;
};
var flags = (name) => argv.flatMap((a, i) => a === name && argv[i + 1] !== void 0 ? [argv[i + 1]] : []);
if (!["doctor", "read", "capture", "inputs", "diagnose", "check", "compare", "drive", "film", "facts", "run", "record", "verify", "propose", "accept", "drop", "stage-branch"].includes(verb ?? "") || !flag("--app") || !flag("--report")) {
  console.error("usage: exact-bridge.mjs doctor|read|capture|inputs|diagnose|check --app <dir> --report <file.json> [--hosts web,ios] [--jobs <jobs.json>] [--dir <out> --size <w>x<h> --url <path>\u2026]");
  process.exit(2);
}
var app = path.resolve(flag("--app"));
var report = path.resolve(flag("--report"));
if (!process.env.EXACT_WEB_DIST) process.env.EXACT_WEB_DIST = path.join(os.tmpdir(), "isocan-exact-web", createHash("sha256").update(app).digest("hex").slice(0, 12));
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
  const dist = process.env.EXACT_WEB_DIST;
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
  const testSources = {};
  for (const name of readdirSync(app).filter((f) => f.endsWith(".test.contract")).sort()) {
    testSources[name] = readFileSync(path.join(app, name), "utf8");
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
    testSources,
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
var TEST_FILE = /^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,80}\.test\.contract$/;
var LAUNCH_STEPS = /* @__PURE__ */ new Set(["at", "size", "seed", "locale", "time-zone", "epoch", "format-locale", "before-data", "fresh", "prefer", "fail-fetch"]);
function runJob(out, job) {
  const host = job.host ?? "web";
  if (!HOSTS.includes(host)) fail(`a test runs on ${HOSTS.join(", ")}, not ${JSON.stringify(host)}`);
  if (typeof job.file !== "string" || !TEST_FILE.test(job.file) || !existsSync(path.join(app, job.file))) fail(`a storyboard runs one of the app's own *.test.contract files, not ${JSON.stringify(job.file)}`);
  if (typeof job.test !== "string" || !job.test) fail("a run names its test");
  const sim = host === "ios" ? simulator([{ host }]) : null;
  const started = Date.now();
  const text = readFileSync(path.join(app, job.file), "utf8");
  const lines = text.split("\n");
  const compiled = exact(["contract", "test", job.file], { allowFail: true });
  let tests;
  try {
    tests = JSON.parse(compiled.stdout).tests;
  } catch {
    fail(`\`contract test ${job.file}\` did not compile:
${(compiled.stderr || compiled.stdout).trim().split("\n").slice(-4).join("\n")}`);
  }
  const t = tests.find((x) => x.name === job.test);
  if (!t) fail(`${job.file} has no test named ${JSON.stringify(job.test)}`);
  const seen = /* @__PURE__ */ new Set();
  for (const st of t.steps) {
    if (seen.has(st.line)) fail(`line ${st.line} of ${job.file} holds more than one step; a storyboard draws a test one line a step`);
    seen.add(st.line);
  }
  let lead = 0;
  while (lead < t.steps.length && LAUNCH_STEPS.has(t.steps[lead].op)) lead++;
  const shot = (i) => path.join(out, `f-${i}.png`);
  const copy = [`test ${JSON.stringify(t.name)}`];
  const lineOf = /* @__PURE__ */ new Map();
  for (let k = 0; k < lead; k++) {
    copy.push(`  ${(lines[t.steps[k].line - 1] ?? "").trim()}`);
    lineOf.set(copy.length, k);
  }
  copy.push(`  screenshot ${JSON.stringify(shot(0))}`);
  for (let k = lead; k < t.steps.length; k++) {
    copy.push(`  ${(lines[t.steps[k].line - 1] ?? "").trim()}`);
    lineOf.set(copy.length, k);
    copy.push(`  screenshot ${JSON.stringify(shot(k - lead + 1))}`);
  }
  const file = path.join(out, "storyboard.test.contract");
  writeFileSync(file, `${copy.join("\n")}
`);
  const env = host === "ios" ? { EXACT_SIM: sim, EXACT_SHOW_SIMULATOR: "0" } : {};
  const ran = exact(["test", host, ...sim ? ["--sim", sim] : [], file], { allowFail: true, env, timeoutMs: host === "web" ? 6e5 : 18e5 });
  const all = `${ran.stdout}
${ran.stderr}`.split("\n");
  const head = all.find((l) => l.startsWith(`test ${JSON.stringify(t.name)}:`) || l.startsWith(`test "${t.name}":`)) ?? null;
  const verdict = !head ? "error" : / ok$/.test(head) ? "ok" : /: FAIL$/.test(head) ? "fail" : /skipped/.test(head) ? "skipped" : "error";
  const prefix = `  ${t.name}: `;
  const failures = all.filter((l) => l.startsWith(prefix)).map((l) => l.slice(prefix.length));
  const fileLine = (n) => {
    const k = lineOf.get(n);
    return k === void 0 ? null : t.steps[k].line;
  };
  const said = [head, ...all.filter((l) => l.startsWith(prefix) || l.startsWith("  note: "))].filter(Boolean).map((l) => l.trim().replace(/: line (\d+): /, (m, n) => fileLine(Number(n)) ? `: ${job.file}:${fileLine(Number(n))}: ` : m));
  const frameOf = (i) => {
    const f = shot(i);
    if (!existsSync(f)) return null;
    return { sha256: sha256(readFileSync(f)), file: f };
  };
  const failing = /* @__PURE__ */ new Map();
  let first = null;
  for (const msg of failures) {
    const m = /^line (\d+): ([\s\S]*)$/.exec(msg);
    const k = m ? lineOf.get(Number(m[1])) : void 0;
    if (k === void 0) {
      first ??= { k: null, reason: msg };
      continue;
    }
    if (!failing.has(k)) failing.set(k, m[2]);
    first ??= { k, reason: m[2] };
  }
  const steps = t.steps.map((st, k) => {
    const frame = k < lead ? null : frameOf(k - lead);
    const after = k < lead ? verdict === "ok" || existsSync(shot(0)) : existsSync(shot(k - lead + 1));
    return { line: st.line, state: failing.has(k) ? "fail" : verdict === "ok" || after ? "ok" : "unreached", frame };
  });
  let failed = null;
  if (verdict !== "ok" && verdict !== "skipped") {
    const k = first?.k ?? null;
    const replay = k === null ? null : treeAt(host, t.steps, lead, k, frameOf(0), sim);
    failed = {
      line: k === null ? null : t.steps[k].line,
      reason: first?.reason ?? (verdict === "error" ? (ran.stderr || ran.stdout).trim().split("\n").filter((l) => !l.startsWith("{")).slice(-3).join("\n") || `exact.mjs test exited ${ran.code}` : "the test failed"),
      frame: k === null ? null : k < lead ? null : frameOf(k - lead),
      tree: replay?.tree ?? null,
      reply: replay?.reply ?? (replay?.note ? { note: replay.note } : null)
    };
  }
  return {
    ok: verdict !== "error",
    host,
    file: job.file,
    test: t.name,
    verdict,
    said,
    steps,
    failed,
    end: verdict === "ok" ? frameOf(t.steps.length - lead) : null,
    ms: Date.now() - started,
    ...verdict === "error" ? { error: failed?.reason ?? "the test did not run" } : {}
  };
}
function stepOp(st) {
  const q = (v) => /^[A-Za-z0-9_.:-]+$/.test(String(v)) ? String(v) : JSON.stringify(String(v));
  if (st.op === "tap" && (st.form ?? "press") === "press" && st.target) return `tap ${q(st.target)}`;
  if (st.op === "type" && st.target && typeof st.text === "string" && !st.append) return `type ${q(st.target)} ${JSON.stringify(st.text)}`;
  if (st.op === "clock" && typeof st.arg === "string") return `clock ${st.arg}`;
  if (st.op === "back") return "back";
  if (st.op.startsWith("expect-")) return null;
  return void 0;
}
function treeAt(host, steps, lead, k, frame0, sim) {
  const at = steps.slice(0, lead).find((s) => s.op === "at");
  const url = typeof at?.value === "string" ? at.value : "/";
  if (steps.slice(0, lead).some((s) => s.op !== "at")) return { note: "the tree is read by a replay, which takes a test whose only launch line is at" };
  const ops = [];
  for (const st of steps.slice(lead, k)) {
    const op = stepOp(st);
    if (op === void 0) return { note: `the tree is read by a replay of tap, type, clock and back; line ${st.line} is ${st.op}` };
    if (op) ops.push(op);
  }
  const failing = k >= lead ? stepOp(steps[k]) : null;
  const size = (() => {
    if (!frame0?.file) return "390x844";
    const p = pngSize(readFileSync(frame0.file));
    return p ? `${p.width}x${p.height}` : "390x844";
  })();
  const tail = ["tree", ...failing ? [failing] : []];
  let args;
  if (host === "web") args = ["agent", "web", "--json", "--size", size, ...url !== "/" ? ["--url", url] : [], "clock data", ...ops, ...tail];
  else {
    const root = rootOf();
    if (url !== "/" && !root) return { note: `a native replay opens ${url} by typing it into the node that carries navigate=, and app.contract names none` };
    args = ["agent", host, "--json", "clock data", ...url !== "/" ? [`type ${root} ${url}`, "clock settle"] : [], ...ops, ...tail];
  }
  const run = exact(args, { allowFail: true, env: host === "ios" ? { EXACT_SIM: sim, EXACT_SHOW_SIMULATOR: "0" } : {}, timeoutMs: host === "web" ? 6e5 : 18e5 });
  const replies = jsonReplies(run.stdout);
  const tree = replies.find((r) => Array.isArray(r.nodes) && !r.env) ?? null;
  const last = replies.at(-1) ?? null;
  const stopped = (run.stderr || "").trim().split("\n").filter((l) => l && !l.startsWith("{")).slice(-2).join(" ");
  const reply = !failing ? null : last && last !== tree ? last : { error: stopped || `agent ${host} exited ${run.code}` };
  const shown = tree ? tree.nodes.filter((n) => !n.hidden && !n.inactive) : [];
  const rows = tree ? (shown.length ? shown : tree.nodes).slice(0, 240).map((n) => ({
    depth: n.depth ?? 0,
    type: n.type,
    ...n.props?.testId ? { testId: n.props.testId } : {},
    ...typeof n.props?.text === "string" ? { text: n.props.text.slice(0, 80) } : {},
    ...typeof n.props?.accessibilityLabel === "string" ? { label: n.props.accessibilityLabel.slice(0, 80) } : typeof n.props?.["aria-label"] === "string" ? { label: n.props["aria-label"].slice(0, 80) } : {},
    ...n.hidden ? { hidden: true } : {},
    ...n.inactive ? { inactive: true } : {}
  })) : null;
  return { tree: rows, reply, ...rows ? {} : { note: (run.stderr || run.stdout).trim().split("\n").filter((l) => !l.startsWith("{")).slice(-2).join(" ") || "the replay printed no tree" } };
}
function recordJob(job) {
  const { host, url, shots, size, scheme, sim } = startOf(job);
  const ok = (list) => Array.isArray(list) && list.length <= 40 && list.every((op) => typeof op === "string" && DRIVE_OP.test(op));
  if (!ok(job.before ?? []) || !ok(job.ops) || job.ops.length === 0) fail('a recording is tap <testId>, type <testId> "<text>" and back \u2014 nothing else, at most 40, and at least one');
  const press = (list) => list.flatMap((op) => [op, "clock settle"]);
  const started = Date.now();
  const run = drive(host, url, shots, [`prefer color-scheme ${scheme}`, "clock settle", ...press(job.before ?? []), "state", ...press(job.ops), "clock settle", "state"], { size, sim, allowFail: true });
  const states = jsonReplies(run.stdout).filter((r) => r.slots && typeof r.slots === "object");
  if (run.code !== 0 || states.length < 2) return { ok: false, ms: Date.now() - started, error: (run.stderr || run.stdout).trim().split("\n").filter((l) => !l.startsWith("{")).slice(-4).join("\n") || `agent ${host} exited ${run.code}` };
  const pick = (s) => ({ slots: s.slots ?? null, derives: s.derives ?? null });
  return { ok: true, host, url, before: pick(states[0]), after: pick(states.at(-1)), ms: Date.now() - started };
}
function verifyJob() {
  const host = flag("--host") ?? "web";
  if (!["web", "ios"].includes(host)) fail(`verify has legs for the web and iOS on this machine, not ${JSON.stringify(host)} (Exact: macOS "verify has no leg for it")`);
  const sim = host === "ios" ? simulator([{ host }]) : null;
  const started = Date.now();
  const run = exact(["verify", host, "--json", ...sim ? ["--sim", sim] : []], { allowFail: true, env: sim ? { EXACT_SIM: sim, EXACT_SHOW_SIMULATOR: "0" } : {}, timeoutMs: 18e5 });
  let report2 = null;
  try {
    report2 = JSON.parse(run.stdout.trim().split("\n").filter((l) => l.startsWith("{")).at(-1) ?? "null");
  } catch {
  }
  if (!report2) return { ok: false, host, exit: run.code, ms: Date.now() - started, error: (run.stderr || run.stdout).trim().split("\n").slice(-4).join("\n") || `verify exited ${run.code}` };
  const shots = [];
  for (const c of report2.checks ?? []) {
    if (typeof c.shot !== "string" || !existsSync(c.shot) || shots.some((s) => s.file === c.shot)) continue;
    const bytes = readFileSync(c.shot);
    shots.push({ file: c.shot, sha256: sha256(bytes), screen: c.screen, size: c.size, scheme: c.scheme, png: pngSize(bytes) });
  }
  return {
    ok: true,
    host,
    exit: run.code,
    problems: report2.problems ?? null,
    tests: report2.tests ? { passed: report2.tests.passed ?? 0, failed: report2.tests.failed ?? 0, failing: (report2.tests.results ?? []).filter((t) => t.failures?.length).map((t) => ({ name: t.name, file: t.file, failures: t.failures })) } : null,
    shots,
    ms: Date.now() - started
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
var PROPOSAL_OPS = /* @__PURE__ */ new Set(["set-token", "set-row", "set-state"]);
function checkProposalOps(ops) {
  if (!Array.isArray(ops) || ops.length === 0 || ops.length > 32) fail("a proposal carries one to 32 operations");
  for (const op of ops) {
    if (!op || typeof op !== "object" || !PROPOSAL_OPS.has(op.op)) fail(`a proposal's operation is one of ${[...PROPOSAL_OPS].join(", ")}, not ${JSON.stringify(op?.op)}`);
    for (const [k, v] of Object.entries(op)) {
      if (!["op", "name", "value", "when", "style", "row", "state", "file", "at", "sha256", "comment"].includes(k)) fail(`a proposal's ${op.op} carries no field ${JSON.stringify(k)}`);
      if (typeof v === "string" && (v.length > 400 || /[\n\r\0]/.test(v))) fail(`a proposal's ${op.op}.${k} is one short line`);
    }
    if (op.file !== void 0 && (typeof op.file !== "string" || op.file.startsWith("/") || op.file.includes(".."))) fail(`a proposal names a file of the app, not ${JSON.stringify(op.file)}`);
  }
}
async function wireOf() {
  const dev = flag("--dev-url");
  if (!dev || !/^http:\/\/127\.0\.0\.1:\d+\/?$/.test(dev)) fail("a proposal is held by the dev loop's Tamber wire, and this `isocan exact live` runs no dev loop \u2014 start it without --no-frames");
  const base = dev.replace(/\/$/, "");
  let token = null;
  try {
    const r = await fetch(`${base}/__tamber/token`, { redirect: "error" });
    if (r.ok) token = (await r.json()).token;
  } catch {
  }
  if (!token) fail(`the dev loop at ${base} mounts no Tamber wire (an app with no app.tamber has none)`);
  const ask = async (body, tok = token) => {
    const r = await fetch(`${base}/__tamber`, { method: "POST", headers: { "content-type": "application/json", "x-exact-tamber-token": tok }, body: JSON.stringify(body) });
    return { status: r.status, answer: await r.json().catch(() => null) };
  };
  return { base, token, ask };
}
var wireError = (r) => {
  const e = r.answer?.error;
  if (!e) return `the wire answered ${r.status}`;
  const diags = Array.isArray(e.diagnostics) ? e.diagnostics.slice(0, 3).map((d) => `${d.file}:${d.line}:${d.col} ${d.message}`) : [];
  return [e.message ?? JSON.stringify(e).slice(0, 300), ...diags].join(" \u2014 ");
};
function idle(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function whereOf(shotsText) {
  let url = null;
  const ops = [];
  for (const raw of String(shotsText ?? "").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("//")) continue;
    const at = /^at\s+"([^"]*)"$/.exec(line);
    if (at && url === null) {
      url = at[1];
      continue;
    }
    ops.push(line);
  }
  if (!url) fail(`a preview starts where the screen's shots say: one at "<path>" first`);
  checkJob({ host: "web", url, ops, shots: [] });
  return { url, ops };
}
async function scrubPreview(wire, out, job, files, sim) {
  const where = whereOf(job.shots);
  const devices = (job.devices ?? []).filter((d) => /^\d{2,4}x\d{2,4}$/.test(d.size ?? ""));
  const schemes = (job.schemes ?? ["light", "dark"]).filter((s) => s === "light" || s === "dark");
  const hosts = ["web", ...job.ios && sim ? ["ios"] : []];
  const client = "isocan-preview";
  const presence = new AbortController();
  fetch(`${wire.base}/__tamber/subscribe`, { method: "POST", headers: { "content-type": "application/json", "x-exact-tamber-token": wire.token }, body: JSON.stringify({ client }), signal: presence.signal }).catch(() => {
  });
  const signal = (s, which) => path.join(out, `go-${s}-${which}`);
  const shot = (host, device, s, phase) => path.join(out, `${host}-${device}-${s}-${phase}.png`);
  const iosDevice = "phone";
  const phaseOps = (host, s, phase) => host === "web" ? devices.flatMap((d) => [`resize ${d.size}`, "clock settle", `screenshot ${shot("web", d.device, s, phase)}`]) : ["clock settle", `screenshot ${shot("ios", iosDevice, s, phase)}`];
  const tail = (host) => schemes.flatMap((s) => [
    `prefer color-scheme ${s}`,
    ...phaseOps(host, s, "before"),
    `clock +600000 real until ${signal(s, "on")}`,
    ...phaseOps(host, s, "during"),
    `clock +600000 real until ${signal(s, "off")}`,
    ...phaseOps(host, s, "after")
  ]);
  const fixed = ["--json", "--seed", "1", "--locale", "en-US", "--time-zone", "UTC", "--epoch", "2026-01-01"];
  const kids = {};
  const start = (host, args, env) => {
    const child = spawn("/bin/sh", [launcher, "agent", host, ...args], { cwd: app, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"], detached: true });
    let said = "";
    child.stdout.on("data", (d) => {
      said = (said + d).slice(-6e3);
    });
    child.stderr.on("data", (d) => {
      said = (said + d).slice(-6e3);
    });
    const done = new Promise((r) => child.on("close", (code) => r(code)));
    kids[host] = { child, said: () => said, done };
  };
  const errors = [];
  let scrubId = null;
  try {
    const first = devices[0]?.size ?? "390x844";
    start("web", [...fixed, "--size", first, "--url", `${wire.base}${where.url}`, "clock data", ...where.ops, ...tail("web")], {});
    if (hosts.includes("ios")) {
      const root = rootOf();
      if (where.url !== "/" && !root) fail("an iOS preview opens the screen by typing its path into the node that carries navigate=, and app.contract names none with a testId");
      start("ios", [...fixed, "--url", wire.base, "clock data", ...where.url !== "/" ? [`type ${root} ${where.url}`, "clock settle"] : [], ...where.ops, ...tail("ios")], { EXACT_SIM: sim, EXACT_SHOW_SIMULATOR: "0" });
    }
    const files_ = (s, phase) => hosts.flatMap((h) => h === "web" ? devices.map((d) => shot("web", d.device, s, phase)) : [shot("ios", iosDevice, s, phase)]);
    const until = async (paths, what, ms) => {
      const t0 = Date.now();
      let kept = Date.now();
      while (!paths.every((p) => existsSync(p))) {
        for (const h of hosts) if (kids[h].child.exitCode !== null) throw new Error(`the ${h} preview ended before ${what}: ${kids[h].said().trim().split("\n").filter((l) => !l.startsWith("{")).slice(-3).join(" | ")}`);
        if (Date.now() - t0 > ms) throw new Error(`no ${what} after ${Math.round(ms / 1e3)} s`);
        if (scrubId && Date.now() - kept > 1e4) {
          kept = Date.now();
          await wire.ask({ method: "scrub", client, ops: job.ops, files, scrub: scrubId });
        }
        await idle(250);
      }
      await idle(400);
    };
    for (const s of schemes) {
      await until(files_(s, "before"), `the ${s} pictures before`, 9e5);
      const opened = await wire.ask({ method: "scrub", client, ops: job.ops, files });
      if (!opened.answer?.ok) throw new Error(`the scrub was refused: ${wireError(opened)}`);
      scrubId = opened.answer.ok.scrub;
      await idle(2500);
      writeFileSync(signal(s, "on"), "");
      await until(files_(s, "during"), `the ${s} pictures with the proposal`, 3e5);
      const cancelled = await wire.ask({ method: "scrub-cancel", client, scrub: scrubId });
      scrubId = null;
      if (!cancelled.answer?.ok) errors.push(`scrub-cancel answered ${cancelled.status}: ${wireError(cancelled)}`);
      await idle(2500);
      writeFileSync(signal(s, "off"), "");
      await until(files_(s, "after"), `the ${s} pictures after the scrub`, 3e5);
    }
    for (const h of hosts) await Promise.race([kids[h].done, idle(3e4)]);
  } catch (err) {
    errors.push(err.message);
  } finally {
    if (scrubId) await wire.ask({ method: "scrub-cancel", client, scrub: scrubId }).catch(() => {
    });
    presence.abort();
    for (const k of Object.values(kids)) {
      try {
        process.kill(-k.child.pid, "SIGTERM");
      } catch {
      }
    }
  }
  const previews = [];
  for (const h of hosts) for (const s of schemes) for (const d of h === "web" ? devices.map((x) => x.device) : [iosDevice]) {
    const before = shot(h, d, s, "before"), after = shot(h, d, s, "during"), restored = shot(h, d, s, "after");
    if (!existsSync(before) || !existsSync(after)) continue;
    const b = readFileSync(before), a = readFileSync(after);
    previews.push({ host: h, device: d, scheme: s, before, after, beforeSha256: sha256(b), afterSha256: sha256(a), png: pngSize(a), restored: existsSync(restored) ? sha256(readFileSync(restored)) === sha256(b) : null });
  }
  return { how: "scrub", previews, errors };
}
async function stagedPreview(out, job, texts, sim) {
  const where = whereOf(job.shots);
  const devices = (job.devices ?? []).filter((d) => /^\d{2,4}x\d{2,4}$/.test(d.size ?? ""));
  const schemes = (job.schemes ?? ["light", "dark"]).filter((s) => s === "light" || s === "dark");
  const self = new URL(import.meta.url).pathname;
  const errors = [];
  const staging = path.join(os.tmpdir(), "isocan-exact-staging", sha256(app).slice(0, 12));
  mkdirSync(staging, { recursive: true });
  const sync = spawnSync("rsync", ["-a", "--delete", "--exclude", "/target", "--exclude", "/.exact", "--exclude", "/node_modules", `${app}/`, `${staging}/`], { encoding: "utf8" });
  if (sync.status !== 0) fail(`could not stage the app's sources: ${(sync.stderr || "").trim()}`);
  const jobs = [{ host: "web", url: where.url, ops: where.ops, shots: devices.flatMap((d) => schemes.map((s) => ({ size: d.size, scheme: s }))) }];
  if (job.ios && sim) jobs.push({ host: "ios", url: where.url, ops: where.ops, shots: schemes.map((s) => ({ size: "402x874", scheme: s })) });
  const launcherIn = path.join(staging, "exact.mjs");
  const stagedEnv = { ...process.env, EXACT_WEB_DIST: `${staging}-web` };
  const pictures = {};
  for (const side of ["before", "after"]) {
    if (side === "after") {
      for (const [rel, text] of Object.entries(texts ?? {})) {
        if (rel.startsWith("/") || rel.split(/[\\/]/).includes("..")) fail(`the wire named a file outside the app: ${rel}`);
        writeFileSync(path.join(staging, rel), text);
      }
      if (existsSync(path.join(staging, "app.contract"))) {
        const built = spawnSync("/bin/sh", [launcherIn, "contract", "build", "app.contract", "--json", "--errors-only"], { cwd: staging, encoding: "utf8", maxBuffer: 64 << 20 });
        let diags = [];
        try {
          diags = JSON.parse((built.stdout || "[]").trim().split("\n").filter((l) => l.startsWith("[")).at(-1) ?? "[]");
        } catch {
        }
        const bad = diags.filter((d) => !d.severity || d.severity === "error");
        if (built.status !== 0 || bad.length) return { how: "staged", previews: [], errors: [`the proposed text does not build: ${bad[0] ? `${bad[0].file}:${bad[0].line}:${bad[0].col} ${bad[0].message}` : (built.stderr || "").trim().split("\n").at(-1)}`] };
      }
    }
    const wb = spawnSync("/bin/sh", [launcherIn, "web-build"], { cwd: staging, encoding: "utf8", maxBuffer: 64 << 20, timeout: 6e5, env: stagedEnv });
    if (wb.status !== 0) {
      errors.push(`web-build in the staged copy (${side}) failed: ${(wb.stderr || wb.stdout || "").trim().split("\n").at(-1)}`);
      continue;
    }
    const jobsFile = path.join(out, `jobs-${side}.json`), rep = path.join(out, `capture-${side}.json`), shots = path.join(out, side);
    writeFileSync(jobsFile, JSON.stringify(jobs));
    const run = spawnSync(process.execPath, [self, "capture", "--app", staging, "--report", rep, "--dir", shots, "--jobs", jobsFile, ...sim ? ["--sim", sim] : []], { encoding: "utf8", maxBuffer: 64 << 20, timeout: 18e5, env: stagedEnv });
    if (run.status !== 0 || !existsSync(rep)) {
      errors.push(`the staged copy's capture (${side}) failed: ${(run.stderr || "").trim().split("\n").slice(-2).join(" | ")}`);
      continue;
    }
    pictures[side] = JSON.parse(readFileSync(rep, "utf8")).shots;
  }
  const previews = [];
  for (const a of pictures.after ?? []) {
    const b = (pictures.before ?? []).find((x) => x.job === a.job && x.index === a.index);
    if (!b) continue;
    const device = a.host === "web" ? devices.find((d) => d.size === a.size)?.device ?? a.size : "phone";
    previews.push({ host: a.host, device, scheme: a.scheme, before: b.file, after: a.file, beforeSha256: b.sha256, afterSha256: a.sha256, png: a.png, restored: null });
  }
  return { how: "staged", previews, errors };
}
async function proposeJob(out, job) {
  mkdirSync(out, { recursive: true });
  checkProposalOps(job.ops);
  if (!["propose", "write"].includes(job.scope)) fail(`a proposal's scope is propose or write, not ${JSON.stringify(job.scope)}`);
  const name = String(job.name ?? "someone").replace(/[^A-Za-z0-9_.-]+/g, "-").slice(0, 40) || "someone";
  const started = Date.now();
  const wire = await wireOf();
  const hello = await wire.ask({ method: "hello" });
  if (!hello.answer?.ok) return { ok: false, error: `hello: ${wireError(hello)}` };
  const files = hello.answer.ok.files;
  let token = wire.token, client = `person:${name}`, scopeCheck = null;
  if (job.scope === "propose") {
    const code = await wire.ask({ method: "pair-code", scope: "propose", name: `isocan-${name}` });
    if (!code.answer?.ok?.code) return { ok: false, error: `pair-code: ${wireError(code)}` };
    const pr = await fetch(`${wire.base}/__tamber/pair`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: code.answer.ok.code, name: `isocan-${name}` }) });
    const paired = await pr.json().catch(() => null);
    if (!paired?.ok?.token && !paired?.token) return { ok: false, error: `pair: ${pr.status} ${JSON.stringify(paired).slice(0, 200)}` };
    const p = paired.ok ?? paired;
    token = p.token;
    client = p.client;
    if (p.scope !== "propose") return { ok: false, error: `the wire paired this agent at ${p.scope}, not propose` };
  }
  const held = await wire.ask({ method: "propose", ops: job.ops, files, hold: true, client, texts: true }, token);
  if (!held.answer?.ok) return { ok: false, scope: job.scope, client, error: `the wire refused the proposal: ${wireError(held)}`, diagnostics: held.answer?.error?.diagnostics ?? null };
  const plan = held.answer.ok;
  if (job.scope === "propose") {
    const tried = await wire.ask({ method: "accept", proposal: plan.proposal, client }, token);
    scopeCheck = { status: tried.status, scope: tried.answer?.error?.scope ?? null, needs: tried.answer?.error?.needs ?? null, message: wireError(tried) };
  }
  const sim = job.ios ? flag("--sim") && /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i.test(flag("--sim")) ? simulator([{ host: "ios" }]) : null : null;
  let texts = plan.texts ?? null;
  if (plan.class !== "live" && !texts) {
    const again = await wire.ask({ method: "propose", ops: job.ops, files, client, texts: true }, token);
    texts = again.answer?.ok?.texts ?? null;
    if (!texts) return { ok: false, proposal: plan.proposal, client, scope: job.scope, class: plan.class, error: `the wire would not say what the proposal writes: ${wireError(again)}` };
  }
  const preview = plan.class === "live" ? await scrubPreview(wire, out, job, files, sim) : await stagedPreview(out, job, texts, sim);
  return {
    ok: preview.previews.length > 0 && preview.errors.length === 0,
    proposal: plan.proposal,
    client,
    scope: job.scope,
    class: plan.class,
    changed: plan.changed ?? [],
    diff: plan.diff ?? null,
    files: plan.files ?? files,
    expires: plan.expires ?? null,
    ops: plan.ops ?? null,
    scopeCheck,
    how: preview.how,
    previews: preview.previews,
    ms: Date.now() - started,
    ...preview.errors.length ? { error: preview.errors.join("; ") } : {}
  };
}
async function acceptJob(job) {
  checkProposalOps(job.ops);
  const wire = await wireOf();
  const client = `person:${String(job.name ?? "someone").replace(/[^A-Za-z0-9_.-]+/g, "-").slice(0, 40)}`;
  let r = job.proposal ? await wire.ask({ method: "accept", proposal: job.proposal, client }) : { status: 404, answer: null };
  let again = null;
  if (r.status === 404) {
    const held = await wire.ask({ method: "propose", ops: job.ops, files: job.files, hold: true, client });
    if (!held.answer?.ok) return { ok: false, error: `the proposal had gone from the wire, and holding it again was refused: ${wireError(held)}` };
    again = held.answer.ok.proposal;
    r = await wire.ask({ method: "accept", proposal: again, client });
  }
  const ok = r.answer?.ok;
  if (!ok) return { ok: false, heldAgain: again, error: `accept: ${wireError(r)}`, stale: r.answer?.error?.stale ?? null };
  if (ok.recomputed) return { ok: false, heldAgain: again, error: "a file moved since the proposal was made, so the wire put it up again rather than write it \u2014 ask for the proposal again" };
  return { ok: true, heldAgain: again, written: ok.written ?? [], before: ok.before ?? null, files: ok.files ?? null, class: ok.class ?? null };
}
async function dropJob(job) {
  const wire = await wireOf();
  if (!job.proposal) return { ok: true, dropped: null };
  const r = await wire.ask({ method: "drop", proposal: job.proposal, client: "isocan" });
  return { ok: !!r.answer?.ok || r.status === 404, dropped: r.answer?.ok?.dropped ?? null, status: r.status };
}
function stageBranch() {
  const ref = flag("--ref");
  if (!ref || ref.startsWith("-") || /[\0\n]/.test(ref)) fail("a branch is a git ref of the app's repository, or a directory");
  const staging = path.join(os.tmpdir(), "isocan-exact-branch", sha256(app).slice(0, 12));
  mkdirSync(staging, { recursive: true });
  const keep = ["--exclude", "/target", "--exclude", "/.exact", "--exclude", "/node_modules", "--exclude", "/.git"];
  const asDir = path.resolve(ref);
  let commit = null, from = null;
  if (existsSync(path.join(asDir, "exact.mjs"))) {
    if (asDir === app) fail("that directory is the app itself; name a branch or another worktree");
    from = asDir;
    const r = spawnSync("rsync", ["-a", "--delete", ...keep, `${asDir}/`, `${staging}/`], { encoding: "utf8" });
    if (r.status !== 0) fail(`could not stage ${asDir}: ${(r.stderr || "").trim()}`);
  } else {
    if (!/^[A-Za-z0-9._/@^~-]{1,200}$/.test(ref)) fail(`${JSON.stringify(ref)} is neither a directory with an exact.mjs nor a git ref`);
    commit = git(app, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
    if (!commit) fail(`${ref} is not a commit of the repository ${app} is in (and not a directory with an exact.mjs)`);
    const prefix = git(app, ["rev-parse", "--show-prefix"]) ?? "";
    const tar = spawnSync("git", ["-C", app, "archive", "--format=tar", `${commit}:${prefix}`], { maxBuffer: 1 << 30 });
    if (tar.status !== 0) fail(`git archive ${ref} failed: ${String(tar.stderr).trim()}`);
    const tmp = mkdtempSync(path.join(os.tmpdir(), "isocan-exact-branch-tree-"));
    try {
      const x = spawnSync("tar", ["-x", "-C", tmp], { input: tar.stdout });
      if (x.status !== 0) fail(`could not unpack ${ref}: ${String(x.stderr).trim()}`);
      const r = spawnSync("rsync", ["-a", "--delete", ...keep, `${tmp}/`, `${staging}/`], { encoding: "utf8" });
      if (r.status !== 0) fail(`could not stage ${ref}: ${(r.stderr || "").trim()}`);
    } finally {
      spawnSync("rm", ["-rf", tmp]);
    }
    if (!existsSync(path.join(staging, "exact.mjs"))) writeFileSync(path.join(staging, "exact.mjs"), readFileSync(launcher));
  }
  return { staging, ref, commit, from };
}
var result = verb === "stage-branch" ? stageBranch() : verb === "propose" ? await proposeJob(path.resolve(flag("--dir") ?? fail("propose needs --dir")), JSON.parse(readFileSync(path.resolve(flag("--job") ?? fail("propose needs --job")), "utf8"))) : verb === "accept" ? await acceptJob(JSON.parse(readFileSync(path.resolve(flag("--job") ?? fail("accept needs --job")), "utf8"))) : verb === "drop" ? await dropJob(JSON.parse(readFileSync(path.resolve(flag("--job") ?? fail("drop needs --job")), "utf8"))) : verb === "run" ? runJob(path.resolve(flag("--dir") ?? fail("run needs --dir")), JSON.parse(readFileSync(path.resolve(flag("--job") ?? fail("run needs --job")), "utf8"))) : verb === "record" ? recordJob(JSON.parse(readFileSync(path.resolve(flag("--job") ?? fail("record needs --job")), "utf8"))) : verb === "verify" ? verifyJob() : verb === "film" ? filmJob(path.resolve(flag("--dir") ?? fail("film needs --dir")), JSON.parse(readFileSync(path.resolve(flag("--job") ?? fail("film needs --job")), "utf8"))) : verb === "facts" ? factsJob(JSON.parse(readFileSync(path.resolve(flag("--job") ?? fail("facts needs --job")), "utf8"))) : verb === "drive" ? driveJob(path.resolve(flag("--dir") ?? fail("drive needs --dir")), JSON.parse(readFileSync(path.resolve(flag("--job") ?? fail("drive needs --job")), "utf8"))) : verb === "compare" ? compare(path.resolve(flag("--dir") ?? fail("compare needs --dir")), JSON.parse(readFileSync(path.resolve(flag("--jobs") ?? fail("compare needs --jobs")), "utf8"))) : verb === "diagnose" ? diagnose() : verb === "check" ? check() : verb === "doctor" ? await doctor() : verb === "read" ? await read() : verb === "inputs" ? { inputs: inputsDigest(checkout().dir) } : capture();
writeFileSync(report, JSON.stringify(result, null, 2));
