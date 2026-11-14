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

import type { CoreModule } from "@isocan/core";
import { MOTION_PROPS } from "@isocan/core/motion";
import { RENDERED_FROM } from "@isocan/core/motion-render";

/**
 * **The record both surfaces register** (motion phase 0). A motion is an
 * ordinary HTML item, so the module owns no kind and no op — only the
 * property keys `isocan motion new` writes onto one
 * (`docs/projects/motion/design.md` §2), and since phase 1 the
 * `renderedFrom` a movie of it wears (an ordinary `video/mp4`, `video/webm`
 * or `image/gif` item, §4).
 * The web's doors (*Animate…*, *Refresh from sources*, *Render movie…*,
 * phase 2) are the lazy half's, behind the `motion` experiment; a comment's
 * `at` is core's, on the comment, not this module's.
 */
export const motionModule: CoreModule = {
  name: "@isocan/motion",
  propertyKeys: [...Object.values(MOTION_PROPS), RENDERED_FROM],
};

export default motionModule;
