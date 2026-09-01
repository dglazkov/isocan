import type { RcAsk } from "../../core/src/index.js";
interface Mirror {
    parked: boolean;
    actorIds: ReadonlySet<string>;
    /** Sends an `rc-ask` down the socket that owns this mirror. Returns false
     * when the socket cannot carry it (closing, gone). */
    sendAsk: (ask: RcAsk) => boolean;
}
export interface RcAnswering {
    parked: boolean;
    actorIds: string[];
}
export declare class RcHolds {
    private local;
    private queued;
    /** originKey → canvasId → what that connection last relayed. The key is
     * whatever the socket layer uses to identify one connection — the same
     * value it hands `PresenceHub.mirror`. */
    private mirrors;
    private listeners;
    /** Canvases whose "went down" notification is pending the flap window. */
    private sinking;
    /** Observe local-hold changes (a canvas's parked state or actor set). The
     * daemon's home-links subscribe to schedule an `rc-relay`. */
    onChange(listener: (canvasId: string) => void): void;
    private changed;
    /**
     * Register a hold and wait it out. Resolves with the asks that arrived —
     * empty on an ordinary timeout, and always empty once `release` has run
     * (a closed socket must not eat an ask; an undelivered one stays queued
     * for the next hold).
     */
    hold(canvasId: string, actorIds: ReadonlySet<string>, waitMs: number): {
        done: Promise<RcAsk[]>;
        release: () => void;
    };
    private drain;
    /** What the socket layer relayed for one connection. A full replacement per
     * canvas, like `presence-relay`: the sender holds the whole truth. */
    mirror(originKey: unknown, canvasId: string, row: Mirror): void;
    /** The connection died — everything it relayed dies with it. */
    dropMirror(originKey: unknown): void;
    /** Who answers for this canvas right now, across local holds and mirrors. */
    answering(canvasId: string): RcAnswering;
    /** Local holds only — what a daemon relays up. Mirrors stay out: a relay
     * of a mirror would launder someone else's assertion as this badge's. */
    answeringLocal(canvasId: string): RcAnswering;
    /**
     * Route an ask toward whoever is parked. An open local hold gets it now; a
     * parked-but-between-holds canvas queues it briefly; otherwise it goes down
     * the first mirror that says an rc is parked behind it. False means nobody
     * is there to ask — the caller's 409.
     */
    ask(canvasId: string, ask: RcAsk): boolean;
    private enqueue;
}
export {};
