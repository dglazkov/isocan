/**
 * **The answerer seam** (design §4, *The answerer is a seam*).
 *
 * A round is a question file in Jev's own request shape — one `state`, named
 * questions — and its answers come back in Jev's response shape. Four things
 * answer it: Jev over HTTP with a key of your own, the home (Jev through the
 * home's `/api/judgment`, with the home's key — what the web uses, so no key
 * ever reaches a browser), a seeded uniform stub, and an agent through
 * `isocan wire questions` / `wire answer`. The composer never knows which.
 *
 * Shaped as judge's `Judgment` seam will be (`docs/projects/judge/design.md`):
 * the full distribution comes back, `confidence` is kept apart from the
 * probability, and what a call cost is returned rather than estimated — so
 * when judge phase 2 lands that interface in core, `jevAnswerer` becomes one
 * implementation of it rather than a second client.
 *
 * Pure except for `fetch`, which every surface has. No Node import.
 *
 * **Moved to core on 23 Sep 2026** (voice-agent phase 6) from the wireframe
 * module, whose `answerer.ts` now re-exports it: the talk module's fast path
 * is the second caller, and a module importing another module is a module
 * that cannot be removed on its own. A subpath (`@isocan/core/jev`) rather
 * than the barrel, so nothing here can reach a first visit's bytes.
 */
import { JUDGMENT_UNAVAILABLE } from "./judgment.ts";
import type { TextRequest, TextResponse } from "./text.ts";

/** Where Jev answers for a caller holding its own key — the CLI and the measurement scripts; the web never calls it (the home does). */
export const JEV_URL = "https://api.typesafe.ai/v1/systemone";
/** The vendor's moving alias, named in every request so an upgrade needs no deploy; the versioned model that answered comes back as `by`. */
export const JEV_MODEL = "jev-latest";
/** $ per input token — $0.042 per million, output billed at zero (judge phase 0). */
export const JEV_INPUT_PRICE = 0.042 / 1_000_000;

/** One named question in Jev's own request shape — yes/no, a choice among named options, or a level on a scale. */
export type JevQuestion =
  | { type: "noul"; instructions: string; criteria?: { true: string; false: string } }
  | { type: "choice"; instructions: string; criteria: Record<string, string | null> }
  | { type: "score"; instructions: string; criteria: string[] };

/** A question file: one `state` the questions are about, and the questions by name — what every answerer takes. */
export interface JevRequest {
  model: string;
  state: unknown;
  questions: Record<string, JevQuestion>;
}

/** One answer, typed like its question; a choice or score carries its whole distribution, which is what a threshold is read from. */
export type JevAnswer =
  | { type: "noul"; noul: number }
  | { type: "choice"; choice: string; probabilities: Record<string, number>; confidence?: number }
  | { type: "score"; score: number; probabilities: Record<string, number>; legend?: Record<string, string>; confidence?: number };

/** A question file answered: one answer per question, and the input tokens that priced it. */
export interface JevResponse {
  model?: string;
  answers: Record<string, JevAnswer>;
  usage?: { input_tokens: number; output_tokens: number };
}

/** One call answered, with what it cost — measured by the caller, as judge's `spent` is. */
export interface Answered {
  response: JevResponse;
  ms: number;
  /** Which answerer, and for Jev the versioned model that answered (`jev-1.13.0`). */
  by: string;
}

/** The seam every surface asks through — Jev with a key, the home, or the seeded stub — so a composer never knows which answered. */
export interface Answerer {
  /** The agent answers through `wire questions` / `wire answer`, not through this interface. */
  name: "jev" | "stub" | "home";
  answer(request: JevRequest): Promise<Answered>;
}

/**
 * **Every way a response can fail its request, in words** — and a 422's own
 * body among them. Empty means every question has an answer of its own type
 * over its own options. The composer refuses a response with any of these,
 * so an agent's hand-written answer file cannot put an option on a screen
 * that the question never offered.
 */
export function responseProblems(request: JevRequest, body: unknown): string[] {
  const res = body as Partial<JevResponse> & { detail?: unknown } | null;
  if (!res || typeof res !== "object") return ["a response is a JSON object with `answers`"];
  if (res.detail !== undefined) return [`the answerer refused the request: ${detailText(res.detail)}`];
  if (!res.answers || typeof res.answers !== "object") return ["a response has `answers`, one per question"];
  const problems: string[] = [];
  const isP = (v: unknown) => typeof v === "number" && v >= 0 && v <= 1;
  for (const [id, q] of Object.entries(request.questions)) {
    const a = res.answers[id] as Partial<JevAnswer> & Record<string, unknown> | undefined;
    const where = `answer "${id}"`;
    if (!a || typeof a !== "object") {
      problems.push(`${where} is missing`);
      continue;
    }
    if (a.type !== q.type) {
      problems.push(`${where} must be a ${q.type}, not ${String(a.type)}`);
      continue;
    }
    if (q.type === "noul") {
      if (!isP(a.noul)) problems.push(`${where}: noul must be a number 0–1`);
      continue;
    }
    const keys = q.type === "choice" ? Object.keys(q.criteria) : q.criteria.map((_, i) => String(i));
    const probs = a.probabilities as Record<string, unknown> | undefined;
    if (!probs || typeof probs !== "object") {
      problems.push(`${where}: probabilities are missing`);
      continue;
    }
    for (const [k, v] of Object.entries(probs)) {
      if (!keys.includes(k)) problems.push(`${where}: "${k}" is not one of its options (${keys.join(", ")})`);
      else if (!isP(v)) problems.push(`${where}: probability of "${k}" must be 0–1`);
    }
    if (q.type === "choice" && !keys.includes(String(a.choice))) problems.push(`${where}: choice "${String(a.choice)}" is not one of ${keys.join(", ")}`);
    if (q.type === "score" && typeof a.score !== "number") problems.push(`${where}: score must be a number`);
  }
  for (const id of Object.keys(res.answers)) if (!(id in request.questions)) problems.push(`answer "${id}" answers no question`);
  return problems;
}

/** Throws with every problem, or returns the response typed. */
export function readResponse(request: JevRequest, body: unknown, from = "the answerer"): JevResponse {
  const problems = responseProblems(request, body);
  if (problems.length > 0) throw new Error(`${from} gave answers this cannot apply:\n  ${problems.join("\n  ")}`);
  return body as JevResponse;
}

/** Jev's error bodies have two shapes (judge phase 0): an object on 401, an array on 422. */
function detailText(detail: unknown): string {
  if (Array.isArray(detail)) {
    return detail.map((d) => {
      const e = d as { loc?: unknown[]; msg?: string };
      return `${(e.loc ?? []).join(".")}: ${e.msg ?? JSON.stringify(d)}`;
    }).join("; ");
  }
  if (detail && typeof detail === "object") {
    const e = detail as { message?: string; error_type?: string };
    return e.message ?? e.error_type ?? JSON.stringify(detail);
  }
  return String(detail);
}

/**
 * **The option an answer picks — argmax, never a sample.** A choice carries
 * its own argmax; a score's is the most probable level, a tie going to the
 * level nearest the weighted `score`; a noul is yes at 0.5 or more.
 */
export function chosenOption(q: JevQuestion, a: JevAnswer): { value: string; p: number; distribution: Record<string, number> } {
  if (q.type === "noul" && a.type === "noul") {
    const yes = a.noul >= 0.5;
    return { value: yes ? "true" : "false", p: yes ? a.noul : 1 - a.noul, distribution: { true: a.noul, false: 1 - a.noul } };
  }
  if (q.type === "choice" && a.type === "choice") {
    const distribution = Object.fromEntries(Object.keys(q.criteria).map((k) => [k, a.probabilities[k] ?? 0]));
    return { value: a.choice, p: distribution[a.choice] ?? 0, distribution };
  }
  if (q.type === "score" && a.type === "score") {
    const levels = q.criteria.map((_, i) => a.probabilities[String(i)] ?? 0);
    const top = Math.max(...levels);
    let best = 0;
    levels.forEach((p, i) => {
      if (p === top && (levels[best] !== top || Math.abs(i - a.score) < Math.abs(best - a.score))) best = i;
    });
    return { value: q.criteria[best]!, p: top, distribution: Object.fromEntries(q.criteria.map((c, i) => [c, levels[i]!])) };
  }
  throw new Error(`a ${q.type} question answered as ${a.type}`);
}

// ---------- the stub

/** mulberry32: small, seedable, and the same on every platform. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * **The uniform stub** — judge's first-class stand-in. Its distributions are
 * flat (`1/n` on every option, 0.5 on every yes/no), so they honestly say "no
 * idea"; its pick is a uniform draw, deterministic under the seed and the
 * question's own id, so one request answers the same way every time and two
 * rounds never share a stream. What the tests use, and what runs with no key.
 */
export function stubAnswerer(seed = 1): Answerer {
  return {
    name: "stub",
    async answer(request) {
      const answers: Record<string, JevAnswer> = {};
      for (const [id, q] of Object.entries(request.questions)) {
        const draw = seeded(seed ^ hash(`${JSON.stringify(request.state)}|${id}`))();
        if (q.type === "noul") {
          answers[id] = { type: "noul", noul: Math.round(draw * 100) / 100 };
        } else if (q.type === "choice") {
          const keys = Object.keys(q.criteria);
          answers[id] = { type: "choice", choice: keys[Math.floor(draw * keys.length)]!, probabilities: Object.fromEntries(keys.map((k) => [k, 1 / keys.length])), confidence: 0 };
        } else {
          const pick = Math.floor(draw * q.criteria.length);
          answers[id] = { type: "score", score: pick, probabilities: Object.fromEntries(q.criteria.map((_, i) => [String(i), 1 / q.criteria.length])), confidence: 0 };
        }
      }
      return { response: { model: "stub", answers, usage: { input_tokens: 0, output_tokens: 0 } }, ms: 0, by: `stub (seed ${seed})` };
    },
  };
}

// ---------- Jev

interface JevOptions {
  key: string | undefined;
  fetch?: typeof fetch;
  /** Waits before each retry of a 429 or 529, in ms. */
  backoff?: readonly number[];
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

/**
 * **Jev, over HTTP.** `POST /v1/systemone` with the key as a bearer token.
 * A 429 or 529 is retried with backoff (the documented advice); a 401 or 422
 * is a refusal that says what Jev said, in either of its two body shapes. No
 * key is a refusal before any request — never a silent fall back to the stub,
 * which would put random screens on a canvas under Jev's name.
 */
export function jevAnswerer(opts: JevOptions): Answerer {
  const key = opts.key;
  if (!key) throw new Error("the Jev answerer needs TYPESAFE_API_KEY in the environment — or `--answerer stub` (random, seeded) or `--answerer agent` (answer the questions yourself)");
  const doFetch = opts.fetch ?? fetch;
  const backoff = opts.backoff ?? [500, 1000, 2000, 4000];
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = opts.now ?? (() => Date.now());
  return {
    name: "jev",
    async answer(request) {
      for (let attempt = 0; ; attempt++) {
        const t0 = now();
        const res = await doFetch(JEV_URL, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
          body: JSON.stringify(request),
        });
        const ms = now() - t0;
        if ((res.status === 429 || res.status === 529) && attempt < backoff.length) {
          await sleep(backoff[attempt]!);
          continue;
        }
        let body: unknown;
        try {
          body = await res.json();
        } catch {
          body = null;
        }
        if (!res.ok) {
          const detail = (body as { detail?: unknown } | null)?.detail;
          throw new Error(`Jev answered ${res.status}${detail !== undefined ? `: ${detailText(detail)}` : ""}`);
        }
        const response = readResponse(request, body, "Jev");
        return { response, ms, by: response.model ?? JEV_MODEL };
      }
    },
  };
}

// ---------- the home

/** The refusal the home gives when it holds no key — `JUDGMENT_UNAVAILABLE`, under the name the composer knows it by. */
const HOME_HAS_NO_JUDGE = JUDGMENT_UNAVAILABLE;

/** A question file, as the home's judgment route takes it: Jev's request shape, and the canvas it is for. */
type HomeQuestion = JevRequest & { canvasId: string };

/**
 * **Jev, through the home** — `POST /api/judgment` with the home's key, so
 * the web composes with Jev and never holds a key, and a CLI on a machine
 * with no key of its own composes with its home's. `post` is the surface's
 * own authenticated call (the web's dialog host, the CLI's daemon client);
 * it throws on a refusal, with the refusal's `code` on the error. The answer
 * is checked against the question exactly as Jev's is, and says who answered:
 * the versioned model, via the home.
 */
export function homeAnswerer(post: (question: HomeQuestion) => Promise<unknown>, canvasId: string, now: () => number = () => Date.now()): Answerer {
  return {
    name: "home",
    async answer(request) {
      const t0 = now();
      const body = await post({ ...request, canvasId });
      const ms = now() - t0;
      const response = readResponse(request, body, "the home's judge");
      return { response, ms, by: `${response.model ?? JEV_MODEL} via the home` };
    },
  };
}

/** Did the home refuse because it holds no key — the one refusal a fallback may answer. */
export function isNoJudge(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === HOME_HAS_NO_JUDGE;
}

/**
 * **The home, else the stub — said out loud.** What the CLI answers with
 * when it holds no key: its home's judge, and when the home has none either,
 * the seeded stub, with `onFallback` told once so the person reads which
 * answered. Only the no-judge refusal falls back; any other failure (a
 * refusal of the badge, the judge unreachable) is a failure, never random
 * screens under Jev's name.
 */
export function homeOrStub(home: Answerer, stub: Answerer, onFallback: (error: unknown) => void): Answerer {
  let fell = false;
  let current = home;
  return {
    get name() {
      return current.name;
    },
    async answer(request) {
      try {
        return await current.answer(request);
      } catch (error) {
        // Calls in a round run in parallel: every one the home refused falls back, not just the first.
        if (!isNoJudge(error)) throw error;
        current = stub;
        if (!fell) {
          fell = true;
          onFallback(error);
        }
        return stub.answer(request);
      }
    },
  };
}

// ---------- entropy gating & PriorityGate (wireframes wave 2, design §12)

/** Default Shannon entropy ceiling in bits above which a root decision asks for disambiguation. */
export const DEFAULT_ENTROPY_GATE = 1.0;

/** Default minimum top-option probability below which a root decision asks for disambiguation. */
export const DEFAULT_CONFIDENCE_FLOOR = 0.5;

/**
 * Compute the Shannon entropy in bits ($H = -\sum p_i \log_2 p_i$) of a
 * probability distribution. Normalizes positive entries so slight rounding in
 * Jev's returned probabilities does not skew the bit count; returns `0` for
 * empty, all-zero, or single-option distributions.
 */
export function entropyBits(probabilities: Record<string, number> | readonly number[]): number {
  const raw = Array.isArray(probabilities) ? probabilities : Object.values(probabilities);
  const pos = raw.filter((v) => typeof v === "number" && Number.isFinite(v) && v > 0);
  if (pos.length <= 1) return 0;
  const total = pos.reduce((s, v) => s + v, 0);
  if (total <= 0) return 0;
  let h = 0;
  for (const v of pos) {
    const p = v / total;
    if (p > 0 && p < 1) h -= p * Math.log2(p);
  }
  return Math.round(h * 1000) / 1000;
}

/** One candidate option surfaced by `gatedChoice`, ordered most likely first. */
export interface GatedChoiceOption {
  /** Option identifier from the question's criteria. */
  value: string;
  /** Probability assigned by the answerer (`0..1`). */
  p: number;
}

/** Options controlling `gatedChoice` disambiguation thresholds and overrides. */
export interface GatedChoiceOptions {
  /** Shannon entropy ceiling in bits (default `DEFAULT_ENTROPY_GATE` = `1.0`). */
  maxEntropyBits?: number;
  /** Minimum top-option probability (default `DEFAULT_CONFIDENCE_FLOOR` = `0.5`). */
  minConfidence?: number;
  /** Maximum number of top candidate options to surface on an ask (default `3`). */
  topK?: number;
  /** Pinned value from `WireSpec.pinned` or `--pin key=value`; bypasses the gate when valid. */
  pinned?: string;
  /** When `true` (`--no-ask`), never pauses for `/ask`; resolves to argmax even when uncertain. */
  noAsk?: boolean;
}

/** The outcome of evaluating a Jev answer through `gatedChoice`. */
export interface GatedChoiceResult {
  /** `"pinned"` when `opts.pinned` matched; `"ask"` when entropy exceeds `maxEntropyBits` or top `p < minConfidence` (unless `noAsk`); otherwise `"confident"`. */
  status: "confident" | "ask" | "pinned";
  /** Chosen or pinned option value. */
  value: string;
  /** Probability of `value` in the answer's distribution. */
  p: number;
  /** Shannon entropy of the answer's distribution in bits. */
  entropy: number;
  /** Top `k` options sorted by descending probability. */
  options: GatedChoiceOption[];
  /** True when the distribution itself was uncertain (`entropy > maxEntropyBits` or `p < minConfidence`). */
  uncertain: boolean;
}

/**
 * Evaluate a Jev answer against an entropy and confidence gate.
 * When `opts.pinned` names a valid option, returns `status: "pinned"` with
 * that option immediately. Otherwise, if `entropy > maxEntropyBits` or
 * `p < minConfidence`, returns `status: "ask"` (or `"confident"` when
 * `opts.noAsk` is true) with the top `topK` options and their probabilities.
 */
export function gatedChoice(q: JevQuestion, a: JevAnswer, opts: GatedChoiceOptions = {}): GatedChoiceResult {
  const { value, p, distribution } = chosenOption(q, a);
  const entropy = entropyBits(distribution);
  const maxEntropy = opts.maxEntropyBits ?? DEFAULT_ENTROPY_GATE;
  const minConf = opts.minConfidence ?? DEFAULT_CONFIDENCE_FLOOR;
  const topK = opts.topK ?? 3;
  const options = Object.entries(distribution)
    .map(([k, prob]) => ({ value: k, p: Math.round(prob * 1000) / 1000 }))
    .sort((x, y) => y.p - x.p || x.value.localeCompare(y.value))
    .slice(0, topK);
  const uncertain = entropy > maxEntropy || p < minConf;
  if (opts.pinned !== undefined && Object.prototype.hasOwnProperty.call(distribution, opts.pinned)) {
    const pinnedP = Math.round((distribution[opts.pinned] ?? 0) * 1000) / 1000;
    return { status: "pinned", value: opts.pinned, p: pinnedP, entropy, options, uncertain };
  }
  if (uncertain && !opts.noAsk) {
    return { status: "ask", value, p: Math.round(p * 1000) / 1000, entropy, options, uncertain: true };
  }
  return { status: "confident", value, p: Math.round(p * 1000) / 1000, entropy, options, uncertain };
}

/** Priority lane for `PriorityGate`: `"high"` preempts queued `"normal"` work. */
export type JevPriority = "high" | "normal";

/** Configuration for `PriorityGate`. */
export interface PriorityGateOptions {
  /** Maximum concurrent in-flight calls (default `3`). */
  concurrency?: number;
  /** Alias for `concurrency` (default `3`). */
  maxConcurrent?: number;
  /** Maximum retries on transient `429` or `529` errors (default `3`). */
  maxRetries?: number;
  /** Backoff delays in ms between retries (default `[200, 500, 1000]`). */
  backoffMs?: readonly number[];
  /** Base backoff delay in ms when `backoffMs` is not given. */
  baseDelayMs?: number;
  /** Custom sleep function for deterministic tests. */
  sleep?: (ms: number) => Promise<void>;
}

function isTransientJevError(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  if (status === 429 || status === 529) return true;
  const msg = error instanceof Error ? error.message : String(error);
  return /\b(?:429|529)\b/.test(msg);
}

/**
 * Two-lane (`high` / `normal`) concurrency semaphore and retry wrapper around
 * an `Answerer`. Interactive composer, edit, and `/ask` calls run on the
 * `"high"` lane and always dequeue ahead of queued `"normal"` background work
 * (such as class polish).
 */
export class PriorityGate {
  readonly inner: Answerer | undefined;
  readonly concurrency: number;
  readonly maxRetries: number;
  private readonly backoffMs: readonly number[];
  private readonly sleep: (ms: number) => Promise<void>;
  private active = 0;
  private readonly highQueue: Array<() => void> = [];
  private readonly normalQueue: Array<() => void> = [];

  constructor(innerOrOpts?: Answerer | PriorityGateOptions, maybeOpts: PriorityGateOptions = {}) {
    const isAnswerer = innerOrOpts !== undefined && typeof (innerOrOpts as Answerer).answer === "function";
    this.inner = isAnswerer ? (innerOrOpts as Answerer) : undefined;
    const opts = isAnswerer ? maybeOpts : ((innerOrOpts as PriorityGateOptions | undefined) ?? {});
    this.concurrency = Math.max(1, opts.concurrency ?? opts.maxConcurrent ?? 3);
    this.maxRetries = Math.max(0, opts.maxRetries ?? 3);
    const base = opts.baseDelayMs;
    this.backoffMs = opts.backoffMs ?? (base !== undefined ? [base, base * 2, base * 4] : [200, 500, 1000]);
    this.sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  }

  /** Number of currently in-flight calls across both lanes. */
  get inFlight(): number {
    return this.active;
  }

  /** Number of queued calls waiting for a slot (`high` + `normal`). */
  get pending(): number {
    return this.highQueue.length + this.normalQueue.length;
  }

  private acquire(priority: JevPriority): Promise<void> {
    if (this.active < this.concurrency) {
      this.active++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      const task = () => {
        this.active++;
        resolve();
      };
      if (priority === "high") this.highQueue.push(task);
      else this.normalQueue.push(task);
    });
  }

  private release(): void {
    this.active--;
    const next = this.highQueue.shift() ?? this.normalQueue.shift();
    if (next) next();
  }

  /** Run an arbitrary async operation through the priority semaphore with transient retry. */
  async run<T>(
    first: JevPriority | (() => Promise<T>),
    second: (() => Promise<T>) | JevPriority = "high",
  ): Promise<T> {
    const priority: JevPriority = typeof first === "string" ? first : (second as JevPriority);
    const fn: () => Promise<T> = typeof first === "function" ? first : (second as () => Promise<T>);
    await this.acquire(priority);
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          return await fn();
        } catch (error) {
          if (isTransientJevError(error) && attempt < this.maxRetries) {
            const wait = this.backoffMs[Math.min(attempt, this.backoffMs.length - 1)] ?? 200;
            await this.sleep(wait);
            continue;
          }
          throw error;
        }
      }
    } finally {
      this.release();
    }
  }

  /** Answer a `JevRequest` at the given priority (`"high"` by default). */
  answer(request: JevRequest, priority: JevPriority = "high"): Promise<Answered> {
    if (!this.inner) throw new Error("PriorityGate has no default inner Answerer — pass one to constructor or use asAnswerer(answerer)");
    return this.run(priority, () => this.inner!.answer(request));
  }

  /** View this gate as a standard `Answerer` bound to the given priority lane. */
  asAnswerer(first: Answerer | JevPriority = "high", second: JevPriority = "high"): Answerer {
    const target = typeof first === "string" ? this.inner : first;
    const priority: JevPriority = typeof first === "string" ? first : second;
    if (!target) throw new Error("PriorityGate.asAnswerer requires an Answerer");
    const self = this;
    return {
      get name() {
        return target.name;
      },
      answer(request: JevRequest) {
        return self.run(priority, () => target.answer(request));
      },
    };
  }
}

// ---------- structured text generation seam (wire copy --ai, wire name)

/** Minimal JSON Schema subset used for structured text generation (`wire copy --ai`, `wire name`). */
export interface JsonSchema {
  type: "object" | "array" | "string" | "number" | "boolean";
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: readonly string[];
  items?: JsonSchema;
  minItems?: number;
  maxItems?: number;
  enum?: readonly string[];
  additionalProperties?: boolean | JsonSchema;
}

/**
 * Vendor-neutral structured text generator seam.
 *
 * Implementations:
 * - `stubTextGenerator(seed)`: deterministic offline generator that synthesizes valid JSON conforming to `schema`.
 * - `httpTextGenerator(opts)`: an OpenAI-shaped HTTPS JSON-schema completion (zero SDK dependencies).
 * - `claudeTextGenerator(opts)`: Claude's Messages API with structured outputs (zero SDK dependencies).
 * - `envTextGenerator(opts)`: whichever of the two the environment names (`ISOCAN_TEXT_PROVIDER`, else the key's shape).
 * - `homeTextGenerator(post, canvasId)`: the home's `/api/text`, with the home's key — what the web uses.
 */
export interface TextGenerator {
  readonly name: string;
  generateJson<T = unknown>(prompt: string, schema: JsonSchema): Promise<T>;
}

/** Options for `httpTextGenerator`. */
export interface HttpTextGeneratorOptions {
  apiKey?: string;
  model?: string;
  endpoint?: string;
  fetch?: typeof globalThis.fetch;
}

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "your", "app", "flow",
  "screen", "screens", "wireframe", "design", "generate", "write", "copy", "json", "schema",
]);

function promptNouns(prompt: string): string[] {
  const words = prompt
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w.toLowerCase()));
  if (words.length === 0) return ["Acme", "Workspace", "Operations", "Status"];
  const unique: string[] = [];
  for (const w of words) {
    const cap = w[0]!.toUpperCase() + w.slice(1);
    if (!unique.includes(cap)) unique.push(cap);
  }
  return unique.length > 0 ? unique : ["Acme", "Workspace"];
}

function synthesizeFromSchema(schema: JsonSchema, prompt: string, path: string, seed: number): unknown {
  const h = hash(`${seed}:${prompt}:${path}:${schema.description ?? ""}`);
  if (schema.enum && schema.enum.length > 0) {
    return schema.enum[h % schema.enum.length]!;
  }
  switch (schema.type) {
    case "boolean":
      return (h & 1) === 0;
    case "number":
      return (h % 90) + 10;
    case "array": {
      const len = schema.minItems ?? schema.maxItems ?? 3;
      const itemSchema = schema.items ?? { type: "string" };
      return Array.from({ length: len }, (_, i) => synthesizeFromSchema(itemSchema, prompt, `${path}.${i}`, seed));
    }
    case "object": {
      const out: Record<string, unknown> = {};
      for (const [k, propSchema] of Object.entries(schema.properties ?? {})) {
        out[k] = synthesizeFromSchema(propSchema, prompt, path ? `${path}.${k}` : k, seed);
      }
      return out;
    }
    case "string":
    default: {
      const nouns = promptNouns(prompt);
      const a = nouns[h % nouns.length]!;
      const b = nouns[(h >>> 3) % nouns.length]!;
      const leaf = path.split(".").pop() ?? path;
      if (leaf === "brand") return `${a} ${b === a ? "Studio" : b}`;
      if (leaf === "title" || leaf === "heading") return a === b ? `${a} Overview` : `${a} ${b}`;
      if (leaf === "bar") return a;
      if (leaf === "value") return `${(h % 900) + 100}`;
      if (leaf === "delta") return `+${(h % 18) + 2}%`;
      if (leaf === "status") return ["Active", "Scheduled", "Completed", "In review"][h % 4]!;
      if (leaf === "label") return a;
      return `${a} ${b.toLowerCase()} ${(h % 90) + 10}`;
    }
  }
}

/**
 * Deterministic, offline `TextGenerator` that synthesizes schema-valid JSON
 * from the prompt and schema structure without network calls.
 */
export function stubTextGenerator(seed = 1): TextGenerator {
  return {
    name: `stub-text (seed ${seed})`,
    async generateJson<T = unknown>(prompt: string, schema: JsonSchema): Promise<T> {
      return synthesizeFromSchema(schema, prompt, "", seed) as T;
    },
  };
}

/**
 * Standard HTTPS JSON-schema `TextGenerator` using `fetch` with zero SDK dependencies.
 * Reads `ISOCAN_TEXT_API_KEY` and `ISOCAN_TEXT_MODEL` when not passed in `opts`.
 */
export function httpTextGenerator(opts: HttpTextGeneratorOptions = {}): TextGenerator {
  const apiKey = opts.apiKey ?? textEnv("ISOCAN_TEXT_API_KEY") ?? "";
  const model = opts.model ?? textEnv("ISOCAN_TEXT_MODEL") ?? "gpt-4o-mini";
  const endpoint = opts.endpoint ?? textEnv("ISOCAN_TEXT_ENDPOINT") ?? "https://api.openai.com/v1/chat/completions";
  const fetchFn = opts.fetch ?? globalThis.fetch;

  return {
    name: model,
    async generateJson<T = unknown>(prompt: string, schema: JsonSchema): Promise<T> {
      if (!apiKey) throw new Error("httpTextGenerator requires apiKey or ISOCAN_TEXT_API_KEY");
      const res = await fetchFn(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "Return only valid JSON conforming to the provided JSON schema." },
            { role: "user", content: prompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name: "wire_response", strict: true, schema },
          },
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`TextGenerator HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }
      const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const text = body.choices?.[0]?.message?.content;
      if (!text) throw new Error("TextGenerator returned an empty response");
      return JSON.parse(text) as T;
    },
  };
}

/** An environment variable where there is an environment — the browser has none, and this file must load there. */
function textEnv(name: string): string | undefined {
  const value = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];
  return value?.trim() || undefined;
}

// ---------- Claude

/** Where Claude answers: the Messages API. `ISOCAN_TEXT_ENDPOINT` overrides it, as it does the OpenAI-shaped one. */
export const CLAUDE_MESSAGES_URL = "https://api.anthropic.com/v1/messages";

/**
 * The Claude model a text request names when `ISOCAN_TEXT_MODEL` names none:
 * Claude Opus 5.5, the current default model (the `claude-api` skill's
 * recommendation, 2 Oct 2026). Its cost lever is `CLAUDE_TEXT_EFFORT`, not a
 * smaller model: a screen's labels are short structured copy, which low effort
 * writes well and fast.
 */
export const CLAUDE_TEXT_MODEL = "claude-opus-5-5";

/**
 * How hard Claude thinks before writing a screen's words. Low: the output is a
 * few dozen labels held to a schema, the dialog is waiting on it, and the
 * skill's guidance is `low` for simple, latency-sensitive work (Opus 5.5's
 * own default is `medium`, so it is set explicitly).
 */
export const CLAUDE_TEXT_EFFORT = "low";

/**
 * Claude declines in classifier categories; `fallbacks: "default"` re-runs a
 * declined request on Anthropic's recommended substitute inside the same call
 * (beta header below) rather than handing the dialog a refusal.
 */
const CLAUDE_FALLBACK_BETA = "server-side-fallback-2026-07-01";

/** Options for `claudeTextGenerator`. */
interface ClaudeTextGeneratorOptions {
  apiKey?: string;
  model?: string;
  endpoint?: string;
  fetch?: typeof globalThis.fetch;
}

/**
 * The schema as Claude's structured outputs accept it: every object closed
 * (`additionalProperties: false` is required) and array lengths dropped
 * (only `minItems` of 0 or 1 is supported). What is dropped is checked by the
 * caller's own validation (`validateCopyPayload` and its kin), as it is for
 * every generator.
 */
export function claudeSchema(schema: JsonSchema): JsonSchema {
  const out: JsonSchema = { type: schema.type };
  if (schema.description !== undefined) out.description = schema.description;
  if (schema.enum !== undefined) out.enum = schema.enum;
  if (schema.type === "object") {
    const properties: Record<string, JsonSchema> = {};
    for (const [key, value] of Object.entries(schema.properties ?? {})) properties[key] = claudeSchema(value);
    out.properties = properties;
    if (schema.required !== undefined) out.required = schema.required;
    out.additionalProperties = false;
  }
  if (schema.type === "array") {
    if (schema.items !== undefined) out.items = claudeSchema(schema.items);
    if (schema.minItems === 0 || schema.minItems === 1) out.minItems = schema.minItems;
  }
  return out;
}

/**
 * **Claude, writing to a schema** — the Messages API with structured outputs
 * (`output_config.format`), over `fetch` with no SDK: core is isomorphic and
 * loads in the browser, and the seam it implements is a `fetch` an injected
 * test transport can stand in for. The key travels as `x-api-key` and never
 * appears in an error this throws; a refusal and a truncated answer are
 * errors in words, never half a schema.
 */
export function claudeTextGenerator(opts: ClaudeTextGeneratorOptions = {}): TextGenerator {
  const apiKey = opts.apiKey ?? textEnv("ISOCAN_TEXT_API_KEY") ?? "";
  const model = opts.model ?? textEnv("ISOCAN_TEXT_MODEL") ?? CLAUDE_TEXT_MODEL;
  const endpoint = opts.endpoint ?? textEnv("ISOCAN_TEXT_ENDPOINT") ?? CLAUDE_MESSAGES_URL;
  const fetchFn = opts.fetch ?? globalThis.fetch;
  const scrub = (text: string) => (apiKey ? text.split(apiKey).join("[key]") : text);

  return {
    name: model,
    async generateJson<T = unknown>(prompt: string, schema: JsonSchema): Promise<T> {
      if (!apiKey) throw new Error("claudeTextGenerator requires apiKey or ISOCAN_TEXT_API_KEY");
      let res: Response;
      try {
        res = await fetchFn(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-beta": CLAUDE_FALLBACK_BETA,
          },
          body: JSON.stringify({
            model,
            max_tokens: 16000,
            fallbacks: "default",
            system: "You write the words on an app's screens: labels, headings, buttons, sample content. Answer with the JSON the schema asks for and nothing else.",
            messages: [{ role: "user", content: prompt }],
            output_config: {
              effort: CLAUDE_TEXT_EFFORT,
              format: { type: "json_schema", schema: claudeSchema(schema) },
            },
          }),
        });
      } catch (error) {
        throw new Error(scrub(`Claude could not be reached: ${(error as Error).message}`));
      }
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(scrub(`TextGenerator HTTP ${res.status}: ${errText.slice(0, 200)}`));
      }
      const body = (await res.json()) as {
        stop_reason?: string;
        stop_details?: { category?: string | null; explanation?: string } | null;
        content?: Array<{ type?: string; text?: string }>;
      };
      if (body.stop_reason === "refusal") {
        const why = body.stop_details?.category ? ` (${body.stop_details.category})` : "";
        throw new Error(`Claude declined to write these words${why}`);
      }
      if (body.stop_reason === "max_tokens") throw new Error("Claude ran out of room before the words were finished");
      const text = (body.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
      if (!text) throw new Error("TextGenerator returned an empty response");
      return JSON.parse(text) as T;
    },
  };
}

// ---------- which provider

/** The text-model vendors core can call. */
export type TextProvider = "anthropic" | "openai";

/**
 * **Which provider a key is for.** `ISOCAN_TEXT_PROVIDER` says so when set
 * (`anthropic` or `openai`); otherwise the key's own shape decides — an
 * Anthropic key starts `sk-ant-` — and anything else is the OpenAI-shaped
 * endpoint, which is what `ISOCAN_TEXT_API_KEY` meant before Claude was a
 * choice, so no existing setup changes meaning.
 */
export function textProvider(apiKey: string | undefined = textEnv("ISOCAN_TEXT_API_KEY"), named: string | undefined = textEnv("ISOCAN_TEXT_PROVIDER")): TextProvider {
  const said = named?.toLowerCase();
  if (said === "anthropic" || said === "claude") return "anthropic";
  if (said === "openai") return "openai";
  return apiKey?.startsWith("sk-ant-") ? "anthropic" : "openai";
}

/** Options for `envTextGenerator`: each overrides the environment. */
interface EnvTextGeneratorOptions {
  apiKey?: string;
  model?: string;
  provider?: TextProvider;
  fetch?: typeof globalThis.fetch;
}

/** The text generator the environment names — the CLI's with a key of its own, and the home's behind `/api/text`. */
export function envTextGenerator(opts: EnvTextGeneratorOptions = {}): TextGenerator {
  const apiKey = opts.apiKey ?? textEnv("ISOCAN_TEXT_API_KEY");
  const provider = opts.provider ?? textProvider(apiKey);
  const shared = { ...(apiKey !== undefined ? { apiKey } : {}), ...(opts.model !== undefined ? { model: opts.model } : {}), ...(opts.fetch ? { fetch: opts.fetch } : {}) };
  return provider === "anthropic" ? claudeTextGenerator(shared) : httpTextGenerator(shared);
}

// ---------- the home's text model

/**
 * **Words, through the home** — `POST /api/text` with the home's key, so the
 * web writes copy with a real model and never holds a key. `post` is the
 * surface's own authenticated call (the dialog host's `generate`); it throws
 * on a refusal, with the refusal's `code` on the error. Says who wrote the
 * words: the model the home named, via the home.
 */
export function homeTextGenerator(post: (request: TextRequest) => Promise<unknown>, canvasId: string): TextGenerator {
  let by = "the home's text model";
  return {
    get name() {
      return by;
    },
    async generateJson<T = unknown>(prompt: string, schema: JsonSchema): Promise<T> {
      const body = (await post({ canvasId, prompt, schema })) as Partial<TextResponse> | null;
      if (!body || typeof body !== "object" || !("value" in body)) throw new Error("the home's text model answered without a value");
      if (typeof body.model === "string" && body.model) by = `${body.model} via the home`;
      return body.value as T;
    },
  };
}

/** The home's text route's refusal when it holds no text-model key (`text.ts` re-exports it with the route's other codes). */
export const TEXT_UNAVAILABLE = "text-unavailable";

/** Did the home refuse because it holds no text-model key — the one refusal a fallback may answer. */
function isNoTextModel(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === TEXT_UNAVAILABLE;
}

/**
 * **The home, else placeholder words — said out loud.** `homeOrStub`'s twin
 * for words: the home's text model, and when the home has none (only that
 * refusal; any other failure is a failure), the given stub, with `onFallback`
 * told once. The stub's `name` is what the person reads, so name it as what
 * it is.
 */
export function homeTextOrStub(home: TextGenerator, stub: TextGenerator, onFallback: (error: unknown) => void): TextGenerator {
  let fell = false;
  let current = home;
  return {
    get name() {
      return current.name;
    },
    async generateJson<T = unknown>(prompt: string, schema: JsonSchema): Promise<T> {
      try {
        return await current.generateJson<T>(prompt, schema);
      } catch (error) {
        if (!isNoTextModel(error)) throw error;
        current = stub;
        if (!fell) {
          fell = true;
          onFallback(error);
        }
        return stub.generateJson<T>(prompt, schema);
      }
    },
  };
}
