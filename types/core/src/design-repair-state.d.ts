import type { LogEntry, OpEnvelope } from "./ops.js";
import type { DesignArtifactRef } from "./design-partner.js";
import type { DesignRepairInput } from "./design-repair.js";
/** A canonical repair edge remains attributed to its original act; history causes determine activity. */
export interface DesignRepairTransition {
    id: string;
    request: NonNullable<DesignRepairInput["request"]>;
    target: DesignRepairInput["target"];
    adopted: DesignArtifactRef;
}
/** Replay validates the one exact edit and its flat evidence without resolving now-changed live policy. */
export declare function validateDesignRepairCanonical(envelope: OpEnvelope): void;
/** Original acceptance is active unless the latest recorded Undo/Redo cause disables it; hashes alone never restore authority. */
export declare function activeDesignRepairEntries(history: readonly LogEntry[]): LogEntry[];
/** Current request context combines these accepted repair edges with live adoption edges, without recapturing its original input. */
export declare function designRepairTransitions(history: readonly LogEntry[]): DesignRepairTransition[];
