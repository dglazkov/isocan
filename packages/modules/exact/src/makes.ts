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
import type { Command } from "commander";
import type { CliHost } from "@isocan/cli/modulehost";
import { COLOUR_LITERAL, parseFlow, scaffold } from "./make.ts";
import { loadTargetTokens, targetTokens } from "./systems.ts";
import type { Kit } from "./stories.ts";

/**
 * **`isocan exact make <app> <flow.json>`** (exact phase 9; journey Scene 8):
 * the flow `isocan wire links --json` printed, made a Contract scaffold
 * (`make.ts`, deterministic), committed by the bridge on a new branch of the
 * app's repository, and captured beside the current screens as phase 6
 * captures any branch — the proposal. Merging the branch is the person's
 * accept; nothing here touches their checkout.
 */
export interface MakeOptions { canvas?: string; hosts?: string; sim?: string }

export async function makeVerb(kit: Kit, host: CliHost, app: string, flowPath: string, opts: MakeOptions, cmd: Command): Promise<void> {
  const ctx = await host.ctxOf(cmd);
  const canvas = await host.resolveCanvas(ctx);
  const flow = parseFlow(await fs.readFile(path.resolve(flowPath), "utf8"));
  const info = await kit.appOf(app);
  const snapshot = await ctx.client.snapshot(canvas.id);
  await loadTargetTokens(ctx, canvas.id, snapshot, info.id);
  const tokens = targetTokens(snapshot, info.id);
  if (!tokens) throw new Error(`${info.name}'s design is not on this canvas — \`isocan exact open ${app}\` first: the scaffold draws with its tokens`);
  const s = scaffold(flow, { contract: await fs.readFile(path.join(app, "app.contract"), "utf8"), ts: await fs.readFile(path.join(app, "app.ts"), "utf8"), tokens });
  const own = s.files[Object.keys(s.files).find((f) => f.endsWith(".contract") && f !== "app.contract" && !f.endsWith(".test.contract"))!]!;
  if (COLOUR_LITERAL.test(own)) throw new Error("the scaffold names a colour of its own: refused (design §13's rule, Scene 8)");
  const r = await kit.bridge<{ ok: boolean; branch?: string; commit?: string; error?: string }>(host, "make-branch", ["--app", app, "--job", await job(s)], "the scaffold's branch", ctx.json);
  if (!r.ok) throw new Error(r.error ?? "the scaffold was not committed");
  if (!ctx.json) {
    console.log(`${r.branch} @ ${r.commit?.slice(0, 8)}  the ${s.flow} flow made Exact: ${s.routes.map((x) => `${x.name} "${x.pattern}"`).join(", ")}`);
    console.log(`  test "${s.test}": ${s.arrows.join("; ")}`);
    console.error("capturing the branch beside the current screens…");
  }
  const { branchVerb } = await import("./branch.ts");
  await branchVerb(kit, host, app, r.branch!, { ...(opts.canvas ? { canvas: opts.canvas } : {}), ...(opts.hosts ? { hosts: opts.hosts } : {}), ...(opts.sim ? { sim: opts.sim } : {}), devices: "phone", schemes: "light" }, cmd);
  if (!ctx.json) console.log(`merge ${r.branch} to accept it (a person's step); then \`isocan exact run ${app} "${s.test}"\` runs its test`);

  async function job(x: typeof s): Promise<string> {
    const file = path.join(await fs.mkdtemp(path.join((await import("node:os")).tmpdir(), "isocan-exact-make-job-")), "job.json");
    await fs.writeFile(file, JSON.stringify({ branch: x.branch, files: x.files, message: `Make it Exact: the ${x.flow} flow from its wireframes (isocan exact make)\n\n${x.routes.map((y) => `${y.name} "${y.pattern}" ← wireframe ${y.screen}`).join("\n")}\ntest "${x.test}": ${x.arrows.join("; ")}` }));
    return file;
  }
}
