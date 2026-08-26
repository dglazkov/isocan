import type { FastifyInstance } from "fastify";
import type { Engine } from "./engine.ts";
import type { Store } from "./store.ts";
import type { HomeLinks } from "./home-links.ts";

/**
 * **The content role** — the route set a content origin serves, and nothing
 * else (`docs/projects/atlas/content-origin-plan.md`, stage 1).
 *
 * The proposal's rule, held structurally: an origin that serves item content
 * must hold *nothing* — no door, no canvas questions, no API — or it has
 * become a second API with no door on it. So the role is one function that
 * registers exactly one route, and `content.test.ts` enumerates the route
 * table to keep it that way.
 *
 * The same function serves BOTH origins. Today the main app mounts it on the
 * app origin, where the door's `onRequest` hook still gates it — behavior
 * identical to the inline route this replaced. Stage 2 mounts it again on a
 * second loopback listener with no door at all, which is acceptable there for
 * the tree's three facts: loopback-bound, single-user home, hash-addressed.
 * Stage 4 mounts it by Host header on the hosted shape — see
 * `isContentRequest` — once the read-auth question is answered.
 *
 * Addressing keeps `(canvasId, hash)` as opaque path segments: answering
 * "bytes for this pair, or 404" is not answering questions about canvases,
 * and hash-only addressing would force a cross-canvas lookup the store does
 * not owe anyone.
 */

/** One spelling of the role's one route. The path is identical on every
 * origin that mounts the role, so a frame URL is always `base + path` and
 * nothing ever rewrites paths per origin. */
export const CONTENT_BLOB_ROUTE = "/api/projects/:id/blobs/:hash";

export interface ContentDeps {
  engine: Engine;
  store: Store;
  /** Bytes this replica never held stream through from the canvas's home —
   * the same pass-through the app-origin route has always done. */
  homes: HomeLinks | null;
}

export interface ContentOptions {
  /**
   * The `Content-Security-Policy` these responses carry, or null for none.
   *
   * The app origin passes `"sandbox allow-scripts"` — defense in depth for a
   * directly-opened blob document, unchanged from before the extraction. The
   * content role must NOT send that header as-is: a response-header sandbox
   * intersects with any iframe attribute and re-imposes the opaque origin,
   * defeating the storage the split exists to grant (measured from the other
   * side in `docs/research/2026-08-26-wysiwyg.md`). What the content role
   * sends instead is stage 3's decision, made on measurement.
   */
  csp: string | null;
}

/**
 * Is this request addressed to the content origin? The hosted shape has one
 * `$PORT`, so the role is recognized by Host header there rather than by
 * listener; a local content listener never needs to ask (everything it hears
 * is the role's). Null `contentHost` — every shape today — means no request
 * ever is.
 */
export function isContentRequest(
  hostHeader: string | undefined,
  contentHost: string | null,
): boolean {
  if (!contentHost || !hostHeader) return false;
  // The Host header may carry a port; the configured content host is a bare
  // domain. Ports do not disambiguate origins on the hosted shape (the load
  // balancer owns them), so the comparison is host-only, case-insensitive.
  const bare = hostHeader.split(":")[0]!.toLowerCase();
  return bare === contentHost.toLowerCase();
}

const CACHE_BLOB = "private, immutable, max-age=31536000";

/** Register the content role's routes — all of them, which is one. */
export function registerContentRoutes(
  app: FastifyInstance,
  deps: ContentDeps,
  options: ContentOptions,
): void {
  const { engine, store, homes } = deps;

  app.get(CONTENT_BLOB_ROUTE, async (req, reply) => {
    const { id, hash } = req.params as { id: string; hash: string };
    await engine.getSnapshot(id);
    const meta = await store.blobMeta(id, hash);
    /**
     * Bytes this replica has never held, read straight from the home.
     *
     * The ops replicate; the blobs they name do not follow on their own. So a
     * replica that applied somebody else's `item.add` knows the hash and has
     * nothing under it — and an item that renders as a broken version on the
     * one machine an agent's hands can reach is not a replica, it is a list of
     * hashes. The bytes are streamed through rather than mirrored to disk: a
     * read is not the moment to decide what this machine should keep, and
     * content addressing means the copy that arrives with the next upload is
     * the same copy either way.
     *
     * Range requests go up with the request, so seeking a video does not drag
     * the whole object across twice.
     */
    const blobHome = homes?.for(id) ?? null;
    if (!meta && blobHome) {
      const range = parseRange(req.headers.range, Number.MAX_SAFE_INTEGER);
      const remote = await blobHome.openBlob(
        id,
        hash,
        range && range !== "unsatisfiable" ? range : undefined,
      );
      if (!remote) return reply.status(404).send({ error: "blob not found" });
      reply
        .header("Content-Type", remote.mimeType)
        .header("X-Content-Type-Options", "nosniff")
        .header("Cache-Control", CACHE_BLOB);
      if (options.csp) reply.header("Content-Security-Policy", options.csp);
      return reply.send(remote.stream);
    }
    if (!meta) return reply.status(404).send({ error: "blob not found" });

    reply
      .header("Content-Type", meta.mimeType)
      .header("X-Content-Type-Options", "nosniff")
      .header("Cache-Control", CACHE_BLOB)
      // Said unconditionally, so a player knows it may seek BEFORE it asks.
      .header("Accept-Ranges", "bytes");
    if (options.csp) reply.header("Content-Security-Policy", options.csp);

    const range = parseRange(req.headers.range, meta.size);
    if (range === "unsatisfiable") {
      return reply.status(416).header("Content-Range", `bytes */${meta.size}`).send();
    }
    if (range) {
      const stream = await store.openBlob(id, hash, range);
      if (!stream) return reply.status(404).send({ error: "blob not found" });
      return reply
        .status(206)
        .header("Content-Range", `bytes ${range.start}-${range.end}/${meta.size}`)
        .header("Content-Length", String(range.end - range.start + 1))
        .send(stream);
    }
    const stream = await store.openBlob(id, hash);
    if (!stream) return reply.status(404).send({ error: "blob not found" });
    return reply.header("Content-Length", String(meta.size)).send(stream);
  });
}

function parseRange(
  header: string | undefined,
  size: number,
): { start: number; end: number } | "unsatisfiable" | null {
  if (typeof header !== "string") return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (rawStart === "" && rawEnd === "") return null;
  if (rawStart === "") {
    // A suffix range: the LAST n bytes. `bytes=-0` asks for nothing.
    const wanted = Number(rawEnd);
    if (wanted === 0) return "unsatisfiable";
    return { start: Math.max(0, size - wanted), end: size - 1 };
  }
  const start = Number(rawStart);
  if (start >= size) return "unsatisfiable";
  const end = rawEnd === "" ? size - 1 : Math.min(Number(rawEnd), size - 1);
  if (end < start) return "unsatisfiable";
  return { start, end };
}
