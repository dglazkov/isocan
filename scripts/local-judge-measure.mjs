#!/usr/bin/env node
/**
 * **The judge in the tab, measured in a real Chrome** (local-judge phase 0).
 *
 *   npm run build
 *   node scripts/local-judge-measure.mjs --home <scratch home with models/> [--port 4443]
 *        [--n 1000] [--n-cpu 100] [--backends gpu,cpu,gpu] [--offline] [--headed] [--out results.json]
 *        [--file <model file>] [--guard-off] [--lab '{"tokens":[128],"options":[7],"warmOnly":true}']
 *
 * A daemon of its own on a scratch home (`--home`, which must already hold
 * the model: `ISOCAN_HOME=<home> isocan model fetch embeddinggemma-2-text-270m`),
 * run from that home so no repository binding reaches it; headless Chrome
 * through `scripts/lib/browser.mjs`; the lab page (`/judge-lab.html`, built
 * into `packages/web/dist`) driven through `window.__lab.run`, once per
 * backend, the page reloaded between them so each backend starts cold in a
 * fresh Worker (the model comes from Cache Storage the second time, and the
 * report says so).
 *
 * **`--offline` is the privacy proof.** Chrome's resolver maps every name
 * except 127.0.0.1 to nothing (`--host-resolver-rules`), so nothing the page,
 * its Worker or Chrome itself asks for can leave the machine. Every request
 * the page and its Worker make is recorded over CDP (the Worker attached with
 * `Target.setAutoAttach`), and Chrome's own net log is written beside it, so
 * the record covers requests no page made. The run then asserts each request
 * went to the daemon's origin and that none carried the state text.
 *
 * **Memory** is the Chrome process tree's resident set (`ps`), sampled every
 * second: before the judge, and its peak after. **WebGPU**: the flags below
 * ask for it; if the adapter is missing the GPU row says so and only the CPU
 * is measured — never a CPU number under a GPU label.
 *
 * It prints one JSON document on stdout; progress goes to stderr.
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const argv = process.argv.slice(2);
const arg = (name, fallback) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : fallback; };
const flag = (name) => argv.includes(name);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MODEL = "embeddinggemma-2-text-270m";
/** Words only the lab's synthetic state text contains — what "carried the state text" is checked against. */
const STATE_MARKERS = ["Please ", "Please%20", "acme note screen", "Acme note"];

/** Sum the resident set of `pid` and every process under it, in bytes. */
function treeRss(pid) {
  const rows = execFileSync("ps", ["-axo", "pid=,ppid=,rss="], { encoding: "utf8" }).trim().split("\n").map((l) => l.trim().split(/\s+/).map(Number));
  const kids = new Map();
  for (const [p, pp] of rows) kids.set(pp, [...(kids.get(pp) ?? []), p]);
  const rss = new Map(rows.map(([p, , r]) => [p, r]));
  let total = 0;
  const stack = [pid];
  while (stack.length) {
    const p = stack.pop();
    total += (rss.get(p) ?? 0) * 1024;
    stack.push(...(kids.get(p) ?? []));
  }
  return total;
}

/**
 * **Every URL request Chrome itself logged**, by who started it and how it
 * ended. The page's own requests carry the daemon's origin as initiator;
 * Chrome's background services (account checks, update pings) carry none —
 * those are the browser's, not the page's, and with the resolver mapped to
 * nothing they end in a name-resolution error before a byte leaves.
 */
function netLogRequests(log, origin) {
  const type = Object.fromEntries(Object.entries(log.constants.logEventTypes).map(([k, v]) => [v, k]));
  const errName = Object.fromEntries(Object.entries(log.constants.netError ?? {}).map(([k, v]) => [v, k]));
  const bySource = new Map();
  for (const e of log.events) {
    const p = e.params ?? {};
    const s = bySource.get(e.source.id) ?? {};
    // The event's END phase carries no params; only the BEGIN names the URL.
    if (type[e.type] === "URL_REQUEST_START_JOB" && p.url) Object.assign(s, { url: p.url, initiator: p.initiator ?? null });
    if (typeof p.net_error === "number") s.error = errName[p.net_error] ?? p.net_error;
    if (type[e.type] === "HTTP_TRANSACTION_READ_RESPONSE_HEADERS") s.answered = true;
    bySource.set(e.source.id, s);
  }
  const rows = [...bySource.values()].filter((s) => s.url);
  const host = (u) => { try { return new URL(u).host; } catch { return u.slice(0, 40); } };
  const group = (list) => Object.entries(list.reduce((acc, s) => { const k = `${host(s.url)} ${s.answered ? "answered" : `failed ${s.error ?? "?"}`}`; acc[k] = (acc[k] ?? 0) + 1; return acc; }, {})).sort();
  const fromPage = rows.filter((s) => s.initiator === origin || host(s.url) === new URL(origin).host);
  const fromBrowser = rows.filter((s) => !fromPage.includes(s));
  return {
    ...(log.truncated ? { truncated: "Chrome stopped before the net log was finished; read to its last whole event" } : {}),
    fromPage: group(fromPage),
    fromBrowserItself: group(fromBrowser),
    leftTheMachine: rows.filter((s) => s.answered && host(s.url) !== new URL(origin).host).map((s) => s.url),
  };
}

/**
 * A net log Chrome did not finish writing — a headed Chrome stopped mid-write
 * leaves the events array open — is read up to its last whole event, and the
 * report says it was cut rather than losing the run.
 */
function readNetLog(text) {
  try {
    return JSON.parse(text);
  } catch {
    const cut = text.lastIndexOf("},\n");
    if (cut < 0) throw new Error("the net log is unreadable");
    const log = JSON.parse(`${text.slice(0, cut + 1)}]}`);
    log.truncated = true;
    return log;
  }
}

function machine() {
  const sysctl = (k) => { try { return execFileSync("sysctl", ["-n", k], { encoding: "utf8" }).trim(); } catch { return null; } };
  return { platform: `${os.type()} ${os.release()} ${os.arch()}`, model: sysctl("hw.model"), cpu: os.cpus()[0]?.model ?? null, cores: os.cpus().length, memoryGB: Math.round(os.totalmem() / 2 ** 30) };
}

async function main() {
  const home = arg("--home", null);
  if (!home) throw new Error("REFUSED: --home <scratch ISOCAN_HOME> is required, holding models/ — never the person's own home");
  if (path.resolve(home) === path.join(os.homedir(), ".isocan")) throw new Error("REFUSED: that is the person's own home; use a scratch one");
  const port = Number(arg("--port", "4443"));
  const n = Number(arg("--n", "1000"));
  // The CPU is ~25x slower; 1,000 answers per row there is hours, so it may be asked for apart and is reported with its own n.
  const nCpu = Number(arg("--n-cpu", String(n)));
  // `--lab '{"tokens":[128],"options":[7],"warmOnly":true}'` narrows the lab's run, for a quick look at one row.
  const labExtra = JSON.parse(arg("--lab", "{}"));
  // `--file <path>`: load the model through the lab's file input (the phone's path) instead of /models.
  const modelFile = arg("--file", null);
  if (modelFile) labExtra.fromFile = true;
  // `--guard-off`: the Worker's fetch guard off, so the browser's policy alone must stop what tries to leave.
  if (flag("--guard-off")) labExtra.fetchGuard = false;
  const backends = arg("--backends", "gpu,cpu").split(",");
  const offline = flag("--offline");
  const out = arg("--out", null);
  const lab = path.join(root, "packages/web/dist/judge-lab.html");
  if (!existsSync(lab)) throw new Error("REFUSED: packages/web/dist/judge-lab.html is missing — `npm run build` first");

  const cli = path.join(root, "packages/cli/bin/isocan.js");
  const env = { ...process.env, ISOCAN_HOME: home, ISOCAN_PORT: String(port), ISOCAN_CONTENT_PORT: "off", ISOCAN_SESSION_ID: `acme-judge-lab-${port}`, ISOCAN_HARNESS: "test" };
  for (const k of Object.keys(env)) if (/^(CLAUDE|CODEX|GEMINI_CLI)/.test(k)) delete env[k];
  const daemon = spawn(process.execPath, [cli, "serve", "--foreground"], { cwd: home, env, stdio: ["ignore", "pipe", "pipe"] });
  const origin = `http://127.0.0.1:${port}`;
  // Interrupted, it takes its daemon with it rather than leaving one on the port.
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => { daemon.kill("SIGTERM"); process.exit(130); });
  let daemonOut = "";
  daemon.stdout.on("data", (c) => (daemonOut += c));
  daemon.stderr.on("data", (c) => (daemonOut += c));
  const { browser } = await import(path.join(root, "scripts/lib/browser.mjs"));
  let b = null;
  try {
    for (let i = 0; ; i++) {
      if (daemon.exitCode !== null) throw new Error(`daemon exited ${daemon.exitCode}:\n${daemonOut}`);
      const up = await fetch(`${origin}/healthz`).then((r) => r.ok, () => false);
      if (up) break;
      if (i > 300) throw new Error(`daemon did not answer at ${origin}:\n${daemonOut}`);
      await sleep(200);
    }
    const head = await fetch(`${origin}/models/${MODEL}`, { method: "HEAD" });
    if (head.status !== 200) throw new Error(`REFUSED: ${origin}/models/${MODEL} answered ${head.status} — fetch the model into ${home} first (ISOCAN_HOME=${home} isocan model fetch ${MODEL})`);

    const scratch = path.dirname(path.resolve(out ?? path.join(home, "x")));
    const netlog = offline ? path.join(scratch, `local-judge-netlog-${Date.now()}.json`) : null;
    const args = [
      "--enable-unsafe-webgpu",
      "--enable-features=WebGPUService",
      "--ignore-gpu-blocklist",
      // Chrome's own background traffic (updates, sync, field trials), which
      // no page asked for — off, so the net log is the page's story.
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-sync",
      "--disable-default-apps",
      "--no-pings",
      "--metrics-recording-only",
      // `--extra-flags "--a --b"`: Chrome switches for an experiment, recorded in the report with the rest.
      ...(arg("--extra-flags", "") ? arg("--extra-flags", "").split(" ").filter(Boolean) : []),
      ...(offline ? ["--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1", `--log-net-log=${netlog}`, "--net-log-capture-mode=Default"] : []),
    ];
    // `--headed`: a real window (browser.mjs omits --headless); the report's userAgent says which it was.
    b = await browser({ args, headless: !flag("--headed") });
    const version = await b.send("Browser.getVersion").catch(() => null);

    // Every request the page and its Worker make.
    const requests = new Map();
    const record = (p, session) => {
      const r = p.request;
      if (!r) return;
      requests.set(`${session ?? "page"}:${p.requestId}`, { url: r.url, method: r.method, hasBody: Boolean(r.hasPostData || r.postData), body: r.postData ?? "", from: session ? "worker" : "page", type: p.type ?? null });
    };
    const failed = [];
    const workerPolicy = [];
    b.on("Network.requestWillBeSent", record);
    b.on("Network.loadingFailed", (p, session) => failed.push({ key: `${session ?? "page"}:${p.requestId}`, from: session ? "worker" : "page", error: p.errorText, blockedReason: p.blockedReason ?? null }));
    // The Worker's own policy, as the browser received it with the script.
    b.on("Network.responseReceived", (p) => {
      if (/\/assets\/judge-worker-[^/]+\.js$/.test(p.response.url)) {
        const h = Object.fromEntries(Object.entries(p.response.headers).map(([k, v]) => [k.toLowerCase(), v]));
        workerPolicy.push({ url: new URL(p.response.url).pathname, csp: h["content-security-policy"] ?? null });
      }
    });
    b.on("Target.attachedToTarget", (p) => {
      const sid = p.sessionId;
      void b.send("Network.enable", {}, sid).then(() => b.send("Runtime.runIfWaitingForDebugger", {}, sid)).catch(() => undefined);
    });
    await b.send("Network.enable");
    await b.send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
    await b.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

    const results = {};
    const memory = {};
    for (const [i, backend] of backends.entries()) {
      const loaded = b.once("Page.loadEventFired");
      await b.send(i === 0 ? "Page.navigate" : "Page.reload", i === 0 ? { url: `${origin}/judge-lab.html` } : {});
      await loaded;
      for (let k = 0; k < 100 && !(await b.ev("typeof window.__lab === 'object'").catch(() => false)); k++) await sleep(100);
      if (modelFile) {
        // The phone's path, driven: the model from a chosen file rather than /models.
        const { root } = await b.send("DOM.getDocument");
        const { nodeId } = await b.send("DOM.querySelector", { nodeId: root.nodeId, selector: "#model-file" });
        await b.send("DOM.setFileInputFiles", { nodeId, files: [path.resolve(modelFile)] });
      }
      await sleep(500);
      const key = results[backend] ? `${backend}-after-reload` : backend;
      const rows = backend === "cpu" ? nCpu : n;
      const before = treeRss(b.pid);
      let peak = before;
      const sampler = setInterval(() => { try { peak = Math.max(peak, treeRss(b.pid)); } catch { /* a process that ended between ps and read */ } }, 1000);
      let shown = 0;
      const progress = setInterval(async () => {
        const text = await b.ev("document.getElementById('out').textContent").catch(() => "");
        const lines = String(text).split("\n");
        for (const line of lines.slice(shown, -1)) process.stderr.write(`[${key}] ${line.slice(0, 220)}\n`);
        shown = Math.max(shown, lines.length - 1);
      }, 5000);
      process.stderr.write(`[${key}] measuring, n=${rows}\n`);
      try {
        results[key] = await b.ev(`window.__lab.run(${JSON.stringify({ backend, n: rows, ...labExtra })}).catch((e) => ({ error: String(e && e.message || e) }))`);
      } finally {
        clearInterval(sampler);
        clearInterval(progress);
      }
      memory[key] = { chromeTreeRssBeforeMB: Math.round(before / 1e6), chromeTreeRssPeakMB: Math.round(peak / 1e6), deltaMB: Math.round((peak - before) / 1e6) };
    }

    const list = [...requests.values()];
    const own = (u) => { try { return new URL(u).origin === origin; } catch { return false; } };
    // A request the browser's policy blocked never left; it is reported apart, as the policy's evidence.
    const blockedKeys = new Set(failed.filter((f) => f.blockedReason === "csp").map((f) => f.key));
    const entries = [...requests.entries()];
    const blockedByPolicy = entries.filter(([k]) => blockedKeys.has(k)).map(([, r]) => `${r.from} ${r.method} ${r.url.split("?")[0]}`);
    const notOwn = entries.filter(([k, r]) => !blockedKeys.has(k) && !own(r.url) && !r.url.startsWith("data:") && !r.url.startsWith("blob:")).map(([, r]) => r);
    const carried = list.filter((r) => STATE_MARKERS.some((m) => r.url.includes(m) || r.body.includes(m)));
    let netlogRequests = null;
    if (netlog && existsSync(netlog)) {
      // The net log is written as Chrome exits; close first, then read it.
      await b.close();
      b = null;
      netlogRequests = netLogRequests(readNetLog(readFileSync(netlog, "utf8")), origin);
    }
    const report = {
      machine: machine(),
      browser: version ? { product: version.product, userAgent: version.userAgent } : null,
      headless: !flag("--headed"),
      chromeFlags: args.filter((a) => !a.startsWith("--log-net-log")),
      daemon: origin,
      n,
      results,
      memory,
      privacy: {
        offline,
        requests: list.length,
        byPath: Object.entries(list.reduce((acc, r) => { const k = own(r.url) ? `${r.from} ${r.method} ${new URL(r.url).pathname.replace(/-[A-Za-z0-9_-]{8}\./, "-*.")}` : `${r.from} ${r.method} ${r.url}`; acc[k] = (acc[k] ?? 0) + 1; return acc; }, {})).sort(),
        blockedByPolicy,
        workerPolicy,
        notToDaemon: notOwn.map((r) => `${r.from} ${r.method} ${r.url}`),
        carriedStateText: carried.map((r) => `${r.from} ${r.method} ${r.url}`),
        withBody: list.filter((r) => r.hasBody).map((r) => `${r.from} ${r.method} ${r.url}`),
        failedLoads: failed.length,
        crossOriginAttempts: Object.fromEntries(Object.entries(results).map(([k, r]) => [k, r?.crossOriginAttempts ?? null])),
        cspViolations: Object.fromEntries(Object.entries(results).map(([k, r]) => [k, r?.cspViolations ?? null])),
        netlog: netlogRequests,
      },
    };
    const json = JSON.stringify(report, null, 2);
    if (out) writeFileSync(out, json);
    console.log(json);
    if (offline && (notOwn.length > 0 || carried.length > 0 || (netlogRequests?.leftTheMachine.length ?? 0) > 0)) {
      console.error(`PRIVACY FAILED: ${notOwn.length} request(s) not to ${origin}, ${carried.length} carrying state text`);
      process.exitCode = 1;
    }
  } finally {
    if (b) await b.close().catch(() => undefined);
    daemon.kill("SIGTERM");
  }
}

main().catch((err) => { console.error(String(err?.stack ?? err)); process.exit(2); });
