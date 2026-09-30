export { parseDesignContinuation, parseDesignDiscovery, parseDesignGoverning } from "./design-partner-values.js";
import type { DesignRequestAction, DesignRecordOperation } from "./design-request.js";
/** Rejects unsupported lifecycle fields before any writer mutation or retry lookup. */
export declare function parseDesignRequestAction(value: unknown): DesignRequestAction;
/** Parses either public design act; canonical effects are refused at the public boundary. */
export declare function parseDesignRequestOperation(value: unknown): DesignRecordOperation;
/** Snapshot recovery hashes validated intent with its immutable authenticated author, after join-aware matching. */
export declare function designIntentHash(operation: DesignRecordOperation, authoredActorId: string): Promise<string>;
