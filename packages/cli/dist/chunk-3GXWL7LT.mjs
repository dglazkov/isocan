import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  designAuditInput,
  readCanvasDesignAudit
} from "./chunk-6PVHBSRQ.mjs";
import {
  questionnaireFailureStatus,
  readGoverningDesign
} from "./chunk-L3KH66E7.mjs";
import {
  designDecisionScope
} from "./chunk-U2DRA7X3.mjs";
import {
  designRepairIntentHash,
  normalizeHomeUrl,
  parseDesignRepairBasis,
  parseDesignRepairInput,
  resolveActor,
  sameDesignArtifact,
  sourceFaceOf
} from "./chunk-2KTJ3OHO.mjs";

// packages/api/src/design-repair-reader.ts
var errorText = (error) => error instanceof Error ? error.message : String(error);
var same = (a, b) => {
  const stable = (v) => Array.isArray(v) ? `[${v.map(stable).join(",")}]` : v && typeof v === "object" ? "{" + Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",") + "}" : JSON.stringify(v);
  return stable(a) === stable(b);
};
function parseDesignRepairBasis2(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid repair capture.");
  const v = value;
  if (Object.keys(v).some((k) => !["canvasId", "repair", "filename"].includes(k)) || typeof v.canvasId !== "string" || typeof v.filename !== "string" || !v.filename) throw new Error("Invalid repair capture fields.");
  const repair = parseDesignRepairBasis(v.repair);
  if (repair.target.artifact.canvasId !== v.canvasId) throw new Error("Repair capture destination disagrees with its target.");
  return { canvasId: v.canvasId, filename: v.filename, repair };
}
async function validatePreparedDesignRepair(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid saved repair.");
  const p = value;
  if (Object.keys(p).some((k) => !["schemaVersion", "canvasId", "actorId", "opId", "text", "filename", "operation"].includes(k)) || p.schemaVersion !== 1 || p.operation?.type !== "design.repair" || Object.keys(p.operation).some((k) => !["type", "repair"].includes(k))) throw new Error("Invalid saved repair fields.");
  const repair = parseDesignRepairInput(p.operation.repair);
  const basis = parseDesignRepairBasis2({ canvasId: p.canvasId, filename: p.filename, repair: { request: repair.request, review: repair.review, target: repair.target, governing: repair.governing, ruleVersion: repair.ruleVersion } });
  const rebuilt = await prepareDesignRepair({ basis, text: p.text, actorId: p.actorId, opId: p.opId, versionId: repair.version.id, repairId: repair.id });
  if (!same(rebuilt, p)) throw new Error("Saved repair bytes or semantic intent changed.");
  return rebuilt;
}
async function captureDesignRepair(io, options) {
  const { canvasId, itemId, signal } = options;
  const [snapshot, home] = await Promise.all([io.snapshot(canvasId, signal), io.home(canvasId, signal)]);
  if (snapshot.project.id !== canvasId) throw new Error("Repair capture returned a different canvas.");
  const item = snapshot.canvas.items[itemId], version = item?.versions.find((one) => one.id === item.currentVersionId);
  if (!item || !version || sourceFaceOf(version).mimeType !== "text/html") throw new Error("Repair needs an available HTML target.");
  const governing = await readGoverningDesign(io, { canvasId, canvas: snapshot.canvas, project: snapshot.project, home, atId: itemId, ...signal ? { signal } : {} });
  if (governing.status === "unavailable") throw new Error(governing.reason);
  const { DESIGN_AUDIT_VERSION } = await import("./designaudit-TGHRJDB4.mjs");
  return { canvasId, filename: version.filename, repair: { request: options.request ?? null, review: options.review ?? null, target: { artifact: { home: normalizeHomeUrl(home), canvasId, itemId, versionId: version.id, blobHash: version.blobHash }, title: item.title, description: item.description, properties: structuredClone(item.properties), scope: designDecisionScope(snapshot.canvas, item) }, governing: { atItemId: itemId, artifact: governing.artifact, explicitNone: governing.exempt }, ruleVersion: DESIGN_AUDIT_VERSION } };
}
async function prepareDesignRepair(options) {
  if (!options.actorId || !/^op_[A-Za-z0-9_-]{1,32}$/.test(options.opId)) throw new Error("A repair requires its actual actor and a valid stable operation ID.");
  if (typeof options.text !== "string" || !options.text.trim()) throw Object.assign(new Error("A repair needs authored HTML source. HTML fragments are supported."), { code: "candidate-rejected" });
  const input = await designAuditInput(options.text, { kind: "file", label: options.basis.filename });
  if (input.sha256 === options.basis.repair.target.artifact.blobHash) throw Object.assign(new Error("The proposed repair does not change the source. Its reserved attempt still counts."), { code: "candidate-rejected" });
  const repair = parseDesignRepairInput({ ...options.basis.repair, id: options.repairId, version: { id: options.versionId, blobHash: input.sha256, size: input.size } });
  if (repair.target.artifact.canvasId !== options.basis.canvasId) throw new Error("Repair destination disagrees with its captured target.");
  return { schemaVersion: 1, canvasId: options.basis.canvasId, actorId: options.actorId, opId: options.opId, text: options.text, filename: options.basis.filename, operation: { type: "design.repair", repair } };
}
async function submitDesignRepair(io, prepared, options = {}) {
  const { signal } = options, repair = parseDesignRepairInput(prepared.operation.repair);
  const result = { status: "pending", submittedOpId: prepared.opId, opId: null, itemId: repair.target.artifact.itemId, versionId: repair.version.id, blobHash: repair.version.blobHash };
  await validatePreparedDesignRepair(prepared);
  let snapshot;
  try {
    snapshot = await io.snapshot(prepared.canvasId, signal);
  } catch {
  }
  const sameActor = (id) => id === prepared.actorId || !!snapshot?.joined && resolveActor(snapshot.joined, id) === resolveActor(snapshot.joined, prepared.actorId);
  if (!io.actorId || !sameActor(io.actorId)) return { ...result, status: options.retry ? "pending" : "refused", reason: "This saved repair belongs to another acting identity. Keep that actor's journal unchanged." };
  const verifyCurrent = async () => {
    const current = await captureDesignRepair(io, { canvasId: prepared.canvasId, itemId: result.itemId, request: repair.request, review: repair.review, ...signal ? { signal } : {} });
    if (!same(current.repair, { request: repair.request, review: repair.review, target: repair.target, governing: repair.governing, ruleVersion: repair.ruleVersion }) || current.filename !== prepared.filename) throw new Error("The captured target, metadata, scope or governing design changed; review the draft before saving.");
  };
  if (!options.retry) {
    try {
      await verifyCurrent();
    } catch (error) {
      return { ...result, status: "refused", reason: errorText(error) };
    }
  }
  let delivered;
  try {
    if (!options.retry) {
      const upload = await io.upload(prepared.canvasId, prepared.text, prepared.filename, signal);
      if (upload.blobHash !== repair.version.blobHash || upload.size !== repair.version.size) throw new Error("Uploaded repair bytes disagree with the saved intent.");
      try {
        await verifyCurrent();
      } catch (error) {
        return { ...result, status: "refused", reason: errorText(error) };
      }
    }
    delivered = await io.sendRepair(prepared.canvasId, prepared.operation, { opId: prepared.opId, ...signal ? { signal } : {} });
  } catch (error) {
    delivered = { status: questionnaireFailureStatus(error), reason: errorText(error), ...error && typeof error === "object" && "code" in error && typeof error.code === "string" ? { code: error.code } : {} };
  }
  if (options.retry && delivered.status !== "accepted" && delivered.code !== "design-intent-conflict") {
    try {
      const upload = await io.upload(prepared.canvasId, prepared.text, prepared.filename, signal);
      if (upload.blobHash !== repair.version.blobHash || upload.size !== repair.version.size) throw new Error("Uploaded repair bytes disagree with the saved intent.");
      delivered = await io.sendRepair(prepared.canvasId, prepared.operation, { opId: prepared.opId, ...signal ? { signal } : {} });
    } catch (error) {
      delivered = { status: "pending", reason: errorText(error) };
    }
  }
  let accepted;
  if (delivered.status === "accepted") {
    const e = delivered.receipt.envelope;
    if (e.canvasId === prepared.canvasId && sameActor(e.actor.id) && e.op.type === "design.repair") {
      try {
        if (await designRepairIntentHash(e.op, e.actor.id) === await designRepairIntentHash(prepared.operation, e.actor.id)) accepted = { ...result, status: "accepted", opId: e.id, seq: delivered.receipt.seq };
      } catch {
      }
    }
  }
  let history;
  try {
    history = await io.repairs(prepared.canvasId, signal);
  } catch {
  }
  if (!accepted && history) for (const entry of history.repairs) {
    if (sameActor(entry.author.id) && entry.intentHash === await designRepairIntentHash(prepared.operation, entry.author.id)) {
      accepted = { ...result, status: "accepted", opId: entry.opId };
      break;
    }
  }
  if (!accepted) return { ...result, status: delivered.status === "refused" && (!options.retry || delivered.code === "design-intent-conflict") ? "refused" : "pending", reason: delivered.status === "accepted" ? "The writer receipt did not match the saved actor and full repair intent." : delivered.reason };
  const saved = history?.repairs.find((one) => one.opId === accepted.opId);
  accepted.consistency = saved ? { status: saved.status, reasons: saved.reasons } : { status: "unavailable", reasons: ["Accepted repair; its current consistency could not be read."] };
  try {
    const fresh = await io.snapshot(prepared.canvasId, signal), home = await io.home(prepared.canvasId, signal);
    const governing = await readGoverningDesign(io, { canvasId: prepared.canvasId, canvas: fresh.canvas, project: fresh.project, home, atId: result.itemId, ...signal ? { signal } : {} });
    if (governing.status === "unavailable") accepted.consistency = { status: "unavailable", reasons: [governing.reason] };
    else if (governing.exempt !== repair.governing.explicitNone || (governing.artifact === null ? repair.governing.artifact !== null : !repair.governing.artifact || !sameDesignArtifact(governing.artifact, repair.governing.artifact))) accepted.consistency = { status: "stale", reasons: ["The governing design changed after this accepted repair."] };
    accepted.audit = await readCanvasDesignAudit(io, { canvasId: prepared.canvasId, canvas: fresh.canvas, home, itemIds: [result.itemId], ...signal ? { signal } : {} });
  } catch (error) {
    accepted.consistency = { status: "unavailable", reasons: [errorText(error)] };
  }
  return accepted;
}

export {
  parseDesignRepairBasis2 as parseDesignRepairBasis,
  validatePreparedDesignRepair,
  captureDesignRepair,
  prepareDesignRepair,
  submitDesignRepair
};
