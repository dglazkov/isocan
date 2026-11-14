#!/usr/bin/env node
/**
 * **The bridge between `isocan exact` and an Exact app** (exact phases 0
 * and 1; `docs/projects/exact/design.md` §2–§4, §14).
 *
 *   node scripts/exact-bridge.mjs doctor  --app <dir> --report <file.json> [--hosts web,ios]
 *   node scripts/exact-bridge.mjs read    --app <dir> --report <file.json> [--no-design]
 *   node scripts/exact-bridge.mjs capture --app <dir> --report <file.json> --jobs <jobs.json>
 *   node scripts/exact-bridge.mjs capture --app <dir> --report <file.json> --dir <out> --size <w>x<h> --url <path>…
 *   node scripts/exact-bridge.mjs inputs  --app <dir> --report <file.json>
 *   node scripts/exact-bridge.mjs diagnose --app <dir> --report <file.json>
 *   node scripts/exact-bridge.mjs check   --app <dir> --report <file.json> --url <path>…
 *   node scripts/exact-bridge.mjs compare --app <dir> --report <file.json> --dir <captures> --jobs <compare.json>
 *   node scripts/exact-bridge.mjs drive   --app <dir> --report <file.json> --dir <out> --job <drive.json> [--sim <udid>]
 *   node scripts/exact-bridge.mjs film    --app <dir> --report <file.json> --dir <out> --job <film.json> [--sim <udid>]
 *   node scripts/exact-bridge.mjs facts   --app <dir> --report <file.json> --job <facts.json> [--sim <udid>]
 *   node scripts/exact-bridge.mjs propose --app <dir> --report <file.json> --dir <out> --job <propose.json> --dev-url <loop> [--sim <udid>]
 *   node scripts/exact-bridge.mjs accept  --app <dir> --report <file.json> --job <accept.json> --dev-url <loop>
 *   node scripts/exact-bridge.mjs drop    --app <dir> --report <file.json> --job <drop.json> --dev-url <loop>
 *   node scripts/exact-bridge.mjs stage-branch --app <dir> --report <file.json> --ref <git ref | directory>
 *   node scripts/exact-bridge.mjs run     --app <dir> --report <file.json> --dir <out> --job <run.json> [--sim <udid>]
 *   node scripts/exact-bridge.mjs record  --app <dir> --report <file.json> --job <record.json> [--sim <udid>]
 *   node scripts/exact-bridge.mjs verify  --app <dir> --report <file.json> --host web|ios [--sim <udid>]
 *   node scripts/exact-bridge.mjs lane    --app <dir> --report <file.json>
 *   node scripts/exact-bridge.mjs prepare --app <dir> --report <file.json> --channel <c> [--platform ios]
 *   node scripts/exact-bridge.mjs ship    --app <dir> --report <file.json> --channel <c> --release <id> [--expect <sha>] [--commit <sha>] [--platform ios]
 *
 * A capture job names its host (`web`, `ios`, `macos`; exact phase 3); an
 * iOS one runs on the simulator `--sim <udid>` names, and on no other.
 *
 * isocan runs no compute of its own and a module may not spawn, so the
 * `exact` verbs run this, as `motion render` runs its script: through
 * `runPackageScript`, a script of this copy's own. It runs the person's OWN
 * Exact — the app's `exact.mjs`, with the checkout that file names — on the
 * app directory the person typed. Nothing here came off a canvas, and
 * nothing is written to one: the CLI posts what the report says.
 *
 * It reads only what Exact prints for tools (design §14): `web-build`'s
 * `routes.json`, `contract symbols`, `contract test`, `tamber ir`, the
 * design server's `hello` and `uses`, the agent driver's screenshots and
 * `setup --check`. Every launch is `/bin/sh exact.mjs …`, the
 * app's own launcher line, so the Bun it picks is the one the app would.
 *
 * Node built-ins only: the release bundles this file (RELEASE_SCRIPTS), and
 * a script with nothing to resolve has nothing to lose in the bundle.
 */
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, accessSync, constants } from "node:fs";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";

const [verb, ...argv] = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const flags = (name) => argv.flatMap((a, i) => (a === name && argv[i + 1] !== undefined ? [argv[i + 1]] : []));

if (!["doctor", "read", "capture", "inputs", "diagnose", "check", "compare", "drive", "film", "facts", "run", "record", "verify", "propose", "accept", "drop", "stage-branch", "lane", "prepare", "ship"].includes(verb ?? "") || !flag("--app") || !flag("--report")) {
  console.error("usage: exact-bridge.mjs doctor|read|capture|inputs|diagnose|check --app <dir> --report <file.json> [--hosts web,ios] [--jobs <jobs.json>] [--dir <out> --size <w>x<h> --url <path>…]");
  process.exit(2);
}

const app = path.resolve(flag("--app"));
const report = path.resolve(flag("--report"));
/**
 * **The web build this bridge drives, kept apart from the dev loop's** (exact
 * phase 6). A `web-build` into the app's own web dist leaves the running dev
 * loop's pages deaf to Tamber — measured 14 Nov 2026 (Exact cbe553f6): after
 * one, a scrub reached the iOS app joined to the loop and not one web page,
 * and phase 3 saw `inspect` break the same way. Exact's `EXACT_WEB_DIST` names
 * another dist for `web-build` and the web driver alike, so every capture,
 * drive, film and inspection builds and serves one of its own, per app.
 */
if (!process.env.EXACT_WEB_DIST) process.env.EXACT_WEB_DIST = path.join(os.tmpdir(), "isocan-exact-web", createHash("sha256").update(app).digest("hex").slice(0, 12));
const launcher = path.join(app, "exact.mjs");
if (!existsSync(launcher)) fail(`${app} has no exact.mjs — is it an Exact app? (\`bun <exact>/scripts/exact.mjs new <dir>\` makes one)`);

function fail(message) {
  console.error(message);
  process.exit(1);
}

/** `bun exact.mjs <args>` in the app, as the app's launcher line runs it. */
function exact(args, { allowFail = false, timeoutMs = 600_000, env = {} } = {}) {
  const started = Date.now();
  const done = spawnSync("/bin/sh", [launcher, ...args], { cwd: app, encoding: "utf8", maxBuffer: 64 << 20, timeout: timeoutMs, env: { ...process.env, ...env } });
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
 * **A design server of the app's own, for a few questions** — started on a
 * free loopback port, asked, and stopped. An app without a design mounts no
 * wire, which is an answer too. `ask(method, body)` posts one request with
 * the loopback token, as `tamber op` does.
 */
async function withDesignServer(questions) {
  const design = existsSync(path.join(app, "app.tamber"));
  if (!design) return { ok: false, note: "no app.tamber: the app has no design, so no Tamber wire is mounted" };
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
    if (!token) return { ok: false, note: `the design server did not answer on ${base}: ${said.trim().split("\n").at(-1) ?? ""}` };
    const ask = async (body) => {
      const r = await fetch(`${base}/__tamber`, { method: "POST", headers: { "content-type": "application/json", "x-exact-tamber-token": token }, body: JSON.stringify(body) });
      const answer = await r.json().catch(() => null);
      return { status: r.status, answer };
    };
    return { ok: true, value: await questions(ask) };
  } finally {
    try { process.kill(-child.pid, "SIGTERM"); } catch { /* gone */ }
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

/**
 * **The design** (design §3): `tamber ir` (the folded IR), and the wire's
 * `uses` for each token — every style row that reads it, at its line.
 */
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

/**
 * **What a capture depends on**: every file of the app's own (not what a
 * build or Exact writes: `target/`, `.exact/`, `dist*`, `node_modules/`,
 * generated `*.d.ts`), by path and SHA-256, and the Exact commit with its
 * uncommitted changes. Equal digest, equal pictures — so a capture is
 * skipped; a different one is recaptured, and posted only if its pixels moved.
 */
function inputsDigest(exactDir) {
  const skip = new Set(["target", ".exact", "node_modules", ".git", ".vscode"]);
  const files = [];
  const walk = (dir, rel, depth) => {
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (skip.has(e.name) || e.name.startsWith("dist") || e.name.endsWith(".d.ts") || e.name === ".DS_Store") continue;
      const p = path.join(dir, e.name);
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) { if (depth < 4) walk(p, r, depth + 1); }
      else if (e.isFile()) files.push(`${r}\u0000${sha256(readFileSync(p))}`);
    }
  };
  walk(app, "", 0);
  const commit = git(exactDir, ["rev-parse", "HEAD"]) ?? "";
  const dirty = git(exactDir, ["diff", "HEAD", "--stat"]) ?? "";
  return sha256([`exact\u0000${commit}\u0000${sha256(dirty)}`, ...files].join("\n"));
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
  const inputs = inputsDigest(dir);
  const build = exact(["web-build"]);
  const dist = process.env.EXACT_WEB_DIST;
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
  // The tests, compiled: each `*.test.contract` beside the app.
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
  // `app.ts`'s grants, as written (design §3) — the one line read from source
  // rather than printed, because Exact prints grants nowhere (a diary note).
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
    ms: { build: build.ms, symbols: symbols.ms, design: Date.now() - started },
  };
}

/**
 * The driver operations `exact.shots` may carry — the same closed list the
 * module checks (`parseShots`), checked again here because this is where
 * they reach the person's Exact: nothing that writes a file, no scheme.
 */
const SHOT_OP = /^(tap|type|clock|back|fail fetch|pass fetch|prefer)\b/;
/** The hosts a capture or a drive runs on (exact phase 3): the web, and the two this Mac drives natively. */
const HOSTS = ["web", "ios", "macos"];
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

/**
 * **One cold driver per way of reaching a screen** (design §4; exact phase
 * 1): a fresh `agent web` at the driver's fixed seed, locale, zone and
 * epoch, said out loud; the route reached once (`--url`, then its
 * `exact.shots` operations), then every device and scheme asked for, each a
 * `resize`, a `prefer color-scheme`, a `clock settle` and a `screenshot`.
 * Measured 13 Nov 2026: two runs are byte-identical, and a screen taken
 * after others in one driver is byte-identical to the same screen taken
 * alone — so one cold start per route costs ~2.5 s for six pictures, not
 * ~1.9 s each.
 */
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
      // `tree` (what is hidden) and `layout` (each node's box, joined to source) right after the picture: what pointing on
      // a capture reads, with live frames off (exact phase 2). A simulator is the size it is: no resize on iOS.
      ops.push(...(host === "ios" ? [] : [`resize ${shot.size}`]), `prefer color-scheme ${shot.scheme}`, "clock settle", `screenshot ${file}`, "tree", "layout", ...(host === "web" ? [] : ["tree --ax"]));
    }
    const run = drive(host, job.url, job.ops ?? [], ops, { size: job.shots[0].size, sim });
    const replies = jsonReplies(run.stdout);
    const trees = replies.filter((r) => Array.isArray(r.nodes) && !r.env);
    const layouts = replies.filter((r) => Array.isArray(r.nodes) && r.env);
    const axes = replies.filter((r) => r.ax);
    for (const [i, file] of files.entries()) {
      if (!existsSync(file)) fail(`agent ${host} wrote no screenshot for ${job.url} at ${job.shots[i].size} ${job.shots[i].scheme}:\n${(run.stderr + run.stdout).trim().split("\n").slice(-6).join("\n")}`);
      const bytes = readFileSync(file);
      const png = pngSize(bytes);
      const points = pointsOf(trees[i], layouts[i], axes[i]);
      // A simulator's screen is its own size: the points say it, so pointing and Drive mode scale by it (exact phase 3).
      if (points && host !== "web" && png) points.size = png;
      shots.push({ job: j, index: i, host, url: job.url, size: job.shots[i].size, scheme: job.shots[i].scheme, file, sha256: sha256(bytes), png, ms: Math.round(run.ms / files.length), points });
    }
  }
  return { shots };
}

const jsonReplies = (stdout) => stdout.split("\n").flatMap((line) => { if (!line.startsWith("{")) return []; try { return [JSON.parse(line)]; } catch { return []; } });

/** A PNG's own width and height, from its IHDR. */
function pngSize(bytes) {
  return bytes.length > 24 && bytes.toString("latin1", 12, 16) === "IHDR" ? { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) } : null;
}

/**
 * **The simulator an iOS job runs on** (exact phase 3; design §7): one the
 * person made for this, named by `--sim <udid>` — never "a booted one", which
 * may be somebody's own. Exact's driver takes it as `EXACT_SIM`.
 */
function simulator(jobs) {
  if (!jobs.some((j) => j.host === "ios")) return null;
  const sim = flag("--sim");
  if (!sim || !/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i.test(sim)) fail("an iOS capture needs a simulator of its own, by UDID: `xcrun simctl create \"isocan-exact\" com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro <runtime>`, then --sim <udid>. A booted simulator may be somebody's own, so none is guessed.");
  // The status bar's clock is the wall clock unless told otherwise; a capture is a function of the source, so it reads
  // 9:41 on the simulator the person gave us for this (and only that one).
  spawnSync("xcrun", ["simctl", "status_bar", sim, "override", "--time", "9:41", "--batteryLevel", "100", "--batteryState", "charged"], { encoding: "utf8" });
  return sim;
}

/**
 * **A difference between hosts, measured** (exact phase 3; design §7): for
 * each native capture, a cold web drive of the same route at the native
 * screen's size, compared against it with Exact's own `screenshot <png>
 * compare <reference>` — which says, region by region, where they differ
 * and which node and line each region is under — and the web's `tree` and
 * `layout` at that size, so the CLI can tell the app's layout from each
 * platform's own bars.
 */
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
      route: job.route, host: job.host, size: job.size,
      compare: said ? { match: said.compare.match, regions: said.compare.regions ?? [], more: said.compare.more ?? 0 } : null,
      text: said?.text ?? "",
      web: pointsOf(tree, layout),
      ...(said ? {} : { error: (run.stderr || run.stdout).trim().split("\n").slice(-3).join("\n") }),
    });
  }
  return { compares };
}

/**
 * **The root's testId** — the node that carries `navigate=`, where a native
 * drive types a route's path (`type <root> /place/2`), as Exact's iOS recipe
 * says. Read off the app's Contract: the first line with `navigate=` and a
 * `testId`.
 */
let rootTestId;
function rootOf() {
  if (rootTestId !== undefined) return rootTestId;
  const text = existsSync(path.join(app, "app.contract")) ? readFileSync(path.join(app, "app.contract"), "utf8") : "";
  const lines = text.split("\n");
  const at = lines.findIndex((l) => /\bnavigate=/.test(l));
  const near = at >= 0 ? lines.slice(at, at + 3).join(" ") : "";
  rootTestId = /\btestId="([A-Za-z0-9_-]+)"/.exec(near)?.[1] ?? null;
  return rootTestId;
}

/**
 * **One cold drive on a host** (exact phases 1 and 3): the driver's fixed
 * seed, locale, zone and epoch said out loud; the route reached — `--url` on
 * the web, `type <root> <path>` on a native host (a native app has no
 * address bar); then `before` (the screen's own shots), then `after`.
 */
function drive(host, url, before, after, { size, sim, allowFail = false }) {
  const args = driveArgs(host, url, before, after, size);
  const env = host === "ios" ? { EXACT_SIM: sim, EXACT_SHOW_SIMULATOR: "0" } : {};
  return exact(args, { env, allowFail, timeoutMs: host === "web" ? 600_000 : 1_800_000 });
}

/** The `exact.mjs` arguments of one cold drive — what `drive` runs, and what the inspector says an agent can run to print the same. */
function driveArgs(host, url, before, after, size) {
  const fixed = ["--json", "--seed", "1", "--locale", "en-US", "--time-zone", "UTC", "--epoch", "2026-01-01"];
  let args;
  if (host === "web") args = ["agent", "web", ...fixed, "--size", size, "--url", url, "clock data", ...before, ...after];
  else {
    const root = rootOf();
    if (url !== "/" && !root) fail(`a native drive opens ${url} by typing it into the node that carries navigate=, and app.contract names none with a testId`);
    // Joined to a running dev loop when there is one (`--dev-url`, from `isocan exact live`): the native build loads
    // the loop's current generation rather than a plan of its own.
    const dev = flag("--dev-url");
    const joined = dev && /^http:\/\/127\.0\.0\.1:\d+\/?$/.test(dev) ? ["--url", dev] : [];
    args = ["agent", host, ...fixed, ...joined, ...(host === "macos" ? ["--size", size] : []), "clock data", ...(url !== "/" ? [`type ${root} ${url}`, "clock settle"] : []), ...before, ...after];
  }
  return args;
}

/**
 * **Drive mode's one drive** (exact phase 3; design §7): the screen reached as
 * its shots say, then each operation a person sent — a closed list: `tap
 * <testId>` (or `tap "<accessible name>"`), `type <testId> "<text>"`, `back`
 * — each followed by `clock settle`, then a fresh screenshot with its nodes.
 * Replayed whole on a cold driver: Exact prints no resident session to a
 * tool. Both doors run this: the live bridge's `/drive` for a paired browser,
 * and `isocan exact live` for a drive asked for on the canvas (`exact.drive`)
 * by a browser that reaches nothing on this machine.
 */
const DRIVE_OP = /^(?:tap [A-Za-z0-9_.:-]{1,80}|type [A-Za-z0-9_.:-]{1,80} "(?:[^"\\\n\r]|\\.){0,400}"|back)$/;
function driveJob(out, job) {
  const host = job.host ?? "web";
  if (!HOSTS.includes(host)) fail(`a drive runs on ${HOSTS.join(", ")}, not ${JSON.stringify(host)}`);
  let url = null;
  const shots = [];
  for (const raw of String(job.shots ?? "").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("//")) continue;
    const at = /^at\s+"([^"]*)"$/.exec(line);
    if (at && url === null) { url = at[1]; continue; }
    shots.push(line);
  }
  if (!url) fail("a drive starts where the screen's shots say: one at \"<path>\" first");
  checkJob({ host, url, ops: shots, shots: [] });
  const ops = Array.isArray(job.ops) ? job.ops : [];
  if (ops.length > 40 || ops.some((op) => typeof op !== "string" || !DRIVE_OP.test(op))) fail("Drive mode sends tap <testId>, type <testId> \"<text>\" and back — nothing else, and at most 40");
  const size = /^\d{2,4}x\d{2,4}$/.test(job.size ?? "") ? job.size : "390x844";
  const scheme = job.scheme === "dark" ? "dark" : "light";
  const sim = host === "ios" ? simulator([{ host }]) : null;
  const file = path.join(out, "drive.png");
  const tail = [`prefer color-scheme ${scheme}`, ...ops.flatMap((op) => [op, "clock settle"]), "clock settle", `screenshot ${file}`, "tree", "layout", ...(host === "web" ? [] : ["tree --ax"])];
  const started = Date.now();
  const run = drive(host, url, shots, tail, { size, sim, allowFail: true });
  const replies = jsonReplies(run.stdout);
  // The replies before the person's own: reaching the screen, its shots, and the scheme.
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
    ok: run.code === 0 && !!bytes, code: run.code, file: bytes ? file : null, png, points,
    results: ops.map((op, i) => ({ op, reply: replies[before + i * 2] ?? null })),
    ms: Date.now() - started,
    ...(run.code === 0 && bytes ? {} : { error: said || `agent ${host} exited ${run.code}` }),
  };
}

/**
 * **Where a film or an inspection starts** (exact phase 4): a screen's shots
 * (`at "<path>"` first, then the closed list `exact.shots` may carry), the
 * host, its size and scheme — checked as a capture's and a drive's are.
 */
function startOf(job) {
  const host = job.host ?? "web";
  if (!HOSTS.includes(host)) fail(`this runs on ${HOSTS.join(", ")}, not ${JSON.stringify(host)}`);
  let url = null;
  const shots = [];
  for (const raw of String(job.shots ?? "").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("//")) continue;
    const at = /^at\s+"([^"]*)"$/.exec(line);
    if (at && url === null) { url = at[1]; continue; }
    shots.push(line);
  }
  if (!url) fail("it starts where the screen's shots say: one at \"<path>\" first");
  checkJob({ host, url, ops: shots, shots: [] });
  const size = /^\d{2,4}x\d{2,4}$/.test(job.size ?? "") ? job.size : "390x844";
  const scheme = job.scheme === "dark" ? "dark" : "light";
  const sim = host === "ios" ? simulator([{ host }]) : null;
  // The web driver serves the last web build and refuses one older than its sources: build first, as `read` does.
  if (host === "web") exact(["web-build"]);
  return { host, url, shots, size, scheme, sim };
}

/**
 * **Film an interaction against the virtual clock** (exact phase 4; design
 * §8). Two cold drivers at the capture's fixed seed, each reaching the screen
 * as its shots say and doing the same interaction (the closed list Drive mode
 * sends), with the clock still at the moment it ended:
 *
 * 1. the film itself — Exact's own `screenshot <file>.apng over <ms> every
 *    <ms>`: a frame, `clock +every`, a frame … through `over`, written as an
 *    animated PNG (each frame also kept beside it, at full size);
 * 2. the state at each of those moments — `state` (and `layout <watch>`, the
 *    node whose motion is filmed, when one is named) between `clock +every`
 *    steps, so frame i and state i are the same instant on the same clock.
 *
 * Two drivers because the clock only moves forward: one cannot film and then
 * go back to read. Both are deterministic, so their instants agree.
 */
function filmJob(out, job) {
  const { host, url, shots, size, scheme, sim } = startOf(job);
  const ops = Array.isArray(job.ops) ? job.ops : [];
  if (ops.length > 40 || ops.some((op) => typeof op !== "string" || !DRIVE_OP.test(op))) fail("a film's interaction is tap <testId>, type <testId> \"<text>\" and back — nothing else, and at most 40");
  const over = Number(job.over), every = Number(job.every);
  if (!(Number.isInteger(over) && over >= 0 && over <= 10_000 && Number.isInteger(every) && every >= 1 && every <= 1000)) fail("a film is over 0–10000 ms, every 1–1000 ms, whole milliseconds");
  const steps = Math.floor(over / every) + 1;
  if (steps > 240) fail(`over ${over} every ${every} is ${steps} frames; Exact films at most 240`);
  const watch = job.watch === undefined || job.watch === null ? null : String(job.watch);
  if (watch !== null && !/^[A-Za-z0-9_.:-]{1,80}$/.test(watch)) fail(`--watch names a node by its testId, not ${JSON.stringify(watch)}`);
  const file = path.join(out, "film.apng");
  // Each op's own `clock settle` would move the clock past the motion the op starts: the interaction's last op is
  // followed by nothing, so the film's first frame is the instant it ended.
  const interaction = ops.flatMap((op, i) => (i < ops.length - 1 ? [op, "clock settle"] : [op]));
  const lead = [`prefer color-scheme ${scheme}`, "clock settle", ...interaction];
  const started = Date.now();
  const filmed = drive(host, url, shots, [...lead, `screenshot ${file} over ${over} every ${every}`], { size, sim, allowFail: true });
  const filmMs = Date.now() - started;
  const replies = jsonReplies(filmed.stdout);
  const told = replies.find((r) => r.form === "animated" || r.frames !== undefined && r.screenshot === file) ?? null;
  const bytes = existsSync(file) ? readFileSync(file) : null;
  const said = (run) => (run.stderr || run.stdout).trim().split("\n").filter((l) => !l.startsWith("{")).slice(-4).join("\n");
  if (!bytes || filmed.code !== 0) return { ok: false, error: said(filmed) || `agent ${host} exited ${filmed.code}`, ms: filmMs };
  // The state at each frame's instant: state (and the watched node's layout), then the clock, frame by frame.
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
      ...(watch ? { watch: node ? watchedOf(node) : null } : {}),
    });
  }
  return {
    ok: true,
    file, sha256: sha256(bytes), bytes: bytes.length, png: pngSize(bytes),
    host, url, size, scheme, ops, over, every, steps,
    frames: told?.frames ?? null, at: told?.at ?? null, form: told?.form ?? null,
    clock: clocks.length ? clocks.at(-1).clock : null,
    states: frames,
    ...(states.length === steps ? {} : { stateError: `state answered ${states.length} of ${steps} frames: ${said(stated)}` }),
    ms: { film: filmMs, state: Date.now() - stateStarted },
  };
}

/** What a filmed node's `layout` says about its motion: where it is, and the values that animate. */
function watchedOf(node) {
  const style = {};
  for (const key of ["translate", "scale", "rotate", "opacity"]) {
    const v = node.style?.[key]?.computed;
    if (v !== undefined) style[key] = v;
  }
  const box = node.space?.viewport ?? null;
  return { testId: node.testId ?? node.props?.testId ?? null, box: box ? { x: box.x, y: box.y, w: box.w, h: box.h } : null, style, visible: node.visible ? { inViewport: node.visible.inViewport, clipped: node.visible.clipped, hidden: node.visible.hidden } : null };
}

/**
 * **The inspector's facts for one screen** (exact phase 4; design §8): a
 * cold driver at the capture's fixed seed, the screen reached as its shots
 * say, then `tree --ax`, `layout`, `perf` and `logs` — printed by the driver,
 * passed on unchanged. Exact holds no resident session a tool can keep
 * (phase 3), so every inspection is its own cold run.
 */
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
    ok, host, url, size, scheme, shots,
    // The command an agent runs to print the same tree: the proof compares the two.
    command: driveArgs(host, url, shots, [`prefer color-scheme ${scheme}`, "clock settle", "tree --ax"], size),
    ax, layout, perf, logs,
    ms: Date.now() - started,
    ...(ok ? {} : { error: (run.stderr || run.stdout).trim().split("\n").filter((l) => !l.startsWith("{")).slice(-4).join("\n") || `agent ${host} exited ${run.code}` }),
  };
}

/**
 * **A test, run on a host, as a storyboard** (exact phase 5; design §9).
 * Exact's own `test <host>` runs a copy of the one test with a `screenshot`
 * after every step (and one before the first), so the verdict and each
 * failure's words are Exact's and every step has the frame it acted on. When
 * it fails, a cold `agent <host> --json` replays the steps before the failing
 * one — one reply an operation — and prints the `tree` there, then sends the
 * failing step itself, whose reply says why in the driver's words.
 */
const TEST_FILE = /^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,80}\.test\.contract$/;
const LAUNCH_STEPS = new Set(["at", "size", "seed", "locale", "time-zone", "epoch", "format-locale", "before-data", "fresh", "prefer", "fail-fetch"]);
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
  try { tests = JSON.parse(compiled.stdout).tests; } catch { fail(`\`contract test ${job.file}\` did not compile:\n${(compiled.stderr || compiled.stdout).trim().split("\n").slice(-4).join("\n")}`); }
  const t = tests.find((x) => x.name === job.test);
  if (!t) fail(`${job.file} has no test named ${JSON.stringify(job.test)}`);
  // One line a step: a step the compiler gave the line of a step before it is a block, which a storyboard does not draw.
  const seen = new Set();
  for (const st of t.steps) { if (seen.has(st.line)) fail(`line ${st.line} of ${job.file} holds more than one step; a storyboard draws a test one line a step`); seen.add(st.line); }
  let lead = 0;
  while (lead < t.steps.length && LAUNCH_STEPS.has(t.steps[lead].op)) lead++;
  const shot = (i) => path.join(out, `f-${i}.png`);
  const copy = [`test ${JSON.stringify(t.name)}`];
  const lineOf = new Map(); // the copy's line → the step's index
  for (let k = 0; k < lead; k++) { copy.push(`  ${(lines[t.steps[k].line - 1] ?? "").trim()}`); lineOf.set(copy.length, k); }
  copy.push(`  screenshot ${JSON.stringify(shot(0))}`);
  for (let k = lead; k < t.steps.length; k++) {
    copy.push(`  ${(lines[t.steps[k].line - 1] ?? "").trim()}`);
    lineOf.set(copy.length, k);
    copy.push(`  screenshot ${JSON.stringify(shot(k - lead + 1))}`);
  }
  const file = path.join(out, "storyboard.test.contract");
  writeFileSync(file, `${copy.join("\n")}\n`);
  const env = host === "ios" ? { EXACT_SIM: sim, EXACT_SHOW_SIMULATOR: "0" } : {};
  const ran = exact(["test", host, ...(sim ? ["--sim", sim] : []), file], { allowFail: true, env, timeoutMs: host === "web" ? 600_000 : 1_800_000 });
  const all = `${ran.stdout}\n${ran.stderr}`.split("\n");
  const head = all.find((l) => l.startsWith(`test ${JSON.stringify(t.name)}:`) || l.startsWith(`test "${t.name}":`)) ?? null;
  const verdict = !head ? "error" : / ok$/.test(head) ? "ok" : /: FAIL$/.test(head) ? "fail" : /skipped/.test(head) ? "skipped" : "error";
  const prefix = `  ${t.name}: `;
  const failures = all.filter((l) => l.startsWith(prefix)).map((l) => l.slice(prefix.length));
  // Exact names the copy's lines; the storyboard says the file's.
  const fileLine = (n) => { const k = lineOf.get(n); return k === undefined ? null : t.steps[k].line; };
  const said = [head, ...all.filter((l) => l.startsWith(prefix) || l.startsWith("  note: "))].filter(Boolean)
    .map((l) => l.trim().replace(/: line (\d+): /, (m, n) => (fileLine(Number(n)) ? `: ${job.file}:${fileLine(Number(n))}: ` : m)));
  const frameOf = (i) => { const f = shot(i); if (!existsSync(f)) return null; return { sha256: sha256(readFileSync(f)), file: f }; };
  // Each failure names a line of the copy: the step there.
  const failing = new Map();
  let first = null;
  for (const msg of failures) {
    const m = /^line (\d+): ([\s\S]*)$/.exec(msg);
    const k = m ? lineOf.get(Number(m[1])) : undefined;
    if (k === undefined) { first ??= { k: null, reason: msg }; continue; }
    if (!failing.has(k)) failing.set(k, m[2]);
    first ??= { k, reason: m[2] };
  }
  const steps = t.steps.map((st, k) => {
    const frame = k < lead ? null : frameOf(k - lead);
    const after = k < lead ? (verdict === "ok" || existsSync(shot(0))) : existsSync(shot(k - lead + 1));
    return { line: st.line, state: failing.has(k) ? "fail" : (verdict === "ok" || after) ? "ok" : "unreached", frame };
  });
  let failed = null;
  if (verdict !== "ok" && verdict !== "skipped") {
    const k = first?.k ?? null;
    const replay = k === null ? null : treeAt(host, t.steps, lead, k, frameOf(0), sim);
    failed = {
      line: k === null ? null : t.steps[k].line,
      reason: first?.reason ?? (verdict === "error" ? (ran.stderr || ran.stdout).trim().split("\n").filter((l) => !l.startsWith("{")).slice(-3).join("\n") || `exact.mjs test exited ${ran.code}` : "the test failed"),
      frame: k === null ? null : (k < lead ? null : frameOf(k - lead)),
      tree: replay?.tree ?? null,
      reply: replay?.reply ?? (replay?.note ? { note: replay.note } : null),
    };
  }
  return {
    ok: verdict !== "error", host, file: job.file, test: t.name, verdict, said, steps, failed,
    end: verdict === "ok" ? frameOf(t.steps.length - lead) : null,
    ms: Date.now() - started,
    ...(verdict === "error" ? { error: failed?.reason ?? "the test did not run" } : {}),
  };
}

/** A compiled step as a driver operation, or null for a read (an expect), or undefined for one a replay cannot send. */
function stepOp(st) {
  const q = (v) => (/^[A-Za-z0-9_.:-]+$/.test(String(v)) ? String(v) : JSON.stringify(String(v)));
  if (st.op === "tap" && (st.form ?? "press") === "press" && st.target) return `tap ${q(st.target)}`;
  if (st.op === "type" && st.target && typeof st.text === "string" && !st.append) return `type ${q(st.target)} ${JSON.stringify(st.text)}`;
  if (st.op === "clock" && typeof st.arg === "string") return `clock ${st.arg}`;
  if (st.op === "back") return "back";
  if (st.op.startsWith("expect-")) return null;
  return undefined;
}

/** The driver's `tree` just before step `k`, from a cold replay of the steps before it; then step `k` itself, for its reply. */
function treeAt(host, steps, lead, k, frame0, sim) {
  const at = steps.slice(0, lead).find((s) => s.op === "at");
  const url = typeof at?.value === "string" ? at.value : "/";
  if (steps.slice(0, lead).some((s) => s.op !== "at")) return { note: "the tree is read by a replay, which takes a test whose only launch line is at" };
  const ops = [];
  for (const st of steps.slice(lead, k)) {
    const op = stepOp(st);
    if (op === undefined) return { note: `the tree is read by a replay of tap, type, clock and back; line ${st.line} is ${st.op}` };
    if (op) ops.push(op);
  }
  const failing = k >= lead ? stepOp(steps[k]) : null;
  const size = (() => { if (!frame0?.file) return "390x844"; const p = pngSize(readFileSync(frame0.file)); return p ? `${p.width}x${p.height}` : "390x844"; })();
  const tail = ["tree", ...(failing ? [failing] : [])];
  let args;
  if (host === "web") args = ["agent", "web", "--json", "--size", size, ...(url !== "/" ? ["--url", url] : []), "clock data", ...ops, ...tail];
  else {
    const root = rootOf();
    if (url !== "/" && !root) return { note: `a native replay opens ${url} by typing it into the node that carries navigate=, and app.contract names none` };
    args = ["agent", host, "--json", "clock data", ...(url !== "/" ? [`type ${root} ${url}`, "clock settle"] : []), ...ops, ...tail];
  }
  const run = exact(args, { allowFail: true, env: host === "ios" ? { EXACT_SIM: sim, EXACT_SHOW_SIMULATOR: "0" } : {}, timeoutMs: host === "web" ? 600_000 : 1_800_000 });
  const replies = jsonReplies(run.stdout);
  const tree = replies.find((r) => Array.isArray(r.nodes) && !r.env) ?? null;
  // The failing step's own reply — or, where the driver stopped on it, what it said as it stopped.
  const last = replies.at(-1) ?? null;
  const stopped = (run.stderr || "").trim().split("\n").filter((l) => l && !l.startsWith("{")).slice(-2).join(" ");
  const reply = !failing ? null : last && last !== tree ? last : { error: stopped || `agent ${host} exited ${run.code}` };
  // What a person could see there: the shown nodes (a covered screen's are hidden), else all of them.
  const shown = tree ? tree.nodes.filter((n) => !n.hidden && !n.inactive) : [];
  const rows = tree ? (shown.length ? shown : tree.nodes).slice(0, 240).map((n) => ({
    depth: n.depth ?? 0, type: n.type,
    ...(n.props?.testId ? { testId: n.props.testId } : {}),
    ...(typeof n.props?.text === "string" ? { text: n.props.text.slice(0, 80) } : {}),
    ...(typeof n.props?.accessibilityLabel === "string" ? { label: n.props.accessibilityLabel.slice(0, 80) } : typeof n.props?.["aria-label"] === "string" ? { label: n.props["aria-label"].slice(0, 80) } : {}),
    ...(n.hidden ? { hidden: true } : {}), ...(n.inactive ? { inactive: true } : {}),
  })) : null;
  return { tree: rows, reply, ...(rows ? {} : { note: (run.stderr || run.stdout).trim().split("\n").filter((l) => !l.startsWith("{")).slice(-2).join(" ") || "the replay printed no tree" }) };
}

/**
 * **What a recording changed** (exact phase 5; design §9): a cold driver at
 * the drive's start (its shots), the presses made before Record, `state`,
 * then the recorded presses each followed by `clock settle`, and `state`
 * again. The module proposes `expect` lines from the difference; nothing is
 * written here or anywhere.
 */
function recordJob(job) {
  const { host, url, shots, size, scheme, sim } = startOf(job);
  const ok = (list) => Array.isArray(list) && list.length <= 40 && list.every((op) => typeof op === "string" && DRIVE_OP.test(op));
  if (!ok(job.before ?? []) || !ok(job.ops) || job.ops.length === 0) fail("a recording is tap <testId>, type <testId> \"<text>\" and back — nothing else, at most 40, and at least one");
  const press = (list) => list.flatMap((op) => [op, "clock settle"]);
  const started = Date.now();
  const run = drive(host, url, shots, [`prefer color-scheme ${scheme}`, "clock settle", ...press(job.before ?? []), "state", ...press(job.ops), "clock settle", "state"], { size, sim, allowFail: true });
  const states = jsonReplies(run.stdout).filter((r) => r.slots && typeof r.slots === "object");
  if (run.code !== 0 || states.length < 2) return { ok: false, ms: Date.now() - started, error: (run.stderr || run.stdout).trim().split("\n").filter((l) => !l.startsWith("{")).slice(-4).join("\n") || `agent ${host} exited ${run.code}` };
  const pick = (s) => ({ slots: s.slots ?? null, derives: s.derives ?? null });
  return { ok: true, host, url, before: pick(states[0]), after: pick(states.at(-1)), ms: Date.now() - started };
}

/**
 * **Exact's `verify` on a host** (exact phase 5; design §9): its tests, its
 * `check` light and dark at two sizes, the largest text and a relaunch, as
 * one `--json` report. Passed on whole, with each screenshot's digest; the
 * CLI decides which canvas screen each one shows.
 */
function verifyJob() {
  const host = flag("--host") ?? "web";
  if (!["web", "ios"].includes(host)) fail(`verify has legs for the web and iOS on this machine, not ${JSON.stringify(host)} (Exact: macOS "verify has no leg for it")`);
  const sim = host === "ios" ? simulator([{ host }]) : null;
  const started = Date.now();
  const run = exact(["verify", host, "--json", ...(sim ? ["--sim", sim] : [])], { allowFail: true, env: sim ? { EXACT_SIM: sim, EXACT_SHOW_SIMULATOR: "0" } : {}, timeoutMs: 1_800_000 });
  let report = null;
  try { report = JSON.parse(run.stdout.trim().split("\n").filter((l) => l.startsWith("{")).at(-1) ?? "null"); } catch { /* not JSON */ }
  if (!report) return { ok: false, host, exit: run.code, ms: Date.now() - started, error: (run.stderr || run.stdout).trim().split("\n").slice(-4).join("\n") || `verify exited ${run.code}` };
  const shots = [];
  for (const c of report.checks ?? []) {
    if (typeof c.shot !== "string" || !existsSync(c.shot) || shots.some((s) => s.file === c.shot)) continue;
    const bytes = readFileSync(c.shot);
    shots.push({ file: c.shot, sha256: sha256(bytes), screen: c.screen, size: c.size, scheme: c.scheme, png: pngSize(bytes) });
  }
  return {
    ok: true, host, exit: run.code, problems: report.problems ?? null,
    tests: report.tests ? { passed: report.tests.passed ?? 0, failed: report.tests.failed ?? 0, failing: (report.tests.results ?? []).filter((t) => t.failures?.length).map((t) => ({ name: t.name, file: t.file, failures: t.failures })) } : null,
    shots, ms: Date.now() - started,
  };
}

/**
 * **Where each visible node of a capture is, and which line drew it** (exact
 * phase 2; design §5: with live frames off, pointing still works on
 * captures). The driver's `layout` gives every node's box joined to the
 * source map; `tree` says which are hidden (a stack's covered screen keeps
 * its boxes). Each style a node is named with (`class=Price`) is read off
 * the line the map points at. Files are named relative to the app, with
 * their digest, so a comment made on a capture carries `exact.source`.
 */
const fileText = new Map();
function pointsOf(tree, layout, ax = null) {
  if (!tree || !layout) return null;
  const hidden = new Set(tree.nodes.filter((n) => n.hidden || n.inactive).map((n) => n.id));
  const rel = (file) => (typeof file === "string" && file.startsWith(app + path.sep) ? path.relative(app, file) : null);
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
      x: Math.round(n.x), y: Math.round(n.y), w: Math.round(n.w), h: Math.round(n.h), type: n.type, ...(n.testId ? { testId: n.testId } : {}),
      file, line: m.line, col: m.col, component: m.component ?? null,
      chain: (m.chain ?? []).map((c) => ({ file: rel(c.file) ?? c.file, line: c.line, col: c.col, component: c.component ?? null })),
      ...(cls.length ? { classes: cls } : {}),
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

/**
 * **The controls the platform draws for the app** (exact phase 3): a native
 * host puts some of the app's own controls in its bars — a header button is
 * a UIKit bar button, a tab a tab-bar button — where `layout` gives them no
 * box. Its accessibility tree (`tree --ax`) does: each such element's frame,
 * joined back to the app's node by its accessible name, so a press there
 * presses that node by its testId, and pointing names its line.
 */
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


/**
 * **One cold driver per screen** (phase 0's form, kept for its callers): a
 * fresh `agent web` for each URL at one size.
 */
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
      "agent", "web", "--size", size, "--seed", "1", "--locale", "en-US", "--time-zone", "UTC", "--epoch", "2026-01-01",
      "--url", url, "clock data", "clock settle", `screenshot ${file}`,
    ]);
    if (!existsSync(file)) fail(`agent web wrote no screenshot for ${url}:\n${run.stdout.trim().split("\n").slice(-4).join("\n")}`);
    shots.push({ url, file, sha256: sha256(readFileSync(file)), ms: run.ms });
  }
  return { size, shots };
}

/**
 * **What the compiler says, and where** (exact phase 2; design §6): `contract
 * build --json` (each diagnostic with its id, file and range; `app.ts`'s type
 * errors appended), and `contract symbols` — which still answers when the
 * build does not — with the Contract sources and each file's digest, so the
 * CLI can say which screens a broken line draws and pin the comment there.
 */
function diagnose() {
  const build = exact(["contract", "build", "app.contract", "--json"], { allowFail: true });
  let diagnostics;
  try {
    diagnostics = JSON.parse(build.stdout.trim().split("\n").filter((l) => l.startsWith("[")).at(-1) ?? "null");
  } catch { diagnostics = null; }
  if (!Array.isArray(diagnostics)) fail(`\`contract build --json\` printed no diagnostics list (exit ${build.code}):\n${(build.stderr || build.stdout).trim().split("\n").slice(-4).join("\n")}`);
  const sym = exact(["contract", "symbols", "app.contract"], { allowFail: true });
  let symbols = null;
  try { symbols = JSON.parse(sym.stdout); } catch { /* a file that does not parse names nothing */ }
  const sources = {};
  const digests = {};
  const files = new Set(["app.contract", ...diagnostics.map((d) => d.file), ...(symbols?.definitions ?? []).map((d) => d.file)]);
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

/**
 * **`agent check both` per route** (exact phase 2; design §6): clipping,
 * overlap, contrast and small targets, light and dark, at the phone size,
 * from a cold driver at the capture's fixed seed — one per path asked.
 */
function check() {
  const out = [];
  for (const url of flags("--url")) {
    checkJob({ url, ops: [], shots: [] });
    const run = exact(["agent", "web", "--json", "--size", "390x844", "--seed", "1", "--locale", "en-US", "--time-zone", "UTC", "--epoch", "2026-01-01", "--url", url, "clock data", "clock settle", "check both"], { allowFail: true });
    let found = null;
    for (const line of run.stdout.split("\n")) {
      if (!line.startsWith("{")) continue;
      try { const v = JSON.parse(line); if (Array.isArray(v.check)) found = v.check; } catch { /* not a reply */ }
    }
    if (!found) fail(`agent check on ${url} answered nothing (exit ${run.code}):\n${(run.stderr || run.stdout).trim().split("\n").slice(-4).join("\n")}`);
    out.push({ url, check: found, ms: run.ms });
  }
  return { checks: out };
}

// ---------------------------------------------------------------- proposals (exact phase 6; design §10)

/**
 * **The operations a proposal may carry** — a closed list of Tamber's own
 * (`docs/tamber-protocol.md`, Operations): a token's value, a row of a style
 * or at a place, a state part's row. Anything else is refused before the wire
 * sees it: these come off a canvas, from whoever asked.
 */
const PROPOSAL_OPS = new Set(["set-token", "set-row", "set-state"]);
function checkProposalOps(ops) {
  if (!Array.isArray(ops) || ops.length === 0 || ops.length > 32) fail("a proposal carries one to 32 operations");
  for (const op of ops) {
    if (!op || typeof op !== "object" || !PROPOSAL_OPS.has(op.op)) fail(`a proposal's operation is one of ${[...PROPOSAL_OPS].join(", ")}, not ${JSON.stringify(op?.op)}`);
    for (const [k, v] of Object.entries(op)) {
      if (!["op", "name", "value", "when", "style", "row", "state", "file", "at", "sha256", "comment"].includes(k)) fail(`a proposal's ${op.op} carries no field ${JSON.stringify(k)}`);
      if (typeof v === "string" && (v.length > 400 || /[\n\r\0]/.test(v))) fail(`a proposal's ${op.op}.${k} is one short line`);
    }
    if (op.file !== undefined && (typeof op.file !== "string" || op.file.startsWith("/") || op.file.includes(".."))) fail(`a proposal names a file of the app, not ${JSON.stringify(op.file)}`);
  }
}

/** The dev loop's Tamber wire, through its local token (loopback only): the person's own bridge, `write`. */
async function wireOf() {
  const dev = flag("--dev-url");
  if (!dev || !/^http:\/\/127\.0\.0\.1:\d+\/?$/.test(dev)) fail("a proposal is held by the dev loop's Tamber wire, and this `isocan exact live` runs no dev loop — start it without --no-frames");
  const base = dev.replace(/\/$/, "");
  let token = null;
  try { const r = await fetch(`${base}/__tamber/token`, { redirect: "error" }); if (r.ok) token = (await r.json()).token; } catch { /* no wire */ }
  if (!token) fail(`the dev loop at ${base} mounts no Tamber wire (an app with no app.tamber has none)`);
  const ask = async (body, tok = token) => {
    const r = await fetch(`${base}/__tamber`, { method: "POST", headers: { "content-type": "application/json", "x-exact-tamber-token": tok }, body: JSON.stringify(body) });
    return { status: r.status, answer: await r.json().catch(() => null) };
  };
  return { base, token, ask };
}

/** The wire's refusal in words: its message, and the checker's first diagnostics (which row, and why). */
const wireError = (r) => {
  const e = r.answer?.error;
  if (!e) return `the wire answered ${r.status}`;
  const diags = Array.isArray(e.diagnostics) ? e.diagnostics.slice(0, 3).map((d) => `${d.file}:${d.line}:${d.col} ${d.message}`) : [];
  return [e.message ?? JSON.stringify(e).slice(0, 300), ...diags].join(" — ");
};

/** Wait, in a script that has nothing else to do meanwhile. */
function idle(ms) { return new Promise((r) => setTimeout(r, ms)); }

/** `{url, ops}` from a screen's shots, checked as a capture's are. */
function whereOf(shotsText) {
  let url = null;
  const ops = [];
  for (const raw of String(shotsText ?? "").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("//")) continue;
    const at = /^at\s+"([^"]*)"$/.exec(line);
    if (at && url === null) { url = at[1]; continue; }
    ops.push(line);
  }
  if (!url) fail("a preview starts where the screen's shots say: one at \"<path>\" first");
  checkJob({ host: "web", url, ops, shots: [] });
  return { url, ops };
}

/**
 * **A live-class proposal, previewed as a scrub** (exact phase 0, fact 3: a
 * held proposal does not render; a scrub does, writing nothing). One session
 * per host, each joined to the dev loop — the web page at the loop's address,
 * the iOS app with `--url <loop>` — so both are builds on the loop's live
 * table. Each scheme in turn: every device pictured, then the scrub opened
 * with the proposal's operations and every device pictured again, then
 * `scrub-cancel` and every device pictured a third time. The sessions wait on
 * `clock +N real until <file>`, Exact's own harness signal, between the three.
 *
 * Measured 14 Nov 2026 (Exact cbe553f6): on iOS a `prefer color-scheme` while
 * a scrub is open drops the scrub's frame, so each scheme opens its own scrub.
 */
async function scrubPreview(wire, out, job, files, sim) {
  const where = whereOf(job.shots);
  const devices = (job.devices ?? []).filter((d) => /^\d{2,4}x\d{2,4}$/.test(d.size ?? ""));
  const schemes = (job.schemes ?? ["light", "dark"]).filter((s) => s === "light" || s === "dark");
  const hosts = ["web", ...(job.ios && sim ? ["ios"] : [])];
  const client = "isocan-preview";
  const presence = new AbortController();
  fetch(`${wire.base}/__tamber/subscribe`, { method: "POST", headers: { "content-type": "application/json", "x-exact-tamber-token": wire.token }, body: JSON.stringify({ client }), signal: presence.signal }).catch(() => {});
  const signal = (s, which) => path.join(out, `go-${s}-${which}`);
  const shot = (host, device, s, phase) => path.join(out, `${host}-${device}-${s}-${phase}.png`);
  const iosDevice = "phone";
  const phaseOps = (host, s, phase) => host === "web"
    ? devices.flatMap((d) => [`resize ${d.size}`, "clock settle", `screenshot ${shot("web", d.device, s, phase)}`])
    : ["clock settle", `screenshot ${shot("ios", iosDevice, s, phase)}`];
  const tail = (host) => schemes.flatMap((s) => [
    `prefer color-scheme ${s}`,
    ...phaseOps(host, s, "before"), `clock +600000 real until ${signal(s, "on")}`,
    ...phaseOps(host, s, "during"), `clock +600000 real until ${signal(s, "off")}`,
    ...phaseOps(host, s, "after"),
  ]);
  const fixed = ["--json", "--seed", "1", "--locale", "en-US", "--time-zone", "UTC", "--epoch", "2026-01-01"];
  const kids = {};
  const start = (host, args, env) => {
    const child = spawn("/bin/sh", [launcher, "agent", host, ...args], { cwd: app, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"], detached: true });
    let said = "";
    child.stdout.on("data", (d) => { said = (said + d).slice(-6000); });
    child.stderr.on("data", (d) => { said = (said + d).slice(-6000); });
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
      start("ios", [...fixed, "--url", wire.base, "clock data", ...(where.url !== "/" ? [`type ${root} ${where.url}`, "clock settle"] : []), ...where.ops, ...tail("ios")], { EXACT_SIM: sim, EXACT_SHOW_SIMULATOR: "0" });
    }
    const files_ = (s, phase) => hosts.flatMap((h) => (h === "web" ? devices.map((d) => shot("web", d.device, s, phase)) : [shot("ios", iosDevice, s, phase)]));
    const until = async (paths, what, ms) => {
      const t0 = Date.now();
      let kept = Date.now();
      while (!paths.every((p) => existsSync(p))) {
        for (const h of hosts) if (kids[h].child.exitCode !== null) throw new Error(`the ${h} preview ended before ${what}: ${kids[h].said().trim().split("\n").filter((l) => !l.startsWith("{")).slice(-3).join(" | ")}`);
        if (Date.now() - t0 > ms) throw new Error(`no ${what} after ${Math.round(ms / 1000)} s`);
        // A scrub with no update for 30 s ends itself: the same frame again keeps it open while the pictures are taken.
        if (scrubId && Date.now() - kept > 10_000) { kept = Date.now(); await wire.ask({ method: "scrub", client, ops: job.ops, files, scrub: scrubId }); }
        await idle(250);
      }
      await idle(400); // the file is written; let the driver close it
    };
    for (const s of schemes) {
      await until(files_(s, "before"), `the ${s} pictures before`, 900_000);
      const opened = await wire.ask({ method: "scrub", client, ops: job.ops, files });
      if (!opened.answer?.ok) throw new Error(`the scrub was refused: ${wireError(opened)}`);
      scrubId = opened.answer.ok.scrub;
      await idle(2500);
      writeFileSync(signal(s, "on"), "");
      await until(files_(s, "during"), `the ${s} pictures with the proposal`, 300_000);
      const cancelled = await wire.ask({ method: "scrub-cancel", client, scrub: scrubId });
      scrubId = null;
      if (!cancelled.answer?.ok) errors.push(`scrub-cancel answered ${cancelled.status}: ${wireError(cancelled)}`);
      await idle(2500);
      writeFileSync(signal(s, "off"), "");
      await until(files_(s, "after"), `the ${s} pictures after the scrub`, 300_000);
    }
    for (const h of hosts) await Promise.race([kids[h].done, idle(30_000)]);
  } catch (err) {
    errors.push(err.message);
  } finally {
    if (scrubId) await wire.ask({ method: "scrub-cancel", client, scrub: scrubId }).catch(() => {});
    presence.abort();
    for (const k of Object.values(kids)) { try { process.kill(-k.child.pid, "SIGTERM"); } catch { /* gone */ } }
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

/**
 * **A rebuild-class proposal, previewed in a staged copy** (Exact Design's
 * fallback; design §10). The app's own files are only read: a staging
 * directory of this bridge's own — one per app, kept between previews so its
 * native build is reused (a cloned `target` is refused by Exact: a build knows
 * the directory it was made in) — is made the app's sources as they are now
 * and pictured cold, as `open` pictures a screen; then the proposal's texts —
 * what `propose` with `texts` said it would write — are written into it,
 * compiled with `--json --errors-only`, and pictured again. The first iOS
 * picture there builds the app once (about two minutes, measured 14 Nov 2026);
 * later ones re-bake the plan.
 */
async function stagedPreview(out, job, texts, sim) {
  const where = whereOf(job.shots);
  const devices = (job.devices ?? []).filter((d) => /^\d{2,4}x\d{2,4}$/.test(d.size ?? ""));
  const schemes = (job.schemes ?? ["light", "dark"]).filter((s) => s === "light" || s === "dark");
  const self = new URL(import.meta.url).pathname;
  const errors = [];
  const staging = path.join(os.tmpdir(), "isocan-exact-staging", sha256(app).slice(0, 12));
  mkdirSync(staging, { recursive: true });
  // The app's sources as they are now; the staging directory's own build state (target, .exact) is left as it is.
  const sync = spawnSync("rsync", ["-a", "--delete", "--exclude", "/target", "--exclude", "/.exact", "--exclude", "/node_modules", `${app}/`, `${staging}/`], { encoding: "utf8" });
  if (sync.status !== 0) fail(`could not stage the app's sources: ${(sync.stderr || "").trim()}`);
  const jobs = [{ host: "web", url: where.url, ops: where.ops, shots: devices.flatMap((d) => schemes.map((s) => ({ size: d.size, scheme: s }))) }];
  if (job.ios && sim) jobs.push({ host: "ios", url: where.url, ops: where.ops, shots: schemes.map((s) => ({ size: "402x874", scheme: s })) });
  const launcherIn = path.join(staging, "exact.mjs");
  // The staging copy's own web dist, apart from the app's captures'.
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
        try { diags = JSON.parse((built.stdout || "[]").trim().split("\n").filter((l) => l.startsWith("[")).at(-1) ?? "[]"); } catch { /* none read */ }
        const bad = diags.filter((d) => !d.severity || d.severity === "error");
        if (built.status !== 0 || bad.length) return { how: "staged", previews: [], errors: [`the proposed text does not build: ${bad[0] ? `${bad[0].file}:${bad[0].line}:${bad[0].col} ${bad[0].message}` : (built.stderr || "").trim().split("\n").at(-1)}`] };
      }
    }
    // The web driver serves the last web build of the directory it runs in.
    const wb = spawnSync("/bin/sh", [launcherIn, "web-build"], { cwd: staging, encoding: "utf8", maxBuffer: 64 << 20, timeout: 600_000, env: stagedEnv });
    if (wb.status !== 0) { errors.push(`web-build in the staged copy (${side}) failed: ${(wb.stderr || wb.stdout || "").trim().split("\n").at(-1)}`); continue; }
    const jobsFile = path.join(out, `jobs-${side}.json`), rep = path.join(out, `capture-${side}.json`), shots = path.join(out, side);
    writeFileSync(jobsFile, JSON.stringify(jobs));
    const run = spawnSync(process.execPath, [self, "capture", "--app", staging, "--report", rep, "--dir", shots, "--jobs", jobsFile, ...(sim ? ["--sim", sim] : [])], { encoding: "utf8", maxBuffer: 64 << 20, timeout: 1_800_000, env: stagedEnv });
    if (run.status !== 0 || !existsSync(rep)) { errors.push(`the staged copy's capture (${side}) failed: ${(run.stderr || "").trim().split("\n").slice(-2).join(" | ")}`); continue; }
    pictures[side] = JSON.parse(readFileSync(rep, "utf8")).shots;
  }
  const previews = [];
  for (const a of pictures.after ?? []) {
    const b = (pictures.before ?? []).find((x) => x.job === a.job && x.index === a.index);
    if (!b) continue;
    const device = a.host === "web" ? (devices.find((d) => d.size === a.size)?.device ?? a.size) : "phone";
    previews.push({ host: a.host, device, scheme: a.scheme, before: b.file, after: a.file, beforeSha256: b.sha256, afterSha256: a.sha256, png: a.png, restored: null });
  }
  return { how: "staged", previews, errors };
}

/** A client of the wire's own, paired by the local token at `scope` (never `write`): Tamber's pairing, as a remote one. */
async function pairedClient(wire, scope, name) {
  const code = await wire.ask({ method: "pair-code", scope, name });
  if (!code.answer?.ok?.code) return { error: `pair-code: ${wireError(code)}` };
  const pr = await fetch(`${wire.base}/__tamber/pair`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: code.answer.ok.code, name }) });
  const paired = await pr.json().catch(() => null);
  const p = paired?.ok ?? paired;
  if (!p?.token) return { error: `pair: ${pr.status} ${JSON.stringify(paired).slice(0, 200)}` };
  if (p.scope !== scope) return { error: `the wire paired this client at ${p.scope}, not ${scope}` };
  return { token: p.token, client: p.client };
}

/**
 * **A proposal, held and pictured** (exact phase 6; design §10). The asker's
 * scope is the CLI's to say — `propose` for an agent, `write` for a person who
 * may edit the canvas — and the wire enforces it: an agent's proposal is sent
 * with a token of its own, paired at `propose` scope, which the wire refuses
 * an `accept` (asked once here, and the 403 recorded). Then the preview, by
 * the class the wire gave it: a scrub, or staged copies. Nothing is written
 * to the app: only a person's Keep, through `accept`, does that.
 */
async function proposeJob(out, job) {
  mkdirSync(out, { recursive: true });
  checkProposalOps(job.ops);
  if (!["read", "propose", "write"].includes(job.scope)) fail(`a proposal's scope is read, propose or write, not ${JSON.stringify(job.scope)}`);
  const name = String(job.name ?? "someone").replace(/[^A-Za-z0-9_.-]+/g, "-").slice(0, 40) || "someone";
  const started = Date.now();
  const wire = await wireOf();
  const hello = await wire.ask({ method: "hello" });
  if (!hello.answer?.ok) return { ok: false, error: `hello: ${wireError(hello)}` };
  const files = hello.answer.ok.files;
  let token = wire.token, client = `person:${name}`, scopeCheck = null;
  if (job.scope !== "write") {
    // Tamber's own pairing, minted by the local token: a client of its own, at the asker's scope (`propose` for an
    // agent, `read` for a person this machine's owner has not granted write: exact phase 8), never `write`.
    const p = await pairedClient(wire, job.scope, `isocan-${name}`);
    if (p.error) return { ok: false, error: p.error };
    token = p.token;
    client = p.client;
  }
  const held = await wire.ask({ method: "propose", ops: job.ops, files, hold: true, client, texts: true }, token);
  if (!held.answer?.ok) return { ok: false, scope: job.scope, client, scopeCheck: held.status === 403 ? { status: 403, scope: held.answer?.error?.scope ?? null, needs: held.answer?.error?.needs ?? null, message: wireError(held) } : null, error: `the wire refused the proposal: ${wireError(held)}`, diagnostics: held.answer?.error?.diagnostics ?? null };
  const plan = held.answer.ok;
  if (job.scope === "propose") {
    const tried = await wire.ask({ method: "accept", proposal: plan.proposal, client }, token);
    scopeCheck = { status: tried.status, scope: tried.answer?.error?.scope ?? null, needs: tried.answer?.error?.needs ?? null, message: wireError(tried) };
  }
  const sim = job.ios ? (flag("--sim") && /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i.test(flag("--sim")) ? simulator([{ host: "ios" }]) : null) : null;
  let texts = plan.texts ?? null;
  if (plan.class !== "live" && !texts) {
    // A held proposal's reply carries no texts (Exact cbe553f6): the same plan asked again, unheld, says what it writes.
    const again = await wire.ask({ method: "propose", ops: job.ops, files, client, texts: true }, token);
    texts = again.answer?.ok?.texts ?? null;
    if (!texts) return { ok: false, proposal: plan.proposal, client, scope: job.scope, class: plan.class, error: `the wire would not say what the proposal writes: ${wireError(again)}` };
  }
  const preview = plan.class === "live" ? await scrubPreview(wire, out, job, files, sim) : await stagedPreview(out, job, texts, sim);
  return {
    ok: preview.previews.length > 0 && preview.errors.length === 0,
    proposal: plan.proposal, client, scope: job.scope, class: plan.class, changed: plan.changed ?? [], diff: plan.diff ?? null,
    files: plan.files ?? files, expires: plan.expires ?? null, ops: plan.ops ?? null, scopeCheck,
    how: preview.how, previews: preview.previews, ms: Date.now() - started,
    ...(preview.errors.length ? { error: preview.errors.join("; ") } : {}),
  };
}

/**
 * **A person's Keep, written** — Tamber's `accept` of the held proposal, with
 * the local token (`write`: the person who started this bridge, whose Keep
 * the canvas recorded). A held proposal lives 15 minutes and dies with the
 * loop; one gone is held again from the operations and digests it was made
 * against, and accepted — the wire's digests still refuse a file that moved.
 */
async function acceptJob(job) {
  checkProposalOps(job.ops);
  const wire = await wireOf();
  const client = `person:${String(job.name ?? "someone").replace(/[^A-Za-z0-9_.-]+/g, "-").slice(0, 40)}`;
  if (job.scope === "read") {
    // A Keep by a person this machine's owner has not granted write (exact phase 8): asked of the wire by a client
    // paired at `read`, which the wire refuses — the files are never reached.
    const p = await pairedClient(wire, "read", `isocan-${client.slice(7)}`);
    if (p.error) return { ok: false, error: p.error };
    const r = await wire.ask({ method: "accept", proposal: job.proposal, client: p.client }, p.token);
    return { ok: false, heldAgain: null, written: [], refusal: { status: r.status, scope: r.answer?.error?.scope ?? null, needs: r.answer?.error?.needs ?? null }, error: `the wire refused the keep: ${wireError(r)}` };
  }
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
  if (ok.recomputed) return { ok: false, heldAgain: again, error: "a file moved since the proposal was made, so the wire put it up again rather than write it — ask for the proposal again" };
  return { ok: true, heldAgain: again, written: ok.written ?? [], before: ok.before ?? null, files: ok.files ?? null, class: ok.class ?? null };
}

/** A proposal taken away without a Keep: forgotten on the wire (already gone is the same answer). */
async function dropJob(job) {
  const wire = await wireOf();
  if (!job.proposal) return { ok: true, dropped: null };
  const r = await wire.ask({ method: "drop", proposal: job.proposal, client: "isocan" });
  return { ok: !!r.answer?.ok || r.status === 404, dropped: r.answer?.ok?.dropped ?? null, status: r.status };
}

/**
 * **A branch, staged beside the app** (exact phase 6; design §10's structural
 * edits): the tree of a git ref of the app's repository (`git archive`, which
 * writes nothing to the repository or the working tree), or a directory the
 * person named (a worktree of their own), copied into a staging directory of
 * this bridge's own — never the person's checkout. The CLI reads and captures
 * it there, as it does the app.
 */
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
    // The launcher names the Exact checkout relative to where `exact new` ran; a staged tree keeps the app's own.
    if (!existsSync(path.join(staging, "exact.mjs"))) writeFileSync(path.join(staging, "exact.mjs"), readFileSync(launcher));
  }
  return { staging, ref, commit, from };
}

// ---------------------------------------------------------------- ship (exact phase 7; design §11)

/**
 * **`app.json`'s `deploy`, for the lane** — channels, policy and the signing
 * key's id. The key's public half and its private file stay off the report:
 * the canvas holds the release record only.
 */
function laneOf() {
  let manifest;
  try { manifest = JSON.parse(readFileSync(path.join(app, "app.json"), "utf8")); } catch (e) { fail(`${app}/app.json: ${e.message}`); }
  const d = manifest.deploy ?? {};
  const channels = Object.entries(d.channels ?? {}).map(([name, origin]) => ({ name, origin: String(origin), release: d.release?.[name] ?? null, phased: d.phased?.[name] === true }));
  const store = d.store ?? {};
  const platform = ["ios", "macos", "linux"].find((p) => store[p] === "A") ?? null;
  return {
    format: 1,
    app: { id: manifest.app?.id ?? manifest.id ?? path.basename(app), name: manifest.app?.name ?? manifest.name ?? path.basename(app) },
    platform: platform ?? "ios",
    updating: platform !== null,
    channels,
    baked: d.channel ?? (channels.length === 1 ? channels[0].name : null),
    activate: d.activate ?? null,
    interval: typeof d.check?.interval === "number" ? d.check.interval : null,
    signing: d.signing?.key ?? null,
  };
}

/** Every file under a directory origin, path and bytes, as one digest: unchanged means nothing was uploaded. Null with no directory. */
function originHash(dir) {
  if (!dir) return null;
  if (!existsSync(dir)) return sha256("absent");
  const h = createHash("sha256");
  const walk = (d, rel) => {
    for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(d, e.name), r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) { h.update(`d ${r}\n`); walk(p, r); }
      else if (e.isFile()) { h.update(`f ${r} `); h.update(readFileSync(p)); h.update("\n"); }
      else h.update(`o ${r}\n`);
    }
  };
  walk(dir, "");
  return h.digest("hex");
}

/**
 * **Exact's publisher, run as the person's own** — `bun <checkout>/scripts/deploy.mjs
 * <app> --json …` with the Bun the launcher picks. A dry run is the default;
 * `--yes` signs with the key in `EXACT_SIGNING_KEY_DIR` (default
 * `~/.config/exact/keys`), which this never reads, copies or reports.
 */
function deploy(appDir, args) {
  const { dir, pin } = checkout();
  const { bin } = bunOf(pin);
  // Exact's snapshot counts IGNORED files as uncommitted source — the app's own `.exact/` diary and logs, an editor's
  // folder, `app.contract.d.ts`, a vendored crate's `target/` in the checkout (measured 14 Nov 2026, cbe553f6) — so a
  // clean commit of any app that has been worked on is refused without `--dirty`. A tracked or untracked change would
  // ship, so the trees must be clean apart from what git ignores; then `--dirty` admits only the ignored files, and the
  // table still says DIRTY, in Exact's words.
  for (const [what, tree] of [["the app", appDir], ["the Exact checkout", dir]]) {
    const status = spawnSync("git", ["-C", tree, "status", "--porcelain", "--untracked-files=all", "--", "."], { encoding: "utf8" });
    if (status.status !== 0) fail(`${tree} is not in a git repository: Exact publishes a commit`);
    const moved = status.stdout.trim().split("\n").filter(Boolean);
    if (moved.length) fail(`${what} has uncommitted changes (${moved.slice(0, 4).map((l) => l.slice(3)).join(", ")}${moved.length > 4 ? ", …" : ""}): commit them — a release is a commit`);
  }
  const started = Date.now();
  // An app outside the checkout is named by EXACT_APP_DIR, not by its path: deploy re-runs itself from a captured copy,
  // and a path argument would select the live directory there instead (it refuses: "does not select the app … frozen").
  const done = spawnSync(bin, [path.join(dir, "scripts/deploy.mjs"), path.basename(appDir), ...args, "--dirty", "--json"], { cwd: appDir, encoding: "utf8", maxBuffer: 256 << 20, timeout: 3_600_000, env: { ...process.env, EXACT_APP_DIR: appDir } });
  const ms = Date.now() - started;
  const lines = (done.stdout ?? "").trim().split("\n");
  let table = null;
  for (let i = lines.length - 1; i >= 0 && !table; i--) { try { const v = JSON.parse(lines[i]); if (v && Array.isArray(v.rows)) table = v; } catch { /* the bake's own lines */ } }
  const said = (done.stderr ?? "").trim().split("\n");
  const refusal = said.find((l) => l.startsWith("exact deploy: ")) ?? null;
  return { exit: done.status, table, ms, error: table && done.status === 0 ? null : (refusal ?? said.slice(-6).join("\n")) || `deploy.mjs exited ${done.status ?? done.signal}` };
}

/**
 * **Where to publish**: a channel in `app.json` names what clients fetch (`http://…`, baked into the binary), and Exact
 * writes only to a directory (`--origin <dir>`: "the directory the host serves"). That directory is this machine's,
 * not the canvas's, so the person names it: `ISOCAN_EXACT_ORIGIN=<dir>` (or `--origin`). A channel that names a
 * directory itself needs neither.
 */
function originDir(row) {
  const given = flag("--origin") ?? process.env.ISOCAN_EXACT_ORIGIN ?? null;
  if (given) return path.resolve(given);
  if (/^[a-z]+:\/\//i.test(row.origin) || row.origin === "appdrop") return null;
  return path.resolve(app, row.origin);
}

function channelArgs() {
  const channel = flag("--channel");
  if (!channel || !/^[A-Za-z0-9._-]{1,63}$/.test(channel)) fail("a channel is one of app.json's deploy.channels");
  const lane = laneOf();
  const row = lane.channels.find((c) => c.name === channel);
  if (!row) fail(`app.json names no deploy.channels.${channel} (it names ${lane.channels.map((c) => c.name).join(", ") || "none"})`);
  const platform = flag("--platform") ?? lane.platform;
  if (!["ios", "macos", "linux", "web"].includes(platform)) fail(`--platform ${platform}: ios, macos, linux or web`);
  return { channel, row, platform, lane };
}

/** **Prepare**: Exact's dry run, and the origin's digest either side of it. Nothing is uploaded. */
function prepareJob() {
  const { channel, row, platform, lane } = channelArgs();
  const dir = originDir(row);
  const before = originHash(dir);
  const r = deploy(app, ["--channel", channel, "--platform", platform, ...(dir ? ["--origin", dir] : [])]);
  const after = originHash(dir);
  return { ok: !!r.table && r.exit === 0, lane, channel, platform, table: r.table, originHash: { before, after }, ms: r.ms, ...(r.error && !(r.table && r.exit === 0) ? { error: r.error } : {}) };
}

/**
 * **Ship**: Exact's `--yes`, pinned to the snapshot the person confirmed
 * (`--snapshot`: Exact refuses when the source moved since). With `--commit`
 * (a roll back), the app at that commit, in a worktree of its own repository
 * that is removed afterwards — the person's checkout is never touched.
 */
function shipJob() {
  const { channel, row, platform, lane } = channelArgs();
  const release = flag("--release");
  if (!release || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/.test(release)) fail("a release id is letters, digits, . _ - (it names a file)");
  // What the person confirmed: the commit the dry run snapshotted. Exact's own `--snapshot` pin cannot hold it while
  // `--dirty` folds the ignored files' bytes into the id (a capture appends to `.exact/commands.jsonl`), so the
  // commit is held here, and the outcome's snapshot commit is checked by the CLI against it.
  const expect = flag("--expect");
  if (expect && !/^[0-9a-f]{40}$/.test(expect)) fail("--expect is the commit the dry run snapshotted");
  const head = git(app, ["rev-parse", "HEAD"]);
  if (expect && head !== expect) fail(`the app moved since it was prepared (HEAD is ${head?.slice(0, 12) ?? "?"}, the prepared snapshot is ${expect.slice(0, 12)}): prepare again`);
  const commit = flag("--commit");
  if (commit && !/^[0-9a-f]{7,40}$/.test(commit)) fail("--commit is a commit of the app's repository");
  const dir = originDir(row);
  if (!dir) fail(`${channel} names ${row.origin}, which Exact cannot write to: set ISOCAN_EXACT_ORIGIN to the directory that host serves`);
  const before = originHash(dir);
  let appDir = app, worktree = null;
  try {
    if (commit) {
      const top = git(app, ["rev-parse", "--show-toplevel"]);
      const prefix = git(app, ["rev-parse", "--show-prefix"]) ?? "";
      if (!top) fail(`${app} is not in a git repository, so there is no earlier content to re-publish`);
      worktree = path.join(mkdtempSync(path.join(os.tmpdir(), "isocan-exact-rollback-")), path.basename(top));
      const add = spawnSync("git", ["-C", top, "worktree", "add", "--detach", worktree, commit], { encoding: "utf8" });
      if (add.status !== 0) fail(`could not check out ${commit} beside the app: ${(add.stderr || "").trim()}`);
      appDir = path.join(worktree, prefix);
    }
    const r = deploy(appDir, ["--channel", channel, "--platform", platform, "--release", release, "--origin", dir, "--yes"]);
    const after = originHash(dir);
    return { ok: !!r.table && r.exit === 0, lane, channel, platform, release, table: r.table, originHash: { before, after }, ms: r.ms, ...(r.error && !(r.table && r.exit === 0) ? { error: r.error } : {}) };
  } finally {
    if (worktree) {
      const top = git(app, ["rev-parse", "--show-toplevel"]);
      if (top) spawnSync("git", ["-C", top, "worktree", "remove", "--force", worktree], { encoding: "utf8" });
      spawnSync("rm", ["-rf", path.dirname(worktree)]);
    }
  }
}

const result =
  verb === "stage-branch" ? stageBranch()
  : verb === "lane" ? laneOf()
  : verb === "prepare" ? prepareJob()
  : verb === "ship" ? shipJob()
  : verb === "propose" ? await proposeJob(path.resolve(flag("--dir") ?? fail("propose needs --dir")), JSON.parse(readFileSync(path.resolve(flag("--job") ?? fail("propose needs --job")), "utf8")))
  : verb === "accept" ? await acceptJob(JSON.parse(readFileSync(path.resolve(flag("--job") ?? fail("accept needs --job")), "utf8")))
  : verb === "drop" ? await dropJob(JSON.parse(readFileSync(path.resolve(flag("--job") ?? fail("drop needs --job")), "utf8")))
  : verb === "run" ? runJob(path.resolve(flag("--dir") ?? fail("run needs --dir")), JSON.parse(readFileSync(path.resolve(flag("--job") ?? fail("run needs --job")), "utf8")))
  : verb === "record" ? recordJob(JSON.parse(readFileSync(path.resolve(flag("--job") ?? fail("record needs --job")), "utf8")))
  : verb === "verify" ? verifyJob()
  : verb === "film" ? filmJob(path.resolve(flag("--dir") ?? fail("film needs --dir")), JSON.parse(readFileSync(path.resolve(flag("--job") ?? fail("film needs --job")), "utf8")))
  : verb === "facts" ? factsJob(JSON.parse(readFileSync(path.resolve(flag("--job") ?? fail("facts needs --job")), "utf8")))
  : verb === "drive" ? driveJob(path.resolve(flag("--dir") ?? fail("drive needs --dir")), JSON.parse(readFileSync(path.resolve(flag("--job") ?? fail("drive needs --job")), "utf8")))
  : verb === "compare" ? compare(path.resolve(flag("--dir") ?? fail("compare needs --dir")), JSON.parse(readFileSync(path.resolve(flag("--jobs") ?? fail("compare needs --jobs")), "utf8")))
  : verb === "diagnose" ? diagnose()
  : verb === "check" ? check()
  : verb === "doctor" ? await doctor()
  : verb === "read" ? await read()
  : verb === "inputs" ? { inputs: inputsDigest(checkout().dir) }
  : capture();
writeFileSync(report, JSON.stringify(result, null, 2));
