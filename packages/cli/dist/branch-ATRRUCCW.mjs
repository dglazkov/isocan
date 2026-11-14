import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  DEVICES,
  NATIVE_DEVICE,
  buildIndex,
  parseHosts,
  parseShots,
  shotsText
} from "./chunk-Y5UR3HVE.mjs";
import {
  core
} from "./chunk-QSPCCLE6.mjs";
import "./chunk-VMZRQO4Z.mjs";
import "./chunk-GUY4UN4O.mjs";
import "./chunk-K4TDP4L5.mjs";
import "./chunk-JYOOXWJZ.mjs";

// packages/modules/exact/src/branch.ts
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
function parseBranchMark(text) {
  if (!text) return null;
  try {
    const v = JSON.parse(text);
    return v && typeof v.ref === "string" && typeof v.route === "string" ? v : null;
  } catch {
    return null;
  }
}
function branchPlacement(current, wants) {
  const out = /* @__PURE__ */ new Map();
  const minX = Math.min(...current.map((b) => b.x), 0), maxX = Math.max(...current.map((b) => b.x + b.width), 0), maxY = Math.max(...current.map((b) => b.y + b.height), 0);
  const dx = maxX - minX + 400;
  let nx = minX + dx;
  for (const w of wants) {
    if (w.beside) out.set(w.key, { x: w.beside.x + dx, y: w.beside.y, width: w.beside.width, height: w.beside.height });
    else {
      out.set(w.key, { x: nx, y: maxY + 240, width: w.size.width, height: w.size.height });
      nx += w.size.width + 40;
    }
  }
  return out;
}
async function branchVerb(kit, host, given, ref, opts, cmd) {
  const ctx = await host.ctxOf(cmd);
  const app = path.resolve(given);
  const canvas = await host.resolveCanvas(ctx);
  const hosts = parseHosts(opts.hosts);
  if (hosts.includes("ios") && !opts.sim) throw new Error("iOS captures run on a simulator you made for this: --sim <udid>");
  const devices = (opts.devices ?? "phone").split(",").map((d) => d.trim()).filter(Boolean);
  const schemes = (opts.schemes ?? "light").split(",").map((d) => d.trim()).filter(Boolean);
  for (const d of devices) if (!(d in DEVICES)) throw new Error(`--devices takes phone, tablet, desktop, not ${d}`);
  const staged = await kit.bridge(host, "stage-branch", ["--app", app, "--ref", ref], "staging the branch", ctx.json);
  const readings = await kit.bridge(host, "read", ["--app", staged.staging], "reading the branch", true);
  const index = buildIndex(readings);
  const appId = (await kit.appOf(app)).id;
  if (index.app.id !== appId) throw new Error(`the branch is the app ${index.app.id}, not ${appId}`);
  let snapshot = await ctx.client.snapshot(canvas.id);
  const currentScreens = Object.values(snapshot.canvas.items).filter((i) => core.appIdOf(i) === appId && i.properties?.[core.EXACT_PROPS.route]);
  const currentRoutes = [...new Set(currentScreens.map((i) => i.properties[core.EXACT_PROPS.route]))];
  const wants = [];
  for (const route of index.routes) {
    const primary = core.screenItemOf(snapshot.canvas, appId, route.name);
    for (const h of hosts) for (const device of h === "web" ? devices : [NATIVE_DEVICE[h]]) for (const scheme of schemes) {
      const beside = core.screenItemOf(snapshot.canvas, appId, route.name, device, scheme, h);
      const text = beside?.properties?.[core.EXACT_PROPS.reached] ?? primary?.properties?.[core.EXACT_PROPS.shots] ?? `at "${core.routeLocation(route)}"`;
      wants.push({ key: `${route.name}/${h}/${device}/${scheme}`, route: route.name, host: h, device, scheme, shots: shotsText(parseShots(text)), beside });
    }
  }
  const jobs = [];
  for (const w of wants) {
    let job = jobs.find((j) => j.host === w.host && shotsText({ url: j.url, ops: j.ops }) === w.shots);
    if (!job) {
      const s = parseShots(w.shots);
      job = { host: w.host, url: s.url, ops: s.ops, shots: [], wants: [] };
      jobs.push(job);
    }
    job.shots.push({ size: `${DEVICES[w.device].width}x${DEVICES[w.device].height}`, scheme: w.scheme });
    job.wants.push(w);
  }
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-exact-branch-"));
  try {
    const jobsFile = path.join(dir, "jobs.json");
    await fs.writeFile(jobsFile, JSON.stringify(jobs.map(({ host: h, url, ops, shots }) => ({ host: h, url, ops, shots }))));
    const r = await kit.bridge(host, "capture", ["--app", staged.staging, "--dir", dir, "--jobs", jobsFile, ...opts.sim ? ["--sim", opts.sim] : []], "the branch's screenshots", true);
    snapshot = await ctx.client.snapshot(canvas.id);
    const sizeOf = (w) => {
      const like = currentScreens.find((i) => (i.properties?.[core.EXACT_PROPS.host] ?? "web") === w.host && (i.properties?.[core.EXACT_PROPS.device] ?? "phone") === w.device);
      return like ? { width: like.width, height: like.height } : { width: Math.round(DEVICES[w.device].width / 2), height: Math.round(DEVICES[w.device].height / 2) };
    };
    const places = branchPlacement(currentScreens, wants.map((w) => ({ key: w.key, beside: w.beside, size: sizeOf(w) })));
    const group = `exact-branch_${Math.random().toString(36).slice(2, 10)}`;
    const posted = [];
    for (const [j, job] of jobs.entries()) {
      for (const [i, w] of job.wants.entries()) {
        const shot = r.shots.find((s) => s.job === j && s.index === i);
        if (!shot) continue;
        const existing = Object.values(snapshot.canvas.items).find((it) => {
          const m = parseBranchMark(it.properties?.[core.EXACT_PROPS.branch]);
          return !!m && core.appIdOf(it) === appId && m.ref === ref && `${m.route}/${m.host}/${m.device}/${m.scheme}` === w.key;
        }) ?? null;
        const mark = { ref, commit: staged.commit, route: w.route, host: w.host, device: w.device, scheme: w.scheme, beside: w.beside?.id ?? null, sha256: shot.sha256 };
        const at = places.get(w.key);
        const p = await kit.upsert(
          host,
          ctx,
          canvas.id,
          snapshot,
          existing,
          { bytes: await fs.readFile(shot.file), mime: "image/png", filename: `${w.route}-${w.host}-${w.device}-${w.scheme}-${ref.replace(/[^A-Za-z0-9]+/g, "-")}.png` },
          { title: `${index.app.name} \xB7 ${w.route} \u2014 branch ${ref}${w.beside ? "" : " (new route)"}`, width: at.width, height: at.height, properties: { [core.EXACT_PROPS.app]: JSON.stringify({ id: appId }), [core.EXACT_PROPS.branch]: JSON.stringify(mark) }, at: { x: at.x, y: at.y } },
          group
        );
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
export {
  branchPlacement,
  branchVerb,
  parseBranchMark
};
