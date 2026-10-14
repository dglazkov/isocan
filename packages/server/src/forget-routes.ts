import type { FastifyInstance, FastifyRequest } from "fastify";
import { HOME_FORGET_ROUTE, type ForgetCanvasResponse } from "@isocan/core";
import type { Engine } from "./engine.ts";
import type { RouteOptions } from "./http.ts";

/**
 * **`HOME_FORGET_ROUTE`: a person lets go of a replica whose home said it no
 * longer has the canvas** (14 Oct 2026). Every refusal is a sentence, because
 * each one is a reason to keep the copy. Its own file, the way the pass and
 * operator routes are, so `registerRoutes` stays under its agreed length.
 */
interface ForgetRouteScope {
  engine: Engine;
  options: RouteOptions;
  /** The local door's test for this canvas, as `registerRoutes` runs it. */
  admit: (req: FastifyRequest, canvasId: string) => Promise<unknown>;
}

/** The forget route, on `app`, where `registerRoutes` reaches it. */
export function registerForgetRoutes(app: FastifyInstance, scope: ForgetRouteScope): void {
  const { engine, options, admit } = scope;
  const homes = options?.workstation?.homes ?? null;
  app.post(HOME_FORGET_ROUTE, async (req, reply) => {
    const body = (req.body ?? {}) as { canvasId?: unknown };
    const canvasId = typeof body.canvasId === "string" ? body.canvasId.trim() : "";
    if (!canvasId) return reply.status(400).send({ error: "canvasId is required", code: "bad-request" });
    await engine.getSnapshot(canvasId);
    await admit(req, canvasId);
    const home = homes?.for(canvasId) ?? null;
    if (!home) {
      return reply.status(409).send({ error: `${canvasId} lives on this machine — it is not a copy of somewhere else, so there is nothing to forget. \`isocan canvas rm\` deletes a canvas.`, code: "is-home" });
    }
    let held: boolean;
    try { held = await home.holds(canvasId); }
    catch (err) {
      return reply.status(409).send({ error: `${homes!.homeOf(canvasId)} did not answer, so it cannot say whether it still has ${canvasId}; the copy here is kept. Try again when it answers.`, code: "home-unreachable", detail: err instanceof Error ? err.message : String(err) });
    }
    if (held) {
      return reply.status(409).send({ error: `${homes!.homeOf(canvasId)} still has ${canvasId}, so this copy is a live replica of it — it is not forgotten.`, code: "home-holds" });
    }
    const kept = await engine.forgetReplica(canvasId);
    return { canvasId, keptAt: kept?.keptAt ?? null, restoreTo: kept?.restoreTo ?? null } satisfies ForgetCanvasResponse;
  });
}
