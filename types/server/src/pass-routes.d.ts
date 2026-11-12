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
import type { Desk } from "./desk.js";
import type { Engine } from "./engine.js";
import type { RouteOptions } from "./http.js";
/**
 * **The pass routes** — minting one, reading it back, redeeming it (Scene 5).
 *
 * Inline in `registerRoutes` until cleanup TS-8 (27 Sep 2026) moved them
 * here whole, beside `withoutSecret` and `hostOf`, which only they read.
 * `registerRoutes` calls this where the section used to begin, so
 * registration order is exactly what it was.
 */
export interface PassRouteScope {
    engine: Engine;
    desk: Desk;
    options: RouteOptions;
    sourceMutation: (req: FastifyRequest, canvasId: string) => Promise<void>;
}
/** The pass routes, on `app`, at the point `registerRoutes` reaches them — so the paths
 * and the registration order are the ones they had inline. */
export declare function registerPassRoutes(app: FastifyInstance, scope: PassRouteScope): void;
