import { envTextGenerator, textProvider, type JsonSchema, type TextProvider } from "@isocan/core/jev";
import { TEXT_PER_MINUTE, TEXT_UPSTREAM } from "@isocan/core/text";
import { KeyFileRefused, resolveTextKey } from "@isocan/core/keystore";

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
 * read per call (a secret mounted into the environment can be rotated, and a
 * key set with `isocan keys set`, used, without a restart) and is scrubbed
 * from every word this sends back, including the provider's own error bodies.
 *
 * Configured per call by `resolveTextKey` (`@isocan/core/keystore`, the rule
 * spelled in `@isocan/core/keys`'s `chooseTextKey`): with
 * `ISOCAN_TEXT_API_KEY` set, the environment decides — `ISOCAN_TEXT_PROVIDER`
 * (`anthropic` or `openai`; absent, an `sk-ant-` key is Claude's and anything
 * else the OpenAI-shaped endpoint) and `ISOCAN_TEXT_MODEL` (the provider's
 * default when absent — `claude-opus-5-5` for Claude). Without it, this
 * machine's `keys.json`: the stored Anthropic key, else the stored OpenAI one.
 */

/**
 * A stored-key read that cannot throw at a route: a `keys.json` refused for
 * its mode is said once on stderr (the path and the mode, never a value) and
 * reads as no key, so the route's own "no key" refusal answers.
 */
const warned = new Set<string>();
/** Says once on stderr that a loose keys file was refused, and carries on with no key. */
export function warnRefusedKeys<T>(read: () => T | undefined): T | undefined {
  try {
    return read();
  } catch (err) {
    const message = err instanceof KeyFileRefused ? err.message : `keys.json could not be read: ${(err as Error).message}`;
    if (!warned.has(message)) {
      warned.add(message);
      console.warn(`[isocan] ${message}`);
    }
    return undefined;
  }
}

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

const WINDOW_MS = 60_000;

export class TextModel {
  private asked = new Map<string, number[]>();

  constructor(private readonly opts: TextOptions = {}) {}

  /** The key, the provider it is for and the model to ask, read now. A test's own `key` keeps the old shape: provider and model from its own options, else the key's shape. */
  private resolve(): { key: string; source: "env" | "file"; provider?: TextProvider; model?: string } | undefined {
    if (this.opts.key) {
      const key = this.opts.key()?.trim();
      // A key handed in by the daemon's options is the operator's, as the environment's is.
      return key ? { key, source: "env" } : undefined;
    }
    const found = warnRefusedKeys(() => resolveTextKey(this.opts.keysHome ? { home: this.opts.keysHome } : {}));
    return found ? { key: found.key, source: found.source, provider: found.provider, ...(found.model ? { model: found.model } : {}) } : undefined;
  }

  /**
   * Whose key a completion would spend now (keys phase 3): `file` is this
   * machine's person's, stored in keys.json, and pays only for them unless
   * they share it; `env` is the operator's and pays for every editor.
   */
  keySource(): "env" | "file" | undefined {
    return this.resolve()?.source;
  }

  private key(): string | undefined {
    return this.resolve()?.key;
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
  private scrub(text: string, key: string): string {
    return text.split(key).join("[key]");
  }

  /**
   * Ask the text model. Any failure — the provider's refusal, an unreachable
   * provider, an answer that is not JSON — comes back as `text-upstream` with
   * the provider's words, never the key.
   */
  async write(request: { prompt: string; schema: JsonSchema }): Promise<Written> {
    const resolved = this.resolve();
    if (!resolved) throw new Error("the text model has no key");
    const { key } = resolved;
    const named = this.opts.provider ? this.opts.provider() : undefined;
    const provider = named ?? resolved.provider ?? textProvider(key);
    const model = (this.opts.model ? this.opts.model() : undefined) ?? resolved.model;
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
      return { status: 200, body: text.includes(key) ? JSON.parse(this.scrub(text, key)) : body };
    } catch (error) {
      return { status: 502, body: { error: this.scrub(`the text model could not write this: ${(error as Error).message}`, key), code: TEXT_UPSTREAM } };
    }
  }
}
