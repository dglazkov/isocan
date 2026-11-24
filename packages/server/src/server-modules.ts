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

import { LIVE_TOKEN_ROUTE_LEGACY } from "@isocan/core/keys";
import { IMAGE_ROUTE_LEGACY, SWATCHES_ROUTE_LEGACY } from "@isocan/core/mood";
import { moodServer } from "@isocan/mood/server";
import { talkServer } from "@isocan/talk/server";
import { describeServer } from "@isocan/describe/server";
import { videoServer } from "@isocan/video/server";
import { audioServer } from "@isocan/audio/server";
import { workbenchServer } from "@isocan/workbench/server";
import { memoryServer } from "@isocan/memory/server";
import { imageServer } from "@isocan/image/server";
import { researchServer } from "@isocan/research/server";
import { mediaEditServer } from "@isocan/media-edit/server";
import { designSystemServer } from "@isocan/design-system/server";
import { workspaceServer } from "@isocan/workspace/server";
import { clipperServer } from "@isocan/clipper/server";
import { prototypeServer } from "@isocan/prototype/server";
import type { ServerModuleEntry } from "./module-routes.ts";

/** The real import, once: the answer does not change while the process runs. */
let sharp: Promise<{ default: typeof import("sharp").default }> | undefined;
const importSharp = () => (sharp ??= import("sharp"));

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
export const SERVER_MODULES: readonly ServerModuleEntry[] = [
  { module: talkServer, seams: (options) => options.liveToken, aliases: { token: LIVE_TOKEN_ROUTE_LEGACY } },
  // `sharp` is the home's optional dependency, lent to the module as a seam
  // (`host.options.loadSharp`) so the module names no dependency of its own;
  // a test hands one that fails, as it does where the package is absent.
  { module: moodServer, seams: (options) => ({ loadSharp: importSharp, ...options.image }), aliases: { image: IMAGE_ROUTE_LEGACY, swatches: SWATCHES_ROUTE_LEGACY } },
  { module: describeServer, seams: (options) => options.modules?.describe },
  { module: videoServer, seams: (options) => options.modules?.video },
  { module: audioServer, seams: (options) => options.modules?.audio },
  { module: workbenchServer, seams: (options) => options.modules?.workbench },
  { module: memoryServer, seams: (options) => options.modules?.memory },
  { module: imageServer, seams: (options) => options.modules?.image },
  { module: researchServer, seams: (options) => options.modules?.research },
  { module: mediaEditServer, seams: (options) => options.modules?.["media-edit"] },
  { module: designSystemServer, seams: (options) => options.modules?.["design-system"] },
  { module: workspaceServer, seams: (options) => options.modules?.workspace },
  { module: clipperServer, seams: (options) => options.modules?.clipper },
  { module: prototypeServer, seams: (options) => options.modules?.prototype },
];
