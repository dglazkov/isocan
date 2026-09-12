/**
 * **The operator's wire, and nothing about who the operator is** — the shared
 * half of `docs/projects/operator/design.md`, phase 1.
 *
 * The thesis the design is written on is *the operator is a proof, not a
 * credential*: an address the home's configuration names, proved fresh for
 * each act by the attester the home already borrows, carried with the act and
 * stored nowhere. Core holds the parts of that all three surfaces have to
 * spell identically — the header the proof rides in, the routes it is
 * presented at, the refusal codes, the ledger row's shape, and the two pure
 * rules the prove page and the CLI would otherwise each invent (what a
 * loopback destination is, and where the handoff lives in an address).
 *
 * **What is deliberately NOT here**, for `attest.ts`'s reason: core does not
 * know what an ID token is, does not know that `auth_time` exists, and cannot
 * read `ISOCAN_OPERATORS`. It knows a caller presents *a proof from the
 * attester this home named* and that the home answers yes, `not-operator` or
 * `proof-stale`. The judging lives in `packages/server/src/operator.ts`, where
 * the configuration is; the same bundle runs at a home that has an operator
 * and at one that never will, and the difference arrives at run time as data.
 *
 * **And no `Operation`.** An operator act is a desk write and a ledger row,
 * never an op (design, "Not an op"): the vocabulary is closed and isomorphic,
 * the log replicates and belongs to the members, and the log cannot carry
 * authority. So nothing in this file touches `ops.ts`, and the op count stays
 * where the architect persona measures it.
 */
import type { CanvasTakedown } from "./takedown.js";
/**
 * **The one header the proof rides in.**
 *
 * Beside `Authorization`, never instead of it: "the request still carries its
 * badge through the door unchanged, so the ledger knows which surface carried
 * the proof" (design, "A proof, carried with the act"). Two credentials on one
 * request, answering two different questions — *which surface is this* and
 * *is a person at a sign-in page right now* — and collapsing them would be the
 * operator standing on a badge that D2 refuses.
 */
export declare const OPERATOR_PROOF_HEADER = "x-isocan-operator-proof";
/**
 * How fresh a sign-in has to be, in milliseconds. Ten minutes — "sudo's window
 * with the timestamp file removed" — and open question 2 for Dimitri, so it is
 * one constant rather than a number in three files.
 */
export declare const OPERATOR_PROOF_WINDOW_MS: number;
/** `GET /api/operator/canvases/:id` — what the home holds under that id. */
export declare const OPERATOR_SHOW_ROUTE = "/api/operator/canvases/:id";
/** `GET /api/operator/log` — the ledger, which only the operator reads. */
export declare const OPERATOR_LOG_ROUTE = "/api/operator/log";
/** Every operator route lives under this, and the no-attester sentence is
 * answered for the whole prefix rather than per route. */
export declare const OPERATOR_API_PREFIX = "/api/operator/";
/**
 * **This home names its operators in its configuration, and has none.**
 *
 * A home with no attester has no proof to check and therefore no operator path
 * over HTTP — "stated, not papered over" (design, "Who the operator is"). The
 * same code answers the other half of that sentence, a home whose attester is
 * borrowed but whose list is empty: both are *nobody can prove they run this
 * home*, and the message says which.
 */
export declare const NO_OPERATOR = "no-operator";
/**
 * **The proof was good and the address is not on the list**, and the refusal
 * names the address that was proved (journey 1 step 5). Naming it is the whole
 * value: a person who proved the wrong one of their two Google accounts needs
 * to be told which one arrived, and a person who is simply not the operator
 * learns nothing they did not know.
 */
export declare const NOT_OPERATOR = "not-operator";
/**
 * **The address is on the list and the sign-in is too old** (journey 1 step 6:
 * *a proof is for an act, not for a day*). Its own code rather than a flavour
 * of `not-operator`, because the remedy is different and automatic: prove
 * again, which the CLI does by opening the page again.
 */
export declare const PROOF_STALE = "proof-stale";
/**
 * **Nothing was presented.** Its own code rather than a flavour of
 * `not-operator`, because it is the one an AGENT meets: a caller that reached
 * an operator route holding only a badge. `not-operator` names an address that
 * was proved, and there is none — saying "you proved nothing, which is not one
 * of them" would be a sentence about a person who was never there.
 */
export declare const NO_OPERATOR_PROOF = "no-operator-proof";
/** The refusals a surface may meet from an operator route. */
export type OperatorRefusalCode = typeof NO_OPERATOR | typeof NOT_OPERATOR | typeof PROOF_STALE;
/**
 * **Where the browser makes the proof**, and the handoff rides in the PATH.
 *
 * Not in the query, and the reason is measured rather than stylistic. The
 * magic-link path returns through `/__/auth/action`, which resolves the
 * provider's `continueUrl` and keeps the path (`authaction.ts`); the provider
 * appends `continueUrl` to its link **unencoded**, so a second `&`-separated
 * parameter inside it is parsed as a parameter of the outer link and never
 * reaches the landing page. One opaque segment survives that round trip; a
 * query string does not survive it whole.
 */
export declare const PROVE_PATH_PREFIX = "/operator/prove";
/**
 * What a terminal asks the browser to do, carried in that one segment.
 *
 * `to` is the whole destination rather than a port, so the page's refusal is
 * about the address it was actually handed — `loopbackRefusal` reads a URL and
 * a page that only ever received a port could not be tested for the thing it
 * exists to refuse.
 */
export interface OperatorHandoff {
    /** Where the token goes: a loopback address the terminal is listening on.
     * Anything else is refused by {@link loopbackRefusal}, unread. */
    to: string;
    /** The terminal's nonce, handed back with the token so a second browser tab
     * cannot feed it a proof it did not ask for. */
    state: string;
    /** The act, in the words the page shows BEFORE it asks for anything:
     * *show prj_…*. Journey 1 step 2 — "before anything else it says what the
     * terminal asked for". */
    act: string;
}
/**
 * The handoff as one URL-safe segment.
 *
 * base64url of compact JSON: opaque to the provider's link, carried whole
 * through `/__/auth/action`, and readable by nothing that needs to be told
 * about it. Not a signature and not a secret — everything in it is the
 * terminal's own request, shown to the person before they act on it, and the
 * page trusts none of it further than `loopbackRefusal` allows.
 */
export declare function encodeHandoff(handoff: OperatorHandoff): string;
/**
 * The handoff a page landed carrying, or null when the segment is not one.
 *
 * Total, deliberately: a mistyped or truncated address is a person who clicked
 * something, and the page says so in a sentence rather than throwing.
 */
export declare function decodeHandoff(segment: string): OperatorHandoff | null;
/** The address to open in a browser, on a home, for one act. */
export declare function provePath(handoff: OperatorHandoff): string;
/** The handoff segment in a path this page was loaded at, or null. */
export declare function proveSegmentIn(pathname: string): string | null;
/**
 * **Why this destination is not one this page will hand a token to**, or null
 * when it is.
 *
 * The page holds, for a few seconds, a live credential for a listed address.
 * The address it posts that to arrives in a link — which means it arrives from
 * whoever wrote the link, and the sentence above the button is not a defence
 * against a person who was told to click it. So the rule is the same one
 * `authaction.ts` takes with `continueUrl`: not validation-and-allow over a
 * host the caller chose, but a shape narrow enough that there is nothing left
 * to be wrong about.
 *
 * `http://` on a loopback LITERAL only. Not `localhost` — a name resolves, and
 * what it resolves to is the resolver's business rather than this page's; a
 * home on a network where `localhost` has been pointed somewhere else would
 * post the proof there. Not `https`, because a loopback listener with a
 * certificate is not a thing a CLI can be. No credentials in the address, no
 * default-port games: the terminal picked a port and everything else is fixed.
 */
export declare function loopbackRefusal(to: string): string | null;
/**
 * **What the home writes down before it answers** — the ledger row (design,
 * "The record"): `operator/{id}` on Firestore, a line type in the file desk's
 * log.
 *
 * Written BEFORE the act answers, so a crash leaves a row saying the act was
 * attempted. Append-only; a lift is a new row naming the one it lifts. The
 * project's one rule for every phase, from the first act in phase 1.
 */
export interface OperatorAct {
    /** `opr_…`. Not `op_` — that prefix belongs to entries in a canvas log, and
     * an operator act is emphatically not one (design, "Not an op"). */
    id: string;
    /** `show`, `log`, and — in later phases — `look`, `takedown`, `purge`,
     * `end`, `revoke`, `refuse`. Free text rather than a union, for
     * `verifiedVia`'s reason: the row is a record of what happened, and a union
     * here would need editing before a later phase could write one. */
    act: string;
    /** The id a report named: a canvas, a badge, an actor, an address. Null for
     * an act with no target — reading the ledger itself. */
    target: string | null;
    /** The reason category the affected person is shown. Absent in phase 1:
     * `show` and `log` change nothing and tell nobody. */
    reason?: string;
    /** The operator's own note, never shown to anybody else. */
    note?: string;
    /** What was proved, and how fresh it was. Never the token: `tokenHash` is
     * how two rows are recognised as one sign-in without the ledger becoming a
     * place a live credential is stored. */
    proof: OperatorProofRecord;
    /** The badge the request carried through the door — which surface acted. */
    badgeId: string | null;
    at: string;
    /** What the act reached, in the shape the verb printed. */
    reach?: unknown;
    /** `done`, or the refusal code. Written as `attempted` first and settled
     * after; a row still saying `attempted` is a crash, which is the point. */
    outcome: string;
}
/** The proof as the ledger keeps it: what, when, and a hash — never a token. */
export interface OperatorProofRecord {
    /** The normalized attribute the token proved — `email:someone@example.com`.
     * Present even on a `not-operator` row: the refusal's whole content is which
     * address arrived. */
    attribute: string;
    /** `auth_time`, ISO. When the person was last at a sign-in page. */
    authTime: string;
    /** SHA-256 of the token, hex. Two acts from one sign-in share it. */
    tokenHash: string;
}
/** What `GET {@link OPERATOR_SHOW_ROUTE}` answers: the reach, and nothing that
 * would be a roster. */
export interface OperatorShowResponse {
    reach: OperatorReach;
    /**
     * **The takedown row, when there is one** (operator phase 2), lifted or not.
     *
     * Phase 1 left an open finding here: `show` on a canvas that is not servable
     * was a 404, and `OperatorReach` had nowhere to say otherwise — *this was
     * removed, and here is who to ask* versus *there is nothing here* is
     * precisely the distinction the design calls the whole message, and the
     * operator's own read could not make it. This is where it comes from.
     *
     * The whole ROW rather than the notice, because the reader is the operator:
     * he is the one person the note was written for, and the act id is how he
     * gets from here to the proof in the ledger.
     */
    takedown?: CanvasTakedown;
}
/**
 * **What the home holds under that id** (journey 1 step 4).
 *
 * Counts and one name. "No names of people other than the maker" is the line,
 * and it is the same rule `http.ts:4280` states about badges: a listing would
 * be a roster. So `badges` is a number, `sockets` is a number, and the only
 * person named is the one whose canvas it is.
 */
export interface OperatorReach {
    canvasId: string;
    title: string;
    /** Who made it, by name and actor id. */
    madeBy: {
        id: string;
        name: string;
    };
    at: string;
    /**
     * **There is deliberately no `deleted` here yet**, and the absence is a note
     * for phase 2 rather than an oversight. `engine.getSnapshot` refuses a
     * soft-deleted canvas exactly as it refuses one that never existed, so the
     * only honest answer this route can give about one today is the 404 it
     * already gives — and *this was removed, and here is who to ask* versus
     * *there is nothing here* is precisely the distinction the design's record
     * section calls the whole message. Takedown is the act that needs it, and
     * `store.canvasExists` (true for a tombstone) is where it comes from.
     */
    /** The link grant's capability (`view`, `edit`, `own`), or null when the
     * link is off. Journey 1's "whether the link is on". */
    link: string | null;
    /** Live grants on the canvas, counted by kind. Numbers, not subjects. */
    grants: number;
    /** Badges the desk has admitted, living ones only. */
    badges: number;
    /** Sockets open on it right now, at this instance. */
    sockets: number;
    /** Blobs stored under it, and their bytes. */
    files: number;
    bytes: number;
    /** Which homes and replicas are linked to it, by home address. */
    replicas: string[];
}
/** What `GET {@link OPERATOR_LOG_ROUTE}` answers. Newest first. */
export interface OperatorLogResponse {
    acts: OperatorAct[];
}
