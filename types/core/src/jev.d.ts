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
export {};
