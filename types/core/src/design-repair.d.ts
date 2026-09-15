import type { Actor, ItemVersion } from "./model.js";
import type { Operation } from "./ops.js";
import type { DesignArtifactRef } from "./design-partner.js";
import type { DesignApprovalBasis } from "./design-decision.js";
import type { DesignGoverningBinding } from "./design-request.js";
import type { DesignRetainedReference } from "./design-record.js";
export { parseDesignRepairOperation, parseDesignRepairInput, parseDesignRepairBasis, designRepairIntentHash } from "./design-repair-parse.js";
/** A task repair cites current admission; null preserves explicit audit repair outside a task. */
export interface DesignRepairInput {
    id: string;
    request: {
        brief: DesignArtifactRef;
        requestId: string;
        epoch: number;
    } | null;
    review: {
        run: DesignArtifactRef;
        runId: string;
        passId: string;
    } | null;
    target: DesignApprovalBasis["target"];
    governing: DesignGoverningBinding;
    ruleVersion: string;
    version: {
        id: string;
        blobHash: string;
        size: number;
    };
}
/** Writer-only metadata retains exact input bytes and intent, without marking ordinary HTML versions. */
export interface DesignRepairCanonical {
    intentHash: string;
    retainedReferences: DesignRetainedReference[];
}
/** One public repair produces one conditional edit; its ordinary inverse retains original version authorship. */
export type DesignRepairOperation = Extract<Operation, {
    type: "design.repair";
}>;
/** Historical acceptance is separate from active continuation and current output consistency. */
interface DesignRepairState {
    opId: string;
    intentHash: string;
    repair: DesignRepairInput;
    author: Actor;
    adopted: DesignArtifactRef;
    before: ItemVersion;
    standing: "active" | "undone";
    status: "current" | "stale" | "unavailable";
    reasons: string[];
    references: DesignRetainedReference[];
}
/** Both surfaces read canonical repair history through the existing canvas permission boundary. */
export interface DesignRepairsResponse {
    repairs: DesignRepairState[];
    unavailable: Array<{
        opId: string;
        reason: string;
    }>;
}
/** Shared protected route spelling avoids separate browser and CLI history protocols. */
export declare const designRepairsRoute: (canvasId: string) => string;
