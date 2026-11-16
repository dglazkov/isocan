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
import type { Item, NewVersion, Operation } from "@isocan/core";
import type { CliHost } from "@isocan/cli/modulehost";
import { core } from "./core-ref.ts";
import { parsePersonaRun, personaSummary, type PersonaRun } from "./persona.ts";
import type { Kit } from "./stories.ts";

const id = (prefix: string): string => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
const P = () => core.EXACT_PROPS;

export interface PersonaOptions { goal?: string; do?: string[]; note?: string; reached?: boolean; stuck?: boolean; at?: string; host?: string; sim?: string; canvas?: string }

interface PersonaReport { ok: boolean; first: { frame: string; sha256: string } | null; steps: Array<{ op: string; ok: boolean; said: string | null; frame: string | null; sha256: string | null }>; error?: string }

/**
 * **`isocan exact persona <app> <name> --goal … --do … --reached|--stuck
 * --note …`** — a persona's path, recorded. Run by the persona itself, after
 * it found its way with `bun exact.mjs agent web …`: the bridge replays the
 * steps in one cold driver session (a frame per step), the filmstrip lands
 * beside the map as an image whose versions are the frames, the note is
 * pinned on it, and the app's summary card is rewritten from every run.
 */
export async function personaVerb(kit: Kit, host: CliHost, app: string, name: string, opts: PersonaOptions, cmd: Command): Promise<void> {
  const ctx = await host.ctxOf(cmd);
  const canvas = await host.resolveCanvas(ctx);
  const goal = (opts.goal ?? "").trim(), note = (opts.note ?? "").trim();
  if (!goal) throw new Error("a persona run says its goal: --goal \"buy a mug for under $20\"");
  if (!note) throw new Error("a persona run says, in its own words, what happened: --note \"…\" (where it got stuck, or how it got there)");
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
    const r = await kit.bridge<PersonaReport>(host, "persona", ["--app", app, "--dir", path.join(dir, "out"), "--job", job, ...(opts.sim ? ["--sim", opts.sim] : [])], "the persona's path", ctx.json);
    if (!r.ok || !r.first) throw new Error(`the path could not be replayed: ${r.error}`);
    const versions: NewVersion[] = [];
    const put = async (file: string, label: string) => {
      const b = await ctx.client.uploadBlob(canvas.id, await fs.readFile(file), "image/png", path.basename(file));
      const v: NewVersion = { id: id("ver"), blobHash: b.blobHash, mimeType: "image/png", filename: `${name.toLowerCase().replace(/ /g, "-")}-${label}.png`, size: b.size };
      versions.push(v);
      return v.id;
    };
    const first = await put(r.first.frame, "00-start");
    const steps = [];
    for (const [i, s] of r.steps.entries()) steps.push({ op: s.op, ok: s.ok, said: s.said, frame: s.frame ? await put(s.frame, `${String(i + 1).padStart(2, "0")}`) : null });
    const broke = steps.findIndex((s) => !s.ok);
    const run: PersonaRun = { name, goal, verdict: opts.reached ? "reached" : "stuck", note, by: ctx.actor.name, host: where, url, first, steps, broke: broke < 0 ? null : broke, at: new Date().toISOString() };
    const snapshot = await ctx.client.snapshot(canvas.id);
    const index = core.indexItemOf(snapshot.canvas, info.id);
    const runs = Object.values(snapshot.canvas.items).filter((i) => core.appIdOf(i) === info.id && parsePersonaRun(i.properties?.[P().persona]));
    const base = index ? { x: index.x - 1400, y: index.y } : { x: 0, y: 0 };
    const itemId = id("itm"), group = id("exact-persona");
    const [v0, ...rest] = versions;
    const width = 160 + 200 * (steps.length + 1);
    await host.sendOp(ctx, canvas.id, {
      type: "item.add", itemId, version: v0!, width: Math.min(width, 2400), height: 520,
      placement: { x: base.x, y: base.y + runs.length * 600, chosen: true },
      title: `${name}: ${goal} — ${run.verdict}`.slice(0, 160),
      properties: { [P().app]: JSON.stringify({ id: info.id }), [P().persona]: JSON.stringify(run) },
      ...(snapshot.project.groupMode === "groups" ? { containerId: null, groupPlacement: "exact" as const } : {}),
    } as Operation, group);
    for (const v of rest) await host.sendOp(ctx, canvas.id, { type: "item.addVersion", itemId, version: v }, group);
    // The note, pinned where the path ended: on the last frame's place in the strip.
    const last = steps.length;
    await host.sendOp(ctx, canvas.id, { type: "thread.create", threadId: id("thr"), x: Math.round(Math.min(width, 2400) * (last + 0.5) / (steps.length + 1)), y: 40, anchorItemId: itemId, comment: { id: id("cmt"), body: `${name} (${run.verdict}): ${note}` } } as Operation, group);
    // The summary card, from every run of the app.
    const all = [...runs.map((i) => parsePersonaRun(i.properties[P().persona])!), run];
    const summary = Object.values(snapshot.canvas.items).find((i) => core.appIdOf(i) === info.id && i.properties?.[P().persona] === "summary") ?? null;
    const md = personaSummary(info.name, all);
    await kit.upsert(host, ctx, canvas.id, snapshot, summary as Item | null, { bytes: Buffer.from(md), mime: "text/markdown", filename: "personas.md" },
      { title: `Personas on ${info.name}`, width: 900, height: 200 + 60 * all.length, properties: { [P().app]: JSON.stringify({ id: info.id }), [P().persona]: "summary" }, at: { x: base.x, y: base.y - 400 } }, group);
    if (ctx.json) return host.printJson({ itemId, run });
    console.log(`${itemId}  ${name}: ${run.verdict} after ${steps.length} steps${run.broke !== null ? `; the driver could not do step ${run.broke + 1} (${steps[run.broke]!.op}): ${steps[run.broke]!.said}` : ""}`);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
