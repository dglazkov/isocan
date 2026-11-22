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
import type { ServerModuleEntry } from "./module-routes.js";
/**
 * **The modules whose server half this build of the home carries** — the
 * third twin, beside `packages/web/src/modules.ts` and
 * `packages/cli/src/modules.ts`, and the only file in the server that names
 * a module. A module with a `./server` export that is not here has a route
 * nobody can reach; one here with no `./web` or `./cli` is a server-only
 * feature nobody can ask for. `test/modules.test.ts` holds both.
 *
 * Each line says where the module's seams come from — the daemon's options
 * carried `liveToken` and `image` before the routes were the modules', and
 * every test that fakes Google hands them there — and which OLD paths the
 * home still answers at.
 *
 * **The aliases are for one release.** `/api/voice/token`, `/api/image` and
 * `/api/image/swatches` moved to `/api/m/<module>/…` on 19 Nov 2026 (module
 * API 0.2.12); a browser or CLI built before that still asks at the old
 * paths, so the same handler answers at both. Remove the three aliases, the
 * `*_LEGACY` constants in core and this paragraph in the release AFTER the
 * one that ships 0.2.12 — no later than 19 Dec 2026.
 */
export declare const SERVER_MODULES: readonly ServerModuleEntry[];
