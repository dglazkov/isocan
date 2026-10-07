#!/usr/bin/env node
/**
 * **Three judges, one set of asks, no UI** (local-judge phase 1).
 *
 *   npm run build      # judge B runs in the built lab page
 *   node scripts/local-judge/harness.mjs --set synthetic|real
 *        [--judges A,B,C,Jev] [--home <scratch home holding models/>] [--port 4443]
 *        [--seed local-judge-1] [--target 0.98] [--min-n 30]
 *        [--jev-home https://isocan.io] [--jev-canvas <canvas id>] [--max-jev 1200]
 *        [--open-locked] [--json]
 *
 * The same cases, the same state text (`routeStateText`, capped at 128
 * tokens), four columns:
 *
 * - **A** — `categoriseAsk`, mapped to routes (`baselineRoute`). No
 *   confidence, so it answers everything; it is reported at full coverage.
 * - **B** — the `local` judge, zero-shot, the route descriptions as its
 *   criteria: the built lab page (`window.__lab.route`) in headless Chrome
 *   against a daemon of its own on a SCRATCH home that holds the model, the
 *   way `scripts/local-judge-measure.mjs` runs it. Chrome's resolver maps
 *   every name but 127.0.0.1 to nothing, so nothing the page reads can leave.
 * - **C** — a linear head on frozen EmbeddingGemma embeddings. MediaPipe
 *   Decision Maker 1.1.0 exposes no embedding output (its evaluate calls
 *   return choice distributions only; the wasm binds no embed function), so
 *   the column is reported unavailable and nothing is substituted for it.
 * - **Jev** — through a home's `/api/judgment` (`homeAnswerer`), with the
 *   home's key. Every answer is cached by its exact request, so a rerun
 *   spends nothing; `--max-jev` bounds what one run may spend.
 *
 * **Splits and thresholds.** `splitOf(scenario, seed)`: development,
 * calibration, locked, paraphrases of one scenario together. For B and Jev a
 * cut on the winning probability and its margin is chosen on CALIBRATION
 * alone (`thresholdWithMargin`, the fast path's rule) and written down before
 * the locked split is scored. The locked split is never read by anything that
 * chooses a cut. On the real set it stays sealed until every row has been
 * reviewed by a person AND `--open-locked` is given; until then the real
 * set's numbers are printed under DRAFT LABELS and are not a verdict.
 *
 * **Where things live.** The synthetic set is the committed fixture
 * (`packages/core/test/fixtures/local-judge-routes.json`). The real set, its
 * caches and its frozen thresholds live in `<isocan home>/local-judge/`, never
 * in a repository. Output is counts and rates only — never an ask's words.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "tsx/esm/api";
import { ASKS_FILE, argOf, asPerson, isocanHome, judgeDir, readJson, refuseInRepo, writeJsonAtomic } from "./lib.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const argv = process.argv.slice(2);
const arg = argOf(argv);
const flag = (name) => argv.includes(name);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (line) => process.stderr.write(`${line}\n`);

const set = arg("--set", "synthetic");
if (!["synthetic", "real"].includes(set)) throw new Error(`--set synthetic|real, not ${set}`);
const judges = arg("--judges", "A,B,C,Jev").split(",").map((j) => j.trim());
const seed = arg("--seed", "local-judge-1");
const target = Number(arg("--target", "0.98"));
const minN = Number(arg("--min-n", "30"));
const maxJev = Number(arg("--max-jev", "1200"));
const store = judgeDir();
refuseInRepo(store, "the judge's caches and the real set");

register();
const route = await import("@isocan/core/intent-route");
const { thresholdWithMargin } = await import("@isocan/core/threshold");
const { JEV_INPUT_PRICE } = await import("@isocan/core/jev");

// ---------- the cases

function loadCases() {
  if (set === "synthetic") {
    const fixture = JSON.parse(readFileSync(path.join(root, "packages/core/test/fixtures/local-judge-routes.json"), "utf8"));
    return { labels: "authored", seed: fixture.seed ?? seed, cases: fixture.cases.map((c) => ({ ...c, truth: c.intent, truthDisposition: c.disposition })) };
  }
  const file = path.join(store, ASKS_FILE);
  if (!existsSync(file)) throw new Error(`no real set at ${file} — \`node scripts/local-judge/export.mjs\` writes it`);
  const asks = JSON.parse(readFileSync(file, "utf8"));
  const labelled = asks.rows.filter((r) => r.label || r.draft);
  const reviewed = asks.rows.filter((r) => r.reviewedBy === "person").length;
  return {
    labels: reviewed === asks.rows.length && asks.rows.length > 0 ? "reviewed" : "DRAFT",
    reviewed,
    total: asks.rows.length,
    seed,
    cases: labelled.map((r) => ({
      id: r.id,
      scenario: r.scenario,
      text: r.body,
      state: { selected: r.selected ?? 0, role: "editor" },
      truth: r.label ?? r.draft.route,
      tags: r.tags ?? [],
    })),
  };
}

const loaded = loadCases();
const cases = loaded.cases.map((c) => {
  const s = route.routeStateText(c.text, c.state);
  return { ...c, stateText: s.text, truncated: s.truncated, split: route.splitOf(c.scenario, loaded.seed) };
});
log(`${set}: ${cases.length} cases (${loaded.labels} labels), seed ${loaded.seed}`);

// ---------- the cache: one answer per judge per exact state text

const cacheFile = path.join(store, `cache-${set}.json`);
const cache = readJson(cacheFile, { v: 1, B: {}, Jev: {} });
const keyOf = (text) => createHash("sha256").update(`${JSON.stringify(route.ROUTE_QUESTION)}\u0000${text}`).digest("hex").slice(0, 24);
const saveCache = () => writeJsonAtomic(cacheFile, cache);

// ---------- judge B: the local judge in a real browser

async function judgeB() {
  const missing = [...new Set(cases.map((c) => c.stateText))].filter((t) => !cache.B[keyOf(t)]);
  if (missing.length === 0) return { ran: 0 };
  const home = arg("--home", null);
  if (!home) throw new Error("judge B needs --home <scratch ISOCAN_HOME holding models/> — never the person's own home");
  if (path.resolve(home) === path.resolve(isocanHome())) throw new Error("REFUSED: --home is the person's own home; use a scratch one");
  const lab = path.join(root, "packages/web/dist/judge-lab.html");
  if (!existsSync(lab)) throw new Error("packages/web/dist/judge-lab.html is missing — `npm run build` first");
  const port = Number(arg("--port", "4443"));
  const env = { ...process.env, ISOCAN_HOME: home, ISOCAN_PORT: String(port), ISOCAN_CONTENT_PORT: "off", ISOCAN_SESSION_ID: `acme-judge-harness-${port}`, ISOCAN_HARNESS: "test" };
  for (const k of Object.keys(env)) if (/^(CLAUDE|CODEX|GEMINI_CLI)/.test(k)) delete env[k];
  delete env.ISOCAN_DIRECT;
  const daemon = spawn(process.execPath, [path.join(root, "packages/cli/bin/isocan.js"), "serve", "--foreground"], { cwd: home, env, stdio: ["ignore", "pipe", "pipe"] });
  let daemonOut = "";
  daemon.stdout.on("data", (c) => (daemonOut += c));
  daemon.stderr.on("data", (c) => (daemonOut += c));
  const origin = `http://127.0.0.1:${port}`;
  const { browser } = await import(path.join(root, "scripts/lib/browser.mjs"));
  let b = null;
  try {
    for (let i = 0; ; i++) {
      if (daemon.exitCode !== null) throw new Error(`daemon exited ${daemon.exitCode}:\n${daemonOut}`);
      if (await fetch(`${origin}/healthz`).then((r) => r.ok, () => false)) break;
      if (i > 300) throw new Error(`daemon did not answer at ${origin}`);
      await sleep(200);
    }
    b = await browser({
      headless: !flag("--headed"),
      args: ["--enable-unsafe-webgpu", "--enable-features=WebGPUService", "--ignore-gpu-blocklist", "--disable-background-networking", "--disable-component-update", "--disable-sync", "--no-pings", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"],
    });
    const loadedPage = b.once("Page.loadEventFired");
    await b.send("Page.navigate", { url: `${origin}/judge-lab.html` });
    await loadedPage;
    for (let k = 0; k < 100 && !(await b.ev("typeof window.__lab === 'object' && typeof window.__lab.route === 'function'").catch(() => false)); k++) await sleep(100);
    const backend = arg("--backend", "gpu");
    log(`B: ${missing.length} texts on ${backend}`);
    const res = await b.ev(`window.__lab.route(${JSON.stringify({ backend, question: route.ROUTE_QUESTION, texts: missing, countTokens: true })}).catch((e) => ({ error: String(e && e.message || e) }))`);
    if (res?.error) throw new Error(`the lab refused: ${res.error}`);
    if (res.crossOriginAttempts?.length || res.cspViolations?.length) log(`B privacy record: ${JSON.stringify({ crossOriginAttempts: res.crossOriginAttempts, cspViolations: res.cspViolations })}`);
    missing.forEach((t, i) => {
      const a = res.answers[i];
      if (a && !a.error) cache.B[keyOf(t)] = { probabilities: a.probabilities, tokens: a.tokens, ms: a.ms, backend: res.backend, by: `${res.model} via ${res.runtime}` };
    });
    saveCache();
    return { ran: missing.length, backend: res.backend, errors: res.answers.filter((a) => a.error).length, privacy: { crossOriginAttempts: res.crossOriginAttempts, cspViolations: res.cspViolations } };
  } finally {
    if (b) await b.close().catch(() => undefined);
    daemon.kill("SIGTERM");
  }
}

// ---------- Jev, through the home

async function judgeJev() {
  const missing = [...new Set(cases.map((c) => c.stateText))].filter((t) => !cache.Jev[keyOf(t)]);
  if (missing.length === 0) return { ran: 0, spent: 0 };
  if (missing.length > maxJev) throw new Error(`Jev would answer ${missing.length} new texts; --max-jev is ${maxJev}`);
  asPerson();
  const jevHome = arg("--jev-home", "https://isocan.io");
  const cwd = process.cwd();
  process.chdir(os.homedir()); // no repository binding decides which canvas
  process.env.ISOCAN_DIRECT = jevHome;
  const { resolveCtx } = await import("@isocan/api");
  const { homeAnswerer } = await import("@isocan/core/jev");
  const ctx = await resolveCtx({ interactive: false });
  process.chdir(cwd);
  const canvasId = arg("--jev-canvas", null) ?? (await ctx.client.listCanvases())[0]?.id;
  if (!canvasId) throw new Error(`no canvas at ${jevHome} to ask the judge through — --jev-canvas <id>`);
  const jev = homeAnswerer((q) => ctx.client.judgment(q), canvasId);
  let tokens = 0;
  let errors = 0;
  let next = 0;
  const work = async () => {
    for (;;) {
      const i = next++;
      if (i >= missing.length) return;
      const t = missing[i];
      try {
        let r;
        // The home meters judgments per badge per minute: wait it out rather than count it as a failure.
        for (let wait = 0; ; wait++) {
          try {
            r = await jev.answer(route.routeRequest(t));
            break;
          } catch (error) {
            if (error?.code !== "judgment-rate-limited" || wait > 20) throw error;
            await sleep(15_000);
          }
        }
        const a = r.response.answers.route;
        cache.Jev[keyOf(t)] = { probabilities: a.probabilities, by: r.by, ms: r.ms, tokens: r.response.usage?.input_tokens ?? null };
        tokens += r.response.usage?.input_tokens ?? 0;
      } catch (error) {
        errors++;
        if (errors > 10) throw error;
      }
      if (i % 25 === 0) {
        log(`Jev: ${i}/${missing.length}`);
        saveCache();
      }
    }
  };
  try {
    await Promise.all(Array.from({ length: 4 }, work));
  } finally {
    saveCache();
  }
  return { ran: missing.length, errors, inputTokens: tokens, spent: Number((tokens * JEV_INPUT_PRICE).toFixed(4)), home: jevHome };
}

// ---------- run, then score

const runs = {};
if (judges.includes("B")) runs.B = await judgeB();
if (judges.includes("Jev")) runs.Jev = await judgeJev();
if (judges.includes("C")) {
  runs.C = { unavailable: "MediaPipe Decision Maker 1.1.0 exposes no embedding output: DecisionMaker's methods return choice/boolean/score results only, and the wasm binds no embed function (createDecision, evaluate*, prewarmSchema). No other model substituted." };
}

function judgedBy(name) {
  return cases.map((c) => {
    let w;
    if (name === "A") w = { route: route.baselineRoute(c.text), p: 1, margin: 1 };
    else {
      const hit = cache[name][keyOf(c.stateText)];
      if (!hit) return null;
      w = route.winnerOf(hit.probabilities);
    }
    return { id: c.id, split: c.split, truth: c.truth, predicted: w.route, p: w.p, margin: w.margin, state: c.state, ...(c.truthDisposition ? { truthDisposition: c.truthDisposition } : {}), tags: c.tags ?? [] };
  });
}

const lockedOpen = set === "synthetic" || (flag("--open-locked") && loaded.labels === "reviewed");
const thresholdsFile = path.join(store, `thresholds-${set}.json`);
const report = {
  set,
  labels: loaded.labels,
  ...(set === "real" ? { reviewed: loaded.reviewed, total: loaded.total } : {}),
  seed: loaded.seed,
  target,
  minN,
  cases: cases.length,
  truncated: cases.filter((c) => c.truncated).length,
  splits: Object.fromEntries(route.SPLITS.map((s) => [s, cases.filter((c) => c.split === s).length])),
  lockedOpen,
  runs,
  judges: {},
};

// 1. The cuts, from calibration only — the locked split is not in sight here.
//    A has no confidence: it answers everything.
const judged = {};
const frozen = {};
for (const name of ["A", "B", "Jev"].filter((j) => judges.includes(j))) {
  const rows = judgedBy(name);
  if (rows.some((r) => r === null)) {
    report.judges[name] = { missing: rows.filter((r) => r === null).length };
    continue;
  }
  judged[name] = rows;
  const calibration = rows.filter((r) => r.split === "calibration");
  frozen[name] = name === "A" ? "all" : thresholdWithMargin(calibration.map((r) => ({ p: r.p, margin: r.margin, right: r.predicted === r.truth })), target, minN);
}

// 2. Frozen, and written down, before the locked split is read. On the real
//    set the locked split opens only against cuts a SEALED run froze over the
//    same calibration rows and labels: if anything moved since, it refuses.
const calibrationHash = createHash("sha256")
  .update(JSON.stringify({ seed: loaded.seed, target, minN, rows: cases.filter((c) => c.split === "calibration").map((c) => [c.id, c.truth]) }))
  .digest("hex")
  .slice(0, 16);
if (set === "real" && lockedOpen) {
  const before = readJson(thresholdsFile, null);
  if (!before || before.lockedOpen || before.calibrationHash !== calibrationHash || JSON.stringify(before.cuts) !== JSON.stringify(frozen)) {
    throw new Error(`REFUSED: the locked split opens only against cuts frozen by an earlier sealed run over the same calibration labels — run once without --open-locked, then again with it (${thresholdsFile})`);
  }
} else {
  writeJsonAtomic(thresholdsFile, { frozenAt: new Date().toISOString(), set, labels: loaded.labels, seed: loaded.seed, target, minN, calibrationHash, lockedOpen, cuts: frozen });
}
report.thresholdsFile = thresholdsFile;

// 3. Scored.
for (const [name, rows] of Object.entries(judged)) {
  const cut = frozen[name];
  const bySplit = {};
  for (const split of route.SPLITS) {
    if (split === "locked" && !lockedOpen) {
      bySplit.locked = { sealed: set === "real" ? "until every row is reviewed by a person and --open-locked is given" : "closed" };
      continue;
    }
    const of = rows.filter((r) => r.split === split);
    bySplit[split] = { atCut: route.scoreRoutes(of, cut), answerEverything: route.scoreRoutes(of, "all") };
  }
  report.judges[name] = { cut, bySplit };
}

if (flag("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(markdown(report));
}

function markdown(r) {
  const pct = (x) => (x === null || x === undefined ? "—" : `${(x * 100).toFixed(1)}%`);
  const ci = (rt) => (rt.n ? `${pct(rt.rate)} [${pct(rt.ci.lo)}–${pct(rt.ci.hi)}]` : "—");
  const lines = [];
  lines.push(`## ${r.set} set — ${r.labels === "DRAFT" ? "DRAFT LABELS, not a verdict" : `${r.labels} labels`}`);
  lines.push(`${r.cases} cases (${r.truncated} truncated at ${route.STATE_TOKEN_CAP} tokens); splits ${JSON.stringify(r.splits)}; seed ${r.seed}; cut rule: ≥ ${pct(r.target)} on ≥ ${r.minN} calibration cases`);
  for (const [name, j] of Object.entries(r.judges)) {
    if (j.missing) {
      lines.push(`\n### ${name}: ${j.missing} cases unanswered`);
      continue;
    }
    lines.push(`\n### ${name} — cut ${j.cut === "all" ? "none (answers everything)" : j.cut ? `p ≥ ${j.cut.p.toFixed(3)}, margin ≥ ${j.cut.margin.toFixed(3)}` : "none qualifies (abstains on everything)"}`);
    lines.push("| split | accuracy among accepted | coverage | conf. errors no-action | conf. errors unrelated | disposition | answer-everything accuracy |");
    lines.push("| --- | --- | --- | --- | --- | --- | --- |");
    for (const [split, s] of Object.entries(j.bySplit)) {
      if (s.sealed) {
        lines.push(`| ${split} | sealed ${s.sealed} | | | | | |`);
        continue;
      }
      const a = s.atCut;
      lines.push(`| ${split} (n=${a.n}) | ${ci(a.accuracy)} | ${ci(a.coverage)} | ${a.confidentErrors.noAction.k}/${a.confidentErrors.noAction.n} | ${a.confidentErrors.unrelated.k}/${a.confidentErrors.unrelated.n} | ${a.disposition ? ci(a.disposition) : "—"} | ${ci(s.answerEverything.accuracy)} |`);
    }
    const open = Object.entries(j.bySplit).filter(([, s]) => !s.sealed).at(-1);
    if (open) {
      lines.push(`\nper route, ${open[0]} split (accepted/right of n): ` + open[1].atCut.perRoute.map((p) => `${p.route} ${p.right}/${p.accepted} of ${p.n}`).join(" · "));
    }
  }
  if (r.runs.C?.unavailable) lines.push(`\n### C — unavailable\n${r.runs.C.unavailable}`);
  if (r.runs.Jev) lines.push(`\nJev this run: ${JSON.stringify(r.runs.Jev)}`);
  if (r.runs.B) lines.push(`B this run: ${JSON.stringify(r.runs.B)}`);
  lines.push(`\nthresholds frozen to ${r.thresholdsFile}`);
  return lines.join("\n");
}
