/**
 * **The home's judge** — `POST /api/judgment`'s other half (`@isocan/core`'s
 * `judgment.ts` has the route and the codes; `docs/projects/judge/design.md`
 * the seam).
 *
 * It holds the one thing a browser must never hold: the key. A question file
 * in the judge's request shape comes in, the same questions go out with this
 * home's key as a bearer token, and the judge's answer comes back unchanged.
 * No prompt of its own, no second vendor, no shaping of the answer — so what
 * the web composes through it is exactly what the CLI composes with a key of
 * its own. The key is read per call (a secret mounted into the environment
 * can be rotated without a restart) and is scrubbed from every word this
 * sends back, including the judge's own error bodies.
 *
 * The rate limit is per badge and deliberately small: a flow is ~25 calls in
 * a few seconds, so sixty a minute lets a person compose and restyle, and
 * stops a page from turning the home's key into anybody's.
 */
/**
 * Where the home's judge lives — the one vendor address this server calls,
 * named once so the route test can prove a question went there and nowhere
 * else. `JudgmentOptions.url` overrides it for a test's fake transport.
 */
export declare const JUDGE_URL = "https://api.typesafe.ai/v1/systemone";
/**
 * **How a home's judge is configured** — the daemon passes it through from
 * `DaemonOptions.judgment`. Every field has a production default; the fields
 * exist because a test cannot hold a real key, wait a real minute, or reach
 * the real vendor, and must still prove the refusals that depend on all three.
 */
export interface JudgmentOptions {
    /** The key, read per call. Default: `TYPESAFE_API_KEY` from the environment. */
    key?: () => string | undefined;
    fetch?: typeof fetch;
    url?: string;
    /** Judgments per badge per minute. Default `JUDGMENT_PER_MINUTE`. */
    perMinute?: number;
    now?: () => number;
    /** Waits before each retry of a 429 or 529, in ms. */
    backoff?: readonly number[];
}
/**
 * What `Judge.ask` hands the route to send back as it is: the judge's own
 * answer with 200, or a `judgment-upstream` refusal with 502 — so the route
 * never has to know which, and never shapes the judge's words itself.
 */
export interface Judged {
    status: number;
    body: unknown;
}
export declare class Judge {
    private readonly opts;
    private asked;
    constructor(opts?: JudgmentOptions);
    private key;
    /** Does this home hold a key — can anything be asked here at all. */
    available(): boolean;
    /** Spend one of this badge's judgments for the minute, or say it has none left. */
    take(badgeId: string): boolean;
    /** Words that may leave this home: the key, wherever it appears, is not among them. */
    private scrub;
    /**
     * Ask the judge. A 429 or 529 is retried with backoff (the vendor's own
     * advice); any other refusal, and an unreachable judge, comes back as
     * `judgment-upstream` with the judge's words — never the key.
     */
    ask(request: {
        model?: string;
        state: unknown;
        questions: Record<string, unknown>;
    }): Promise<Judged>;
}
