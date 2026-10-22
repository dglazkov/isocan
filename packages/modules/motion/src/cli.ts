import guideText from "../agent-guide.md";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Command } from "commander";
import type { CliHost, CliModule } from "@isocan/cli/modulehost";
import { motionRenderUrl, newGroupId, newItemId, newVersionId, type Item, type ItemVersion } from "@isocan/core";
import {
  buildMotion,
  isMotionRecipe,
  MOTION_MAX_SECONDS,
  MOTION_MIME,
  MOTION_PROPS,
  MOTION_RECIPES,
  motionProperties,
  motionSlug,
  type MotionSource,
} from "@isocan/core/motion";
import { MOTION_RENDER_CAPS, motionRenderPlan, RENDERED_FROM, type MotionRenderedFrom } from "@isocan/core/motion-render";
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

interface RenderOpts {
  canvas?: string;
  fps?: string;
  seconds?: string;
  size?: string;
  background?: string;
  out?: string;
}

/** What `scripts/motion-render.mjs` says the page rendered (`--report`). */
interface RenderReport {
  frames: number;
  codec: string;
  bytes: number;
  renderedFrom: MotionRenderedFrom;
}

/**
 * **`isocan motion render <motion>`** (motion phase 1; design §4, §6): the
 * motion recorded to an MP4 by the web app's render page, in the headless
 * browser `canvas shot` drives, and added as a `video/mp4` item beside it
 * wearing `renderedFrom`. The caps are asked here first, off the motion's
 * own properties, so a movie past them is refused before a browser starts;
 * the page asks again over the document it fetched, and what IT reports is
 * what `renderedFrom` says.
 */
async function render(host: CliHost, ref: string, opts: RenderOpts, cmd: Command): Promise<void> {
  if (!host.runPackageScript) throw new Error("this isocan cannot run its render script for a module — upgrade it (module API 0.2.11)");
  const ctx = await host.ctxOf(cmd);
  const canvas = await host.resolveCanvas(ctx);
  const snapshot = await ctx.client.snapshot(canvas.id);
  const motion = host.resolveItem(snapshot, ref.replace(/^#/, ""));
  if (motion.properties[MOTION_PROPS.motion] !== "true") throw new Error(`${motion.title} is not a motion — render makes movies of motion items (isocan motion new)`);
  const version = current(motion);
  if (!version) throw new Error(`${motion.title} has no version to render`);
  const length = Number(motion.properties[MOTION_PROPS.seconds]);
  const plan = motionRenderPlan(
    { fps: opts.fps, size: opts.size, seconds: opts.seconds, background: opts.background },
    { seconds: Number.isFinite(length) && length > 0 ? length : MOTION_RENDER_CAPS.seconds, loop: motion.properties[MOTION_PROPS.loop] === "true" },
  );
  const origin = (await ctx.homeOf(canvas.id)) ?? ctx.client.base;
  const url = motionRenderUrl(origin, canvas.id, motion.id, {
    version: version.id,
    fps: plan.fps,
    size: `${plan.width}x${plan.height}`,
    background: plan.background,
    ...(opts.seconds !== undefined ? { seconds: plan.seconds } : {}),
  });
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-motion-render-"));
  try {
    const file = path.join(scratch, "movie.mp4");
    const reportFile = path.join(scratch, "report.json");
    // The owner's identity rides on stdin for a personal canvas, exactly as
    // `canvas shot` hands it; the script uses it only when the home says the
    // canvas is personal, and only with this machine's own owner credential.
    host.runPackageScript(
      "scripts/motion-render.mjs",
      ["--url", url, "--canvas", canvas.id, "--out", file, "--report", reportFile, "--owner-from-stdin"],
      { what: "the movie", input: JSON.stringify({ actor: ctx.actor }), quiet: ctx.json },
    );
    const report = JSON.parse(await fs.readFile(reportFile, "utf8")) as RenderReport;
    const bytes = await fs.readFile(file);
    const filename = `${motionSlug(motion.title) || "motion"}.mp4`;
    const uploaded = await ctx.client.uploadBlob(canvas.id, bytes, "video/mp4", filename);
    const [w, h] = report.renderedFrom.size.split("x").map(Number) as [number, number];
    const width = Math.max(160, Math.round(motion.width));
    const itemId = newItemId();
    const title = `${motion.title} — movie`;
    await host.sendOp(ctx, canvas.id, {
      type: "item.add",
      itemId,
      version: { id: newVersionId(), blobHash: uploaded.blobHash, mimeType: "video/mp4", filename, size: uploaded.size },
      width,
      height: Math.round((width * h) / w),
      placement: { x: motion.x + motion.width + BESIDE, y: motion.y },
      title,
      properties: { [RENDERED_FROM]: JSON.stringify(report.renderedFrom) },
    }, newGroupId());
    if (opts.out) await fs.writeFile(opts.out, bytes);
    if (ctx.json) {
      return host.printJson({ itemId, title, frames: report.frames, codec: report.codec, bytes: bytes.length, renderedFrom: report.renderedFrom, ...(opts.out ? { out: opts.out } : {}) });
    }
    const r = report.renderedFrom;
    console.log(`${itemId}  ${title} — ${report.frames} frames, ${r.size} at ${r.fps} fps, ${r.seconds} s, ${(bytes.length / 1e6).toFixed(1)} MB (${report.codec})`);
    if (opts.out) console.log(`  wrote ${opts.out}`);
  } finally {
    await fs.rm(scratch, { recursive: true, force: true });
  }
}

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
  motion
    .command("render <motion>")
    .description(`Record a motion to an MP4 video item beside it (at most ${MOTION_RENDER_CAPS.short}p, ${MOTION_RENDER_CAPS.fps} fps, ${MOTION_RENDER_CAPS.seconds} s) — through the headless browser canvas shot uses`)
    .option("--canvas <canvas>")
    .option("--fps <fps>", `frames a second (default 60, at most ${MOTION_RENDER_CAPS.fps})`)
    .option("--seconds <seconds>", "how long (default: the motion's length — one loop, for a loop)")
    .option("--size <size>", "1080 for a square, or WIDTHxHEIGHT (default 1080)")
    .option("--background <color>", "what is behind the stage, #rrggbb (default #ffffff)")
    .option("--out <file.mp4>", "also write the movie here")
    .action(host.run(async (ref: string, opts: RenderOpts, cmd: Command) => render(host, ref, opts, cmd)));
}

export const motionCli: CliModule = {
  core: motionModule,
  register,
  guide: guideText,
};

/** The runtime loader reads `mod.default`; a named export alone builds and loads nothing. */
export default motionCli;
