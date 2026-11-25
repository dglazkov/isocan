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

import { mindmapCli } from "@isocan/mindmap/cli";
import { mermaidCli } from "@isocan/mermaid/cli";
import { documentsCli } from "@isocan/documents/cli";
import { stickersCli } from "@isocan/stickers/cli";
import { sandboxCli } from "@isocan/sandbox/cli";
import { competitionCli } from "@isocan/design-competition/cli";
import { anatomyCli } from "@isocan/anatomy/cli";
import { talkCli } from "@isocan/talk/cli";
import { wireframeCli } from "@isocan/wireframe/cli";
import { judgeCli } from "@isocan/judge/cli";
import { critiqueCli } from "@isocan/critique/cli";
import { lottieCli } from "@isocan/lottie/cli";
import { moodCli } from "@isocan/mood/cli";
import { motionCli } from "@isocan/motion/cli";
import { exactCli } from "@isocan/exact/cli";
import { describeCli } from "@isocan/describe/cli";
import { videoCli } from "@isocan/video/cli";
import { audioCli } from "@isocan/audio/cli";
import { model3dCli } from "@isocan/model3d/cli";
import { workbenchCli } from "@isocan/workbench/cli";
import { memoryCli } from "@isocan/memory/cli";
import { imageCli } from "@isocan/image/cli";
import { researchCli } from "@isocan/research/cli";
import { mediaEditCli } from "@isocan/media-edit/cli";
import { designSystemCli } from "@isocan/design-system/cli";
import { workspaceCli } from "@isocan/workspace/cli";
import { clipperCli } from "@isocan/clipper/cli";
import { prototypeCli } from "@isocan/prototype/cli";
import type { CliModule } from "./modulehost.ts";

/**
 * **The modules this build of the CLI carries** — the twin of
 * `packages/web/src/modules.ts`, and the other half of the coupling. A module
 * in one list and not the other is the web-only (or terminal-only) feature
 * AGENTS.md forbids, and `test/modules.test.ts` says so.
 */
export const CLI_MODULES: readonly CliModule[] = [mindmapCli, mermaidCli, documentsCli, stickersCli, sandboxCli, competitionCli, anatomyCli, talkCli, wireframeCli, judgeCli, critiqueCli, lottieCli, moodCli, motionCli, exactCli, describeCli, videoCli, audioCli, model3dCli, workbenchCli, memoryCli, imageCli, researchCli, mediaEditCli, designSystemCli, workspaceCli, clipperCli, prototypeCli];
