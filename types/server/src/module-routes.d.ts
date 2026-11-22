/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import type { FastifyInstance, FastifyRequest } from "fastify";
import { type ActorClaim, type ServerModule } from "../../core/src/index.js";
import type { Engine } from "./engine.js";
import type { RouteOptions } from "./http.js";
import type { JobManager } from "./jobs.js";
import type { Store } from "./store.js";
import { type TextModel } from "./text.js";
import { type UserKeyStore } from "./user-keys.js";
import type { Workstation } from "./workstation.js";
/**
 * **`/api/m/<module>/<path>` — the routes a module's server half owns**
 * (Open Stitch phase 0.1, 19 Nov 2026; `ServerModule` in core's
 * `modules.ts`). The door is the model routes' door, run by the home before
 * any handler and in the order `/api/text` runs it, so a module cannot
 * forget one and two modules cannot drift:
 *
 * 1. the route's own `check` — refusals that cost nothing (the shape, a
 *    deny-list) — then that a canvas is named at all;
 * 2. the door: the takedown and the refused badge, the admission, the edit
 *    rung (a model is spent on a canvas only by someone who may edit it);
 * 3. for a canvas homed elsewhere, that home's own route — with that home's
 *    key, against that home's budget — unless this machine holds a key the
 *    badge may spend (`spend: "none"` always goes to the home: the canvas is
 *    not here);
 * 4. whose key it is: owner-only spend, in the route's words;
 * 5. that there is a key at all;
 * 6. the badge's rate, counted only now, so a refusal never costs a token;
 * 7. the handler, with a host whose `keyFor` answers what step 4 decided.
 *
 * Nothing here knows a module by name: the list is `server-modules.ts`, the
 * third twin of the web's and the CLI's, and `test/modules.test.ts` holds
 * the three to one.
 */
/**
 * **The seams the home hands a module's routes** — what a test fakes the
 * provider through, and what the daemon's own options always carried for the
 * routes that moved here (`RouteOptions.liveToken`, `.image`). The named
 * members are the pipeline's; anything else is the module's own, read from
 * `host.options` (mood's `model`, its `loadSharp`).
 */
export interface ModuleSeams {
    /** The route's key, read per call. Handed in, it counts as the environment's (the operator's). */
    key?: () => string | undefined;
    /** Whose `keys.json` the default key reads: the daemon's home, or `null` when this daemon has no workstation. */
    keysHome?: string | null | undefined;
    /** The transport — the seam a test fakes the provider through. */
    fetch?: typeof fetch;
    /** Asks per badge per minute, over the route's own number. */
    perMinute?: number;
    now?: () => number;
    [seam: string]: unknown;
}
/** One line of the server list: the module, where its seams come from, and the old paths the home still answers for one release. */
export interface ServerModuleEntry {
    module: ServerModule;
    seams?: (options: RouteOptions) => ModuleSeams | undefined;
    /** Route path → the absolute path it used to answer at. The same handler, registered twice. */
    aliases?: Readonly<Record<string, string>>;
}
interface ModuleRouteScope {
    engine: Engine;
    store: Store;
    jobs: JobManager;
    workstation: Workstation | null | undefined;
    options: RouteOptions;
    /** The home's text model and the keys home it reads, for `host.text`. */
    textModel: TextModel;
    textKeysHome: string | null;
    /** Per-user BYOK key store (`user-keys.ts`), overriding env and home keys per call. */
    userKeys: UserKeyStore | null;
    /** A badge's claim rows, for resolving per-user BYOK identity. */
    claimsOf: (badgeId: string) => Promise<ActorClaim[]>;
    /** The model routes' door, owner-only rule, person lookup and keys-home default — handed in so they are the same closures. */
    door: (req: FastifyRequest, canvasId: string) => Promise<void>;
    notTheOwners: (req: FastifyRequest, keysHome: string | null) => Promise<{
        owner: string | null;
    } | null>;
    personFor: (keysHome: string) => Promise<{
        id: string;
        name: string;
    } | null>;
    keysHomeOf: (explicit: string | null | undefined) => string | null;
}
/** Mount every server module's `/api/m/<slug>/*` routes and async job runners onto Fastify. */
export declare function registerModuleRoutes(app: FastifyInstance, scope: ModuleRouteScope, entries?: readonly ServerModuleEntry[]): void;
export {};
