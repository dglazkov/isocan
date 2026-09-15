import { normalizeHomeUrl } from "@isocan/core";
import { sameDesignArtifact } from "@isocan/core/design-partner-plan";
import type { DesignArtifactRef } from "@isocan/core/design-partner";
import { designRequestBasisCurrent } from "@isocan/core/design-request";
import { readDesignRequests, readDesignRequestReference, type DesignRequestReadPort } from "./design-request-reader.ts";
import { projectDesignSystem, type DesignSystemTarget } from "./design-system-reader.ts";
import { craftContextFiles, craftFile, craftHash, craftSemantic, parseDesignCraftPacket, type DesignCraftPacket, type DesignCraftStage } from "./design-craft-packet.ts";
import { designCraftRevision, designCraftSources } from "./design-craft-guidance.ts";
export { parseDesignCraftPacket, type DesignCraftPacket, type DesignCraftStage } from "./design-craft-packet.ts";

/** Reads optional adapted knowledge around one canonical request without enrollment, questions or writes. */
export async function readDesignCraft(io: DesignRequestReadPort, options: { canvasId: string; requestId: string; stage: DesignCraftStage; signal?: AbortSignal }): Promise<DesignCraftPacket> {
  if (!["new-work", "critique", "finish"].includes(options.stage)) throw new Error("Choose new-work, critique or finish explicitly.");
  const { canvasId, requestId, signal } = options;
  const [read, snapshot, rawHome] = await Promise.all([readDesignRequests(io, { canvasId, filter: { requestId }, ...(signal ? { signal } : {}) }), io.snapshot(canvasId, signal), io.home(canvasId, signal)]);
  const row = read.requests.find(one => one.brief.requestId === requestId);
  if (!row) throw new Error(read.unavailable.map(one => one.reason).join("; ") || "No readable admitted design request has this identity.");
  const home = normalizeHomeUrl(rawHome), brief = row.brief;
  // Identity DTOs can carry private/person metadata; the packet deliberately exports only public attribution.
  const author = (value: { id: string; name: string }) => ({ id: value.id, name: value.name });
  const target: DesignSystemTarget = brief.targetItemId ? { kind: "item", itemId: brief.targetItemId } : brief.groupId ? { kind: "group", groupId: brief.groupId } : { kind: "canvas" };
  const reasons = [...row.reasons];
  let governing: DesignCraftPacket["governing"] = row.governing.status === "available" ? { status: "unavailable", reason: "The governing projection has not been read." } : { status: row.governing.status, reason: row.governing.reason };
  if (row.governing.status === "available") {
    try {
      const projection = await projectDesignSystem(io, { canvasId, target, ...(signal ? { signal } : {}) });
      if (!sameDesignArtifact(projection.source, row.governing.artifact)) throw new Error("The governing selection changed while the packet was read.");
      governing = { status: "available", projection, author: author(row.governing.author) };
    } catch (error) { signal?.throwIfAborted(); governing = { status: "unavailable", reason: error instanceof Error ? error.message : String(error) }; }
  }
  const cited: Array<{ artifact: DesignArtifactRef; roles: string[] }> = [];
  const add = (artifact: DesignArtifactRef, role: string) => { const old = cited.find(one => sameDesignArtifact(one.artifact, artifact)); if (old) { if (!old.roles.includes(role)) old.roles.push(role); } else cited.push({ artifact, roles: [role] }); };
  for (const ref of row.contextReferences) add(ref, "context");
  for (const ref of brief.references) if (ref.artifact) add(ref.artifact, "reference");
  for (const fact of brief.facts) for (const ref of fact.sources) add(ref, "fact");
  for (const decision of row.effectiveDecisions) { add(decision.decision.adopted, "decision"); for (const ref of decision.decision.input.basis.alternatives) add(ref, "alternative"); }
  for (const id of brief.outputIds) {
    const item = snapshot.canvas.items[id], version = item?.versions.find(one => one.id === item.currentVersionId);
    if (version) add({ home, canvasId, itemId: id, versionId: version.id, blobHash: version.blobHash }, "output");
    else reasons.push(`Declared output ${id} is unavailable.`);
  }
  if (cited.length > 64) throw new Error("The request exceeds the 64-reference craft packet limit; use the normal exact reference reads.");
  const files: DesignCraftPacket["files"] = [], references: DesignCraftPacket["references"] = [];
  for (const [index, citation] of cited.entries()) {
    try {
      const content = await readDesignRequestReference(io, { canvasId, requestId, artifact: citation.artifact, ...(signal ? { signal } : {}) });
      const name = content.version.filename.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(-100) || "reference.bin";
      const file = await craftFile(`references/${String(index).padStart(2, "0")}-${name}`, content.bytes, content.version.mimeType);
      files.push(file); references.push({ ...citation, title: content.title, filename: content.version.filename, mimeType: content.version.mimeType, path: file.path, reason: null });
    } catch (error) {
      signal?.throwIfAborted(); const reason = error instanceof Error ? error.message : String(error);
      references.push({ ...citation, title: "Unavailable exact reference", filename: "", mimeType: "", path: null, reason });
      reasons.push(`${citation.artifact.itemId}@${citation.artifact.versionId}: ${reason}`);
    }
  }
  if (governing.status === "unavailable") reasons.push(governing.reason);
  const finalSnapshot = await io.snapshot(canvasId, signal);
  if (finalSnapshot.canvas.items[row.ref.itemId]?.currentVersionId !== row.ref.versionId || references.some(reference => reference.roles.includes("output") && finalSnapshot.canvas.items[reference.artifact.itemId]?.currentVersionId !== reference.artifact.versionId)) reasons.push("The brief or declared output changed while this packet was read; refresh the explicit capture.");
  const limits = ["Adapted guidance only; opening a packet performs no inspection or model call.", "Native playbooks, hooks, overlays, images and native review roles are unsupported and not run.", "Package installation is not inspected by this shared read.", "Existing review obligations and the shared two-repair allowance still apply.", "Supplied URLs are declarations, not downloaded content.", ...(brief.delivery === "connected-app" ? ["Actual repository and runtime inspection must be recorded separately; this packet does not establish their revision or behavior."] : [])];
  const body: Omit<DesignCraftPacket, "packetId" | "files"> = {
    schemaVersion: 1, kind: "craft-packet", mode: "adapted-guidance", revision: designCraftRevision, stage: options.stage,
    status: governing.status === "unavailable" || references.some(one => one.path === null) || reasons.some(one => one.startsWith("Declared output")) ? "unavailable" : row.status === "current" && !reasons.some(one => one.startsWith("The brief or declared output changed")) ? "current" : "stale", reasons: [...new Set(reasons)],
    upstream: { repository: "https://github.com/pbakaus/impeccable", commit: "2149fcce39a90bb409df5f16515f316a76dc6199", skillVersion: "4.3.1", resources: designCraftSources(options.stage) },
    request: { ref: row.ref, brief, author: author(row.author) },
    questions: row.questions.map(q => ({ questions: q.questions, author: author(q.author), status: q.status, outstandingQuestionIds: q.outstandingQuestionIds, responses: q.responses.map(r => ({ response: r.response, author: author(r.author) })) })),
    decisions: row.effectiveDecisions.map(d => ({ input: d.decision.input, comparison: d.decision.comparison, adopted: d.decision.adopted, author: author(d.author), recommendationAuthor: author(d.decision.recommendationAuthor), recommendation: d.decision.comparison.recommendation, status: d.status })),
    governing, references, limits,
    runtimeReports: brief.delivery === "connected-app" ? row.receipts.flatMap(receipt => receipt.receipt.output.kind === "repository" ? [{ receipt: receipt.ref, output: receipt.receipt.output, author: author(receipt.author), status: receipt.status }] : []) : [],
  };
  if (governing.status === "available") { files.push(await craftFile("DESIGN.md", governing.projection.baseText, "text/markdown")); files.push(await craftFile("DESIGN.projection.json", JSON.stringify(governing.projection, null, 2) + "\n", "application/json")); }
  for (const [path, text] of Object.entries(craftContextFiles(body))) files.push(await craftFile(path, text, "text/markdown"));
  const complete = { ...body, files };
  return parseDesignCraftPacket({ ...complete, packetId: await craftHash(craftSemantic(complete)) });
}

/** Rechecks the original complete capture through current permissions, without recapturing beneath local drafts. */
export async function checkDesignCraft(io: DesignRequestReadPort, options: { canvasId: string; requestId: string; packet: unknown; signal?: AbortSignal }): Promise<{ packetId: string; status: "current" | "stale" | "unavailable"; reasons: string[] }> {
  const packet = await parseDesignCraftPacket(options.packet);
  if (packet.request.ref.canvasId !== options.canvasId || packet.request.brief.requestId !== options.requestId) throw new Error("The saved craft packet belongs to another request or canvas.");
  try {
    const current = await readDesignCraft(io, { canvasId: options.canvasId, requestId: options.requestId, stage: packet.stage, ...(options.signal ? { signal: options.signal } : {}) });
    if (current.packetId === packet.packetId) return { packetId: packet.packetId, status: current.status, reasons: current.reasons };
    const states = await io.requests(options.canvasId, options.signal);
    const row = states.requests.find(one => one.brief.requestId === options.requestId);
    // Completion alone may advance the admitted brief. Only the writer-proven edge permits it;
    // exact exported outputs and historical references are still compared without rebasing.
    if (row && current.status === "current" && designRequestBasisCurrent(row, { brief: packet.request.ref, requestId: options.requestId, epoch: packet.request.brief.epoch })) {
      const completion = !sameDesignArtifact(current.request.ref, packet.request.ref);
      if (completion) {
        const snapshot = await io.snapshot(options.canvasId, options.signal);
        const original = snapshot.canvas.items[packet.request.ref.itemId]?.versions.find(version => version.id === packet.request.ref.versionId && version.blobHash === packet.request.ref.blobHash);
        if (!original) return { packetId: packet.packetId, status: "unavailable", reasons: ["Canonical completion is current, but the original packet's version attribution is unavailable. Preserve the packet and working files."] };
        if (craftSemantic({ id: original.createdBy.id, name: original.createdBy.name }) !== craftSemantic(packet.request.author)) return { packetId: packet.packetId, status: "stale", reasons: ["The packet's captured author disagrees with its canonical original version."] };
      }
      const comparable = (one: DesignCraftPacket) => ({
        brief: { ...one.request.brief, progress: "active" }, author: completion ? packet.request.author : one.request.author,
        questions: one.questions.map(question => ({ ...question, status: null })),
        decisions: one.decisions, governing: one.governing, references: one.references, runtimeReports: one.runtimeReports,
        files: one.files.filter(file => file.path.startsWith("references/") || file.path.startsWith("DESIGN.")),
      });
      if (craftSemantic(comparable(packet)) === craftSemantic(comparable(current))) return { packetId: packet.packetId, status: "current", reasons: [] };
    }
    return { packetId: packet.packetId, status: current.status === "unavailable" ? "unavailable" : "stale", reasons: [...current.reasons, "The canonical request, answers, accepted decisions, governing source or exact context differs from the original packet. Export a new capture to a new folder; preserve authored working files."] };
  } catch (error) { options.signal?.throwIfAborted(); return { packetId: packet.packetId, status: "unavailable", reasons: [error instanceof Error ? error.message : String(error)] }; }
}
