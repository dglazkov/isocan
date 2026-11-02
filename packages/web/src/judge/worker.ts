/**
 * **The judge's Worker** (local-judge phase 0) — the first `new Worker` in
 * the web app. It owns MediaPipe Decision Maker, the model and every
 * evaluation, so the page's main thread does none of it and the frame budget
 * is measured with it running rather than assumed.
 *
 * Written from the `@mediapipe/tasks-decision` 1.1.0 type declarations and
 * README. The brief named google-ai-edge/mediapipe-samples-web's
 * `src/workers/decision-maker.worker.ts` as the starting point; fetching it was
 * not among the downloads approved for this phase, so no sample commit is
 * recorded and nothing here is copied from it.
 *
 * **Same origin, by construction.**
 *
 * - The runtime (MediaPipe's wasm loader and binary) is imported with `?url`,
 *   so Vite copies it out of the package into `dist/assets/` and the daemon's
 *   static handler serves it. No CDN.
 * - The model is `GET /models/<name>` on this origin (the daemon, loopback
 *   only), kept in Cache Storage after the first load.
 * - **MediaPipe's own telemetry is refused here.** The 1.1.0 bundle builds a
 *   logger on every task that POSTs usage metrics to
 *   `https://odml.pa.googleapis.com/v1/log` with plain `fetch` (its README:
 *   "MediaPipe Tasks APIs send metrics about the performance and utilization
 *   of the APIs in your app to Google"). This Worker wraps `fetch` before
 *   MediaPipe loads: any request whose origin is not this one is refused and
 *   its ORIGIN recorded (never a body), so the lab and the privacy run can
 *   say what was attempted.
 */
import { DecisionMaker, type DecisionMakerOptions } from "@mediapipe/tasks-decision";
import wasmLoaderUrl from "@mediapipe/tasks-decision/decision_wasm_internal.js?url";
import wasmBinaryUrl from "@mediapipe/tasks-decision/decision_wasm_internal.wasm?url";
import { localModel, MODEL_CACHE, modelUrl, type DecisionQuestion, type DecisionResult } from "@isocan/core/local-judge";
import type { CspViolation, FromWorker, InitTimings, RefusedRequest, ToWorker } from "./protocol.ts";

interface WorkerScope {
  location: Location;
  fetch: typeof fetch;
  postMessage(message: FromWorker): void;
  onmessage: ((event: MessageEvent<ToWorker>) => void) | null;
  Module?: Record<string, unknown>;
}
const scope = self as unknown as WorkerScope;

// ---------- the fetch guard, before anything else can fetch

/**
 * The fetch guard is evidence, not the enforcement. What stops a request
 * leaving is the browser: this script is served with its own
 * `Content-Security-Policy` (`connect-src 'self'`, set by the daemon for
 * `judge-worker-*.js` only), which covers fetch, XMLHttpRequest, WebSocket and
 * sendBeacon alike. The guard records every cross-origin attempt by ORIGIN
 * and, unless the lab turns it off to prove the policy alone holds, refuses
 * it before the browser has to.
 */
const refused: RefusedRequest[] = [];
let guardOn = true;
const ownFetch = scope.fetch.bind(scope);
scope.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(raw, scope.location.href);
  if (url.origin !== scope.location.origin) {
    refused.push({ origin: url.origin, at: performance.now(), refusedBy: guardOn ? "guard" : "attempted" });
    if (guardOn) return Promise.reject(new TypeError(`the judge's Worker fetches only from ${scope.location.origin}`));
  }
  return ownFetch(input, init);
}) as typeof fetch;

/** What the browser's policy blocked in this Worker — the enforcement's own record. */
const violations: CspViolation[] = [];
(self as unknown as EventTarget).addEventListener("securitypolicyviolation", (event) => {
  const e = event as SecurityPolicyViolationEvent;
  let origin = e.blockedURI;
  try {
    origin = new URL(e.blockedURI).origin;
  } catch {
    // "inline", "eval" and the like are not URLs; keep the word.
  }
  violations.push({ blocked: origin, directive: e.effectiveDirective, disposition: e.disposition });
});
const takeViolations = () => violations.splice(0);

/** Refusals since the last message, handed back with it. */
const takeRefused = () => refused.splice(0);

// ---------- the model, from this origin, kept in Cache Storage

async function modelStream(name: string): Promise<{ reader: ReadableStreamDefaultReader<Uint8Array>; size: number; download: InitTimings["download"] }> {
  const model = localModel(name);
  if (!model) throw new Error(`no model called "${name}"`);
  const url = modelUrl(name);
  const t0 = performance.now();
  let cache: Cache | null = null;
  try {
    cache = await caches.open(MODEL_CACHE);
  } catch {
    cache = null; // no Cache Storage here: load from the daemon every time, and say so by `cached: false`
  }
  let hit = cache ? await cache.match(url) : undefined;
  let download: InitTimings["download"] = { bytes: 0, ms: 0, cached: Boolean(hit), source: "daemon" };
  if (!hit) {
    const res = await scope.fetch(url);
    if (!res.ok) throw new Error(res.status === 404 ? `${name} is not on this machine — \`isocan model fetch ${name}\` puts it there` : `the daemon answered ${res.status} for ${url}`);
    if (cache) {
      await cache.put(url, res);
      hit = await cache.match(url);
    } else {
      hit = res;
    }
    download = { bytes: model.bytes, ms: performance.now() - t0, cached: false, source: "daemon" };
  }
  if (!hit?.body) throw new Error(`the model at ${url} had no body`);
  const size = Number(hit.headers.get("content-length") ?? model.bytes);
  if (size !== model.bytes) throw new Error(`the model at ${url} is ${size} bytes, not the pinned ${model.bytes}`);
  return { reader: hit.body.getReader(), size, download };
}

// ---------- the engine

let maker: DecisionMaker | null = null;

/**
 * **The model from a file a person chose** — the phone's way in, where no
 * daemon on loopback can serve it. Its length must be the manifest's; its
 * SHA-256 is NOT computed here (165 MB through `crypto.subtle` on a phone is
 * the whole file in memory twice), so the report says the source was a file.
 */
function fileStream(name: string, file: File): { reader: ReadableStreamDefaultReader<Uint8Array>; size: number; download: InitTimings["download"] } {
  const model = localModel(name);
  if (!model) throw new Error(`no model called "${name}"`);
  if (file.size !== model.bytes) throw new Error(`that file is ${file.size} bytes; ${model.file} is ${model.bytes} — choose ${model.file}`);
  return { reader: file.stream().getReader() as ReadableStreamDefaultReader<Uint8Array>, size: file.size, download: { bytes: 0, ms: 0, cached: false, source: "file" } };
}

async function init(msg: Extract<ToWorker, { type: "init" }>): Promise<InitTimings> {
  if (maker) throw new Error("the judge is already initialised — close it first");
  guardOn = msg.fetchGuard !== false;
  const { reader, size, download } = msg.file ? fileStream(msg.model, msg.file) : await modelStream(msg.model);
  const t0 = performance.now();
  let runtimeAt = 0;
  // Ji in the bundle hands `self.Module` to the Emscripten factory as its
  // config, so this hook fires when the wasm is compiled and instantiated —
  // the line between loading the runtime and building the engine.
  scope.Module = { onRuntimeInitialized: () => (runtimeAt = performance.now()) };
  const options: DecisionMakerOptions = {
    baseOptions: { modelAssetBuffer: reader, delegate: msg.backend === "gpu" ? "GPU" : "CPU" },
    modelAssetSize: size,
    ...(msg.maxNumTokens ? { maxNumTokens: msg.maxNumTokens } : {}),
  };
  maker = await DecisionMaker.createFromOptions({ wasmLoaderPath: wasmLoaderUrl, wasmBinaryPath: wasmBinaryUrl }, options);
  const done = performance.now();
  if (msg.backend === "cpu") thenable(maker);
  if (!runtimeAt) runtimeAt = t0;
  // Whether MediaPipe got a WebGPU device at all (it asks for one whatever the
  // delegate). The delegate is what was asked; this is what was available.
  const webgpuDevice = Boolean((maker as unknown as { i?: { h?: { preinitializedWebGPUDevice?: unknown } } }).i?.h?.preinitializedWebGPUDevice);
  return { backend: msg.backend, download, loadMs: runtimeAt - t0, compileMs: done - runtimeAt, contextWindow: maker.contextWindow, thenablePatch: cpuThenablePatch, webgpuDevice, fetchGuard: guardOn };
}

/**
 * **A workaround for MediaPipe 1.1.0 on the CPU, said out loud.** The wasm is
 * an Asyncify build: an evaluation that suspends (the GPU's readback) returns
 * a Promise, and one that never suspends — every evaluation on the CPU
 * delegate — returns its value directly. The JS wrapper calls `.then` on it
 * either way, so every CPU evaluation throws "t(...).then is not a function".
 * Wrapping the module's evaluate and prewarm functions in `async` makes both
 * shapes a Promise and changes nothing they compute. The property path is
 * the minified bundle's (`maker.i.h`), so it is looked for rather than
 * assumed, and the report says whether it was applied.
 */
let cpuThenablePatch = false;
function thenable(m: DecisionMaker): void {
  const mod = (m as unknown as { i?: { h?: Record<string, unknown> } }).i?.h;
  if (!mod) return;
  for (const key of ["evaluateBoolean", "evaluateChoice", "evaluateScore", "evaluateSchema", "prewarmSchema"]) {
    const fn = mod[key];
    if (typeof fn !== "function") continue;
    mod[key] = async (...args: unknown[]) => (fn as (...a: unknown[]) => unknown).apply(mod, args);
    cpuThenablePatch = true;
  }
}

function engine(): DecisionMaker {
  if (!maker) throw new Error("the judge is not initialised");
  return maker;
}

async function evaluateOne(text: string, q: DecisionQuestion): Promise<DecisionResult> {
  const m = engine();
  if (q.kind === "choice") return { kind: "choice", result: await m.evaluateChoice(text, q.question) };
  if (q.kind === "score") {
    const r = await m.evaluateScore(text, q.question);
    return { kind: "score", result: { expectedScore: r.expectedScore, probabilities: r.probabilities, confidence: r.confidence } };
  }
  const r = await m.evaluateBoolean(text, q.question);
  return { kind: "boolean", result: r };
}

/** Prewarm: each question evaluated once against an empty context, so its prefix is cached before any real context arrives. */
async function prewarm(questions: Record<string, DecisionQuestion>): Promise<number> {
  const t0 = performance.now();
  for (const q of Object.values(questions)) await evaluateOne("", q);
  return performance.now() - t0;
}

/**
 * MediaPipe's own count of the tokens an evaluation reads — the questions and
 * the text — through its session schema. `contextUsage` after a per-question
 * `evaluateChoice` reads 0 in 1.1.0, so the schema is set for the count.
 */
async function countTokens(text: string, questions: Record<string, DecisionQuestion>): Promise<number> {
  const m = engine();
  m.setSchema({
    questions: Object.entries(questions).map(([id, q]) =>
      q.kind === "choice"
        ? { id, type: "choice" as const, prompt: q.question.instructions, options: Object.entries(q.question.criteria).map(([label, description]) => ({ label, description })) }
        : q.kind === "score"
          ? { id, type: "score" as const, prompt: q.question.instructions, options: q.question.rubric.map((description, i) => ({ label: String(i), description })) }
          : { id, type: "boolean" as const, prompt: q.question.condition, ...(q.question.options ? { options: q.question.options } : {}) },
    ),
  });
  return m.measureContextUsage(text);
}

scope.onmessage = async (event) => {
  const msg = event.data;
  try {
    if (msg.type === "init") {
      const timings = await init(msg);
      scope.postMessage({ type: "ok", id: msg.id, init: timings, refused: takeRefused(), violations: takeViolations() });
    } else if (msg.type === "prewarm") {
      scope.postMessage({ type: "ok", id: msg.id, prewarmMs: await prewarm(msg.questions), refused: takeRefused(), violations: takeViolations() });
    } else if (msg.type === "evaluate") {
      const t0 = performance.now();
      const results: Record<string, DecisionResult> = {};
      for (const [id, q] of Object.entries(msg.questions)) results[id] = await evaluateOne(msg.text, q);
      const ms = performance.now() - t0;
      const tokens = msg.countTokens ? await countTokens(msg.text, msg.questions) : undefined;
      scope.postMessage({ type: "ok", id: msg.id, results, ms, ...(tokens !== undefined ? { tokens } : {}), refused: takeRefused(), violations: takeViolations() });
    } else if (msg.type === "close") {
      // Closing flushes MediaPipe's metrics logger — its one sure attempt to
      // send. Give the attempt and the policy's verdict a moment to land
      // before answering, so both are in this reply's record.
      maker?.close();
      maker = null;
      await new Promise((r) => setTimeout(r, 1000));
      scope.postMessage({ type: "ok", id: msg.id, refused: takeRefused(), violations: takeViolations() });
    }
  } catch (err) {
    scope.postMessage({ type: "error", id: msg.id, message: err instanceof Error ? err.message : String(err), refused: takeRefused(), violations: takeViolations() });
  }
};
