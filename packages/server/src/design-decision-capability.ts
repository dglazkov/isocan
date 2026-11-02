import { supportsDesignDecisions, type CanvasContents, type LogEntry, type Operation } from "@isocan/core";
/** An unsupported paired-decision decoder must upgrade, not retry with different credentials. */
export class DesignDecisionClientError extends Error { readonly code = "design-decisions-required"; constructor() { super("This canvas uses design comparisons and decisions. Update isocan and reload the app."); this.name = "DesignDecisionClientError"; } }
function marked(value: unknown): boolean { if (!value || typeof value !== "object") return false; if ("designDecision" in value) return true; return Object.values(value).some(marked); }
/** Actual op and inverse payloads, including archived receipts, establish required decoding support. */
export function designDecisionOperation(op: Operation): boolean { return ["design.compare", "design.respond", "design.decide", "design.restore"].includes(op.type) || marked(op); }
/** Transparent relays use the caller's feature declaration, never their own decoder's capability. */
export function requireDesignDecisionClient(features: unknown, canvas?: CanvasContents, entries: readonly LogEntry[] = []): void { if (!supportsDesignDecisions(features) && (canvas && marked(canvas) || entries.some((e) => designDecisionOperation(e.envelope.op) || e.inverse && designDecisionOperation(e.inverse)))) throw new DesignDecisionClientError(); }
