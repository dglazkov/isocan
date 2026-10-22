import guideText from "../agent-guide.md";
import type { Command } from "commander";
import type { CliHost, CliModule } from "@isocan/cli/modulehost";
import { newGroupId, newItemId, newVersionId, type Item, type ItemVersion } from "@isocan/core";
import {
  buildMotion,
  isMotionRecipe,
  MOTION_MAX_SECONDS,
  MOTION_MIME,
  MOTION_RECIPES,
  motionProperties,
  motionSlug,
  type MotionSource,
} from "@isocan/core/motion";
import { motionModule } from "./core.ts";

/**
 * **`isocan motion new <svg…>`** — the selected SVGs as one motion item
 * (motion phase 0; `docs/projects/motion/design.md` §2, §3, §6).
 *
 * Everything that decides anything is core's `buildMotion`: the stage is the
 * selection's bounding box, each source keeps its canvas offset and its
 * place in the canvas's stacking, scripts and remote references are
 * stripped, and the recipe writes the spec. What this half owns is fetching
 * the sources' bytes, saying what was stripped and what the principle
 * checks found, and adding the document as an HTML item beside the
 * selection — an ordinary `item.add`, one undo.
 */

interface NewOpts {
  canvas?: string;
  recipe?: string;
  seconds?: string;
  loop?: boolean;
  title?: string;
}

const current = (item: Item): ItemVersion | undefined =>
  item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[item.versions.length - 1];

const isSvg = (version: ItemVersion | undefined) =>
  version !== undefined && (version.mimeType === "image/svg+xml" || /\.svg$/i.test(version.filename));

/** The gap between the selection and the motion placed beside it, in world units. */
const BESIDE = 40;

function register(host: CliHost): void {
  const motion = host.program.command("motion").description("Motion: make selected SVGs move, as an HTML item that plays on the canvas");
  motion
    .command("new <svgs...>")
    .description(`Animate SVG items as one motion item beside them — a recipe (${MOTION_RECIPES.join(", ")}) writes how they move`)
    .option("--canvas <canvas>")
    .option("--recipe <recipe>", `how it moves: ${MOTION_RECIPES.join(" or ")}`, "assemble")
    .option("--seconds <seconds>", `fit the motion to this length (at most ${MOTION_MAX_SECONDS})`)
    .option("--loop", "repeat forever (idle loops by default; assemble plays once and holds)")
    .option("--no-loop", "play once and hold the last frame")
    .option("--title <title>")
    .action(
      host.run(async (refs: string[], opts: NewOpts, cmd: Command) => {
        const recipe = opts.recipe ?? "assemble";
        if (!isMotionRecipe(recipe)) throw new Error(`--recipe is ${MOTION_RECIPES.join(" or ")}, not "${recipe}"`);
        let seconds: number | undefined;
        if (opts.seconds !== undefined) {
          seconds = Number(opts.seconds);
          if (!Number.isFinite(seconds) || seconds <= 0 || seconds > MOTION_MAX_SECONDS) {
            throw new Error(`--seconds is more than 0 and at most ${MOTION_MAX_SECONDS}`);
          }
        }
        const ctx = await host.ctxOf(cmd);
        const canvas = await host.resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(canvas.id);
        const order = Object.keys(snapshot.canvas.items);
        const items = [...new Map(refs.map((ref) => {
          const item = host.resolveItem(snapshot, ref.replace(/^#/, ""));
          return [item.id, item] as const;
        })).values()];
        for (const item of items) {
          if (!isSvg(current(item))) throw new Error(`${item.title} is not an SVG — motion moves SVG items (image/svg+xml)`);
        }
        // Back to front, as the canvas stacks them: the order items were added.
        items.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
        const sources: MotionSource[] = [];
        for (const item of items) {
          const version = current(item)!;
          const svg = (await ctx.client.downloadBlob(canvas.id, version.blobHash)).toString("utf8");
          sources.push({ item: item.id, version: version.id, title: item.title, box: { x: item.x, y: item.y, width: item.width, height: item.height }, svg });
        }
        const built = await buildMotion({
          sources,
          recipe,
          ...(seconds !== undefined ? { seconds } : {}),
          ...(opts.loop !== undefined ? { loop: opts.loop } : {}),
          ...(opts.title ? { title: opts.title } : {}),
        });
        const title = opts.title ?? `${items.map((i) => i.title).join(" + ")} — ${recipe}`;
        const filename = `${motionSlug(title) || "motion"}.html`;
        const bytes = Buffer.from(built.html, "utf8");
        const uploaded = await ctx.client.uploadBlob(canvas.id, bytes, MOTION_MIME, filename);
        const itemId = newItemId();
        await host.sendOp(ctx, canvas.id, {
          type: "item.add",
          itemId,
          version: { id: newVersionId(), blobHash: uploaded.blobHash, mimeType: MOTION_MIME, filename, size: uploaded.size },
          width: Math.max(80, Math.round(built.stage.width)),
          height: Math.max(80, Math.round(built.stage.height)),
          placement: { x: built.stage.x + built.stage.width + BESIDE, y: built.stage.y },
          title,
          properties: motionProperties(built),
        }, newGroupId());

        if (ctx.json) {
          return host.printJson({
            itemId,
            title,
            seconds: built.spec.seconds,
            loop: built.spec.loop,
            recipe,
            layers: built.spec.layers.map((l) => ({ id: l.id, item: l.item, parts: Object.keys(l.parts) })),
            stripped: built.stripped,
            warnings: built.warnings,
          });
        }
        for (const s of built.stripped) console.error(`stripped from ${s.title}: ${s.what.join(", ")}`);
        for (const w of built.warnings) console.error(`warning: ${w.message}`);
        const parts = built.spec.layers.flatMap((l) => Object.keys(l.parts).map((p) => `${l.id}/${p}`));
        console.log(`${itemId}  ${title} — ${built.spec.seconds} s, ${built.spec.loop ? "loops" : "plays once"}`);
        console.log(`  layers: ${built.spec.layers.map((l) => l.id).join(", ")}${parts.length > 0 ? `; parts: ${parts.join(", ")}` : ""}`);
      }),
    );
}

export const motionCli: CliModule = {
  core: motionModule,
  register,
  guide: guideText,
};

/** The runtime loader reads `mod.default`; a named export alone builds and loads nothing. */
export default motionCli;
