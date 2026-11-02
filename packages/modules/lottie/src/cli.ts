import guideText from "../agent-guide.md";
import type { Command } from "commander";
import {
  designSystem,
  newGroupId,
  newVersionId,
  type Item,
  type ItemVersion,
} from "@isocan/core";
import type { CliHost, CliModule, Ctx } from "@isocan/cli/modulehost";
import {
  LOTTIE_JSON_MIME,
  LOTTIE_POSTER_FRAME_PROP,
  extractLottiePalette,
  inspectLottie,
  isLottieItem,
  lintLottie,
  lottieModule,
  parseLottieJson,
  profileLottieFrames,
  remapLottiePalette,
  removeLottieMarker,
  renderLottieFrameSvg,
  setLottieMarker,
  syncLottieToDesignSystem,
  trimLottie,
  type LottieDocument,
  type LottieTarget,
} from "./core.ts";

function currentVersionOf(item: Item): ItemVersion {
  return (
    item.versions.find((v) => v.id === item.currentVersionId) ??
    item.versions[item.versions.length - 1]!
  );
}

async function readLottieDoc(
  ctx: Ctx,
  canvasId: string,
  item: Item,
): Promise<{ doc: LottieDocument; version: ItemVersion }> {
  const version = currentVersionOf(item);
  if (!isLottieItem(item, version)) {
    throw new Error(
      `"${item.title}" is not a Lottie animation (${version.mimeType || version.filename})`,
    );
  }
  const raw = (await ctx.client.downloadBlob(canvasId, version.blobHash)).toString(
    "utf8",
  );
  const parsed = parseLottieJson(raw);
  if ("error" in parsed) {
    throw new Error(`"${item.title}": ${parsed.error}`);
  }
  return { doc: parsed, version };
}

async function stackLottieVersion(
  host: CliHost,
  ctx: Ctx,
  canvasId: string,
  item: Item,
  prevVersion: ItemVersion,
  doc: LottieDocument,
): Promise<{ versionId: string; blobHash: string; size: number }> {
  const serialized = `${JSON.stringify(doc, null, 2)}\n`;
  const filename = prevVersion.filename || "animation.lottie.json";
  const upload = await ctx.client.uploadBlob(
    canvasId,
    Buffer.from(serialized, "utf8"),
    LOTTIE_JSON_MIME,
    filename,
  );
  const versionId = newVersionId();
  await host.sendOp(
    ctx,
    canvasId,
    {
      type: "item.addVersion",
      itemId: item.id,
      version: {
        id: versionId,
        blobHash: upload.blobHash,
        mimeType: LOTTIE_JSON_MIME,
        filename,
        size: upload.size,
      },
    },
    newGroupId(),
  );
  return { versionId, blobHash: upload.blobHash, size: upload.size };
}

function register(host: CliHost): void {
  const { run, ctxOf, resolveCanvas, resolveItem, sendOp, printJson } = host;

  const lottie = host.program
    .command("lottie")
    .description(
      "Lottie animations: inspect layers/markers, remap palettes, trim frames, lint runtimes, and render SVG posters",
    );

  lottie
    .command("inspect <item>")
    .description(
      "Print dimensions, fps, duration, layer hierarchy, markers, and palette for a Lottie item",
    )
    .option("--canvas <canvas>")
    .action(
      run(async (ref: string, _opts: unknown, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        const p = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(p.id);
        const item = resolveItem(snapshot, ref);
        const { doc } = await readLottieDoc(ctx, p.id, item);
        const info = inspectLottie(doc);
        if (ctx.json) {
          return printJson({ itemId: item.id, title: item.title, ...info });
        }
        console.log(
          `${item.title} (${item.id}) — ${info.width}×${info.height} · ${info.fps} fps · ${info.durationSeconds}s (frames ${info.inPoint}–${info.outPoint})`,
        );
        console.log(
          `Layers (${info.layers.length}): ${info.layers
            .map((l) => `#${l.ind} ${l.name} [${l.kind}${l.hidden ? ", hidden" : ""}]`)
            .join(", ")}`,
        );
        if (info.markers.length > 0) {
          console.log(
            `Markers (${info.markers.length}): ${info.markers
              .map((m) => `${m.cm} (${m.tm}..${m.tm + m.dr})`)
              .join(", ")}`,
          );
        }
        if (info.palette.length > 0) {
          console.log(
            `Palette (${info.palette.length}): ${info.palette
              .map((c) => `${c.hex} (${c.occurrences}×)`)
              .join(", ")}`,
          );
        }
      }),
    );

  lottie
    .command("palette <item>")
    .description(
      "List extracted hex colors, or remap colors (--remap old=new, --sync-design) and stack a new version",
    )
    .option("--canvas <canvas>")
    .option(
      "--remap <pair...>",
      "remap hex color pairs (for example: --remap #3b82f6=#10b981)",
    )
    .option(
      "--sync-design",
      "remap colors to match the governing DESIGN.md palette on this canvas",
    )
    .action(
      run(
        async (
          ref: string,
          opts: { remap?: string[]; syncDesign?: boolean },
          cmd: Command,
        ) => {
          const ctx = await ctxOf(cmd);
          const p = await resolveCanvas(ctx);
          const snapshot = await ctx.client.snapshot(p.id);
          const item = resolveItem(snapshot, ref);
          const { doc, version } = await readLottieDoc(ctx, p.id, item);

          if (!opts.remap?.length && !opts.syncDesign) {
            const palette = extractLottiePalette(doc);
            if (ctx.json) return printJson({ itemId: item.id, palette });
            if (palette.length === 0) {
              console.log(`"${item.title}" has no static or keyframed RGB colors`);
              return;
            }
            for (const entry of palette) {
              console.log(
                `${entry.hex}  ${String(entry.occurrences).padStart(3)}×  ${entry.layers.join(", ")}`,
              );
            }
            return;
          }

          let nextDoc = doc;
          let remappedCount = 0;
          let appliedMap: Record<string, string> = {};

          if (opts.syncDesign) {
            const ds = designSystem(snapshot.canvas, { at: item });
            if (!ds) {
              throw new Error(
                "No governing DESIGN.md found on this canvas — add one or pass --remap old=new",
              );
            }
            const dsVer = currentVersionOf(ds);
            const dsText = (
              await ctx.client.downloadBlob(p.id, dsVer.blobHash)
            ).toString("utf8");
            const synced = syncLottieToDesignSystem(nextDoc, dsText);
            nextDoc = synced.doc;
            remappedCount += synced.remappedCount;
            appliedMap = { ...appliedMap, ...synced.mappings };
          }

          if (opts.remap?.length) {
            const explicit: Record<string, string> = {};
            for (const pair of opts.remap) {
              const eq = pair.indexOf("=");
              if (eq <= 0) {
                throw new Error(
                  `Expected --remap <oldHex>=<newHex>, got "${pair}"`,
                );
              }
              explicit[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
            }
            const res = remapLottiePalette(nextDoc, explicit);
            nextDoc = res.doc;
            remappedCount += res.remappedCount;
            appliedMap = { ...appliedMap, ...explicit };
          }

          const stacked = await stackLottieVersion(
            host,
            ctx,
            p.id,
            item,
            version,
            nextDoc,
          );
          if (ctx.json) {
            return printJson({
              itemId: item.id,
              versionId: stacked.versionId,
              remappedCount,
              mappings: appliedMap,
            });
          }
          console.log(
            `remapped ${remappedCount} color occurrence(s) on "${item.title}" → version ${stacked.versionId}`,
          );
        },
      ),
    );

  lottie
    .command("trim <item>")
    .description(
      "Update in-point (--in), out-point (--out), or frame rate (--fps) and stack a new version",
    )
    .option("--canvas <canvas>")
    .option("--in <frame>", "new in-point frame (ip)")
    .option("--out <frame>", "new out-point frame (op)")
    .option("--fps <n>", "new frame rate (fr)")
    .action(
      run(
        async (
          ref: string,
          opts: { in?: string; out?: string; fps?: string },
          cmd: Command,
        ) => {
          const ctx = await ctxOf(cmd);
          const p = await resolveCanvas(ctx);
          const snapshot = await ctx.client.snapshot(p.id);
          const item = resolveItem(snapshot, ref);
          const { doc, version } = await readLottieDoc(ctx, p.id, item);

          const patch: { ip?: number; op?: number; fr?: number } = {};
          if (opts.in !== undefined) patch.ip = Number(opts.in);
          if (opts.out !== undefined) patch.op = Number(opts.out);
          if (opts.fps !== undefined) patch.fr = Number(opts.fps);
          if (
            patch.ip === undefined &&
            patch.op === undefined &&
            patch.fr === undefined
          ) {
            throw new Error(
              "Pass at least one of --in <frame>, --out <frame>, or --fps <n>",
            );
          }

          const nextDoc = trimLottie(doc, patch);
          const stacked = await stackLottieVersion(
            host,
            ctx,
            p.id,
            item,
            version,
            nextDoc,
          );
          if (ctx.json) {
            return printJson({
              itemId: item.id,
              versionId: stacked.versionId,
              ip: nextDoc.ip,
              op: nextDoc.op,
              fr: nextDoc.fr,
            });
          }
          console.log(
            `trimmed "${item.title}" to frames ${nextDoc.ip}–${nextDoc.op} @ ${nextDoc.fr} fps → version ${stacked.versionId}`,
          );
        },
      ),
    );

  lottie
    .command("marker <item>")
    .description(
      "List named markers, or add (--add name:frame:duration) / remove (--rm name) a marker segment",
    )
    .option("--canvas <canvas>")
    .option("--add <spec>", "add or update a marker: <name>:<startFrame>:<duration>")
    .option("--rm <name>", "remove a marker by name")
    .action(
      run(
        async (
          ref: string,
          opts: { add?: string; rm?: string },
          cmd: Command,
        ) => {
          const ctx = await ctxOf(cmd);
          const p = await resolveCanvas(ctx);
          const snapshot = await ctx.client.snapshot(p.id);
          const item = resolveItem(snapshot, ref);
          const { doc, version } = await readLottieDoc(ctx, p.id, item);

          if (!opts.add && !opts.rm) {
            const markers = doc.markers ?? [];
            if (ctx.json) return printJson({ itemId: item.id, markers });
            if (markers.length === 0) {
              console.log(`"${item.title}" has no named markers`);
              return;
            }
            for (const m of markers) {
              console.log(`${m.cm}  frame ${m.tm}  duration ${m.dr}`);
            }
            return;
          }

          let nextDoc = doc;
          if (opts.rm) {
            nextDoc = removeLottieMarker(nextDoc, opts.rm);
          }
          if (opts.add) {
            const parts = opts.add.split(":");
            if (parts.length < 2) {
              throw new Error(
                `Expected --add <name>:<frame>[:<duration>], got "${opts.add}"`,
              );
            }
            const name = parts[0]!.trim();
            const tm = Number(parts[1]);
            const dr = parts[2] !== undefined ? Number(parts[2]) : 0;
            nextDoc = setLottieMarker(nextDoc, name, tm, dr);
          }

          const stacked = await stackLottieVersion(
            host,
            ctx,
            p.id,
            item,
            version,
            nextDoc,
          );
          if (ctx.json) {
            return printJson({
              itemId: item.id,
              versionId: stacked.versionId,
              markers: nextDoc.markers ?? [],
            });
          }
          console.log(
            `updated markers on "${item.title}" (${(nextDoc.markers ?? []).length} total) → version ${stacked.versionId}`,
          );
        },
      ),
    );

  lottie
    .command("lint <item>")
    .description(
      "Audit a Lottie animation for cross-platform runtime issues (web-svg, thorvg, ios, android) and frame complexity",
    )
    .option("--canvas <canvas>")
    .option(
      "--target <runtime>",
      "filter issues for web-svg | thorvg | ios | android",
    )
    .action(
      run(async (ref: string, opts: { target?: string }, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        const p = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(p.id);
        const item = resolveItem(snapshot, ref);
        const { doc } = await readLottieDoc(ctx, p.id, item);

        const target = opts.target as LottieTarget | undefined;
        const issues = lintLottie(doc, target);
        const profile = profileLottieFrames(doc, 36);

        if (ctx.json) {
          return printJson({
            itemId: item.id,
            target: target ?? "all",
            issues,
            peakFrame: profile.peakFrame,
            peakScore: profile.peakScore,
          });
        }
        console.log(
          `${item.title}: ${issues.length} compatibility issue(s) (peak frame f${profile.peakFrame}, score ${profile.peakScore})`,
        );
        for (const iss of issues) {
          console.log(
            `  [${iss.severity}] ${iss.code}: ${iss.message} (${iss.targets.join(", ")})`,
          );
        }
      }),
    );

  lottie
    .command("poster <item>")
    .description(
      "Render a single frame as self-contained SVG to stdout, or save lottiePosterFrame (--set-poster)",
    )
    .option("--canvas <canvas>")
    .option("--frame <n>", "frame number to render (default: poster frame or ip)")
    .option(
      "--set-poster <n>",
      "record lottiePosterFrame on the item for static thumbnails",
    )
    .action(
      run(
        async (
          ref: string,
          opts: { frame?: string; setPoster?: string },
          cmd: Command,
        ) => {
          const ctx = await ctxOf(cmd);
          const p = await resolveCanvas(ctx);
          const snapshot = await ctx.client.snapshot(p.id);
          const item = resolveItem(snapshot, ref);
          const { doc } = await readLottieDoc(ctx, p.id, item);

          if (opts.setPoster !== undefined) {
            const poster = String(Math.round(Number(opts.setPoster)));
            await sendOp(ctx, p.id, {
              type: "item.update",
              itemId: item.id,
              patch: {
                properties: {
                  ...item.properties,
                  [LOTTIE_POSTER_FRAME_PROP]: poster,
                },
              },
            });
            if (ctx.json) {
              return printJson({ itemId: item.id, posterFrame: Number(poster) });
            }
            console.log(`set poster frame on "${item.title}" to f${poster}`);
            return;
          }

          const propFrame = item.properties?.[LOTTIE_POSTER_FRAME_PROP];
          const frame =
            opts.frame !== undefined
              ? Number(opts.frame)
              : propFrame !== undefined
                ? Number(propFrame)
                : doc.ip;
          const svg = renderLottieFrameSvg(doc, frame);
          if (ctx.json) {
            return printJson({ itemId: item.id, frame, svg });
          }
          console.log(svg);
        },
      ),
    );
}

export const lottieCli: CliModule = {
  core: lottieModule,
  register,
  guide: guideText,
};

export default lottieCli;
