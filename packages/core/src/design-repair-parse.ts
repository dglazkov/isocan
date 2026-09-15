import { parseDesignArtifactRef } from "./design-partner.ts";
import { parseDesignTarget } from "./design-decision-parse.ts";
import { parseDesignGoverning } from "./design-request-parse.ts";
import { object, text, integer, hash, bad } from "./design-partner-values.ts";
import type { DesignRepairInput, DesignRepairOperation } from "./design-repair.ts";

/** An incomplete proposal validates its captured basis before replacement bytes or operation identities exist. */
export function parseDesignRepairBasis(value: unknown): Omit<DesignRepairInput, "id" | "version"> {
  const v = object(value, ["request", "review", "target", "governing", "ruleVersion"]);
  const r = v.request === null ? null : object(v.request, ["brief", "requestId", "epoch"]), review = v.review === null ? null : object(v.review, ["run", "runId", "passId"]);
  const result = { request: r === null ? null : { brief: parseDesignArtifactRef(r.brief), requestId: text(r.requestId), epoch: integer(r.epoch, 1) }, review: review === null ? null : { run: parseDesignArtifactRef(review.run), runId: text(review.runId), passId: text(review.passId) }, target: parseDesignTarget(v.target), governing: parseDesignGoverning(v.governing), ruleVersion: text(v.ruleVersion) };
  if ((result.request === null) !== (result.review === null)) bad("Task repair requires its exact review run and pass; standalone audit repair has neither.");
  if (result.governing.atItemId !== result.target.artifact.itemId) bad("Repair governing scope must name its exact target.");
  return result;
}
/** Strict intent validation preserves optional task attribution without granting permission from a review citation. */
export function parseDesignRepairInput(value: unknown): DesignRepairInput {
  const v = object(value, ["id", "request", "review", "target", "governing", "ruleVersion", "version"]);
  const version = object(v.version, ["id", "blobHash", "size"]);
  const result: DesignRepairInput = { ...parseDesignRepairBasis({ request: v.request, review: v.review, target: v.target, governing: v.governing, ruleVersion: v.ruleVersion }), id: text(v.id), version: { id: text(version.id), blobHash: hash(version.blobHash), size: integer(version.size, 1) } };
  if (result.version.id === result.target.artifact.versionId) bad("A repair requires a fresh version identity.");
  return result;
}
/** Public repair input cannot supply its resolved edit, retained versions or canonical intent digest. */
export function parseDesignRepairOperation(value: unknown): DesignRepairOperation { const v = object(value, ["type", "repair"]); if (v.type !== "design.repair") bad("Expected design.repair."); return { type: "design.repair", repair: parseDesignRepairInput(v.repair) }; }
function canonical(value: unknown): string { return Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : value !== null && typeof value === "object" ? "{" + Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(",") + "}" : JSON.stringify(value); }
/** Accepted identity binds full public intent and original authenticated author across joins and archived retries. */
export async function designRepairIntentHash(op: DesignRepairOperation, actorId: string): Promise<string> { const bytes = new TextEncoder().encode(canonical({ operation: parseDesignRepairOperation({ type: op.type, repair: op.repair }), actorId: text(actorId) })); return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((n) => n.toString(16).padStart(2, "0")).join(""); }
