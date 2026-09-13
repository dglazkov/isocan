/**
 * **A grant the operator turned off** — operator phase 5 (design, "Turn off
 * a grant"; journey 8).
 *
 * The owner's revoke — `desk.revokeGrant`, then the sweep — with `own`
 * replaced by the proof. What this file holds is the one thing that makes
 * the operator's revoke readable afterwards: the row gains `revokedVia:
 * "operator"` and the operator's half of the tombstone, so the Share dialog
 * and `isocan share` say *turned off by the operator of this home on <date>:
 * <reason>* instead of naming a badge.
 *
 * **The owner can turn it back on**, and nothing here stops her: a re-grant
 * is a new row, as it always was, written by the ordinary grant route with
 * no proof and no ledger row. A revoke the owner can undo is a request; when
 * the operator needs it to stay off, the order is a takedown. Giving the
 * operator a row the owner cannot touch would be a second kind of grant for
 * one caller, which is why there is no such field.
 */
import { type Grant, type GrantSubject } from "./grants.js";
import { type TakedownReason } from "./takedown.js";
/**
 * **The operator's half of a grant tombstone**, beside `revokedAt` and
 * `revokedBy` — the shape `OperatorEnd` gives a badge's, for the same reason:
 * `by` is the attribute that was proved, so a home with two operators sends
 * the owner to the one who acted; the act id is how the sentence and the
 * proof that justified it are one lookup apart.
 *
 * `revokedBy` stays the badge id the request carried, as every desk write
 * records the surface that made it. This is the person.
 */
export interface OperatorRevocation {
    reason: TakedownReason;
    by: string;
    actId: string;
}
/**
 * `POST /api/operator/revoke/:target` — a canvas id or a space id, which is
 * the id a report names; the subject rides in the body. One route for both
 * scopes because a canvas's rows and a space's are the same rows one scope
 * wider (roles phase 4), and the ledger's `target` is then the id the
 * operator typed.
 */
export declare const OPERATOR_REVOKE_ROUTE = "/api/operator/revoke/:target";
/** What `isocan operator revoke` sends. */
export interface OperatorRevokeRequest {
    /** The row to turn off, by subject: `link`, `email:…`, `repo:…` or
     * `group:…` — any subject a row can name. */
    subject: GrantSubject;
    /** Why, from {@link TAKEDOWN_REASONS}: the category the owner is shown. */
    reason?: string;
    /** The operator's own note — recorded, shown to nobody. */
    note?: string;
    /** Write a bar too, as the owner's `?bar=1` does: the subject is refused
     * at the door whatever the link allows, until an owner lifts it. */
    bar?: boolean;
}
/** What the route answers: the tombstone, and what turning it off reached. */
export interface OperatorRevokeResponse {
    target: {
        kind: "canvas" | "space";
        id: string;
    };
    /** The row, now a tombstone carrying `revokedVia: "operator"`. */
    grant: Grant;
    /** The bar written in the same request, when `bar` was asked for. */
    bar?: Grant;
    /** How many canvases the sweep walked: one, or every canvas in the space. */
    reached: number;
    /** What the sweep did to the people inside. */
    swept: {
        expelled: number;
        rerooted: number;
    };
    /** The sentence the owner reads, rendered by the home. */
    sentence: string;
}
/**
 * **The sentence** (design, "Turn off a grant"; journey 8 step 3):
 *
 * > Turned off by the operator of this home on 12 September 2026: spam.
 * > Write to olu@example.com.
 *
 * Rendered here for the takedown sentence's reason — three spellings of one
 * sentence is three sentences — and dated the way the other two are: UTC and
 * absolute, because the Share dialog is read months later and the date must
 * match the ledger's. Null for a row the operator did not touch: an owner's
 * own revoke has no sentence, and a caller that asked for one about it gets
 * nothing rather than a sentence about nobody.
 */
export declare function revokedSentence(grant: Pick<Grant, "revokedAt" | "revokedVia" | "revocation">): string | null;
/**
 * **Which of these rows the operator turned off, and nothing has since
 * replaced** — what `GET …/grants` hands both surfaces beside the live rows.
 *
 * Per subject, the newest tombstone decides: if it is the operator's and no
 * live row names the subject, the owner is shown the sentence. A live row
 * means she turned it back on, and the sentence goes — *she can turn it back
 * on* is the whole of journey 8 step 3, and a notice that outlived the
 * re-grant would read as a row she cannot touch. An owner's own later revoke
 * is the newest tombstone, and it says nothing, because it is hers.
 *
 * Bars are not subjects here: a bar the operator lifted would be a grant of
 * access, and this phase turns access off.
 */
export declare function operatorTurnedOff(rows: readonly Grant[]): Grant[];
