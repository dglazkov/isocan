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
if (!["doctor", "read", "capture", "inputs"].includes(verb ?? "") || !flag("--app") || !flag("--report")) {
  console.error("usage: exact-bridge.mjs doctor|read|capture|inputs --app <dir> --report <file.json> [--hosts web,ios] [--jobs <jobs.json>] [--dir <out> --size <w>x<h> --url <path>\u2026]");
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
function exact(args, { allowFail = false, timeoutMs = 6e5 } = {}) {
  const started = Date.now();
  const done = spawnSync("/bin/sh", [launcher, ...args], { cwd: app, encoding: "utf8", maxBuffer: 64 << 20, timeout: timeoutMs });
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
function checkJob(job) {
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
  for (const [j, job] of jobs.entries()) {
    checkJob(job);
    const first = job.shots[0];
    const ops = ["clock data", ...job.ops ?? []];
    const files = [];
    for (const [i, shot] of job.shots.entries()) {
      const file = path.join(out, `job-${j}-${i}.png`);
      files.push(file);
      ops.push(`resize ${shot.size}`, `prefer color-scheme ${shot.scheme}`, "clock settle", `screenshot ${file}`);
    }
    const run = exact([
      "agent",
      "web",
      "--size",
      first.size,
      "--seed",
      "1",
      "--locale",
      "en-US",
      "--time-zone",
      "UTC",
      "--epoch",
      "2026-01-01",
      "--url",
      job.url,
      ...ops
    ]);
    for (const [i, file] of files.entries()) {
      if (!existsSync(file)) fail(`agent web wrote no screenshot for ${job.url} at ${job.shots[i].size} ${job.shots[i].scheme}:
${run.stdout.trim().split("\n").slice(-4).join("\n")}`);
      shots.push({ job: j, index: i, url: job.url, size: job.shots[i].size, scheme: job.shots[i].scheme, file, sha256: sha256(readFileSync(file)), ms: Math.round(run.ms / files.length) });
    }
  }
  return { shots };
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
var result = verb === "doctor" ? await doctor() : verb === "read" ? await read() : verb === "inputs" ? { inputs: inputsDigest(checkout().dir) } : capture();
writeFileSync(report, JSON.stringify(result, null, 2));
