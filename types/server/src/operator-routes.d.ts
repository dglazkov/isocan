import type { FastifyInstance, FastifyRequest } from "fastify";
import { type Canvas, type CdnPurge, type Grant, type GrantSubject } from "../../core/src/index.js";
import type { AuthConfig, SigningKeys } from "./attest.js";
import type { Desk } from "./desk.js";
import { type Engine } from "./engine.js";
import type { RouteOptions } from "./http.js";
import type { PresenceHub } from "./presence.js";
import type { Store } from "./store.js";
import { type SweepHub } from "./sweep.js";
import type { Refusals } from "./takedowns.js";
/**
 * **The operator's routes** — everything under `/api/operator/`, and the
 * public takedowns list beside them (operator phases 1–6).
 *
 * They lived inline in `registerRoutes` until cleanup TS-8 (27 Sep 2026),
 * which moved them here whole: a 6,000-line function is one nobody can hold
 * in their head, and these routes share almost nothing with the rest of it —
 * the dependencies below are the whole of what they read from its closure.
 * `registerRoutes` calls this at the point in its sequence where the section
 * used to begin, so registration order is exactly what it was.
 */
export interface OperatorRouteScope {
    engine: Engine;
    store: Store;
    desk: Desk;
    presence: PresenceHub;
    options: RouteOptions;
    auth: AuthConfig | null;
    signingKeys: SigningKeys;
    operators: readonly string[];
    refusals: Refusals;
    wakeWatchers: (canvasId: string) => number;
    cdnPurgeFor: (canvasId: string) => CdnPurge | null;
    sweeps: SweepHub;
    ownerName: (project: {
        createdBy: {
            id: string;
            name: string;
        };
    }) => Promise<string>;
    sourceMutation: (req: FastifyRequest, canvasId: string) => Promise<void>;
    canvasDiscovery: (req: FastifyRequest) => (canvas: Canvas) => Promise<boolean>;
    barRow: (canvasId: string, subject: GrantSubject, grantedBy: string) => Grant;
    namesTheCreator: (subject: GrantSubject, project: {
        createdBy: {
            id: string;
        };
    }) => Promise<boolean>;
    creatorOf: (canvasId: string) => Promise<string | null>;
}
/** The operator's routes, on `app`, at the point `registerRoutes` reaches them — so the
 * paths and the registration order are the ones they had inline. */
export declare function registerOperatorRoutes(app: FastifyInstance, scope: OperatorRouteScope): void;
