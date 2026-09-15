import { type DesignRequestReadPort } from "./design-request-reader.js";
import { type DesignCraftPacket, type DesignCraftStage } from "./design-craft-packet.js";
export { parseDesignCraftPacket, type DesignCraftPacket, type DesignCraftStage } from "./design-craft-packet.js";
/** Reads optional adapted knowledge around one canonical request without enrollment, questions or writes. */
export declare function readDesignCraft(io: DesignRequestReadPort, options: {
    canvasId: string;
    requestId: string;
    stage: DesignCraftStage;
    signal?: AbortSignal;
}): Promise<DesignCraftPacket>;
/** Rechecks the original complete capture through current permissions, without recapturing beneath local drafts. */
export declare function checkDesignCraft(io: DesignRequestReadPort, options: {
    canvasId: string;
    requestId: string;
    packet: unknown;
    signal?: AbortSignal;
}): Promise<{
    packetId: string;
    status: "current" | "stale" | "unavailable";
    reasons: string[];
}>;
