import { type JsonSchema, type TextProvider } from "../../core/src/jev.js";
/** Says once on stderr that a loose keys file was refused, and carries on with no key. */
export declare function warnRefusedKeys<T>(read: () => T | undefined): T | undefined;
/**
 * **How a home's text model is configured** — the daemon passes it through
 * from `DaemonOptions.text`. Every field has a production default; the fields
 * exist because a test cannot hold a real key, wait a real minute, or reach
 * the real vendor, and must still prove the refusals that depend on all three.
 */
export interface TextOptions {
    /** The key, read per call. Default: `resolveTextKey` — `ISOCAN_TEXT_API_KEY`, else `keys.json` under `keysHome`. */
    key?: () => string | undefined;
    /** Whose `keys.json` the default key reads: the daemon's home. Default `ISOCAN_HOME`, else `~/.isocan`. */
    keysHome?: string;
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
    /** The key, the provider it is for and the model to ask, read now. A test's own `key` keeps the old shape: provider and model from its own options, else the key's shape. */
    private resolve;
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
