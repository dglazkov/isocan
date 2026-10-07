/**
 * **The judge in the tab — what core knows about it** (local-judge phase 0,
 * `docs/projects/local-judge/design.md`, *The seam: one more `Answerer`*).
 *
 * Two things, both pure and both shared by every surface:
 *
 * - **The models a home may serve**, by name, with the bytes and the SHA-256
 *   that pin them. `isocan model fetch` downloads from this list and nothing
 *   else; the daemon's `GET /models/<name>` serves only names on it. One
 *   entry today.
 * - **The mapping between Jev's question shape and MediaPipe Decision
 *   Maker's**, both ways. A `JevQuestion` becomes the `ChoiceQuestion` (or
 *   `BooleanQuestion`, or `ScoreQuestion`) the Worker evaluates, and what the
 *   Worker returns becomes the `JevAnswer` every caller already reads — so a
 *   caller that asks Jev today asks `local` without changing its question
 *   file (design rule 1), and the answer is checked by the same
 *   `readResponse` a hand-written answer file meets.
 *
 * MediaPipe's types are spelled here rather than imported: core takes no
 * browser dependency, and the shapes are small. `packages/web`'s worker is
 * where the real `@mediapipe/tasks-decision` meets them, and its typecheck
 * holds the two spellings together.
 *
 * A subpath (`@isocan/core/local-judge`) and no Node import, so the web's
 * lazy client and the CLI read one file and a first visit reads none of it.
 */
import { readResponse, type Answered, type JevAnswer, type JevQuestion, type JevRequest } from "./jev.ts";

// ---------- the manifest

/** One model a home may hold and serve: where it comes from and what its bytes must be. */
export interface LocalModel {
  /** The name on the verb and the route — `isocan model fetch <name>`, `GET /models/<name>`. */
  name: string;
  /** The file on disk under `<home>/models/`, and the name the download had upstream. */
  file: string;
  /** Where `isocan model fetch` downloads it from. Nothing else is ever fetched. */
  url: string;
  /** Exact size in bytes; a download of any other length is refused. */
  bytes: number;
  /** Lowercase hex SHA-256 of the whole file; a download with any other is refused and deleted. */
  sha256: string;
  /** What it is, for `isocan model ls` and the lab page. */
  about: string;
  /** The licence its card states, recorded where the bytes are named. */
  licence: string;
}

/**
 * **The one model today.** EmbeddingGemma 2, text-only, 270M, the LiteRT-LM
 * community bundle — not converted and not FP16 (the model card warns FP16
 * can produce NaNs). Hash read off the first download on 7 Oct 2026 and
 * checked against the number phase 0 pinned before it.
 */
export const LOCAL_MODELS: readonly LocalModel[] = [
  {
    name: "embeddinggemma-2-text-270m",
    file: "embeddinggemma-2-text-270m.litertlm",
    url: "https://huggingface.co/litert-community/embeddinggemma-2-text-270m-litert-lm/resolve/main/embeddinggemma-2-text-270m.litertlm",
    bytes: 164_626_432,
    sha256: "2d079ee2f6f066b1f368e8d7c819f55214eaef1d0513b312321901f30ab286fb",
    about: "EmbeddingGemma 2 text 270M (LiteRT-LM), for MediaPipe Decision Maker",
    licence: "Apache-2.0 (per the litert-community card)",
  },
];

/** The model by name, or undefined — the allowlist every surface asks. */
export function localModel(name: string): LocalModel | undefined {
  return LOCAL_MODELS.find((m) => m.name === name);
}

/** The route a browser loads a model from: same origin, by name, never a path. */
export const MODELS_ROUTE = "/models";

/** `/models/<name>` — what the Worker fetches. */
export function modelUrl(name: string): string {
  return `${MODELS_ROUTE}/${encodeURIComponent(name)}`;
}

/** The Cache Storage name the Worker keeps a model in after its first load. The app's service worker leaves it alone. */
export const MODEL_CACHE = "isocan-models-v1";

// ---------- MediaPipe's shapes, spelled for core

/** MediaPipe Decision Maker's `ChoiceQuestion`, as far as a Jev choice needs it. */
interface DecisionChoiceQuestion {
  instructions: string;
  criteria: Record<string, string>;
  normalizePrior?: boolean;
}
/** MediaPipe's `BooleanQuestion`, as far as a Jev noul needs it. */
interface DecisionBooleanQuestion {
  condition: string;
  options?: { label: string; description?: string }[];
}
/** MediaPipe's `ScoreQuestion`, as far as a Jev score needs it. */
interface DecisionScoreQuestion {
  instructions: string;
  rubric: string[];
}
/** One question in the Worker's own words: which evaluate call, and its argument. */
export type DecisionQuestion =
  | { kind: "boolean"; question: DecisionBooleanQuestion }
  | { kind: "choice"; question: DecisionChoiceQuestion }
  | { kind: "score"; question: DecisionScoreQuestion };

/** MediaPipe's `ChoiceResult`. */
interface DecisionChoiceResult {
  selectedKey: string;
  probabilities: Record<string, number>;
  confidence: number;
}
/** MediaPipe's `BooleanResult`. */
interface DecisionBooleanResult {
  value: boolean;
  probabilityTrue: number;
  confidence: number;
}
/** MediaPipe's `ScoreResult`. */
interface DecisionScoreResult {
  expectedScore: number;
  probabilities: number[];
  confidence: number;
}
/** What the Worker hands back for one question, tagged like its question. */
export type DecisionResult =
  | { kind: "boolean"; result: DecisionBooleanResult }
  | { kind: "choice"; result: DecisionChoiceResult }
  | { kind: "score"; result: DecisionScoreResult };

// ---------- Jev → MediaPipe

/**
 * **A Jev choice, as MediaPipe's `ChoiceQuestion`.** The same shape with
 * different spelling: `instructions` carries over, and the criteria map
 * keeps its keys. A Jev option whose description is `null` ("the key says
 * it") is described by its own key, because MediaPipe scores the phrase and
 * an empty one says nothing. `normalizePrior` is passed only when asked: it
 * changes the distribution, and phase 1 decides whether it helps.
 */
export function jevToChoice(q: Extract<JevQuestion, { type: "choice" }>, opts: { normalizePrior?: boolean } = {}): DecisionChoiceQuestion {
  const keys = Object.keys(q.criteria);
  if (keys.length < 2) throw new Error(`a choice needs at least two options to choose between — this one has ${keys.length}`);
  const criteria = Object.fromEntries(keys.map((k) => [k, q.criteria[k] ?? k]));
  return { instructions: q.instructions, criteria, ...(opts.normalizePrior !== undefined ? { normalizePrior: opts.normalizePrior } : {}) };
}

/** Any Jev question, in the Worker's words: a noul is a boolean, a score a rubric. */
export function jevToDecision(q: JevQuestion, opts: { normalizePrior?: boolean } = {}): DecisionQuestion {
  if (q.type === "choice") return { kind: "choice", question: jevToChoice(q, opts) };
  if (q.type === "score") {
    if (q.criteria.length < 2) throw new Error(`a score needs at least two levels — this one has ${q.criteria.length}`);
    return { kind: "score", question: { instructions: q.instructions, rubric: [...q.criteria] } };
  }
  return {
    kind: "boolean",
    question: {
      condition: q.instructions,
      ...(q.criteria ? { options: [{ label: "false", description: q.criteria.false }, { label: "true", description: q.criteria.true }] } : {}),
    },
  };
}

/**
 * **The state, as the one string the model reads.** Jev takes any JSON; the
 * model takes text. A string is itself; anything else is its JSON — the
 * caller that wants a better serialisation (phase 1's context serialiser)
 * passes a string, and this never guesses one.
 */
export function stateText(state: unknown): string {
  if (typeof state === "string") return state;
  return JSON.stringify(state) ?? "";
}

// ---------- MediaPipe → Jev

/** A probability, clamped into 0–1: MediaPipe's softmax can land a hair outside it, and `readResponse` holds the bound. */
const unit = (p: number) => (Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : 0);

/**
 * **What the Worker returned, as the `JevAnswer` its question expects** — the
 * reverse of `jevToDecision`. A choice keeps its whole distribution and its
 * confidence apart from it; a score's distribution is keyed by level index,
 * as Jev's is, with the expected score beside it; a noul is P(true).
 */
export function decisionToAnswer(q: JevQuestion, d: DecisionResult): JevAnswer {
  if (q.type === "choice" && d.kind === "choice") {
    const probabilities = Object.fromEntries(Object.keys(q.criteria).map((k) => [k, unit(d.result.probabilities[k] ?? 0)]));
    return { type: "choice", choice: d.result.selectedKey, probabilities, confidence: unit(d.result.confidence) };
  }
  if (q.type === "score" && d.kind === "score") {
    const probabilities = Object.fromEntries(q.criteria.map((_, i) => [String(i), unit(d.result.probabilities[i] ?? 0)]));
    return { type: "score", score: d.result.expectedScore, probabilities, confidence: unit(d.result.confidence) };
  }
  if (q.type === "noul" && d.kind === "boolean") return { type: "noul", noul: unit(d.result.probabilityTrue) };
  throw new Error(`a ${q.type} question came back as a ${d.kind} result`);
}

/**
 * **A whole request answered in the tab, as `Answered`.** Every question
 * must have its result; the response is then checked by `readResponse`, the
 * same check Jev's and an agent's answers meet, so the local judge cannot put
 * an option on a screen that the question never offered. `usage` counts the
 * tokens the model actually read (MediaPipe's own estimate); nothing is
 * billed.
 */
export function localAnswered(request: JevRequest, results: Record<string, DecisionResult>, meta: { ms: number; by: string; inputTokens?: number }): Answered {
  const answers: Record<string, JevAnswer> = {};
  for (const [id, q] of Object.entries(request.questions)) {
    const d = results[id];
    if (!d) throw new Error(`the local judge returned nothing for question "${id}"`);
    answers[id] = decisionToAnswer(q, d);
  }
  const response = readResponse(request, { model: meta.by, answers, usage: { input_tokens: meta.inputTokens ?? 0, output_tokens: 0 } }, "the local judge");
  return { response, ms: meta.ms, by: meta.by };
}
