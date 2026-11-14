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
import { pendingDrives, pendingFilms, pendingInspects, type DriveAnswer, type DriveRequest } from "./drives.ts";
import { filmKeyText, filmTitle, landFilm, parseFilm, type FilmAnswer, type FilmAsk, type FilmFacts, type FilmJob, type FilmReport, type InspectAnswer, type InspectRequest, type ScreenFacts } from "./film.ts";
import { answerRecord, answerRun, pendingAsks, pendingRecords, runLine, runOnHost, storyItemOf, syncStories, verifyOnHost, writeKept, type Kit, type RunOptions } from "./stories.ts";
import { parseVerifyAsk, type RunReport, type VerifyAnswer } from "./story.ts";
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
  /** The test files and their storyboards (exact phase 5). */
  stories: Array<{ file: string; test: string | null; itemId: string; status: Upsert }>;
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
    // The tests (exact phase 5): each file in the side column under the cards, each test a storyboard under the map.
    const placed = Object.values(after.canvas.items).filter((i) => core.appIdOf(i) === appId && (i.properties?.[core.EXACT_PROPS.route] !== undefined || i.id === indexItem.itemId));
    const below = Math.max(sideY, ...placed.map((i) => i.y + i.height)) + 240;
    const stories = await syncStories(kit, host, ctx, canvasId, readings, index, { sideX: origin.x, mapX, y: below });
    return { index, indexItem, design, anatomy, screens, captureMs, hostFindings, compared, walls, stories };
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
    stories: r.stories,
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
  for (const t of r.stories) console.log(`${t.itemId}  ${t.test === null ? `test file ${t.file}` : `storyboard of test "${t.test}"`} (${t.status})`);
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
const IGNORED = /(^|\/)(target|\.exact|node_modules|\.git|dist[^/]*)(\/|$)|(^|\/)\.!|\.d\.ts$|\.DS_Store$|~$|\.swp$|\.isocan-\d+$/;

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
    // Films asked for the same way (exact phase 4): the strip lands beside the map, as `isocan exact film` lands it.
    for (const { item, request } of pendingFilms(entries, snapshot.canvas, appId)) {
      if (signal.aborted) return;
      say(`film on ${request.host} (${item.title}): ${request.ops.join(", ") || "the screen"}, ${request.over} ms every ${request.every}${request.by ? `, for ${request.by}` : ""}`);
      const answer = await answerFilm(host, ctx, canvasId, app, options, item, request);
      say(`film on ${request.host}: ${answer.ok ? `${answer.itemId}, sha256 ${answer.sha256}, in ${answer.ms} ms` : answer.error}`);
      await host.sendOp(ctx, canvasId, { type: "item.update", itemId: item.id, patch: { properties: { [core.EXACT_PROPS.filmed]: JSON.stringify(answer) } } }, id("exact-film"));
    }
    // Storyboards (exact phase 5): runs and verifies asked for on the canvas, recordings proposed, and a kept recording written.
    const asks = pendingAsks(entries, snapshot, appId);
    for (const item of asks.runs) {
      if (signal.aborted) return;
      const answer = await answerRun(kit, host, ctx, canvasId, app, options.hosts, options.sim, item, say);
      if (answer) await host.sendOp(ctx, canvasId, { type: "item.update", itemId: item.id, patch: { properties: { [core.EXACT_PROPS.ran]: JSON.stringify(answer) } } }, id("exact-run"));
    }
    for (const item of asks.verifies) {
      if (signal.aborted) return;
      const ask = parseVerifyAsk(item.properties?.[core.EXACT_PROPS.verify])!;
      const started = Date.now();
      const answer: VerifyAnswer = { seq: ask.seq, ok: true, hosts: {}, ms: 0 };
      for (const on of ask.hosts) {
        say(`verify on ${on}${ask.by ? `, for ${ask.by}` : ""}`);
        if (!(options.hosts as readonly string[]).includes(on) || (on === "ios" && !options.sim)) { answer.hosts[on] = { exit: null, problems: null, tests: null, posted: [], unmatched: [], error: `this \`isocan exact live\` runs on ${options.hosts.join(", ")}${on === "ios" ? " (iOS needs --sim <udid>)" : ""}` }; continue; }
        try { answer.hosts[on] = await verifyOnHost(kit, host, ctx, canvasId, app, on, on === "ios" ? options.sim : null); } catch (err) { answer.hosts[on] = { exit: null, problems: null, tests: null, posted: [], unmatched: [], error: (err as Error).message }; }
        const h = answer.hosts[on]!;
        say(`verify on ${on}: ${h.error ?? `exit ${h.exit}, ${h.problems ?? "?"} problems, ${h.posted.length} screens versioned, ${h.unmatched.length} shots not placed`}`);
      }
      answer.ms = Date.now() - started;
      answer.ok = Object.values(answer.hosts).every((h) => !h.error);
      await host.sendOp(ctx, canvasId, { type: "item.update", itemId: item.id, patch: { properties: { [core.EXACT_PROPS.verified]: JSON.stringify(answer) } } }, id("exact-verify"));
    }
    for (const { item, ask, seq } of pendingRecords(entries, snapshot, appId)) {
      if (signal.aborted) return;
      say(`recording on ${ask.host} (${item.title}): ${ask.ops.join(", ")}${ask.by ? `, for ${ask.by}` : ""}`);
      const answer = await answerRecord(kit, host, ctx, canvasId, app, options.hosts, options.sim, item, ask, seq);
      say(`recording: ${answer.ok ? `proposed ${answer.itemId} with ${answer.expects.length} expect lines (${answer.expects.join("; ")})` : answer.error}`);
      await host.sendOp(ctx, canvasId, { type: "item.update", itemId: item.id, patch: { properties: { [core.EXACT_PROPS.recorded]: JSON.stringify(answer) } } }, id("exact-record"));
    }
    await writeKept(host, ctx, canvasId, app, appId, entries, snapshot, say);
    // Inspections asked for the same way (exact phase 4): the driver's facts for one screen, as a JSON blob.
    for (const { item, request } of pendingInspects(entries, snapshot.canvas, appId)) {
      if (signal.aborted) return;
      say(`inspect on ${request.host} (${item.title})${request.by ? `, for ${request.by}` : ""}`);
      const answer = await answerInspect(host, ctx, canvasId, app, options, request);
      say(`inspect on ${request.host}: ${answer.ok ? `tree --ax, layout, perf and logs in ${answer.ms} ms` : answer.error}`);
      await host.sendOp(ctx, canvasId, { type: "item.update", itemId: item.id, patch: { properties: { [core.EXACT_PROPS.inspected]: JSON.stringify(answer) } } }, id("exact-inspect"));
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


/** One screen's facts from a cold driver (exact phase 4): `tree --ax`, `layout`, `perf` and `logs`, through the capture bridge. */
async function screenFacts(host: CliHost, app: string, start: { host: string; size: string; scheme: string; shots: string }, sim: string | null): Promise<ScreenFacts> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-exact-facts-"));
  try {
    const job = path.join(dir, "job.json");
    await fs.writeFile(job, JSON.stringify(start));
    const loop = process.env.ISOCAN_EXACT_LOOP;
    const joined = loop && /^http:\/\/127\.0\.0\.1:\d+$/.test(loop) && start.host !== "web" ? ["--dev-url", loop] : [];
    return await bridge<ScreenFacts>(host, "facts", ["--app", app, "--job", job, ...(sim ? ["--sim", sim] : []), ...joined], "the inspection", true);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

async function answerInspect(host: CliHost, ctx: Ctx, canvasId: string, app: string, options: SyncOptions, request: InspectRequest): Promise<InspectAnswer> {
  const refused = (error: string): InspectAnswer => ({ seq: request.seq, ok: false, blobHash: null, ms: 0, error });
  if (!(options.hosts as readonly string[]).includes(request.host)) return refused(`this \`isocan exact live\` inspects ${options.hosts.join(", ")} — start it with --hosts …,${request.host}`);
  if (request.host === "ios" && !options.sim) return refused("this `isocan exact live` has no simulator of its own to inspect iOS on: --sim <udid>");
  let facts: ScreenFacts;
  try {
    facts = await screenFacts(host, app, { host: request.host, size: request.size, scheme: request.scheme, shots: request.shots }, options.sim);
  } catch (err) {
    return refused((err as Error).message);
  }
  const blobHash = (await ctx.client.uploadBlob(canvasId, Buffer.from(JSON.stringify(facts), "utf8"), "application/json", "inspect.json")).blobHash;
  return { seq: request.seq, ok: facts.ok, blobHash, ms: facts.ms, ...(facts.error ? { error: facts.error } : {}) };
}

/** The screen a film or an inspection starts from, and how it is reached: its shots, else the route's phone screen's, else its capture's. */
function startScreen(snapshot: CanvasSnapshotResponse, appId: string, route: string, where: { host: Host; device: Device; scheme: Scheme }): { screen: Item; shots: string } {
  const screen = core.screenItemOf(snapshot.canvas, appId, route, where.device, where.scheme, where.host);
  const primary = core.screenItemOf(snapshot.canvas, appId, route);
  const found = screen ?? primary;
  if (!found) throw new Error(`no screen of ${route} for ${appId} on this canvas — \`isocan exact open <app>\` lays the routes out first (\`--hosts ${where.host}\` for ${where.host})`);
  const text = screen?.properties?.[core.EXACT_PROPS.shots] ?? screen?.properties?.[core.EXACT_PROPS.reached] ?? primary?.properties?.[core.EXACT_PROPS.shots] ?? primary?.properties?.[core.EXACT_PROPS.reached] ?? `at "${found.properties?.[core.EXACT_PROPS.url] ?? "/"}"`;
  const shots = shotsText(parseShots(text));
  return { screen: found, shots };
}

interface WhereOptions { canvas?: string; host?: string; device?: string; scheme?: string; sim?: string }

function whereOf(opts: WhereOptions): { host: Host; device: Device; scheme: Scheme; sim: string | null } {
  const [on] = parseHosts(opts.host ?? "web");
  const host = on ?? "web";
  if (opts.host && opts.host.includes(",")) throw new Error("--host takes one host");
  const device = host === "web" ? listOf(opts.device ?? "phone", DEVICE_NAMES, "device")[0]! : NATIVE_DEVICE[host];
  const scheme = listOf(opts.scheme ?? "light", SCHEMES, "scheme")[0]!;
  const sim = opts.sim ?? null;
  if (sim !== null && !UDID.test(sim)) throw new Error(`--sim takes a simulator's UDID, not ${JSON.stringify(sim)}`);
  if (host === "ios" && !sim) throw new Error("iOS runs on a simulator of your own, by UDID: --sim <udid> (never a booted one somebody else may own)");
  return { host, device, scheme, sim };
}

export interface FilmOptions extends WhereOptions { do?: string[]; over?: string; every?: string; watch?: string; out?: string }

/**
 * **`isocan exact film`** (exact phase 4; design §8): one route's screen
 * reached as its shots say, the interaction done (`--do`, Drive mode's closed
 * list), then filmed against the virtual clock — Exact's `screenshot
 * <file>.apng over <ms> every <ms>` — with the state read at each frame's
 * instant on a second cold driver. The strip lands as an image item beside
 * the map with `exact.film` and `exact.frames`; filmed again with the same
 * everything, it is the same bytes and posts no version.
 */
export async function film(host: CliHost, given: string, route: string, opts: FilmOptions, cmd: Command): Promise<void> {
  const ctx = await host.ctxOf(cmd);
  const app = appDir(given);
  const canvas = await host.resolveCanvas(ctx);
  const where = whereOf(opts);
  const over = Number(opts.over ?? 600), every = Number(opts.every ?? 16);
  if (!Number.isInteger(over) || !Number.isInteger(every) || over < 0 || every < 1) throw new Error("--over and --every take whole milliseconds (every ≥ 1)");
  const ops = opts.do ?? [];
  const appInfo = await appOf(app);
  const snapshot = await ctx.client.snapshot(canvas.id);
  const { screen, shots } = startScreen(snapshot, appInfo.id, route, where);
  const size = where.host === "ios" ? "390x844" : jobSize(where.device);
  const watch = opts.watch ?? null;
  if (!ctx.json) console.error(`filming ${route} on ${where.host} after ${ops.join(", ") || "nothing"}: ${over} ms every ${every} ms, on the virtual clock…`);
  const made = await makeFilm(host, ctx, canvas.id, app, appInfo, screen, { route, device: where.device }, { host: where.host, size, scheme: where.scheme, shots, ops, over, every, watch }, where.sim, opts.out);
  const { r, facts, posted } = made;
  const out = { itemId: posted.itemId, status: posted.status, title: filmTitle(facts), sha256: r.sha256, bytes: r.bytes, frames: facts.steps, at: facts.at, every, over, route, host: where.host, ops, watch, states: r.states.length, ...(r.stateError ? { stateError: r.stateError } : {}), ms: r.ms, ...(opts.out ? { out: path.resolve(opts.out) } : {}) };
  if (ctx.json) return host.printJson(out);
  console.log(`${out.title}: ${posted.status} (${posted.itemId})`);
  console.log(`  ${facts.steps} frames at ${facts.at.slice(0, 3).join(", ")}${facts.steps > 3 ? ` … ${facts.at.at(-1)}` : ""} ms · sha256 ${r.sha256}${opts.out ? ` · written to ${out.out}` : ""}`);
  console.log(`  state at every frame${watch ? ` and ${watch}'s layout` : ""} in exact.frames${r.stateError ? ` — but ${r.stateError}` : ""}; film ${r.ms.film} ms, state ${r.ms.state} ms`);
}

/**
 * **One film, made and landed** — the CLI's `film` and `isocan exact live`'s
 * answer to a film asked for on the canvas run this: the bridge's `film`,
 * then the strip posted beside the map (`landFilm`), a version only when its
 * bytes changed.
 */
async function makeFilm(host: CliHost, ctx: Ctx, canvasId: string, app: string, appInfo: { id: string }, screen: Item, where: { route: string; device: string }, job: FilmJob, sim: string | null, outFile?: string): Promise<{ r: FilmReport; facts: FilmFacts; posted: { itemId: string; status: Upsert } }> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-exact-film-"));
  try {
    const jobFile = path.join(dir, "job.json");
    await fs.writeFile(jobFile, JSON.stringify(job));
    const loop = process.env.ISOCAN_EXACT_LOOP;
    const joined = loop && /^http:\/\/127\.0\.0\.1:\d+$/.test(loop) && job.host !== "web" ? ["--dev-url", loop] : [];
    const r = await bridge<FilmReport>(host, "film", ["--app", app, "--dir", dir, "--job", jobFile, ...(sim ? ["--sim", sim] : []), ...joined], "the film", true);
    if (!r.ok || !r.file) throw new Error(`the film did not finish: ${r.error ?? "no file"}`);
    const bytes = await fs.readFile(r.file);
    if (outFile) await fs.writeFile(path.resolve(outFile), bytes);
    const key = sha256(filmKeyText({ app: appInfo.id, route: where.route, host: job.host, device: where.device, scheme: job.scheme, shots: job.shots, ops: job.ops, over: job.over, every: job.every, watch: job.watch }));
    const snapshot = await ctx.client.snapshot(canvasId);
    const land = landFilm(Object.values(snapshot.canvas.items), { app: core.EXACT_PROPS.app, film: core.EXACT_PROPS.film, frames: core.EXACT_PROPS.frames }, appInfo, screen, where, job, r, key);
    const existing = land.existing ? snapshot.canvas.items[land.existing.id] ?? null : null;
    const posted = await upsert(host, ctx, canvasId, snapshot, existing, { bytes, mime: "image/png", filename: `${where.route}-film.apng` }, { title: land.title, width: land.width, height: land.height, at: land.at, properties: land.properties }, id("exact-film"));
    return { r, facts: land.facts, posted };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

/** A film asked for on the canvas, answered (exact phase 4): the screen's route and device, the strip landed beside the map. */
async function answerFilm(host: CliHost, ctx: Ctx, canvasId: string, app: string, options: SyncOptions, item: Item, request: FilmAsk): Promise<FilmAnswer> {
  const refused = (error: string): FilmAnswer => ({ seq: request.seq, ok: false, itemId: null, sha256: null, ms: 0, error });
  if (!(options.hosts as readonly string[]).includes(request.host)) return refused(`this \`isocan exact live\` films ${options.hosts.join(", ")} — start it with --hosts …,${request.host}`);
  if (request.host === "ios" && !options.sim) return refused("this `isocan exact live` has no simulator of its own to film iOS on: --sim <udid>");
  const route = item.properties?.[core.EXACT_PROPS.route];
  if (!route) return refused("only an Exact screen can be filmed");
  const started = Date.now();
  try {
    const { seq: _seq, by: _by, ...job } = request;
    const made = await makeFilm(host, ctx, canvasId, app, (await appOf(app)), item, { route, device: item.properties?.[core.EXACT_PROPS.device] ?? "phone" }, job, options.sim);
    return { seq: request.seq, ok: true, itemId: made.posted.itemId, sha256: made.r.sha256, ms: Date.now() - started };
  } catch (err) {
    return refused((err as Error).message);
  }
}

/**
 * **`isocan exact inspect`** (exact phase 4): what the inspector panel shows
 * for a screen — the driver's `tree --ax`, `layout`, `perf` and `logs` from a
 * cold driver at the screen's shots — printed for an agent.
 */
export async function inspect(host: CliHost, given: string, route: string, opts: WhereOptions, cmd: Command): Promise<void> {
  const ctx = await host.ctxOf(cmd);
  const app = appDir(given);
  const canvas = await host.resolveCanvas(ctx);
  const where = whereOf(opts);
  const appInfo = await appOf(app);
  const snapshot = await ctx.client.snapshot(canvas.id);
  const { screen, shots } = startScreen(snapshot, appInfo.id, route, where);
  const size = where.host === "ios" ? "390x844" : jobSize(where.device);
  const facts = await screenFacts(host, app, { host: where.host, size, scheme: where.scheme, shots }, where.sim);
  if (ctx.json) return host.printJson({ screen: screen.id, ...facts });
  if (!facts.ok) throw new Error(`the inspection did not finish: ${facts.error ?? "no tree"}`);
  const elements = facts.ax?.ax?.elements ?? [];
  console.log(`${screen.title} on ${where.host} (${shots.split("\n").join("; ")}), ${facts.ms} ms`);
  console.log(`  tree --ax  ${elements.length} elements (${facts.ax?.ax?.source ?? "?"}); interactive: ${elements.filter((e) => e.interactive).map((e) => e.testId ?? e.name).filter(Boolean).join(", ") || "none"}`);
  console.log(`  layout     ${facts.layout?.nodes?.length ?? 0} nodes`);
  console.log(`  perf       ${facts.perf?.walked ?? "?"} walked; resources ${(facts.perf?.resources ?? []).map((x) => `${x.name}×${x.asked}`).join(", ") || "none"}`);
  console.log(`  logs       ${(facts.logs?.lines ?? []).length} lines${(facts.logs?.lines ?? []).length ? `, last: ${facts.logs!.lines!.at(-1)}` : ""}`);
  console.log(`  the same tree: bun exact.mjs ${facts.command.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(" ")}`);
}

/**
 * **A comment at a moment of a film** (exact phase 4): what a person does by
 * scrubbing and commenting, for an agent — a thread on the film whose comment
 * carries core's `at` (seconds, motion's shape), pinned under the moment on
 * the strip. Opening it on the canvas scrubs the strip there.
 */
export async function moment(host: CliHost, ref: string, ms: string, words: string[], cmd: Command): Promise<void> {
  const ctx = await host.ctxOf(cmd);
  const canvas = await host.resolveCanvas(ctx);
  const snapshot = await ctx.client.snapshot(canvas.id);
  const item = host.resolveItem(snapshot, ref);
  const facts = parseFilm(item.properties?.[core.EXACT_PROPS.film]);
  if (!facts) throw new Error(`${item.title} is not an Exact film — \`isocan exact film <app> <route>\` makes one`);
  const at = Number(ms);
  const min = facts.at[0] ?? facts.from, max = facts.at.at(-1) ?? min;
  if (!Number.isFinite(at) || at < min || at > max) throw new Error(`the film runs ${min}–${max} ms; ${ms} is not on it`);
  const body = words.join(" ").trim();
  if (!body) throw new Error("say something: isocan exact moment <film> <ms> <words…>");
  const threadId = id("thr");
  const x = Math.round(((at - min) / Math.max(1, max - min)) * (item.width - 24)) + 12;
  await host.sendOp(ctx, canvas.id, { type: "thread.create", threadId, x, y: Math.round(item.height - 24), anchorItemId: item.id, comment: { id: id("cmt"), body, at: Math.round(at) / 1000 } } as Operation, id("exact-moment"));
  if (ctx.json) return host.printJson({ threadId, itemId: item.id, at: Math.round(at) / 1000, ms: Math.round(at) });
  console.log(`commented on ${item.title} at ${Math.round(at)} ms (${threadId})`);
}

/** What `stories.ts` runs Exact and posts with: this file's own bridge and upsert. */
const kit: Kit = { bridge, upsert, appOf };

/**
 * **`isocan exact run <app> <test>`** (exact phase 5; design §9): the test's
 * storyboard run on each host named — Exact's own `test <host>`, a frame per
 * step — each run kept as the storyboard's next version, the failing step red
 * with Exact's reason and the driver's tree.
 */
export async function runTest(host: CliHost, given: string, test: string, opts: RunOptions, cmd: Command): Promise<void> {
  const ctx = await host.ctxOf(cmd);
  const app = appDir(given);
  const canvas = await host.resolveCanvas(ctx);
  const hosts = parseHosts(opts.hosts);
  const sim = opts.sim ?? null;
  if (sim !== null && !UDID.test(sim)) throw new Error(`--sim takes a simulator's UDID, not ${JSON.stringify(sim)}`);
  if (hosts.includes("ios") && !sim) throw new Error("iOS runs on a simulator of your own, by UDID: --sim <udid> (never a booted one somebody else may own)");
  const info = await appOf(app);
  const snapshot = await ctx.client.snapshot(canvas.id);
  const stories = Object.values(snapshot.canvas.items).filter((i) => core.appIdOf(i) === info.id && i.properties?.[core.EXACT_PROPS.test] === test && (!opts.file || i.properties?.[core.EXACT_PROPS.testFile] === opts.file));
  if (stories.length === 0) throw new Error(`no storyboard of a test named "${test}" for ${info.name} on this canvas — \`isocan exact open <app>\` posts one per test`);
  if (stories.length > 1) throw new Error(`"${test}" is a test in ${stories.map((s) => s.properties?.[core.EXACT_PROPS.testFile]).join(" and ")} — name one with --file`);
  const item = storyItemOf(snapshot, info.id, stories[0]!.properties![core.EXACT_PROPS.testFile]!, test)!;
  const out: Array<RunReport & { status: string }> = [];
  for (const on of hosts) {
    if (!ctx.json) console.error(`running "${test}" on ${on} with Exact's own test runner…`);
    const { report, status } = await runOnHost(kit, host, ctx, canvas.id, app, item, on, on === "ios" ? sim : null);
    out.push({ ...report, status });
    if (!ctx.json) console.log(runLine(report));
  }
  if (ctx.json) return host.printJson({ itemId: item.id, test, file: item.properties?.[core.EXACT_PROPS.testFile], runs: out.map((r) => ({ host: r.host, verdict: r.verdict, said: r.said, failed: r.failed ? { line: r.failed.line, reason: r.failed.reason, tree: r.failed.tree?.length ?? 0, reply: r.failed.reply } : null, steps: r.steps.map((s) => ({ line: s.line, state: s.state })), version: r.status, ms: r.ms })) });
  console.log(`${item.id}  storyboard of test "${test}": ${out.length} run${out.length === 1 ? "" : "s"} kept as versions`);
}

/**
 * **`isocan exact verify <app>`** (exact phase 5; design §9): Exact's
 * `verify` on each host (the web and iOS: Exact has no macOS leg), its
 * screenshots posted as versions of the screens they show — the first
 * screen's, by route, host, device and scheme — and the rest named with why.
 */
export async function verifyApp(host: CliHost, given: string, opts: { hosts?: string; sim?: string }, cmd: Command): Promise<void> {
  const ctx = await host.ctxOf(cmd);
  const app = appDir(given);
  const canvas = await host.resolveCanvas(ctx);
  const hosts = parseHosts(opts.hosts ?? "web");
  const sim = opts.sim ?? null;
  if (sim !== null && !UDID.test(sim)) throw new Error(`--sim takes a simulator's UDID, not ${JSON.stringify(sim)}`);
  if (hosts.includes("ios") && !sim) throw new Error("iOS verifies on a simulator of your own, by UDID: --sim <udid>");
  const out: Record<string, VerifyAnswer["hosts"][string]> = {};
  for (const on of hosts) {
    if (on === "macos") { out[on] = { exit: null, problems: null, tests: null, posted: [], unmatched: [], error: "Exact's verify has no macOS leg (`bun exact.mjs verify macos`: \"verify has no leg for it\"); run the storyboards there instead" }; continue; }
    if (!ctx.json) console.error(`verify on ${on}, with Exact's own verify…`);
    out[on] = await verifyOnHost(kit, host, ctx, canvas.id, app, on, on === "ios" ? sim : null);
  }
  if (ctx.json) return host.printJson({ hosts: out });
  for (const [on, h] of Object.entries(out)) {
    if (h.error) { console.log(`${on.padEnd(6)} ${h.error}`); continue; }
    console.log(`${on.padEnd(6)} verify exit ${h.exit}, ${h.problems ?? "?"} problems; tests ${h.tests ? `${h.tests.passed} passed, ${h.tests.failed} failed` : "none"}`);
    for (const f of h.tests?.failing ?? []) console.log(`  failing: ${f}`);
    for (const p of h.posted) console.log(`  ${p.itemId}  ${p.shot} (${p.status})`);
    for (const u of h.unmatched) console.log(`  not placed: ${u.shot} — ${u.why}`);
  }
}
