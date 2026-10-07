import type { Command } from "commander";
import { paths } from "@isocan/server";
import { printJson, printTable } from "./output.ts";

/**
 * **`isocan model` — the local judge's model on this machine** (local-judge
 * phase 0; `docs/projects/local-judge/design.md`).
 *
 * `fetch <name>` downloads a model the manifest in `@isocan/core/local-judge`
 * names — from that URL and nowhere else — checks it against the pinned
 * length and SHA-256, and moves it into `<home>/models/` only if both match.
 * `ls` says what the manifest knows and what this home has. The daemon serves
 * that directory to this machine's own pages at `GET /models/<name>`, so a
 * browser loads the model from its own origin and nothing it judges leaves it.
 *
 * A verb rather than a script because an agent's hands are the CLI. It needs
 * no daemon — the directory is this machine's. The store is imported when a
 * verb RUNS, as `keys` does, so `isocan --version` loads nothing of it.
 */

const load = () => import("@isocan/core/modelstore");

/** The home the daemon serves models from — the one keys.json is in. */
function home(): string {
  return paths.isocanHome();
}

const mb = (n: number) => `${(n / 1_000_000).toFixed(1)} MB`;

export function registerModel(program: Command): void {
  const model = program
    .command("model")
    .description("The local judge's model on this machine (<home>/models/): ls, fetch — pinned by SHA-256, served to this machine's pages only")
    .addHelpText(
      "after",
      `
The judge in the tab (local-judge) runs a small model in the browser, which
loads it from this machine's daemon at /models/<name> — never from anywhere
else. \`fetch\` puts it on disk: downloaded from the one URL the manifest
names, checked against the pinned size and SHA-256, and moved into
<home>/models/ only if both match. A mismatch is refused and the partial
file deleted.

  isocan model                                   # the same as ls
  isocan model fetch embeddinggemma-2-text-270m  # 164.6 MB, once`,
    );

  model
    .command("ls", { isDefault: true })
    .description("The models isocan knows, their pinned size and hash, and whether this home has each")
    .action(async (_opts: unknown, cmd: Command) => {
      const s = await load();
      const rows = await s.listModels(home());
      if (cmd.optsWithGlobals().json) return printJson({ dir: s.modelsDir(home()), models: rows });
      printTable(rows.map((r) => ({ model: r.name, here: r.present ? "yes" : r.bytes > 0 ? `partial? ${r.bytes} bytes` : "no", size: mb(r.expected), sha256: `${r.sha256.slice(0, 12)}…`, licence: r.licence })));
      console.log(`\n${s.modelsDir(home())}`);
      const missing = rows.filter((r) => !r.present);
      if (missing.length > 0) console.log(`fetch with: isocan model fetch ${missing[0]!.name}`);
    });

  model
    .command("fetch <name>")
    .description("Download a known model, verify its size and SHA-256, and install it atomically into <home>/models/")
    .action(async (name: string, _opts: unknown, cmd: Command) => {
      const s = await load();
      const m = s.modelNamed(name);
      const json = cmd.optsWithGlobals().json;
      let shown = -1;
      let announced = false;
      const tty = process.stderr.isTTY;
      const got = await s.fetchModel(home(), name, json ? {} : {
        onProgress: (received, total) => {
          // Said on the first bytes, not before: a file already here is verified, not fetched.
          if (!announced) {
            announced = true;
            console.error(`fetching ${m.name} (${mb(m.bytes)}) from ${m.url}`);
          }
          const pct = Math.floor((received / total) * 100);
          if (pct === shown || (!tty && pct % 10 !== 0)) return;
          shown = pct;
          if (tty) process.stderr.write(`\r${pct}% ${mb(received)} of ${mb(total)}`);
          else console.error(`${pct}% ${mb(received)} of ${mb(total)}`);
        },
      });
      if (tty && shown >= 0) process.stderr.write("\n");
      if (json) return printJson(got);
      console.log(got.downloaded ? `${m.name}: installed ${got.path} (${got.bytes} bytes, sha256 ${got.sha256}) in ${(got.ms / 1000).toFixed(1)}s` : `${m.name}: already here and verified — ${got.path}`);
    });
}
