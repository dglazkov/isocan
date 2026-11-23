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

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DaemonClient } from "@isocan/api";
import {
  newCanvasId,
  newCommentId,
  newThreadId,
  type Actor,
  type AgentActionVerb,
} from "@isocan/core";
import { HOUSE_HANDLE, parseHouseMeta } from "@isocan/core/house-agent";
import { startDaemon, type Daemon } from "@isocan/server/daemon";
import {
  HouseAgent,
  createFakeModelAdapter,
  createInMemoryHostedHouseRunner,
} from "../src/index.ts";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    const fn = cleanups.pop()!;
    await fn().catch(() => {});
  }
});

async function setupDaemonCanvas() {
  const home = await mkdtemp(path.join(tmpdir(), "isocan-house-test-"));
  const daemon: Daemon = await startDaemon({ port: 0, home });
  cleanups.push(async () => {
    await daemon.close();
    await rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  const address = daemon.app.server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const base = `http://127.0.0.1:${port}`;
  const client = new DaemonClient(base, home);
  const humanClaim = await client.claimActor({
    type: "actor.claim",
    sessionKey: `test:human:${Date.now()}`,
    name: "Alex",
  });
  const houseClaim = await client.claimActor({
    type: "actor.claim",
    sessionKey: `test:house:${Date.now()}`,
    name: HOUSE_HANDLE,
  });
  const human: Actor = humanClaim.envelope.actor;
  const houseActor: Actor = houseClaim.envelope.actor;
  const canvasId = newCanvasId();

  await client.sendOp(null, human, {
    type: "project.create",
    canvasId,
    title: "House Test Canvas",
  });

  return { base, home, client, human, houseActor, canvasId };
}

describe("HouseAgent end-to-end against real daemon", () => {
  it("posts 0ms future-tense ack, transitions reading -> writing -> done, creates item with CommentReceipt and PlanView", async () => {
    const { client, human, houseActor, canvasId } = await setupDaemonCanvas();

    const threadId = newThreadId();
    await client.sendOp(canvasId, human, {
      type: "thread.create",
      threadId,
      x: 0,
      y: 0,
      anchorItemId: null,
      main: true,
      comment: {
        id: newCommentId(),
        body: "Add a welcome card to the canvas",
      },
    });

    // Spy on presence action transitions sent by HouseAgent.
    const recordedActions: AgentActionVerb[] = [];
    const origUpdateSession = client.updateSession.bind(client);
    client.updateSession = async (cid, sid, patch) => {
      if (patch.action) recordedActions.push(patch.action);
      return origUpdateSession(cid, sid, patch);
    };

    // Spy on sendOp to verify the 0ms instantAck was posted BEFORE the model finished.
    let sawInstantAckBeforeModel = false;
    let modelCalled = false;
    const adapter = createFakeModelAdapter(async ({ graph }) => {
      modelCalled = true;
      const snap = await client.snapshot(canvasId);
      const comments = snap.canvas.threads[threadId]?.comments ?? [];
      const ackComment = comments.find((c) => c.author.id === houseActor.id);
      if (ackComment) {
        const parsed = parseHouseMeta(ackComment.body);
        if (
          parsed.body.startsWith("I'll ") &&
          !parsed.body.toLowerCase().includes("thinking") &&
          parsed.meta?.goal?.state === "running"
        ) {
          sawInstantAckBeforeModel = true;
        }
      }
      expect(graph.canvas.title).toBe("House Test Canvas");
      return {
        reply: "Added the welcome card.",
        thoughtTrace: ["Inspected context graph", "Placed card in free region"],
        plan: {
          title: "Welcome card",
          steps: [
            { id: "s1", label: "Read context", state: "done" },
            { id: "s2", label: "Create Welcome Card", state: "done" },
          ],
        },
        ops: [
          {
            kind: "item.add",
            title: "Welcome Card",
            text: "# Welcome\n\nHello from @house.",
          },
        ],
      };
    });

    const agent = new HouseAgent({
      client,
      canvasId,
      actor: houseActor,
      modelAdapter: adapter,
    });
    const result = await agent.runOnce();
    await agent.stop();

    expect(modelCalled).toBe(true);
    expect(sawInstantAckBeforeModel).toBe(true);
    expect(result.status).toBe("completed");
    if (result.status === "completed") {
      expect(result.receipts).toHaveLength(1);
    }

    // Honest presence transitions: idle -> reading -> writing -> done
    expect(recordedActions).toContain("reading");
    expect(recordedActions).toContain("writing");
    expect(recordedActions).toContain("done");

    const snap = await client.snapshot(canvasId);
    const items = Object.values(snap.canvas.items);
    expect(items.some((i) => i.title === "Welcome Card")).toBe(true);

    const comments = snap.canvas.threads[threadId]?.comments ?? [];
    const updatedAck = comments.find((c) => c.author.id === houseActor.id && parseHouseMeta(c.body).meta?.plan);
    expect(updatedAck).toBeDefined();
    const parsedMeta = parseHouseMeta(updatedAck!.body).meta;
    expect(parsedMeta?.plan?.title).toBe("Welcome card");
    expect(parsedMeta?.thoughtTrace).toHaveLength(2);
    expect(parsedMeta?.goal?.state).toBe("done");

    const receiptComment = comments.find((c) => Boolean(c.receipt));
    expect(receiptComment?.receipt?.itemId).toBeDefined();
    expect(receiptComment?.receipt?.toVersionId).toBeDefined();
  });

  it("yields cleanly when a BYO agent already holds @house", async () => {
    const { base, home, client, houseActor, canvasId } = await setupDaemonCanvas();
    const byoClient = new DaemonClient(base, home);
    const byoClaim = await byoClient.claimActor({
      type: "actor.claim",
      sessionKey: `test:byo:${Date.now()}`,
      name: "gemini-cli",
    });
    const byoActor: Actor = byoClaim.envelope.actor;
    await byoClient.createSession(canvasId, byoActor, "BYO @house", "gemini-cli", "cli", "house");

    const agent = new HouseAgent({
      client,
      canvasId,
      actor: houseActor,
      modelAdapter: createFakeModelAdapter(() => ({ reply: "Should not run" })),
    });
    const result = await agent.runOnce();
    expect(result).toEqual({
      status: "yielded",
      holderActorId: byoActor.id,
      holderHandle: "house",
    });
  });

  it("scrubs API keys in plain-language failure replies", async () => {
    const { client, human, houseActor, canvasId } = await setupDaemonCanvas();
    const threadId = newThreadId();
    await client.sendOp(canvasId, human, {
      type: "thread.create",
      threadId,
      x: 0,
      y: 0,
      anchorItemId: null,
      main: true,
      comment: { id: newCommentId(), body: "Try something" },
    });

    const fakeSecret = ["sk-ant-", "api03-fakeonly", "0123456789abcdef"].join("");
    const agent = new HouseAgent({
      client,
      canvasId,
      actor: houseActor,
      modelAdapter: createFakeModelAdapter(() => {
        throw new Error(`Request failed with key=${fakeSecret}`);
      }),
    });

    const result = await agent.runOnce();
    await agent.stop();
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.summary).not.toContain(fakeSecret);
      expect(result.summary).toContain("[redacted]");
    }
  });

  it("enforces per-canvas turn and token budgets in HostedHouseRunner", async () => {
    let turns = 0;
    const runner = createInMemoryHostedHouseRunner({
      budget: { maxTurns: 1, maxTokens: 100 },
      onSummon: async () => {
        turns += 1;
        return { tokensUsed: 60 };
      },
    });

    const first = await runner.summon("prj_1", {
      threadId: "thr_1",
      prompt: "Create card",
      estimatedTokens: 60,
    });
    expect(first.status).toBe("completed");
    expect(turns).toBe(1);

    const second = await runner.summon("prj_1", {
      threadId: "thr_1",
      prompt: "Another turn",
      estimatedTokens: 50,
    });
    expect(second.status).toBe("budget-exceeded");
    expect(turns).toBe(1);

    const st = await runner.status("prj_1");
    expect(st.state).toBe("budget-exceeded");

    const rel = await runner.release("prj_1");
    expect(rel.released).toBe(true);
  });
});
