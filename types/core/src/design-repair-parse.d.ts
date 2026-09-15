import type { DesignRepairInput, DesignRepairOperation } from "./design-repair.js";
/** An incomplete proposal validates its captured basis before replacement bytes or operation identities exist. */
export declare function parseDesignRepairBasis(value: unknown): Omit<DesignRepairInput, "id" | "version">;
/** Strict intent validation preserves optional task attribution without granting permission from a review citation. */
export declare function parseDesignRepairInput(value: unknown): DesignRepairInput;
/** Public repair input cannot supply its resolved edit, retained versions or canonical intent digest. */
export declare function parseDesignRepairOperation(value: unknown): DesignRepairOperation;
/** Accepted identity binds full public intent and original authenticated author across joins and archived retries. */
export declare function designRepairIntentHash(op: DesignRepairOperation, actorId: string): Promise<string>;
