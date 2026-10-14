import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Engine } from "./engine.js";
import type { RouteOptions } from "./http.js";
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
export declare function registerForgetRoutes(app: FastifyInstance, scope: ForgetRouteScope): void;
export {};
