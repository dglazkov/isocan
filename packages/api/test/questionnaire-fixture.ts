import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { newCanvasId, type DesignBrief, type DesignQuestionSet } from "@isocan/core";
import { startDaemon, stopDaemons } from "@isocan/server";
import { CanvasHandle, DaemonClient, type Ctx } from "@isocan/api";

/** A real home with a known person and two separate agents; all content is synthetic. */
export async function questionnaireFixture() {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-questionnaire-"));
  const work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-questionnaire-work-"));
  const daemon = await startDaemon({ port: 0, home, birthHome: null });
  const address = daemon.app.server.address();
  if (!address || typeof address === "string") throw new Error("No daemon address");
  const port = address.port, base = `http://127.0.0.1:${port}`, client = new DaemonClient(base, home);
  async function claim(sessionKey: string, name: string): Promise<Ctx> {
    await client.claimActor({ type: "actor.claim", sessionKey, name });
    const actor = (await client.actorBindings([sessionKey]))[0]!.actor;
    return { client, actor, home, harness: sessionKey.split(":")[0]!, birthHome: null, binding: null, homeOf: async () => null, homes: async () => ({ birth: null, links: [], rows: {}, legacy: false, rowFor: () => null }) };
  }
  const person = await claim("cli:acme-person", "Acme Person"), agent = await claim("acme:designer", "Acme Designer"), other = await claim("acme:helper", "Acme Helper");
  const canvasId = newCanvasId();
  await client.sendOp(null, person.actor, { type: "project.create", canvasId, title: "Acme discovery" });
  const record = (await client.snapshot(canvasId)).project;
  const personCanvas = new CanvasHandle(person, record), agentCanvas = new CanvasHandle(agent, record), otherCanvas = new CanvasHandle(other, record);
  const original = await personCanvas.notify("Create an inventory screen for receiving stock.");
  const brief: DesignBrief = { schemaVersion: 1, kind: "brief", requestId: "req_acme_inventory", epoch: 1, requestingActorId: person.actor.id, source: { entrance: "canvas-chat", threadId: original.threadId, commentId: original.commentId }, progress: "active", intent: "create", fidelity: "designed", delivery: "html-node", targetItemId: null, groupId: null, audience: "Receiving staff", primaryTask: "Receive and confirm stock", constraints: ["Works on a phone"], facts: [], context: await personCanvas.context(), references: [], outstandingDecisionIds: ["workflow"], outputIds: [] };
  const briefItem = await agentCanvas.add({ title: "Acme design brief", content: JSON.stringify(brief), mime: "application/json" });
  const version = briefItem.versions.find(v => v.id === briefItem.currentVersionId)!;
  const questions: DesignQuestionSet = { schemaVersion: 1, kind: "questions", requestId: brief.requestId, epoch: 1, id: "qset_acme_workflow", revision: 1, brief: { home: base, canvasId, itemId: briefItem.id, versionId: version.id, blobHash: version.blobHash }, respondentActorId: person.actor.id, headline: "Choose the receiving flow", inferredAnswers: [], supersedes: null, questions: [{ id: "workflow", title: "When should staff review stock?", consequence: "Changes the confirmation step.", renderer: "choice-list", options: [{ id: "batch", title: "Review a batch", consequence: "Fewer repeated taps." }, { id: "item", title: "Review every item", consequence: "Catch errors immediately." }], multiple: false, skippable: true, delegatable: true }] };
  return { home, work, daemon, port, base, client, person, agent, other, personCanvas, agentCanvas, otherCanvas, canvasId, original, brief, briefItem, questions,
    async close() {
      await daemon.close().catch(() => {});
      await stopDaemons(port, home).catch(() => {});
      await Promise.all([home, work].map(dir => fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })));
    },
  };
}
