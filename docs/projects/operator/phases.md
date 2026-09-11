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

**Where we are:** designed 11 Sep 2026. Nothing built. Phase 0 waits on
Dion's call on the wording; phase 1 is next and needs nothing decided
except isocan.io's list, which is Dimitri's.

**Sizes.** S is a day's work with its tests. M is two or three. L would be a
week; nothing here is one.

**One rule for every phase.** Every act writes its ledger row before it
answers, from the first act in phase 1. A power that exists before its
record does is the Firestore hand edit again.

---

## Phase 0 — Say what is true (S)

*No code. Dion's call.*

The two edits to `packages/web/src/lib/terms.ts` proposed in
[design.md](design.md#what-terms-should-say-meanwhile): the abuse paragraph
says which acts are done by hand and partly, and that refusal is not
built; the ledgers paragraph stops listing a badge-to-op log that does not
exist.

**Acceptance:** the page on isocan.io says it; `terms.test.ts` green
unchanged, since both sections keep their sources in `innkeeper.md`.

## Phase 1 — The operator, proved (M)

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

## Phase 2 — Look, and take it down (M)

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

## Phase 3 — Purge (S)

Closes journey 6.

- `Store.purgeCanvas` on both backings: the bucket prefix, the `ops` and
  `blobmeta` subcollections; the canvas document kept as the tombstone.
- `purge` refused unless taken down; the output's four horizons.

**Acceptance:** after a purge on dev, the canvas's prefix lists nothing in
the bucket, the subcollections are empty, `adopt` of the same id is
refused, and the printed horizons match `infra/30-bucket.sh` and
`infra/90-backup-export.sh` — asserted by a test that reads the scripts,
so the day a horizon changes the sentence fails rather than lies.

## Phase 4 — End a surface, and mean it (M)

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

Closes journey 8.

- `revoke` on a canvas or a space, any subject, `--bar`; `revokedVia:
  "operator"` on the row; the Share dialog and `isocan share` reading it.

**Acceptance:** journey 8 on dev, including the owner turning the link back
on, and the ledger holding the operator's row but not the owner's — the
owner's act is the owner's.

## Phase 6 — Refuse at the door (M)

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

- `/terms` rewritten to describe the built acts, and the purge's horizons —
  Dion's call again, drafted here.
- `terms.test.ts` taught to cite this design beside `innkeeper.md`, since a
  record may not be edited and the promises now live here.
- Whatever Dimitri decides about a public count.

**Acceptance:** the page on isocan.io; the test failing when a cited
sentence leaves this design.

## Phase 8 — A home with no attester (S, later)

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
