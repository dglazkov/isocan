import { envTextGenerator, textProvider, type JsonSchema, type TextProvider } from "@isocan/core/jev";
import { TEXT_PER_MINUTE, TEXT_UPSTREAM } from "@isocan/core/text";

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

const WINDOW_MS = 60_000;

export class TextModel {
  private asked = new Map<string, number[]>();

  constructor(private readonly opts: TextOptions = {}) {}

  private key(): string | undefined {
    const raw = (this.opts.key ?? (() => process.env.ISOCAN_TEXT_API_KEY))();
    return raw?.trim() || undefined;
  }

  /** Does this home hold a key — can anything be written here at all. */
  available(): boolean {
    return this.key() !== undefined;
  }

  /** Spend one of this badge's completions for the minute, or say it has none left. */
  take(badgeId: string): boolean {
    const now = (this.opts.now ?? Date.now)();
    const recent = (this.asked.get(badgeId) ?? []).filter((t) => now - t < WINDOW_MS);
    if (recent.length >= (this.opts.perMinute ?? TEXT_PER_MINUTE)) {
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
   * Ask the text model. Any failure — the provider's refusal, an unreachable
   * provider, an answer that is not JSON — comes back as `text-upstream` with
   * the provider's words, never the key.
   */
  async write(request: { prompt: string; schema: JsonSchema }): Promise<Written> {
    const key = this.key();
    if (!key) throw new Error("the text model has no key");
    const named = this.opts.provider ? this.opts.provider() : undefined;
    const provider = named ?? textProvider(key);
    const model = this.opts.model ? this.opts.model() : undefined;
    const generator = envTextGenerator({
      apiKey: key,
      provider,
      ...(model ? { model } : {}),
      ...(this.opts.fetch ? { fetch: this.opts.fetch } : {}),
    });
    try {
      const value = await generator.generateJson(request.prompt, request.schema);
      const body = { model: generator.name, value };
      const text = JSON.stringify(body);
      return { status: 200, body: text.includes(key) ? JSON.parse(this.scrub(text)) : body };
    } catch (error) {
      return { status: 502, body: { error: this.scrub(`the text model could not write this: ${(error as Error).message}`), code: TEXT_UPSTREAM } };
    }
  }
}
