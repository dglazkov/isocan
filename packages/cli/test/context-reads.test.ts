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

import { afterEach, expect, it, vi } from "vitest";
import { Command } from "commander";
import { CanvasHandle } from "@isocan/api";
import { groupFixture } from "../../api/test/group-fixture.ts";
import type { Ctx } from "../src/ctx.ts";
import { registerContextReads } from "../src/context-reads.ts";

afterEach(() => { vi.restoreAllMocks(); process.exitCode = 0; });
it("parses saved request and byte-page commands against production API and frozen reducer state", async () => {
  const f = groupFixture();
  const ctx = { client: f.client, actor: f.actor, canvasRef: f.state.project.id, json: true } as unknown as Ctx;
  const handle = new CanvasHandle(ctx, f.state.project);
  const group = (await f.api.new("Acme context")).itemId!;
  const card = await handle.add({ title: "Acme card", content: "Original bytes", mime: "text/markdown", in: group });
  const posted = await handle.ask("Read?", { in: group });
  await handle.remove(group);
  const count = f.writes.length;
  const outputs: string[] = [];
  vi.spyOn(console, "log").mockImplementation((value) => { outputs.push(String(value)); });
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const run = async (...args: string[]) => {
    outputs.length = 0;
    const program = new Command().option("--json");
    registerContextReads(program.command("context"), async () => ctx);
    await program.parseAsync(["node", "isocan", ...args]);
    return outputs.length ? JSON.parse(outputs.join("\n")) : null;
  };
  expect((await run("--json", "context", "request", posted.threadId, posted.commentId)).expandedIds).toEqual([group, card.id]);
  expect(await run("context", "content", posted.threadId, posted.commentId, card.id, "--limit", "8")).toMatchObject({ data: "Original", nextOffset: 8, versionId: card.currentVersionId });
  await run("context", "content", posted.threadId, posted.commentId, card.id, "--face", "wrong");
  // `error: ` because the family fails through `run` now, like every verb (cleanup TS-5).
  expect(errors).toHaveBeenCalledWith("error: --face expects source or visual");
  expect(f.writes).toHaveLength(count);
});
