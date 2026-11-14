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
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, accessSync, constants } from "node:fs";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";

const [verb, ...argv] = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const flags = (name) => argv.flatMap((a, i) => (a === name && argv[i + 1] !== undefined ? [argv[i + 1]] : []));

if (!["doctor", "read", "capture", "inputs", "diagnose", "check"].includes(verb ?? "") || !flag("--app") || !flag("--report")) {
  console.error("usage: exact-bridge.mjs doctor|read|capture|inputs|diagnose|check --app <dir> --report <file.json> [--hosts web,ios] [--jobs <jobs.json>] [--dir <out> --size <w>x<h> --url <path>…]");
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
  // The tests, compiled: each `*.test.contract` beside the app.
  const tests = [];
  for (const name of readdirSync(app).filter((f) => f.endsWith(".test.contract")).sort()) {
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
function checkJob(job) {
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
  for (const [j, job] of jobs.entries()) {
    checkJob(job);
    const first = job.shots[0];
    const ops = ["clock data", ...(job.ops ?? [])];
    const files = [];
    for (const [i, shot] of job.shots.entries()) {
      const file = path.join(out, `job-${j}-${i}.png`);
      files.push(file);
      // `tree` (what is hidden) and `layout` (each node's box, joined to source) right after the picture: what pointing on
      // a capture reads, with live frames off (exact phase 2).
      ops.push(`resize ${shot.size}`, `prefer color-scheme ${shot.scheme}`, "clock settle", `screenshot ${file}`, "tree", "layout");
    }
    const run = exact([
      "agent", "web", "--json", "--size", first.size, "--seed", "1", "--locale", "en-US", "--time-zone", "UTC", "--epoch", "2026-01-01",
      "--url", job.url, ...ops,
    ]);
    const replies = run.stdout.split("\n").flatMap((line) => { if (!line.startsWith("{")) return []; try { return [JSON.parse(line)]; } catch { return []; } });
    const trees = replies.filter((r) => Array.isArray(r.nodes) && !r.env);
    const layouts = replies.filter((r) => Array.isArray(r.nodes) && r.env);
    for (const [i, file] of files.entries()) {
      if (!existsSync(file)) fail(`agent web wrote no screenshot for ${job.url} at ${job.shots[i].size} ${job.shots[i].scheme}:\n${run.stdout.trim().split("\n").slice(-4).join("\n")}`);
      shots.push({ job: j, index: i, url: job.url, size: job.shots[i].size, scheme: job.shots[i].scheme, file, sha256: sha256(readFileSync(file)), ms: Math.round(run.ms / files.length), points: pointsOf(trees[i], layouts[i]) });
    }
  }
  return { shots };
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
function pointsOf(tree, layout) {
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
  return { files, nodes };
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

const result =
  verb === "diagnose" ? diagnose()
  : verb === "check" ? check()
  : verb === "doctor" ? await doctor()
  : verb === "read" ? await read()
  : verb === "inputs" ? { inputs: inputsDigest(checkout().dir) }
  : capture();
writeFileSync(report, JSON.stringify(result, null, 2));
