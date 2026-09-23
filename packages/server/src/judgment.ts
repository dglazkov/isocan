import { JUDGMENT_PER_MINUTE, JUDGMENT_UPSTREAM } from "@isocan/core";

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
export const JUDGE_URL = "https://api.typesafe.ai/v1/systemone";
/** The model a question file that names none is asked of — the vendor's moving alias, so a home follows its upgrades without a deploy. */
const JUDGE_MODEL = "jev-latest";

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

const WINDOW_MS = 60_000;

export class Judge {
  private asked = new Map<string, number[]>();

  constructor(private readonly opts: JudgmentOptions = {}) {}

  private key(): string | undefined {
    const raw = (this.opts.key ?? (() => process.env.TYPESAFE_API_KEY))();
    return raw?.trim() || undefined;
  }

  /** Does this home hold a key — can anything be asked here at all. */
  available(): boolean {
    return this.key() !== undefined;
  }

  /** Spend one of this badge's judgments for the minute, or say it has none left. */
  take(badgeId: string): boolean {
    const now = (this.opts.now ?? Date.now)();
    const recent = (this.asked.get(badgeId) ?? []).filter((t) => now - t < WINDOW_MS);
    if (recent.length >= (this.opts.perMinute ?? JUDGMENT_PER_MINUTE)) {
      this.asked.set(badgeId, recent);
      return false;
    }
    recent.push(now);
    this.asked.set(badgeId, recent);
    return true;
  }

  /** Words that may leave this home: the key, wherever it appears, is not among them. */
  private scrub(text: string): string {
    const key = this.key();
    return key ? text.split(key).join("[key]") : text;
  }

  /**
   * Ask the judge. A 429 or 529 is retried with backoff (the vendor's own
   * advice); any other refusal, and an unreachable judge, comes back as
   * `judgment-upstream` with the judge's words — never the key.
   */
  async ask(request: { model?: string; state: unknown; questions: Record<string, unknown> }): Promise<Judged> {
    const key = this.key();
    if (!key) throw new Error("the judge has no key");
    const doFetch = this.opts.fetch ?? fetch;
    const backoff = this.opts.backoff ?? [500, 1000, 2000];
    const body = JSON.stringify({ model: request.model ?? JUDGE_MODEL, state: request.state, questions: request.questions });
    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await doFetch(this.opts.url ?? JUDGE_URL, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
          body,
        });
      } catch (error) {
        return { status: 502, body: { error: this.scrub(`the judge could not be reached: ${(error as Error).message}`), code: JUDGMENT_UPSTREAM } };
      }
      if ((res.status === 429 || res.status === 529) && attempt < backoff.length) {
        await new Promise((r) => setTimeout(r, backoff[attempt]));
        continue;
      }
      const text = await res.text().catch(() => "");
      let parsed: unknown = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = null;
      }
      if (res.ok && parsed && typeof parsed === "object") {
        // The answer's own bytes, unchanged — unless they somehow carry the key.
        return { status: 200, body: text.includes(key) ? JSON.parse(this.scrub(text)) : parsed };
      }
      const detail = (parsed as { detail?: unknown } | null)?.detail;
      const said = detail === undefined ? "" : `: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`;
      return {
        status: 502,
        body: { error: this.scrub(`the judge answered ${res.status}${said}`), code: JUDGMENT_UPSTREAM, status: res.status },
      };
    }
  }
}
