import { resolveActor, type Operation, type PostOpResponse } from "@isocan/core";
import { parseDesignArtifactRef, type DesignArtifactRef, type DesignReceipt } from "@isocan/core/design-partner";
import { sameDesignArtifact } from "@isocan/core/design-partner-plan";
import { readDesignRequests } from "./design-request-reader.ts";
import type { DesignChangeRequest, DesignPublishRequest } from "./design-request-reader.ts";
import { captureDesignRepair, prepareDesignRepair, type PreparedDesignRepair, type PreparedDesignRepairPort } from "./design-repair-reader.ts";
import { designAuditInput, readCanvasDesignAudit, auditDesignSource, readDesignSourceAudit } from "./design-audit-reader.ts";
import { readDesignReviews, designReviewSemantic, type DesignReviewReadPort, type DesignReviewView } from "./design-review-reader.ts";
import { DESIGN_REVIEW_PROPERTY, parseDesignReviewRun, parseDesignVerifierOffer, parseDesignReviewOutput, parseDesignReviewObservations, type DesignReviewRun, type DesignReviewObligation, type DesignReviewObservation, type DesignReviewFinding, type DesignVerifierOffer } from "./design-review-contract.ts";
import { questionnaireFailureStatus } from "./questionnaire-reader.ts";

/** Generic ordinary writes retain a writer receipt and original actor, rather than a local optimistic acknowledgement. */
export interface DesignReviewWritePort extends DesignReviewReadPort {
  uploadReview(canvasId: string, text: string, filename: string, signal?: AbortSignal): Promise<{ blobHash: string; size: number }>;
  sendReview(canvasId: string, operation: Operation, options: { opId: string; originGroupMode: "groups" | "legacy"; signal?: AbortSignal }): Promise<{ status: "accepted"; receipt: PostOpResponse } | { status: "pending" | "refused"; reason: string; code?: string }>;
}
/** Pure persisted envelope: text, actor and complete ordinary operation are immutable across uncertain delivery. */
export interface PreparedDesignReviewWrite { schemaVersion: 1; canvasId: string; actorId: string; opId: string; originGroupMode: "groups" | "legacy"; text: string | null; operation: Extract<Operation, { type: "item.add" | "item.edit" | "thread.reply" | "thread.create" }>; handoff?: { runId: string; offer: DesignArtifactRef } }
/** Acceptance survives unavailable post-save reads; consistency does not rewrite operation history. */
export interface DesignReviewSubmission { status: "accepted" | "pending" | "refused"; submittedOpId: string; opId: string | null; seq?: number; reason?: string; consistency?: { status: "current" | "stale" | "unavailable"; reasons: string[] } }
/** One reservation's stable IDs are generated before work and persist through every retry. */
export interface DesignReviewWriteIds { opId: string; versionId: string }
/** Actual observation input excludes source facts: this path executes the shared source analyzer itself. */
export interface DesignReviewRecordInput { outcome: "reviewed" | "invalid" | "noop"; note: string; observations: DesignReviewObservation[]; findings: DesignReviewFinding[]; output?: DesignReceipt["output"]; repositorySource?: { text: string; path: string; designText?: string; designPath?: string } }
/** A start identifies an admitted task, actual delivery and concrete obligations, with explicit linked rerun intent. */
export interface DesignReviewStartInput extends DesignReviewWriteIds { canvasId: string; requestId: string; runId: string; itemId: string; passId: string; sessionId: string; output: DesignReceipt["output"]; obligations: DesignReviewObligation[]; mode?: "review" | "audit-only"; preceding?: { run: DesignArtifactRef; reason: string }; signal?: AbortSignal }
/** Each append binds the exact shared version seen by its caller, preventing competing reservations. */
export interface DesignReviewStepInput extends DesignReviewWriteIds { canvasId: string; runId: string; base: DesignArtifactRef; action: "record" | "begin-repair" | "finish"; passId?: string; sessionId?: string; record?: DesignReviewRecordInput; signal?: AbortSignal }
const same = (a: unknown, b: unknown) => designReviewSemantic(a) === designReviewSemantic(b);
const textError = (error: unknown) => error instanceof Error ? error.message : String(error);
function ids(value: DesignReviewWriteIds): void { if (!/^op_[A-Za-z0-9_-]{1,32}$/.test(value.opId) || !/^ver_[A-Za-z0-9_-]{1,32}$/.test(value.versionId)) throw new Error("Review writes need valid stable operation and version IDs."); }
async function documentWrite(io: DesignReviewWritePort, options: { canvasId: string; itemId: string; opId: string; versionId: string; report: DesignReviewRun | DesignVerifierOffer; base?: DesignArtifactRef; signal?: AbortSignal }): Promise<PreparedDesignReviewWrite> {
  ids(options); if (!io.actorId) throw new Error("A review write needs the actual named actor.");
  const report = options.report.kind === "review-run" ? parseDesignReviewRun(options.report) : parseDesignVerifierOffer(options.report);
  const text = JSON.stringify(report, null, 2), filename = report.kind === "review-run" ? "design-review.json" : "design-verifier.json";
  const input = await designAuditInput(text, { kind: "file", label: filename }), snapshot = await io.snapshot(options.canvasId, options.signal);
  const version = { id: options.versionId, blobHash: input.sha256, size: input.size, filename, mimeType: "application/json" };
  let operation: PreparedDesignReviewWrite["operation"];
  if (options.base) {
    const item = snapshot.canvas.items[options.itemId];
    if (!item || item.currentVersionId !== options.base.versionId || item.versions.find(one => one.id === item.currentVersionId)?.blobHash !== options.base.blobHash) throw new Error("The shared run changed before this append was prepared.");
    operation = { type: "item.edit", itemId: item.id, version, patch: {}, expectedVersionId: options.base.versionId, expectedMetadata: { title: item.title, properties: structuredClone(item.properties) } };
  } else operation = { type: "item.add", itemId: options.itemId, version, width: 420, height: 280, containerId: null, placement: { x: 80, y: 80, chosen: true }, title: report.kind === "review-run" ? `Design review: ${report.id}` : `Verifier: ${report.id}`, description: "Authored review evidence; not a daemon quality assertion.", properties: { [DESIGN_REVIEW_PROPERTY]: report.kind === "review-run" ? "run-v1" : "offer-v1", "design.review.request": report.kind === "review-run" ? report.request.requestId : report.requestId, "design.review.run": report.kind === "review-run" ? report.id : report.runId } };
  return { schemaVersion: 1, canvasId: options.canvasId, actorId: io.actorId, opId: options.opId, originGroupMode: snapshot.project.groupMode === "groups" ? "groups" : "legacy", text, operation };
}

/** Reserve one initial inspection after reading shared history; a rerun needs an explicit prior run and reason. */
export async function prepareDesignReviewStart(io: DesignReviewWritePort, options: DesignReviewStartInput): Promise<PreparedDesignReviewWrite> {
  const [read, history] = await Promise.all([readDesignRequests(io, { canvasId: options.canvasId, filter: { requestId: options.requestId }, ...(options.signal ? { signal: options.signal } : {}) }), readDesignReviews(io, { canvasId: options.canvasId, requestId: options.requestId, ...(options.signal ? { signal: options.signal } : {}) })]);
  if (history.unavailable.length) throw new Error("Prior review history is unavailable; do not start with a fresh counter.");
  if (history.runs.length && (!options.preceding || !history.runs.some(one => sameDesignArtifact(one.ref, options.preceding!.run)) || !options.preceding.reason.trim())) throw new Error("A new review requires an explicit preceding run and reason; automatic repair cannot restart its budget.");
  if (history.runs.some(one => one.run.id === options.runId)) throw new Error("This review run ID already exists; resume its shared state.");
  const request = read.requests.find(one => one.brief.requestId === options.requestId);
  if (!request || request.status !== "current" || request.brief.progress !== "active") throw new Error("Review start needs the current active admitted task.");
  const output = parseDesignReviewOutput(options.output);
  if ((request.brief.delivery === "connected-app") !== (output.kind === "repository")) throw new Error("The review output must match the admitted delivery; a prototype cannot replace the connected runtime.");
  const binding = { brief: request.ref, requestId: request.brief.requestId, epoch: request.brief.epoch };
  let basis: DesignReviewRun["basis"];
  if (output.kind === "canvas") {
    if (!request.brief.outputIds.includes(output.artifact.itemId) && request.brief.targetItemId !== output.artifact.itemId) throw new Error("The review output is not this task's declared output or target.");
    const capture = await captureDesignRepair(io, { canvasId: options.canvasId, itemId: output.artifact.itemId, request: binding, ...(options.signal ? { signal: options.signal } : {}) });
    if (!sameDesignArtifact(capture.repair.target.artifact, output.artifact)) throw new Error("The review output moved before its initial reservation.");
    basis = { target: capture.repair.target, governing: capture.repair.governing, context: request.contextReferences, ruleVersion: capture.repair.ruleVersion };
  } else { const { DESIGN_AUDIT_VERSION } = await import("@isocan/core/design-audit"); if (request.governing.status === "unavailable") throw new Error(request.governing.reason); basis = { target: null, governing: request.governingBinding, context: request.contextReferences, ruleVersion: DESIGN_AUDIT_VERSION }; }
  const report: DesignReviewRun = { schemaVersion: 1, kind: "review-run", id: options.runId, request: binding, preceding: options.preceding ?? null, mode: options.mode ?? "review", basis, obligations: options.obligations, passes: [{ id: options.passId, kind: "initial", reservedAt: new Date().toISOString(), sessionId: options.sessionId, reservationVersionId: options.versionId, output, record: null }], finished: null };
  return documentWrite(io, { ...options, report });
}

/** Record real native observations, reserve bounded repair work, or close this authored report against one captured version. */
export async function prepareDesignReviewStep(io: DesignReviewWritePort, options: DesignReviewStepInput): Promise<PreparedDesignReviewWrite> {
  const read = await readDesignReviews(io, { canvasId: options.canvasId, runId: options.runId, ...(options.signal ? { signal: options.signal } : {}) });
  const view = read.runs.find(one => one.run.id === options.runId && sameDesignArtifact(one.ref, options.base));
  if (!view) throw new Error("The exact shared review version changed; read its current history before progressing.");
  const report = structuredClone(view.run), pass = report.passes.at(-1)!;
  if (options.action === "begin-repair") {
    if (!view.allowedActions.beginRepair || !options.passId || !options.sessionId) throw new Error("This run cannot reserve another repair attempt.");
    report.passes.push({ id: options.passId, kind: "repair", reservedAt: new Date().toISOString(), sessionId: options.sessionId, reservationVersionId: options.versionId, output: structuredClone(pass.output), record: null });
  } else if (options.action === "record") {
    // A canonical repair may advance this reserved pass's output before its observation append.
    const accepted = view.passes.at(-1)!.repairs.filter(one => one.standing === "active" && one.status === "current");
    const onlyRepairDrift = view.reasons.every(r => r === "The inspected output changed; its prior observations remain historical.");
    if ((!view.allowedActions.record && !(onlyRepairDrift && accepted.length === 1 && !pass.record)) || !options.record) throw new Error("This pass is not available for recording; retain its prior history.");
    const record = options.record, observations = parseDesignReviewObservations(record.observations);
    if (accepted.length === 1) pass.output = { kind: "canvas", artifact: accepted[0]!.adopted };
    if (record.output) {
      if (pass.output.kind !== "repository" || record.output.kind !== "repository") { if (!same(record.output, pass.output)) throw new Error("Only the canonical repair history may advance a canvas review output."); }
      else {
        if (pass.kind !== "repair" && !same(record.output, pass.output)) throw new Error("Initial inspection must retain its reserved runtime identity.");
        if (record.output.repository !== pass.output.repository) throw new Error("A repair cannot replace the reserved repository.");
        pass.output = parseDesignReviewOutput(record.output);
      }
    }
    let source: NonNullable<typeof pass.record>["source"] = { kind: "unavailable", reason: "Repository source inspection is unavailable through the canvas analyzer; retain actual repository tool observations separately." };
    if (pass.output.kind === "canvas") {
      const snapshot = await io.snapshot(options.canvasId, options.signal), home = await io.home(options.canvasId, options.signal);
      if (snapshot.canvas.items[pass.output.artifact.itemId]?.currentVersionId !== pass.output.artifact.versionId) throw new Error("The inspected output changed before recording.");
      const report = await readCanvasDesignAudit(io, { canvasId: options.canvasId, canvas: snapshot.canvas, home, itemIds: [pass.output.artifact.itemId], ...(options.signal ? { signal: options.signal } : {}) });
      source = { kind: "canvas-audit", reportJson: JSON.stringify(report) };
    }
    if (pass.output.kind === "repository" && record.repositorySource) {
      const input = record.repositorySource;
      const snapshot = await io.snapshot(options.canvasId, options.signal), home = await io.home(options.canvasId, options.signal);
      const audit = input.designText !== undefined ? await auditDesignSource(input.text, input.designText, { label: input.path, designLabel: input.designPath ?? "DESIGN.md" }) : await readDesignSourceAudit(io, { canvasId: options.canvasId, canvas: snapshot.canvas, home, text: input.text, label: input.path, ...(report.basis.governing.atItemId ? { atId: report.basis.governing.atItemId } : {}), ...(options.signal ? { signal: options.signal } : {}) });
      source = { kind: "repository-audit", reportJson: JSON.stringify(audit), repository: pass.output.repository, revision: pass.output.revision, path: input.path };
    }
    pass.record = { outcome: record.outcome, note: record.note, source, observations, findings: record.findings };
  } else {
    if (!view.allowedActions.finish) throw new Error("Record this pass before finishing the review.");
    report.finished = { status: view.ready ? "ready" : "draft", limits: [...view.readings.limits, ...view.ready ? [] : [...view.readings.missingObligationIds.map(id => `Required observation ${id} did not pass.`), ...["source", "task", "craft"].filter(key => view.readings[key as "source" | "task" | "craft"] !== "passed").map(key => `${key} inspection is ${view.readings[key as "source" | "task" | "craft"]}.`), ...pass.record!.findings.filter(f => f.severity === "critical").map(f => f.description)]] };
  }
  return documentWrite(io, { ...options, itemId: options.base.itemId, report });
}

/** A positive verifier offer names the caller's actually live session and an immutable run/output scope. */
export async function prepareDesignVerifierOffer(io: DesignReviewWritePort, options: { canvasId: string; itemId: string; opId: string; versionId: string; offer: DesignVerifierOffer; signal?: AbortSignal }): Promise<PreparedDesignReviewWrite> {
  const offer = parseDesignVerifierOffer(options.offer), snapshot = await io.snapshot(options.canvasId, options.signal), sessions = await io.sessions(options.canvasId, options.signal);
  const actors = await io.decisionActors(options.canvasId, options.signal);
  if (!io.actorId || !actors.actors.some(a => a.kind === "agent" && resolveActor(snapshot.joined, a.id) === resolveActor(snapshot.joined, io.actorId!)) || !sessions.some(s => s.kind !== "web" && s.sessionId === offer.sessionId && resolveActor(snapshot.joined, s.actor.id) === resolveActor(snapshot.joined, io.actorId!))) throw new Error("A verifier offer must name an actual native agent's live session.");
  const now = Date.now(); if (Date.parse(offer.observedAt) > now || Date.parse(offer.expiresAt) <= now) throw new Error("Probe the actual tool before offering current verification.");
  return documentWrite(io, { ...options, report: offer });
}

/** Handoff is one addressed ordinary comment; it never records an inspection or replenishes its budget. */
export async function prepareDesignReviewHandoff(io: DesignReviewWritePort, options: { canvasId: string; runId: string; offer: DesignArtifactRef; threadId: string; commentId: string; opId: string; signal?: AbortSignal }): Promise<PreparedDesignReviewWrite> {
  const read = await readDesignReviews(io, { canvasId: options.canvasId, runId: options.runId, ...(options.signal ? { signal: options.signal } : {}) }), offer = read.offers.find(one => sameDesignArtifact(one.ref, options.offer));
  const run = read.runs.find(one => one.run.id === options.runId);
  if (!offer?.eligible || !run?.allowedActions.handoff || !io.actorId) throw new Error("No current authorized verifier offer matches this run/output.");
  const snapshot = await io.snapshot(options.canvasId, options.signal);
  const body = `Please verify design review ${run.run.id}.\nExact run: ${JSON.stringify(run.ref)}\nOutput: ${JSON.stringify(run.run.passes.at(-1)!.output)}\nRemaining repair attempts: ${run.remainingRepairs}.\nRead isocan design review ${run.run.request.requestId} --run ${run.run.id}; perform the declared native tool inspection and record exact evidence. This request is not a completed check.`;
  const comment = { id: options.commentId, body: `/ask @${offer.author.name} ${body}`, mentions: [offer.author.id] };
  const target = snapshot.canvas.items[run.run.request.brief.itemId];
  if (!target) throw new Error("The admitted brief is unavailable for a verifier handoff.");
  const operation: PreparedDesignReviewWrite["operation"] = snapshot.canvas.threads[options.threadId] ? { type: "thread.reply", threadId: options.threadId, comment } : { type: "thread.create", threadId: options.threadId, anchorItemId: target.id, x: target.x, y: target.y, comment };
  return { schemaVersion: 1, canvasId: options.canvasId, actorId: io.actorId, opId: options.opId, originGroupMode: snapshot.project.groupMode === "groups" ? "groups" : "legacy", text: null, operation, handoff: { runId: run.run.id, offer: offer.ref } };
}

/** Task repairs can use only an already reserved pass and the author's current captured basis. */
export async function prepareDesignReviewRepair(io: DesignReviewWritePort & PreparedDesignRepairPort, options: { canvasId: string; runId: string; base: DesignArtifactRef; text: string; opId: string; versionId: string; repairId: string; signal?: AbortSignal }): Promise<PreparedDesignRepair> {
  const read = await readDesignReviews(io, { canvasId: options.canvasId, runId: options.runId, ...(options.signal ? { signal: options.signal } : {}) }), view = read.runs.find(one => sameDesignArtifact(one.ref, options.base));
  const pass = view?.run.passes.at(-1);
  if (!view || view.status !== "current" || !pass || pass.kind !== "repair" || pass.record || pass.output.kind !== "canvas" || !io.actorId) throw new Error("Reserve an available canvas repair pass before authoring this edit.");
  const basis = await captureDesignRepair(io, { canvasId: options.canvasId, itemId: pass.output.artifact.itemId, request: view.run.request, review: { run: view.ref, runId: view.run.id, passId: pass.id }, ...(options.signal ? { signal: options.signal } : {}) });
  if (!sameDesignArtifact(basis.repair.target.artifact, pass.output.artifact)) throw new Error("The reserved pass's output changed; do not silently rebase its repair.");
  return prepareDesignRepair({ basis, text: options.text, actorId: io.actorId, opId: options.opId, versionId: options.versionId, repairId: options.repairId });
}

/** Completion is its existing separate conditional act, prepared from the run's original active brief. */
export async function prepareDesignReviewCompletion(io: DesignReviewReadPort, options: { canvasId: string; runId: string; base: DesignArtifactRef; opId: string; versionId: string; signal?: AbortSignal }): Promise<DesignChangeRequest> {
  ids(options);
  const read = await readDesignReviews(io, { canvasId: options.canvasId, runId: options.runId, ...(options.signal ? { signal: options.signal } : {}) }), view = read.runs.find(one => sameDesignArtifact(one.ref, options.base));
  if (!view || !view.run.finished || view.status !== "current") throw new Error("Finish the current authored review report before completing its task.");
  return { canvasId: options.canvasId, opId: options.opId, action: { kind: "complete", brief: view.run.request.brief, epoch: view.run.request.epoch, versionId: options.versionId } };
}

/** Publish the independent source/task/craft readings using existing receipt roots and the exact completed brief. */
export async function prepareDesignReviewReceipt(io: DesignReviewReadPort, options: { canvasId: string; runId: string; base: DesignArtifactRef; opId: string; itemId: string; versionId: string; receiptId: string; signal?: AbortSignal }): Promise<DesignPublishRequest> {
  ids(options);
  const read = await readDesignReviews(io, { canvasId: options.canvasId, runId: options.runId, ...(options.signal ? { signal: options.signal } : {}) }), view = read.runs.find(one => sameDesignArtifact(one.ref, options.base));
  if (!view || !view.run.finished || view.status !== "current") throw new Error("The finished review or its exact inputs changed; do not publish a fresh checked claim.");
  const requests = await readDesignRequests(io, { canvasId: options.canvasId, filter: { requestId: view.run.request.requestId }, ...(options.signal ? { signal: options.signal } : {}) });
  const request = requests.requests.find(one => one.ref.itemId === view.run.request.brief.itemId);
  if (!request || request.brief.progress !== "completed") throw new Error("Canonical task completion must be confirmed before receipt publication.");
  const pass = view.run.passes.at(-1)!, record = pass.record!;
  const checks: DesignReceipt["checks"] = [{ id: "source", kind: "source", tool: "isocan design audit", toolVersion: view.run.basis.ruleVersion, result: view.readings.source === "unsupported" ? "unavailable" : view.readings.source, coverage: view.readings.source === "unsupported" ? `Bounded static source coverage: ${view.readings.limits.join(" ")}` : "Exact authored source analyzer report retained in the review artifact.", state: "source", viewport: null, evidence: [view.ref] }];
  for (const obligation of view.run.obligations) {
    const observation = record.observations.find(one => one.obligationId === obligation.id);
    checks.push({ id: obligation.id, kind: obligation.kind, tool: observation?.tool ?? "unavailable", toolVersion: observation?.toolVersion ?? "unavailable", result: observation?.result ?? "unavailable", coverage: observation ? `${obligation.task}: ${observation.action}; expected ${observation.expected}; observed ${observation.observed}` : `Required ${obligation.task} was not observed.`, state: obligation.state, viewport: obligation.viewport, evidence: observation?.evidence ?? [] });
  }
  const unresolved: DesignReceipt["unresolved"] = [...record.findings.map(f => ({ severity: f.severity, description: `${f.description} ${f.rationale}` })), ...view.run.finished.limits.map(description => ({ severity: "noncritical" as const, description }))];
  return { canvasId: options.canvasId, opId: options.opId, itemId: options.itemId, versionId: options.versionId, receipt: { schemaVersion: 1, kind: "receipt", id: options.receiptId, requestId: view.run.request.requestId, epoch: view.run.request.epoch, brief: request.ref, output: pass.output, context: view.run.basis.context, governing: view.run.basis.governing, fidelity: request.brief.fidelity, status: view.ready && view.run.finished.status === "ready" ? "ready" : "draft", checks, unresolved } };
}

/** Restored journals validate their exact document hash and full supported operation before transport. */
export async function validatePreparedDesignReviewWrite(value: unknown): Promise<PreparedDesignReviewWrite> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid review journal.");
  const p = value as PreparedDesignReviewWrite;
  if (Object.keys(p).some(k => !["schemaVersion", "canvasId", "actorId", "opId", "originGroupMode", "text", "operation", "handoff"].includes(k)) || p.schemaVersion !== 1 || typeof p.canvasId !== "string" || !p.canvasId.trim() || typeof p.actorId !== "string" || !p.actorId.trim() || !/^op_[A-Za-z0-9_-]{1,32}$/.test(p.opId) || !["groups", "legacy"].includes(p.originGroupMode)) throw new Error("Invalid review journal fields.");
  const op = p.operation;
  const keys = (v: object, allowed: string[]) => { if (!v || typeof v !== "object" || Array.isArray(v) || Object.keys(v).some(k => !allowed.includes(k))) throw new Error("Unsupported saved review operation field."); };
  const text = (value: unknown) => typeof value === "string" && !!value.trim();
  const properties = (value: unknown) => !!value && typeof value === "object" && !Array.isArray(value) && Object.values(value).every(one => typeof one === "string");
  if (p.handoff !== undefined) { keys(p.handoff, ["runId", "offer"]); if (!text(p.handoff.runId)) throw new Error("Invalid handoff run identity."); parseDesignArtifactRef(p.handoff.offer); }
  if (op.type === "thread.reply" || op.type === "thread.create") {
    keys(op, op.type === "thread.reply" ? ["type", "threadId", "comment"] : ["type", "threadId", "comment", "anchorItemId", "x", "y"]); keys(op.comment, ["id", "body", "mentions"]);
    if (p.text !== null || typeof op.comment.body !== "string" || !op.comment.body.startsWith("/ask ") || !text(op.comment.id) || !text(op.threadId) || !Array.isArray(op.comment.mentions) || op.comment.mentions.length !== 1 || !op.comment.mentions.every(text) || !p.handoff?.runId) throw new Error("Invalid saved handoff.");
    if (op.type === "thread.create" && (!text(op.anchorItemId) || !Number.isFinite(op.x) || !Number.isFinite(op.y))) throw new Error("Invalid new handoff thread.");
  }
  else if (op.type === "item.add" || op.type === "item.edit") {
    if (p.handoff) throw new Error("A report document cannot carry handoff authority.");
    keys(op, op.type === "item.add" ? ["type", "itemId", "version", "width", "height", "containerId", "placement", "title", "description", "properties"] : ["type", "itemId", "version", "patch", "expectedVersionId", "expectedMetadata"]);
    keys(op.version, ["id", "blobHash", "size", "filename", "mimeType"]);
    if (!text(op.itemId) || !text(op.version.id) || !text(op.version.filename)) throw new Error("Invalid saved review identity.");
    if (op.type === "item.edit") { keys(op.patch, []); if (!op.expectedMetadata) throw new Error("A review edit needs its captured metadata."); keys(op.expectedMetadata, ["title", "properties"]); if (!text(op.expectedVersionId) || typeof op.expectedMetadata.title !== "string" || !properties(op.expectedMetadata.properties)) throw new Error("Invalid saved review metadata capture."); }
    else { keys(op.placement, ["x", "y", "chosen"]); if (!("x" in op.placement) || op.placement.chosen !== true || ![op.placement.x, op.placement.y, op.width, op.height].every(Number.isFinite) || op.width <= 0 || op.height <= 0 || op.containerId !== null || typeof op.title !== "string" || typeof op.description !== "string" || !properties(op.properties)) throw new Error("Invalid saved review placement or metadata."); }
    if (typeof p.text !== "string") throw new Error("Review journal lost its original document bytes.");
    const value = JSON.parse(p.text); if (value?.kind === "review-run") parseDesignReviewRun(value); else parseDesignVerifierOffer(value);
    const input = await designAuditInput(p.text, { kind: "file", label: op.version.filename });
    if (op.version.blobHash !== input.sha256 || op.version.size !== input.size || op.version.mimeType !== "application/json") throw new Error("Review journal bytes disagree with their frozen operation.");
  } else throw new Error("Unsupported review journal operation.");
  return structuredClone(p);
}
function matchesOperation(actual: Operation, expected: PreparedDesignReviewWrite["operation"]): boolean {
  if (expected.type === "item.add" && actual.type === "group.change" && actual.action.kind === "apply") {
    const created = actual.action.change.writes.filter(one => one.kind === "create");
    if (created.length !== 1 || created[0]!.kind !== "create") return false;
    const item = created[0]!.item, v = item.versions.find(one => one.id === expected.version.id);
    return actual.action.change.writes.length === 1 && item.versions.length === 1 && item.currentVersionId === expected.version.id && item.id === expected.itemId && (item.containerId ?? null) === (expected.containerId ?? null) && item.title === expected.title && item.description === expected.description && same(item.properties, expected.properties) && item.width === expected.width && item.height === expected.height && "x" in expected.placement && item.x === expected.placement.x && item.y === expected.placement.y && !!v && ["id", "blobHash", "mimeType", "filename", "size"].every(k => same(v[k as keyof typeof v], expected.version[k as keyof typeof expected.version]));
  }
  return same(actual, expected);
}

/** Submit only a persisted immutable intent; recover full canonical effects/actors from live and archived receipts. */
export async function submitDesignReviewWrite(io: DesignReviewWritePort, prepared: PreparedDesignReviewWrite, options: { retry?: boolean; signal?: AbortSignal } = {}): Promise<DesignReviewSubmission> {
  const p = await validatePreparedDesignReviewWrite(prepared), result: DesignReviewSubmission = { status: "pending", submittedOpId: p.opId, opId: null };
  let snapshot: Awaited<ReturnType<DesignReviewReadPort["snapshot"]>> | undefined;
  try { snapshot = await io.snapshot(p.canvasId, options.signal); } catch { /* Retry may recover acceptance after the current source vanished. */ }
  const sameActor = (id: string) => id === p.actorId || !!snapshot?.joined && resolveActor(snapshot.joined, id) === resolveActor(snapshot.joined, p.actorId);
  if (!io.actorId || !sameActor(io.actorId)) return { ...result, status: options.retry ? "pending" : "refused", reason: "This immutable review intent belongs to another actor; preserve its journal." };
  const confirms = (receipt: PostOpResponse) => {
    const op = receipt.envelope.op;
    if (op.type === "group.change" && op.action.kind === "apply" && !op.action.change.writes.every(w => w.kind !== "create" || sameActor(w.item.createdBy.id) && w.item.versions.every(v => sameActor(v.createdBy.id)))) return false;
    return receipt.envelope.id === p.opId && receipt.envelope.canvasId === p.canvasId && sameActor(receipt.envelope.actor.id) && matchesOperation(op, p.operation);
  };
  // History lookup precedes upload on retry, including normalized adds after Undo/removal.
  if (options.retry) try { const prior = (await io.history(p.canvasId, options.signal)).find(one => one.envelope.id === p.opId && !one.cause); if (prior) return confirms(prior) ? { ...result, status: "accepted", opId: prior.envelope.id, seq: prior.seq, consistency: { status: "unavailable", reasons: ["Original acceptance recovered; current report consistency must be read separately."] } } : { ...result, status: "refused", reason: "The canonical operation identity belongs to a different full intent or author." }; } catch { /* Do not infer absence from a failed history read. */ }
  if (p.handoff) {
    try { const current = await readDesignReviews(io, { canvasId: p.canvasId, runId: p.handoff.runId, ...(options.signal ? { signal: options.signal } : {}) }); if (!current.runs.some(one => one.run.id === p.handoff!.runId && one.allowedActions.handoff) || !current.offers.some(one => one.eligible && sameDesignArtifact(one.ref, p.handoff!.offer))) throw new Error("The captured run or verifier offer is no longer current, reachable and authorized."); }
    catch (error) { return { ...result, status: options.retry ? "pending" : "refused", reason: textError(error) }; }
  }
  let delivered: Awaited<ReturnType<DesignReviewWritePort["sendReview"]>>;
  try {
    if (p.text !== null && (p.operation.type === "item.add" || p.operation.type === "item.edit")) { const upload = await io.uploadReview(p.canvasId, p.text, p.operation.version.filename, options.signal); if (upload.blobHash !== p.operation.version.blobHash || upload.size !== p.operation.version.size) throw new Error("Uploaded review bytes disagree with the saved intent."); }
    delivered = await io.sendReview(p.canvasId, p.operation, { opId: p.opId, originGroupMode: p.originGroupMode, ...(options.signal ? { signal: options.signal } : {}) });
  } catch (error) { delivered = { status: questionnaireFailureStatus(error), reason: textError(error) }; }
  let accepted = delivered.status === "accepted" && confirms(delivered.receipt) ? delivered.receipt : null;
  if (!accepted) try { accepted = (await io.history(p.canvasId, options.signal)).find(one => one.envelope.id === p.opId && !one.cause && confirms(one)) ?? null; } catch { /* A matching receipt may still establish acceptance. */ }
  if (!accepted) return { ...result, status: delivered.status === "refused" && !options.retry ? "refused" : "pending", reason: delivered.status === "accepted" ? "The writer returned an unrelated receipt; preserve the original intent." : delivered.reason };
  const saved: DesignReviewSubmission = { ...result, status: "accepted", opId: accepted.envelope.id, seq: accepted.seq };
  try { const current = await io.snapshot(p.canvasId, options.signal); const op = p.operation; const exists = op.type === "thread.reply" || op.type === "thread.create" ? current.canvas.threads[op.threadId]?.comments.some(c => c.id === op.comment.id) : current.canvas.items[op.itemId]?.currentVersionId === op.version.id; saved.consistency = { status: exists ? "current" : "stale", reasons: exists ? [] : ["The accepted report or request is no longer current; it was not reapplied."] }; }
  catch (error) { saved.consistency = { status: "unavailable", reasons: [textError(error)] }; }
  return saved;
}
