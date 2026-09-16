import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
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
  guide: readFileSync(fileURLToPath(new URL("../agent-guide.md", import.meta.url)), "utf8"),
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
              `(bottom right). ⌘K → "Configure voice" is where the key and the model ` +
              `live — the key stays in that browser's storage, never on the canvas, ` +
              `never in the daemon.`,
          );
        }),
      );
  },
};

/** The runtime loader reads `mod.default`; a named export alone builds and loads nothing. */
export default talkCli;
