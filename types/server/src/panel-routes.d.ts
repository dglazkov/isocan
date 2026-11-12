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
