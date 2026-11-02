import { isOpId, type Operation } from "@isocan/core";

/** Retry exactly the reference bytes, destination and operation that this actor prepared. */
export interface PendingDesignReference { canvasId: string; actorId: string; opId: string; originGroupMode: "groups" | "legacy"; text: string; operation: Extract<Operation, { type: "item.add" }>; refused: boolean }
/** Reject corrupt nested storage and altered bytes before an add draft can reach the upload transport. */
export async function readPendingDesignReference(raw: string, canvasId: string, actorId: string): Promise<PendingDesignReference> {
  const value = JSON.parse(raw) as PendingDesignReference;
  const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
  const string = (v: unknown): v is string => typeof v === "string" && v.length > 0;
  if (!object(value) || value.canvasId !== canvasId || value.actorId !== actorId || !isOpId(value.opId) || typeof value.text !== "string" || value.text.length > 1024 * 1024 || !["groups", "legacy"].includes(value.originGroupMode) || typeof value.refused !== "boolean") throw new Error("The saved reference ownership or identity is malformed.");
  const op = value.operation, version = op?.version;
  if (!object(op) || op.type !== "item.add" || !string(op.itemId) || !string(op.title) || !Number.isFinite(op.width) || op.width <= 0 || !Number.isFinite(op.height) || op.height <= 0 || !object(version) || !string(version.id) || !string(version.filename) || !["text/html", "text/markdown"].includes(version.mimeType) || !/^[a-f0-9]{64}$/.test(version.blobHash) || !Number.isSafeInteger(version.size) || version.size < 1) throw new Error("The saved reference version is malformed.");
  if (!object(op.placement) || !("anchorItemId" in op.placement ? string(op.placement.anchorItemId) : "x" in op.placement && "y" in op.placement && Number.isFinite(op.placement.x) && Number.isFinite(op.placement.y))) throw new Error("The saved reference placement is malformed.");
  if (op.properties !== undefined && (!object(op.properties) || Object.values(op.properties).some(v => typeof v !== "string"))) throw new Error("The saved reference metadata is malformed.");
  if (value.originGroupMode === "groups" && (op.containerId !== null && !string(op.containerId) || op.groupPlacement !== "auto")) throw new Error("The saved reference destination is malformed.");
  const bytes = new TextEncoder().encode(value.text), hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(byte => byte.toString(16).padStart(2, "0")).join("");
  if (hash !== version.blobHash || bytes.byteLength !== version.size) throw new Error("The saved reference bytes differ from its exact version.");
  return value;
}
