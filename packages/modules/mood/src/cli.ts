import guideText from "../agent-guide.md";
import { createInterface } from "node:readline/promises";
import type { Command } from "commander";
import type { CliHost, CliModule } from "@isocan/cli/modulehost";
import { imageModel, MOOD_DEFAULT_N, MOOD_MAX_N, moodCostLine } from "@isocan/core/mood";
import { moodModule } from "./core.ts";

/**
 * **`isocan mood explore "<words>"`** — one spread of mood-board pictures,
 * drawn by the home that holds the canvas with that home's Gemini key
 * (moodboard phase 0; `docs/projects/moodboard/design.md` §2, §7).
 *
 * The CLI composes nothing: the words go to `POST /api/image`, which wraps
 * them in core's template, refuses what the deny-list catches before any
 * spend, draws, and adds the tiles. What this half owns is the ceremony in
 * front of the spend: **the cost is said first**, and a run nobody can be
 * asked about — a pipe, an agent's shell — is refused with that cost until
 * `--yes` says somebody accepted it.
 *
 * The price is this build's (`@isocan/core/mood`, for the default model or
 * `ISOCAN_IMAGE_MODEL` here); the home may run another model, and the answer
 * names the one that drew.
 */

interface ExploreOpts {
  canvas?: string;
  n?: string;
  from?: string;
  yes?: boolean;
}

async function confirmed(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    return /^y(es)?$/i.test((await rl.question(question)).trim());
  } finally {
    rl.close();
  }
}

function register(host: CliHost): void {
  const mood = host.program.command("mood").description("Mood board: explore a feeling with generated pictures");
  mood
    .command("explore <words>")
    .description("Draw a spread of pictures for these words — the home's Gemini key, said in dollars first")
    .option("--canvas <canvas>")
    .option("--n <count>", `how many pictures (default ${MOOD_DEFAULT_N}, at most ${MOOD_MAX_N})`)
    .option("--from <item>", "an image on the canvas to send beside the words (More like this)")
    .option("--yes", "accept the stated cost without being asked")
    .action(
      host.run(async (words: string, opts: ExploreOpts, cmd: Command) => {
        const n = opts.n === undefined ? MOOD_DEFAULT_N : Number(opts.n);
        if (!Number.isInteger(n) || n < 1 || n > MOOD_MAX_N) {
          throw new Error(`--n is 1 to ${MOOD_MAX_N} — the per-run cap is ${MOOD_MAX_N} pictures`);
        }
        if (!words.trim()) throw new Error("say what it should feel like: `isocan mood explore \"<words>\"`");
        const ctx = await host.ctxOf(cmd);
        const canvas = await host.resolveCanvas(ctx);
        let parent: string | undefined;
        if (opts.from) {
          const item = host.resolveItem(await ctx.client.snapshot(canvas.id), opts.from.replace(/^#/, ""));
          const current = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0];
          if (!current?.mimeType.startsWith("image/")) throw new Error(`${item.title} is not an image — --from sends a picture beside the words`);
          parent = item.id;
        }
        const cost = moodCostLine(n, imageModel(process.env));
        console.error(cost);
        if (!opts.yes) {
          if (!process.stdin.isTTY || !process.stderr.isTTY) {
            throw new Error(`${cost} — nobody here can be asked, so nothing was drawn; pass --yes to accept the cost`);
          }
          if (!(await confirmed("Draw them? [y/N] "))) {
            console.error("Nothing drawn.");
            return;
          }
        }
        const answer = await ctx.client.image({ canvasId: canvas.id, actor: ctx.actor, prompt: words, n, ...(parent ? { parent } : {}) });
        if (ctx.json) return host.printJson(answer);
        console.log(`${answer.items.length} of ${n} drawn by ${answer.model}, run ${answer.run} — one undo takes them all back`);
        for (const tile of answer.items) console.log(`  ${tile.itemId}  ${tile.axis}`);
        for (const r of answer.refused) console.log(`  not drawn (${r.axis}): ${r.why}`);
      }),
    );
}

export const moodCli: CliModule = {
  core: moodModule,
  register,
  guide: guideText,
};

/** The runtime loader reads `mod.default`; a named export alone builds and loads nothing. */
export default moodCli;
