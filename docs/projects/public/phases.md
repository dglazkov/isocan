# Public — the walk

**Where we are:** phase 1's contract is defined. Phase 2 is next: implement
publication and the catalogue on both clients. Phase 3 independently proves
the lifecycle, storage, privacy and actual browser journeys. No live canvas
is published as part of this work.

## Phase 1 — Define deliberate publication

**Status: CLOSED.** 13 September 2026 — #292 and the current sharing model
were reconciled into the journey and design before implementation.

**Proof:** compare the contract with the current permission ladder, private
Desk ledgers, authoritative discovery and browser entry faces. Resolve
publication versus admission, allowed capabilities, metadata, unlisting,
replicas, attribution and indexing explicitly. Check the project docs agree.

**Verification:** the conductor and independent server/client censuses found
the two-ledger conflict, a stale-row revocation race, preview-fetching home
cards and the unsigned FrontPage's identity gate. The design addresses each.

## Phase 2 — Publish and browse on both surfaces

**Status: NOT STARTED.**

**Proof:** real CLI calls on synthetic home/replica daemons publish, inspect,
list and unlist a read/view canvas. Owner and invalid-rung checks hold at the
API; legacy grants remain unlisted; both backings retain decisions. The web
has Share, home and unsigned-public doors using the same policy and metadata.
Run full tests, workspace typecheck and build; preserve the entry ceiling.

## Phase 3 — Prove the public lifecycle

**Status: NOT STARTED.**

**Proof:** drive the actual browser as owner and fresh stranger. Public browse
fetches no canvas snapshot, history, blob, thumbnail, admission or seen-mark;
read/view entry uses the existing door. Unlist retains link access; off/on,
replacement and read→edit→read require explicit republishing. Race listing
with revocation; restart both backings; test foreign replicas, refusals,
takedown/lift and purge. Check noindex responses and unchanged ordinary
discovery/Inbox/watch scope. Run full tests, typecheck and the built-browser
journeys, and inspect CI with the Firestore emulator required.

## Trajectory

- **2026-09-13** — Public belongs in a separate catalogue. Widening the
  existing working list would pull public canvases into Inbox, agent waits
  and unrelated discovery surfaces. Choosing an entry is the ordinary act
  that makes it a visited canvas.
- **2026-09-13** — Listing is tied to a concrete link grant. A transactional
  decision cannot resurrect its revoked row; replacing a grant starts with
  no publication consent. Sharing remains home-owned desk state.
