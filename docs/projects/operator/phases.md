# The operator — the walk

[`design.md`](design.md) is the argument; [`journey.md`](journey.md) is the
acceptance suite. Each phase ends with something a person can do, names
the journeys it closes, and closes only when they are walked for real —
on dev.isocan.io first (the `green` ref), then isocan.io.

**Phase citations name their project**: `operator phase 2`, never a bare
"phase 2".

**Ordered by what a real takedown request needs first.** A report arrives:
the operator has to be somebody the home recognises, then has to see what
the report is about, then has to stop it being served, then may have to
erase it. The acts about people — ending, turning off, refusing — come
after, because a takedown answers every one of those reports on its own,
more bluntly. The words on `/terms` come first of all, because they are
untrue today and fixing them costs nothing.

**Where we are:** phases 1, 2 and 3 are PART-DONE (12 Sep 2026): the
operator is proved per act and refused in words; a look admits for an hour
and is not in presence; a takedown stops the home serving a canvas and lifts;
a purge erases the bytes on both backings, keeps the record as the tombstone,
refuses unless the canvas was taken down first, and says what survives and for
how long; every act writes its ledger row before it answers. All of it green
here — the cloud halves against the Firestore emulator — and walked by hand
against local daemons; none of it walked on dev. Phase 0 still waits on
Dion's call on the wording. The dev walks for 1–3 wait on a person:
`ISOCAN_OPERATORS` on dev.isocan.io, a sign-in, a second account, a third
browser, and a decision about journey 1 step 3, which says Google where this
app has only an emailed link. Phase 4 (end a surface) is next, and its
owner's-path half is a bug fix that needs nothing.

**Sizes.** S is a day's work with its tests. M is two or three. L would be a
week; nothing here is one.

**One rule for every phase.** Every act writes its ledger row before it
answers, from the first act in phase 1. A power that exists before its
record does is the Firestore hand edit again.

---

## Phase 0 — Say what is true (S)

**Status: NOT STARTED.**

*No code. Dion's call.*

The two edits to `packages/web/src/lib/terms.ts` proposed in
[design.md](design.md#what-terms-should-say-meanwhile): the abuse paragraph
says which acts are done by hand and partly, and that refusal is not
built; the ledgers paragraph stops listing a badge-to-op log that does not
exist.

**Acceptance:** the page on isocan.io says it; `terms.test.ts` green
unchanged, since both sections keep their sources in `innkeeper.md`.

## Phase 1 — The operator, proved (M)

**Status: PART-DONE (2026-09-12).** Built, and everything provable without a
browser is proved: the refusals, the ledger, the two verbs, and both
no-operator sentences against a real daemon through the real binary. The walk
waits on a person — the list set on dev, a sign-in, and a second account.

Closes journeys 1, 10 and 11.

- `ISOCAN_OPERATORS` read beside `ISOCAN_AUTH_*`; `infra/70-cloud-run.sh`
  and `infra/prod.env` carry it. A home with no attester answers every
  operator route with one sentence saying so.
- The proof: `verifyIdToken` plus `auth_time` within the window, the
  address on the list, carried in one header. Refusals in words:
  `not-operator` names the address that was proved; `proof-stale` says how
  long ago.
- `/operator/prove` in the web app: the act's summary, the sign-in
  `signin.ts` already does, the loopback handoff, refusal of any
  non-loopback destination, and the magic-link path carrying its state
  through `/__/auth/action`.
- The ledger: `operator/{id}` in the cloud desk, a line type in the file
  desk's log.
- `isocan operator show <canvas>` and `isocan operator log`. The refusal
  inside a summoned session. The agent guide's one line.

**Acceptance:** on dev with the list set to one test address: `show` on a
canvas the operator was never admitted to prints its reach; a second
account proving an unlisted address is refused with that address named;
an `isocan operator` run from an rc session is refused before a browser
opens; eleven minutes after a proof the next act asks again; both acts are
in `log`. A local daemon with no attester says why it has no operator.

**Trajectory:**

- **2026-09-12** — A verb must ask the home before it opens anything. The
  no-operator sentence was built, served and tested on the route, yet
  unreachable from the only surface a person uses: `operator show` on a home
  with no attester opened the prove page and hung. Every later operator verb
  reaches the same preflight.
- **2026-09-12** — The ledger records refusals, not only acts. Somebody who
  signed in and asked this home to act is what an operator ledger exists to
  answer about afterwards.
- **2026-09-12** — `auth_time` travels beside the attestation, never on it. A
  freshness field on `Attestation` would be operator standing written onto a
  badge — D2 defeated by a type rather than a route.
- **2026-09-12** — The handoff rides in one path segment, because
  `/__/auth/action` keeps only the path and appends `continueUrl` unencoded.
- **2026-09-12** — Operator acts are never forwarded: a replica answers 409
  naming the home, since a proof is made against one attester project. Every
  phase-2 verb needs the branch.
- **2026-09-12** — Open: the walk — `ISOCAN_OPERATORS` on dev.isocan.io, a
  sign-in, a second account. Waits on Dion; the list is Dimitri's.
- **2026-09-12** — Open: journey 1 says *signs in with Google*; `signin.ts`
  offers only an emailed link. Either the walk is that link, or the button
  comes first.
- **2026-09-12** — Open: `show` on a soft-deleted canvas is a 404 and
  `OperatorReach` has no `deleted`. Takedown is where it comes from.
- **2026-09-12** — Open: the reach says *N relaying now*, never *linked* — no
  registry of machines that have linked exists.

## Phase 2 — Look, and take it down (M)

**Status: PART-DONE (2026-09-12).** Built, and everything provable against a
real daemon is proved: the look that admits and is not in presence, the
takedown that refuses every canvas route with the sentence and never a 404,
the sockets closed `taken-down`, the parked wait woken and refused, the rc
holds ended, the engine's copy dropped, the files left where they were, the
lift, and the ledger. The walk on dev — a second account, a third browser, a
replicating daemon, a frame from isocan.store — waits on a person.

Closes journeys 2, 3, 4 and 5.

- `look`: the operator pass, the `{root: "operator", until}` admission the
  door honours for an hour and the sweep leaves alone; the ledger row.
- `takedown` and `--lift`: `takenDownAt` on both store backings, refused by
  `load` where `deleted` is; the `takedowns/` desk row; the engine drops its
  copy; the `taken-down` close reason, distinct from `canvas-deleted`; the
  wait woken and refused; the rc holds for the canvas ended; the home link
  stopping on `taken-down` and keeping its copy; the canvas list carrying
  the sentence; the CDN line printed.
- The sentence on the tab, the wait, the list and `isocan status`.

**Acceptance:** on dev, a canvas made by a second account, with a tab open
in a third browser, an `isocan wait` parked on it, a daemon replicating it,
and a frame rendered from isocan.store: the operator looks and is absent
from presence; takes it down; the tab shows the sentence within a second;
the wait exits non-zero with it; a signed URL minted a minute before is
refused by the origin (read at the origin, not through the edge); the
daemon stops redialling and still opens its copy; the owner's list shows
it greyed with the reason. `--lift`, and all of it comes back.

**Trajectory:**

- **2026-09-12** — The takedown flag lives beside `deleted` on the STORE and
  never on the `Canvas` record, because that record replicates: a field there
  would reach every replica and stop each one opening its own copy — a
  takedown that deletes.
- **2026-09-12** — `/api/ops` carries its canvas in the body, so the door hook
  cannot cover it; the first build answered the owner's delete with *canvas not
  found*, the one sentence a takedown must never produce. Every canvas-wide
  refusal needs its own line at that route.
- **2026-09-12** — The look is the first admission that ends on its own, so
  `desk.admit` replaces an expired row rather than keeping it; the old
  *already in* test would have made a second look write nothing.
- **2026-09-12** — A refusal is not a blip: `HomeLink.repair` re-dialled one
  every two seconds forever, and `withdrawn` had the same storm. A lift needs
  the slow retry, not a stop.
- **2026-09-12** — Open: the walk — dev.isocan.io, a second account, a third
  browser, a real replica, a frame from isocan.store, and `isocan status`'s
  taken-down line, which needs two daemons. Waits on Dion.
- **2026-09-12** — Open: whether the owner may delete a canvas that is taken
  down. Today she is refused with the sentence; erasing before a purge is the
  operator's problem. Operator phase 3's call.
- **2026-09-12** — Open: `show` on a purged canvas — the tombstone survives on
  the cloud backing and not on the file one. Operator phase 3 decides.

## Phase 3 — Purge (S)

**Status: PART-DONE (2026-09-12).** Built and proved on both backings here — the
file backing end to end through the real binary, the cloud backing against the
Firestore emulator (subcollections empty, the document kept as the tombstone)
and an object-store double for the bucket. The walk on dev — the real bucket
prefix, the real subcollections, `adopt` against dev — waits on a person.

Closes journey 6.

- `Store.purgeCanvas` on both backings: the bucket prefix, the `ops` and
  `blobmeta` subcollections; the canvas document kept as the tombstone.
- `purge` refused unless taken down; the output's four horizons.

**Acceptance:** after a purge on dev, the canvas's prefix lists nothing in
the bucket, the subcollections are empty, `adopt` of the same id is
refused, and the printed horizons match `infra/30-bucket.sh` and
`infra/90-backup-export.sh` — asserted by a test that reads the scripts,
so the day a horizon changes the sentence fails rather than lies.

**Trajectory:**

- **2026-09-12** — A purge is refused at the store, not only at the route:
  both backings throw on a canvas that is not taken down, so no wiring above
  the seam can make an erasure the first act on a canvas.
- **2026-09-12** — The purge mark is its own flag beside the takedown's, and
  `load` refuses on it whatever the takedown flag says; a lift after a purge
  would otherwise serve an empty canvas under a taken name.
- **2026-09-12** — The three cloud horizons live in `@isocan/cloudstore`, read
  out of `infra/` by a test; the fourth, members' replicas, is core's and true
  of every backing. A file home prints one line, not four.
- **2026-09-12** — The owner stays refused after a purge: a delete that went
  through would erase her members' replicas, the one reach a takedown withholds
  from the operator. Answers operator phase 2's first Open entry.
- **2026-09-12** — `show` on a purged canvas is true on both backings because
  both keep the record as the tombstone; the file backing now does too. Answers
  operator phase 2's second Open entry.
- **2026-09-12** — The cloud suites had been green by skipping. The emulator
  ran on this machine for the first time today and found a phase-2 bug in its
  first minute: a Firestore merge onto a missing document creates it. Every
  earlier "both conformance suites green" was the file half twice.
- **2026-09-12** — Open: the walk on dev — the real bucket prefix listing
  nothing, the real subcollections, `adopt` against dev, the horizons a hosted
  home prints. Waits on Dion.
- **2026-09-12** — Open: Dimitri's question 6 — ninety days in the exports as
  the honest end, or purge the exports too. The verb says the number.

## Phase 4 — End a surface, and mean it (M)

**Status: NOT STARTED.**

Closes journey 7. **The half that fixes the owner's path ships first and
alone**, because it is a bug fix nobody needs a decision for.

- For everyone: a kill reported by the sweep hub, so the dead badge's
  sockets close with a reason; its held watch woken and refused;
  `redeemPass` refusing a dead minter's pass; the 401 carrying the
  tombstone's reason.
- For the operator: `end` by badge, actor (through `resolveActor`) or
  address (through `badgesAttesting`); the reach listed before the act,
  enrolments and registrations included; `--with-enrolments`; the CLI not
  resuming an actor after an end by the operator.

**Acceptance:** the owner's path first — end a laptop's badge from a phone
while the laptop has a tab open and a wait parked: the tab closes, the wait
exits, the laptop's outstanding pass is refused. Then journey 7 on dev,
steps 1 to 5.

## Phase 5 — Turn off a grant (S)

**Status: NOT STARTED.**

Closes journey 8.

- `revoke` on a canvas or a space, any subject, `--bar`; `revokedVia:
  "operator"` on the row; the Share dialog and `isocan share` reading it.

**Acceptance:** journey 8 on dev, including the owner turning the link back
on, and the ledger holding the operator's row but not the owner's — the
owner's act is the owner's.

## Phase 6 — Refuse at the door (M)

**Status: NOT STARTED.**

Closes journey 9.

- `refusals/` on both desks, loaded at boot and re-read on write.
- Read at the door hook (attestations, claims), at `/api/attest`, at
  `actor.claim`, and at the mint meter (`net:`, expiring).
- `refuse`, `--for`, `--lift`; refusing an address ends every badge that
  proved it.
- The sentence at the door, at the verify dialog, and at a refused mint.

**Acceptance:** journey 9 on dev, from two networks — a refused `/24` and
one that is not — with the refusal gone on its own at `--for 10m`.

## Phase 7 — The page says what is built (S)

**Status: NOT STARTED.**

- `/terms` rewritten to describe the built acts, and the purge's horizons —
  Dion's call again, drafted here.
- `terms.test.ts` taught to cite this design beside `innkeeper.md`, since a
  record may not be edited and the promises now live here.
- Whatever Dimitri decides about a public count.

**Acceptance:** the page on isocan.io; the test failing when a cited
sentence leaves this design.

## Phase 8 — A home with no attester (S, later)

**Status: NOT STARTED.**

The case the proof cannot reach: a self-hosted home that borrows no
attester. The candidate is a key in the desk directory, minted at first
boot, readable only by whoever already holds the ledgers — for a file
store, that person can already read everything, so the key grants nothing
they lack. Not built until a self-hosted home asks, and designed then.

**Acceptance:** journey 11 step 2 changes from a sentence to a working
path.

---

## Decided and open

**Decided by this design** (each stands until Dion or Dimitri reverses it):
D1–D11 in [design.md](design.md#decisions) — the proof, no stored standing,
the daemon as the only path, no agents, no ops, takedown before purge,
no roster, and the kill gaps fixed for everyone.

**Open for Dimitri:** isocan.io's list; the freshness window; whether a
takedown reaches replicas; whether a look is disclosed; whether the reason
is shown; the export horizon; purging owner-deleted canvases; a proven
address to create; a public count. Phases 1–3 need only the first.

**Open for Dion:** the terms wording (phase 0 and phase 7); the CLI-first
bet; `operator` in everyone's `--help`.

**#77's questions** are answered in [design.md](design.md#dimitris-questions-answered),
each against the phase that builds the answer: the proof in 1, the path in
1, the record in 1 and the words in 2, the refusal in 6, the terms in 0.
