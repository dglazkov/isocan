import guideText from "../agent-guide.md";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Command } from "commander";
import type { CliHost, CliModule } from "@isocan/cli/modulehost";
import { motionRenderUrl, type CanvasSnapshotResponse, type Item, type ItemVersion } from "@isocan/core";
import {
  addMotionItem,
  addMotionMovie,
  authoredSpec,
  buildMotion,
  isMotionRecipe,
  MOTION_MAX_SECONDS,
  MOTION_PROPS,
  MOTION_RECIPES,
  motionDocumentSpec,
  motionLayerSources,
  motionStale,
  motionStaleLine,
  motionTargets,
  rebuildMotion,
  versionMotionItem,
  type MotionBuild,
  type MotionBuildInput,
  type MotionSource,
  type MotionSpec,
  type MotionWriter,
} from "@isocan/core/motion";
import { MOTION_FORMAT_FACTS, MOTION_FORMATS, MOTION_GIF, MOTION_RENDER_CAPS, motionRenderPlan, type MotionFormat, type MotionRenderedFrom } from "@isocan/core/motion-render";
import { motionModule } from "./core.ts";

/**
 * **`isocan motion`** — the selected SVGs as one motion item, and what an
 * agent does with one (motion phases 0–2; `docs/projects/motion/design.md`
 * §2–§6).
 *
 * Everything that decides anything is core's: `buildMotion` (the stage, the
 * stripping, a recipe or an agent's spec read by `motionSpecFrom`),
 * `motionLayerSources` and `rebuildMotion` for an edit or a refresh, and the
 * writes themselves (`addMotionItem`, `versionMotionItem`, `addMotionMovie`)
 * — the same functions the web's *Animate…*, *Refresh from sources* and
 * *Render movie…* call. What this half owns is fetching bytes, reading the
 * spec file, and saying what was stripped and what the principle checks
 * found.
 */

interface BuildOpts {
  canvas?: string;
  recipe?: string;
  spec?: string;
  say?: string;
  seconds?: string;
  loop?: boolean;
  title?: string;
}

const current = (item: Item): ItemVersion | undefined =>
  item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[item.versions.length - 1];

const isSvg = (version: ItemVersion | undefined) =>
  version !== undefined && (version.mimeType === "image/svg+xml" || /\.svg$/i.test(version.filename));

type Ctx = Awaited<ReturnType<CliHost["ctxOf"]>>;

/** This CLI's two hands, as core's writes want them: its client's upload, and `sendOp`. */
function writer(host: CliHost, ctx: Ctx, canvasId: string): MotionWriter {
  return {
    upload: (bytes, mimeType, filename) => ctx.client.uploadBlob(canvasId, Buffer.from(bytes), mimeType, filename),
    send: async (op, group) => { await host.sendOp(ctx, canvasId, op, group); },
  };
}

/** `--recipe`, `--spec`, `--seconds` and `--loop`, read into how it moves — or refused in words. */
async function howItMoves(opts: BuildOpts): Promise<Pick<MotionBuildInput, "recipe" | "spec" | "seconds" | "loop">> {
  if (opts.recipe !== undefined && opts.spec !== undefined) throw new Error("pass --recipe or --spec, not both — a recipe writes the spec for you");
  if (opts.spec !== undefined) {
    if (opts.seconds !== undefined || opts.loop !== undefined) throw new Error("a spec says its own seconds and loop — change them in the file");
    let text: string;
    try {
      text = await fs.readFile(opts.spec, "utf8");
    } catch {
      throw new Error(`cannot read the spec ${opts.spec}`);
    }
    try {
      return { spec: JSON.parse(text) as unknown };
    } catch (err) {
      throw new Error(`the spec ${opts.spec} is not JSON (${err instanceof Error ? err.message : String(err)})`);
    }
  }
  if (opts.say !== undefined && opts.recipe === undefined) {
    throw new Error("--say keeps the words a motion was made from; write the spec from them (--spec <file.json>) or pick a recipe — this CLI runs no model");
  }
  const recipe = opts.recipe ?? "assemble";
  if (!isMotionRecipe(recipe)) throw new Error(`--recipe is one of ${MOTION_RECIPES.join(", ")}, not "${recipe}"`);
  const out: Pick<MotionBuildInput, "recipe" | "seconds" | "loop"> = { recipe };
  if (opts.seconds !== undefined) {
    const seconds = Number(opts.seconds);
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > MOTION_MAX_SECONDS) throw new Error(`--seconds is more than 0 and at most ${MOTION_MAX_SECONDS}`);
    out.seconds = seconds;
  }
  if (opts.loop !== undefined) out.loop = opts.loop;
  return out;
}

/** What was stripped and what the checks found, on stderr; or the JSON answer. */
function report(host: CliHost, ctx: Ctx, built: MotionBuild, itemId: string, title: string, extra: Record<string, unknown> = {}): void {
  if (ctx.json) {
    return host.printJson({
      itemId,
      title,
      seconds: built.spec.seconds,
      loop: built.spec.loop,
      recipe: built.spec.recipe ?? null,
      layers: built.spec.layers.map((l) => ({ id: l.id, item: l.item, parts: Object.keys(l.parts) })),
      stripped: built.stripped,
      warnings: built.warnings,
      ...extra,
    });
  }
  for (const s of built.stripped) console.error(`stripped from ${s.title}: ${s.what.join(", ")}`);
  for (const w of built.warnings) console.error(`warning: ${w.message}`);
  const parts = built.spec.layers.flatMap((l) => Object.keys(l.parts).map((p) => `${l.id}/${p}`));
  const version = typeof extra.versionId === "string" ? ` — a new version (${extra.versionId})` : "";
  console.log(`${itemId}  ${title} — ${built.spec.seconds} s, ${built.spec.loop ? "loops" : "plays once"}${version}`);
  console.log(`  layers: ${built.spec.layers.map((l) => l.id).join(", ")}${parts.length > 0 ? `; parts: ${parts.join(", ")}` : ""}`);
}

/** A motion item named by ref, with its current version and the spec its document carries. */
async function motionOf(host: CliHost, ctx: Ctx, canvasId: string, snapshot: CanvasSnapshotResponse, ref: string): Promise<{ motion: Item; version: ItemVersion; spec: MotionSpec }> {
  const motion = host.resolveItem(snapshot, ref.replace(/^#/, ""));
  if (motion.properties[MOTION_PROPS.motion] !== "true") throw new Error(`${motion.title} is not a motion — make one with isocan motion new`);
  const version = current(motion);
  if (!version) throw new Error(`${motion.title} has no version`);
  const spec = motionDocumentSpec((await ctx.client.downloadBlob(canvasId, version.blobHash)).toString("utf8"));
  if (!spec) throw new Error(`${motion.title}'s current version carries no motion spec — was it replaced by hand?`);
  return { motion, version, spec };
}

/** The sources a rebuild reads, their bytes fetched: the versions taken, or each one's current. */
async function layerSources(ctx: Ctx, canvasId: string, snapshot: CanvasSnapshotResponse, spec: MotionSpec, which: "taken" | "current"): Promise<MotionSource[]> {
  const found = motionLayerSources(spec, snapshot.canvas, which);
  const out: MotionSource[] = [];
  for (const s of found) {
    const svg = (await ctx.client.downloadBlob(canvasId, s.version.blobHash)).toString("utf8");
    out.push({ item: s.item.id, version: s.version.id, title: s.title, box: s.box, svg });
  }
  return out;
}

/** `isocan motion new <svg…>`: the selection, a recipe or a spec, and one `item.add` beside it. */
async function create(host: CliHost, refs: string[], opts: BuildOpts, cmd: Command): Promise<void> {
  const how = await howItMoves(opts);
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
  const built = await buildMotion({ sources, ...how, ...(opts.title ? { title: opts.title } : {}) });
  const title = opts.title ?? `${items.map((i) => i.title).join(" + ")} — ${how.recipe ?? "motion"}`;
  const { itemId } = await addMotionItem(writer(host, ctx, canvas.id), built, title, opts.say);
  report(host, ctx, built, itemId, title);
}

/** `isocan motion edit <motion>`: the same sources at the versions it took, a new spec, one new version. */
async function edit(host: CliHost, ref: string, opts: BuildOpts, cmd: Command): Promise<void> {
  if (opts.spec === undefined && opts.recipe === undefined) throw new Error("say how it moves now: --spec <file.json> (isocan motion spec prints the current one) or --recipe");
  const how = await howItMoves(opts);
  const ctx = await host.ctxOf(cmd);
  const canvas = await host.resolveCanvas(ctx);
  const snapshot = await ctx.client.snapshot(canvas.id);
  const { motion, spec } = await motionOf(host, ctx, canvas.id, snapshot, ref);
  const sources = await layerSources(ctx, canvas.id, snapshot, spec, "taken");
  const built = await buildMotion({ sources, ...how, title: motion.title });
  const { versionId } = await versionMotionItem(writer(host, ctx, canvas.id), motion, built, opts.say);
  report(host, ctx, built, motion.id, motion.title, { versionId });
}

/** `isocan motion refresh <motion>`: each source's current version, the same motion, one new version. */
async function refresh(host: CliHost, ref: string, cmd: Command): Promise<void> {
  const ctx = await host.ctxOf(cmd);
  const canvas = await host.resolveCanvas(ctx);
  const snapshot = await ctx.client.snapshot(canvas.id);
  const { motion, spec } = await motionOf(host, ctx, canvas.id, snapshot, ref);
  const stale = motionStale(snapshot.canvas, motion);
  if (stale.length === 0) {
    if (ctx.json) return host.printJson({ itemId: motion.id, title: motion.title, refreshed: [] });
    console.log(`${motion.id}  ${motion.title} — every source is at the version it took; nothing to refresh`);
    return;
  }
  const sources = await layerSources(ctx, canvas.id, snapshot, spec, "current");
  const built = await rebuildMotion(spec, sources, motion.title);
  const { versionId } = await versionMotionItem(writer(host, ctx, canvas.id), motion, built);
  if (!ctx.json) console.error(`refreshed from ${stale.map((s) => s.title).join(", ")}`);
  report(host, ctx, built, motion.id, motion.title, { versionId, refreshed: stale.map((s) => s.item) });
}

/** `isocan motion spec <motion>`: the spec an agent edits, the targets it may name, and whether a source moved on. */
async function showSpec(host: CliHost, ref: string, cmd: Command): Promise<void> {
  const ctx = await host.ctxOf(cmd);
  const canvas = await host.resolveCanvas(ctx);
  const snapshot = await ctx.client.snapshot(canvas.id);
  const { motion, spec } = await motionOf(host, ctx, canvas.id, snapshot, ref);
  const authored = authoredSpec(spec);
  const targets = motionTargets(spec.layers);
  const stale = motionStale(snapshot.canvas, motion);
  if (ctx.json) return host.printJson({ itemId: motion.id, title: motion.title, recipe: spec.recipe ?? null, targets, stale, spec: authored });
  console.log(JSON.stringify(authored, null, 2));
  console.error(`targets: ${targets.join(", ")}`);
  if (spec.recipe) console.error(`written by the ${spec.recipe} recipe`);
  const line = motionStaleLine(stale);
  if (line) console.error(`${line} — isocan motion refresh ${motion.id}`);
}

interface RenderOpts {
  canvas?: string;
  mp4?: boolean;
  webm?: boolean;
  gif?: boolean;
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

/** `--mp4`, `--webm` or `--gif` — one of them, an MP4 when none. */
function formatOf(opts: RenderOpts): MotionFormat {
  const asked = MOTION_FORMATS.filter((f) => opts[f] === true);
  if (asked.length > 1) throw new Error(`one format at a time: ${asked.map((f) => `--${f}`).join(" or ")}, not both`);
  return asked[0] ?? "mp4";
}

/**
 * **`isocan motion render <motion>`** (motion phases 1 and 3; design §4, §6):
 * the motion recorded to an MP4 (`--mp4`, the default), a WebM (`--webm`) or
 * a GIF (`--gif`) by the web app's render page, in the headless browser
 * `canvas shot` drives, and added beside it as a `video/mp4`, `video/webm`
 * or `image/gif` item wearing `renderedFrom` — by `addMotionMovie`, the write
 * *Render movie…* makes too. The caps are asked here first, off the motion's own
 * properties, so a movie past them is refused before a browser starts; the
 * page asks again over the document it fetched, and what IT reports is what
 * `renderedFrom` says.
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
  const format = formatOf(opts);
  const plan = motionRenderPlan(
    { format, fps: opts.fps, size: opts.size, seconds: opts.seconds, background: opts.background },
    { seconds: Number.isFinite(length) && length > 0 ? length : MOTION_RENDER_CAPS.seconds, loop: motion.properties[MOTION_PROPS.loop] === "true" },
  );
  const origin = (await ctx.homeOf(canvas.id)) ?? ctx.client.base;
  const url = motionRenderUrl(origin, canvas.id, motion.id, {
    format: plan.format,
    version: version.id,
    fps: plan.fps,
    size: `${plan.width}x${plan.height}`,
    background: plan.background,
    ...(opts.seconds !== undefined ? { seconds: plan.seconds } : {}),
  });
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-motion-render-"));
  try {
    const file = path.join(scratch, `movie.${MOTION_FORMAT_FACTS[plan.format].extension}`);
    const reportFile = path.join(scratch, "report.json");
    // The owner's identity rides on stdin for a personal canvas, exactly as
    // `canvas shot` hands it; the script uses it only when the home says the
    // canvas is personal, and only with this machine's own owner credential.
    host.runPackageScript(
      "scripts/motion-render.mjs",
      ["--url", url, "--canvas", canvas.id, "--out", file, "--report", reportFile, "--owner-from-stdin"],
      { what: "the movie", input: JSON.stringify({ actor: ctx.actor }), quiet: ctx.json },
    );
    const said = JSON.parse(await fs.readFile(reportFile, "utf8")) as RenderReport;
    const bytes = await fs.readFile(file);
    const { itemId, title } = await addMotionMovie(writer(host, ctx, canvas.id), motion, bytes, said.renderedFrom);
    if (opts.out) await fs.writeFile(opts.out, bytes);
    if (ctx.json) {
      return host.printJson({ itemId, title, frames: said.frames, codec: said.codec, bytes: bytes.length, renderedFrom: said.renderedFrom, ...(opts.out ? { out: opts.out } : {}) });
    }
    const r = said.renderedFrom;
    console.log(`${itemId}  ${title} — ${said.frames} frames, ${r.size} at ${r.fps} fps, ${r.seconds} s, ${(bytes.length / 1e6).toFixed(1)} MB (${said.codec})`);
    if (opts.out) console.log(`  wrote ${opts.out}`);
  } finally {
    await fs.rm(scratch, { recursive: true, force: true });
  }
}

function register(host: CliHost): void {
  const motion = host.program.command("motion").description("Motion: make selected SVGs move, as an HTML item that plays on the canvas");
  const shaping = (c: Command) => c
    .option("--canvas <canvas>")
    .option("--recipe <recipe>", `how it moves: ${MOTION_RECIPES.join(", ")}`)
    .option("--spec <file.json>", "how it moves, as a spec you wrote: seconds, loop and moves (isocan --agent-help motion)")
    .option("--say <words>", "the words this motion was made from, kept as its description")
    .option("--seconds <seconds>", `with --recipe: fit it to this length (at most ${MOTION_MAX_SECONDS})`)
    .option("--loop", "with --recipe: repeat forever (idle loops by default; assemble plays once and holds)")
    .option("--no-loop", "with --recipe: play once and hold the last frame");
  shaping(motion
    .command("new <svgs...>")
    .description(`Animate SVG items as one motion item beside them — a recipe (${MOTION_RECIPES.join(", ")}, assemble by default) or your --spec writes how they move`))
    .option("--title <title>")
    .action(host.run(async (refs: string[], opts: BuildOpts, cmd: Command) => create(host, refs, opts, cmd)));
  shaping(motion
    .command("edit <motion>")
    .description("A new version of a motion from the same sources: your --spec, or a --recipe"))
    .action(host.run(async (ref: string, opts: BuildOpts, cmd: Command) => edit(host, ref, opts, cmd)));
  motion
    .command("refresh <motion>")
    .description("A new version of a motion from its sources' newer versions, moving the same way")
    .option("--canvas <canvas>")
    .action(host.run(async (ref: string, _opts: unknown, cmd: Command) => refresh(host, ref, cmd)));
  motion
    .command("spec <motion>")
    .description("Print a motion's spec as you would write it, and the targets it may name")
    .option("--canvas <canvas>")
    .action(host.run(async (ref: string, _opts: unknown, cmd: Command) => showSpec(host, ref, cmd)));
  motion
    .command("render <motion>")
    .description(`Record a motion to an MP4, WebM or GIF item beside it (at most ${MOTION_RENDER_CAPS.short}p, ${MOTION_RENDER_CAPS.fps} fps, ${MOTION_RENDER_CAPS.seconds} s) — through the headless browser canvas shot uses`)
    .option("--canvas <canvas>")
    .option("--mp4", "an H.264 MP4 (the default)")
    .option("--webm", "a VP9 WebM")
    .option("--gif", `an animated GIF (${MOTION_GIF.fps} fps unless --fps, at most ${MOTION_GIF.maxFps}; refused past about ${MOTION_GIF.bytes / 1e6} MB)`)
    .option("--fps <fps>", `frames a second (default 60, ${MOTION_GIF.fps} for a GIF; at most ${MOTION_RENDER_CAPS.fps})`)
    .option("--seconds <seconds>", "how long (default: the motion's length — one loop, for a loop)")
    .option("--size <size>", "1080 for a square, or WIDTHxHEIGHT (default 1080)")
    .option("--background <color>", "what is behind the stage, #rrggbb (default #ffffff)")
    .option("--out <file>", "also write the movie here")
    .action(host.run(async (ref: string, opts: RenderOpts, cmd: Command) => render(host, ref, opts, cmd)));
}

export const motionCli: CliModule = {
  core: motionModule,
  register,
  guide: guideText,
};

/** The runtime loader reads `mod.default`; a named export alone builds and loads nothing. */
export default motionCli;
