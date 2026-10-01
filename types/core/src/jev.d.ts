/** Where Jev answers for a caller holding its own key — the CLI and the measurement scripts; the web never calls it (the home does). */
export declare const JEV_URL = "https://api.typesafe.ai/v1/systemone";
/** The vendor's moving alias, named in every request so an upgrade needs no deploy; the versioned model that answered comes back as `by`. */
export declare const JEV_MODEL = "jev-latest";
/** $ per input token — $0.042 per million, output billed at zero (judge phase 0). */
export declare const JEV_INPUT_PRICE: number;
/** One named question in Jev's own request shape — yes/no, a choice among named options, or a level on a scale. */
export type JevQuestion = {
    type: "noul";
    instructions: string;
    criteria?: {
        true: string;
        false: string;
    };
} | {
    type: "choice";
    instructions: string;
    criteria: Record<string, string | null>;
} | {
    type: "score";
    instructions: string;
    criteria: string[];
};
/** A question file: one `state` the questions are about, and the questions by name — what every answerer takes. */
export interface JevRequest {
    model: string;
    state: unknown;
    questions: Record<string, JevQuestion>;
}
/** One answer, typed like its question; a choice or score carries its whole distribution, which is what a threshold is read from. */
export type JevAnswer = {
    type: "noul";
    noul: number;
} | {
    type: "choice";
    choice: string;
    probabilities: Record<string, number>;
    confidence?: number;
} | {
    type: "score";
    score: number;
    probabilities: Record<string, number>;
    legend?: Record<string, string>;
    confidence?: number;
};
/** A question file answered: one answer per question, and the input tokens that priced it. */
export interface JevResponse {
    model?: string;
    answers: Record<string, JevAnswer>;
    usage?: {
        input_tokens: number;
        output_tokens: number;
    };
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
export declare function responseProblems(request: JevRequest, body: unknown): string[];
/** Throws with every problem, or returns the response typed. */
export declare function readResponse(request: JevRequest, body: unknown, from?: string): JevResponse;
/**
 * **The option an answer picks — argmax, never a sample.** A choice carries
 * its own argmax; a score's is the most probable level, a tie going to the
 * level nearest the weighted `score`; a noul is yes at 0.5 or more.
 */
export declare function chosenOption(q: JevQuestion, a: JevAnswer): {
    value: string;
    p: number;
    distribution: Record<string, number>;
};
/** mulberry32: small, seedable, and the same on every platform. */
export declare function seeded(seed: number): () => number;
/**
 * **The uniform stub** — judge's first-class stand-in. Its distributions are
 * flat (`1/n` on every option, 0.5 on every yes/no), so they honestly say "no
 * idea"; its pick is a uniform draw, deterministic under the seed and the
 * question's own id, so one request answers the same way every time and two
 * rounds never share a stream. What the tests use, and what runs with no key.
 */
export declare function stubAnswerer(seed?: number): Answerer;
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
export declare function jevAnswerer(opts: JevOptions): Answerer;
/** A question file, as the home's judgment route takes it: Jev's request shape, and the canvas it is for. */
type HomeQuestion = JevRequest & {
    canvasId: string;
};
/**
 * **Jev, through the home** — `POST /api/judgment` with the home's key, so
 * the web composes with Jev and never holds a key, and a CLI on a machine
 * with no key of its own composes with its home's. `post` is the surface's
 * own authenticated call (the web's dialog host, the CLI's daemon client);
 * it throws on a refusal, with the refusal's `code` on the error. The answer
 * is checked against the question exactly as Jev's is, and says who answered:
 * the versioned model, via the home.
 */
export declare function homeAnswerer(post: (question: HomeQuestion) => Promise<unknown>, canvasId: string, now?: () => number): Answerer;
/** Did the home refuse because it holds no key — the one refusal a fallback may answer. */
export declare function isNoJudge(error: unknown): boolean;
/**
 * **The home, else the stub — said out loud.** What the CLI answers with
 * when it holds no key: its home's judge, and when the home has none either,
 * the seeded stub, with `onFallback` told once so the person reads which
 * answered. Only the no-judge refusal falls back; any other failure (a
 * refusal of the badge, the judge unreachable) is a failure, never random
 * screens under Jev's name.
 */
export declare function homeOrStub(home: Answerer, stub: Answerer, onFallback: (error: unknown) => void): Answerer;
/** Default Shannon entropy ceiling in bits above which a root decision asks for disambiguation. */
export declare const DEFAULT_ENTROPY_GATE = 1;
/** Default minimum top-option probability below which a root decision asks for disambiguation. */
export declare const DEFAULT_CONFIDENCE_FLOOR = 0.5;
/**
 * Compute the Shannon entropy in bits ($H = -\sum p_i \log_2 p_i$) of a
 * probability distribution. Normalizes positive entries so slight rounding in
 * Jev's returned probabilities does not skew the bit count; returns `0` for
 * empty, all-zero, or single-option distributions.
 */
export declare function entropyBits(probabilities: Record<string, number> | readonly number[]): number;
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
export declare function gatedChoice(q: JevQuestion, a: JevAnswer, opts?: GatedChoiceOptions): GatedChoiceResult;
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
/**
 * Two-lane (`high` / `normal`) concurrency semaphore and retry wrapper around
 * an `Answerer`. Interactive composer, edit, and `/ask` calls run on the
 * `"high"` lane and always dequeue ahead of queued `"normal"` background work
 * (such as class polish).
 */
export declare class PriorityGate {
    readonly inner: Answerer | undefined;
    readonly concurrency: number;
    readonly maxRetries: number;
    private readonly backoffMs;
    private readonly sleep;
    private active;
    private readonly highQueue;
    private readonly normalQueue;
    constructor(innerOrOpts?: Answerer | PriorityGateOptions, maybeOpts?: PriorityGateOptions);
    /** Number of currently in-flight calls across both lanes. */
    get inFlight(): number;
    /** Number of queued calls waiting for a slot (`high` + `normal`). */
    get pending(): number;
    private acquire;
    private release;
    /** Run an arbitrary async operation through the priority semaphore with transient retry. */
    run<T>(first: JevPriority | (() => Promise<T>), second?: (() => Promise<T>) | JevPriority): Promise<T>;
    /** Answer a `JevRequest` at the given priority (`"high"` by default). */
    answer(request: JevRequest, priority?: JevPriority): Promise<Answered>;
    /** View this gate as a standard `Answerer` bound to the given priority lane. */
    asAnswerer(first?: Answerer | JevPriority, second?: JevPriority): Answerer;
}
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
 * - `httpTextGenerator(opts)`: standard HTTPS JSON-schema completion (`ISOCAN_TEXT_API_KEY` / `ISOCAN_TEXT_MODEL`, zero SDK dependencies).
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
/**
 * Deterministic, offline `TextGenerator` that synthesizes schema-valid JSON
 * from the prompt and schema structure without network calls.
 */
export declare function stubTextGenerator(seed?: number): TextGenerator;
/**
 * Standard HTTPS JSON-schema `TextGenerator` using `fetch` with zero SDK dependencies.
 * Reads `ISOCAN_TEXT_API_KEY` and `ISOCAN_TEXT_MODEL` when not passed in `opts`.
 */
export declare function httpTextGenerator(opts?: HttpTextGeneratorOptions): TextGenerator;
export {};
