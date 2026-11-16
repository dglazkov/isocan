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

import guideText from "../agent-guide.md";
import type { CliModule, CliHost } from "@isocan/cli/modulehost";
import { canvasUrl } from "@isocan/core";
import { voiceCore } from "./core.ts";

/**
 * **The terminal half of voice** — the same act, spelled for a shell.
 *
 * A dialog can only open in a browser, so the CLI half cannot press the
 * button; what it can do is say where the button is, and where this canvas
 * lives. `isocan voice` names both — the palette entry a person uses in the
 * app, and the address to open if the app is not already in front of them.
 * The module sentence holds: nothing here writes, and nothing here holds a
 * key.
 */
export const talkCli: CliModule = {
  core: voiceCore,
  guide: guideText,
  register: (host: CliHost) => {
    host.program
      .command("voice")
      .description("Talk to a canvas by voice, from the browser")
      .action(
        host.run(async (_cmd, cmd) => {
          const ctx = await host.ctxOf(cmd);
          const canvas = await host.resolveCanvas(ctx);
          const url = canvasUrl(ctx.client.base, canvas.id);
          console.log(
            `The browser holds the voice: open ${url} and press the floating mic ` +
              `(bottom right). ⌘K → "Configure voice" is where the model lives. The ` +
              `Gemini key stays on the machine that holds the canvas (\`isocan keys set gemini\`); ` +
              `each session gets a one-use token from the home, never the key.`,
          );
        }),
      );
  },
};

/** The runtime loader reads `mod.default`; a named export alone builds and loads nothing. */
export default talkCli;
