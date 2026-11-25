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
import {
  MEDIA_CONTROL_ACTIONS,
  dispositionToPromptHint,
  normalizeAgentDisposition,
  parseMediaControlCommand,
} from "@isocan/core/voice-choreography";
import { voiceCore } from "./core.ts";

function parseUnitOption(raw: unknown, name: string): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    throw new Error(`--${name} must be a number in 0..1`);
  }
  return n;
}

/**
 * **The terminal half of voice** — the same act, spelled for a shell.
 *
 * A dialog can only open in a browser, so the CLI half cannot press the
 * button; what it can do is say where the button is, and where this canvas
 * lives. `isocan voice` names both — the palette entry a person uses in the
 * app, and the address to open if the app is not already in front of them.
 * The module sentence holds: nothing here writes to the oplog, and nothing
 * here holds a key.
 */
export const talkCli: CliModule = {
  core: voiceCore,
  guide: guideText,
  register: (host: CliHost) => {
    const voiceCmd = host.program
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

    voiceCmd
      .command("disposition")
      .description("Format and preview 5-axis voice disposition tuning (0..1)")
      .option("--initiative <0..1>", "0 reactive .. 1 proactive (default 0.5)")
      .option("--curiosity <0..1>", "0 decisive .. 1 exploratory (default 0.5)")
      .option("--divergence <0..1>", "0 convergent .. 1 divergent (default 0.5)")
      .option("--depth <0..1>", "0 concise .. 1 thorough (default 0.5)")
      .option("--partnering <0..1>", "0 candid .. 1 encouraging (default 0.5)")
      .action(
        host.run(async (opts: Record<string, unknown>) => {
          const disposition = normalizeAgentDisposition({
            initiative: parseUnitOption(opts.initiative, "initiative"),
            curiosity: parseUnitOption(opts.curiosity, "curiosity"),
            divergence: parseUnitOption(opts.divergence, "divergence"),
            depth: parseUnitOption(opts.depth, "depth"),
            partnering: parseUnitOption(opts.partnering, "partnering"),
          });
          const hint = dispositionToPromptHint(disposition);
          console.log(JSON.stringify({ disposition, hint }, null, 2));
        }),
      );

    voiceCmd
      .command("control")
      .description(`Build an ephemeral co-listening media command (${MEDIA_CONTROL_ACTIONS.join("|")})`)
      .argument("<item>", "media item id or ref")
      .argument("<action>", MEDIA_CONTROL_ACTIONS.join(" | "))
      .option("--time <sec>", "seek position in seconds")
      .option("--rate <multiplier>", "playback rate (0.25..4)")
      .option("--volume <0..1>", "playback volume (0..1)")
      .option("--query <text>", "transcript search query for find_by_transcript")
      .action(
        host.run(async (item: string, action: string, opts: Record<string, unknown>) => {
          const command = parseMediaControlCommand({
            itemId: item,
            action,
            ...(opts.time !== undefined ? { timeSec: Number(opts.time) } : {}),
            ...(opts.rate !== undefined ? { rate: Number(opts.rate) } : {}),
            ...(opts.volume !== undefined ? { volume: Number(opts.volume) } : {}),
            ...(opts.query !== undefined ? { query: String(opts.query) } : {}),
          });
          if (!command) {
            throw new Error(
              `invalid media control command: expected action in ${MEDIA_CONTROL_ACTIONS.join(", ")} with required flags`,
            );
          }
          console.log(JSON.stringify({ ephemeral: true, command }, null, 2));
        }),
      );
  },
};

/** The runtime loader reads `mod.default`; a named export alone builds and loads nothing. */
export default talkCli;
