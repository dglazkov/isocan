import { resolveKey } from "@isocan/core/keystore";
import { LIVE_TOKEN_UPSTREAM, type LiveTokenResponse } from "@isocan/core/keys";
import { warnRefusedKeys } from "./text.ts";

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
export const LIVE_TOKEN_ENDPOINT = "https://generativelanguage.googleapis.com/v1alpha/auth_tokens";
/** A session per press: a handful a minute is a person reconnecting, more is a loop. */
const LIVE_TOKENS_PER_MINUTE = 6;
/** How long a token has to START its session. */
const NEW_SESSION_MS = 60_000;
/** How long a session started with it may run. */
const SESSION_MS = 30 * 60_000;
const WINDOW_MS = 60_000;

export class LiveTokens {
  private asked = new Map<string, number[]>();

  constructor(private readonly opts: LiveTokenOptions = {}) {}

  private resolve(): { key: string; source: "env" | "file" } | undefined {
    if (this.opts.key) {
      const key = this.opts.key()?.trim();
      return key ? { key, source: "env" } : undefined;
    }
    const found = warnRefusedKeys(() => resolveKey("gemini", this.opts.keysHome ? { home: this.opts.keysHome } : {}));
    return found ? { key: found.key, source: found.source } : undefined;
  }

  /** Whose key a token would be minted with now: `file` is the machine's person's (owner-only spend), `env` the operator's. */
  keySource(): "env" | "file" | undefined {
    return this.resolve()?.source;
  }

  /** Spend one of this badge's tokens for the minute, or say it has none left. */
  take(badgeId: string): boolean {
    const now = (this.opts.now ?? Date.now)();
    const recent = (this.asked.get(badgeId) ?? []).filter((t) => now - t < WINDOW_MS);
    if (recent.length >= (this.opts.perMinute ?? LIVE_TOKENS_PER_MINUTE)) {
      this.asked.set(badgeId, recent);
      return false;
    }
    recent.push(now);
    this.asked.set(badgeId, recent);
    return true;
  }

  /** Mint one token. Any failure is `voice-upstream` with Google's words, never the key. */
  async mint(): Promise<{ status: number; body: LiveTokenResponse | { error: string; code: string } }> {
    const resolved = this.resolve();
    if (!resolved) throw new Error("the voice token route has no key");
    const { key } = resolved;
    const scrub = (text: string) => text.split(key).join("[key]");
    const now = (this.opts.now ?? Date.now)();
    const expireTime = new Date(now + SESSION_MS).toISOString();
    const newSessionExpireTime = new Date(now + NEW_SESSION_MS).toISOString();
    try {
      const res = await (this.opts.fetch ?? fetch)(LIVE_TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ uses: 1, expireTime, newSessionExpireTime }),
      });
      const text = await res.text();
      if (!res.ok) {
        let said = text.slice(0, 300);
        try {
          said = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? said;
        } catch {
          // not JSON: the first words of it
        }
        return { status: 502, body: { error: scrub(`Google would not mint a voice token (${res.status}): ${said}`), code: LIVE_TOKEN_UPSTREAM } };
      }
      const name = (JSON.parse(text) as { name?: unknown }).name;
      if (typeof name !== "string" || !name || name.includes(key)) {
        return { status: 502, body: { error: "Google answered without a token", code: LIVE_TOKEN_UPSTREAM } };
      }
      return { status: 200, body: { token: name, expireTime, newSessionExpireTime } };
    } catch (error) {
      return { status: 502, body: { error: scrub(`Google could not be reached for a voice token: ${(error as Error).message}`), code: LIVE_TOKEN_UPSTREAM } };
    }
  }
}
