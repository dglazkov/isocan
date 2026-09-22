import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  readGoverningDesign,
  readInheritedCanvases
} from "./chunk-EACMSUMJ.mjs";
import {
  designDecisionScope
} from "./chunk-YAQJQABV.mjs";
import {
  designSystem,
  inCanvasScope,
  itemKind,
  newOpId,
  newVersionId,
  normalizeHomeUrl,
  sourceFaceOf
} from "./chunk-TNZFS7IX.mjs";
import {
  parseDesign
} from "./chunk-TE337AEY.mjs";

// packages/api/src/design-audit-reader.ts
async function readCanvasDesignAudit(io, options) {
  const { canvas, canvasId, signal } = options;
  signal?.throwIfAborted();
  const scope = options.scopeId === void 0 ? null : canvas.items[options.scopeId];
  if (options.scopeId !== void 0 && !scope) throw new Error(`No scope ${options.scopeId} on this canvas.`);
  if (options.draft && (!options.draft.baseVersionId || options.itemIds && (options.itemIds.length !== 1 || options.itemIds[0] !== options.draft.itemId))) throw new Error("A draft needs its captured base version and exactly its own item selection.");
  const selectedIds = options.draft ? [options.draft.itemId] : options.itemIds;
  const chosen = selectedIds === void 0 ? Object.values(canvas.items).filter((item) => itemKind(item) === "screen") : selectedIds.map((id) => {
    const item = canvas.items[id];
    if (!item) throw new Error(`No item ${id} on this canvas.`);
    if (itemKind(item) !== "screen") throw new Error(`${item.title} is not an HTML screen.`);
    return item;
  });
  const screens = [...new Map(chosen.filter((item) => !scope || inCanvasScope(canvas, scope, item)).map((item) => [item.id, item])).values()];
  const linked = screens.some((item) => !designSystem(canvas, { at: item })) ? await readInheritedCanvases(io, canvas, options.home, signal) : [];
  signal?.throwIfAborted();
  const { auditScreen, DESIGN_AUDIT_VERSION, offSystemTotal } = await import("./designaudit-TGHRJDB4.mjs");
  const documents = /* @__PURE__ */ new Map();
  const items = [];
  const errorText = (error) => error instanceof Error ? error.message : String(error);
  for (const item of screens) {
    signal?.throwIfAborted();
    const version = item.versions.find((one) => one.id === item.currentVersionId);
    const draft = options.draft;
    const identity = { canvasId, itemId: item.id, title: item.title, versionId: draft?.baseVersionId ?? item.currentVersionId, blobHash: draft ? null : version?.blobHash ?? null, input: draft ? await designAuditInput(draft.text, { kind: "draft", label: draft.label ?? item.title, baseVersionId: draft.baseVersionId }) : null };
    let provenance = null;
    try {
      if (!version) throw new Error("The screen's current version is unavailable.");
      if (sourceFaceOf(version).mimeType !== "text/html") throw new Error("Only an HTML source face can be audited.");
      const governing = await readGoverningDesign(io, { canvasId, canvas, home: options.home, atId: item.id, linked, documents, ...signal ? { signal } : {} });
      if (governing.status !== "unavailable" && version.id === identity.versionId) identity.repairBasis = { canvasId, filename: version.filename, repair: { request: null, review: null, target: { artifact: { home: normalizeHomeUrl(options.home), canvasId, itemId: item.id, versionId: version.id, blobHash: version.blobHash }, title: item.title, description: item.description, properties: structuredClone(item.properties), scope: designDecisionScope(canvas, item) }, governing: { atItemId: item.id, artifact: governing.artifact, explicitNone: governing.exempt }, ruleVersion: DESIGN_AUDIT_VERSION } };
      if (governing.artifact) provenance = { canvasId: governing.artifact.canvasId, itemId: governing.artifact.itemId, versionId: governing.artifact.versionId, blobHash: governing.artifact.blobHash, title: governing.title ?? "Unavailable design system", name: governing.title ?? "Unavailable design system", inherited: governing.artifact.canvasId !== canvasId };
      if (governing.status !== "available") throw new Error(!governing.artifact && !governing.title ? "No readable design system governs this screen." : governing.reason);
      const doc = governing.document;
      signal?.throwIfAborted();
      if (doc.problems.length) throw new Error(`The governing design document could not be parsed: ${doc.problems.join("; ")}`);
      provenance.name = doc.tokens.name ?? governing.title;
      const source = draft?.text ?? await io.blobText(canvasId, version.blobHash, signal);
      signal?.throwIfAborted();
      identity.input ??= await designAuditInput(source, { kind: "stored", label: version.filename });
      items.push({ ...identity, status: "audited", governing: provenance, ...auditScreen(source, doc.tokens) });
    } catch (error) {
      signal?.throwIfAborted();
      items.push({ ...identity, status: "unavailable", governing: provenance, reason: errorText(error) });
    }
  }
  const audited = items.filter((item) => item.status === "audited");
  const systems = new Map(audited.map((item) => [JSON.stringify([item.governing.canvasId, item.governing.itemId]), item.governing.name]));
  return {
    canvasId,
    ruleVersion: DESIGN_AUDIT_VERSION,
    system: systems.size > 1 ? "Multiple design systems" : [...systems.values()][0] ?? null,
    screens: items.length,
    offSystem: offSystemTotal(audited),
    audited: audited.length,
    unavailable: items.length - audited.length,
    items,
    refusedSources: linked.filter((link) => link.refused).map((link) => ({ canvasId: link.canvasId, itemId: link.item.id, reason: link.refused }))
  };
}
async function designAuditInput(text, options) {
  const bytes = new TextEncoder().encode(text);
  const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return { ...options, size: bytes.byteLength, sha256: [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("") };
}
async function readDesignAuditAdvisory(read) {
  try {
    return { status: "available", report: await read() };
  } catch (error) {
    return { status: "unavailable", reason: error instanceof Error ? error.message : String(error) };
  }
}
async function auditDesignSource(text, designText, options) {
  const { auditScreen, DESIGN_AUDIT_VERSION } = await import("./designaudit-TGHRJDB4.mjs");
  const input = await designAuditInput(text, { kind: "file", label: options.label });
  const governing = { kind: "file", input: await designAuditInput(designText, { kind: "file", label: options.designLabel }) };
  try {
    const doc = parseDesign(designText);
    if (doc.problems.length) throw new Error(`The governing design document could not be parsed: ${doc.problems.join("; ")}`);
    return { input, governing, status: "audited", ...auditScreen(text, doc.tokens) };
  } catch (error) {
    return { input, governing, status: "unavailable", ruleVersion: DESIGN_AUDIT_VERSION, reason: error instanceof Error ? error.message : String(error) };
  }
}
async function readDesignSourceAudit(io, options) {
  const { DESIGN_AUDIT_VERSION } = await import("./designaudit-TGHRJDB4.mjs");
  const input = await designAuditInput(options.text, { kind: "file", label: options.label });
  let provenance = null;
  try {
    options.signal?.throwIfAborted();
    const governing = await readGoverningDesign(io, options);
    if (governing.status !== "available") throw new Error(governing.reason);
    const ref = governing.artifact;
    provenance = { canvasId: ref.canvasId, itemId: ref.itemId, versionId: ref.versionId, blobHash: ref.blobHash, title: governing.title, name: governing.document.tokens.name ?? governing.title, inherited: governing.inherited };
    options.signal?.throwIfAborted();
    const report = await auditDesignSource(options.text, governing.text, { label: options.label, designLabel: governing.title });
    return { ...report, governing: provenance };
  } catch (error) {
    options.signal?.throwIfAborted();
    return { input, governing: provenance, status: "unavailable", ruleVersion: DESIGN_AUDIT_VERSION, reason: error instanceof Error ? error.message : String(error) };
  }
}
function designAuditFails(report) {
  const failed = (one) => one.status !== "audited" || one.diagnostics.length > 0 || !one.coverage.complete || one.coverage.checkedValues === 0 || one.coverage.omittedCategories.length > 0;
  return "items" in report ? report.items.length === 0 || report.refusedSources.length > 0 || report.items.some(failed) : failed(report);
}
function sameGoverning(a, b) {
  return !!a && !!b && a.canvasId === b.canvasId && a.itemId === b.itemId && a.versionId === b.versionId && a.blobHash === b.blobHash;
}
async function repairDesignScreen(io, request) {
  const { prepareDesignRepair, submitDesignRepair, parseDesignRepairBasis } = await import("./design-repair-reader-M74QSQBQ.mjs");
  const { DESIGN_AUDIT_VERSION } = await import("./designaudit-TGHRJDB4.mjs");
  if (request.expectedRuleVersion !== DESIGN_AUDIT_VERSION) return { status: "refused", code: "rule-version-changed", reason: "The audit rules changed; capture a fresh report before repairing." };
  if (!request.basis && !request.prepared) return { status: "refused", code: "audit-unavailable", reason: "This historical audit has no original target metadata/scope capture. Read a fresh audit before preparing a repair." };
  const basis = request.basis ? parseDesignRepairBasis(request.basis) : { canvasId: request.prepared.canvasId, filename: request.prepared.filename, repair: request.prepared.operation.repair };
  if (basis.repair.target.artifact.versionId !== request.expectedVersionId || basis.canvasId !== request.canvasId || basis.repair.target.artifact.itemId !== request.itemId) return { status: "refused", code: "stale-version", reason: "The audit's full capture disagrees with the requested base version." };
  const expected = basis.repair.governing.artifact;
  if (!expected || !sameGoverning({ ...request.expectedGoverning, canvasId: expected.canvasId, itemId: expected.itemId, versionId: expected.versionId, blobHash: expected.blobHash }, request.expectedGoverning)) return { status: "refused", code: "governing-changed", reason: "The audit's captured governing identity disagrees with this repair." };
  if (!io.actorId) return { status: "refused", code: "write-refused", reason: "A repair needs the actual named actor." };
  let prepared;
  try {
    prepared = request.prepared ?? await prepareDesignRepair({ basis, text: request.text, actorId: io.actorId, opId: request.opId ?? newOpId(), versionId: request.versionId ?? newVersionId(), repairId: request.repairId ?? newOpId() });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "candidate-rejected") return { status: "refused", code: "candidate-rejected", reason: error.message };
    throw error;
  }
  const read = async (draft) => readCanvasDesignAudit(io, { canvasId: request.canvasId, canvas: (await io.snapshot(request.canvasId, request.signal)).canvas, home: await io.home(request.canvasId, request.signal), itemIds: [request.itemId], ...draft ? { draft } : {}, ...request.signal ? { signal: request.signal } : {} });
  const beforeRead = await readDesignAuditAdvisory(() => read());
  const proposedRead = await readDesignAuditAdvisory(() => read({ itemId: request.itemId, text: request.text, baseVersionId: request.expectedVersionId, label: basis.filename }));
  const before = beforeRead.status === "available" ? beforeRead.report.items[0] : void 0;
  const proposed = proposedRead.status === "available" ? proposedRead.report.items[0] : void 0;
  const submission = await submitDesignRepair(io, prepared, { ...request.retry ? { retry: true } : {}, ...request.signal ? { signal: request.signal } : {} });
  if (submission.status === "refused") return { status: "refused", code: before && before.versionId !== request.expectedVersionId ? "stale-version" : before && !sameGoverning(before.governing, request.expectedGoverning) || submission.reason?.includes("governing design changed") ? "governing-changed" : "write-refused", reason: submission.reason ?? "The writer refused this repair.", ...before ? { before } : {} };
  if (submission.status === "pending") return { status: "pending", itemId: submission.itemId, versionId: submission.versionId, blobHash: submission.blobHash, reason: submission.reason ?? "The exact repair remains unconfirmed.", ...before ? { before } : {}, ...proposed ? { proposed } : {}, submission, prepared };
  const after = submission.audit ? { status: "available", report: submission.audit } : { status: "unavailable", reason: submission.consistency?.reasons.join(" ") ?? "Post-save audit unavailable." };
  const current = submission.audit?.items[0];
  const unavailable = { canvasId: request.canvasId, itemId: request.itemId, title: basis.repair.target.title, versionId: request.expectedVersionId, blobHash: basis.repair.target.artifact.blobHash, input: null, status: "unavailable", governing: request.expectedGoverning, reason: "Historical pre-save audit unavailable; acceptance is confirmed independently." };
  return { status: "saved", itemId: submission.itemId, versionId: submission.versionId, blobHash: submission.blobHash, before: before ?? unavailable, proposed: proposed ?? unavailable, after, governingChanged: current?.status === "audited" ? !sameGoverning(current.governing, request.expectedGoverning) : null, superseded: current ? current.versionId !== submission.versionId : null, submission, prepared };
}

export {
  readCanvasDesignAudit,
  designAuditInput,
  readDesignAuditAdvisory,
  auditDesignSource,
  readDesignSourceAudit,
  designAuditFails,
  repairDesignScreen
};
