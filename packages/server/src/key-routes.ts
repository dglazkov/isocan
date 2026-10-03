import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { envKeyFor, isKeyProvider, KEY_PROVIDERS, keyRows, KEYS_NOT_HERE, KEYS_ROUTE, KEYS_SHARING_ROUTE, lastFour, type KeyEnv, type KeyProvider, type KeysListing } from "@isocan/core/keys";
import { checkKey, KeyFileRefused, keysFile, readKeyFile, removeKey, resolveKeyAsync, setKeySharing, writeKey, type KeyFileContents } from "@isocan/core/keystore";
import { loopbackBound } from "./route-helpers.ts";

/**
 * **The settings area's hands: model keys, over HTTP, to this machine only**
 * (keys phase 2; `docs/projects/keys/design.md`).
 *
 * `GET /api/keys` lists every provider — set or not, `…abcd`, when, what uses
 * it, whether the environment overrides it — and NEVER the value.
 * `PUT /api/keys/:provider` takes `{ key }` and answers with the row.
 * `DELETE` removes one. `PUT /api/keys/sharing` takes `{ share }` — owner-only
 * spend's switch (keys phase 3). `POST /api/keys/:provider/test` makes the one cheap
 * call `isocan keys test` makes and answers with the provider's words, the
 * key scrubbed out of them. They are `isocan keys`, spoken by the web app, and
 * they read and write the same `keys.json` through the same `@isocan/core`
 * helpers — the rows are core's `keyRows`, so the two surfaces cannot disagree.
 *
 * **The gate is the tree's, and then some.** `treeGate` in `http.ts`: this
 * daemon bound to loopback (and not told it serves the world), the peer ON
 * loopback — otherwise 404, the same answer a hosted home gives, because there
 * a key route does not exist. Two more checks, because a loopback peer is not
 * the same thing as this machine's person: a page on another site the browser
 * is showing can reach `127.0.0.1` too.
 *
 * - **Host is a loopback name.** A rebound DNS name arrives carrying ITS name.
 * - **Origin, when there is one, is a loopback origin.** The door hook's
 *   `originAllowed` lets a bearer through unjudged and widens with
 *   `ISOCAN_ALLOWED_ORIGINS`; neither belongs anywhere near a key.
 *
 * Both are the voice harness's `doorRefusal` (keys phase 0), mirrored rather
 * than imported because the harness depends on the server and not the other
 * way round. And the bodies are JSON or nothing: this scope has ONE parser,
 * `application/json`, so a cross-site `text/plain` PUT is a 415 before any
 * handler, and a malformed body is refused without the parse error that would
 * quote it back.
 *
 * **The value goes one way.** In through `PUT`, onto disk, and out of no
 * response, error or log line — the tests grep every answer for it.
 */

/** What a daemon may hand these routes. Tests use both; a running home uses neither. */
export interface KeyRouteOptions {
  /** The environment the env-override is read from. Default: `process.env`. */
  env?: KeyEnv;
  /** The transport `test` asks the provider through. Default: global `fetch`. */
  fetch?: typeof fetch;
}

interface KeyRouteScope {
  /** The home whose `keys.json` this daemon reads — its own, as the judge's is. */
  home: string;
  /** What the bind says (`RouteOptions.servesWorld`): a daemon serving the world has no key routes. */
  servesWorld: boolean | undefined;
  keys?: KeyRouteOptions;
}

/** The largest key body taken. A model key is under 200 characters; this is the bound, not the size. */
const KEY_BODY_LIMIT = 16 * 1024;

const LOOPBACK_PEERS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

/** `localhost`, `127.0.0.1:4441`, `[::1]:5173` — a loopback name, with or without a port. The harness's `isLoopbackHost`. */
function isLoopbackHost(host: string | undefined): boolean {
  return !!host && /^(localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i.test(host.trim());
}

/** An `http(s)://` origin on a loopback name. `null` is not one. The harness's `isLoopbackOrigin`. */
function isLoopbackOrigin(origin: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  return (url.protocol === "http:" || url.protocol === "https:") && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname.toLowerCase());
}

const header = (raw: string | string[] | undefined): string | undefined => (Array.isArray(raw) ? raw[0] : raw);

/** The keys routes, in a scope of their own, on `app`. */
export function registerKeyRoutes(app: FastifyInstance, scope: KeyRouteScope): void {
  const { home } = scope;
  const env = (): KeyEnv => scope.keys?.env ?? process.env;

  /** Refuse anything that is not this machine's own page or terminal; true when it may go on. */
  const gate = (req: FastifyRequest, reply: FastifyReply): boolean => {
    if (scope.servesWorld === true || !loopbackBound(app) || !LOOPBACK_PEERS.has(req.ip)) {
      reply.status(404).send({
        error: "model keys live on the machine that spends them — this home's keys are set by whoever runs it, and are not served here",
        code: KEYS_NOT_HERE,
      });
      return false;
    }
    if (!isLoopbackHost(header(req.headers.host))) {
      reply.status(403).send({ error: "model keys answer only to a loopback name (localhost, 127.0.0.1, [::1]) — that request named another host", code: KEYS_NOT_HERE });
      return false;
    }
    const origin = header(req.headers.origin);
    if (origin !== undefined && !isLoopbackOrigin(origin)) {
      reply.status(403).send({ error: "model keys answer only this machine's own pages — that request came from another site", code: KEYS_NOT_HERE });
      return false;
    }
    return true;
  };

  /** The provider in the path, or a 400 that names the ones there are. */
  const providerIn = (req: FastifyRequest, reply: FastifyReply): KeyProvider | null => {
    const raw = String((req.params as { provider?: string }).provider ?? "").toLowerCase();
    if (isKeyProvider(raw)) return raw;
    // Not echoed: a key pasted into the wrong place is still a key.
    reply.status(400).send({ error: `that is not a provider — the providers are ${KEY_PROVIDERS.join(", ")}`, code: "bad-provider" });
    return null;
  };

  /** The stored file, or the refusal it earned (a loose mode, unparseable JSON) — in words that never quote it. */
  const stored = async (): Promise<KeyFileContents & { refused?: string }> => {
    try {
      return await readKeyFile(home);
    } catch (err) {
      return { keys: {}, share: false, refused: (err as Error).message };
    }
  };

  const rowsNow = async (): Promise<KeysListing> => {
    const { keys, share, refused } = await stored();
    return { file: keysFile(home), ...(refused ? { refused } : {}), share, keys: keyRows(keys, env()) };
  };

  void app.register(async (keys) => {
    // One parser, and it never quotes what it could not read.
    keys.removeAllContentTypeParsers();
    keys.addContentTypeParser("application/json", { parseAs: "string", bodyLimit: KEY_BODY_LIMIT }, (_req, body, done) => {
      if (body === "" || body === undefined) return done(null, undefined);
      try {
        done(null, JSON.parse(body as string));
      } catch {
        done(Object.assign(new Error("the body is not JSON — send { \"key\": \"…\" } as application/json"), { statusCode: 400 }), undefined);
      }
    });

    keys.get(KEYS_ROUTE, async (req, reply) => {
      if (!gate(req, reply)) return reply;
      reply.header("Cache-Control", "no-store");
      return rowsNow();
    });

    // Owner-only spend's switch (keys phase 3): `{ share: true }` lets
    // collaborators on canvases this machine holds spend the stored keys.
    keys.put(KEYS_SHARING_ROUTE, async (req, reply) => {
      if (!gate(req, reply)) return reply;
      const share = (req.body as { share?: unknown } | undefined)?.share;
      if (typeof share !== "boolean") return reply.status(400).send({ error: 'send { "share": true } or { "share": false }', code: "bad-share" });
      try {
        await setKeySharing(home, share);
      } catch (err) {
        const refused = err instanceof KeyFileRefused;
        return reply.status(refused ? 409 : 500).send({ error: (err as Error).message, code: refused ? "keys-file-refused" : "keys-write-failed" });
      }
      reply.header("Cache-Control", "no-store");
      return rowsNow();
    });

    keys.put(`${KEYS_ROUTE}/:provider`, async (req, reply) => {
      if (!gate(req, reply)) return reply;
      const provider = providerIn(req, reply);
      if (!provider) return reply;
      const body = req.body as { key?: unknown; model?: unknown } | undefined;
      const key = typeof body?.key === "string" ? body.key.trim() : "";
      if (!key) return reply.status(400).send({ error: `no key given for ${provider} — send { "key": "…" }; nothing was stored`, code: "bad-key" });
      if (/\s/.test(key)) return reply.status(400).send({ error: `a ${provider} key has no spaces or line breaks in it — nothing was stored`, code: "bad-key" });
      const model = typeof body?.model === "string" ? body.model : undefined;
      try {
        await writeKey(home, provider, key, model);
      } catch (err) {
        // `KeyFileRefused` names the file and its mode; nothing in writeKey's errors carries the key.
        const refused = err instanceof KeyFileRefused;
        return reply.status(refused ? 409 : 500).send({ error: (err as Error).message.split(key).join("[key]"), code: refused ? "keys-file-refused" : "keys-write-failed" });
      }
      reply.header("Cache-Control", "no-store");
      const overridden = envKeyFor(provider, env());
      return { provider, stored: true, lastFour: lastFour(key), ...(overridden ? { overriddenBy: overridden.variable } : {}) };
    });

    keys.delete(`${KEYS_ROUTE}/:provider`, async (req, reply) => {
      if (!gate(req, reply)) return reply;
      const provider = providerIn(req, reply);
      if (!provider) return reply;
      try {
        return { provider, removed: await removeKey(home, provider) };
      } catch (err) {
        const refused = err instanceof KeyFileRefused;
        return reply.status(refused ? 409 : 500).send({ error: (err as Error).message, code: refused ? "keys-file-refused" : "keys-write-failed" });
      }
    });

    keys.post(`${KEYS_ROUTE}/:provider/test`, async (req, reply) => {
      if (!gate(req, reply)) return reply;
      const provider = providerIn(req, reply);
      if (!provider) return reply;
      let found;
      try {
        found = await resolveKeyAsync(provider, { env: env(), home });
      } catch (err) {
        return reply.status(409).send({ error: (err as Error).message, code: "keys-file-refused" });
      }
      if (!found) return reply.status(404).send({ error: `no ${provider} key here — set one first`, code: "no-key" });
      const which = found.source === "env" ? `${found.variable} ${lastFour(found.key)}` : `stored ${lastFour(found.key)}`;
      const result = await checkKey(provider, found.key, scope.keys?.fetch ?? fetch);
      return { provider, key: which, ok: result.ok, answer: result.answer, ...(result.status !== undefined ? { status: result.status } : {}) };
    });
  });
}
