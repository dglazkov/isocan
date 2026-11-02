/**
 * **The judge lab** (local-judge phase 0): the page that measures the judge
 * in the tab, every row the phase names, on one backend at a time.
 *
 * Opened by a person (the two buttons) or by `scripts/local-judge-measure.mjs`
 * through `window.__lab.run(...)`, which resolves with the same JSON the page
 * prints. It imports nothing from the app, and imports the client STATICALLY:
 * this page is its own entry, and a dynamic import here made Rollup split
 * Vite's preload helper out of the app's entry into a chunk both shared —
 * one more request on every first visit to the app. The app reaches the
 * client lazily; the lab does not need to.
 *
 * The scene under the buttons is a stand-in canvas — 250 absolutely placed
 * notes panned every frame — so the frame census has a main thread doing a
 * canvas's kind of work while the Worker is busy. It is NOT the app's canvas;
 * the report says so.
 *
 * Every text here is synthetic (Acme, made-up acts); nothing from a real
 * canvas is in this file or in what it measures.
 */
import type { JevQuestion, JevRequest } from "@isocan/core/jev";
import * as local from "./local.ts";
import type { Backend } from "./protocol.ts";

// ---------- the questions and the state, synthetic

const ACTS = [
  ["rename", "Give the item a new title"],
  ["move", "Put the item somewhere else on the canvas"],
  ["variation", "Make another version of the item to compare"],
  ["comment", "Leave a comment for a collaborator"],
  ["align", "Line items up along an edge"],
  ["find", "Find an item by what it is about"],
  ["none", "None of these; the person is just talking"],
  ["delete", "Remove the item"],
  ["group", "Put items together in a group"],
  ["colour", "Change the item's colour"],
  ["resize", "Make the item bigger or smaller"],
  ["duplicate", "Copy the item"],
  ["link", "Connect two items with an arrow"],
  ["pin", "Pin context for an agent to read"],
  ["summon", "Ask an agent to do something"],
  ["present", "Start presenting the canvas as slides"],
  ["zoom", "Zoom the view to an item"],
  ["undo", "Take back the last change"],
  ["export", "Save the canvas or an item as a file"],
  ["share", "Let someone else into the canvas"],
  ["react", "Mark an item with an emoji reaction"],
  ["tidy", "Arrange items neatly"],
  ["review", "Ask for a design review of a screen"],
  ["words", "Rewrite the words on a screen"],
  ["theme", "Change the canvas's colours or ground"],
  ["timeline", "Show what happened on the canvas recently"],
  ["archive", "Put the canvas away"],
  ["inbox", "Read what is waiting in the inbox"],
  ["voice", "Talk to the canvas out loud"],
  ["help", "Ask how something works"],
] as const;

function actsQuestion(n: number): JevQuestion {
  return { type: "choice", instructions: "Which act does the person's message ask for?", criteria: Object.fromEntries(ACTS.slice(0, n).map(([k, d]) => [k, d])) };
}

const WORDS = "acme note screen review layout button header footer card list title move rename colour group align panel draft sketch login signup checkout settings profile search filter result empty error loading spinner modal drawer menu icon label value chart table grid column row link arrow comment reply thread version compare choose".split(" ");

/** A synthetic message of `words` words, varied by `seed` so no two runs read the same text. */
function message(words: number, seed: number): string {
  const out: string[] = [];
  let x = (seed * 2654435761) >>> 0;
  for (let i = 0; i < words; i++) {
    x = (Math.imul(x ^ (x >>> 13), 1103515245) + 12345) >>> 0;
    out.push(WORDS[x % WORDS.length]!);
  }
  return `Please ${out.join(" ")}.`;
}

// ---------- statistics

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))]!;
}
const r2 = (n: number) => Math.round(n * 100) / 100;
function summary(ms: number[]) {
  const s = [...ms].sort((a, b) => a - b);
  return { n: s.length, p50: r2(pct(s, 0.5)), p95: r2(pct(s, 0.95)), p99: r2(pct(s, 0.99)), mean: r2(s.reduce((a, b) => a + b, 0) / Math.max(1, s.length)), max: r2(s[s.length - 1] ?? NaN) };
}
function frameStats(gaps: number[]) {
  const s = [...gaps].sort((a, b) => a - b);
  return { frames: s.length, p50: r2(pct(s, 0.5)), p90: r2(pct(s, 0.9)), p99: r2(pct(s, 0.99)), worst: r2(s[s.length - 1] ?? 0), over16: s.filter((x) => x > 16.7).length, over20: s.filter((x) => x > 20).length, over32: s.filter((x) => x > 32).length };
}

/**
 * **The shape of the tail**: how many answers took over twice the median, and
 * whether they came in streaks (something else on the machine, a power state)
 * or scattered (the instrument itself). A p95 alone cannot tell the two apart.
 */
function slowness(ms: number[]) {
  const s = [...ms].sort((a, b) => a - b);
  const cut = 2 * pct(s, 0.5);
  let longest = 0;
  let run = 0;
  let streaks = 0;
  for (const x of ms) {
    if (x > cut) {
      if (run === 0) streaks++;
      run++;
      longest = Math.max(longest, run);
    } else run = 0;
  }
  return { over2xMedian: ms.filter((x) => x > cut).length, streaks, longestStreak: longest, firstSlowAt: ms.findIndex((x) => x > cut) };
}

// ---------- the stand-in scene

const scene = document.getElementById("scene")!;
const notes: HTMLElement[] = [];
for (let i = 0; i < 250; i++) {
  const el = document.createElement("div");
  el.textContent = `Acme note ${i + 1}`;
  notes.push(el);
  scene.appendChild(el);
}
/** Pan the scene every frame for `ms`, and return the gaps between frames. */
function census(ms: number): Promise<number[]> {
  return new Promise((resolve) => {
    const gaps: number[] = [];
    const start = performance.now();
    let last = start;
    const step = (now: number) => {
      gaps.push(now - last);
      last = now;
      const dx = ((now - start) / 20) % 400;
      for (let i = 0; i < notes.length; i++) notes[i]!.style.transform = `translate(${((i % 25) * 100 - dx) | 0}px, ${Math.floor(i / 25) * 60}px)`;
      if (now - start < ms) requestAnimationFrame(step);
      else resolve(gaps.slice(1));
    };
    requestAnimationFrame((t) => {
      last = t;
      requestAnimationFrame(step);
    });
  });
}

// ---------- the run

export interface LabOptions {
  backend: Backend;
  /** Warm answers per configuration (the phase asks for at least 1,000). */
  n?: number;
  tokens?: number[];
  options?: number[];
  /** Skip the input-to-display and frame rows — for a quick look at the warm rows alone. */
  warmOnly?: boolean;
  displayRuns?: number;
  censusMs?: number;
  maxNumTokens?: number;
  /** Off only to prove the browser's policy holds without the Worker's own refusal. Default on. */
  fetchGuard?: boolean;
  /** Load the model from the chosen file even when the daemon serves it (`?file=1`). */
  fromFile?: boolean;
}

const out = document.getElementById("out")!;
const answerEl = document.getElementById("answer")!;
const progressEl = document.getElementById("progress")!;
/** One line saying where a run is, so a person can tell it is working. */
const progress = (line: string) => {
  progressEl.textContent = line;
};
const log = (line: string) => {
  out.textContent += `${line}\n`;
};

async function run(opts: LabOptions) {
  // Clamped to 10–1,000: a phone at 1,000 per row on its CPU is hours, and fewer than 10 is not a percentile.
  const n = Math.min(1000, Math.max(10, Math.round(opts.n ?? 1000)));
  const tokenTargets = opts.tokens ?? [32, 128, 512];
  const optionCounts = opts.options ?? [7, 30];
  out.textContent = "";
  const probe = await local.probe();
  log(`probe: ${probe.words}`);
  if (!probe.ok) return { probe };
  if (opts.backend === "gpu" && !probe.webgpu) return { probe, error: "no WebGPU adapter in this browser — GPU not measured" };

  // The model's source: this origin's daemon, else the file a person chose, else words and nothing downloads.
  const source = await local.modelSource();
  const file = fileInput.files?.[0];
  const useFile = opts.fromFile || params.has("file") || !source.daemon;
  if (useFile && !file) {
    log(source.daemon ? "Choose the model file first (?file=1 asks for the file)." : source.words);
    return { probe, error: "no model source: the daemon does not serve it here and no file was chosen" };
  }
  const judge = local.localJudge({ backend: opts.backend, ...(opts.maxNumTokens ? { maxNumTokens: opts.maxNumTokens } : {}), ...(useFile && file ? { file } : {}), ...(opts.fetchGuard === false ? { fetchGuard: false } : {}) });
  const t0 = performance.now();
  progress("loading the model and preparing the judge…");
  const readiness = await judge.ready([actsQuestion(7)]);
  const readyMs = performance.now() - t0;
  log(`ready on ${readiness.backend}: ${JSON.stringify(readiness)}`);

  const ask = (text: string, options: number): JevRequest => ({ model: "local", state: text, questions: { act: actsQuestion(options) } });

  // First answer after ready: the cost a person meets once.
  const first = await judge.evaluate(ask(message(24, 1), 7), { countTokens: true });
  const firstAnswer = { ms: r2(first.answered.ms), workerMs: r2(first.workerMs), tokens: first.tokens, choice: (first.answered.response.answers.act as { choice: string }).choice };
  log(`first answer: ${JSON.stringify(firstAnswer)}`);
  const contextWindow = judge.init?.contextWindow ?? 0;

  // Token calibration: what the question alone costs (MediaPipe's count),
  // then the words that make the state come to the target. A count that
  // never moves stops the search rather than growing the text without bound.
  const rows: unknown[] = [];
  const rowCount = optionCounts.length * tokenTargets.length;
  let rowAt = 0;
  for (const options of optionCounts) {
    const empty = (await judge.evaluate(ask("", options), { countTokens: true })).tokens ?? 0;
    for (const target of tokenTargets) {
      rowAt++;
      progress(`row ${rowAt} of ${rowCount} (${options} options, ~${target} tokens): calibrating`);
      let words = Math.max(1, Math.round(target * 0.8));
      let got = 0;
      let total = 0;
      for (let i = 0; i < 6; i++) {
        total = (await judge.evaluate(ask(message(words, 7), options), { countTokens: true })).tokens ?? 0;
        got = total - empty;
        if (got <= 0 || Math.abs(got - target) <= Math.max(2, target * 0.03)) break;
        words = Math.max(1, Math.round((words * target) / got));
      }
      if (contextWindow > 0 && total > contextWindow) {
        const row = { targetTokens: target, stateTokens: got, totalTokens: total, questionTokens: empty, options, words, skipped: `over the model's context window of ${contextWindow} tokens` };
        rows.push(row);
        log(`${options} options, ~${target} tokens: ${JSON.stringify(row)}`);
        continue;
      }
      let errors = 0;
      let lastError = "";
      const round: number[] = [];
      const worker: number[] = [];
      for (let i = 0; i < 20; i++) await judge.evaluate(ask(message(words, 1000 + i), options)).catch(() => undefined);
      for (let i = 0; i < n; i++) {
        if (i % 10 === 0) progress(`row ${rowAt} of ${rowCount} (${options} options, ~${target} tokens), ${i}/${n}`);
        try {
          const r = await judge.evaluate(ask(message(words, i + 1), options));
          round.push(r.answered.ms);
          worker.push(r.workerMs);
        } catch (err) {
          errors++;
          lastError = err instanceof Error ? err.message : String(err);
          if (errors > 20) break;
        }
      }
      const row = { targetTokens: target, stateTokens: got, totalTokens: total, questionTokens: empty, options, words, roundTrip: summary(round), inWorker: summary(worker), slow: slowness(worker), errors, ...(lastError ? { lastError } : {}) };
      rows.push(row);
      log(`${options} options, ~${target} tokens: ${JSON.stringify(row)}`);
    }
  }

  if (opts.warmOnly) {
    const initQuick = judge.init;
    await judge.close();
    const quick = { backend: readiness.backend, n, init: initQuick, readiness, firstAnswer, warm: rows, ...policyRecord(judge, initQuick) };
    out.textContent = JSON.stringify(quick, null, 2);
    return quick;
  }

  // Input to displayed result: from the moment of "input" to the frame that shows the answer.
  progress("input to displayed result: 100 answers");
  const display: number[] = [];
  for (let i = 0; i < (opts.displayRuns ?? 100); i++) {
    const input = performance.now();
    const r = await judge.evaluate(ask(message(100, 5000 + i), 7));
    answerEl.textContent = `→ ${(r.answered.response.answers.act as { choice: string }).choice}`;
    await new Promise<void>((res) => requestAnimationFrame(() => setTimeout(res, 0)));
    display.push(performance.now() - input);
  }
  const inputToDisplay = summary(display);
  log(`input to displayed: ${JSON.stringify(inputToDisplay)}`);

  // Frame census: the stand-in scene panning, the Worker idle, then busy.
  const censusMs = opts.censusMs ?? 5000;
  progress("frame census: idle, then with the judge busy");
  const idle = frameStats(await census(censusMs));
  let busy = true;
  let busyAnswers = 0;
  const load = (async () => {
    while (busy) {
      await judge.evaluate(ask(message(100, 9000 + busyAnswers), 30));
      busyAnswers++;
    }
  })();
  const loaded = frameStats(await census(censusMs));
  busy = false;
  await load;
  const frames = { scene: "lab stand-in: 250 absolutely placed notes panned every frame — not the app's canvas", idle, workerBusy: { ...loaded, answersDuring: busyAnswers } };
  log(`frames: ${JSON.stringify(frames)}`);

  const init = judge.init;
  await judge.close();
  const result = {
    backend: readiness.backend,
    n,
    model: local.LOCAL_MODEL,
    runtime: local.MEDIAPIPE_VERSION,
    probe,
    userAgent: navigator.userAgent,
    contextWindow: contextWindow || null,
    thenablePatch: init?.thenablePatch ?? null,
    webgpuDevice: init?.webgpuDevice ?? null,
    modelSource: init?.download.source ?? null,
    readiness: { ...readiness, totalMs: r2(readyMs) },
    firstAnswer,
    warm: rows,
    inputToDisplay,
    frames,
    ...policyRecord(judge, init),
  };
  out.textContent = JSON.stringify(result, null, 2);
  return result;
}

/** What tried to leave, and what stopped it: the Worker's guard (evidence) and the browser's policy (enforcement). */
function policyRecord(judge: local.LocalJudge, init: { fetchGuard: boolean } | null) {
  return {
    fetchGuard: init?.fetchGuard ?? null,
    crossOriginAttempts: judge.refused.map((r) => `${r.origin} (${r.refusedBy === "guard" ? "refused by the guard" : "guard off: left to the browser"})`),
    cspViolations: [...judge.violations.map((v) => `worker ${v.directive} ${v.disposition}: ${v.blocked}`), ...pageViolations],
  };
}

/**
 * **One question over many texts** (local-judge phase 1's judge B): the
 * harness (`scripts/local-judge/harness.mjs`) hands a question and the state
 * texts, and gets each text's whole distribution back, with MediaPipe's count
 * of the tokens it read. Nothing is timed here and nothing leaves the page:
 * the texts arrive over the debugging protocol on this machine and go only
 * to the Worker.
 */
async function route(opts: { backend: Backend; question: JevQuestion; texts: string[]; countTokens?: boolean; maxNumTokens?: number }) {
  out.textContent = "";
  const probe = await local.probe();
  if (!probe.ok) return { probe, error: probe.words };
  if (opts.backend === "gpu" && !probe.webgpu) return { probe, error: "no WebGPU adapter in this browser" };
  const judge = local.localJudge({ backend: opts.backend, ...(opts.maxNumTokens ? { maxNumTokens: opts.maxNumTokens } : {}) });
  const readiness = await judge.ready([opts.question]);
  const answers: Array<{ probabilities: Record<string, number>; choice: string; tokens: number | null; ms: number } | { error: string }> = [];
  for (const [i, text] of opts.texts.entries()) {
    if (i % 25 === 0) progress(`${i} of ${opts.texts.length}`);
    try {
      const r = await judge.evaluate({ model: "local", state: text, questions: { q: opts.question } }, { countTokens: opts.countTokens === true });
      const a = r.answered.response.answers.q as { choice: string; probabilities: Record<string, number> };
      answers.push({ probabilities: a.probabilities, choice: a.choice, tokens: r.tokens, ms: r2(r.workerMs) });
    } catch (err) {
      answers.push({ error: err instanceof Error ? err.message : String(err) });
    }
  }
  const init = judge.init;
  await judge.close();
  progress(`done: ${opts.texts.length}`);
  return { backend: readiness.backend, model: local.LOCAL_MODEL, runtime: local.MEDIAPIPE_VERSION, contextWindow: init?.contextWindow ?? null, answers, ...policyRecord(judge, init) };
}

declare global {
  interface Window {
    __lab: { run: typeof run; route: typeof route };
  }
}
window.__lab = { run, route };

const params = new URLSearchParams(location.search);
const fileInput = document.getElementById("model-file") as HTMLInputElement;
const fileRow = document.getElementById("file-row")!;
const pageViolations: string[] = [];
document.addEventListener("securitypolicyviolation", (e) => pageViolations.push(`page ${e.effectiveDirective} ${e.disposition}: ${e.blockedURI}`));

void (async () => {
  const [p, source] = await Promise.all([local.probe(), local.modelSource()]);
  document.getElementById("probe")!.textContent = `${p.words} ${source.words}`;
  if (!source.daemon || params.has("file")) fileRow.hidden = false;
})();
document.getElementById("copy")!.addEventListener("click", () => {
  void navigator.clipboard.writeText(out.textContent ?? "").then(
    () => log("Copied."),
    () => log("Could not copy here — select the text above and copy it by hand."),
  );
});
/** `?n=200` sets the answers per row for the buttons (default 1,000; clamped to 10–1,000 in `run`). */
const buttonN = Number(params.get("n") ?? 1000) || 1000;
const press = (backend: Backend) => () =>
  void run({ backend, n: buttonN })
    .then(() => progress("done — Copy results puts the JSON on the clipboard"))
    .catch((e) => {
      progress("stopped");
      log(String(e));
    });
document.getElementById("run-gpu")!.addEventListener("click", press("gpu"));
document.getElementById("run-cpu")!.addEventListener("click", press("cpu"));
