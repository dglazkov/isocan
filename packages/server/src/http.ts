import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import type { PostOpRequest, UndoRedoRequest } from "@isocan/core";
import { OpValidationError } from "@isocan/core";
import { Engine, NothingToUndoError, ProjectNotFoundError } from "./engine.ts";
import type { Store } from "./store.ts";

const STARTED_AT = new Date().toISOString();

export function registerRoutes(app: FastifyInstance, engine: Engine, store: Store): void {
  // Raw bodies for blob uploads; JSON stays JSON.
  app.addContentTypeParser("*", { parseAs: "buffer" }, (_req, body, done) => done(null, body));

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof OpValidationError) {
      return reply.status(400).send({ error: err.message, code: err.code });
    }
    if (err instanceof ProjectNotFoundError) {
      return reply.status(404).send({ error: err.message, code: "unknown-project" });
    }
    if (err instanceof NothingToUndoError) {
      return reply.status(409).send({ error: err.message, code: "nothing-to-undo" });
    }
    app.log.error(err);
    return reply.status(500).send({ error: "internal error" });
  });

  app.get("/healthz", async () => ({
    ok: true,
    pid: process.pid,
    version: "0.1.0",
    startedAt: STARTED_AT,
  }));

  app.post("/api/ops", async (req) => {
    const body = req.body as PostOpRequest;
    const entry = await engine.submit(body);
    return { seq: entry.seq, envelope: entry.envelope };
  });

  app.get("/api/projects", async () => engine.listProjects());

  app.get("/api/projects/:id", async (req) => {
    const { id } = req.params as { id: string };
    const snapshot = await engine.getSnapshot(id);
    return snapshot.project;
  });

  app.get("/api/projects/:id/canvas", async (req) => {
    const { id } = req.params as { id: string };
    return engine.getSnapshot(id);
  });

  app.get("/api/projects/:id/oplog", async (req) => {
    const { id } = req.params as { id: string };
    const { since } = req.query as { since?: string };
    return engine.getLog(id, since ? Number(since) : 0);
  });

  app.post("/api/projects/:id/undo", async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as UndoRedoRequest;
    return engine.undo(id, body.actor, body.clientId);
  });

  app.post("/api/projects/:id/redo", async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as UndoRedoRequest;
    return engine.redo(id, body.actor, body.clientId);
  });

  app.post("/api/projects/:id/gc", async (req) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as import("@isocan/core").GcRequest;
    return engine.gc(id, body);
  });

  app.post("/api/projects/:id/blobs", async (req, reply) => {
    const { id } = req.params as { id: string };
    await engine.getSnapshot(id); // 404 for unknown projects
    const data = req.body as Buffer;
    if (!Buffer.isBuffer(data) || data.length === 0) {
      return reply.status(400).send({ error: "empty blob body", code: "bad-op" });
    }
    const mimeType = req.headers["content-type"] ?? "application/octet-stream";
    const filename = String(req.headers["x-isocan-filename"] ?? "upload.bin");
    return store.putBlob(id, data, { mimeType, filename });
  });

  app.get("/api/projects/:id/blobs/:hash", async (req, reply) => {
    const { id, hash } = req.params as { id: string; hash: string };
    await engine.getSnapshot(id);
    const blob = await store.getBlob(id, hash);
    if (!blob) return reply.status(404).send({ error: "blob not found" });
    return reply
      .header("Content-Type", blob.meta.mimeType)
      // Defense in depth for HTML blobs: even outside the app's sandboxed
      // iframe, a directly-opened blob document is sandboxed and can't reach
      // the daemon API with an origin.
      .header("Content-Security-Policy", "sandbox allow-scripts")
      .header("X-Content-Type-Options", "nosniff")
      .header("Cache-Control", "immutable, max-age=31536000")
      .send(createReadStream(blob.path));
  });

  registerStaticWebApp(app);
}

/** Serve packages/web/dist (if built) so `isocan open` works without Vite. */
function registerStaticWebApp(app: FastifyInstance): void {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dist = path.resolve(here, "../../web/dist");
  if (!existsSync(path.join(dist, "index.html"))) return;

  const send = (reply: { header: Function; send: Function; type: Function }, file: string) => {
    const types: Record<string, string> = {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript",
      ".css": "text/css",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".ico": "image/x-icon",
    };
    reply.type(types[path.extname(file)] ?? "application/octet-stream");
    return reply.send(createReadStream(file));
  };

  app.get("/*", async (req, reply) => {
    const url = (req.params as { "*": string })["*"] ?? "";
    const resolved = path.resolve(dist, url);
    if (resolved.startsWith(dist) && url && existsSync(resolved)) {
      return send(reply, resolved);
    }
    return send(reply, path.join(dist, "index.html")); // SPA fallback
  });
}
