import { type CanvasTakedown, type TakedownNotice } from "../../core/src/index.js";
import type { Desk } from "./desk.js";
/**
 * **What this home has stopped serving, in memory, read at the door** —
 * operator phase 2, and the shape `docs/projects/operator/design.md` gives
 * home-scope refusals one section later: *one list the operator writes, lifts
 * and reads, loaded into memory at boot on a single-instance home and re-read
 * on write, so the door's cost is a set lookup.*
 *
 * A takedown has to be read on the request path — every canvas route, every
 * socket, every signed content read — and a desk read per request would put a
 * Firestore round trip in front of every page this home serves for the sake of
 * a row that is empty on nearly every home. So it is held here, and the two
 * rules that make that honest are stated rather than assumed:
 *
 * 1. **The store's flag is the truth, not this.** `load` refuses on
 *    `takenDownAt`, which is durable and is read from the backing every time a
 *    canvas is opened. This registry exists to produce the SENTENCE — to turn
 *    what would be a 404 into *this was removed, and here is who to ask*. A
 *    registry that lagged would mean a canvas correctly refused with the wrong
 *    words, never a canvas wrongly served.
 * 2. **It is written by the act, in the same process.** One writer: the
 *    takedown route, which writes the desk row, the store flag and this, in
 *    that order. A second instance during a rollout is not reached for the
 *    seconds both run — the same bound the sweep and the socket hub live with,
 *    named in the design's own table — and the instance that did not hear will
 *    still refuse the canvas, because its `load` reads the flag.
 */
export declare class Takedowns {
    private rows;
    /** Every takedown in force, at boot. Called once by `startDaemon`; a home
     * that never calls it answers "nothing is down", which is the truth about a
     * home that has never had an operator. */
    load(desk: Desk): Promise<void>;
    /** The act, having written the desk and the store, says so here. */
    remember(row: CanvasTakedown): void;
    /** The row in force for this canvas, or null — the door's whole question. */
    of(canvasId: string): CanvasTakedown | null;
    /** Is it down: the same question, where only the answer's truth is wanted. */
    has(canvasId: string): boolean;
    /** Every row in force. The canvas list's read, and it is a read of a handful
     * of rows on a home that has any at all. */
    all(): CanvasTakedown[];
    /** What a surface is handed for one canvas, or null. */
    notice(canvasId: string): TakedownNotice | null;
}
/**
 * **The refusal a canvas that was taken down gives**, and it is the whole
 * message (design, "The record").
 *
 * > Never silence, never *not found* for something that was taken down: the
 * > difference between *there is nothing here* and *this was removed, and here
 * > is who to ask* is the whole message.
 *
 * **403 and `not-admitted`, with a `reason` of `taken-down`** — deliberately
 * the shape `withdrawn` already has, rather than a new code. Three reasons,
 * each sufficient:
 *
 * - Every client in this repo already branches on `{code: NOT_ADMITTED, reason}`
 *   — the CLI's `wait`, the web store's socket close, the home link's redial.
 *   A new top-level code would be a refusal each of those met as "something
 *   else went wrong", which on the CLI's path means retrying forever.
 * - It is the truth: this home will not let anybody into that canvas, which is
 *   what `not-admitted` means. What is different is WHY, and why is what
 *   `reason` carries — the same distinction `withdrawn` was added to make.
 * - A 404 would be the lie the design names, and a 410 would say the bytes are
 *   gone, which is exactly what a takedown does not do.
 *
 * The `error` field is the sentence itself, because the CLI prints `error:
 * <message>` and nothing else, and because the words come from the home.
 */
/**
 * **The url map the hosted home's edge is in front of** — `isocan-urlmap`,
 * from `infra/config.sh`, which is where the name is decided.
 *
 * Spelled here rather than read from the environment because the daemon has no
 * business knowing its own load balancer: the command is a LINE OF TEXT the
 * operator pastes into his own shell, run as himself against his own project,
 * and if this home is somebody else's with a different map name the command
 * fails loudly at their prompt rather than the daemon guessing quietly. The
 * override `infra/config.sh` honours is `ISOCAN_URLMAP_NAME`.
 */
export declare const CDN_URL_MAP = "isocan-urlmap";
export declare class TakenDownError extends Error {
    readonly row: CanvasTakedown;
    readonly code = "not-admitted";
    readonly reason = "taken-down";
    readonly status = 403;
    constructor(row: CanvasTakedown);
}
