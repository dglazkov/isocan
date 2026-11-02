/**
 * **The `local` Answerer** (local-judge phase 0; design *The seam*): answers
 * a `JevRequest` in this browser, in a Worker, with EmbeddingGemma 2 through
 * MediaPipe Decision Maker — the same request, the same `Answered`, so a
 * caller that asks Jev today asks this without changing its question file.
 *
 * Nothing imports this statically. A caller reaches it with
 * `await import("./judge/local.ts")` at the moment the person turns the judge
 * on (the pattern `@isocan/core/jev` already uses), so the Worker, MediaPipe
 * and the wasm URL are never in the entry chunk. Phase 0 has no product
 * surface: the lab page (`judge-lab.html`) is its only caller.
 *
 * **Absent is the product as it is.** `probe()` says whether this browser can
 * run it — Workers, WebAssembly, WebGPU — in words, before anything
 * downloads (journey Scene 5). The CPU backend is a different instrument and
 * `by` says which one answered.
 */
import type { Answered, JevQuestion, JevRequest, LocalAnswerer, Readiness } from "@isocan/core/jev";
import { jevToDecision, localAnswered, localModel, stateText, type DecisionQuestion, type DecisionResult } from "@isocan/core/local-judge";
import type { Backend, CspViolation, FromWorker, InitTimings, RefusedRequest, ToWorker } from "./protocol.ts";

export const LOCAL_MODEL = "embeddinggemma-2-text-270m";
export const MEDIAPIPE_VERSION = "@mediapipe/tasks-decision 1.1.0";

/** Can this browser run the judge, and on what — measured, not guessed. */
export interface Probe {
  ok: boolean;
  webgpu: boolean;
  /** Why not, or what it will cost, in a sentence for a person. */
  words: string;
  adapter?: string;
}

export async function probe(): Promise<Probe> {
  const bytes = localModel(LOCAL_MODEL)!.bytes;
  const size = `${Math.round(bytes / 1_000_000)} MB`;
  if (typeof Worker === "undefined" || typeof WebAssembly === "undefined") {
    return { ok: false, webgpu: false, words: "This browser cannot run the judge in the tab: it has no Web Workers or no WebAssembly. Nothing was downloaded; the home's judge still answers." };
  }
  const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<{ info?: { vendor?: string; architecture?: string } } | null> } }).gpu;
  let adapter: { info?: { vendor?: string; architecture?: string } } | null = null;
  try {
    adapter = gpu ? await gpu.requestAdapter() : null;
  } catch {
    adapter = null;
  }
  const name = adapter?.info ? [adapter.info.vendor, adapter.info.architecture].filter(Boolean).join(" ") : undefined;
  if (!adapter) {
    return { ok: true, webgpu: false, words: `No WebGPU here, so the judge would run on the CPU — slower, and reported as CPU. It needs ${size} once, from this machine.` };
  }
  return { ok: true, webgpu: true, words: `WebGPU is available${name ? ` (${name})` : ""}. The judge needs ${size} once, from this machine.`, ...(name ? { adapter: name } : {}) };
}

/**
 * **Where the model can come from here**: this origin's `/models/<name>` (a
 * local daemon, loopback only), or nothing — a hosted home answers 404, and a
 * phone cannot reach a laptop's loopback. Then the person may choose the
 * file; `words` says so.
 */
export async function modelSource(model = LOCAL_MODEL): Promise<{ daemon: boolean; words: string }> {
  const m = localModel(model)!;
  const daemon = await fetch(`/models/${encodeURIComponent(model)}`, { method: "HEAD" }).then((r) => r.ok, () => false);
  return daemon
    ? { daemon, words: `This machine's daemon serves ${m.name}.` }
    : { daemon, words: `This page cannot load the model from here: no daemon on this machine serves /models/${m.name} (on a laptop, \`isocan model fetch ${m.name}\` puts it there). Choose the file ${m.file} (${Math.round(m.bytes / 1_000_000)} MB) instead — it is read in this tab and goes nowhere else.` };
}

/** The Worker, spoken to by request id. */
class Channel {
  private next = 1;
  private waiting = new Map<number, { resolve: (m: Extract<FromWorker, { type: "ok" }>) => void; reject: (e: Error) => void }>();
  /** Every cross-origin request the Worker's guard refused, by origin — for the lab's privacy record. */
  readonly refused: RefusedRequest[] = [];
  /** Every request the browser's policy blocked in the Worker. */
  readonly violations: CspViolation[] = [];
  constructor(private worker: Worker) {
    worker.onmessage = (event: MessageEvent<FromWorker>) => {
      const m = event.data;
      if (m.refused?.length) this.refused.push(...m.refused);
      if (m.violations?.length) this.violations.push(...m.violations);
      const w = this.waiting.get(m.id);
      if (!w) return;
      this.waiting.delete(m.id);
      if (m.type === "ok") w.resolve(m);
      else w.reject(new Error(m.message));
    };
    worker.onerror = (event) => {
      for (const w of this.waiting.values()) w.reject(new Error(`the judge's Worker failed: ${event.message}`));
      this.waiting.clear();
    };
  }
  ask<T extends ToWorker["type"]>(msg: Omit<Extract<ToWorker, { type: T }>, "id">): Promise<Extract<FromWorker, { type: "ok" }>> {
    const id = this.next++;
    return new Promise((resolve, reject) => {
      this.waiting.set(id, { resolve, reject });
      this.worker.postMessage({ ...msg, id } as ToWorker);
    });
  }
  terminate() {
    this.worker.terminate();
  }
}

function decisions(questions: Record<string, JevQuestion>): Record<string, DecisionQuestion> {
  return Object.fromEntries(Object.entries(questions).map(([id, q]) => [id, jevToDecision(q)]));
}

export interface LocalJudge extends LocalAnswerer {
  /** The backend asked for; `ready()` says the one that ran. */
  readonly backend: Backend;
  /** Answer and also return the raw per-question results and the tokens the model read — for the lab. */
  evaluate(request: JevRequest, opts?: { countTokens?: boolean }): Promise<{ answered: Answered; results: Record<string, DecisionResult>; workerMs: number; tokens: number | null }>;
  readonly refused: RefusedRequest[];
  readonly violations: CspViolation[];
  close(): Promise<void>;
  /** Init timings, once ready. */
  readonly init: InitTimings | null;
}

/**
 * **A local judge on one backend.** `ready()` starts the Worker, loads the
 * model (Cache Storage, else this origin's `/models/<name>`), builds the
 * engine and prewarms the questions; each part is timed apart.
 */
export function localJudge(opts: { backend: Backend; model?: string; maxNumTokens?: number; file?: File; fetchGuard?: boolean }): LocalJudge {
  const model = opts.model ?? LOCAL_MODEL;
  let channel: Channel | null = null;
  let init: InitTimings | null = null;
  // Kept past close(), which is when MediaPipe's logger makes its attempt.
  const refusedSoFar: RefusedRequest[] = [];
  const violationsSoFar: CspViolation[] = [];
  const by = () => `${model} (${opts.backend}) via ${MEDIAPIPE_VERSION}`;
  const open = () => (channel ??= new Channel(new Worker(new URL("./worker.ts", import.meta.url), { type: "classic", name: "isocan-judge" })));

  const judge: LocalJudge = {
    name: "local",
    backend: opts.backend,
    get refused() {
      return refusedSoFar.concat(channel?.refused ?? []);
    },
    get violations() {
      return violationsSoFar.concat(channel?.violations ?? []);
    },
    get init() {
      return init;
    },
    async ready(questions: JevQuestion[]): Promise<Readiness> {
      const c = open();
      if (!init) {
        const m = await c.ask<"init">({ type: "init", backend: opts.backend, model, ...(opts.maxNumTokens ? { maxNumTokens: opts.maxNumTokens } : {}), ...(opts.file ? { file: opts.file } : {}), ...(opts.fetchGuard === false ? { fetchGuard: false } : {}) });
        init = m.init!;
      }
      const qs = Object.fromEntries(questions.map((q, i) => [String(i), jevToDecision(q)]));
      const p = await c.ask<"prewarm">({ type: "prewarm", questions: qs });
      // A GPU delegate with no WebGPU device ran on something else: never report it as GPU.
      const ran: Backend = init.backend === "gpu" && !init.webgpuDevice ? "cpu" : init.backend;
      return { backend: ran, download: init.download, loadMs: init.loadMs, compileMs: init.compileMs, prewarmMs: p.prewarmMs ?? 0 };
    },
    async evaluate(request, evalOpts = {}) {
      const c = open();
      if (!init) throw new Error("the local judge is not ready — call ready() first");
      const t0 = performance.now();
      const m = await c.ask<"evaluate">({ type: "evaluate", text: stateText(request.state), questions: decisions(request.questions), ...(evalOpts.countTokens ? { countTokens: true } : {}) });
      const ms = performance.now() - t0;
      const results = m.results!;
      return { answered: localAnswered(request, results, { ms, by: by(), ...(m.tokens !== undefined ? { inputTokens: m.tokens } : {}) }), results, workerMs: m.ms ?? 0, tokens: m.tokens ?? null };
    },
    async answer(request) {
      return (await judge.evaluate(request)).answered;
    },
    async close() {
      if (!channel) return;
      await channel.ask<"close">({ type: "close" }).catch(() => undefined);
      refusedSoFar.push(...channel.refused);
      violationsSoFar.push(...channel.violations);
      channel.terminate();
      channel = null;
      init = null;
    },
  };
  return judge;
}
