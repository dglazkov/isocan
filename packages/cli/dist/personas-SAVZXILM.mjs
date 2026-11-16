import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  core
} from "./chunk-QSPCCLE6.mjs";
import "./chunk-JYOOXWJZ.mjs";

// packages/modules/exact/src/personas.ts
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

// packages/modules/exact/src/persona.ts
function parsePersonaRun(text) {
  if (!text) return null;
  try {
    const v = JSON.parse(text);
    return v && typeof v.name === "string" && Array.isArray(v.steps) && (v.verdict === "reached" || v.verdict === "stuck") ? v : null;
  } catch {
    return null;
  }
}
function personaSummary(app, runs) {
  const shared = runs.length > 1 ? runs[0].steps.map((s) => s.op).filter((op) => runs.every((r) => r.steps.some((s) => s.op === op))) : [];
  const stuck = runs.filter((r) => r.verdict === "stuck");
  return [
    `# Personas on ${app}`,
    "",
    `${runs.length} run${runs.length === 1 ? "" : "s"}: ${runs.filter((r) => r.verdict === "reached").length} reached the goal, ${stuck.length} got stuck. Each filmstrip is the persona's own path, replayed on Exact's driver; each note is the persona's own words.`,
    "",
    "| Persona | Goal | Verdict | Steps | Note |",
    "| --- | --- | --- | --- | --- |",
    ...runs.map((r) => `| ${r.name} | ${r.goal.replace(/\|/g, "/")} | ${r.verdict}${r.broke !== null ? ` (the driver could not do step ${r.broke + 1}: \`${r.steps[r.broke].op}\`)` : ""} | ${r.steps.length} | ${r.note.replace(/\|/g, "/").replace(/\n/g, " ")} |`),
    "",
    shared.length ? `Where they agreed: every persona took ${shared.map((s) => `\`${s}\``).join(", ")}.` : "Where they agreed: no step was common to every run.",
    ...stuck.length ? ["", `Where they got stuck: ${stuck.map((r) => `${r.name} \u2014 ${r.note.replace(/\n/g, " ").replace(/[.\s]+$/, "")}`).join("; ")}.`] : [],
    ""
  ].join("\n");
}

// packages/modules/exact/src/personas.ts
var id = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
var P = () => core.EXACT_PROPS;
async function personaVerb(kit, host, app, name, opts, cmd) {
  const ctx = await host.ctxOf(cmd);
  const canvas = await host.resolveCanvas(ctx);
  const goal = (opts.goal ?? "").trim(), note = (opts.note ?? "").trim();
  if (!goal) throw new Error('a persona run says its goal: --goal "buy a mug for under $20"');
  if (!note) throw new Error('a persona run says, in its own words, what happened: --note "\u2026" (where it got stuck, or how it got there)');
  if (!!opts.reached === !!opts.stuck) throw new Error("say whether the goal was reached: --reached or --stuck");
  if (!/^[A-Z][A-Za-z ]{0,30}$/.test(name)) throw new Error(`a persona's name is a capitalised word or two, not ${JSON.stringify(name)}`);
  const ops = opts.do ?? [];
  const info = await kit.appOf(app);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-exact-persona-"));
  try {
    const job = path.join(dir, "job.json");
    const url = opts.at ?? "/";
    const where = opts.host === "ios" ? "ios" : "web";
    await fs.writeFile(job, JSON.stringify({ host: where, url, ops }));
    const r = await kit.bridge(host, "persona", ["--app", app, "--dir", path.join(dir, "out"), "--job", job, ...opts.sim ? ["--sim", opts.sim] : []], "the persona's path", ctx.json);
    if (!r.ok || !r.first) throw new Error(`the path could not be replayed: ${r.error}`);
    const versions = [];
    const put = async (file, label) => {
      const b = await ctx.client.uploadBlob(canvas.id, await fs.readFile(file), "image/png", path.basename(file));
      const v = { id: id("ver"), blobHash: b.blobHash, mimeType: "image/png", filename: `${name.toLowerCase().replace(/ /g, "-")}-${label}.png`, size: b.size };
      versions.push(v);
      return v.id;
    };
    const first = await put(r.first.frame, "00-start");
    const steps = [];
    for (const [i, s] of r.steps.entries()) steps.push({ op: s.op, ok: s.ok, said: s.said, frame: s.frame ? await put(s.frame, `${String(i + 1).padStart(2, "0")}`) : null });
    const broke = steps.findIndex((s) => !s.ok);
    const run = { name, goal, verdict: opts.reached ? "reached" : "stuck", note, by: ctx.actor.name, host: where, url, first, steps, broke: broke < 0 ? null : broke, at: (/* @__PURE__ */ new Date()).toISOString() };
    const snapshot = await ctx.client.snapshot(canvas.id);
    const index = core.indexItemOf(snapshot.canvas, info.id);
    const runs = Object.values(snapshot.canvas.items).filter((i) => core.appIdOf(i) === info.id && parsePersonaRun(i.properties?.[P().persona]));
    const base = index ? { x: index.x - 1400, y: index.y } : { x: 0, y: 0 };
    const itemId = id("itm"), group = id("exact-persona");
    const [v0, ...rest] = versions;
    const width = 160 + 200 * (steps.length + 1);
    await host.sendOp(ctx, canvas.id, {
      type: "item.add",
      itemId,
      version: v0,
      width: Math.min(width, 2400),
      height: 520,
      placement: { x: base.x, y: base.y + runs.length * 600, chosen: true },
      title: `${name}: ${goal} \u2014 ${run.verdict}`.slice(0, 160),
      properties: { [P().app]: JSON.stringify({ id: info.id }), [P().persona]: JSON.stringify(run) },
      ...snapshot.project.groupMode === "groups" ? { containerId: null, groupPlacement: "exact" } : {}
    }, group);
    for (const v of rest) await host.sendOp(ctx, canvas.id, { type: "item.addVersion", itemId, version: v }, group);
    const last = steps.length;
    await host.sendOp(ctx, canvas.id, { type: "thread.create", threadId: id("thr"), x: Math.round(Math.min(width, 2400) * (last + 0.5) / (steps.length + 1)), y: 40, anchorItemId: itemId, comment: { id: id("cmt"), body: `${name} (${run.verdict}): ${note}` } }, group);
    const all = [...runs.map((i) => parsePersonaRun(i.properties[P().persona])), run];
    const summary = Object.values(snapshot.canvas.items).find((i) => core.appIdOf(i) === info.id && i.properties?.[P().persona] === "summary") ?? null;
    const md = personaSummary(info.name, all);
    await kit.upsert(
      host,
      ctx,
      canvas.id,
      snapshot,
      summary,
      { bytes: Buffer.from(md), mime: "text/markdown", filename: "personas.md" },
      { title: `Personas on ${info.name}`, width: 900, height: 200 + 60 * all.length, properties: { [P().app]: JSON.stringify({ id: info.id }), [P().persona]: "summary" }, at: { x: base.x, y: base.y - 400 } },
      group
    );
    if (ctx.json) return host.printJson({ itemId, run });
    console.log(`${itemId}  ${name}: ${run.verdict} after ${steps.length} steps${run.broke !== null ? `; the driver could not do step ${run.broke + 1} (${steps[run.broke].op}): ${steps[run.broke].said}` : ""}`);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
export {
  personaVerb
};
