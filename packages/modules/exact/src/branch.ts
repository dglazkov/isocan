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
import os from "node:os";
import path from "node:path";
import type { Command } from "commander";
import type { Item } from "@isocan/core";
import type { CliHost } from "@isocan/cli/modulehost";
import type { Readings } from "./core.ts";
import { core } from "./core-ref.ts";
import { buildIndex } from "./build.ts";
import { DEVICES, parseShots, shotsText, type Device, type Scheme } from "./map.ts";
import { NATIVE_DEVICE, parseHosts, type Host } from "./hosts.ts";
import type { Kit } from "./stories.ts";

/**
 * **Structural changes from an agent's branch, captured beside the current**
 * (exact phase 6; design §10). A new component or a route is Contract an
 * agent writes on a branch, not a Tamber proposal. `isocan exact branch <app>
 * <ref|dir>` stages that branch's tree in a directory of the bridge's own
 * (`git archive`, or a worktree the person named — never their checkout),
 * captures every route there, and posts each screen beside the current one of
 * the same route, host, device and scheme, marked `exact.branch`. A route the
 * branch adds has no current screen and goes in a row of its own; one it takes
 * away is named. Branch screens carry no `exact.route`, so the map, live and
 * every ask leave them alone.
 */

/** On a branch screen: where it came from and which current screen it stands beside. */
export interface BranchMark { ref: string; commit: string | null; route: string; host: string; device: string; scheme: string; beside: string | null; sha256: string }

export function parseBranchMark(text: string | undefined): BranchMark | null {
  if (!text) return null;
  try { const v = JSON.parse(text) as BranchMark; return v && typeof v.ref === "string" && typeof v.route === "string" ? v : null; } catch { return null; }
}

interface Box { x: number; y: number; width: number; height: number }

/**
 * **Where each branch screen goes**: the current map's own place, moved right
 * by the map's width and a gap, so the two read side by side; a route only
 * the branch has, in a row under both, at the size its device is drawn.
 */
export function branchPlacement(current: readonly Box[], wants: ReadonlyArray<{ key: string; beside: Box | null; size: { width: number; height: number } }>): Map<string, Box> {
  const out = new Map<string, Box>();
  const minX = Math.min(...current.map((b) => b.x), 0), maxX = Math.max(...current.map((b) => b.x + b.width), 0), maxY = Math.max(...current.map((b) => b.y + b.height), 0);
  const dx = maxX - minX + 400;
  let nx = minX + dx;
  for (const w of wants) {
    if (w.beside) out.set(w.key, { x: w.beside.x + dx, y: w.beside.y, width: w.beside.width, height: w.beside.height });
    else { out.set(w.key, { x: nx, y: maxY + 240, width: w.size.width, height: w.size.height }); nx += w.size.width + 40; }
  }
  return out;
}

export interface BranchOptions { canvas?: string; hosts?: string; sim?: string; devices?: string; schemes?: string }

export async function branchVerb(kit: Kit, host: CliHost, given: string, ref: string, opts: BranchOptions, cmd: Command): Promise<void> {
  const ctx = await host.ctxOf(cmd);
  const app = path.resolve(given);
  const canvas = await host.resolveCanvas(ctx);
  const hosts = parseHosts(opts.hosts);
  if (hosts.includes("ios") && !opts.sim) throw new Error("iOS captures run on a simulator you made for this: --sim <udid>");
  const devices = (opts.devices ?? "phone").split(",").map((d) => d.trim()).filter(Boolean) as Device[];
  const schemes = (opts.schemes ?? "light").split(",").map((d) => d.trim()).filter(Boolean) as Scheme[];
  for (const d of devices) if (!(d in DEVICES)) throw new Error(`--devices takes phone, tablet, desktop, not ${d}`);
  const staged = await kit.bridge<{ staging: string; commit: string | null; ref: string }>(host, "stage-branch", ["--app", app, "--ref", ref], "staging the branch", ctx.json);
  const readings = await kit.bridge<Readings>(host, "read", ["--app", staged.staging], "reading the branch", true);
  const index = buildIndex(readings);
  const appId = (await kit.appOf(app)).id;
  if (index.app.id !== appId) throw new Error(`the branch is the app ${index.app.id}, not ${appId}`);
  let snapshot = await ctx.client.snapshot(canvas.id);
  const currentScreens = Object.values(snapshot.canvas.items).filter((i) => core.appIdOf(i) === appId && i.properties?.[core.EXACT_PROPS.route]);
  const currentRoutes = [...new Set(currentScreens.map((i) => i.properties![core.EXACT_PROPS.route]!))];

  interface Want { key: string; route: string; host: Host; device: Device; scheme: Scheme; shots: string; beside: Item | null }
  const wants: Want[] = [];
  for (const route of index.routes) {
    const primary = core.screenItemOf(snapshot.canvas, appId, route.name);
    for (const h of hosts) for (const device of h === "web" ? devices : [NATIVE_DEVICE[h]]) for (const scheme of schemes) {
      const beside = core.screenItemOf(snapshot.canvas, appId, route.name, device, scheme, h);
      const text = beside?.properties?.[core.EXACT_PROPS.reached] ?? primary?.properties?.[core.EXACT_PROPS.shots] ?? `at "${core.routeLocation(route)}"`;
      wants.push({ key: `${route.name}/${h}/${device}/${scheme}`, route: route.name, host: h, device, scheme, shots: shotsText(parseShots(text)), beside });
    }
  }
  const jobs: Array<{ host: Host; url: string; ops: string[]; shots: Array<{ size: string; scheme: Scheme }>; wants: Want[] }> = [];
  for (const w of wants) {
    let job = jobs.find((j) => j.host === w.host && shotsText({ url: j.url, ops: j.ops }) === w.shots);
    if (!job) { const s = parseShots(w.shots); job = { host: w.host, url: s.url, ops: s.ops, shots: [], wants: [] }; jobs.push(job); }
    job.shots.push({ size: `${DEVICES[w.device].width}x${DEVICES[w.device].height}`, scheme: w.scheme });
    job.wants.push(w);
  }
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-exact-branch-"));
  try {
    const jobsFile = path.join(dir, "jobs.json");
    await fs.writeFile(jobsFile, JSON.stringify(jobs.map(({ host: h, url, ops, shots }) => ({ host: h, url, ops, shots }))));
    const r = await kit.bridge<{ shots: Array<{ job: number; index: number; file: string; sha256: string; png?: { width: number; height: number } | null }> }>(host, "capture", ["--app", staged.staging, "--dir", dir, "--jobs", jobsFile, ...(opts.sim ? ["--sim", opts.sim] : [])], "the branch's screenshots", true);
    snapshot = await ctx.client.snapshot(canvas.id);
    const sizeOf = (w: Want) => {
      const like = currentScreens.find((i) => (i.properties?.[core.EXACT_PROPS.host] ?? "web") === w.host && (i.properties?.[core.EXACT_PROPS.device] ?? "phone") === w.device);
      return like ? { width: like.width, height: like.height } : { width: Math.round(DEVICES[w.device].width / 2), height: Math.round(DEVICES[w.device].height / 2) };
    };
    const places = branchPlacement(currentScreens, wants.map((w) => ({ key: w.key, beside: w.beside, size: sizeOf(w) })));
    const group = `exact-branch_${Math.random().toString(36).slice(2, 10)}`;
    const posted: Array<{ key: string; itemId: string; status: string; beside: string | null }> = [];
    for (const [j, job] of jobs.entries()) {
      for (const [i, w] of job.wants.entries()) {
        const shot = r.shots.find((s) => s.job === j && s.index === i);
        if (!shot) continue;
        const existing = Object.values(snapshot.canvas.items).find((it) => { const m = parseBranchMark(it.properties?.[core.EXACT_PROPS.branch]); return !!m && core.appIdOf(it) === appId && m.ref === ref && `${m.route}/${m.host}/${m.device}/${m.scheme}` === w.key; }) ?? null;
        const mark: BranchMark = { ref, commit: staged.commit, route: w.route, host: w.host, device: w.device, scheme: w.scheme, beside: w.beside?.id ?? null, sha256: shot.sha256 };
        const at = places.get(w.key)!;
        const p = await kit.upsert(host, ctx, canvas.id, snapshot, existing,
          { bytes: await fs.readFile(shot.file), mime: "image/png", filename: `${w.route}-${w.host}-${w.device}-${w.scheme}-${ref.replace(/[^A-Za-z0-9]+/g, "-")}.png` },
          { title: `${index.app.name} · ${w.route} — branch ${ref}${w.beside ? "" : " (new route)"}`, width: at.width, height: at.height, properties: { [core.EXACT_PROPS.app]: JSON.stringify({ id: appId }), [core.EXACT_PROPS.branch]: JSON.stringify(mark) }, at: { x: at.x, y: at.y } },
          group);
        posted.push({ key: w.key, itemId: p.itemId, status: p.status, beside: w.beside?.id ?? null });
      }
    }
    const added = index.routes.map((x) => x.name).filter((n) => !currentRoutes.includes(n));
    const gone = currentRoutes.filter((n) => !index.routes.some((x) => x.name === n));
    if (ctx.json) return host.printJson({ ref, commit: staged.commit, staging: staged.staging, posted, added, gone });
    for (const p of posted) console.log(`${p.itemId}  ${p.key.padEnd(34)} ${p.status.padEnd(12)} ${p.beside ? `beside ${p.beside}` : "new route"}`);
    console.log(`branch ${ref}${staged.commit ? ` (${staged.commit.slice(0, 8)})` : ""}: ${posted.length} screens beside the current; routes added ${added.join(", ") || "none"}, gone ${gone.join(", ") || "none"}`);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
