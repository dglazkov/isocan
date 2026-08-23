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

/**
 * What a grant binds to — a **provable attribute**, per the design's "borrow,
 * never mint": isocan holds no passwords and no user table, so a subject is
 * something the holder can demonstrate with an attester they already have.
 *
 * Three subject types, v1, and the union is written as a template-literal
 * type so `email:` and `repo:` slot in WITHOUT a schema change when phase 9
 * gives badges attestations. What is missing today is not the type, it is the
 * attester: nothing can satisfy `email:` until a badge can carry a verified
 * email, so `grantSubjectRefusal` refuses those at the API rather than
 * writing a row that would admit nobody (a UI that lies).
 *
 * - `link` — anyone presenting the address. The status quo DEMOTED TO DATA:
 *   every canvas is born with a standing link grant, so "the address is the
 *   secret" stops being a regime and becomes one revocable row.
 * - `email:<addr>` — the Share dialog's "who" field. Phase 9.
 * - `repo:<host>/<owner>/<name>` — Scene 6's sentence made checkable:
 *   committing the marker was a grant to whoever can read the repo. Phase 9.
 */
export type GrantSubject = "link" | `email:${string}` | `repo:${string}`;

/** The one subject this phase can actually check. */
export const LINK: GrantSubject = "link";

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
 * Why this subject cannot be granted yet, or null when it can.
 *
 * Phase 9 owns attesters, so `email:` and `repo:` are refused HERE rather
 * than written and silently ignored at the door: an `email:` row is one
 * nothing can satisfy until a badge carries attestations, so accepting one
 * would write a grant that admits nobody while the dialog says somebody was
 * invited. The refusal names the phase, because "not yet" and "never" are
 * different answers and the caller deserves the right one.
 */
export function grantSubjectRefusal(subject: unknown): string | null {
  if (typeof subject !== "string" || subject === "") {
    return "a grant needs a subject — `link` is the only one this home can check today";
  }
  if (subject === LINK) return null;
  if (subject.startsWith("email:") || subject.startsWith("repo:")) {
    return (
      `${subject} needs an attester, and this home has none yet: a badge cannot ` +
      "prove an email or repo membership until phase 9 wires the attesters, so " +
      "the row would admit nobody. Share the link instead."
    );
  }
  return `not a grant subject: ${subject} (expected \`link\`, \`email:<addr>\` or \`repo:<host>/<owner>/<name>\`)`;
}

/** Is this row still admitting? Revocation in phase 7 means exactly this —
 * the row stops admitting NEW arrivals. Expelling badges already admitted
 * under it is the provenance sweep, which is phase 9's and needs re-rooting
 * to be correct (a badge whose attestations satisfy a surviving grant
 * re-roots instead of dropping). */
export function isLive(grant: Grant): boolean {
  return grant.revokedAt === undefined;
}

// ---- the routes both the button and the verb drive ----

/** `GET` lists, `POST` creates. Project-scoped on purpose: the `onRequest`
 * hook's `projectId ∈ admissions` check already guards everything under
 * `/api/projects/:id/`, so only an ADMITTED badge can read or change a
 * canvas's grants, with no per-route remembering. */
export const grantsRoute = (projectId: string): string =>
  `/api/projects/${encodeURIComponent(projectId)}/grants`;

/** `DELETE` revokes one. */
export const grantRoute = (projectId: string, grantId: string): string =>
  `${grantsRoute(projectId)}/${encodeURIComponent(grantId)}`;

export interface CreateGrantRequest {
  subject: GrantSubject;
}

export interface GrantsResponse {
  grants: Grant[];
}

/** What creating or revoking one answers with: the row itself, so a caller
 * knows the id it must keep to revoke later. */
export interface GrantResponse {
  grant: Grant;
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
 * The WS close code for the same refusal, continuing ws.ts's 4400/4401/4404
 * convention. **4402 and not 4403**, which would have been the obvious
 * mirror of HTTP 403: `WS_BAD_ORIGIN` already took 4403, and two different
 * refusals sharing a close code is exactly how a reconnect loop ends up
 * retrying the one it cannot fix.
 */
export const WS_NOT_ADMITTED = 4402;
