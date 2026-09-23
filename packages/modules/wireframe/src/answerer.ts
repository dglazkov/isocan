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
 */

export const JEV_URL = "https://api.typesafe.ai/v1/systemone";
export const JEV_MODEL = "jev-latest";
/** $ per input token — $0.042 per million, output billed at zero (judge phase 0). */
export const JEV_INPUT_PRICE = 0.042 / 1_000_000;

export type JevQuestion =
  | { type: "noul"; instructions: string; criteria?: { true: string; false: string } }
  | { type: "choice"; instructions: string; criteria: Record<string, string | null> }
  | { type: "score"; instructions: string; criteria: string[] };

export interface JevRequest {
  model: string;
  state: unknown;
  questions: Record<string, JevQuestion>;
}

export type JevAnswer =
  | { type: "noul"; noul: number }
  | { type: "choice"; choice: string; probabilities: Record<string, number>; confidence?: number }
  | { type: "score"; score: number; probabilities: Record<string, number>; legend?: Record<string, string>; confidence?: number };

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

export interface JevOptions {
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

/** The refusal the home gives when it holds no key (`@isocan/core`'s `JUDGMENT_UNAVAILABLE`, spelled out so this file stays import-free). */
export const HOME_HAS_NO_JUDGE = "judgment-unavailable";

/** A question file, as the home's judgment route takes it: Jev's request shape, and the canvas it is for. */
export type HomeQuestion = JevRequest & { canvasId: string };

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
