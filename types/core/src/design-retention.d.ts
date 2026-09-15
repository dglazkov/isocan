import { type DesignArtifactRef } from "./design-partner.js";
/** Typed comment evidence uses flat, complete public versions, independently of pruned live item stacks. */
export declare function validateDesignRetainedReferences(value: unknown, canvasId: string, required: readonly DesignArtifactRef[], limit: number): void;
