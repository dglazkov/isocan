import { type AttestedKind, type Attestation, type GrantSubject } from "../../core/src/index.js";
/**
 * **The attesters this home has borrowed** — mechanism 3's "borrow, never
 * mint", arriving as code.
 *
 * Stage 1 shipped this file as a seam with nothing behind it and said so: a
 * list of what this home can verify, which was empty, plus the refusal that
 * followed from it. Stage 2 fills it, and the shape of the filling is the
 * interesting part.
 *
 * ## Nothing here mints an account, because isocan does not have any
 *
 * What a verified token buys is one row on the badge the caller ALREADY
 * carries: `{attribute: "email:…", verifiedVia, at}`. No user record is
 * created, nothing is looked up by email, and a holder who never signs in is
 * unaffected in every particular — the address still admits, a badge is still
 * free, and the link is still how sharing works. Attestation ADDS a way to be
 * admitted and a way to resume; it removes none. A home that made signing in a
 * precondition for anything that worked yesterday would have broken the
 * journey's first scene to harden its ninth.
 *
 * ## Attesters are CONFIGURATION, and stage 1 argued the opposite
 *
 * The constant this replaces carried this reason for being a constant:
 *
 * > It is a constant rather than configuration read from the environment
 * > because it must match what the code can actually DO: a home that could be
 * > told it has an email attester by setting a variable is a home that can be
 * > made to lie to the Share dialog.
 *
 * The instinct was right and the conclusion was wrong, and the difference is
 * worth writing down because it is the same mistake in the other direction.
 * **What varies between homes is not the code, it is whether there is a
 * project to verify against.** The verification below ships in every build —
 * a laptop's daemon contains it, byte for byte, the same as the hosted home —
 * so "what the code can DO" cannot be the discriminator; it is identical
 * everywhere. What a local daemon lacks is an Identity Platform project, and
 * that is exactly what `ISOCAN_AUTH_PROJECT` names.
 *
 * So the configuration is not a BOOLEAN CLAIM ("this home has an email
 * attester") that a typo could make into a lie. It is the *project the tokens
 * are checked against*, and the same value is load-bearing in both directions:
 * it decides whether `email:` may be granted, and it is what `iss` and `aud`
 * are bound to when a token arrives. A home configured with a project it does
 * not own cannot verify anybody's token — every arrival is refused, loudly, at
 * the first sign-in — so the misconfiguration that stage 1 feared is not
 * silent, and the one it would have caused instead (a hosted home that cannot
 * be told it HAS an attester without a rebuild) is permanent.
 *
 * One image, many homes. That is the deployment-detail thesis, and this is the
 * first place in the codebase where a home's *capabilities* differ rather than
 * its storage.
 */
/**
 * The attester this home has borrowed, or null when it has borrowed none.
 *
 * `apiKey` is here rather than in a separate reader because it travels with
 * the project: they are two halves of one borrowing, and a home configured
 * with one and not the other is a home that can verify a token no browser can
 * obtain. Kept together so that is one check instead of two that can drift.
 */
export interface AuthConfig {
    /** The Identity Platform project id — `isocan-io-dev`. What `iss` and `aud`
     * are bound to, and therefore the thing that makes verification mean
     * something rather than "some Google project said so". */
    project: string;
    /** The browser key the page calls the provider's REST API with. Served to
     * the browser at run time (see `AuthOffer`), never compiled in. Not a
     * secret: a browser key identifies a project and ships in every page that
     * uses it, and the authorized-domain list is what defends it. */
    apiKey: string;
}
/**
 * The attester from the environment, or null.
 *
 * Environment rather than a flag, for `resolveHomeUrl`'s reason: which
 * identity provider a home borrows is innkeeper configuration, not a
 * per-invocation choice anything should be able to reach for. And with **no
 * compiled-in default**, which is the same load-bearing absence: a daemon with
 * nothing configured has no attester, which is what every daemon in this repo
 * is, so the whole mechanism is invisible until somebody configures it.
 *
 * Both halves or neither. A project with no key is a home whose browser cannot
 * start a sign-in, so offering `email:` grants there would put a row on a
 * canvas that nobody can ever satisfy — the exact failure the refusal below
 * exists to prevent, arriving through a half-filled configuration instead of
 * an empty one.
 */
export declare function resolveAuth(env?: NodeJS.ProcessEnv): AuthConfig | null;
/**
 * What a home with this configuration can verify.
 *
 * `email` when there is an attester, and that is the whole list today.
 *
 * **`repo` is deliberately absent, and its absence is the honest answer rather
 * than an oversight.** Scene 6's subject — "can read exactly this repository"
 * — is satisfied by a token check against GitHub's API, which is a different
 * shape of work from everything here: it is an outbound call to a third party
 * on a request path, it needs an OAuth access token (not the ID token this
 * file verifies — Identity Platform hands the access token back only at
 * sign-in, and holding one is a credential-custody decision nobody has made),
 * and it needs a scope on the OAuth app that reading private repositories
 * requires. Phase 11 is where Scene 6 is played and where the thin agent that
 * needs it arrives. Until then `repo:` is refused by `attesterRefusal` with
 * the reason, which is the one thing that must stay true: a `repo:` grant that
 * could be WRITTEN and admitted nobody would be a dialog that lies, and that
 * is worse than a refusal.
 */
export declare function attestersOf(auth: AuthConfig | null): AttestedKind[];
/**
 * Why this home cannot take that grant, or null when it can.
 *
 * Separate from `grantSubjectRefusal` in core, which answers the different
 * question of whether the subject is well-formed at all. A caller told "not a
 * grant subject" about a perfectly good email address goes looking for a typo
 * that is not there; a caller told "nobody here can verify that" knows the
 * problem is the home and not the sentence.
 *
 * The message says what the person should do INSTEAD, because there is
 * something they can do — the link still works, and it is how sharing has
 * worked for every phase so far.
 */
export declare function attesterRefusal(subject: GrantSubject, attesters: readonly AttestedKind[]): string | null;
/**
 * The token was not one this home could verify.
 *
 * Its own class so `http.ts`'s error handler answers 400 with a code rather
 * than a 500 with our own words, and one message shape for every reason: a
 * caller holding a token that will never work needs to be told which of its
 * assumptions is wrong (the wrong project, an expired token, an unverified
 * address), because those are three different things to go and fix.
 */
export declare class BadIdTokenError extends Error {
    readonly code = "bad-id-token";
    constructor(why: string);
}
/**
 * **Verify an Identity Platform ID token, and say what it proves.**
 *
 * The whole of what "borrowing an attester" means, in one function. What comes
 * back is an `Attestation` ready for `Desk.attest` — nothing else, and
 * deliberately: this function does not know about badges, does not write
 * anything, and cannot admit anybody. Its caller does all three, which is what
 * keeps the door's branch and the verification testable apart.
 *
 * **What is checked, and why each one is not optional:**
 *
 * - **The signature**, against Google's published certificates, keyed by the
 *   header's `kid`. Without it the rest is a caller telling us its own name.
 * - **`iss` and `aud`, both bound to THIS home's project.** A token from
 *   somebody else's Identity Platform project is a perfectly valid, perfectly
 *   signed token that proves nothing to us — anybody can create a project and
 *   mint tokens in it. This is the check that makes the configuration mean
 *   something, and skipping it turns the attester into "any Google project
 *   says so", which is not an attester at all.
 * - **`exp`**, with a minute of skew. A clock is not a promise.
 * - **`email` and `email_verified`.** The attribute is *controls this
 *   mailbox*. A provider that hands back an address it has not confirmed (a
 *   GitHub account whose email is unverified) has proved somebody signed in,
 *   not that they read that inbox — and an `email:` grant names exactly the
 *   second thing.
 *
 * `alg` is pinned to RS256 rather than read from the header, because reading
 * it is how `alg: none` and the HMAC-with-the-public-key trick get in. The
 * header is the attacker's to write; the algorithm is ours.
 */
export declare function verifyIdToken(token: string, auth: AuthConfig, keys: Record<string, string>, now?: number): Promise<Attestation>;
export declare function googleSigningKeys(now?: number): Promise<Record<string, string>>;
/**
 * Where a home gets the keys it verifies with.
 *
 * A function rather than a constant, and this is the ONE seam in the
 * verification path: everything else `verifyIdToken` needs is in the token or
 * in the configuration, and the public keys are the single input that comes
 * from outside the process. That makes it also the single thing a test cannot
 * supply by writing a fixture — Node can parse an X.509 certificate but not
 * mint one, so a suite that wanted to check the door's branch over a REAL
 * signature would otherwise need either the internet or a private key
 * committed to this repository. Neither is acceptable: a test that reaches
 * Google fails on a plane, and a committed private key is a secret-scanner
 * alarm that trains people to ignore alarms.
 *
 * So the daemon takes its key source as configuration, defaulting to the
 * published endpoint, and the suite hands it a key pair it generated a
 * millisecond ago. What that buys is that the tests exercise the same
 * `verifyIdToken` a real arrival does — same signature check, same `iss`,
 * same `aud`, same expiry — rather than a stubbed verifier that proves
 * something about a stub. It is `mintId` in `applyClaim` and `liveness` on the
 * `Engine`: injectable because the alternative is testing less.
 */
export type SigningKeys = () => Promise<Record<string, string>>;
