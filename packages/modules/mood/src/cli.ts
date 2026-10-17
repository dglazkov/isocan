import guideText from "../agent-guide.md";
import { createInterface } from "node:readline/promises";
import type { Command } from "commander";
import type { CliHost, CliModule } from "@isocan/cli/modulehost";
import { isAgentHarness, newGroupId } from "@isocan/core";
import {
  findMoodBoard,
  imageModel,
  isMoodDial,
  MOOD_BOARD_BYTES,
  MOOD_BOARD_TITLE,
  MOOD_DEFAULT_N,
  MOOD_DIALS,
  MOOD_MAX_N,
  MOOD_MORE_N,
  MOOD_PROPS,
  moodCostLine,
  moodDropOps,
  moodKeepPlan,
  moodWordsFromPrompt,
} from "@isocan/core/mood";
import { moodModule } from "./core.ts";

/**
 * **`isocan mood explore | keep | drop | more`** — a spread of mood-board
 * pictures drawn by the home that holds the canvas with that home's Gemini key,
 * plus keeping tiles into the Mood board, dropping candidates to trash, and
 * reaching for more like a picture or pushing it along a dial
 * (moodboard phases 0–1; `docs/projects/moodboard/design.md` §1–§3, §7).
 *
 * The CLI composes nothing: the words go to `POST /api/image`, which wraps
 * them in core's template, refuses what the deny-list catches before any
 * spend, draws, and adds the tiles. What this half owns is the ceremony in
 * front of the spend: **the cost is said first**, and a run nobody can be
 * asked about — a pipe, an agent's shell — is refused with that cost until
 * `--yes` says somebody accepted it. Keeping is a person's taste, so `mood
 * keep` refuses an agent harness or an agent actor.
 */

interface ExploreOpts {
  canvas?: string;
  n?: string;
  from?: string;
  yes?: boolean;
}

interface KeepOpts {
  canvas?: string;
}

interface DropOpts {
  canvas?: string;
  run?: string;
}

interface MoreOpts {
  canvas?: string;
  push?: string;
  n?: string;
  words?: string;
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

async function confirmSpend(n: number, yes: boolean | undefined): Promise<void> {
  const cost = moodCostLine(n, imageModel(process.env));
  console.error(cost);
  if (yes) return;
  if (!process.stdin.isTTY || !process.stderr.isTTY) {
    throw new Error(`${cost} — nobody here can be asked, so nothing was drawn; pass --yes to accept the cost`);
  }
  if (!(await confirmed("Draw them? [y/N] "))) {
    throw new Error("Nothing drawn.");
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
        await confirmSpend(n, opts.yes);
        const answer = await ctx.client.image({ canvasId: canvas.id, actor: ctx.actor, prompt: words, n, ...(parent ? { parent } : {}) });
        if (ctx.json) return host.printJson(answer);
        console.log(`${answer.items.length} of ${n} drawn by ${answer.model}, run ${answer.run} — one undo takes them all back`);
        for (const tile of answer.items) console.log(`  ${tile.itemId}  ${tile.axis}`);
        for (const r of answer.refused) console.log(`  not drawn (${r.axis}): ${r.why}`);
      }),
    );

  mood
    .command("keep <items...>")
    .description("Keep candidate tile(s) into the Mood board — a person's taste, refused for agents")
    .option("--canvas <canvas>")
    .action(
      host.run(async (refs: string[], _opts: KeepOpts, cmd: Command) => {
        const ctx = await host.ctxOf(cmd);
        const canvas = await host.resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(canvas.id);
        const agentActor =
          isAgentHarness(ctx.harness) ||
          snapshot.canvas.agents?.[ctx.actor.id] !== undefined ||
          (await ctx.client.actorKinds().catch(() => ({} as Record<string, string>)))[ctx.actor.id] === "agent";
        if (agentActor) {
          throw new Error(
            "keeping is a person's taste — leave candidate tiles for the person to pick from (agents can draw spreads with `isocan mood explore --yes` or `isocan mood more --yes`)",
          );
        }
        const items = refs.map((ref) => host.resolveItem(snapshot, ref.replace(/^#/, "")));
        const groupMode = snapshot.project.groupMode ?? "legacy";
        let boardBlob: { blobHash: string; size: number; mimeType: string; filename: string } | undefined;
        if (!findMoodBoard(snapshot.canvas)) {
          const filename = groupMode === "groups" ? "group.md" : "area.md";
          const bytes = Buffer.from(MOOD_BOARD_BYTES, "utf8");
          const uploaded = await ctx.client.uploadBlob(canvas.id, bytes, "text/markdown", filename);
          boardBlob = { blobHash: uploaded.blobHash, size: uploaded.size, mimeType: "text/markdown", filename };
        }
        const plan = moodKeepPlan({
          canvas: snapshot.canvas,
          groupMode,
          itemIds: items.map((i) => i.id),
          ...(boardBlob ? { boardBlob } : {}),
        });
        const group = newGroupId();
        for (const op of plan.ops) await host.sendOp(ctx, canvas.id, op, group);
        const keptIds = items.map((i) => i.id);
        if (ctx.json) {
          return host.printJson({ boardId: plan.boardId, createdBoard: plan.createdBoard, keptIds });
        }
        console.log(
          `kept ${keptIds.length} tile${keptIds.length === 1 ? "" : "s"} in ${MOOD_BOARD_TITLE} (${plan.boardId}) — one undo takes them all back`,
        );
      }),
    );

  mood
    .command("drop [items...]")
    .description("Drop candidate tile(s) to the trash, or pass --run <run> to close a spread's remaining candidates")
    .option("--run <run>", "drop every remaining candidate tile from this spread run")
    .option("--canvas <canvas>")
    .action(
      host.run(async (refs: string[], opts: DropOpts, cmd: Command) => {
        if (refs.length === 0 && !opts.run) {
          throw new Error("name the tile(s) to drop, or pass --run <run> to drop a spread's remaining candidates");
        }
        const ctx = await host.ctxOf(cmd);
        const canvas = await host.resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(canvas.id);
        const namedIds = refs.map((ref) => host.resolveItem(snapshot, ref.replace(/^#/, "")).id);
        const { droppedIds, ops } = moodDropOps(snapshot.canvas, {
          itemIds: namedIds,
          ...(opts.run ? { run: opts.run } : {}),
        });
        if (ops.length > 0) {
          const group = newGroupId();
          for (const op of ops) await host.sendOp(ctx, canvas.id, op, group);
        }
        if (ctx.json) return host.printJson({ droppedIds });
        if (droppedIds.length === 0) {
          console.log("nothing to drop");
          return;
        }
        console.log(
          `dropped ${droppedIds.length} tile${droppedIds.length === 1 ? "" : "s"} to trash — one undo brings them back`,
        );
      }),
    );

  mood
    .command("more <item>")
    .description("Draw more like this picture, or push it along a dial — said in dollars first")
    .option("--push <dial>", `push direction (${MOOD_DIALS.join(", ")})`)
    .option("--n <count>", `how many pictures (default ${MOOD_MORE_N}, at most ${MOOD_MAX_N})`)
    .option("--words <words>", "override the subject words (default: the parent tile's prompt words or title)")
    .option("--yes", "accept the stated cost without being asked")
    .option("--canvas <canvas>")
    .action(
      host.run(async (ref: string, opts: MoreOpts, cmd: Command) => {
        const n = opts.n === undefined ? MOOD_MORE_N : Number(opts.n);
        if (!Number.isInteger(n) || n < 1 || n > MOOD_MAX_N) {
          throw new Error(`--n is 1 to ${MOOD_MAX_N} — the per-run cap is ${MOOD_MAX_N} pictures`);
        }
        if (opts.push !== undefined && !isMoodDial(opts.push)) {
          throw new Error(`--push must be one of ${MOOD_DIALS.join(", ")} — got ${opts.push}`);
        }
        const ctx = await host.ctxOf(cmd);
        const canvas = await host.resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(canvas.id);
        const item = host.resolveItem(snapshot, ref.replace(/^#/, ""));
        const current = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0];
        if (!current?.mimeType.startsWith("image/")) {
          throw new Error(`${item.title} is not an image — more varies a picture`);
        }
        const words = opts.words?.trim() || moodWordsFromPrompt(item.properties[MOOD_PROPS.prompt], item.title);
        await confirmSpend(n, opts.yes);
        const answer = await ctx.client.image({
          canvasId: canvas.id,
          actor: ctx.actor,
          prompt: words,
          n,
          parent: item.id,
          ...(opts.push ? { push: opts.push } : {}),
        });
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
