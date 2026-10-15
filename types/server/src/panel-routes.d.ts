import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Desk } from "./desk.js";
import type { Engine } from "./engine.js";
import type { Store } from "./store.js";
/**
 * **A panel's own actor, badge and grant** (extensions phase 5, "The extension
 * actor"): the identity desk pointed at software in the dock instead of people.
 * Its own file, the way the pass, operator and forget routes are, so
 * `registerRoutes` stays under its agreed length.
 */
interface PanelRouteScope {
    engine: Engine;
    store: Store;
    desk: Desk;
    sourceMutation: (req: FastifyRequest, canvasId: string) => Promise<void>;
}
/** The panel actor route, on `app`, where `registerRoutes` reaches it. */
export declare function registerPanelRoutes(app: FastifyInstance, scope: PanelRouteScope): void;
export {};
