import type { FastifyInstance, FastifyRequest } from "fastify";
import { type ActorClaim } from "../../core/src/index.js";
import type { Engine } from "./engine.js";
import { type ViewOnlyError } from "./grants.js";
import type { RouteOptions } from "./http.js";
import { type Refusals } from "./takedowns.js";
/**
 * **The two routes that spend the home's keys** — `POST /api/judgment` (the
 * judge, wireframes phase 5) and `POST /api/text` (the text model, copy-edit
 * phase 0.5). Moved out of `registerRoutes` together on 2 Oct 2026 when the
 * second landed, so `registerRoutes` stays under its agreed length
 * (`register-routes.test.ts`) and the twins sit side by side. They read the
 * same closures — the takedown list, the admission, the view-only refusal —
 * handed in by `registerRoutes` where the judgment route used to begin, so
 * registration order is what it was.
 */
interface ModelRouteScope {
    engine: Engine;
    options: RouteOptions;
    refusals: Refusals;
    admit: (req: FastifyRequest, canvasId: string) => Promise<unknown>;
    viewOnly: (canvasId: string) => Promise<ViewOnlyError>;
    /** A badge's claim rows — the actors it speaks for, which owner-only spend compares with this machine's person. */
    claimsOf: (badgeId: string) => Promise<ActorClaim[]>;
}
/** The judgment and text routes, on `app`, at the point `registerRoutes` reaches them. */
export declare function registerModelRoutes(app: FastifyInstance, scope: ModelRouteScope): void;
export {};
