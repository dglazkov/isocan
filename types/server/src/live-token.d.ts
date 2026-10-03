import { type LiveTokenResponse } from "../../core/src/keys.js";
/**
 * **A short-lived Gemini Live token, minted with this home's key** — the other
 * half of `POST /api/voice/token` (keys phase 4; `@isocan/core/keys` has the
 * route and the codes). The talk module used to keep a Gemini key in the
 * browser's localStorage and open the Live socket with it; now the page asks
 * here once per session and opens the socket with what comes back, and the
 * key never leaves this process.
 *
 * Google's ephemeral tokens (Live API, `v1alpha`): `POST
 * /v1alpha/auth_tokens` with the key in `x-goog-api-key` answers
 * `{ name: "auth_tokens/…" }`, which a browser presents as `access_token` on
 * the `BidiGenerateContentConstrained` socket. Minted here with `uses: 1`, a
 * minute to start the session and half an hour for it to run — a token that
 * leaks is one conversation, not a key. The wire shape is the one
 * `@google/genai`'s `tokens.create` sends (read from its 2.x source on 2 Oct
 * 2026), spelled by hand so the server takes no SDK for one POST.
 *
 * The key is read per call (env `GEMINI_API_KEY` wins, else keys.json under
 * `keysHome`) and scrubbed from every word this sends back.
 */
export interface LiveTokenOptions {
    /** The key, read per call. Default: `resolveKey("gemini")` under `keysHome`. A key handed in here counts as the environment's (the operator's). */
    key?: () => string | undefined;
    /** Whose `keys.json` the default key reads: the daemon's home. */
    keysHome?: string;
    /** The transport — the seam a test fakes Google through. */
    fetch?: typeof fetch;
    /** Tokens per badge per minute. Default `LIVE_TOKENS_PER_MINUTE`. */
    perMinute?: number;
    now?: () => number;
}
/** Where tokens are minted. */
export declare const LIVE_TOKEN_ENDPOINT = "https://generativelanguage.googleapis.com/v1alpha/auth_tokens";
export declare class LiveTokens {
    private readonly opts;
    private asked;
    constructor(opts?: LiveTokenOptions);
    private resolve;
    /** Whose key a token would be minted with now: `file` is the machine's person's (owner-only spend), `env` the operator's. */
    keySource(): "env" | "file" | undefined;
    /** Spend one of this badge's tokens for the minute, or say it has none left. */
    take(badgeId: string): boolean;
    /** Mint one token. Any failure is `voice-upstream` with Google's words, never the key. */
    mint(): Promise<{
        status: number;
        body: LiveTokenResponse | {
            error: string;
            code: string;
        };
    }>;
}
