import { type Actor, type CanvasContents, type CanvasSnapshotResponse, type ContextSource, type GroupAction, type SourceClassificationRequest, type SourcePinPiece } from "../../core/src/index.js";
import { type ContextReadPort } from "./context-reader.js";
import { type CopyBytesPort } from "./copy-bytes.js";
/**
 * **Copy one piece of an inherited source into a local pin**
 * (`docs/projects/memory/pin-from-source.md`, memory phase 6).
 *
 * This is the portable half: the order of the checks, the freeze, the byte
 * transfer and the one act that lands. Transport is injected, because the
 * browser and the CLI reach a daemon in genuinely different ways — and the
 * decisions are HERE rather than in either of them, because a picker that
 * decided eligibility differently from the terminal would be two features
 * wearing one name.
 *
 * Nothing in this file is a new operation, a new reducer path, or a second
 * copy algorithm. Membership, remapping and placement are `groupCopySource` /
 * `groupCopyAction` in core; bytes are `copy-bytes.ts`, shared with
 * `CanvasGroups.copyFrom`; the pin and the provenance ride the copy act's
 * `decorate` hook; and what lands is one `group.change` that one undo removes.
 */
export interface ContextPinPort extends Pick<ContextReadPort, "classifySource" | "sourceSnapshot"> {
    /** The DESTINATION, read with the caller's ordinary authority. */
    snapshot(canvasId: string, signal?: AbortSignal): Promise<CanvasSnapshotResponse>;
    /** Bytes, bound to a classified source and this destination — so a blob
     *  request cannot escape the exclusion policy the classification imposed. */
    copyBytes(source: SourceClassificationRequest, destinationCanvasId: string): CopyBytesPort;
    /** The one accepted act. Clients differ only in how they hand it over. */
    submit(canvasId: string, actor: Actor, action: Extract<GroupAction, {
        kind: "copy";
    }>, opId: string, originGroupMode: "legacy" | "groups"): Promise<{
        seq?: number;
    }>;
}
/** Reading the picker's offers needs no write transport at all. */
export type PinSourcePort = Pick<ContextPinPort, "classifySource" | "sourceSnapshot">;
/** One inherited source as the picker shows it: the card that links it, the
 *  source's own current title, and what it is currently offering. */
export interface PinSourceOffer {
    /** The inheritance card on the destination — the concrete visible edge. */
    itemId: string;
    canvasId: string;
    title: string;
    home: string;
    pieces: SourcePinPiece[];
}
/** What one accepted copy did, in the words both surfaces report it with. */
export interface PinFromSourceResult {
    dryRun: boolean;
    /** The new local root, pinned. */
    rootId: string;
    itemIds: string[];
    /** How many items landed, root included. */
    count: number;
    title: string;
    source: ContextSource;
    seq?: number;
}
/** What to copy and where, resolved against the canvases as they are NOW —
 *  never against the list a picker was showing a minute ago. */
export interface PinFromSourceRequest {
    canvasId: string;
    /** The destination's authoritative home; the source must share it. */
    home: string;
    actor: Actor;
    /** An inheritance link: exact canvas or card ID, else unambiguous prefix. */
    from: string;
    /** A piece the source offers: exact item ID, else unambiguous prefix. */
    piece: string;
    at?: {
        x: number;
        y: number;
    } | undefined;
    dryRun?: boolean | undefined;
    signal?: AbortSignal | undefined;
}
/** What one inherited source is offering right now — the picker's list, read
 *  fresh on both surfaces rather than derived from the Context summary. */
export declare function readPinSource(io: PinSourcePort, options: {
    canvas: CanvasContents;
    home: string;
    from: string;
    signal?: AbortSignal | undefined;
}): Promise<PinSourceOffer>;
/**
 * The act itself.
 *
 * **Everything is rechecked here**, because the picker's list is a reading and
 * a reading gets old: the destination is re-read for editability and group
 * mode, the inheritance edge is re-resolved and re-classified, the source is
 * re-snapshotted, and the chosen piece is re-validated against that snapshot's
 * current versions. Then the faces are read, verified and uploaded — and only
 * then is the destination re-read a second time, to confirm it is still
 * editable and the same visible edge is still there, before one act is
 * submitted. A link deleted or excluded mid-transfer, or a browser that
 * changed identity, refuses with nothing visible left behind.
 *
 * What this is NOT is a cross-canvas transaction. Bytes deliberately copied
 * with valid access stay copied; a later source edit, removal or unlink does
 * not reach back into them. That is the whole point of the act.
 */
export declare function pinFromSource(io: ContextPinPort, request: PinFromSourceRequest): Promise<PinFromSourceResult>;
