import { NO_OPERATOR, type OperatorProofRecord, type OperatorRefusalCode } from "../../core/src/index.js";
import { type AuthConfig } from "./attest.js";
import type { SigningKeys } from "./attest.js";
/**
 * **Who runs this home, and what proves it** — the judging half of
 * `docs/projects/operator/design.md`, phase 1.
 *
 * Decision D1: *the operator is an address the home's configuration names,
 * proved fresh for each act.* Not a badge, not an actor, not a key. Four
 * candidates were costed against one question — what stops an agent, or a
 * stranger, from holding it — and the three that lost all lose for the same
 * reason: they are things that can be HELD. A person actor named in config is
 * held by any daemon that relays it; a minted token is held by whatever can
 * read the file; a key on the machine is held by the summoned agent that
 * shares the home directory. An address the attester proves, within ten
 * minutes, is not held by anybody — it is done, at a moment, by a person at a
 * sign-in page.
 *
 * So this file has two exports that matter and no state. `resolveOperators`
 * reads the list beside `resolveAuth`, and `proveOperator` answers yes,
 * `not-operator` or `proof-stale` about one presented token. Nothing here
 * writes anything, knows about badges, or can admit anybody — its caller does
 * all three, which is the seam `attest.ts` already drew and the reason both
 * halves are testable apart.
 */
/**
 * **`ISOCAN_OPERATORS` — a comma list of attributes**, in the normalized shape
 * grant subjects already use (`email:dimitri@glazkov.com`).
 *
 * Environment, beside `ISOCAN_AUTH_PROJECT` and `ISOCAN_AUTH_API_KEY`, and for
 * exactly their reason: **who can set the home's configuration is who decides
 * who the operator is.** That sentence is the whole trust story. A list in the
 * environment is not a claim that could be false — it is the thing
 * verification is performed WITH, the same argument the attester made in
 * multiuser phase 9, and it is IAM on the Cloud Run service that makes it
 * trustworthy rather than anything in this process.
 *
 * **No compiled-in default, ever.** A daemon with nothing set has no operator,
 * which is every daemon in this repo and is not a defect: a local daemon's
 * badge is admitted to everything on it already, so an operator path would be
 * a second way to do what its holder can do anyway. One image, many homes: a
 * team that runs its own home is its own operator by setting its own list.
 *
 * Normalized once, here, so the comparison at request time is equality over
 * two strings that were folded by the same function — `normalizeAttribute` is
 * what `verifyIdTokenClaims` already puts the token's address through, and two
 * spellings of one address would be an operator who is sometimes not one.
 * Entries that are not `email:`-shaped are kept rather than dropped: this
 * reader does not decide what a home may name, and an entry nothing can ever
 * prove is inert.
 */
export declare function resolveOperators(env?: NodeJS.ProcessEnv): string[];
/**
 * **Why this home has no operator to prove to**, in one sentence, or null when
 * it has one.
 *
 * Journey 11 step 2 asked for exactly this and named the shape: *one
 * sentence, that this home borrows no attester and so has no operator proof
 * yet, and what setting one up takes.* Two homes reach it and the sentence
 * says which — a home with no attester cannot verify a sign-in at all, and a
 * home with an attester and an empty list has verification and nobody to
 * recognise. Answering both with the same words would leave whoever is
 * configuring the second one reading about the first.
 *
 * It is answered for the whole `/api/operator/` prefix rather than per route,
 * because "this home has no operator" is a fact about the home and not about
 * the verb — and because a route added in phase 2 must not be able to forget
 * it.
 */
export declare function operatorAbsence(auth: AuthConfig | null, operators: readonly string[]): string | null;
/** Yes, with the row the ledger keeps — or no, with the code and the words. */
type OperatorVerdict = {
    ok: true;
    proof: OperatorProofRecord;
} | {
    ok: false;
    code: OperatorRefusalCode;
    error: string;
    proof: OperatorProofRecord | null;
};
/**
 * **Is a person at a sign-in page right now, and is it one of this home's
 * operators?**
 *
 * Three checks in one place, and the order is the message rather than an
 * optimisation:
 *
 * 1. **The token verifies**, by the same `verifyIdToken` that attests an
 *    address today — signature, `iss` and `aud` bound to this home's project,
 *    `exp`, `email_verified`. A token that does not is a `BadIdTokenError`
 *    thrown out of here, because there is no attribute to name in a refusal
 *    and nothing worth writing in a ledger: nobody proved anything.
 * 2. **The address is on the list.** Refused as `not-operator`, **naming the
 *    address that was proved** — journey 1 step 5's sentence, and its whole
 *    content. A person with two Google accounts needs to be told which one
 *    arrived; a person who is not the operator learns nothing they did not
 *    already know.
 * 3. **`auth_time` is recent.** Refused as `proof-stale`, saying how long ago.
 *
 * The list check runs BEFORE the freshness check on purpose. A stranger who
 * signed in a second ago and a stranger who signed in an hour ago are the same
 * stranger, and answering the second one "your proof is stale" would tell them
 * that a fresh one would have worked.
 *
 * **A token with no `auth_time` is refused as stale, not accepted.** The claim
 * is the only thing that distinguishes a proof from an attestation, and a
 * provider that omits it has not said when the person signed in — so the
 * honest reading of an absent claim is "not recently", never "just now".
 */
export declare function proveOperator(args: {
    token: string;
    auth: AuthConfig;
    keys: SigningKeys;
    operators: readonly string[];
    now?: number;
    window?: number;
}): Promise<OperatorVerdict>;
/** The refusal for a request to an operator route that carried no proof. */
export declare const NO_PROOF_PRESENTED: string;
/** `no-operator`, re-exported so a route imports one module rather than two. */
export { NO_OPERATOR };
