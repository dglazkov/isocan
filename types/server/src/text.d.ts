import { type JsonSchema, type TextProvider } from "../../core/src/jev.js";
/**
 * **The home's text model** — `POST /api/text`'s other half (`@isocan/core`'s
 * `text.ts` has the route and the codes). The judge's twin (`judgment.ts`),
 * for words rather than judgments.
 *
 * It holds the one thing a browser must never hold: the key. A prompt and the
 * schema its answer must satisfy come in, core's `TextGenerator` for the
 * configured provider asks with this home's key, and the value comes back
 * with the model that wrote it. No prompt of its own — what the web asks
 * through it is exactly what the CLI asks with a key of its own. The key is
 * read per call (a secret mounted into the environment can be rotated without
 * a restart) and is scrubbed from every word this sends back, including the
 * provider's own error bodies.
 *
 * Configured by the environment, read per call like the key:
 * `ISOCAN_TEXT_API_KEY` (the key), `ISOCAN_TEXT_PROVIDER` (`anthropic` or
 * `openai`; absent, an `sk-ant-` key is Claude's and anything else the
 * OpenAI-shaped endpoint) and `ISOCAN_TEXT_MODEL` (the provider's default when
 * absent — `claude-opus-5-5` for Claude).
 */
/**
 * **How a home's text model is configured** — the daemon passes it through
 * from `DaemonOptions.text`. Every field has a production default; the fields
 * exist because a test cannot hold a real key, wait a real minute, or reach
 * the real vendor, and must still prove the refusals that depend on all three.
 */
export interface TextOptions {
    /** The key, read per call. Default: `ISOCAN_TEXT_API_KEY` from the environment. */
    key?: () => string | undefined;
    /** The provider. Default: `ISOCAN_TEXT_PROVIDER`, else the key's shape. */
    provider?: () => TextProvider | undefined;
    /** The model. Default: `ISOCAN_TEXT_MODEL`, else the provider's default. */
    model?: () => string | undefined;
    fetch?: typeof fetch;
    /** Completions per badge per minute. Default `TEXT_PER_MINUTE`. */
    perMinute?: number;
    now?: () => number;
}
/** What `TextModel.write` hands the route to send back as it is: `{ model, value }` with 200, or a `text-upstream` refusal with 502. */
interface Written {
    status: number;
    body: unknown;
}
export declare class TextModel {
    private readonly opts;
    private asked;
    constructor(opts?: TextOptions);
    private key;
    /** Does this home hold a key — can anything be written here at all. */
    available(): boolean;
    /** Spend one of this badge's completions for the minute, or say it has none left. */
    take(badgeId: string): boolean;
    /** Words that may leave this home: the key, wherever it appears, is not among them. */
    private scrub;
    /**
     * Ask the text model. Any failure — the provider's refusal, an unreachable
     * provider, an answer that is not JSON — comes back as `text-upstream` with
     * the provider's words, never the key.
     */
    write(request: {
        prompt: string;
        schema: JsonSchema;
    }): Promise<Written>;
}
export {};
