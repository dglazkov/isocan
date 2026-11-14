#!/usr/bin/env node
/**
 * **The bridge between `isocan exact` and an Exact app** (exact phase 0;
 * `docs/projects/exact/design.md` §2, §14).
 *
 *   node scripts/exact-bridge.mjs doctor  --app <dir> --report <file.json> [--hosts web,ios]
 *   node scripts/exact-bridge.mjs read    --app <dir> --report <file.json>
 *   node scripts/exact-bridge.mjs capture --app <dir> --report <file.json> --dir <out> --size <w>x<h> --url <path>…
 *
 * isocan runs no compute of its own and a module may not spawn, so the
 * `exact` verbs run this, as `motion render` runs its script: through
 * `runPackageScript`, a script of this copy's own. It runs the person's OWN
 * Exact — the app's `exact.mjs`, with the checkout that file names — on the
 * app directory the person typed. Nothing here came off a canvas, and
 * nothing is written to one: the CLI posts what the report says.
 *
 * It reads only what Exact prints for tools (design §14): `web-build`'s
 * `routes.json`, `contract symbols`, the agent driver's screenshots, `setup
 * --check`, and Tamber's `hello`. Every launch is `/bin/sh exact.mjs …`, the
 * app's own launcher line, so the Bun it picks is the one the app would.
 *
 * Node built-ins only: the release bundles this file (RELEASE_SCRIPTS), and
 * a script with nothing to resolve has nothing to lose in the bundle.
 */
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, accessSync, constants } from "node:fs";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";

const [verb, ...argv] = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const flags = (name) => argv.flatMap((a, i) => (a === name && argv[i + 1] !== undefined ? [argv[i + 1]] : []));

if (!["doctor", "read", "capture"].includes(verb ?? "") || !flag("--app") || !flag("--report")) {
  console.error("usage: exact-bridge.mjs doctor|read|capture --app <dir> --report <file.json> [--hosts web,ios] [--dir <out> --size <w>x<h> --url <path>…]");
  process.exit(2);
}

const app = path.resolve(flag("--app"));
const report = path.resolve(flag("--report"));
const launcher = path.join(app, "exact.mjs");
if (!existsSync(launcher)) fail(`${app} has no exact.mjs — is it an Exact app? (\`bun <exact>/scripts/exact.mjs new <dir>\` makes one)`);

function fail(message) {
  console.error(message);
  process.exit(1);
}

/** `bun exact.mjs <args>` in the app, as the app's launcher line runs it. */
function exact(args, { allowFail = false, timeoutMs = 600_000 } = {}) {
  const started = Date.now();
  const done = spawnSync("/bin/sh", [launcher, ...args], { cwd: app, encoding: "utf8", maxBuffer: 64 << 20, timeout: timeoutMs });
  const ms = Date.now() - started;
  if (done.error) fail(`exact.mjs ${args[0]} could not start: ${done.error.message}`);
  if (done.status !== 0 && !allowFail) {
    const said = (done.stderr || done.stdout || "").trim().split("\n").slice(-6).join("\n");
    fail(`\`bun exact.mjs ${args.join(" ")}\` failed (exit ${done.status ?? done.signal}):\n${said}`);
  }
  return { code: done.status, stdout: done.stdout ?? "", stderr: done.stderr ?? "", ms };
}

/**
 * **Which checkout the app's launcher uses** — by the launcher's own rule,
 * read from it: `EXACT`, else `EXACT2`, else the path `exact new` wrote into
 * it, from the app's directory. Exact prints this nowhere (a diary note), so
 * the launcher's line is the nearest thing to asking it.
 */
function checkout() {
  const text = readFileSync(launcher, "utf8");
  const literal = /process\.env\.EXACT2\s*\?\?\s*("(?:[^"\\]|\\.)*")/.exec(text)?.[1];
  const named = process.env.EXACT ?? process.env.EXACT2 ?? (literal ? JSON.parse(literal) : undefined);
  if (!named) fail(`${launcher} names no Exact checkout, and neither EXACT nor EXACT2 is set`);
  const dir = path.resolve(app, named);
  if (!existsSync(path.join(dir, "scripts/app-cli.mjs"))) fail(`no Exact checkout at ${dir} (no scripts/app-cli.mjs) — EXACT names the checkout`);
  const pin = /ensureBun\("([^"]+)"\)/.exec(text)?.[1] ?? null;
  return { dir, pin };
}

function git(dir, args) {
  const done = spawnSync("git", ["-C", dir, ...args], { encoding: "utf8" });
  return done.status === 0 ? done.stdout.trim() : null;
}

/** The Bun the launcher picks: `BUN`, else `~/.bun-<pin>/bin/bun`, else `bun` on PATH — its own shebang's order. */
function bunOf(pin) {
  const pinned = pin ? path.join(os.homedir(), `.bun-${pin}`, "bin", "bun") : null;
  const executable = (p) => { try { accessSync(p, constants.X_OK); return true; } catch { return false; } };
  const bin = process.env.BUN || (pinned && executable(pinned) ? pinned : "bun");
  const v = spawnSync(bin, ["--version"], { encoding: "utf8" });
  return { bin, version: v.status === 0 ? v.stdout.trim() : null };
}

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function freePort() {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

/**
 * **Tamber's `hello`, from a design server of the app's own** — started for
 * this question alone on a free loopback port, asked, and stopped. An app
 * without a design mounts no wire, which is an answer too.
 */
async function tamberHello() {
  const design = existsSync(path.join(app, "app.tamber"));
  if (!design) return { protocol: null, note: "no app.tamber: the app has no design, so no Tamber wire is mounted" };
  const port = await freePort();
  const child = spawn("/bin/sh", [launcher, "tamber", "serve", ".", "--port", String(port)], { cwd: app, stdio: ["ignore", "pipe", "pipe"], detached: true });
  let said = "";
  child.stdout.on("data", (d) => { said += d; });
  child.stderr.on("data", (d) => { said += d; });
  const base = `http://127.0.0.1:${port}`;
  try {
    const deadline = Date.now() + 60_000;
    let token = null;
    while (Date.now() < deadline && !token) {
      try {
        const r = await fetch(`${base}/__tamber/token`, { redirect: "error" });
        if (r.ok) token = (await r.json()).token;
      } catch { /* not listening yet */ }
      if (!token) await new Promise((r) => setTimeout(r, 250));
    }
    if (!token) return { protocol: null, note: `the design server did not answer on ${base}: ${said.trim().split("\n").at(-1) ?? ""}` };
    const r = await fetch(`${base}/__tamber`, { method: "POST", headers: { "content-type": "application/json", "x-exact-tamber-token": token }, body: JSON.stringify({ method: "hello" }) });
    const body = await r.json().catch(() => null);
    if (!body?.ok) return { protocol: null, note: `hello answered ${r.status}: ${body?.error?.message ?? said.trim().split("\n")[0] ?? "nothing"}` };
    return { protocol: body.ok.protocol ?? null, format: body.ok.format ?? null, note: null };
  } finally {
    try { process.kill(-child.pid, "SIGTERM"); } catch { /* gone */ }
  }
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
    tamber,
  };
}

async function read() {
  const { dir } = checkout();
  const build = exact(["web-build"]);
  const dist = path.join(app, "target", "web-dist");
  const routesFile = path.join(dist, "routes.json");
  if (!existsSync(routesFile)) fail(`web-build wrote no ${routesFile} — Exact changed where its routes go`);
  const symbols = exact(["contract", "symbols", "app.contract"]);
  const parsed = JSON.parse(symbols.stdout);
  const sources = {};
  for (const file of new Set(parsed.definitions.map((d) => d.file))) {
    if (file.includes(":") || !file.endsWith(".contract")) continue;
    const at = path.resolve(app, file);
    if (!at.startsWith(app + path.sep)) continue;
    sources[file] = readFileSync(at, "utf8");
  }
  const manifest = JSON.parse(readFileSync(path.join(app, "app.json"), "utf8"));
  const planFile = path.join(dist, "app.plan");
  return {
    app: { id: manifest.app?.id ?? manifest.id ?? path.basename(app), name: manifest.app?.name ?? manifest.name ?? path.basename(app) },
    exact: { commit: git(dir, ["rev-parse", "HEAD"]), protocol: null },
    plan: existsSync(planFile) ? sha256(readFileSync(planFile)) : null,
    routesJson: JSON.parse(readFileSync(routesFile, "utf8")),
    symbols: parsed,
    sources,
    ms: { build: build.ms, symbols: symbols.ms },
  };
}

/**
 * **One cold driver per screen** (design §4): a fresh `agent web` for each,
 * at the driver's fixed seed, locale, zone and epoch, said out loud rather
 * than left to its defaults. Phase 0 measures what that costs; the resident
 * session is fact 2's question.
 */
function capture() {
  const out = path.resolve(flag("--dir") ?? fail("capture needs --dir"));
  const size = flag("--size") ?? "390x844";
  if (!/^\d+x\d+$/.test(size)) fail(`--size is <w>x<h>, not ${size}`);
  mkdirSync(out, { recursive: true });
  const shots = [];
  for (const [i, url] of flags("--url").entries()) {
    const file = path.join(out, `screen-${i}.png`);
    const run = exact([
      "agent", "web", "--size", size, "--seed", "1", "--locale", "en-US", "--time-zone", "UTC", "--epoch", "2026-01-01",
      "--url", url, "clock data", "clock settle", `screenshot ${file}`,
    ]);
    if (!existsSync(file)) fail(`agent web wrote no screenshot for ${url}:\n${run.stdout.trim().split("\n").slice(-4).join("\n")}`);
    shots.push({ url, file, sha256: sha256(readFileSync(file)), ms: run.ms });
  }
  return { size, shots };
}

const result = verb === "doctor" ? await doctor() : verb === "read" ? await read() : capture();
writeFileSync(report, JSON.stringify(result, null, 2));
