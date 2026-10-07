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
import { type Answered, type JevAnswer, type JevQuestion, type JevRequest } from "./jev.js";
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
export declare const LOCAL_MODELS: readonly LocalModel[];
/** The model by name, or undefined — the allowlist every surface asks. */
export declare function localModel(name: string): LocalModel | undefined;
/** The route a browser loads a model from: same origin, by name, never a path. */
export declare const MODELS_ROUTE = "/models";
/** `/models/<name>` — what the Worker fetches. */
export declare function modelUrl(name: string): string;
/** The Cache Storage name the Worker keeps a model in after its first load. The app's service worker leaves it alone. */
export declare const MODEL_CACHE = "isocan-models-v1";
/** MediaPipe Decision Maker's `ChoiceQuestion`, as far as a Jev choice needs it. */
interface DecisionChoiceQuestion {
    instructions: string;
    criteria: Record<string, string>;
    normalizePrior?: boolean;
}
/** MediaPipe's `BooleanQuestion`, as far as a Jev noul needs it. */
interface DecisionBooleanQuestion {
    condition: string;
    options?: {
        label: string;
        description?: string;
    }[];
}
/** MediaPipe's `ScoreQuestion`, as far as a Jev score needs it. */
interface DecisionScoreQuestion {
    instructions: string;
    rubric: string[];
}
/** One question in the Worker's own words: which evaluate call, and its argument. */
export type DecisionQuestion = {
    kind: "boolean";
    question: DecisionBooleanQuestion;
} | {
    kind: "choice";
    question: DecisionChoiceQuestion;
} | {
    kind: "score";
    question: DecisionScoreQuestion;
};
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
export type DecisionResult = {
    kind: "boolean";
    result: DecisionBooleanResult;
} | {
    kind: "choice";
    result: DecisionChoiceResult;
} | {
    kind: "score";
    result: DecisionScoreResult;
};
/**
 * **A Jev choice, as MediaPipe's `ChoiceQuestion`.** The same shape with
 * different spelling: `instructions` carries over, and the criteria map
 * keeps its keys. A Jev option whose description is `null` ("the key says
 * it") is described by its own key, because MediaPipe scores the phrase and
 * an empty one says nothing. `normalizePrior` is passed only when asked: it
 * changes the distribution, and phase 1 decides whether it helps.
 */
export declare function jevToChoice(q: Extract<JevQuestion, {
    type: "choice";
}>, opts?: {
    normalizePrior?: boolean;
}): DecisionChoiceQuestion;
/** Any Jev question, in the Worker's words: a noul is a boolean, a score a rubric. */
export declare function jevToDecision(q: JevQuestion, opts?: {
    normalizePrior?: boolean;
}): DecisionQuestion;
/**
 * **The state, as the one string the model reads.** Jev takes any JSON; the
 * model takes text. A string is itself; anything else is its JSON — the
 * caller that wants a better serialisation (phase 1's context serialiser)
 * passes a string, and this never guesses one.
 */
export declare function stateText(state: unknown): string;
/**
 * **What the Worker returned, as the `JevAnswer` its question expects** — the
 * reverse of `jevToDecision`. A choice keeps its whole distribution and its
 * confidence apart from it; a score's distribution is keyed by level index,
 * as Jev's is, with the expected score beside it; a noul is P(true).
 */
export declare function decisionToAnswer(q: JevQuestion, d: DecisionResult): JevAnswer;
/**
 * **A whole request answered in the tab, as `Answered`.** Every question
 * must have its result; the response is then checked by `readResponse`, the
 * same check Jev's and an agent's answers meet, so the local judge cannot put
 * an option on a screen that the question never offered. `usage` counts the
 * tokens the model actually read (MediaPipe's own estimate); nothing is
 * billed.
 */
export declare function localAnswered(request: JevRequest, results: Record<string, DecisionResult>, meta: {
    ms: number;
    by: string;
    inputTokens?: number;
}): Answered;
export {};
