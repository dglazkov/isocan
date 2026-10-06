import type { CanvasContents } from "./model.js";
import type { Operation } from "./ops.js";
/**
 * **A prototype click: a person pressed something in an HTML item that has
 * nowhere to go yet.**
 *
 * An agent that publishes a clickable prototype needs to hear which control
 * a person tried, so it can build the screen behind it. The page says so with
 * one `postMessage` to the app; the app turns it into an ordinary comment on
 * the item's own thread, carrying the click as data and mentioning whoever
 * published the version. So the click reaches the agent by the one road a
 * summons already travels — `reasonFor`, `isocan wait`, the inbox — and the
 * person sees in the thread what they asked for.
 */
export interface PrototypeClick {
    itemId: string;
    /** The page's own id for the control — a `data-wf` path, an element id. */
    element: string;
    /** The words on the control, as the person saw them. */
    label: string;
    /** Which screen of a multi-screen prototype was showing. */
    screen?: string;
    /** What the page says pressing it should do, when the page knows. */
    intent?: string;
}
/**
 * A second press on the same control by the same person inside this window
 * is the same request: people double-click, and a control that does nothing
 * visible invites pressing it again.
 */
export declare const CLICK_COALESCE_MS = 10000;
/**
 * What a frame posted, as a click on `itemId` — or null when the message is
 * anything else. The page is untrusted content, so every field is bounded and
 * a control with neither an id nor a label is not a click anybody can act on.
 */
export declare function clickFromMessage(data: unknown, itemId: string): PrototypeClick | null;
/** The reducer's check on a click an op carries: the shape a frame message produces, nothing more. */
export declare function validateClick(value: unknown): PrototypeClick;
/** The words a person reads in the thread; agents read `comment.click`. */
export declare function clickBody(click: PrototypeClick): string;
/** Was this the same person pressing the same control on the same item within `CLICK_COALESCE_MS`? */
export declare function coalescedClick(canvas: CanvasContents, click: PrototypeClick, actorId: string, now: number): boolean;
/**
 * The op that delivers a click: a reply on the item's thread, or that
 * thread's first message at the item's corner. It mentions the author of the
 * version on screen — the agent that published it — unless that is the
 * person clicking.
 */
export declare function clickOp(canvas: CanvasContents, click: PrototypeClick, actorId: string): Operation;
