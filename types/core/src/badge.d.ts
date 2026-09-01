/**
 * The badge: what the home hands out at the door, and what every surface
 * presents ever after (the identity desk's mechanism 1).
 *
 * This file is the WIRE half only — the names, the token format, the refusal
 * codes, and the claim rows that cross the wire through `/api/actors`.
 * Minting, hashing, and comparison are `node:crypto` and live server-side
 * (`server/badges.ts`); the `BadgeRecord` itself never crosses the wire and
 * lives behind the desk's seam (`server/desk.ts`). What is here is here for
 * exactly one reason: the browser and the CLI would otherwise hand-roll the
 * same token string in two places, and a mismatch there fails at runtime as a
 * 401 with no explanation.
 *
 * Deliberately policy-free. The door's policy is unchanged — the address
 * still admits — so getting a badge is free. What changes is that admission
 * now PRODUCES something the home can recognize later.
 */
/** The browser's carrier: one HTTP-only cookie at the one origin.
 *
 * A `__Host-` prefix would be strictly better — it forces `Secure`, `Path=/`,
 * and no `Domain`, so a sibling host cannot spoof it. It also REQUIRES
 * `Secure`, which `http://127.0.0.1:4441` cannot have, and the local daemon
 * and the hosted home are the same code. `__Host-isocan_badge` is the hosted
 * home's tightening, in phase 5, where the daemon knows it is HTTPS-only. */
export declare const BADGE_COOKIE = "isocan_badge";
/** Daemons and CLIs carry it as an ordinary bearer token. Bearer WINS over
 * cookie when both arrive: an explicit credential beats an ambient one, and a
 * request carrying a bearer is by construction not a cookie-driven request,
 * so it needs no Origin check. */
export declare const BADGE_SCHEME = "Bearer";
/** Which carrier a caller is asking the door for. Stated, never sniffed:
 * `Origin` presence and `Sec-Fetch-Mode` are guessable and wrong at the
 * edges, and one field in a body is honest and costs nothing. */
export type BadgeCarrier = "cookie" | "bearer";
/**
 * Which carrier a badge was MINTED for — the stored twin of `BadgeCarrier`,
 * and deliberately an alias rather than a second union with the same two
 * words. One is what a caller asks the door for and the other is what the
 * desk wrote down; they can never legitimately differ, and two independent
 * unions would let a later edit make them.
 *
 * It lives here rather than beside `BadgeRecord` because phase 9 puts it on
 * the wire: `BadgeSummary` says which of your surfaces is a browser tab and
 * which is a machine, which is most of how a person recognises the one they
 * mean to end.
 */
export type BadgeKind = BadgeCarrier;
/**
 * `<id>.<secret>` — the dot idiom, and there is exactly ONE parser for it.
 *
 * The dot is load-bearing: the home splits it, looks the record up by id in
 * O(1), and compares one secret, instead of hashing the presented string and
 * scanning the whole table. It also means a log line that leaked an id leaked
 * an identifier and not a credential.
 *
 * **Shared with the pass** (`passes.ts`, phase 8), deliberately and not by
 * coincidence. A pass token is the same shape for the same reasons — an
 * opaque id the desk can index, plus 256 bits of CSPRNG the desk only ever
 * holds as a hash — so a second parser would be a second set of edge cases
 * (a leading dot, a trailing dot, an id containing a dot) that could disagree
 * with this one. When they disagree the failure is a refusal with no
 * explanation, which is the exact class of bug `address.ts` exists to prevent
 * one layer up. `passes.ts` says the same thing from its end.
 *
 * Generic in `id`, not in what the id MEANS: the callers below keep their own
 * field names, because a `badgeId` and a `passId` are different things and
 * code that reads `token.id` at a badge check would be code that could
 * present the wrong one.
 */
export interface DotToken {
    id: string;
    secret: string;
}
export declare function formatDotToken(id: string, secret: string): string;
/** Split a presented token. Null for anything that is not one — a malformed
 * token is refused the same way a missing one is. */
export declare function parseDotToken(raw: string | undefined | null): DotToken | null;
/** A badge's token: `<badgeId>.<secret>`, in both carriers. */
export interface BadgeToken {
    badgeId: string;
    secret: string;
}
export declare function formatBadgeToken(badgeId: string, secret: string): string;
export declare function parseBadgeToken(raw: string | undefined | null): BadgeToken | null;
export interface DoorRequest {
    /** Default `bearer`. */
    carrier?: BadgeCarrier;
}
export interface DoorResponse {
    badgeId: string;
    /**
     * Handed over exactly once, and ONLY for the bearer carrier. The whole
     * value of an HTTP-only cookie is that page JavaScript cannot read the
     * credential; returning it in the JSON body hands it straight back.
     */
    secret?: string;
}
/** Where a caller with no badge goes to get one. */
export declare const DOOR_ROUTE = "/api/door";
/**
 * Why a request was refused, as `ApiError.code`. The distinction is not
 * decoration — it is the recovery branch. `no-badge` means "get one";
 * `bad-badge` means "throw away what you stored and get a new one" (a home
 * that was wiped, and in phase 9 a badge that was killed).
 */
export type BadgeRefusal = "no-badge" | "bad-badge" | "bad-origin";
/** A CLI from before the door, talking to a daemon that has one, gets 401 on
 * everything. That is an accepted break — the two ship as one build — but a
 * break that explains itself is a different thing from a break, so the body
 * names the fix the way the "predates actor.claim" error already does. */
export declare const BADGE_RESTART_HINT = "if this is an isocan CLI from before the door, `isocan restart` brings up this build's daemon";
/** WebSocket close codes, continuing ws.ts's 4400/4404/4500 convention. */
export declare const WS_NO_BADGE = 4401;
export declare const WS_BAD_ORIGIN = 4403;
/**
 * There is no canvas at that address — the socket half of a 404, and the one
 * close code a client must NOT retry its way out of.
 *
 * It was a bare `4404` in `ws.ts` and a bare `4404` in `home-link.ts`'s
 * stop-dialling branch; naming it is phase 7's tidy-up for the same reason
 * `address.ts` exists. A mistyped canvas id in a pasted share link arrives
 * here, and a tab that reconnects forever against it is exactly the silent
 * blank page the `/c/` finding was about.
 */
export declare const WS_NO_CANVAS = 4404;
/**
 * One row of the claims table: this badge may speak as this actor.
 *
 * The claims table used to key on `sessionKey` and now keys on badge ids —
 * the re-key mechanism 1 asks for. A badge holds SEVERAL claims and that is
 * the point: a browser wears a roster of personas under one cookie, and a
 * machine's badge vouches for its human and for each of its agents.
 *
 * This is the registry's PRIVATE half. It lives behind the desk and is never
 * replicated (the two-ledger rule); the public half — ids, names, colors —
 * lives in the store. It crosses the wire only as `ActorBindingRecord`, and
 * only to the badge that holds it.
 */
export interface ActorClaim {
    actorId: string;
    /** When this claim was made. Recency is the liveness proxy for the gap
     * between claiming a name and putting a face on a canvas — no longer
     * consulted for names, which have their own `at` in the public registry. */
    boundAt: string;
    /**
     * Which of THIS BADGE's claims this is — never trusted, only indexed.
     *
     * Demoted, deliberately: it used to be the key of the whole table, and it
     * is now a discriminator inside one badge's list. A harness resuming a
     * conversation, and a browser switching personas, both need to say which
     * of the badge's claims they mean; the home never believes the string, it
     * only looks it up under a badge it has already authenticated.
     */
    sessionKey?: string;
    /** The canvas of the directory the claim was made from, when it was bound
     * at claim time (#60). Informational — which canvas this agent is of. */
    canvasId?: string;
}
/** badgeId → that badge's claims. */
export type ClaimTable = Record<string, ActorClaim[]>;
/**
 * One verified attribute, riding the badge (identity desk, mechanism 3).
 *
 * **"Borrow, never mint."** isocan holds no passwords and no user table, so
 * the only thing a grant can bind to is an attribute the holder can
 * demonstrate with an attester they already have — an inbox, a Google or
 * GitHub sign-in, a token that can read a repo. Verifying never *creates*
 * anything: it decorates the badge the holder already carries.
 *
 * **`attribute` is spelled in the grant-subject namespace, deliberately** —
 * `email:jordan@acme.test`, not a bare address. A grant's subject IS an
 * attribute, so the door's question ("does anything this badge proved satisfy
 * this row?") is string equality over one namespace rather than a table of
 * per-subject-type comparisons that could disagree with the parser that wrote
 * them. `normalizeAttribute` in `grants.ts` is the one spelling; both sides
 * go through it.
 *
 * This lives in core, next to `ActorClaim`, for `ActorClaim`'s reason: the
 * record it sits on is desk-private, but the *shape* is spoken by the server
 * that writes it, the door test that reads it, and the surfaces that show a
 * person what they have proved. Two hand-rolled spellings of `{attribute,
 * verifiedVia, at}` would disagree as a refusal with no explanation.
 *
 * **No expiry field, on purpose.** The design says `{attribute, verifiedVia,
 * at}` and means it. An expiry is a policy nothing has chosen — how long a
 * proved email stays proved is a different question from how long a *session*
 * lasts, and inventing a TTL here would bake an answer into the ledger where
 * it is hardest to change. `at` is recorded, so a later phase that wants a
 * freshness rule has everything it needs to apply one at the door.
 */
export interface Attestation {
    /** The attribute proved, in the grant-subject namespace: `email:<addr>` or
     * `repo:<host>/<owner>/<name>`, normalized. */
    attribute: string;
    /** Which borrowed attester said so — `google`, `github`, `magic-link`. Free
     * text on purpose: the roster of attesters is configuration, not a type, and
     * a union here would need editing every time a home borrows a new one. */
    verifiedVia: string;
    /** When it was proved. */
    at: string;
}
/**
 * One of YOUR surfaces, as the home will describe it.
 *
 * A `BadgeRecord` never crosses the wire — this is the summary that does, and
 * it exists so kill-a-badge is a gesture a person can actually perform: you
 * cannot end a holder's recognition without a way to name it. Deliberately
 * thin. No secret hash (obviously), no admissions list (which canvases a
 * surface has been in is the desk's ledger, not a roster to publish), and no
 * claims beyond the actors — enough to recognise "my old laptop" and nothing
 * that would make this route worth reading for any other reason.
 */
export interface BadgeSummary {
    badgeId: string;
    kind: BadgeKind;
    createdAt: string;
    lastSeen: string;
    /** Is this the badge asking? The one row a person must be warned about
     * before they end it — killing it signs THIS surface out. */
    self: boolean;
    /** Who this surface may speak as. The reason it is one of yours. */
    actors: {
        id: string;
        name: string;
    }[];
    /** How many canvases it has been let into. A count and not a list: the
     * gesture needs "this thing is still in nine rooms", not the nine rooms. */
    canvases: number;
    /**
     * What this surface has PROVED — the attributes, in the grant-subject
     * namespace (`email:jordan@acme.test`).
     *
     * Phase 9 stage 2's addition to a summary that is otherwise deliberately
     * thin, and it earns the room for two reasons. It is the answer to "why does
     * that machine get into the canvas I only invited Jordan to", which is
     * unanswerable from a list of names and canvas counts. And it is an AGENT's
     * half of attestation: an agent has no inbox and cannot sign in, but seeing
     * what the badge it holds has proved is exactly the kind of thing it must
     * not need a person to read out to it.
     *
     * It discloses nothing new. Every badge in this listing shares an identity
     * with the caller by construction, so these are the caller's own proofs on
     * the caller's own surfaces.
     *
     * Absent (rather than empty) on a home from before stage 2, so a client
     * reading `attested ?? []` gets the truth from an old home rather than a
     * crash — the same courtesy `swept?` extends on a revoke.
     */
    attested?: string[];
}
export interface BadgesResponse {
    badges: BadgeSummary[];
}
/**
 * Your own surfaces — `GET` lists, `DELETE /:badgeId` kills one.
 *
 * NOT canvas-scoped, and that is the difference from the grant routes: a
 * badge is not about one canvas. Killing one ends that holder's recognition
 * everywhere at once, which is exactly the stolen-laptop gesture — the
 * laptop is not in one room, it is in all of them.
 */
export declare const BADGES_ROUTE = "/api/badges";
export declare const badgeRoute: (badgeId: string) => string;
/**
 * What killing one did. Both halves are load-bearing: `killed` is the summary
 * of the surface that is now unrecognisable, and `swept` is what happened to
 * everybody that surface had vouched into a canvas by pass — because a badge
 * that can no longer authenticate can no longer be the root of anybody else's
 * admission either. See `SweepReport`.
 */
export interface KillBadgeResponse {
    killed: BadgeSummary;
    swept: SweepReport;
}
/**
 * Why a badge will not be killed by this caller.
 *
 * 403 and its own code, for `not-admitted`'s reason: the caller's badge is
 * perfectly good, and sending it back to the door would mint credentials
 * forever without ever earning the right to end somebody else's.
 */
export declare const NOT_YOUR_BADGE = "not-your-badge";
/**
 * **Which home did you mean?** — phase 10.3, and the one refusal that phase
 * had to invent rather than inherit.
 *
 * A badge, an attestation and a pass are **home-scoped**: they are facts about
 * a desk, and a desk belongs to a home. While a daemon had exactly one home
 * that question answered itself. With several it does not, and there is no
 * canvas in the request to answer it with — `isocan badges` asks "what
 * surfaces of mine exist THERE" without ever saying where.
 *
 * `HomeLinks.homeScoped` answers the two rigs that have an honest answer (a
 * birth default; or exactly one link). Where it cannot, the tempting thing is
 * to fall back to the LOCAL desk, and that is precisely the trap: a person
 * asking which of their surfaces exist would be shown this laptop's own
 * ledger — a short, plausible, completely wrong list — and told nothing. This
 * codebase's oldest standing lesson is that its default answer to a wrong
 * address is a cheerful one, and a credential is the worst place to be
 * cheerful. So the request is refused, the homes are named, and the person
 * chooses.
 *
 * 409 rather than 400: nothing is wrong with the request. The daemon is in a
 * state where the question has more than one true answer, which is a conflict
 * and is exactly what a 409 is for.
 */
export declare const AMBIGUOUS_HOME = "ambiguous-home";
/**
 * What a revocation actually did to the people already inside.
 *
 * It rides back on the revoke response, and on kill-a-badge, because a
 * gesture whose whole point is expulsion has to be able to say who it
 * expelled — "the link is off" and "the link is off and four people just lost
 * this canvas" are different sentences and a person is entitled to the second
 * one. Both surfaces print it.
 *
 * `rerooted` is the half nobody expects and the half the design insists on: a
 * badge whose attestations satisfy a *surviving* grant re-roots instead of
 * dropping, so turning off the link does not expel the very people who were
 * invited by name.
 */
export interface SweepReport {
    /** Badges that lost this canvas. */
    expelled: number;
    /** Badges that stayed, under a different grant. */
    rerooted: number;
}
/**
 * The migration shelf's key in a `ClaimTable`: rows that belong to no badge
 * yet, left over from the sessionKey era and adoptable, once, by the first
 * badge that presents the matching `sessionKey`.
 *
 * It rides in the same table so that "is this name taken" and "was this actor
 * claimed just now" see a legacy row exactly as they saw it before the
 * re-key — unchanged semantics, no second code path. Badge ids are `bdg_…`,
 * so this can never collide with one.
 */
export declare const SHELF = "shelf";
