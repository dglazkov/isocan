import type { CanvasContents } from "./model.js";
import type { Operation } from "./ops.js";
/**
 * **A ceiling on one agent's standing on one canvas** (critique phase 2,
 * design §4). The badge's capability says what its holder may do; a ceiling
 * says what ONE of the actors riding that badge may do on ONE canvas, and it
 * is asked after the capability, so it can only ever narrow.
 *
 * There is one ceiling, `note`, and it is a critic's: it may pin a thread to
 * an item, reply in a thread, and react to an item (with or without a
 * point). Everything else it sends is refused with this code and a
 * sentence, before anything is written.
 *
 * It lives on the enrolment row (`EnrolledAgent.ceiling`), which is canvas
 * state: the home that applies the op is the one holding the row, so a
 * replica that forwards an op to a home cannot be the only thing standing in
 * the way, and the CLI and the web read the same refusal from the same place.
 */
export declare const BEYOND_CEILING = "beyond-ceiling";
/**
 * The refusal for this actor's op on this canvas, or `null` when it may go
 * on. Asked at the home's one apply point (`Engine.applyAndPersist`, and
 * undo and redo before they choose anything), with the enrolment row as the
 * canvas holds it at that moment.
 */
export declare function ceilingRefusal(canvas: CanvasContents, actorId: string, op: Operation | null): string | null;
