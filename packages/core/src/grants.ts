/**
 * Grants: what the door checks (the identity desk's mechanisms 3 + 2).
 *
 * A grant is a row that says who may enter one canvas. It is **desk state,
 * never canvas state** — written through the daemon API, never as an
 * `Operation`, per the journey's rule 5 ("sharing is daemon-API parity, not
 * an op") — so no grant ever appears in an oplog envelope and no grant
 * replicates to another home through the store.
 *
 * This file is the WIRE half only, and it is here for the same reason
 * `badge.ts` is: the browser, the CLI and the daemon would otherwise
 * hand-roll the same subject strings and the same route shapes in three
 * places, and a mismatch there fails at runtime as a refusal with no
 * explanation. The desk's own storage of a grant is `server/desk.ts`; the
 * door's test over these rows is `server/grants.ts`.
 */

import type { Attestation, SweepReport } from "./badge.ts";

/**
 * What a grant binds to — a **provable attribute**, per the design's "borrow,
 * never mint": isocan holds no passwords and no user table, so a subject is
 * something the holder can demonstrate with an attester they already have.
 *
 * Three subject types, v1, and the union is written as a template-literal
 * type so `email:` and `repo:` slot in WITHOUT a schema change when phase 9
 * gives badges attestations. **Phase 9 stage 1 gave them exactly that**, so
 * all three are now checkable subjects and this file's refusal is about SHAPE
 * alone. What can still be missing is an ATTESTER — a home that has borrowed
 * nowhere to verify an email cannot satisfy `email:` however well-formed the
 * row is — and that is a fact about one home's configuration rather than
 * about the vocabulary, so it is refused server-side (`server/attest.ts`)
 * where the configuration lives.
 *
 * - `link` — anyone presenting the address. The status quo DEMOTED TO DATA:
 *   every canvas is born with a standing link grant, so "the address is the
 *   secret" stops being a regime and becomes one revocable row.
 * - `email:<addr>` — the Share dialog's "who" field. Satisfied by an
 *   attestation of the same attribute.
 * - `repo:<host>/<owner>/<name>` — Scene 6's sentence made checkable:
 *   committing the marker was a grant to whoever can read the repo. Satisfied
 *   the same way, by an attestation that the holder can read it.
 */
export type GrantSubject = "link" | `email:${string}` | `repo:${string}`;

/**
 * **Who owns a canvas: the actor who made it.**
 *
 * Not a new field. `project.createdBy` has been on every canvas since the
 * first one, so ownership is a reading of what is already recorded rather
 * than a role somebody has to be granted — which also means every canvas
 * that predates this has an owner already, with no migration.
 *
 * The ACTOR, deliberately, and not the badge. `{root: "created"}` marks the
 * one badge that made the canvas, and a person is not a badge: they have a
 * laptop and a phone and a terminal, and the two accounts one human answers
 * to. Reported exactly there — the canvas was made by one identity, the
 * browser was wearing another, and the link admitted that one like a
 * stranger. Owning by actor is what makes "I made this" survive changing
 * surfaces.
 */
export function ownerOf(project: { createdBy: { id: string } }): string {
  return project.createdBy.id;
}

/** Is this actor the one who made it? */
export function ownsCanvas(project: { createdBy: { id: string } }, actorId: string): boolean {
  return ownerOf(project) === actorId;
}

/**
 * What a grant lets its holder DO once the door says yes — the roles question
 * `identity-desk.md` left open ("that waits for a scene that forces it"),
 * answered first by the scene that forced it (a presentation, #87, whose
 * viewers must not walk in and start moving things, #88) and then widened by
 * the roles project (`docs/projects/roles/design.md`) into a ladder.
 *
 * **A ladder, not a matrix.** Four rungs in a total order, and every
 * question about them is one comparison — `atLeast(held, needed)`. From the
 * bottom:
 *
 * - `view` — the deck. Admission to READ, rendered as the presentation: the
 *   current slide full screen, arrows to flip. Stays out of presence.
 * - `read` — the canvas with the writes hidden. The same admission to read,
 *   rendered as the canvas itself; appears in presence, marked as reading.
 *   The daemon enforces nothing between `view` and `read`: both may read the
 *   oplog and neither may write. The difference is what the home tells the
 *   client to render, and whether the connection appears in presence.
 * - `edit` — everything admission has always meant.
 * - `own` — what the creator holds; grantable, so a canvas can change hands
 *   by adding an owner and leaving. What it gates beyond `edit` is built by
 *   roles phase 2; phase 1 stores and carries it so it round-trips.
 *
 * The new rung is spelled `read` and not `view` so that nothing already
 * written changes meaning: every `view` row in the wild still opens the deck.
 *
 * The refusal is server-side at the op chokepoint, not a hidden toolbar: a
 * capability that only a client enforced would be what the scrubber's
 * comment calls a habit rather than a rule.
 *
 * **Absent means `edit`, everywhere.** Every grant row and every admission
 * written before this field existed meant full access, so the absent field
 * must go on meaning exactly that. The wire rule is **written whenever it is
 * not `edit`** (`narrowed`), which is the same rule for every row in the
 * wild, because `view` is the only value that was ever written before the
 * ladder.
 */
export type Capability = "view" | "read" | "edit" | "own";

/** The ladder, lowest first. `atLeast` and `highest` compare positions in
 * this list and nowhere else. */
export const RUNGS: readonly Capability[] = ["view", "read", "edit", "own"];

/** A word this home does not know is below every rung it does: an old client
 * meeting a new rung renders it as an editor (the design's compatibility
 * rule), and a NEW client meeting a word it cannot place must not be
 * promoted by it. */
function rungIndex(capability: Capability): number {
  return RUNGS.indexOf(capability);
}

/** Is what is held at least what is needed — the one comparison the ladder
 * exists to make. */
export function atLeast(held: Capability, needed: Capability): boolean {
  return rungIndex(held) >= rungIndex(needed);
}

/** The higher of two rungs: a person's rung on a canvas is the highest of
 * every row that admits them. */
export function highest(a: Capability, b: Capability): Capability {
  return rungIndex(a) >= rungIndex(b) ? a : b;
}

/** Is this word a rung at all? The route's shape check, and the desks'
 * read-back guard: a stored word from a newer home is not silently read as
 * edit, and not silently read as anything else either. */
export function isCapability(word: unknown): word is Capability {
  return typeof word === "string" && (RUNGS as readonly string[]).includes(word);
}

/**
 * **Whether the field is written** — the one place that decides, replacing
 * the eleven literal `"view"` tests the roles design counted (both desks'
 * `admit` and `reroot`, the cloud desk's `toGrant`, the grants route, the
 * hello, the API client, the web client, the home link's forwarder).
 *
 * True whenever the rung is not `edit`. Any rung a call site has not met is
 * then stored rather than dropped: the cloud desk's own comment records that
 * a field-picking rebuild once escalated `view` to `edit` on the hosted home,
 * and a literal test would do the same to `read` and `own`.
 */
export function narrowed(capability: Capability | undefined): capability is Capability {
  return capability !== undefined && capability !== "edit";
}

/** The one reading of an absent field: a grant from before capabilities — or
 * one written without narrowing — admits to everything, as it always did. */
export function capabilityOf(grant: { capability?: Capability }): Capability {
  return grant.capability ?? "edit";
}

/**
 * The two vocabularies a rung is spoken in, from one map so the dialog, the
 * CLI table, the facepile and the roster cannot drift apart.
 *
 * `dialog` is the Share dialog's picker and the CLI's rung column: the
 * research's four names. `presence` is the word beside a face — what the
 * facepile's hover card and the Share roster say about somebody who is here,
 * the way they say *standing by* for an available agent. Only the rungs
 * below `edit` are ever spoken there (an editor is simply *here*), but the
 * map covers all four so a caller can index it without a case.
 */
export const capabilityWord: Record<"dialog" | "presence", Record<Capability, string>> = {
  dialog: {
    own: "Owner",
    edit: "Editor",
    read: "Canvas Viewer",
    view: "Presentation Viewer",
  },
  presence: {
    own: "editing",
    edit: "editing",
    read: "reading",
    view: "viewing",
  },
};

/** The one subject that needs no attester: presenting the address IS the
 * proof, which is why it is the subject a canvas is born with. */
export const LINK: GrantSubject = "link";

/** Which kind of attester a subject needs, or null for `link`, which needs
 * none. The one place the prefix is turned into a word, so the API refusal,
 * the door, and a home's configuration all name the same thing. */
export type AttestedKind = "email" | "repo";

export function attestedKindOf(subject: string): AttestedKind | null {
  if (subject.startsWith("email:")) return "email";
  if (subject.startsWith("repo:")) return "repo";
  return null;
}

/**
 * **What a grant names: one canvas, or one space** (roles design, "The
 * space"). A discriminated scope rather than two optional fields, so a row
 * cannot name both or neither. Every row in the wild has `canvasId` and
 * matches the first arm with no migration; a space row is the second arm,
 * written only by the space routes.
 */
export type GrantScope = { canvasId: string } | { spaceId: string };

/** Which scope a row names, as one word and one id — for the code that has
 * to branch on it without spelling `"canvasId" in grant` in five places. */
export function scopeOf(grant: GrantScope): { kind: "canvas" | "space"; id: string } {
  return "spaceId" in grant ? { kind: "space", id: grant.spaceId } : { kind: "canvas", id: grant.canvasId };
}

/** Is this a row on a space? */
export function isSpaceGrant(grant: GrantScope): grant is { spaceId: string } {
  return "spaceId" in grant;
}

/**
 * One grant, as the desk holds it and as the API hands it back.
 *
 * `{id, canvasId, subject, grantedBy, at}` is the architecture's
 * `grants/{id}` row exactly; `revokedAt`/`revokedBy` are what revocation
 * needs and are the only addition. Since roles phase 4 the canvas id is one
 * arm of {@link GrantScope}, and a row may name a space instead.
 */
export type Grant = GrantBase & GrantScope;

export interface GrantBase {
  id: string;
  subject: GrantSubject;
  /**
   * Who granted it: the badge id that asked for the row, or one of the two
   * sentinels below for rows nobody asked for.
   */
  grantedBy: string;
  at: string;
  /**
   * When it stopped admitting. A TOMBSTONE rather than a delete, for two
   * reasons: a badge's admission carries `{root: "grant", grantId}` as its
   * provenance, and phase 9's sweep re-runs the door test against exactly
   * those roots — a row that vanished would leave provenance pointing at
   * nothing, which is the one shape that makes a sweep silently incomplete;
   * and "who turned the link off, and when" is the kind of question an
   * innkeeper is asked after the fact.
   */
  revokedAt?: string;
  revokedBy?: string;
  /** What this row admits its holder to do. Written whenever it is not
   * `edit` (see `narrowed`); absent is `edit` — see {@link Capability}. A
   * bar (below) has none. */
  capability?: Capability;
  /**
   * **A bar: this row says no** (roles design, "The bar"). Its subject may
   * not enter until the row is revoked, whatever any other row says — a
   * live bar beats every rung, which is why it is not a rung: rungs are
   * compared by highest-wins and a bar has to win. It is a grant row and
   * not a second table because everything that lists, revokes and sweeps
   * rows then works on it with no second path, and `isocan share` prints
   * it in the same table as *kept out*.
   *
   * A bar's subject is an address or a repo, never `link` and never a
   * group (`barSubjectRefusal`). The creator cannot be barred: the door
   * checks the floor before a bar takes effect, and the route refuses to
   * write a row that would do nothing. Written as `true` or not at all, the
   * way `capability` is written only when it narrows.
   */
  bars?: true;
}

/** Is this row a bar — a row that refuses rather than admits? */
export function isBar(grant: { bars?: true }): boolean {
  return grant.bars === true;
}

/**
 * `grantedBy` for the standing link grant a REPLICA writes for a canvas that
 * arrived from its home. No badge on this machine granted it — the home did,
 * and the home's own row is the authority; this one is the local daemon's
 * copy of the same sentence, governing who on THIS machine may reach the
 * canvas. See `server/grants.ts`.
 */
export const GRANTED_BY_HOME = "home";

/** `grantedBy` for a row written by the one-time migration, for canvases that
 * were born before grants existed. Distinguished from a real badge id so that
 * "who opened this canvas up?" answers "nobody — it predates the question". */
export const GRANTED_BY_MIGRATION = "migration";

/**
 * Why this is not a grant subject at all, or null when it is one.
 *
 * **SHAPE ONLY, since phase 9.** It used to carry the phase boundary too —
 * "`email:` needs an attester and this home has none" — and that sentence was
 * true of the vocabulary right up until badges could carry attestations.
 * Now it is true of a home's *configuration*, which core cannot see and must
 * not guess at: a home with Google sign-in wired can satisfy `email:` and one
 * without cannot, and both run this same function. So the "no attester here"
 * refusal moved to `server/attest.ts`, and what is left here is the question
 * core can actually answer — is this a subject at all.
 *
 * Splitting it that way is what keeps the two answers distinguishable. "Not a
 * grant subject" is a typo the caller can fix; "nobody here can verify that"
 * is a fact about the home, and a caller told the wrong one goes looking in
 * the wrong place.
 */
export function grantSubjectRefusal(subject: unknown): string | null {
  if (typeof subject !== "string" || subject === "") {
    return "a grant needs a subject — `link`, `email:<addr>` or `repo:<host>/<owner>/<name>`";
  }
  if (subject === LINK) return null;
  if (subject.startsWith("email:")) {
    // An address, not a display name. Deliberately the weakest possible check
    // — one `@` with something on each side and no whitespace — because the
    // ATTESTER is the real judge of whether an address exists, and a clever
    // regex here would refuse somebody's perfectly good mailbox on the way to
    // a mailbox that never needed our opinion.
    const addr = subject.slice("email:".length);
    const at = addr.indexOf("@");
    if (at <= 0 || at === addr.length - 1 || /\s/.test(addr)) {
      return `not an email address: ${addr} (a grant subject is \`email:someone@example.com\`)`;
    }
    return null;
  }
  if (subject.startsWith("repo:")) {
    // `<host>/<owner>/<name>` exactly, because that is what an attester is
    // handed to check. Two segments would be ambiguous about which host, and
    // ambiguity in a grant subject is a grant that admits the wrong people.
    const parts = subject.slice("repo:".length).split("/");
    if (parts.length !== 3 || parts.some((part) => part === "" || /\s/.test(part))) {
      return `not a repo: ${subject.slice("repo:".length)} (a grant subject is \`repo:github.com/acme/widgets\`)`;
    }
    return null;
  }
  return `not a grant subject: ${subject} (expected \`link\`, \`email:<addr>\` or \`repo:<host>/<owner>/<name>\`)`;
}

/**
 * Why this cannot be a BAR's subject, or null when it can.
 *
 * A bar names a person or a repo — something a badge proves — and never
 * `link`, because "anyone with the address may not enter" is the link turned
 * off, and never a group, because barring a group is un-inviting it (roles
 * design, "The bar"). The two bar-only refusals come BEFORE the shape check
 * on purpose: `group:` is not a grant subject until roles phase 5 adds it,
 * and when it is, this must still refuse it as a bar without being
 * re-taught.
 */
export function barSubjectRefusal(subject: unknown): string | null {
  if (subject === LINK) {
    return "the link cannot be kept out — turn it off instead (`isocan share --link off`)";
  }
  if (typeof subject === "string" && subject.startsWith("group:")) {
    return "a group cannot be kept out — un-invite it instead";
  }
  return grantSubjectRefusal(subject);
}

/**
 * **One spelling of an attribute, and everything goes through it.**
 *
 * A grant's subject and a badge's attestation are the same namespace on
 * purpose (see `Attestation.attribute`), so the door's test is string
 * equality — and string equality is only honest if both sides were written
 * the same way. `Jordan@Acme.Test` and `jordan@acme.test` are one mailbox;
 * `github.com/Acme/Widgets` and `github.com/acme/widgets` are one repository.
 * A door that compared them raw would refuse the person it just invited, and
 * it would do it invisibly — the row is there, the attestation is there, and
 * nothing matches.
 *
 * Lowercasing the whole address is *slightly* wrong by RFC 5321, where the
 * local part is case-sensitive. It is right about every mail provider anybody
 * actually uses, and the failure modes are asymmetric: case-folding merges
 * two addresses that in practice are one person, while not folding splits one
 * person into two and locks her out of a canvas she was invited to by name.
 *
 * **The PREFIX is deliberately not folded.** `email:` and `repo:` are our
 * vocabulary, written by `grantSubjectOf` and by whatever attester eventually
 * calls `Desk.attest` — never typed by a person — so a mis-cased `EMAIL:` is
 * not a spelling of anything, it is a caller sending something else.
 * `grantSubjectRefusal` says so in those words. What varies is the VALUE, and
 * the value is what this folds.
 *
 * It is exported because the CLI builds a subject from what somebody typed
 * and a future attester will build an attribute from what an IdP returned;
 * those are the two ends of the same equality and neither may spell it
 * itself.
 */
export function normalizeAttribute(attribute: string): string {
  const trimmed = attribute.trim();
  return attestedKindOf(trimmed) ? trimmed.toLowerCase() : trimmed;
}

/** The same, promised to be a subject. Written separately so the type says
 * which side of the equality a caller is on. */
export function normalizeSubject(subject: GrantSubject): GrantSubject {
  return normalizeAttribute(subject) as GrantSubject;
}

/**
 * **Does anything this badge has proved satisfy this row?** — the door's test
 * over attestations, and the whole of what phase 9 added to the door.
 *
 * `link` is deliberately NOT answered here: it is satisfied by presenting the
 * address, which is a fact about the request rather than about the holder, and
 * this function only ever sees the holder. `server/grants.ts` keeps that
 * branch where the request is.
 *
 * Equality and not a fuzzy match, at either subject type. A `repo:` subject is
 * "can read exactly this repository", not "is a member of this org" — the
 * design's sentence is *"the subject IS 'can read the repo'"*, and an
 * org-wide reading would silently widen every marker anybody ever committed.
 */
/**
 * Add an attestation to a badge's list, replacing any earlier proof of the
 * SAME attribute.
 *
 * It is in core rather than in a desk backing because **both backings need
 * it**, which is AGENTS.md's rule about shared computation applied one layer
 * below the clients: `FileDesk` upserts on write AND on log replay, `CloudDesk`
 * upserts inside its transaction, and three copies of "replace the row with
 * this attribute" would drift. The symptom of the drift would be a badge
 * holding two proofs of one mailbox — harmless until something starts caring
 * which is newer.
 *
 * Upsert rather than append because re-verifying is a thing people do, and two
 * rows for one mailbox are not two proofs: they are one proof and a stale
 * copy. Normalized on the way in, once, so the door's equality never has to
 * fold anything at request time.
 */
export function upsertAttestation(
  existing: readonly Attestation[] | undefined,
  attestation: Attestation,
): Attestation[] {
  const row: Attestation = {
    ...attestation,
    attribute: normalizeAttribute(attestation.attribute),
  };
  return [...(existing ?? []).filter((a) => a.attribute !== row.attribute), row];
}

export function attestationSatisfying(
  subject: GrantSubject,
  attestations: readonly Attestation[],
): Attestation | null {
  if (subject === LINK) return null;
  const wanted = normalizeSubject(subject);
  return attestations.find((row) => normalizeAttribute(row.attribute) === wanted) ?? null;
}

/** Is this row still admitting? Two halves, and phase 9 built the second: the
 * row stops admitting NEW arrivals (this function, since phase 7), and the
 * badges already admitted under it are expelled by the provenance sweep
 * (`server/sweep.ts`) — which re-runs the door test first, so a badge whose
 * attestations satisfy a surviving grant re-roots instead of dropping. */
export function isLive(grant: Grant): boolean {
  return grant.revokedAt === undefined;
}

// ---- the routes both the button and the verb drive ----

/** `GET` lists, `POST` creates. Canvas-scoped on purpose: the `onRequest`
 * hook's `canvasId ∈ admissions` check already guards everything under
 * `/api/projects/:id/`, so only an ADMITTED badge can read or change a
 * canvas's grants, with no per-route remembering. */
/** The `/api/projects/` path is a deliberate holdout (phase 13.5): it is the
 * wire between an installed CLI and a home. The helper renames; the path does
 * not. */
export const grantsRoute = (canvasId: string): string =>
  `/api/projects/${encodeURIComponent(canvasId)}/grants`;

/** `DELETE` revokes one. */
export const grantRoute = (canvasId: string, grantId: string): string =>
  `${grantsRoute(canvasId)}/${encodeURIComponent(grantId)}`;

/**
 * The same `DELETE`, with what rides on its query. A revocation sends no
 * body (a bodiless DELETE that declares a content type is a parse error),
 * so what it has to say goes here: `actorId`, who is acting, and `bar=1`,
 * **revoke and keep them out in one request** (roles design, "Withdrawing
 * versus barring") — the row is tombstoned and a bar for the same subject
 * is written before the one sweep runs. Spelled once so the browser, the
 * CLI and a replica's forwarder cannot disagree about the parameter's name.
 */
export const grantRevokeRoute = (
  canvasId: string,
  grantId: string,
  options: { actorId?: string; bar?: boolean } = {},
): string => {
  const query = new URLSearchParams();
  if (options.actorId) query.set("actorId", options.actorId);
  if (options.bar) query.set("bar", "1");
  const route = grantRoute(canvasId, grantId);
  const tail = query.toString();
  return tail ? `${route}?${tail}` : route;
};

export interface CreateGrantRequest {
  subject: GrantSubject;
  /** Omitted means `edit`, which is what every caller from before the field
   * asked for by not being able to ask. Not sent with `bars`. */
  capability?: Capability;
  /** Write a BAR rather than an invitation (see `Grant.bars`): the subject
   * is kept out until the row is revoked. A live row for the same subject is
   * replaced, the way a re-grant replaces one, and the sweep runs. */
  bars?: true;
  /**
   * **Who is acting** (roles design, "Over a replica, the write names the
   * person"). A write to grants asks `own`, and `own` is held by a PERSON —
   * the creator's floor is checked against the badge's claims. A badge that
   * claims several people (a browser with two personas, a daemon relaying a
   * whole machine) names the one acting here, and the home checks two
   * things: the actor is among the presenting badge's claims, and the actor
   * holds `own`. Absent, the home reads the badge's claims as a whole, which
   * is what every caller from before the field asked for by not saying.
   */
  actorId?: string;
}

export interface GrantsResponse {
  grants: Grant[];
}

/** What creating or revoking one answers with: the row itself, so a caller
 * knows the id it must keep to revoke later. */
export interface GrantResponse {
  grant: Grant;
  /**
   * What revoking it did to the people already inside — the provenance
   * sweep's count (see `SweepReport`).
   *
   * Optional because CREATING a grant expels nobody, and because a home from
   * before phase 9 answers without it: a client reading `swept?.expelled ?? 0`
   * gets the truth from an old home rather than a crash, which is the same
   * courtesy `?reach=admitted` extended in the other direction.
   */
  swept?: SweepReport;
  /**
   * **After a revocation: what would still admit the subject.** `link` when
   * the canvas's link is live and no bar names them — the difference between
   * withdrawing an invitation and barring a person (roles journey 3, step 3),
   * which the dialog and the CLI both owe the person before they act on it:
   * *they can still enter by the link; `--bar` to keep them out*. Computed
   * from the live rows after the revoke, so a `?bar=1` answers without it.
   * Absent when nothing would, and from a home from before bars. `space`
   * (roles phase 4) when a live row on the canvas's space names the same
   * subject: removing them here does not remove them, and the remedy is the
   * space's Share.
   */
  stillAdmittedBy?: "link" | "space";
  /** The bar written in the same request as the revocation (`?bar=1`), so a
   * caller knows the row it would revoke to let them back in. */
  bar?: Grant;
  /**
   * **How many canvases the sweep reached** — present on a write to a
   * SPACE's rows (roles phase 4), whose sweep is one `sweepCanvas` per canvas
   * in the space; `swept` is then the sum. Absent on a canvas write, which
   * reaches exactly one.
   */
  reached?: number;
}

// ---- the space: a named set of canvases access is set on once (roles phase 4) ----

/**
 * **A space** (roles design, "The space"): desk state at the home, like a
 * grant and for the same reason — it is part of what a grant means, and what
 * a grant means does not travel to a replica.
 *
 * The set of canvases lives HERE and not on the canvas record, because the
 * canvas record is oplog state and replicates to every laptop that holds the
 * canvas, and a laptop has no use for the id of a space it cannot see. It
 * also means moving a canvas is a desk write and not an op, so nothing in the
 * op vocabulary changes. A canvas is in at most one space; the write that
 * adds one refuses when it is already in another (`CANVAS_IN_SPACE`).
 *
 * `createdBy` is an actor id and it is the floor: the creator holds `own`
 * over the space and every canvas in it, and cannot lose it. A space has no
 * address, so it has no link row; `link` is refused as a space subject.
 */
export interface Space {
  /** `spc_…` */
  id: string;
  name: string;
  /** The actor who made it — the floor. */
  createdBy: string;
  canvasIds: string[];
  at: string;
  /** A tombstone, like a grant's: the row stays so the id keeps meaning what
   * it meant, and `spaceOf` stops naming it. */
  deletedAt?: string;
}

/** Is this actor the one who made the space? The same reading `ownsCanvas`
 * makes of `createdBy`, so the floor is one rule on two kinds of thing. */
export function ownsSpace(space: { createdBy: string }, actorId: string): boolean {
  return space.createdBy === actorId;
}

/** Is this space still standing? */
export function isSpaceLive(space: Space): boolean {
  return space.deletedAt === undefined;
}

/** How long a space's name may be. Generous — it is a heading on a list, not
 * an identifier — and bounded, because a name is stored on a row. */
export const SPACE_NAME_MAX = 80;

/**
 * Why this is not a space name, or null when it is one. Trimmed by the
 * caller; a name that is all whitespace is no name. Names are unique among
 * the ones a person owns, not across the home — that is a fact about the
 * desk and refused at the route (`SPACE_NAME_TAKEN`), not here.
 */
export function spaceNameRefusal(name: unknown): string | null {
  if (typeof name !== "string" || name.trim() === "") return "a space needs a name";
  if (name.trim().length > SPACE_NAME_MAX) {
    return `a space's name is at most ${SPACE_NAME_MAX} characters`;
  }
  if (/[\n\r]/.test(name)) return "a space's name is one line";
  return null;
}

/** The one spelling of "the same name" for the per-owner uniqueness rule:
 * trimmed and case-folded, so `Design` and `design ` are one space. */
export function sameSpaceName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** `GET` lists the spaces the badge may see; `POST {name}` makes one. All at
 * the home; a replica forwards through its one home. */
export const SPACES_ROUTE = "/api/spaces";

/** `DELETE` marks it deleted. */
export const spaceRoute = (spaceId: string): string =>
  `${SPACES_ROUTE}/${encodeURIComponent(spaceId)}`;

/** `PUT` adds the canvas; `DELETE` removes it. */
export const spaceCanvasRoute = (spaceId: string, canvasId: string): string =>
  `${spaceRoute(spaceId)}/canvases/${encodeURIComponent(canvasId)}`;

/** The grants routes, scoped to the space: `GET` lists, `POST` creates. */
export const spaceGrantsRoute = (spaceId: string): string => `${spaceRoute(spaceId)}/grants`;

/** `DELETE` revokes one. */
export const spaceGrantRoute = (spaceId: string, grantId: string): string =>
  `${spaceGrantsRoute(spaceId)}/${encodeURIComponent(grantId)}`;

/** The same `DELETE` with `actorId` and `bar=1` on its query, spelled once
 * like `grantRevokeRoute`. */
export const spaceGrantRevokeRoute = (
  spaceId: string,
  grantId: string,
  options: { actorId?: string; bar?: boolean } = {},
): string => {
  const query = new URLSearchParams();
  if (options.actorId) query.set("actorId", options.actorId);
  if (options.bar) query.set("bar", "1");
  const route = spaceGrantRoute(spaceId, grantId);
  const tail = query.toString();
  return tail ? `${route}?${tail}` : route;
};

/** **Every canvas in this space** — `POST {capability | "off"}` sets or
 * revokes the link row on every canvas in the space, in a loop, and answers
 * with the count (roles journey 4, step 4). */
export const spaceLinkRoute = (spaceId: string): string => `${spaceRoute(spaceId)}/link`;

/** The `DELETE`s on a space carry who is acting on the query, for
 * `grantRevokeRoute`'s reason: a bodiless DELETE announces no content type. */
export const spaceActingRoute = (route: string, actorId?: string): string =>
  actorId ? `${route}?${new URLSearchParams({ actorId }).toString()}` : route;

export interface SpacesResponse {
  spaces: Space[];
}

export interface CreateSpaceRequest {
  name: string;
  /** Who is making it — the floor. A badge that claims one actor need not
   * say; one that claims several must. */
  actorId?: string;
}

export interface SpaceResponse {
  space: Space;
}

/** A write on the space's set of canvases: `PUT` and `DELETE …/canvases/:id`,
 * and `DELETE /api/spaces/:id`. The sweep's count rides back, added up over
 * every canvas it reached. */
export interface SpaceCanvasRequest {
  actorId?: string;
}

export interface SpaceCanvasResponse {
  space: Space;
  swept: SweepReport;
  /** How many canvases were swept — one for a canvas added or removed, the
   * whole space for a delete. */
  reached: number;
}

/** `POST /api/spaces/:id/link` — the every-canvas link setting. */
export interface SpaceLinkRequest {
  /** A rung the link admits to, or `off`. Never `own`. */
  capability: Capability | "off";
  actorId?: string;
}

export interface SpaceLinkResponse {
  /** Every canvas in the space, walked. */
  reached: number;
  /** Of those, the ones whose link row was written or revoked — the rest
   * already stood as asked. */
  changed: number;
  canvasIds: string[];
  swept: SweepReport;
}

/** There is no such space, or it was deleted, or this badge may not see it —
 * the three answer alike, so a stranger learns nothing about the space around
 * a canvas they were invited to (roles design, "The space"). */
export const SPACE_NOT_FOUND = "space-not-found";
/** The canvas is already in another space — a canvas is in at most one. */
export const CANVAS_IN_SPACE = "canvas-in-space";
/** A request about a space that is not one: no name, no actor, a canvas
 * whose home is elsewhere, `link` as a space subject. */
export const BAD_SPACE = "bad-space";
/** This actor already owns a space of that name. Names are unique per owner
 * because the CLI resolves them; the wire carries ids. */
export const SPACE_NAME_TAKEN = "space-name-taken";

// ---- refusal ----

/**
 * The door said no, and the caller's badge is perfectly good.
 *
 * Its own status and its own code, distinct from `no-badge`/`bad-badge`
 * (401): a holder that is simply not admitted HERE must not be told to throw
 * its credential away and go back to the door — that would be a refresh loop
 * minting badges forever, and none of them would get in either. 403 with
 * `not-admitted` is the honest answer, and it is the one a Share dialog can
 * turn into "ask Priya for the link".
 */
export const NOT_ADMITTED = "not-admitted";

/**
 * The door said yes and the ledger says LOOK, DON'T TOUCH — an admission
 * below `edit` (`view` or `read`) meeting a write.
 *
 * Its own code, for `not-admitted`'s reason turned one notch: this caller is
 * both badged AND admitted, so neither "go to the door" nor "ask for the
 * link" is the remedy. The remedy is to ask whoever shared it to share for
 * editing, and a client can only say that sentence if the refusal is
 * distinguishable from the other two. 403, like `not-admitted`: the request
 * was understood and will not be honoured, and retrying cannot fix it.
 *
 * The code stayed `view-only` when the `read` rung arrived: old clients
 * branch on the code and keep working. The message widened — *you may read
 * this canvas but not change it* — see `ViewOnlyError` in the server.
 */
export const VIEW_ONLY = "view-only";

/**
 * The WS close code for the same refusal, continuing ws.ts's 4400/4401/4404
 * convention. **4402 and not 4403**, which would have been the obvious
 * mirror of HTTP 403: `WS_BAD_ORIGIN` already took 4403, and two different
 * refusals sharing a close code is exactly how a reconnect loop ends up
 * retrying the one it cannot fix.
 */
export const WS_NOT_ADMITTED = 4402;

/**
 * **The reason a refusal gives when the caller had been inside** (roles
 * design, "Reaching an open socket"). A `WS_NOT_ADMITTED` close carries it as
 * the close reason; a `not-admitted` on `POST /api/oplog/watch` carries it as
 * `reason`. The code is the same either way — an expelled badge is a badge
 * that is not admitted — and the word is the whole difference for the person
 * reading it: *your access to this canvas was withdrawn* is a different
 * sentence from *this canvas will not have you*, because they were in.
 */
export const WITHDRAWN = "withdrawn";
