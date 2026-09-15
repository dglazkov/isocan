import type { DesignContinuation, DesignDiscovery, DesignGoverningBinding, DesignRequestAction, DesignRecordOperation } from "./design-request.js";
/** Validates writer-stamped continuation facts without elevating native reports into human responses. */
export declare function parseDesignContinuation(value: unknown): DesignContinuation;
/** Explicit purpose and fact bindings support a request-wide initial discovery allowance. */
export declare function parseDesignDiscovery(value: unknown): DesignDiscovery;
/** The expected governing winner is separate from the list of incidental input references. */
export declare function parseDesignGoverning(value: unknown): DesignGoverningBinding;
/** Rejects unsupported lifecycle fields before any writer mutation or retry lookup. */
export declare function parseDesignRequestAction(value: unknown): DesignRequestAction;
/** Parses either public design act; canonical effects are refused at the public boundary. */
export declare function parseDesignRequestOperation(value: unknown): DesignRecordOperation;
/** Snapshot recovery hashes validated intent with its immutable authenticated author, after join-aware matching. */
export declare function designIntentHash(operation: DesignRecordOperation, authoredActorId: string): Promise<string>;
