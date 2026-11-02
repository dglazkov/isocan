/*
 * **The capability ladder, and the codes a door says no with** (moved out of
 * `grants.ts` on 14 Oct 2026, unchanged; `grants.ts` re-exports all of it).
 *
 * Every canvas the web app opens asks these questions on its first paint —
 * may this person edit, what is their rung called beside their face, was this
 * socket closed because they are not admitted — and nothing else in
 * `grants.ts` is needed there. While they lived in that file, the rest of it
 * (subjects, attestations, spaces, groups and every route the Share dialog
 * drives) came with them into every first visit, because a module in the
 * entry chunk carries every export any chunk uses.
 */

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
