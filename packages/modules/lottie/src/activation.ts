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

import {
  LOTTIE_JSON_MIME,
  LOTTIE_ZIP_MIME,
  isLottieItem,
  lottieModule,
} from "./record.ts";

/**
 * **What the web registers before the module's web half is fetched** —
 * the core record, the renderer mimes, and the focus facet predicate.
 * `packages/web/src/modules.ts` hands this to `deferredModule` so a canvas
 * without a Lottie animation pays zero bytes for the player or studio.
 */
export const lottieActivation = {
  core: lottieModule,
  renderers: [{ mimes: [LOTTIE_JSON_MIME, LOTTIE_ZIP_MIME] }],
  focus: [
    {
      id: "module.lottie",
      priority: 20,
      matches: isLottieItem,
      hasView: true,
      hasEdit: true,
      agentPrompts: [
        {
          label: "Sync to DESIGN.md",
          prompt:
            "Remap this Lottie animation's colors to match the governing DESIGN.md palette.",
        },
        {
          label: "Audit compatibility",
          prompt:
            "Lint this Lottie animation for ThorVG, iOS, and Android compatibility and suggest fixes.",
        },
        {
          label: "Trim dead frames",
          prompt:
            "Trim leading or trailing static frames from this Lottie animation.",
        },
      ],
    },
  ],
};
