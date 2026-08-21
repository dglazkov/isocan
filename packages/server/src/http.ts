import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import type { Actor, PostOpRequest, UndoRedoRequest } from "@isocan/core";
import {
  cancelledSince,
  COMMAND_NAME,
  decodeFilename,
  FILENAME_HEADER,
  OpValidationError,
  parseCommandFile,
} from "@isocan/core";
import { Engine, NothingToUndoError, ProjectNotFoundError } from "./engine.ts";
import type { Store } from "./store.ts";
import { PresenceHub, SESSION_TTL_MS } from "./presence.ts";
import { buildStamp } from "./build.ts";

const STARTED_AT = new Date().toISOString();

export function registerRoutes(
  app: FastifyInstance,
  engine: Engine,
  store: Store,
  presence: PresenceHub,
): void {
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

  // The stamp is what lets a CLI notice it is talking to yesterday's daemon.
  app.get("/healthz", async () => ({
    ok: true,
    pid: process.pid,
    startedAt: STARTED_AT,
    ...buildStamp(),
  }));

  app.post("/api/ops", async (req, reply) => {
    const body = req.body as PostOpRequest;
    if (body.op?.type === "actor.claim") {
      // A claim resolves who is speaking, so it is the one op that arrives
      // without an actor; the response envelope carries the answer.
      const entry = await engine.claim({
        op: body.op,
        ...(body.clientId !== undefined ? { clientId: body.clientId } : {}),
      });
      return { seq: entry.seq, envelope: entry.envelope };
    }
    if (!body.actor) {
      return reply.status(400).send({ error: "actor is required", code: "bad-op" });
    }
    if (body.op?.type === "actor.setColor") {
      // Home-scoped like a claim: the registry, not a canvas, is what changes.
      const entry = await engine.setActorColor({
        op: body.op,
        actor: body.actor,
        ...(body.clientId !== undefined ? { clientId: body.clientId } : {}),
      });
      return { seq: entry.seq, envelope: entry.envelope };
    }
    const entry = await engine.submit(body as PostOpRequest & { actor: Actor });
    return { seq: entry.seq, envelope: entry.envelope };
  });

  // ---- the actor registry: who a session key speaks as (#57) ----

  app.get("/api/actors", async (req) => {
    const { keys } = req.query as { keys?: string };
    return engine.actorBindings(keys ? keys.split(",").filter(Boolean) : null);
  });

  /** Chosen identity colors, for clients painting faces before a canvas is
   * open (the projects page) — everything absent is derived from the id. */
  app.get("/api/colors", async () => engine.actorColors());

  /** Current names, for clients rendering words somebody wrote under a name
   * they no longer use — the projects page paints them too. */
  app.get("/api/names", async () => engine.actorNames());

  // ---- slash commands: the work a message can ask for ----

  /** Every command available here — built-ins under this home's own. */
  app.get("/api/commands", async () => engine.commands());

  /** Write one. The body IS the file, so what you PUT is what a text editor
   * would have written, and `isocan command show` hands it straight back. */
  app.put("/api/commands/:name", async (req, reply) => {
    const { name } = req.params as { name: string };
    const text = typeof req.body === "string" ? req.body : String((req.body as { text?: string })?.text ?? "");
    if (!COMMAND_NAME.test(name)) {
      return reply.code(400).send({ error: `not a command name: ${name}` });
    }
    if (!parseCommandFile(name, text)) {
      return reply.code(400).send({ error: "a command needs instructions in its body" });
    }
    await engine.saveCommand(name, text);
    return reply.code(204).send();
  });

  /** Remove one. Removing a shadow gives the built-in back. */
  app.delete("/api/commands/:name", async (req, reply) => {
    const { name } = req.params as { name: string };
    if (!COMMAND_NAME.test(name)) {
      return reply.code(400).send({ error: `not a command name: ${name}` });
    }
    const removed = await engine.deleteCommand(name);
    if (!removed) return reply.code(404).send({ error: `no command of this home is called ${name}` });
    return reply.code(204).send();
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
    const { since, waitMs } = req.query as { since?: string; waitMs?: string };
    const sinceSeq = since ? Number(since) : 0;
    let entries = await engine.getLog(id, sinceSeq);

    // Long-poll: hold the request until an entry lands past `since` (or the
    // window closes). The seq cursor makes this restart-safe — the waiter is
    // resolved by the engine's op event, and a client abort cleans it up.
    const holdMs = Math.min(Number(waitMs) || 0, 55_000);
    if (entries.length === 0 && holdMs > 0) {
      await new Promise<void>((resolve) => {
        const done = () => {
          clearTimeout(timer);
          unsubscribe();
          req.raw.off("close", done);
          resolve();
        };
        const timer = setTimeout(done, holdMs);
        const unsubscribe = engine.onEvent((projectId, message) => {
          if (projectId === id && message.type === "op-applied") done();
        });
        req.raw.on("close", done);
      });
      entries = await engine.getLog(id, sinceSeq);
    }
    return entries;
  });

  /**
   * The whole home's oplog, one cursor per project — what `isocan wait`
   * listens on. An on-call agent hears canvases it has never opened, so the
   * long poll must be woken by ANY project's op, and a project born while it
   * waits is streamed from its first entry.
   */
  app.post("/api/oplog/watch", async (req) => {
    const body = (req.body ?? {}) as import("@isocan/core").WatchLogRequest;
    const { cursors } = body;
    const only = body.only ? new Set(body.only) : null;

    const collect = async (): Promise<import("@isocan/core").WatchLogResponse> => {
      const entries: import("@isocan/core").WatchedLogEntry[] = [];
      const next: Record<string, number> = {};
      for (const project of await engine.listProjects()) {
        if (only && !only.has(project.id)) continue;
        const since = cursors?.[project.id] ?? 0;
        // Seeding (no cursors at all) means "from now on" — tips, no entries.
        const log = cursors ? await engine.getLog(project.id, since) : [];
        const lastSeq = cursors
          ? (log[log.length - 1]?.seq ?? since)
          : (await engine.getSnapshot(project.id)).lastSeq;
        for (const entry of log) {
          entries.push({ ...entry, projectId: project.id, projectTitle: project.title });
        }
        next[project.id] = lastSeq;
      }
      entries.sort((a, b) => a.envelope.ts.localeCompare(b.envelope.ts) || a.seq - b.seq);
      return { entries, cursors: next };
    };

    // Subscribe BEFORE the first sweep: scanning every project takes long
    // enough that an op could land behind the reader and be missed until the
    // window closed. Sweeping many projects is not atomic; this is.
    let landed = false;
    let wake: (() => void) | null = null;
    const unsubscribe = engine.onEvent((projectId, message) => {
      if (message.type !== "op-applied") return;
      if (only && !only.has(projectId)) return; // another canvas is not our business
      landed = true;
      wake?.();
    });
    try {
      let result = await collect();
      const holdMs = Math.min(Number(body.waitMs) || 0, 55_000);
      if (result.entries.length === 0 && !landed && holdMs > 0) {
        await new Promise<void>((resolve) => {
          const done = () => {
            clearTimeout(timer);
            wake = null;
            req.raw.off("close", done);
            resolve();
          };
          const timer = setTimeout(done, holdMs);
          wake = done;
          req.raw.on("close", done);
        });
        result = await collect();
      }
      return result;
    } finally {
      unsubscribe();
    }
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

  // ---- presence sessions (ephemeral plane — no oplog, no storage) ----

  app.post("/api/projects/:id/sessions", async (req) => {
    const { id } = req.params as { id: string };
    await engine.getSnapshot(id); // 404 unknown projects
    const body = req.body as import("@isocan/core").CreateSessionRequest;
    const session = presence.createSession(id, body.actor, "cli", {
      ...(body.label !== undefined ? { label: body.label } : {}),
    });
    return { sessionId: session.sessionId, ttlMs: SESSION_TTL_MS };
  });

  app.put("/api/projects/:id/sessions/:sid", async (req, reply) => {
    const { id, sid } = req.params as { id: string; sid: string };
    const body = (req.body ?? {}) as import("@isocan/core").UpdateSessionRequest;
    if (!presence.touch(id, sid, body)) {
      return reply.status(404).send({ error: "session expired or unknown", code: "unknown-session" });
    }
    // Every command an agent runs beats on this endpoint, which makes it the
    // one place a cancellation can reach something MID-TURN. An agent is not
    // polling the canvas while it works — but it is running tools, and this is
    // what its tools already call.
    const on = presence.onThreadOf(id, sid);
    if (!on) return { ok: true };
    try {
      const { canvas } = await engine.getSnapshot(id);
      const thread = canvas.threads[on.threadId];
      const cancel = thread ? cancelledSince(thread, on.since) : null;
      if (!cancel) return { ok: true };
      return {
        ok: true,
        cancelled: {
          threadId: on.threadId,
          by: cancel.author.name,
          at: cancel.createdAt,
        },
      };
    } catch {
      return { ok: true }; // a canvas mid-delete cancels nothing
    }
  });

  app.delete("/api/projects/:id/sessions/:sid", async (req) => {
    const { id, sid } = req.params as { id: string; sid: string };
    presence.endSession(id, sid);
    return { ok: true };
  });

  app.get("/api/projects/:id/sessions", async (req) => {
    const { id } = req.params as { id: string };
    await engine.getSnapshot(id);
    return presence.roster(id);
  });

  app.delete("/api/presence/actors/:actorId", async (req) => {
    const { actorId } = req.params as { actorId: string };
    const { kind } = req.query as { kind?: "web" | "cli" };
    return { ended: presence.endActorSessions(actorId, kind) };
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
    const filename = decodeFilename(req.headers[FILENAME_HEADER.toLowerCase()]);
    return engine.putBlob(id, data, { mimeType, filename });
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
