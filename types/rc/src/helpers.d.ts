import type { CanvasSnapshotResponse, CommentThread, Item, WatchedLogEntry } from "../../core/src/index.js";
/**
 * **Pure helpers the room speaks with** (docs/projects/room/design.md): they
 * lived in `packages/cli/src/main.ts` by accident of history and moved here
 * unchanged, except that `summonsPrompt` takes the canvas title it used to
 * capture. `main.ts` imports them back.
 */
/** World center of an item — where narration points the cursor. */
export declare function itemCenter(item: Item): {
    x: number;
    y: number;
};
/** Where a thread sits in world coordinates, anchored or freestanding. */
export declare function threadLocus(snapshot: CanvasSnapshotResponse, thread: CommentThread): {
    x: number;
    y: number;
};
/**
 * An actor id → the name this canvas would show, for `listenWords`. The
 * registry's current name, not the one stamped on an old op — a gate that
 * says who somebody USED to be is a gate nobody can act on.
 *
 * **The registry is asked FIRST, and that is the fix rather than the
 * tidy-up.** `collectCanvasActors` walks canvas state, so it knows the
 * people who have written something here — which is exactly not the person
 * a fresh gate usually names: enrolling an agent and pointing it at
 * yourself is often the first thing you do on a canvas, and it left `who`
 * printing *listens to usr_nico*. An unreadable gate is the silent gate in
 * different clothes, so the map that knows everyone the home knows is the
 * one that answers.
 */
export declare function actorNamesOn(snapshot: CanvasSnapshotResponse): Map<string, string>;
export declare function nameResolver(snapshot: CanvasSnapshotResponse): (actorId: string) => string | undefined;
/** Optional thread, item, and non-owner standing context carried in a summons prompt. */
export interface SummonsContext {
    /** The full thread the summoning comment is in, including earlier comments. */
    thread?: {
        id: string;
        comments: Array<{
            id: string;
            author: string;
            body: string;
        }>;
    };
    /** The item the thread is anchored on, or the first changed item. */
    item?: {
        id: string;
        kind: string;
        title: string;
    };
    /** Present when the turn was woken by someone other than the machine's owner (#273). */
    wokenBy?: {
        asker: string;
        owner: string;
    };
}
/** The fixed brief around the wait-shaped payload (phase 4's door):
 * identical for fresh and loaded sessions — delivery differs, content
 * never does — with orientation and the guide pointer carrying the
 * cold-arrival weight instead of 15k inlined tokens, and the thread,
 * anchored item (`id`, `kind`, `title`) and non-owner standing (#273)
 * carried right in the summons so the first command of a turn can be
 * the edit. */
export declare const summonsPrompt: (canvasTitle: string, agentName: string, payload: {
    reason: string;
    entries: WatchedLogEntry[];
}, context?: SummonsContext) => string;
