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
 * What a grant lets its holder DO once the door says yes — the roles question
 * `identity-desk.md` left open ("that waits for a scene that forces it"),
 * answered by the scene that forced it: a presentation (#87) whose viewers
 * must not walk in and start moving things (#88).
 *
 * Two words and not a matrix. `edit` is everything admission has always
 * meant; `view` is admission to READ — the snapshot, the oplog, the blobs,
 * the socket's fan-out — and nothing that writes. The refusal is server-side
 * at the op chokepoint, not a hidden toolbar: a capability that only a client
 * enforced would be what the scrubber's comment calls a habit rather than a
 * rule.
 *
 * **Absent means `edit`, everywhere.** Every grant row and every admission
 * written before this field existed meant full access, so the absent field
 * must go on meaning exactly that — and the wire, the desk and Firestore all
 * store the field only when it narrows.
 */
export type Capability = "edit" | "view";

/** The one reading of an absent field: a grant from before capabilities — or
 * one written without narrowing — admits to everything, as it always did. */
export function capabilityOf(grant: { capability?: Capability }): Capability {
  return grant.capability ?? "edit";
}

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
 * One grant, as the desk holds it and as the API hands it back.
 *
 * `{id, canvasId, subject, grantedBy, at}` is the architecture's
 * `grants/{id}` row exactly; `revokedAt`/`revokedBy` are what revocation
 * needs and are the only addition.
 */
export interface Grant {
  id: string;
  canvasId: string;
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
  /** What this row admits its holder to do. Written only when it NARROWS
   * (`view`); absent is `edit` — see {@link Capability}. */
  capability?: Capability;
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

export interface CreateGrantRequest {
  subject: GrantSubject;
  /** Omitted means `edit`, which is what every caller from before the field
   * asked for by not being able to ask. */
  capability?: Capability;
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
}

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
 * The door said yes and the ledger says LOOK, DON'T TOUCH — a view admission
 * meeting a write.
 *
 * Its own code, for `not-admitted`'s reason turned one notch: this caller is
 * both badged AND admitted, so neither "go to the door" nor "ask for the
 * link" is the remedy. The remedy is to ask whoever shared it to share for
 * editing, and a client can only say that sentence if the refusal is
 * distinguishable from the other two. 403, like `not-admitted`: the request
 * was understood and will not be honoured, and retrying cannot fix it.
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
