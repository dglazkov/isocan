/**
 * **Taking down is not deleting** — the shared half of
 * `docs/projects/operator/design.md`, "Take a canvas down" (operator phase 2).
 *
 * A delete is the owner's: an op, into the log, broadcast as `canvas-deleted`,
 * erasing the copy on every linked daemon and every tab. A takedown is the
 * home's: it stops serving the canvas, **leaves every replica's copy where it
 * is**, and can be lifted. That is the innkeeper line — sovereignty by replica
 * means the operator cannot reach a laptop, and a takedown that erased Priya's
 * copy would be the operator reaching one.
 *
 * So the two must not be spellable as one another anywhere, on any surface,
 * and that is what this file is for: one close reason, one refusal code, one
 * row shape and one sentence, so a daemon, a tab and a terminal cannot each
 * invent their own reading of what happened. Everything here is data and pure
 * functions; the acting lives in `packages/server`, where the desk is.
 *
 * **What is deliberately NOT here:** the note. `CanvasTakedown` carries it
 * because the DESK's row does, and the desk's row is innkeeper-private — but
 * {@link takedownSentence} never reads it, and the shape a surface is handed
 * (`TakedownNotice`) has no field for it. The reason category is shown; the
 * operator's note is his (design, "Words", and Dimitri's open question 5).
 */
import type { OperatorReach } from "./operator.js";
import type { PurgeCounts } from "./purge.js";
/**
 * **The close reason, and the refusal code, for a canvas its home has stopped
 * serving.**
 *
 * One word, and short on purpose: a WebSocket close reason is capped at 123
 * BYTES by the protocol and a longer one THROWS rather than truncating, so the
 * socket carries this and the sentence is fetched by whoever renders it.
 *
 * It rides where `withdrawn` rides — as the `reason` on a `not-admitted`
 * refusal and as the reason on a `WS_NOT_ADMITTED` close — because it is the
 * same kind of fact about the same kind of moment, and every client that
 * already branches on `withdrawn` is already looking in the right place.
 *
 * **What it must never be is `canvas-deleted`.** That message means *forget
 * your copy*: a linked daemon soft-deletes its own store and a tab drops its
 * IndexedDB replica. Sending it for a takedown would make the one act the
 * design calls out as impossible — the operator reaching a laptop — happen by
 * accident, in a line nobody would think to read twice. Distinct here so the
 * distinction cannot be lost in a translation.
 */
export declare const TAKEN_DOWN = "taken-down";
/**
 * **The reason category, from a short list**, which is the half the affected
 * person is shown (design, "Words"; Dimitri's open question 5, proposed yes).
 *
 * Short on purpose, and closed on purpose. A free-text reason on a surface
 * strangers read is an operator writing a sentence about somebody in public,
 * in a hurry, with no one reviewing it; a category is a fact about which rule
 * was applied. The operator's own account of it goes in the note, which
 * nobody but the operator reads.
 *
 * The words are the ones the terms page already uses for what comes down:
 * *content that is illegal, or that exists to hurt somebody*.
 */
export declare const TAKEDOWN_REASONS: {
    readonly "stolen-content": "stolen content";
    readonly "illegal-content": "illegal content";
    readonly "sexual-content-involving-minors": "sexual content involving minors";
    readonly harassment: "harassment";
    readonly malware: "malware";
    readonly spam: "spam";
    readonly impersonation: "impersonation";
    readonly "legal-demand": "a legal demand";
    readonly other: "a reason the operator did not put in this list";
};
/** One of {@link TAKEDOWN_REASONS}' keys. */
export type TakedownReason = keyof typeof TAKEDOWN_REASONS;
/** Is this string one of the categories — asked at the route, so a reason
 * nobody can render never reaches a row. */
export declare function isTakedownReason(raw: string): raw is TakedownReason;
/** The categories, for a `--reason` that was wrong or missing. */
export declare function takedownReasonList(): string;
/**
 * **The desk's row** — `takedowns/{canvasId}` on Firestore, a line type in the
 * file desk's log (design, "Mechanism").
 *
 * One row per canvas, rewritten by a lift rather than deleted, because the
 * record of a takedown that was lifted is exactly the record journey 5 step 3
 * asks for: *the log holds both rows, each with its proof*. The ledger holds
 * the acts; this row holds the standing state and the words the surfaces show.
 *
 * **It is not the flag.** The flag that makes `load` refuse is on the STORE
 * (`takenDownAt`), beside `deleted`, and this row is on the DESK, beside
 * grants. Two backings, two reasons: the store's flag is what stops the bytes
 * being served and has to be true for the loader with no desk in hand; this
 * row is the home's private record of why, and carries a note the loader must
 * never see.
 */
export interface CanvasTakedown {
    canvasId: string;
    /** When it came down, ISO. The date in the sentence. */
    at: string;
    reason: TakedownReason;
    /** The operator's own note — innkeeper-private, never on any surface an
     * affected person reads. `takedownSentence` cannot reach it. */
    note?: string;
    /** The attribute that was proved — `email:olu@example.test`. The address the
     * sentence tells people to write to, and it is the operator who ACTED rather
     * than a name read out of configuration: a home with two operators must not
     * send Kai to whichever one is first in the list. */
    by: string;
    /** The ledger row (`opr_…`) that did it, so the sentence and the proof that
     * justified it are one lookup apart. */
    actId: string;
    /** Set by `--lift`; the row stays, so both halves are readable. A row with
     * this set is not in force. */
    liftedAt?: string;
    liftedBy?: string;
    liftedActId?: string;
    /**
     * **Set by a purge, and never cleared** (operator phase 3). A row with this
     * set cannot be lifted: the home holds nothing under the id any more, and a
     * lift would clear the flag on a tombstone and serve an empty canvas under
     * a taken name. The counts ride here because journey 6 step 3 says the
     * record stays — *who made it, when it came down, why, and the counts* —
     * and this row is where the first three already live.
     */
    purgedAt?: string;
    purgedActId?: string;
    purged?: PurgeCounts;
}
/** Is this row in force — the one question every reader of a row asks. A
 * purged canvas is down forever, so a purged row is always in force. */
export declare function inForce(row: CanvasTakedown): boolean;
/**
 * **What a surface is handed**, and it is deliberately thinner than the row.
 *
 * No note, and no `actId`: this shape crosses the wire to a tab, a terminal
 * and a replica, and the two fields it drops are the two the design calls
 * innkeeper-private. A type that could carry them is a type somebody
 * eventually fills in.
 */
export interface TakedownNotice {
    canvasId: string;
    at: string;
    reason: TakedownReason;
    /** The operator's address, for the sentence's *Write to …*. */
    by: string;
    /** The sentence itself, rendered by the HOME. The words come from the home
     * and not from whichever client is drawing them (design, "Not an op"), so a
     * tab running last month's bundle says what this home says today. */
    sentence: string;
}
/** A row, as a surface may see it. */
export declare function noticeOf(row: CanvasTakedown): TakedownNotice;
/**
 * **The sentence** (design, "Words"; journey 4 step 1, verbatim):
 *
 * > This canvas was taken down by the operator of this home on 12 September
 * > 2026: stolen content. Write to olu@example.com.
 *
 * *"It does not say* not found*, and it does not say* your access was
 * withdrawn*, because neither is what happened."* The whole message is the
 * difference between *there is nothing here* and *this was removed, and here
 * is who to ask* — so the three things it must carry are the date, the reason
 * category, and an address, and it must be one sentence a person can paste
 * into an email.
 *
 * Rendered here rather than in each surface for the reason `protocol.ts` gives
 * about every other refusal: three spellings of one sentence is three
 * sentences, and the one that drifts is the one somebody reads.
 */
export declare function takedownSentence(row: Pick<CanvasTakedown, "at" | "reason" | "by">): string;
/**
 * `2026-09-12` → `12 September 2026`.
 *
 * UTC, and not the reader's zone. A takedown's date is a fact about the home's
 * record — the same date in the ledger, in the terminal that did it, and in
 * the mail Kai gets — and a tab in Auckland rendering the day after would be
 * two dates for one act. `elapsedLabel`'s relative words are wrong here for
 * the same reason: this sentence is read months later, quoted in a reply.
 */
export declare function takedownDate(iso: string): string;
/** The same date, short, for a line in a table — `12 Sep`. */
export declare function takedownDateShort(iso: string): string;
/** `POST /api/operator/canvases/:id/takedown`. */
export declare const OPERATOR_TAKEDOWN_ROUTE = "/api/operator/canvases/:id/takedown";
/** `POST /api/operator/canvases/:id/look`. */
export declare const OPERATOR_LOOK_ROUTE = "/api/operator/canvases/:id/look";
/**
 * `GET /api/takedowns` — the takedowns in force at this home, for the canvases
 * the CALLER may see.
 *
 * **Not an operator route**, which is the point of it: it is where the
 * affected people read the sentence. The canvas list is drawn from
 * `/api/projects`, which answers a bare `Canvas[]` that every surface in this
 * repo already parses; bolting a field onto it would put a takedown on the
 * replicated canvas record, which is the one place it must never be — a field
 * on `Canvas` travels to every replica, and a replica that read it would stop
 * opening its own copy. So it is a second, small read beside the list, empty
 * on nearly every home, and the list keeps its shape.
 */
export declare const TAKEDOWNS_ROUTE = "/api/takedowns";
/**
 * What `GET {@link TAKEDOWNS_ROUTE}` answers.
 *
 * Two shapes from one route, and the caller says which by whether it names a
 * canvas:
 *
 * - **No `?canvas=`** — the takedowns in force among the canvases this badge
 *   may see. The canvas list's read: it draws the row greyed with the sentence
 *   rather than hiding it, so the owner is TOLD (journey 4 step 3).
 * - **`?canvas=<id>`** — the one notice, answered to anybody who asks about
 *   that id. Deliberately not narrowed, because the door already tells them:
 *   every canvas route refuses a taken-down canvas WITH the sentence, and a
 *   second read that refused to repeat it would make *this was removed, and
 *   here is who to ask* depend on which surface you happened to be standing
 *   on. A stranger who has the address learns the same thing either way.
 */
export interface TakedownsResponse {
    takedowns: TakedownNotice[];
}
/** `GET /api/takedowns?canvas=<id>` — one canvas, for anybody who asks. */
export declare const TAKEDOWNS_CANVAS_PARAM = "canvas";
/**
 * **How long a look lasts** — an hour (design, "The look": *the door honours
 * it for an hour*).
 *
 * One constant rather than a number in three files, for
 * `OPERATOR_PROOF_WINDOW_MS`'s reason: it is a judgement about how long the
 * operator needs to read a canvas and decide, and the day it changes it must
 * change in one place. Note how differently it is scaled from the proof
 * window: ten minutes is how fresh a SIGN-IN must be, and an hour is how long
 * the looking may take. A proof is for an act; a look is the act.
 */
export declare const OPERATOR_LOOK_MS: number;
/** What `isocan operator look` sends: one field, and the route refuses
 * without it. */
export interface OperatorLookRequest {
    /** Why. Required by the route, because a look is unannounced and the ledger
     * row is the only record that it happened. */
    reason: string;
}
/** What it is answered: the window, the pass, and what is there — so the
 * terminal prints the reach before a browser opens. */
export interface OperatorLookResponse {
    /** When the admission stops being honoured, ISO. */
    until: string;
    /** The pass, `<passId>.<secret>`, handed over once. Put in the address the
     * operator opens; `arrival.ts` in the web app redeems it. */
    token: string;
    /** What is there, so the terminal prints the reach before the browser opens
     * — every operator verb prints its reach (design, "Both surfaces"). */
    reach: OperatorReach;
}
/**
 * **The address the operator opens** — the deck, with the pass in the
 * fragment.
 *
 * The deck because journey 2 step 2 says so: *his browser opens the canvas as
 * the deck, read-only*. The fragment because that is where a pass has always
 * travelled in this system (`urlWithPass`), and because a fragment is not sent
 * to the server — which for a bearer credential is the difference between a
 * token in one tab and a token in an access log.
 *
 * Built here rather than by the home, because the home cannot know its own
 * public address from behind a proxy and the terminal already holds it: it is
 * the origin it just proved at.
 */
export declare function operatorLookUrl(home: string, canvasId: string, token: string): string;
/** What `isocan operator takedown` sends. One shape for both directions: a
 * lift is the same act with `lift`, not a second verb. */
export interface OperatorTakedownRequest {
    reason?: string;
    note?: string;
    /** Lift the takedown that is in force, rather than making one. Journey 5. */
    lift?: boolean;
}
/** What it is answered — the row that now stands, what the act reached, and
 * the one line the home cannot do for itself. */
export interface OperatorTakedownResponse {
    /** The row as it now stands, lifted or not. */
    takedown: CanvasTakedown;
    /** What the act actually reached, in the numbers the verb prints — journey
     * 3 step 2: *two tabs closed, one wait ended, one replica told*. Counted at
     * the moment of acting rather than estimated. */
    reach: TakedownReach;
    /** The one line the home cannot do for itself: a copy at the edge may be
     * served for up to five minutes, and here is the command that clears it.
     * Null on a home with no CDN in front of it, which is every local one —
     * printing a `gcloud` line to somebody running a laptop would be noise
     * dressed as an instruction. */
    cdn: CdnPurge | null;
}
/** What a takedown reached, counted. */
export interface TakedownReach {
    /** Sockets closed with {@link TAKEN_DOWN} — tabs and linked daemons, at this
     * instance. A second instance during a rollout is not reached, which is the
     * same bound the sweep lives with (design). */
    sockets: number;
    /** Parked `isocan wait` calls woken and refused. */
    waits: number;
    /** Parked rc holds ended for this canvas. */
    holds: number;
    /** Daemons relaying presence for it right now, which is the honest count of
     * replicas this home can name — there is no registry of machines that have
     * ever linked (operator phase 1's trajectory). */
    relays: number;
    /** Blobs under the canvas, and their bytes: what STOPS being served at the
     * content origin from now, and what a purge would later erase. */
    files: number;
    bytes: number;
}
/**
 * **The five-minute line** — journey 3 step 2's *one line it cannot do for
 * him*.
 *
 * A verified content read goes out `public, max-age=<what is left>` and
 * nothing in the tree invalidates the edge, so a frame already cached is
 * served until it ages out. The daemon does not invalidate it itself and is
 * not going to: that would mean handing the daemon's service account compute
 * rights on the load balancer, a standing power for a rare act (design, "What
 * it reaches"). So the verb prints the command instead, and the operator runs
 * it as himself.
 */
export interface CdnPurge {
    /** How long an already-cached copy may still be served, in seconds. */
    horizonSeconds: number;
    /** The exact command to paste. */
    command: string;
}
