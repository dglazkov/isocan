/**
 * **Refuse at the door** — the shared half of
 * `docs/projects/operator/design.md`, "Refuse at the door" (operator phase 6;
 * journey 9).
 *
 * A home-scope refusal is a desk row naming one of four subjects the home
 * can actually tell apart, and it is the roles bar moved to home scope:
 *
 * | Subject         | Read at                              | Refuses                                   |
 * | --------------- | ------------------------------------ | ----------------------------------------- |
 * | `email:`/`repo:`| the door hook, `/api/attest`         | every canvas and create for a badge that  |
 * |                 |                                      | proved it; proving it at all              |
 * | `actor:`        | `actor.claim {as}`                   | resuming that actor — the name stops      |
 * |                 |                                      | coming back                               |
 * | `net:<cidr>`    | the mint meter                       | minting a badge from that network;        |
 * |                 |                                      | expires by default, 24 hours              |
 *
 * This file is the words, the codes, the row and the two pure rules every
 * surface would otherwise each invent — what a subject is, and whether an
 * address is inside a network. Everything here is data and pure functions;
 * the acting lives in `packages/server`, where the desk and the registry are.
 *
 * **What is deliberately NOT here:** the note. `HomeRefusal` carries it
 * because the DESK's row does, and the desk's row is innkeeper-private —
 * but {@link refusalSentence} never reads it, and the shape a surface is
 * handed (`RefusalNotice`) has no field for it. The reason category is shown;
 * the operator's note is his (design, "Words").
 */
import type { EndReach } from "./ended.js";
import { type TakedownReason } from "./takedown.js";
export { REFUSED } from "./errors.js";
/** `POST /api/operator/refuse/:subject` — the subject a report names, in the
 * path, URL-encoded (a `net:` subject carries a slash). */
export declare const OPERATOR_REFUSE_ROUTE = "/api/operator/refuse/:subject";
/**
 * **A network refusal ends on its own, by default a day later**, because
 * addresses are shared and reassigned (journey 9 step 3). One constant, for
 * `OPERATOR_PROOF_WINDOW_MS`'s reason: it is a judgement about how long a
 * flood's network stays that flood's, and the day it changes it changes here.
 */
export declare const NET_REFUSAL_DEFAULT_MS: number;
/** The four kinds of subject. `email` and `repo` are the attested kinds a
 * badge proves; `actor` is a name; `net` is where a knock came from. */
export type RefusalKind = "email" | "repo" | "actor" | "net";
/**
 * **The desk's row** — `refusals/{subject}` on Firestore, a line type in the
 * file desk's log. One row per subject, rewritten by a lift rather than
 * deleted, for the takedown row's reason: "is this subject refused" is asked
 * on a request path and must not be a question two rows could both answer,
 * and the record of a refusal that was lifted is exactly what the operator
 * reads when the person writes back.
 *
 * **It is not the ledger.** The refuse act and the lift act are both in
 * `operator/`, each with its proof; this row is what they leave behind — the
 * standing state and the words the surfaces show.
 */
export interface HomeRefusal {
    /** Normalized: `email:sam@example.com`, `repo:github.com/acme/site`,
     * `actor:usr_…`, `net:203.0.113.0/24`. The registry's key. */
    subject: string;
    kind: RefusalKind;
    /** When it was refused, ISO. The date in the sentence. */
    at: string;
    reason: TakedownReason;
    /** The operator's own note — innkeeper-private, never on any surface an
     * affected person reads. `refusalSentence` cannot reach it. */
    note?: string;
    /** The attribute that was proved — `email:olu@example.test`: the operator
     * who ACTED, so a home with two operators sends the person to the one who
     * decided. */
    by: string;
    /** The ledger row (`opr_…`) that did it. */
    actId: string;
    /** When it stops being in force on its own, ISO. Always set on a `net:`
     * row; set on the others only by `--for`. */
    expiresAt?: string;
    /** Set by `--lift`; the row stays. A row with this set is not in force. */
    liftedAt?: string;
    liftedBy?: string;
    liftedActId?: string;
}
/**
 * **Is this row in force right now** — the one question every reader asks,
 * and the one place the clock enters. A lifted row is history; an expired row
 * is history that nobody had to lift, which is the whole point of `--for`.
 */
export declare function refusalInForce(row: Pick<HomeRefusal, "liftedAt" | "expiresAt">, now: number): boolean;
/**
 * **What somebody typed, as a refusal subject — or null.**
 *
 * Total and strict: an address is normalized the way grant subjects and
 * attestations are, so the door's equality is over two strings folded by the
 * same function; a network is parsed and re-spelled from its bits, so
 * `203.0.113.7/24` and `203.0.113.0/24` are one row; an actor id passes
 * through untouched because ids are case-sensitive. Anything else is null,
 * and {@link refusalSubjectRefusal} says why in words.
 */
export declare function refusalSubjectOf(raw: string): {
    subject: string;
    kind: RefusalKind;
} | null;
/** Why that is not a refusal subject, or null when it is. */
export declare function refusalSubjectRefusal(raw: string): string | null;
/** A parsed network: which family, its bits as one integer, and its prefix. */
export interface Cidr {
    version: 4 | 6;
    /** The network address, as bits — masked to the prefix. */
    bits: bigint;
    prefix: number;
}
/**
 * **A network, parsed and masked**, or null. `203.0.113.7/24` yields the
 * network `203.0.113.0/24`; a bare address is that address alone (`/32`,
 * `/128`). IPv6 is the compressed form a client presents in
 * `X-Forwarded-For`, and the one shape of it this needs to read.
 */
export declare function parseCidr(text: string): Cidr | null;
/**
 * **Is this address inside that network** — the mint meter's whole question,
 * asked with the key the meter already computed. An address of the other
 * family is never inside; an address that does not parse is never inside,
 * which is the safe direction: a refusal cannot be widened by a malformed
 * header.
 */
export declare function cidrContains(cidr: Cidr, address: string): boolean;
/**
 * **`--for 24h`, as milliseconds**, or null for anything that is not a
 * duration. `30s`, `10m`, `24h`, `7d` — one unit, a whole number, no spaces:
 * the shapes `elapsedLabel` already prints, read back. Zero is not a duration
 * (a refusal for no time is not a refusal) and neither is a bare number,
 * because a number with no unit is a number somebody will read in the wrong
 * unit.
 */
export declare function parseRefusalDuration(text: string): number | null;
/**
 * **What a surface is handed**, thinner than the row for `TakedownNotice`'s
 * reason: no note and no act id, because this crosses the wire to the person
 * it happened to.
 */
export interface RefusalNotice {
    subject: string;
    kind: RefusalKind;
    at: string;
    reason: TakedownReason;
    /** The operator's address, for the sentence's *Write to …*. */
    by: string;
    expiresAt?: string;
    /** The sentence itself, rendered by the HOME. */
    sentence: string;
}
/** A row, as a surface may see it. */
export declare function refusalNoticeOf(row: HomeRefusal): RefusalNotice;
/**
 * **The sentence** (journey 9 step 2, and design, "The record": the date,
 * the reason category, and the address):
 *
 * > This home will not admit sam@example.com — its operator refused the
 * > address on 12 September 2026: harassment. Write to olu@example.com.
 *
 * For a network, the same sentence says when it ends, because it always
 * does; for a name, it says *the name*. Rendered here rather than in each
 * surface, for the takedown sentence's reason: three spellings of one
 * sentence is three sentences, and the one that drifts is the one somebody
 * reads. The date is UTC and absolute; this is quoted in an email later.
 */
export declare function refusalSentence(row: Pick<HomeRefusal, "subject" | "kind" | "at" | "reason" | "by" | "expiresAt">): string;
/** `2026-09-13T09:15:00Z` → `13 September 2026 09:15 UTC`: a refusal that
 * ends in ten minutes needs the minute, not just the day. */
export declare function refusalUntil(iso: string): string;
/** The subject as the sentence names it: the bare address, the repo, the id,
 * the network. */
export declare function subjectShown(row: Pick<HomeRefusal, "subject" | "kind">): string;
/** What `isocan operator refuse` sends. One shape for both directions: a
 * lift is the same act with `lift`, not a second verb. */
export interface OperatorRefuseRequest {
    /** Why, from `TAKEDOWN_REASONS`: the category the refused person is shown.
     * Required to refuse; not read on a lift. */
    reason?: string;
    /** The operator's own note — recorded, shown to nobody. */
    note?: string;
    /** How long, as `parseRefusalDuration` reads it: `10m`, `24h`, `7d`. Absent means
     * a day for a network and no end for anything else. */
    for?: string;
    /** Lift the refusal in force rather than making one. */
    lift?: boolean;
}
/** What refusing reached, counted at the moment of acting. */
export interface RefusalReach {
    kind: RefusalKind;
    /** The badges ended because they had proved a refused address — every
     * one, in the same act (design: *refusing an address ends every badge that
     * proved it*). Empty for a name or a network. */
    ended: string[];
    /** The sockets closed and waits woken, summed over the badges ended. */
    reached: EndReach;
    /** What the sweeps of their rooms did to everybody else. */
    swept: {
        expelled: number;
        rerooted: number;
    };
    /** For a name: how many live badges still speak as it right now. A refusal
     * stops the name coming BACK; `isocan operator end` is what stops the
     * badges holding it now, and the verb says so with this number. */
    holders: number;
}
/** What the route answers: the row as it now stands, what the act reached,
 * and the sentence the refused person reads — null on a lift. */
export interface OperatorRefuseResponse {
    refusal: HomeRefusal;
    reach: RefusalReach;
    sentence: string | null;
}
/**
 * **The honest limit, printed by the verb once** (journey 9 step 4; design,
 * "Refuse at the door"). A badge is free and a link admits strangers who prove
 * nothing; a stranger cannot be refused by who they are, because they are
 * nobody yet. What stops them on a canvas is the link, which is the revoke.
 */
export declare const REFUSAL_LIMIT: string;
