import { parseDesignArtifactRef, type DesignArtifactRef, type DesignReceipt } from "@isocan/core/design-partner";
import { type DesignRepairInput } from "@isocan/core/design-repair";
import { parseDesignTarget } from "@isocan/core/design-decision";
import { parseDesignGoverning } from "@isocan/core/design-request";
import type { CanvasDesignAudit, SourceDesignAudit } from "./design-audit-reader.ts";

/** Authored run and verifier artifacts use one bounded discovery property; arbitrary JSON is never scanned. */
export const DESIGN_REVIEW_PROPERTY = "design.review";
/** An obligation describes an actual task/state/viewport, independently of a tool's availability. */
export interface DesignReviewObligation { id: string; kind: "browser-task" | "craft"; task: string; state: string; viewport: { width: number; height: number } | null; required: boolean }
/** Observations report executed native tools and retrievable evidence; opening a plan is not an observation. */
export interface DesignReviewObservation { id: string; obligationId: string; tool: string; toolVersion: string; result: "passed" | "failed" | "unavailable"; action: string; expected: string; observed: string; evidence: DesignArtifactRef[] }
/** Craft and task defects retain their own rationale and criticality rather than becoming source diagnostics. */
export interface DesignReviewFinding { id: string; kind: "browser-task" | "craft"; severity: "critical" | "noncritical"; description: string; rationale: string }
/** The existing analyzer's exact serialized report is preserved without inventing another diagnostic schema. */
export type DesignReviewSource = { kind: "canvas-audit"; reportJson: string } | { kind: "repository-audit"; reportJson: string; repository: string; revision: string; path: string } | { kind: "unavailable"; reason: string };
/** A reserved pass counts even when generation yields invalid or unchanged output; records never release it. */
export interface DesignReviewPass {
  id: string; kind: "initial" | "repair"; reservedAt: string; sessionId: string; reservationVersionId: string;
  output: DesignReceipt["output"];
  record: { outcome: "reviewed" | "invalid" | "noop"; note: string; source: DesignReviewSource; observations: DesignReviewObservation[]; findings: DesignReviewFinding[] } | null;
}
/** Ordinary cumulative authored evidence, not a daemon quality assertion or a separate workflow database. */
export interface DesignReviewRun {
  schemaVersion: 1; kind: "review-run"; id: string;
  request: NonNullable<DesignRepairInput["request"]>;
  preceding: { run: DesignArtifactRef; reason: string } | null;
  mode: "review" | "audit-only";
  basis: { target: DesignRepairInput["target"] | null; governing: DesignRepairInput["governing"]; context: DesignArtifactRef[]; ruleVersion: string };
  obligations: DesignReviewObligation[]; passes: DesignReviewPass[];
  finished: { status: "ready" | "draft"; limits: string[] } | null;
}
/** A fresh tool probe offers inspection for this exact request/run and actual session, for at most five minutes. */
export interface DesignVerifierOffer {
  schemaVersion: 1; kind: "verifier-offer"; id: string; requestId: string; runId: string;
  run: DesignArtifactRef; output: DesignReceipt["output"];
  sessionId: string; observedAt: string; expiresAt: string;
  delivery: "canvas" | "repository"; available: boolean; reason: string;
  tools: Array<{ name: string; version: string }>;
}

type Obj = Record<string, unknown>;
function object(value: unknown, keys: readonly string[], label: string): Obj {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  const result = value as Obj;
  if (Object.keys(result).some(key => !keys.includes(key)) || keys.some(key => !(key in result))) throw new Error(`${label} has missing or unsupported fields.`);
  return result;
}
function string(value: unknown, label: string, allowEmpty = false): string { if (typeof value !== "string" || value.length > 1_000_000 || (!allowEmpty && !value.trim())) throw new Error(`${label} must be text.`); return value; }
function list<T>(value: unknown, parse: (v: unknown) => T, max = 100): T[] { if (!Array.isArray(value) || value.length > max) throw new Error("Invalid or excessive review entries."); return value.map(parse); }
function one<T extends string>(value: unknown, choices: readonly T[]): T { if (!choices.includes(value as T)) throw new Error("Unsupported review value."); return value as T; }
function date(value: unknown): string { const text = string(value, "timestamp"); if (!Number.isFinite(Date.parse(text))) throw new Error("Invalid review timestamp."); return text; }
function unique(values: readonly { id: string }[]): void { if (new Set(values.map(one => one.id)).size !== values.length) throw new Error("Review identities must be unique."); }
function viewport(value: unknown): DesignReviewObligation["viewport"] { if (value === null) return null; const v = object(value, ["width", "height"], "viewport"); if (![v.width, v.height].every(n => Number.isInteger(n) && Number(n) > 0 && Number(n) <= 20000)) throw new Error("Invalid viewport."); return { width: Number(v.width), height: Number(v.height) }; }
/** Reuse receipt output identity without accepting a canvas prototype as a connected runtime. */
export function parseDesignReviewOutput(value: unknown): DesignReceipt["output"] {
  if ((value as Obj)?.kind === "canvas") { const v = object(value, ["kind", "artifact"], "output"); return { kind: "canvas", artifact: parseDesignArtifactRef(v.artifact) }; }
  const v = object(value, ["kind", "repository", "revision", "buildId", "runtimeUrl"], "output");
  if (v.kind !== "repository") throw new Error("Unsupported review output.");
  const runtimeUrl = string(v.runtimeUrl, "runtime URL"); if (!["https:", "http:"].includes(new URL(runtimeUrl).protocol)) throw new Error("Runtime URL must use HTTP.");
  return { kind: "repository", repository: string(v.repository, "repository"), revision: string(v.revision, "revision"), buildId: string(v.buildId, "build"), runtimeUrl };
}
function obligation(value: unknown): DesignReviewObligation { const v = object(value, ["id", "kind", "task", "state", "viewport", "required"], "obligation"); if (typeof v.required !== "boolean") throw new Error("Required must be boolean."); const result = { id: string(v.id, "obligation ID"), kind: one(v.kind, ["browser-task", "craft"]), task: string(v.task, "task"), state: string(v.state, "state"), viewport: viewport(v.viewport), required: v.required }; if (result.kind === "browser-task" && !result.viewport) throw new Error("Task obligations need a concrete viewport."); return result; }
/** Validate tool observations before preparing a report write; author identity comes only from its accepted version. */
export function parseDesignReviewObservations(value: unknown): DesignReviewObservation[] {
  const result = list(value, raw => { const v = object(raw, ["id", "obligationId", "tool", "toolVersion", "result", "action", "expected", "observed", "evidence"], "observation"); const row: DesignReviewObservation = { id: string(v.id, "observation ID"), obligationId: string(v.obligationId, "obligation"), tool: string(v.tool, "tool"), toolVersion: string(v.toolVersion, "tool version"), result: one(v.result, ["passed", "failed", "unavailable"]), action: string(v.action, "action"), expected: string(v.expected, "expected result"), observed: string(v.observed, "observed result"), evidence: list(v.evidence, parseDesignArtifactRef) }; if (row.result === "passed" && !row.evidence.length) throw new Error("A passing observation needs actual retained evidence."); return row; }); unique(result); return result;
}
function finding(raw: unknown): DesignReviewFinding { const v = object(raw, ["id", "kind", "severity", "description", "rationale"], "finding"); return { id: string(v.id, "finding ID"), kind: one(v.kind, ["browser-task", "craft"]), severity: one(v.severity, ["critical", "noncritical"]), description: string(v.description, "description"), rationale: string(v.rationale, "rationale") }; }
/** Decode only the existing analyzer envelope; its detailed diagnostic payload stays byte-for-byte available. */
export function designReviewSourceAudit(source: DesignReviewSource): CanvasDesignAudit | SourceDesignAudit | null {
  if (source.kind === "unavailable") return null;
  if (source.kind === "repository-audit") {
    const report = JSON.parse(source.reportJson) as SourceDesignAudit;
    if (!report.input || !/^[a-f0-9]{64}$/.test(report.input.sha256) || report.input.label !== source.path || !["audited", "unavailable"].includes(report.status) || typeof report.ruleVersion !== "string" || report.status === "audited" && (!Array.isArray(report.diagnostics) || !report.coverage || !Array.isArray(report.coverage.unexamined) || !Array.isArray(report.coverage.omittedCategories))) throw new Error("Invalid exact repository source audit.");
    return report;
  }
  const report = JSON.parse(source.reportJson) as CanvasDesignAudit;
  object(report, ["canvasId", "ruleVersion", "system", "screens", "offSystem", "audited", "unavailable", "items", "refusedSources"], "source audit");
  if (typeof report.canvasId !== "string" || typeof report.ruleVersion !== "string" || !Array.isArray(report.items) || !Array.isArray(report.refusedSources) || ![report.screens, report.offSystem, report.audited, report.unavailable].every(n => Number.isInteger(n) && n >= 0)) throw new Error("Invalid source audit envelope.");
  for (const item of report.items) if (!["audited", "unavailable"].includes(item.status) || typeof item.itemId !== "string" || (item.status === "audited" && (!Array.isArray(item.diagnostics) || !item.coverage || typeof item.coverage.complete !== "boolean" || !Array.isArray(item.coverage.unexamined) || !Array.isArray(item.coverage.omittedCategories) || !item.policy))) throw new Error("Invalid source audit reading.");
  return report;
}
function source(raw: unknown): DesignReviewSource {
  if ((raw as Obj)?.kind === "unavailable") { const v = object(raw, ["kind", "reason"], "source reading"); return { kind: "unavailable", reason: string(v.reason, "source reason") }; }
  let result: DesignReviewSource;
  if ((raw as Obj)?.kind === "repository-audit") { const v = object(raw, ["kind", "reportJson", "repository", "revision", "path"], "repository source reading"); result = { kind: "repository-audit", reportJson: string(v.reportJson, "source report"), repository: string(v.repository, "repository"), revision: string(v.revision, "revision"), path: string(v.path, "source path") }; }
  else { const v = object(raw, ["kind", "reportJson"], "source reading"); if (v.kind !== "canvas-audit") throw new Error("Unsupported source reading."); result = { kind: "canvas-audit", reportJson: string(v.reportJson, "source report") }; }
  designReviewSourceAudit(result); return result;
}

/** Strict versioned cumulative reports reject unknown fields and preserve prior reservations before progression. */
export function parseDesignReviewRun(value: unknown): DesignReviewRun {
  const v = object(value, ["schemaVersion", "kind", "id", "request", "preceding", "mode", "basis", "obligations", "passes", "finished"], "review run");
  if (v.schemaVersion !== 1 || v.kind !== "review-run") throw new Error("Unsupported review report version.");
  const b = object(v.basis, ["target", "governing", "context", "ruleVersion"], "review basis");
  const request = object(v.request, ["brief", "requestId", "epoch"], "review request");
  const ref = parseDesignArtifactRef(request.brief);
  if (!Number.isInteger(request.epoch) || Number(request.epoch) < 1) throw new Error("Invalid review request epoch.");
  const obligations = list(v.obligations, obligation); unique(obligations);
  const passes = list(v.passes, raw => {
    const p = object(raw, ["id", "kind", "reservedAt", "sessionId", "reservationVersionId", "output", "record"], "review pass");
    let record: DesignReviewPass["record"] = null;
    if (p.record !== null) { const r = object(p.record, ["outcome", "note", "source", "observations", "findings"], "pass record"); record = { outcome: one(r.outcome, ["reviewed", "invalid", "noop"]), note: string(r.note, "record note", true), source: source(r.source), observations: parseDesignReviewObservations(r.observations), findings: list(r.findings, finding) }; unique(record.findings); if (record.observations.some(row => !obligations.some(o => o.id === row.obligationId))) throw new Error("Observation has no declared obligation."); }
    const output = parseDesignReviewOutput(p.output);
    if (record && record.source.kind !== "unavailable") {
      const audit = designReviewSourceAudit(record.source)!;
      if (audit.ruleVersion !== b.ruleVersion) throw new Error("Source evidence uses a different captured rule version.");
      if (record.source.kind === "canvas-audit") {
        const canvasAudit = audit as CanvasDesignAudit;
        if (output.kind !== "canvas" || canvasAudit.canvasId !== output.artifact.canvasId || canvasAudit.items.length !== 1 || !canvasAudit.items.every(item => item.itemId === output.artifact.itemId && item.versionId === output.artifact.versionId && item.blobHash === output.artifact.blobHash)) throw new Error("Source evidence does not inspect this pass's exact canvas output.");
      } else if (output.kind !== "repository" || record.source.repository !== output.repository || record.source.revision !== output.revision) throw new Error("Source evidence does not inspect this pass's exact repository revision.");
    }
    return { id: string(p.id, "pass ID"), kind: one(p.kind, ["initial", "repair"]), reservedAt: date(p.reservedAt), sessionId: string(p.sessionId, "session"), reservationVersionId: string(p.reservationVersionId, "reservation version"), output, record };
  }, 3); unique(passes);
  if (passes.length < 1 || passes[0]!.kind !== "initial" || passes.slice(1).some(p => p.kind !== "repair") || passes.slice(0, -1).some(p => !p.record)) throw new Error("A review has one initial pass followed by at most two reserved repairs.");
  const mode = one(v.mode, ["review", "audit-only"]); if (mode === "audit-only" && passes.length > 1) throw new Error("Audit-only runs cannot reserve repair work.");
  let preceding: DesignReviewRun["preceding"] = null; if (v.preceding !== null) { const p = object(v.preceding, ["run", "reason"], "preceding run"); preceding = { run: parseDesignArtifactRef(p.run), reason: string(p.reason, "new run reason") }; }
  let finished: DesignReviewRun["finished"] = null; if (v.finished !== null) { const f = object(v.finished, ["status", "limits"], "finish"); finished = { status: one(f.status, ["ready", "draft"]), limits: list(f.limits, one => string(one, "limit")) }; }
  const target = b.target === null ? null : parseDesignTarget(b.target), governing = parseDesignGoverning(b.governing);
  if ((passes[0]!.output.kind === "canvas") !== (target !== null)) throw new Error("Review target capture must match its delivery.");
  if (target && governing.atItemId !== target.artifact.itemId) throw new Error("Canvas review governing scope must name its output.");
  return { schemaVersion: 1, kind: "review-run", id: string(v.id, "run ID"), request: { brief: ref, requestId: string(request.requestId, "request ID"), epoch: Number(request.epoch) }, preceding, mode, basis: { target, governing, context: list(b.context, parseDesignArtifactRef), ruleVersion: string(b.ruleVersion, "rule version") }, obligations, passes, finished };
}
/** Offer expiry and positive declared tooling are validated before publication; liveness remains a read-time fact. */
export function parseDesignVerifierOffer(value: unknown): DesignVerifierOffer {
  const v = object(value, ["schemaVersion", "kind", "id", "requestId", "runId", "run", "output", "sessionId", "observedAt", "expiresAt", "delivery", "available", "reason", "tools"], "verifier offer");
  if (v.schemaVersion !== 1 || v.kind !== "verifier-offer" || typeof v.available !== "boolean") throw new Error("Unsupported verifier offer.");
  const observedAt = date(v.observedAt), expiresAt = date(v.expiresAt), duration = Date.parse(expiresAt) - Date.parse(observedAt);
  if (duration <= 0 || duration > 300000) throw new Error("A verifier probe expires within five minutes.");
  const tools = list(v.tools, raw => { const t = object(raw, ["name", "version"], "tool"); return { name: string(t.name, "tool"), version: string(t.version, "observed tool version") }; }, 20);
  if (v.available && !tools.length) throw new Error("An available verifier names actually probed tools and versions.");
  const output = parseDesignReviewOutput(v.output), delivery = one(v.delivery, ["canvas", "repository"]);
  if (output.kind !== delivery) throw new Error("Verifier delivery disagrees with its exact output.");
  return { schemaVersion: 1, kind: "verifier-offer", id: string(v.id, "offer ID"), requestId: string(v.requestId, "request"), runId: string(v.runId, "run"), run: parseDesignArtifactRef(v.run), output, sessionId: string(v.sessionId, "session"), observedAt, expiresAt, delivery, available: v.available, reason: string(v.reason, "offer reason", !v.available ? false : true), tools };
}
