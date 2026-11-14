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
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Command } from "commander";
import type { CanvasSnapshotResponse, Item, Operation } from "@isocan/core";
import type { CliHost, CliModule, Ctx } from "@isocan/cli/modulehost";
import {
  EXACT_INDEX_MIME,
  EXACT_PROPS,
  PHONE,
  buildIndex,
  exactModule,
  indexItemOf,
  indexText,
  parseParams,
  routeLocation,
  screenItemOf,
  screenProperties,
  type Readings,
} from "./core.ts";

/**
 * **`isocan exact`, the acting half** (exact phase 0; design §2–§4).
 *
 * Everything Exact is asked happens in `scripts/exact-bridge.mjs`, run
 * through `runPackageScript` as `motion render` runs its script — a module
 * never spawns. The bridge runs the person's own Exact on the directory they
 * typed; it never runs anything a canvas carries, and the verbs here say
 * which machine did the work. What comes back is posted as ordinary items:
 * an index (JSON, a kind of ours) and one PNG per route.
 */

const id = (prefix: string): string => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;

interface DoctorReport {
  app: string;
  checkout: string;
  commit: string | null;
  subject: string | null;
  dirty: number;
  bun: { path: string; version: string | null; pin: string | null; engines: string | null; packageManager: string | null };
  setup: Array<{ host: string; status: string; what: string; detail: string }>;
  tamber: { protocol: string | null; format?: number | null; note: string | null };
}

interface CaptureReport {
  size: string;
  shots: Array<{ url: string; file: string; sha256: string; ms: number }>;
}

/** The commit and protocol this module was proven against (design §14): newer is warned, then tried. */
export const PROVEN = { commit: "cbe553f6", protocol: "tamber/1.18", bun: "1.4.2" } as const;

async function bridge<T>(host: CliHost, verb: string, args: string[], what: string, quiet: boolean): Promise<T> {
  if (!host.runPackageScript) throw new Error("this isocan cannot run a script for a module — upgrade it (module API 0.2.11)");
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-exact-"));
  const report = path.join(dir, "report.json");
  try {
    host.runPackageScript("scripts/exact-bridge.mjs", [verb, ...args, "--report", report], { what, quiet });
    return JSON.parse(await fs.readFile(report, "utf8")) as T;
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

function appDir(given: string | undefined): string {
  return path.resolve(given ?? ".");
}

async function doctor(host: CliHost, given: string | undefined, opts: { hosts?: string }, cmd: Command): Promise<void> {
  const ctx = await host.ctxOf(cmd);
  const app = appDir(given);
  const r = await bridge<DoctorReport>(host, "doctor", ["--app", app, "--hosts", opts.hosts ?? "web"], "the Exact check", ctx.json);
  const warnings: string[] = [];
  if (r.bun.pin && r.bun.version && r.bun.version !== r.bun.pin) warnings.push(`Bun ${r.bun.version} is not Exact's pin ${r.bun.pin} — warned, not refused`);
  if (r.commit && !r.commit.startsWith(PROVEN.commit)) warnings.push(`this module was proven against Exact ${PROVEN.commit}; ${r.commit.slice(0, 8)} is tried as it is`);
  if (r.tamber.protocol && r.tamber.protocol !== PROVEN.protocol) warnings.push(`Tamber ${r.tamber.protocol} is not ${PROVEN.protocol}, which this module was proven against`);
  if (r.dirty > 0) warnings.push(`the checkout has ${r.dirty} changed file${r.dirty === 1 ? "" : "s"}`);
  const missing = r.setup.filter((row) => row.status !== "ok" && row.status !== "ready");
  if (ctx.json) return host.printJson({ ...r, proven: PROVEN, warnings, ready: missing.length === 0 });
  console.log(`${r.app} — on this machine`);
  console.log(`  checkout  ${r.checkout} @ ${r.commit?.slice(0, 8) ?? "?"}${r.subject ? ` (${r.subject})` : ""}`);
  console.log(`  bun       ${r.bun.version ?? "not found"} (${r.bun.path}); Exact pins ${r.bun.pin ?? r.bun.packageManager ?? "?"}`);
  console.log(`  tamber    ${r.tamber.protocol ?? `none — ${r.tamber.note}`}`);
  for (const row of r.setup) if (row.what !== "setup --check") console.log(`  ${row.status.padEnd(8)}  ${row.host}: ${row.what} — ${row.detail}`);
  for (const row of r.setup) if (row.what === "setup --check") console.log(`  ${row.host}: ${row.status}`);
  for (const w of warnings) console.log(`  warning: ${w}`);
}

type Upsert = "new" | "new version" | "unchanged";

/** Post bytes as an item, or as a version of the one already there — never a version whose bytes did not change. */
async function upsert(
  host: CliHost,
  ctx: Ctx,
  canvasId: string,
  snapshot: CanvasSnapshotResponse,
  existing: Item | null,
  file: { bytes: Buffer; mime: string; filename: string },
  add: { title: string; width: number; height: number; properties: Record<string, string>; anchor?: string },
  group: string,
): Promise<{ itemId: string; status: Upsert; blobHash: string }> {
  const put = await ctx.client.uploadBlob(canvasId, file.bytes, file.mime, file.filename);
  const current = existing?.versions.find((v) => v.id === existing.currentVersionId) ?? existing?.versions.at(-1);
  if (existing && current?.blobHash === put.blobHash) return { itemId: existing.id, status: "unchanged", blobHash: put.blobHash };
  const version = { id: id("ver"), blobHash: put.blobHash, mimeType: file.mime, filename: file.filename, size: put.size };
  let op: Operation;
  if (existing) {
    op = { type: "item.addVersion", itemId: existing.id, version };
    await host.sendOp(ctx, canvasId, op, group);
    await host.sendOp(ctx, canvasId, { type: "item.update", itemId: existing.id, patch: { properties: add.properties } }, group);
    return { itemId: existing.id, status: "new version", blobHash: put.blobHash };
  }
  const itemId = id("itm");
  const groups = snapshot.project.groupMode === "groups";
  op = {
    type: "item.add",
    itemId,
    version,
    width: add.width,
    height: add.height,
    placement: add.anchor ? { anchorItemId: add.anchor } : (host.placementFor(snapshot, {}, { width: add.width, height: add.height }) as Extract<Operation, { type: "item.add" }>["placement"]),
    title: add.title,
    properties: add.properties,
    ...(groups ? { containerId: null, groupPlacement: "auto" as const } : {}),
  };
  await host.sendOp(ctx, canvasId, op, group);
  return { itemId, status: "new", blobHash: put.blobHash };
}

async function open(host: CliHost, given: string, opts: { size?: string; param?: string[] }, cmd: Command): Promise<void> {
  const ctx = await host.ctxOf(cmd);
  const app = appDir(given);
  const params = parseParams(opts.param ?? []);
  const size = host.sizeFor(opts.size, PHONE);
  const canvas = await host.resolveCanvas(ctx);
  if (!ctx.json) console.error(`reading ${app} with its own Exact, on this machine…`);
  const readings = await bridge<Readings>(host, "read", ["--app", app], "reading the app", ctx.json);
  const index = buildIndex(readings);
  if (index.routes.length === 0) throw new Error(`${index.app.name} declares no routes in Contract — phase 0 captures an app's routes; \`contract vocab routes\` says how to declare them`);

  const locations = index.routes.map((route) => ({ route, url: routeLocation(route, params) }));
  if (!ctx.json) console.error(`capturing ${locations.length} screen${locations.length === 1 ? "" : "s"} at ${size.width}x${size.height}, one cold driver each…`);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-exact-shots-"));
  try {
    const shots = await bridge<CaptureReport>(
      host,
      "capture",
      ["--app", app, "--dir", dir, "--size", `${size.width}x${size.height}`, ...locations.flatMap((l) => ["--url", l.url])],
      "the screenshots",
      ctx.json,
    );

    const snapshot = await ctx.client.snapshot(canvas.id);
    const group = id("exact-open");
    const indexItem = await upsert(
      host, ctx, canvas.id, snapshot, indexItemOf(snapshot.canvas, index.app.id),
      { bytes: Buffer.from(indexText(index), "utf8"), mime: EXACT_INDEX_MIME, filename: `${index.app.id}.exact-index.json` },
      { title: `${index.app.name} — Exact index`, width: 320, height: 420, properties: { [EXACT_PROPS.app]: JSON.stringify({ id: index.app.id }) } },
      group,
    );
    const screens = [];
    for (const [i, { route, url }] of locations.entries()) {
      const shot = shots.shots[i]!;
      const posted = await upsert(
        host, ctx, canvas.id, snapshot, screenItemOf(snapshot.canvas, index.app.id, route.name),
        { bytes: await fs.readFile(shot.file), mime: "image/png", filename: `${route.name}.png` },
        { title: `${index.app.name} · ${route.name}`, width: Math.round(size.width / 2), height: Math.round(size.height / 2), properties: screenProperties(index, route, url), anchor: indexItem.itemId },
        group,
      );
      screens.push({ route: route.name, url, ...posted, sha256: shot.sha256, ms: shot.ms });
    }

    if (ctx.json) {
      return host.printJson({ index: { ...indexItem, routes: index.routes, routesJson: index.routesJson, exact: index.exact, plan: index.plan }, screens });
    }
    console.log(`${indexItem.itemId}  ${index.app.name} — Exact index (${indexItem.status}), ${index.routes.length} routes from Contract`);
    console.log(index.routesJson.equal
      ? "  routes.json agrees with Contract's routes"
      : `  routes.json disagrees: only in Contract ${JSON.stringify(index.routesJson.onlyContract)}, only in routes.json ${JSON.stringify(index.routesJson.onlyRoutesJson)}`);
    for (const s of screens) console.log(`${s.itemId}  ${s.route.padEnd(14)} ${s.url.padEnd(16)} ${s.status.padEnd(12)} ${s.sha256.slice(0, 12)}  ${(s.ms / 1000).toFixed(1)} s`);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

function register(host: CliHost): void {
  const exact = host.program
    .command("exact")
    .description("Exact apps on the canvas: check this machine's Exact, and index and capture an app (runs your Exact here)");

  exact
    .command("doctor [app]")
    .description("This machine's Exact for an app: the checkout and its commit, Bun against Exact's pin, setup --check, and Tamber's protocol")
    .option("--hosts <list>", "the hosts to check setup for, comma-separated", "web")
    .action(host.run(async (app: string | undefined, opts: { hosts?: string }, cmd: Command) => doctor(host, app, opts, cmd)));

  exact
    .command("open <app>")
    .description("Index an Exact app's routes and post one web screenshot per route, captured here at a fixed seed, locale, zone and clock")
    .option("--canvas <canvas>")
    .option("--size <wxh>", "the capture size in CSS pixels", `${PHONE.width}x${PHONE.height}`)
    .option("--param <name=value>", "a route parameter's value (repeatable); unnamed ones are 1", (v: string, all: string[] = []) => [...all, v])
    .action(host.run(async (app: string, opts: { size?: string; param?: string[] }, cmd: Command) => open(host, app, opts, cmd)));
}

export const exactCli: CliModule = {
  core: exactModule,
  register,
  guide: guideText,
};

export default exactCli;
