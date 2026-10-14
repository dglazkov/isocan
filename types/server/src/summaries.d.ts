import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Desk } from "./desk.js";
import type { Engine } from "./engine.js";
import { type ViewOnlyError } from "./grants.js";
import type { HomeLinks } from "./home-links.js";
import type { Store } from "./store.js";
import { type Refusals } from "./takedowns.js";
import type { TextModel } from "./text.js";
/**
 * **Semantic Zoom's summaries, at the home** (`docs/projects/semantic-zoom/`,
 * design §5 and §6; text nodes since phase 1, groups and areas since phase 2).
 *
 * A summary is derived, regenerable and nobody's act, so it is not an op: it
 * lives in a cache beside the snapshots, `<home>/summaries/<canvasId>/<key>.json`,
 * and never in undo, the timeline, the oplog or a replica's history. Two
 * routes:
 *
 * - `GET  /api/projects/:id/summaries?keys=…&for=…` — the cached entries for
 *   the keys asked about. View is enough: a summary says nothing a viewer
 *   could not read by zooming in. With `for` (the source ids, in the keys'
 *   order), a key with no entry is answered with the newest entry for that
 *   source, marked `stale` — the old summary keeps showing while the new
 *   content waits to be summarised.
 * - `POST /api/projects/:id/summaries` `{ kind, sourceId }` — make one. The
 *   home, not the client, collects the content and builds the prompt, so a
 *   client cannot ask about what it cannot see or slip excluded words in. It
 *   then passes `/api/text`'s guards in-process — edit capability, owner-only
 *   spend unless shared, the badge's rate, the size — and asks the text model
 *   with its own system line and its own model (the cheap tier), so what
 *   `/api/text`'s callers get is unchanged. A group or an area is collected
 *   here too (`summaryMembers`): a client names the container, never its
 *   members, and over the size bound the longest members' words are left
 *   out first, their titles kept, and the prompt says so.
 *
 * A source changed in the last 30 s is not summarised yet (202,
 * `summary-quiet`, with how long to wait); one make per key is in flight at a time, and a second
 * request for the same key waits for the first and spends nothing.
 *
 * Since phase 3, a canvas has a budget — 60 model calls an hour across
 * everyone, beyond the badge's rate; over it a make is a 429
 * (`summary-budget`) and nothing is asked, while reads keep answering, stale
 * included — and a cost record per day (`summary-ledger.ts`), read by the
 * canvas's editors at `GET …/summaries/stats`. The cache evicts what nobody
 * can reach before what nobody has read lately.
 *
 * Since phase 3b, a summary may **look at pictures** (design §11): a make
 * with `vision: true` sends, beside the words, the pictures of the screens
 * and pictures it holds (`summary-pictures.ts`: at most 1024 px on the long
 * side, at most eight, the largest on the canvas first), and a screen or a
 * picture alone may be summarised (kind `screen`, only ever with vision).
 * `vision` is part of the key only where a picture would be sent, so a text
 * node's key never changes and only items with pictures gain a second
 * entry. A read gets a vision entry only when it says `vision=1`; without
 * it, never — not even as a stale stand-in. A model that takes no pictures
 * refuses such a make (`summary-no-pictures`), and calls with pictures have
 * an hourly budget of their own inside the canvas's (`summary-vision-budget`).
 */
/** How the summaries are configured: every field has a production default; the fields exist so a test can hold a clock and a small bound. */
export interface SummaryOptions {
    /** The quiet period. Default `ISOCAN_SUMMARY_QUIET_MS`, else `SUMMARY_QUIET_MS`. */
    quietMs?: number;
    /** The model. Default `ISOCAN_SUMMARY_MODEL`, else `SUMMARY_MODEL` for a Claude key and the text model's own default for any other. */
    model?: () => string | undefined;
    /** Entries kept per canvas before the least recently read is evicted. Default 2,000. */
    maxEntries?: number;
    /** Model calls per canvas per rolling hour, across everyone. Default `ISOCAN_SUMMARY_PER_HOUR`, else 60. */
    perHour?: number;
    /** Of those, calls that send pictures (design §11). Default `ISOCAN_SUMMARY_VISION_PER_HOUR`, else 15. */
    visionPerHour?: number;
    now?: () => number;
}
/** What `registerModelRoutes` hands over: its closures, its text model and its owner-only rule. */
interface SummaryRouteScope {
    engine: Engine;
    store: Store;
    desk: Desk;
    homes: HomeLinks | null | undefined;
    refusals: Refusals;
    admit: (req: FastifyRequest, canvasId: string) => Promise<unknown>;
    viewOnly: (canvasId: string) => Promise<ViewOnlyError>;
    textModel: TextModel;
    /** Whose key pays: null when this badge may spend it, else the owner's name (`notTheOwners`). */
    notTheOwners: (req: FastifyRequest) => Promise<{
        owner: string | null;
    } | null>;
    /** This machine's person, for `madeFor` when the stored key paid. */
    keyOwner: () => Promise<string | null>;
    options: SummaryOptions;
}
/** `GET` and `POST /api/projects/:id/summaries`, on `app`. */
export declare function registerSummaryRoutes(app: FastifyInstance, scope: SummaryRouteScope): void;
export {};
