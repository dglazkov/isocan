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

import { createHash } from "node:crypto";
import { promises as fs, watch } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Command } from "commander";
import type { CanvasSnapshotResponse, Item, Operation } from "@isocan/core";
import type { CliHost, Ctx } from "@isocan/cli/modulehost";
import type { ExactIndex, IndexRoute, Readings } from "./core.ts";
import { core } from "./core-ref.ts";
export { bindCore } from "./core-ref.ts";
import { buildIndex, captureKeyParts, designItemProperties, designMarkdown } from "./build.ts";
import { DEVICES, LAYOUT, SCHEMES, mapLayout, parseShots, rowOffset, rowSize, shotsText, type Device, type Scheme } from "./map.ts";
import { buildFindings, checkFindings, movedBody, movedComments, planFindings, type CheckReport, type DiagnoseReport, type Finding } from "./findings.ts";
import { pendingDrives, type DriveAnswer, type DriveRequest } from "./drives.ts";
import { HOST_NAMES, NATIVE_DEVICE, UDID, compareFindings, jobSize, nativeCellWidth, nativeOffset, nativeSize, parseHosts, wallCells, wallSize, wallText, wallsOf, type CompareReport, type Host, type Wall } from "./hosts.ts";

/**
 * **`isocan exact`'s verbs, run** — loaded by `cli.ts` only when a verb runs,
 * so `isocan --version` never reads the map, the capture loop or the bridge's
 * callers (`test/cli-bundle.test.ts` holds start-up under 5.1 MB).
 *
 * **`isocan exact`, the acting half** (exact phases 0 and 1; design §2–§4).
 *
 * Everything Exact is asked happens in `scripts/exact-bridge.mjs`, run
 * through `runPackageScript` as `motion render` runs its script — a module
 * never spawns. The bridge runs the person's own Exact on the directory they
 * typed; it never runs anything a canvas carries except `exact.shots`, a
 * closed list of driver operations checked on both sides. What comes back is
 * posted as ordinary items: an index, a screen per route, device and scheme,
 * the design system, and an anatomy card per Contract file.
 */

const id = (prefix: string): string => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
const sha256 = (text: string): string => createHash("sha256").update(text).digest("hex");

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

interface JobsReport {
  shots: Array<{ job: number; index: number; host?: Host; url: string; size: string; scheme: Scheme; file: string; sha256: string; png?: { width: number; height: number } | null; ms: number; points?: { size?: { width: number; height: number } } | null }>;
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

export async function doctor(host: CliHost, given: string | undefined, opts: { hosts?: string }, cmd: Command): Promise<void> {
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

type Upsert = "new" | "new version" | "unchanged" | "skipped";

/** Is a property patch already true of the item? */
const sameProps = (item: Item, props: Record<string, string>) => Object.entries(props).every(([k, v]) => item.properties?.[k] === v);

/**
 * Post bytes as an item, or as a version of the one already there — never a
 * version whose bytes did not change. Properties that changed are patched
 * either way (a new `exact.key` with the same pixels is metadata, not history).
 */
async function upsert(
  host: CliHost,
  ctx: Ctx,
  canvasId: string,
  snapshot: CanvasSnapshotResponse,
  existing: Item | null,
  file: { bytes: Buffer; mime: string; filename: string },
  add: { title: string; width: number; height: number; properties: Record<string, string>; at: { x: number; y: number } },
  group: string,
): Promise<{ itemId: string; status: Upsert; blobHash: string }> {
  const put = await ctx.client.uploadBlob(canvasId, file.bytes, file.mime, file.filename);
  const current = existing?.versions.find((v) => v.id === existing.currentVersionId) ?? existing?.versions.at(-1);
  if (existing && current?.blobHash === put.blobHash) {
    if (!sameProps(existing, add.properties)) await host.sendOp(ctx, canvasId, { type: "item.update", itemId: existing.id, patch: { properties: add.properties } }, group);
    return { itemId: existing.id, status: "unchanged", blobHash: put.blobHash };
  }
  const version = { id: id("ver"), blobHash: put.blobHash, mimeType: file.mime, filename: file.filename, size: put.size };
  if (existing) {
    await host.sendOp(ctx, canvasId, { type: "item.addVersion", itemId: existing.id, version }, group);
    if (!sameProps(existing, add.properties)) await host.sendOp(ctx, canvasId, { type: "item.update", itemId: existing.id, patch: { properties: add.properties } }, group);
    return { itemId: existing.id, status: "new version", blobHash: put.blobHash };
  }
  const itemId = id("itm");
  const groups = snapshot.project.groupMode === "groups";
  const op: Operation = {
    type: "item.add",
    itemId,
    version,
    width: add.width,
    height: add.height,
    // Chosen: the map is a layout — tabs in a row, pushes under, each
    // device row beside its screen — and the daemon's tidying would scatter
    // it. The spot is computed from the index card's, which sits clear of
    // everything else on the canvas (`mapOrigin`).
    placement: { x: Math.round(add.at.x), y: Math.round(add.at.y), chosen: true },
    title: add.title,
    properties: add.properties,
    ...(groups ? { containerId: null, groupPlacement: "exact" as const } : {}),
  };
  await host.sendOp(ctx, canvasId, op, group);
  return { itemId, status: "new", blobHash: put.blobHash };
}

/** Where a new map starts: right of everything already on the canvas, at its top — or where its index already is. */
function mapOrigin(snapshot: CanvasSnapshotResponse, index: Item | null): { x: number; y: number } {
  if (index) return { x: index.x, y: index.y };
  const items = Object.values(snapshot.canvas.items);
  if (items.length === 0) return { x: 0, y: 0 };
  return { x: Math.round(Math.max(...items.map((i) => i.x + i.width)) + 400), y: Math.round(Math.min(...items.map((i) => i.y))) };
}

const DEVICE_NAMES = Object.keys(DEVICES) as Device[];

function listOf<T extends string>(given: string | undefined, all: readonly T[], what: string): T[] {
  if (!given) return [...all];
  const picked = given.split(",").map((s) => s.trim()).filter(Boolean);
  for (const p of picked) if (!(all as readonly string[]).includes(p)) throw new Error(`--${what} takes ${all.join(", ")}, not ${p}`);
  return picked as T[];
}

interface SyncOptions {
  params: Record<string, string>;
  devices: Device[];
  schemes: Scheme[];
  force: boolean;
  /** The hosts to capture on (exact phase 3): the web always draws every device; a native host its own. */
  hosts: Host[];
  /** The simulator an iOS capture runs on — one the person made for this, by UDID. */
  sim: string | null;
}

interface ScreenResult { route: string; host: Host; device: Device; scheme: Scheme; itemId: string; status: Upsert; sha256: string | null; url: string; ms: number }

interface SyncResult {
  index: ExactIndex;
  indexItem: { itemId: string; status: Upsert };
  design: { itemId: string; status: Upsert } | null;
  anatomy: Array<{ file: string; itemId: string; status: Upsert }>;
  screens: ScreenResult[];
  captureMs: number;
  /** Differences between hosts this pass measured (exact phase 3), and the (route, host) pairs it compared. */
  hostFindings: Finding[];
  compared: Array<{ route: string; host: Host }>;
  walls: Array<{ itemId: string; route: string; status: Upsert }>;
}

/**
 * **One pass over the app** — what `open` does once and `live` does on every
 * save: read the app with its own Exact, build the index, capture every
 * screen whose inputs moved (route × device × scheme, one cold driver per
 * way of reaching a route), and post each as a version only when its pixels
 * changed.
 */
async function sync(host: CliHost, ctx: Ctx, canvasId: string, app: string, opts: SyncOptions): Promise<SyncResult> {
  const readings = await bridge<Readings>(host, "read", ["--app", app], "reading the app", true);
  const index = buildIndex(readings);
  if (index.routes.length === 0) throw new Error(`${index.app.name} declares no routes in Contract — the map captures an app's routes; \`contract vocab routes\` says how to declare them`);

  let snapshot = await ctx.client.snapshot(canvasId);
  const appId = index.app.id;

  // What each screen needs: its shots (the canvas's, else the route's phone screen's, else the default) and its key.
  interface Want { route: IndexRoute; host: Host; device: Device; scheme: Scheme; shots: string; url: string; key: string; existing: Item | null }
  const wants: Want[] = [];
  if (opts.hosts.includes("ios") && !opts.sim) throw new Error("iOS captures run on a simulator of your own, never a booted one that may be somebody else's: `xcrun simctl create \"isocan-exact\" com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro <runtime>` prints a UDID; pass it as --sim <udid>");
  for (const route of index.routes) {
    const primary = core.screenItemOf(snapshot.canvas, appId, route.name);
    const fallback = primary?.properties?.[core.EXACT_PROPS.shots] ?? `at "${core.routeLocation(route, opts.params)}"`;
    for (const host of opts.hosts) {
      // The web draws every device in the row; a native host draws its own (a simulator's phone, a Mac's window).
      const devices = host === "web" ? opts.devices : [NATIVE_DEVICE[host]];
      for (const device of devices) {
        for (const scheme of opts.schemes) {
          const existing = core.screenItemOf(snapshot.canvas, appId, route.name, device, scheme, host);
          const text = existing?.properties?.[core.EXACT_PROPS.shots] ?? fallback;
          let shots;
          try { shots = parseShots(text); } catch (err) { throw new Error(`${existing?.title ?? primary?.title ?? route.name}: ${(err as Error).message}`); }
          const normal = shotsText(shots);
          wants.push({ route, host, device, scheme, shots: normal, url: shots.url, key: sha256(captureKeyParts(index, route.name, device, scheme, normal, host, host === "ios" ? opts.sim : null)), existing });
        }
      }
    }
  }
  const todo = wants.filter((w) => opts.force || !w.existing || w.existing.properties?.[core.EXACT_PROPS.key] !== w.key);

  // One job per host and way of reaching a screen: one cold driver each.
  const jobs: Array<{ host: Host; url: string; ops: string[]; shots: Array<{ size: string; scheme: Scheme }>; wants: Want[] }> = [];
  for (const w of todo) {
    let job = jobs.find((j) => j.host === w.host && j.wants[0]!.shots === w.shots);
    if (!job) { const s = parseShots(w.shots); job = { host: w.host, url: s.url, ops: s.ops, shots: [], wants: [] }; jobs.push(job); }
    job.shots.push({ size: jobSize(w.device), scheme: w.scheme });
    job.wants.push(w);
  }

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-exact-shots-"));
  try {
    let shots: JobsReport = { shots: [] };
    const started = Date.now();
    if (jobs.length > 0) {
      const jobsFile = path.join(dir, "jobs.json");
      await fs.writeFile(jobsFile, JSON.stringify(jobs.map(({ host: on, url, ops, shots: s }) => ({ host: on, url, ops, shots: s }))));
      // Under the live bridge, native captures join its dev loop (`ISOCAN_EXACT_LOOP`, set by exact-live.mjs for its own child).
      const loop = process.env.ISOCAN_EXACT_LOOP;
      const joined = loop && /^http:\/\/127\.0\.0\.1:\d+$/.test(loop) && jobs.some((j) => j.host !== "web") ? ["--dev-url", loop] : [];
      shots = await bridge<JobsReport>(host, "capture", ["--app", app, "--dir", dir, "--jobs", jobsFile, ...(opts.sim ? ["--sim", opts.sim] : []), ...joined], "the screenshots", true);
    }
    const captureMs = Date.now() - started;

    snapshot = await ctx.client.snapshot(canvasId);
    const group = id("exact-sync");
    const origin = mapOrigin(snapshot, core.indexItemOf(snapshot.canvas, appId));
    const indexItem = await upsert(
      host, ctx, canvasId, snapshot, core.indexItemOf(snapshot.canvas, appId),
      { bytes: Buffer.from(core.indexText(index), "utf8"), mime: core.EXACT_INDEX_MIME, filename: `${appId}.exact-index.json` },
      { title: `${index.app.name} — Exact index`, width: LAYOUT.sideWidth, height: 420, properties: { [core.EXACT_PROPS.app]: JSON.stringify({ id: appId }), [core.EXACT_PROPS.summary]: JSON.stringify(core.indexSummary(index)) }, at: origin },
      group,
    );

    let sideY = origin.y + 420 + 40;
    let design: SyncResult["design"] = null;
    const md = designMarkdown(index);
    if (md) {
      design = await upsert(
        host, ctx, canvasId, snapshot, core.designItemOf(snapshot.canvas, appId),
        { bytes: Buffer.from(md, "utf8"), mime: "text/markdown", filename: "DESIGN.md" },
        { title: `${index.app.name} — design system (app.tamber)`, width: LAYOUT.sideWidth, height: 360, properties: designItemProperties(index), at: { x: origin.x, y: sideY } },
        group,
      );
      sideY += 360 + 40;
    }
    const anatomy: SyncResult["anatomy"] = [];
    for (const entry of index.anatomy) {
      const posted = await upsert(
        host, ctx, canvasId, snapshot, core.anatomyItemOf(snapshot.canvas, appId, entry.file),
        { bytes: Buffer.from(core.anatomyText(index, entry), "utf8"), mime: core.EXACT_ANATOMY_MIME, filename: `${entry.file}.anatomy.json` },
        { title: `${index.app.name} · ${entry.file}`, width: LAYOUT.sideWidth, height: 340, properties: { [core.EXACT_PROPS.app]: JSON.stringify({ id: appId }), [core.EXACT_PROPS.file]: entry.file }, at: { x: origin.x, y: sideY } },
        group,
      );
      anatomy.push({ file: entry.file, itemId: posted.itemId, status: posted.status });
      sideY += 340 + 40;
    }

    const layout = mapLayout(index.routes, nativeCellWidth(opts.hosts));
    const mapX = origin.x + LAYOUT.sideWidth + LAYOUT.sideGap;
    const screens: ScreenResult[] = [];
    const natives: Array<{ route: string; host: Exclude<Host, "web">; points: import("./core.ts").CapturePoints | null; file: string; size: string; url: string; ops: string[] }> = [];
    for (const w of wants) {
      const at = layout.get(w.route.name)!;
      const primary = w.host === "web" && w.device === "phone" && w.scheme === "light";
      const jobIndex = jobs.findIndex((j) => j.wants.includes(w));
      const shot = jobIndex < 0 ? null : shots.shots.find((s) => s.job === jobIndex && s.index === jobs[jobIndex]!.wants.indexOf(w))!;
      const off = primary ? { x: 0, y: 0 } : w.host === "web" ? rowOffset(w.device, w.scheme) : nativeOffset(w.host, w.scheme);
      const size = primary ? LAYOUT.primary : w.host === "web" ? rowSize(w.device) : nativeSize(w.host, shot?.png ?? null);
      // Shots are written on the phone screen; a device-row screen carries its own only if somebody gave it one.
      const ownShots = primary || w.existing?.properties?.[core.EXACT_PROPS.shots] !== undefined;
      const props = core.screenProperties(index, w.route, w.url, { device: w.device, scheme: w.scheme, host: w.host, ...(ownShots ? { shots: w.shots } : {}), key: w.key, reached: w.shots });
      if (!shot) {
        // Skipped: nothing it depends on moved. Its arrows may still have (they live on the index).
        if (w.existing && !sameProps(w.existing, props)) await host.sendOp(ctx, canvasId, { type: "item.update", itemId: w.existing.id, patch: { properties: props } }, group);
        screens.push({ route: w.route.name, host: w.host, device: w.device, scheme: w.scheme, itemId: w.existing!.id, status: "skipped", sha256: null, url: w.url, ms: 0 });
        continue;
      }
      const label = primary ? w.route.name : w.host === "web" ? `${w.route.name} · ${w.device} ${w.scheme}` : `${w.route.name} · ${HOST_NAMES[w.host]} ${w.device} ${w.scheme}`;
      // Where each node is on this picture, and which line drew it: pointing on a capture (exact phase 2).
      if (shot.points) props[core.EXACT_PROPS.points] = JSON.stringify(shot.points);
      const posted = await upsert(
        host, ctx, canvasId, snapshot, w.existing,
        { bytes: await fs.readFile(shot.file), mime: "image/png", filename: `${w.route.name}-${w.host === "web" ? "" : `${w.host}-`}${w.device}-${w.scheme}.png` },
        { title: `${index.app.name} · ${label}`, width: size.width, height: size.height, properties: props, at: { x: mapX + at.x + off.x, y: origin.y + at.y + off.y } },
        group,
      );
      screens.push({ route: w.route.name, host: w.host, device: w.device, scheme: w.scheme, itemId: posted.itemId, status: posted.status, sha256: shot.sha256, url: w.url, ms: shot.ms });
      if (w.host !== "web" && w.scheme === "light" && shot.png) natives.push({ route: w.route.name, host: w.host, points: (shot.points ?? null) as never, file: shot.file, size: `${shot.png.width}x${shot.png.height}`, url: w.url, ops: parseShots(w.shots).ops });
    }

    // Every recaptured native screen, set beside the web drawn at its size (design §7): a difference that is the app's
    // own layout, not the platform's bars, becomes a comment on the native screen.
    let hostFindings: Finding[] = [];
    const compared = natives.map((n) => ({ route: n.route, host: n.host }));
    if (natives.length > 0) {
      const jobsFile = path.join(dir, "compare.json");
      await fs.writeFile(jobsFile, JSON.stringify(natives.map((n) => ({ route: n.route, host: n.host, url: n.url, ops: n.ops, size: n.size, reference: n.file }))));
      const report = await bridge<CompareReport>(host, "compare", ["--app", app, "--dir", dir, "--jobs", jobsFile], "the comparison between hosts", true);
      hostFindings = compareFindings(report, natives, readings.sources);
    }

    // Each wall of this app shows its route as the screens are now.
    const walls: SyncResult["walls"] = [];
    const after = await ctx.client.snapshot(canvasId);
    for (const w of wallsOf(after.canvas, appId)) {
      const posted = await postWall(host, ctx, canvasId, after, index.app, w.route, w.scheme, w.item);
      walls.push({ itemId: posted.itemId, route: w.route, status: posted.status });
    }
    return { index, indexItem, design, anatomy, screens, captureMs, hostFindings, compared, walls };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

/**
 * **A device wall** (design §7; journey scene 3): one route on every host
 * and device the canvas has a screen for, side by side — a file of its own
 * (`application/vnd.isocan.exact-wall+json`) naming each cell's screen and
 * the bytes it showed, so it reads as a file with the module gone and is
 * rewritten (a version only when a cell changed) as the screens move.
 */
async function postWall(host: CliHost, ctx: Ctx, canvasId: string, snapshot: CanvasSnapshotResponse, app: { id: string; name: string }, route: string, scheme: Scheme, existing: Item | null): Promise<{ itemId: string; status: Upsert; cells: number }> {
  const cells = wallCells(snapshot.canvas, app.id, route, scheme);
  if (cells.length === 0) throw new Error(`${app.name} has no screen of ${route} on this canvas — \`isocan exact open <app> --hosts web,ios,macos\` captures them first`);
  const wall: Wall = { format: 1, app, route, scheme, cells };
  const size = wallSize(cells);
  const items = Object.values(snapshot.canvas.items);
  const at = existing ? { x: existing.x, y: existing.y } : { x: items.length ? Math.round(Math.max(...items.map((i) => i.x + i.width)) + 200) : 0, y: items.length ? Math.round(Math.min(...items.map((i) => i.y))) : 0 };
  const posted = await upsert(
    host, ctx, canvasId, snapshot, existing,
    { bytes: Buffer.from(wallText(wall), "utf8"), mime: core.EXACT_WALL_MIME, filename: `${route}.exact-wall.json` },
    { title: `${app.name} · ${route} — device wall`, width: size.width, height: size.height, properties: { [core.EXACT_PROPS.app]: JSON.stringify({ id: app.id }), [core.EXACT_PROPS.route]: route, [core.EXACT_PROPS.scheme]: scheme }, at },
    id("exact-wall"),
  );
  return { itemId: posted.itemId, status: posted.status, cells: cells.length };
}

/** **`isocan exact wall <app> <route>`**: the device wall item for one route, made or brought up to date. */
export async function wall(host: CliHost, given: string, route: string, opts: { scheme?: string }, cmd: Command): Promise<void> {
  const ctx = await host.ctxOf(cmd);
  const app = await appOf(appDir(given));
  const canvas = await host.resolveCanvas(ctx);
  const scheme = listOf(opts.scheme ?? "light", SCHEMES, "scheme")[0]!;
  const snapshot = await ctx.client.snapshot(canvas.id);
  const existing = wallsOf(snapshot.canvas, app.id).find((w) => w.route === route && w.scheme === scheme)?.item ?? null;
  const r = await postWall(host, ctx, canvas.id, snapshot, app, route, scheme, existing);
  const cells = wallCells(snapshot.canvas, app.id, route, scheme);
  if (ctx.json) return host.printJson({ ...r, route, scheme, cells: cells.map((c) => ({ itemId: c.itemId, host: c.host, device: c.device, width: c.width, height: c.height })) });
  console.log(`${r.itemId}  ${app.name} · ${route} — device wall (${r.status}): ${cells.map((c) => `${HOST_NAMES[c.host]} ${c.device}`).join(", ")}`);
}

/** Differences between hosts as comments: new ones posted on the native screen, rewritten, or taken away when the hosts agree again — only for the (route, host) pairs this pass compared. */
async function postHostFindings(host: CliHost, ctx: Ctx, canvasId: string, app: { id: string; name: string }, findings: readonly Finding[], compared: ReadonlyArray<{ route: string; host: Host }>): Promise<{ created: number; updated: number; removed: number }> {
  if (compared.length === 0) return { created: 0, updated: 0, removed: 0 };
  const snapshot = await ctx.client.snapshot(canvasId);
  const scope = (key: string) => compared.some((c) => key.startsWith(`compare:${c.route}:${c.host}:`));
  const plan = planFindings(snapshot.canvas, { app }, findings, scope);
  const group = id("exact-hosts");
  for (const c of plan.create) await host.sendOp(ctx, canvasId, { type: "thread.create", threadId: id("thr"), x: c.x, y: c.y, anchorItemId: c.item.id, comment: { id: id("cmt"), body: c.finding.body, record: true } }, group);
  for (const u of plan.update) await host.sendOp(ctx, canvasId, { type: "comment.update", threadId: u.thread.id, commentId: u.thread.comments[0]!.id, body: u.body }, group);
  for (const r of plan.remove) await host.sendOp(ctx, canvasId, { type: "thread.delete", threadId: r.thread.id }, group);
  return { created: plan.create.length, updated: plan.update.length, removed: plan.remove.length };
}

function syncJson(r: SyncResult) {
  return {
    index: { ...r.indexItem, routes: r.index.routes, routesJson: r.index.routesJson, edges: r.index.edges, unplaced: r.index.unplaced, exact: r.index.exact, plan: r.index.plan, inputs: r.index.inputs },
    design: r.design,
    anatomy: r.anatomy,
    screens: r.screens,
    captureMs: r.captureMs,
    hosts: { compared: r.compared, findings: r.hostFindings.map((f) => ({ key: f.key, routes: f.routes, body: f.body })) },
    walls: r.walls,
  };
}

function tally(r: SyncResult): string {
  const by = (s: Upsert) => r.screens.filter((x) => x.status === s);
  const changed = by("new version");
  const routes = [...new Set(changed.map((s) => s.route))];
  return `${r.screens.length} screens: ${by("new").length} new, ${changed.length} new versions${routes.length ? ` (${routes.join(", ")})` : ""}, ${by("unchanged").length} recaptured and unchanged, ${by("skipped").length} skipped`;
}

function printSync(r: SyncResult): void {
  console.log(`${r.indexItem.itemId}  ${r.index.app.name} — Exact index (${r.indexItem.status}), ${r.index.routes.length} routes from Contract, ${r.index.edges.length} arrows`);
  console.log(r.index.routesJson.equal
    ? "  routes.json agrees with Contract's routes"
    : `  routes.json disagrees: only in Contract ${JSON.stringify(r.index.routesJson.onlyContract)}, only in routes.json ${JSON.stringify(r.index.routesJson.onlyRoutesJson)}`);
  for (const e of r.index.edges) console.log(`  ${e.from} → ${e.to}  ${e.verb}${e.action ? ` (${e.action})` : ""}  ${e.file}:${e.line}`);
  for (const u of r.index.unplaced) console.log(`  not drawn: ${u.verb}${u.action ? ` (${u.action})` : ""} at ${u.file}:${u.line} — ${u.why}`);
  if (r.design) console.log(`${r.design.itemId}  design system from app.tamber (${r.design.status}), ${r.index.design?.tokens.length ?? 0} tokens`);
  for (const a of r.anatomy) console.log(`${a.itemId}  anatomy of ${a.file} (${a.status})`);
  for (const s of r.screens) console.log(`${s.itemId}  ${s.route.padEnd(14)} ${s.host.padEnd(6)} ${s.device.padEnd(8)} ${s.scheme.padEnd(6)} ${s.status.padEnd(12)} ${s.sha256?.slice(0, 12) ?? ""}`);
  for (const f of r.hostFindings) console.log(`${f.key}\n  ${f.body.split("\n")[0]}`);
  if (r.compared.length) console.log(`compared ${r.compared.map((c) => `${c.route} on ${HOST_NAMES[c.host]}`).join(", ")} with the web: ${r.hostFindings.length} difference${r.hostFindings.length === 1 ? "" : "s"} beyond each platform's own bars`);
  for (const w of r.walls) console.log(`${w.itemId}  device wall of ${w.route} (${w.status})`);
  console.log(tally(r));
}

export interface CaptureOptions { param?: string[]; devices?: string; schemes?: string; force?: boolean; hosts?: string; sim?: string }

function syncOptions(opts: CaptureOptions): SyncOptions {
  const sim = opts.sim ?? null;
  if (sim !== null && !UDID.test(sim)) throw new Error(`--sim takes a simulator's UDID (\`xcrun simctl list devices\`), not ${JSON.stringify(sim)}: a name could be somebody else's simulator`);
  return {
    params: core.parseParams(opts.param ?? []),
    devices: listOf(opts.devices, DEVICE_NAMES, "devices"),
    schemes: listOf(opts.schemes, SCHEMES, "schemes"),
    force: opts.force === true,
    hosts: parseHosts(opts.hosts),
    sim,
  };
}

export async function open(host: CliHost, given: string, opts: CaptureOptions, cmd: Command): Promise<void> {
  const ctx = await host.ctxOf(cmd);
  const app = appDir(given);
  const canvas = await host.resolveCanvas(ctx);
  if (!ctx.json) console.error(`reading ${app} with its own Exact, on this machine, and capturing what moved…`);
  const r = await sync(host, ctx, canvas.id, app, syncOptions(opts));
  await postHostFindings(host, ctx, canvas.id, r.index.app, r.hostFindings, r.compared);
  if (ctx.json) return host.printJson(syncJson(r));
  printSync(r);
}

/** Files whose change is not the app's: what builds and Exact write, and an editor's (or `sed -i`'s) scratch copies. */
const IGNORED = /(^|\/)(target|\.exact|node_modules|\.git|dist[^/]*)(\/|$)|(^|\/)\.!|\.d\.ts$|\.DS_Store$|~$|\.swp$/;

/** The app's id and name, from its manifest — what the findings need when the build is broken and there is no index. */
async function appOf(app: string): Promise<{ id: string; name: string }> {
  const manifest = JSON.parse(await fs.readFile(path.join(app, "app.json"), "utf8")) as { id?: string; name?: string; app?: { id?: string; name?: string } };
  return { id: manifest.app?.id ?? manifest.id ?? path.basename(app), name: manifest.app?.name ?? manifest.name ?? path.basename(app) };
}

interface FindingsResult { errors: number; created: number; updated: number; removed: number; moved: number; checked: string[]; findings: Finding[] }

/**
 * **What the compiler and `agent check` say, as comments** (exact phase 2;
 * design §6), and the *moved* replies. `diag` is this pass's `diagnose`;
 * `checkRoutes` the routes to run `agent check both` on (only those whose
 * screens were recaptured: a skipped screen's findings cannot have changed),
 * or none. Every write is an ordinary comment op, in one group.
 */
async function postFindings(host: CliHost, ctx: Ctx, canvasId: string, app: string, diag: DiagnoseReport, checkRoutes: Array<{ route: string; url: string }>): Promise<FindingsResult> {
  const info = await appOf(app);
  const routes = diag.symbols ? core.contractRoutes(diag.symbols, diag.sources).routes : [];
  const findings = buildFindings(diag, routes);
  const errors = findings.length;
  let checked: string[] = [];
  if (errors === 0 && checkRoutes.length > 0) {
    const report = await bridge<CheckReport>(host, "check", ["--app", app, ...checkRoutes.flatMap((r) => ["--url", r.url])], "agent check", true);
    findings.push(...checkFindings(report, diag, checkRoutes));
    checked = checkRoutes.map((r) => r.route);
  }
  const snapshot = await ctx.client.snapshot(canvasId);
  const inScope = (key: string) => key.startsWith("build:") || (errors === 0 && checked.some((r) => key.startsWith(`check:${r}:`)));
  const plan = planFindings(snapshot.canvas, { app: info }, findings, inScope);
  const group = id("exact-findings");
  for (const c of plan.create) {
    await host.sendOp(ctx, canvasId, { type: "thread.create", threadId: id("thr"), x: c.x, y: c.y, anchorItemId: c.item.id, comment: { id: id("cmt"), body: c.finding.body, record: true } }, group);
  }
  for (const u of plan.update) {
    await host.sendOp(ctx, canvasId, { type: "comment.update", threadId: u.thread.id, commentId: u.thread.comments[0]!.id, body: u.body }, group);
  }
  for (const r of plan.remove) await host.sendOp(ctx, canvasId, { type: "thread.delete", threadId: r.thread.id }, group);
  const moved = movedComments(snapshot.canvas, info.id, diag.digests);
  for (const m of moved) {
    await host.sendOp(ctx, canvasId, { type: "thread.reply", threadId: m.thread.id, comment: { id: id("cmt"), body: movedBody(m.source, m.now), record: true } }, group);
  }
  return { errors, created: plan.create.length, updated: plan.update.length, removed: plan.remove.length, moved: moved.length, checked, findings };
}

function findingsTally(f: FindingsResult): string {
  const parts = [
    f.errors > 0 ? `${f.errors} compile error${f.errors === 1 ? "" : "s"}` : "builds",
    f.checked.length > 0 ? `checked ${f.checked.join(", ")}` : null,
    f.created || f.updated || f.removed ? `comments: ${f.created} new, ${f.updated} rewritten, ${f.removed} resolved` : null,
    f.moved ? `${f.moved} moved` : null,
  ];
  return parts.filter(Boolean).join("; ");
}

/**
 * **`isocan exact check`** (exact phase 2; design §6): the compiler's
 * diagnostics and `agent check both` on every route's phone screen, as
 * comments on the screens they concern — each with `exact.source` — the
 * ones no longer found taken away, and *moved* said where a comment's file
 * changed under it. What `live` does on every save, once.
 */
export async function check(host: CliHost, given: string, opts: { checks?: boolean }, cmd: Command): Promise<void> {
  const ctx = await host.ctxOf(cmd);
  const app = appDir(given);
  const canvas = await host.resolveCanvas(ctx);
  const diag = await bridge<DiagnoseReport>(host, "diagnose", ["--app", app], "the compiler's check", true);
  const info = await appOf(app);
  const snapshot = await ctx.client.snapshot(canvas.id);
  const routes = diag.symbols ? core.contractRoutes(diag.symbols, diag.sources).routes : [];
  const urls = routes.flatMap((r) => {
    const screen = core.screenItemOf(snapshot.canvas, info.id, r.name);
    return screen ? [{ route: r.name, url: screen.properties?.[core.EXACT_PROPS.url] ?? core.routeLocation(r) }] : [];
  });
  const r = await postFindings(host, ctx, canvas.id, app, diag, opts.checks === false ? [] : urls);
  if (ctx.json) return host.printJson({ errors: r.errors, created: r.created, updated: r.updated, resolved: r.removed, moved: r.moved, checked: r.checked, findings: r.findings.map((f) => ({ key: f.key, routes: f.routes, body: f.body })) });
  for (const f of r.findings) console.log(`${f.key}\n  ${f.body.split("\n")[0]}`);
  console.log(findingsTally(r));
}

/**
 * **`isocan exact live`** (design §2, §4): one pass, then a pass on every
 * save — the index rebuilt, captures skipped where their inputs did not
 * move, and a version posted only where the pixels did. Runs until ctrl-c,
 * or `--max-passes` passes after the first.
 */
export interface LiveOptions extends CaptureOptions { maxPasses?: string; quietMs?: string; frames?: boolean; checks?: boolean; bridgePort?: string; designPort?: string }

export async function live(host: CliHost, given: string, opts: LiveOptions, cmd: Command): Promise<void> {
  const ctx = await host.ctxOf(cmd);
  const app = appDir(given);
  const canvas = await host.resolveCanvas(ctx);
  if (opts.frames !== false) {
    // Live frames (exact phase 2; design §5): the bridge script owns the dev loop, the frames proxy and the paired
    // door a canvas page talks to, and runs this very verb again with --no-frames as its capture loop. A module may
    // not spawn, and a script run for it blocks until it ends — so the long-running half is the script's.
    if (!host.runPackageScript) throw new Error("this isocan cannot run a script for a module — upgrade it (module API 0.2.11), or pass --no-frames");
    const child = [process.execPath, process.argv[1]!, ...process.argv.slice(2), "--no-frames"];
    if (!child.includes("--canvas")) child.push("--canvas", canvas.id);
    const capture = syncOptions(opts);
    host.runPackageScript("scripts/exact-live.mjs", [
      "--app", app, "--child", JSON.stringify(child),
      // Drive mode runs on the hosts this session captures, and on iOS only on the simulator named here (exact phase 3).
      "--hosts", capture.hosts.join(","),
      ...(capture.sim ? ["--sim", capture.sim] : []),
      ...(opts.bridgePort ? ["--bridge-port", opts.bridgePort] : []),
      ...(opts.designPort ? ["--design-port", opts.designPort] : []),
      ...(ctx.json ? ["--json"] : []),
    ], { what: "the live bridge" });
    return;
  }
  const options = syncOptions(opts);
  const max = opts.maxPasses === undefined ? Number.POSITIVE_INFINITY : Number(opts.maxPasses);
  if (!(max >= 0)) throw new Error(`--max-passes takes a number, not ${opts.maxPasses}`);
  const quiet = opts.quietMs === undefined ? 400 : Number(opts.quietMs);
  const say = (r: SyncResult | null, f: FindingsResult, why: string) => {
    if (ctx.json) console.log(JSON.stringify({ why, ...(r ? syncJson(r) : { screens: [] }), findings: { errors: f.errors, created: f.created, updated: f.updated, resolved: f.removed, moved: f.moved, checked: f.checked } }));
    else console.log(`${new Date().toISOString().slice(11, 19)}  ${why}: ${r ? tally(r) : "screens wait for a build"}; ${findingsTally(f)}`);
  };
  /**
   * One pass: what the compiler says first — a save that does not build is
   * comments on the screens it breaks, and the captures wait — then the map,
   * then `agent check` on the routes whose screens were recaptured.
   */
  const onePass = async (force: boolean): Promise<{ r: SyncResult | null; f: FindingsResult }> => {
    const diag = await bridge<DiagnoseReport>(host, "diagnose", ["--app", app], "the compiler's check", true);
    const broken = diag.diagnostics.some((d) => !d.severity || d.severity === "error");
    const r = broken ? null : await sync(host, ctx, canvas.id, app, { ...options, force });
    if (r) await postHostFindings(host, ctx, canvas.id, r.index.app, r.hostFindings, r.compared);
    const recaptured = (r?.screens ?? []).filter((x) => x.host === "web" && x.device === "phone" && x.scheme === "light" && x.status !== "skipped").map((x) => ({ route: x.route, url: x.url }));
    const f = await postFindings(host, ctx, canvas.id, app, diag, opts.checks === false ? [] : recaptured);
    return { r, f };
  };
  if (!ctx.json) console.error(`live on ${app}, on this machine — a pass now, then one per save (ctrl-c stops)`);
  // Drives asked for on the canvas are answered from the moment the loop starts (exact phase 3).
  const drives = new AbortController();
  void serveDrives(host, ctx, canvas.id, app, options, drives.signal, (line) => console.log(`${new Date().toISOString().slice(11, 19)}  ${line}`));
  { const first = await onePass(options.force); say(first.r, first.f, "opened"); }
  let passes = 0;
  if (passes >= max) { drives.abort(); return; }
  const changed = new Set<string>();
  let timer: NodeJS.Timeout | null = null;
  let running = false;
  await new Promise<void>((resolve) => {
    const watcher = watch(app, { recursive: true }, (_event, name) => {
      const rel = typeof name === "string" ? name : "";
      if (!rel || IGNORED.test(rel)) return;
      changed.add(rel);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void pass(), quiet);
    });
    const stop = () => { watcher.close(); drives.abort(); resolve(); };
    process.once("SIGINT", stop);
    const pass = async () => {
      if (running) { timer = setTimeout(() => void pass(), quiet); return; }
      running = true;
      const files = [...changed].sort();
      changed.clear();
      try {
        const next = await onePass(false);
        say(next.r, next.f, `saved ${files.join(", ")}`);
        passes++;
        if (passes >= max) stop();
      } catch (err) {
        // A save that does not build is a moment in editing, not the end of the session: say it, and wait for the next.
        console.error(`exact live: ${(err as Error).message}`);
      } finally {
        running = false;
      }
    };
  });
}


/**
 * **Drives asked for on the canvas** (exact phase 3; design §5, §7): a
 * browser whose door to this machine is shut writes `exact.drive` on a
 * screen. This waits on the canvas's op log — the long poll every CLI waiter
 * uses — for those writes, replays each drive with the capture bridge's own
 * `drive` (the code the live bridge's `/drive` runs too), puts the fresh
 * picture as a blob of the canvas and writes the answer back as
 * `exact.driven`: a capture behind, and nothing from the browser reaches here.
 */
async function serveDrives(host: CliHost, ctx: Ctx, canvasId: string, app: string, options: SyncOptions, signal: AbortSignal, say: (line: string) => void): Promise<void> {
  let since = (await ctx.client.snapshot(canvasId)).lastSeq;
  const appId = (await appOf(app)).id;
  while (!signal.aborted) {
    let entries: Awaited<ReturnType<typeof ctx.client.getLog>>;
    try {
      entries = await ctx.client.getLog(canvasId, since, 25_000);
    } catch {
      if (signal.aborted) return;
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }
    if (entries.length === 0) continue;
    since = Math.max(since, ...entries.map((e) => e.seq));
    const snapshot = await ctx.client.snapshot(canvasId);
    for (const { item, request } of pendingDrives(entries, snapshot.canvas, appId)) {
      if (signal.aborted) return;
      say(`drive on ${request.host} (${item.title}): ${request.ops.at(-1) ?? "the screen as captured"}${request.by ? `, for ${request.by}` : ""}`);
      const answer = await answerDrive(host, ctx, canvasId, app, options, request);
      say(`drive on ${request.host}: ${answer.ok ? `a fresh screenshot in ${answer.ms} ms` : answer.error}`);
      await host.sendOp(ctx, canvasId, { type: "item.update", itemId: item.id, patch: { properties: { [core.EXACT_PROPS.driven]: JSON.stringify(answer) } } }, id("exact-drive"));
    }
  }
}

async function answerDrive(host: CliHost, ctx: Ctx, canvasId: string, app: string, options: SyncOptions, request: DriveRequest): Promise<DriveAnswer> {
  const refused = (error: string): DriveAnswer => ({ seq: request.seq, ok: false, blobHash: null, points: null, results: [], ms: 0, error });
  if (!(options.hosts as readonly string[]).includes(request.host)) return refused(`this \`isocan exact live\` drives ${options.hosts.join(", ")} — start it with --hosts …,${request.host}`);
  if (request.host === "ios" && !options.sim) return refused("this `isocan exact live` has no simulator of its own to drive iOS on: --sim <udid>");
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-exact-drive-"));
  try {
    const job = path.join(dir, "job.json");
    await fs.writeFile(job, JSON.stringify({ host: request.host, size: request.size, scheme: request.scheme, shots: request.shots, ops: request.ops }));
    let r: { ok: boolean; file: string | null; points: unknown; results: DriveAnswer["results"]; ms: number; error?: string };
    try {
      const loop = process.env.ISOCAN_EXACT_LOOP;
      const joined = loop && /^http:\/\/127\.0\.0\.1:\d+$/.test(loop) && request.host !== "web" ? ["--dev-url", loop] : [];
      r = await bridge(host, "drive", ["--app", app, "--dir", dir, "--job", job, ...(options.sim ? ["--sim", options.sim] : []), ...joined], "the drive", true);
    } catch (err) {
      return refused((err as Error).message);
    }
    const blobHash = r.file ? (await ctx.client.uploadBlob(canvasId, await fs.readFile(r.file), "image/png", "drive.png")).blobHash : null;
    return { seq: request.seq, ok: r.ok && !!blobHash, blobHash, points: r.points, results: r.results, ms: r.ms, ...(r.error ? { error: r.error } : {}) };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
