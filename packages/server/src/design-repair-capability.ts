import { supportsDesignRepairs, type LogEntry } from "@isocan/core";
/** An old decoder must upgrade before observing the new repair operation or its canonical history. */
export class DesignRepairClientError extends Error { readonly code = "design-repairs-required"; constructor() { super("This history uses design repairs. Update isocan and reload the app."); this.name = "DesignRepairClientError"; } }
/** Gate actual exposed repair semantics; ordinary restored HTML is still an ordinary snapshot. */
export function requireDesignRepairClient(features: unknown, entries: readonly LogEntry[]): void { if (!supportsDesignRepairs(features) && entries.some((e) => e.envelope.op.type === "design.repair" || e.inverse?.type === "design.repair")) throw new DesignRepairClientError(); }
