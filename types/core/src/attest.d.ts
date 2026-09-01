/**
 * **Borrowing the bench** — the wire half of attestation (identity desk,
 * mechanism 3's "attestations ride the badge", and mechanism 6's person
 * resumption which stands on it).
 *
 * The shapes here are here for `badge.ts`'s reason and no other: the browser
 * asks this home what it can verify, hands it a token, and reads back what
 * this badge has proved — three shapes that the page, the CLI and the daemon
 * would otherwise spell three times. `Attestation` itself lives in `badge.ts`,
 * beside the record it rides on.
 *
 * **What is deliberately NOT here: any knowledge of an identity provider.**
 * Core does not know that Identity Platform exists, what an ID token looks
 * like, or how a signature is checked. It knows that a caller presents *a
 * token from the attester this home named* and gets an attestation back. That
 * boundary is what makes the whole thing "one image, many homes": the same
 * bundle runs against a home with an attester and a home with none, and the
 * difference arrives at run time as data.
 */
import type { Actor } from "./model.js";
import type { Attestation } from "./badge.js";
import type { AttestedKind, GrantSubject } from "./grants.js";
/**
 * `GET` asks what this home can verify and what this badge has proved; `POST`
 * hands over a token and gets an attestation written.
 *
 * One route, two verbs, for `grantsRoute`'s reason: the reader and the writer
 * are the same subject, and a second path is a second thing to keep in step.
 * NOT canvas-scoped — an attestation is a fact about the HOLDER, not about a
 * room. It is the same argument `BADGES_ROUTE` is written on, and it matters
 * here twice over: a badge that is not admitted anywhere must still be able to
 * prove its address, because proving it is how it comes to be admitted.
 */
export declare const ATTEST_ROUTE = "/api/attest";
/**
 * **What this home has borrowed, served at run time rather than baked in.**
 *
 * The API key and the project id reach the browser THROUGH THE HOME, on this
 * route, instead of being compiled into the bundle. Three reasons, in the
 * order they bite:
 *
 * - **One image, many homes.** The container that runs at `dev.isocan.io` is
 *   byte-identical to the one that will run at `isocan.io`, and to the one a
 *   person runs on a laptop. A key baked into the bundle would make the image
 *   a per-home artifact, which is the property the whole deployment-detail
 *   thesis rests on not losing.
 * - **A local daemon has no attester at all**, and its web app must not ship a
 *   dangling reference to somebody else's project. `auth: null` is a real
 *   answer this page renders — no sign-in control, the link is how you share —
 *   and it is the same code path.
 * - **Rotation is a redeploy of configuration, not of the app.**
 *
 * Neither field is a secret. A browser API key identifies a project and is
 * visible in every page that uses it; what defends it is the authorized-domain
 * list at the provider, which is why `infra/100-identity-platform.sh` treats
 * that list as the security boundary and this as plain configuration.
 */
export interface AuthOffer {
    /** The Identity Platform project. The browser needs it for nothing but
     * completeness; the DAEMON needs it, because `iss` and `aud` are bound to
     * it when a token is verified. Sent so a page can say which project it is
     * about to talk to rather than discovering it from a failure. */
    project: string;
    /** The browser key the provider's REST API is called with. */
    apiKey: string;
}
/** What `GET {@link ATTEST_ROUTE}` answers. */
export interface AttestOffer {
    /**
     * What this home can verify — `[]` on a home that has borrowed nothing,
     * which is every local daemon and is not a defect.
     *
     * The Share dialog reads exactly this to decide whether a "who" field is a
     * control or a lie: a home that cannot verify an email must not offer to
     * invite one, because the row it wrote would admit nobody.
     */
    attesters: AttestedKind[];
    /** Null on a home with no attester. */
    auth: AuthOffer | null;
    /** What the PRESENTING badge has proved. Its own, never anybody else's. */
    attestations: Attestation[];
    /**
     * **Who this badge may resume** — mechanism 6, made reachable.
     *
     * Actors claimed by some OTHER badge that has proved an attribute this badge
     * has also proved. That is the vouch, computed once and answered here so a
     * surface can offer it as a button: Jordan's phone verifies her address and
     * is told, in the same breath, that it may be Jordan.
     *
     * It is not a directory. Every row is somebody this holder has just proved
     * they are, so it discloses to Jordan only that Jordan exists here.
     */
    resumable: Actor[];
}
/** What `POST {@link ATTEST_ROUTE}` takes: a token from the attester this
 * home named, and nothing else. No email field beside it — the address is
 * read out of the verified token, never out of the request, or the caller
 * would be attesting for itself. */
export interface AttestRequest {
    idToken: string;
}
/** What it answers: the row that was written, and who that row now lets this
 * badge be. `resumable` rides back on the write for the same reason
 * `SweepReport` rides back on a revoke — the gesture's whole point is what it
 * changed, and a surface that had to go and ask again would render a stale
 * answer in between. */
export interface AttestResponse {
    attestation: Attestation;
    resumable: Actor[];
}
/**
 * The token was not one this home could verify, as `ApiError.code`.
 *
 * Its own code and a 400 rather than a 401: the caller's BADGE is fine — this
 * is a refusal about the thing it presented on top of the badge, and sending
 * it back to the door would throw away a perfectly good credential to no
 * effect. The same shape `not-admitted` is written on.
 */
export declare const BAD_ID_TOKEN = "bad-id-token";
/**
 * This home has borrowed no attester of the kind that subject needs, as
 * `ApiError.code`. Phase 9 stage 1 minted it for the grant route; stage 2
 * makes it reachable in the other direction too — asking to attest at a home
 * that cannot verify anything is the same fact from the caller's side.
 */
export declare const NO_ATTESTER = "no-attester";
/**
 * **What somebody typed, as a grant subject.**
 *
 * It lived in the CLI through phase 9 stage 1 with a note saying it would move
 * here "when the field lands — it is the same question asked twice at that
 * point". The field landed, so it moved: the Share dialog's "who" input and
 * `isocan share <who>` now ask one question with one answer, which is
 * AGENTS.md's rule about shared computation applied to the smallest possible
 * computation.
 *
 * Anything unrecognised passes through untouched, so the home's refusal is
 * about what the person actually wrote rather than about something this
 * function guessed. Normalization is deliberately NOT done here — that is
 * `normalizeSubject`, applied at the daemon, once, where the row is written.
 *
 * The cast is honest about what it is: the return type says "a subject" and
 * the fallback branch hands back something that may not be one. That is the
 * point — `grantSubjectRefusal` at the daemon is the judge of shape, and a
 * client that refused first would be a second copy of a policy that is about
 * to change (the argument `isocan share` has carried since phase 7).
 */
export declare function grantSubjectOf(who: string): GrantSubject;
