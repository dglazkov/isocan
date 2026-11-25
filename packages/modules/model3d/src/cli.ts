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

import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { Command } from "commander";
import {
  mimeFromName,
  newGroupId,
  newItemId,
  newVersionId,
  type CanvasContents,
  type Item,
} from "@isocan/core";
import type { CliHost, CliModule } from "@isocan/cli/modulehost";
import guideText from "../agent-guide.md";
import {
  MODEL3D_PROPS,
  formatCameraPose,
  model3dModule,
  parseCameraPose,
  parseGlbHeader,
  type GlbHeaderResult,
} from "./core.ts";

function resolveItemRef(canvas: CanvasContents, rawRef: string): Item {
  const ref = rawRef.trim().replace(/^#/, "");
  if (canvas.items[ref]) return canvas.items[ref]!;
  const items = Object.values(canvas.items);
  const byTitle = items.filter((i) => i.title.toLowerCase() === ref.toLowerCase());
  if (byTitle.length === 1) return byTitle[0]!;
  const byPrefix = items.filter((i) => i.id.startsWith(ref));
  if (byPrefix.length === 1) return byPrefix[0]!;
  if (byTitle.length > 1 || byPrefix.length > 1) {
    throw new Error(`ambiguous item reference "${rawRef}" — pass the full item id`);
  }
  throw new Error(`no item "${rawRef}" on this canvas`);
}

export interface Model3dInspectResult extends GlbHeaderResult {
  itemId: string;
  title: string;
  mimeType: string;
  camera: string | null;
  posterItem: string | null;
}

function register(host: CliHost): void {
  const model3d = host.program
    .command("model3d")
    .description("Inspect GLB 2.0 3D models and capture camera views on this canvas");

  model3d
    .command("inspect <item>")
    .description("Validate a GLB 2.0 item header and print version, bytes, and camera pose")
    .option("--canvas <canvas>")
    .action(
      host.run(async (ref: string, _opts: { canvas?: string }, cmd: Command) => {
        const ctx = await host.ctxOf(cmd);
        const canvas = await host.resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(canvas.id);
        const item = host.resolveItem(snapshot, ref.replace(/^#/, ""));
        const version = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions.at(-1);
        if (!version) throw new Error(`item ${item.id} has no version bytes to inspect`);

        const bytes = await ctx.client.downloadBlob(canvas.id, version.blobHash);
        const header = parseGlbHeader(bytes);
        const result: Model3dInspectResult = {
          itemId: item.id,
          title: item.title,
          mimeType: version.mimeType,
          ...header,
          camera: item.properties[MODEL3D_PROPS.camera] ?? null,
          posterItem: item.properties[MODEL3D_PROPS.posterItem] ?? null,
        };
        if (ctx.json) return host.printJson(result);
        if (!result.valid) {
          console.log(`${result.itemId} (${result.title}): INVALID — ${result.error ?? "unknown error"}`);
          return;
        }
        console.log(
          `${result.itemId} (${result.title}): GLB v${result.version}, ${result.byteLength} bytes, ${result.meshCount ?? 0} mesh(es)`,
        );
        console.log(`  camera: ${result.camera ?? "(default)"}`);
        if (result.posterItem) console.log(`  poster: ${result.posterItem}`);
      }),
    );

  model3d
    .command("capture-view <item>")
    .alias("capture_view")
    .description("Record a camera pose and optional derived poster snapshot for a 3D model")
    .option("--pose <az,el,dist>", "orbit camera pose as azimuth,elevation,distance")
    .option("--poster <file>", "local image file to upload as a derived poster snapshot")
    .option("--canvas <canvas>")
    .action(
      host.run(async (ref: string, opts: { pose?: string; poster?: string; canvas?: string }, cmd: Command) => {
        if (!opts.pose && !opts.poster) {
          throw new Error("pass --pose <az,el,dist> and/or --poster <file> to capture a 3D view");
        }
        let formattedPose: string | undefined;
        if (opts.pose !== undefined) {
          const parsed = parseCameraPose(opts.pose);
          if (!parsed) {
            throw new Error(`invalid --pose "${opts.pose}" — expected azimuth,elevation,distance (e.g. 35,20,3)`);
          }
          formattedPose = formatCameraPose(parsed);
        }

        const ctx = await host.ctxOf(cmd);
        const canvas = await host.resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(canvas.id);
        const item = host.resolveItem(snapshot, ref.replace(/^#/, ""));

        const group = newGroupId();
        let posterItemId: string | undefined;
        if (opts.poster) {
          const rawBytes = await fs.readFile(opts.poster);
          const filename = path.basename(opts.poster);
          const mimeType = mimeFromName(filename) ?? "image/png";
          const uploaded = await ctx.client.uploadBlob(canvas.id, new Uint8Array(rawBytes), mimeType, filename);
          posterItemId = newItemId();
          await host.sendOp(
            ctx,
            canvas.id,
            {
              type: "item.add",
              itemId: posterItemId,
              version: {
                id: newVersionId(),
                blobHash: uploaded.blobHash,
                mimeType,
                filename,
                size: uploaded.size,
              },
              width: Math.max(320, Math.round(item.width)),
              height: Math.max(240, Math.round(item.height)),
              placement: { x: Math.round(item.x + item.width + 32), y: Math.round(item.y) },
              title: `${item.title} — view`,
              properties: {
                "derived-from": item.id,
                ...(formattedPose ? { [MODEL3D_PROPS.camera]: formattedPose } : {}),
              },
            },
            group,
          );
        }

        const patchProps: Record<string, string> = {
          ...(formattedPose ? { [MODEL3D_PROPS.camera]: formattedPose } : {}),
          ...(posterItemId ? { [MODEL3D_PROPS.posterItem]: posterItemId } : {}),
        };
        await host.sendOp(
          ctx,
          canvas.id,
          {
            type: "item.update",
            itemId: item.id,
            patch: { properties: patchProps },
          },
          group,
        );

        const out = {
          itemId: item.id,
          ...(formattedPose ? { camera: formattedPose } : {}),
          ...(posterItemId ? { posterItem: posterItemId } : {}),
        };
        if (ctx.json) return host.printJson(out);
        console.log(
          `updated ${item.id}${formattedPose ? ` camera=${formattedPose}` : ""}${posterItemId ? ` poster=${posterItemId}` : ""}`,
        );
      }),
    );
}

export const model3dCli: CliModule = {
  core: model3dModule,
  register,
  guide: guideText,
  tools: [
    {
      name: "inspect",
      title: "Inspect a 3D GLB model",
      description:
        "Validate a GLB 2.0 3D model item's binary header (magic, version, self-containment, byte length) and report its saved camera pose and poster link. The same act as `isocan model3d inspect`.",
      readOnly: true,
      inputSchema: {
        item: z.string().trim().min(1).describe("3D model item id or unique title to inspect."),
      },
      run: async ({ item: ref }: { item: string }, host) => {
        const canvas = await host.canvas();
        const snapshot = await canvas.ctx.client.snapshot(canvas.id, host.signal);
        const resolved = resolveItemRef(snapshot.canvas, ref);
        const version = resolved.versions.find((v) => v.id === resolved.currentVersionId) ?? resolved.versions.at(-1);
        if (!version) throw new Error(`item ${resolved.id} has no version bytes to inspect`);
        const bytes = await canvas.ctx.client.downloadBlob(canvas.id, version.blobHash, host.signal);
        const header = parseGlbHeader(bytes);
        return {
          itemId: resolved.id,
          title: resolved.title,
          mimeType: version.mimeType,
          ...header,
          camera: resolved.properties[MODEL3D_PROPS.camera] ?? null,
          posterItem: resolved.properties[MODEL3D_PROPS.posterItem] ?? null,
        } satisfies Model3dInspectResult;
      },
    },
    {
      name: "capture_view",
      title: "Record a 3D model camera pose",
      description:
        "Record an orbit camera pose (`az,el,dist`) onto a 3D model item's `model3d.camera` property. The same act as `isocan model3d capture-view --pose`.",
      inputSchema: {
        item: z.string().trim().min(1).describe("3D model item id or unique title."),
        pose: z.string().trim().min(1).describe("Orbit camera pose formatted as azimuth,elevation,distance (e.g. 35,20,3)."),
      },
      run: async ({ item: ref, pose }: { item: string; pose: string }, host) => {
        const parsed = parseCameraPose(pose);
        if (!parsed) {
          throw new Error(`invalid pose "${pose}" — expected azimuth,elevation,distance (e.g. 35,20,3)`);
        }
        const formatted = formatCameraPose(parsed);
        const canvas = await host.canvas();
        const snapshot = await canvas.ctx.client.snapshot(canvas.id, host.signal);
        const resolved = resolveItemRef(snapshot.canvas, ref);
        await canvas.ctx.client.sendOp(canvas.id, canvas.ctx.actor, {
          type: "item.update",
          itemId: resolved.id,
          patch: { properties: { [MODEL3D_PROPS.camera]: formatted } },
        });
        return { itemId: resolved.id, camera: formatted };
      },
    },
  ],
};

export default model3dCli;
