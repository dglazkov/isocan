/**
 * **A drag in progress, as the people watching it are told** (groups-by-hand
 * phase 3, docs/research/2026-10-01-groups-stacks-lift.md §4).
 *
 * Rides the presence beat beside the cursor, only while a press has become a
 * drag, and is gone from the next beat after the hand lets go. Presence is
 * latest-state-per-session and never written down, so this is never an op,
 * never in the log, never in undo — and a viewer who arrives late is handed
 * where the drag IS, never where it was.
 */
export interface PresenceDrag {
    /** One id per drag, so a viewer can tell a new drag from the same one. */
    gesture: string;
    /**
     * The selection ROOTS, not the closure: dragging a group of 200 sends one
     * id, and a viewer expands members and marks from its own copy. Past
     * `LIVE_DRAG_MAX_ROOTS` it is the first root alone, and `box` stands in for
     * the rest.
     */
    roots: string[];
    /** Where the first root stood when the drag began. A viewer draws the drag
     * only while that item is still there: the moment the real move lands — or
     * somebody else's — the item has left `from` and the ghost goes, whichever
     * order the two messages arrived in. */
    from: {
        x: number;
        y: number;
    };
    /** The offset the mover SEES — snapped, so every screen shows one spot. */
    dx: number;
    dy: number;
    /** The drop target the mover's pill names: a group, `null` for the open
     * canvas (a ⌘-drag out), absent when the drop keeps every parent. */
    into?: string | null | undefined;
    /** A big selection's bounding box at the start, drawn as one lifted outline
     * instead of hundreds of moving cards. */
    box?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}
/** Past this many roots a drag is sent as a box (research §4, "will it scale"). */
export declare const LIVE_DRAG_MAX_ROOTS = 50;
/**
 * A client's word for its drag, kept only when it is one. Presence is
 * client-asserted, so this is shape, not trust: a malformed field is dropped
 * (no drag) rather than relayed to every screen on the canvas.
 */
export declare function presenceDrag(value: unknown): PresenceDrag | null;
