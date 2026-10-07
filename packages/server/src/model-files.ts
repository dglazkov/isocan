import { createReadStream, promises as fs } from "node:fs";
import type { FastifyInstance } from "fastify";
import { localModel, MODELS_ROUTE } from "@isocan/core/local-judge";
import { modelPath } from "@isocan/core/modelstore";
import { loopbackBound } from "./route-helpers.ts";

/**
 * **`GET /models/<name>` — the local judge's model, from this machine to its
 * own pages** (local-judge phase 0; design *Privacy, proved rather than
 * implied*).
 *
 * The browser's Worker loads the model from the daemon's own origin, so the
 * privacy proof can say every request went there. What it serves is
 * `<home>/models/<file>`, put there by `isocan model fetch`:
 *
 * - **Known names only.** The name is looked up in core's manifest; the file
 *   comes from the manifest entry, never from the path. No listing, no
 *   traversal, no other file in the directory — an unknown name is a 404.
 * - **This machine only.** The keys routes' gate: a daemon serving the world,
 *   bound off loopback, or asked by a peer off loopback answers 404, the same
 *   answer a hosted home gives, because there the route does not exist (where
 *   a hosted home serves models from is still open — design *Open*). A
 *   loopback Host is required too, so a rebound DNS name cannot read it.
 * - **Named, sized and long-cached.** `application/octet-stream` with an
 *   exact `Content-Length`; `immutable` for a year is safe because the name
 *   pins a hash — a new model is a new name. A known name not yet fetched is
 *   a 404 that says which verb fetches it.
 */

/**
 * **The judge's Worker carries its own policy** (local-judge phase 0, *Privacy,
 * proved rather than implied*). A dedicated Worker takes its
 * Content-Security-Policy from its own script's response — the lab page's
 * meta tag does not reach it — so the static handler sends this with the one
 * asset the lab's build names `judge-worker-<hash>.js`, and with nothing else.
 * `connect-src 'self'` is the point: fetch, XMLHttpRequest, WebSocket and
 * sendBeacon from the Worker reach this origin or are blocked by the browser,
 * whatever MediaPipe's code tries. `script-src` admits this origin's wasm
 * loader and `'wasm-unsafe-eval'` its compile; nothing wider.
 */
export const JUDGE_WORKER_POLICY = "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'";

/** The policy a static file is served with, if it has one of its own — only the judge's Worker does. */
export function judgeWorkerPolicy(file: string): string | null {
  const base = file.split(/[\\/]/).pop() ?? "";
  return /^judge-worker-[A-Za-z0-9_-]+\.js$/.test(base) ? JUDGE_WORKER_POLICY : null;
}

const LOOPBACK_PEERS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const isLoopbackHost = (host: string | undefined) => !!host && /^(localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i.test(host.trim());

interface ModelFileScope {
  /** The home whose `models/` is served — the one keys.json is in. */
  home: string;
  servesWorld: boolean | undefined;
}

const MODEL_FILE_ROUTE = `${MODELS_ROUTE}/:name`;

/** `GET /models/:name` on `app`, behind this machine-only gate. */
export function registerModelFileRoutes(app: FastifyInstance, scope: ModelFileScope): void {
  app.get(MODEL_FILE_ROUTE, async (req, reply) => {
    if (scope.servesWorld === true || !loopbackBound(app) || !LOOPBACK_PEERS.has(req.ip) || !isLoopbackHost(req.headers.host)) {
      return reply.status(404).send({ error: "models are served only by a local daemon to this machine's own pages", code: "model-not-here" });
    }
    const name = (req.params as { name: string }).name;
    const model = localModel(name);
    if (!model) return reply.status(404).send({ error: "no such model", code: "model-unknown" });
    const file = modelPath(scope.home, model);
    const size = await fs.stat(file).then((s) => s.size, () => -1);
    if (size !== model.bytes) {
      return reply.status(404).send({ error: `${model.name} is not on this machine — \`isocan model fetch ${model.name}\` puts it there`, code: "model-not-fetched" });
    }
    reply.type("application/octet-stream");
    reply.header("Content-Length", String(size));
    reply.header("Cache-Control", "private, max-age=31536000, immutable");
    reply.header("X-Content-Type-Options", "nosniff");
    return reply.send(createReadStream(file));
  });
}
