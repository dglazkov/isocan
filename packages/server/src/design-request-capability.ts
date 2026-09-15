import { DESIGN_REQUESTS_REQUIRED, supportsDesignRequests, type CanvasContents, type LogEntry, type Operation } from "@isocan/core";

/** Decoder refusal cannot be repaired by credential retries or silently dropping admission metadata. */
export class DesignRequestClientError extends Error {
  readonly code = DESIGN_REQUESTS_REQUIRED;
  constructor() { super("This canvas uses admitted design requests. Update isocan and reload the app before opening it."); this.name = "DesignRequestClientError"; }
}
function marked(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.designRecord !== undefined || v.discovery !== undefined && v.kind === "questions") return true;
  return Object.values(v).some(marked);
}
/** Both canonical acts and ordinary inverses carrying new metadata require the new decoder. */
export function designRequestOperation(op: Operation): boolean { return op.type === "design.request" || op.type === "design.receipt" || marked(op); }
/** Checks current state and actual receipts/inverses, including archived retries. */
export function requireDesignRequestClient(features: unknown, canvas?: CanvasContents, entries: readonly LogEntry[] = []): void {
  if (!supportsDesignRequests(features) && (canvas && marked(canvas) || entries.some((entry) => designRequestOperation(entry.envelope.op) || entry.inverse && designRequestOperation(entry.inverse)))) throw new DesignRequestClientError();
}
