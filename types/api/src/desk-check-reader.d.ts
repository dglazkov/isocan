import { type CanvasContents } from "../../core/src/index.js";
import type { DeskCheckInput } from "../../core/src/desk-check.js";
import type { CanvasDesignAudit } from "./design-audit-reader.js";
/**
 * **What the desk check needs from a surface** (proactive-agent phase 8):
 * the bytes of a version, the design audit over some screens, the stale
 * receipts, and the wires behind their system. Each client already reads
 * all four its own way — the terminal through its daemon client, the
 * browser through its badge — so this file asks rather than reaches, and
 * says what was found the same way for both.
 */
export interface DeskCheckPort {
    text(blobHash: string): Promise<string>;
    audit(itemIds: readonly string[]): Promise<CanvasDesignAudit>;
    /** Design receipts whose inputs changed since they were written, titled by their output. */
    staleReceipts(): Promise<{
        title: string;
        why: string;
    }[]>;
    /** The wireframe module's reading of wires behind their system (`readWiresBehind`); empty without the module. */
    wiresBehind(canvas: CanvasContents): Promise<{
        title: string;
        system: string;
    }[]>;
}
/**
 * **Read the desk check** — everything but the critics, whom the room
 * module asks (the surface adds them). Every part that cannot be read is
 * left out rather than failing the share: the check reports, it never blocks.
 */
export declare function readDeskCheck(port: DeskCheckPort, canvas: CanvasContents, opts?: {
    itemIds?: readonly string[];
}): Promise<Omit<DeskCheckInput, "critics">>;
