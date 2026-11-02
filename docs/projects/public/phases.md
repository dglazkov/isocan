# Public — the walk

**Where we are:** all three phases are closed, 13 September 2026. Explicit
owner publication, both catalogue surfaces, lifecycle and browser privacy
are independently verified. Source commit 3e4e2bf7 passed CI with Firestore
and the bundle required. No live canvas was published. Personal memory is
the next project in the requested continuation.

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

**Status: CLOSED.** 13 September 2026 — explicit owner publication and the
separate catalogue work on CLI and web, backed by both durable desks.

**Proof:** real CLI calls on synthetic home/replica daemons publish, inspect,
list and unlist a read/view canvas. Owner and invalid-rung checks hold at the
API; legacy grants remain unlisted; both backings retain decisions. The web
has Share, home and unsigned-public doors using the same policy and metadata.
Run full tests, workspace typecheck and build; preserve the entry ceiling.

**Verification:** the conductor ran actual CLI publication, inspection and
anonymous listing against synthetic daemons, then drove the built app as an
owner and fresh stranger. Editor publication was disabled; Canvas Viewer
asked for a name and Presentation Viewer opened its actual slide unnamed.
Catalogue focus/hover produced no canvas content reads, admission or writes.
Unlisting retained the same grant and known-address read. Home/replica and
FileDesk/CloudDesk lifecycle and pass proofs passed in the full required-
emulator suite: 5,054 tests passed. Three existing ACP/dispatch skips
remained; a stale-build bundle skip was then closed by rebuilding and rerunning all three budget
checks successfully.
Typecheck and build exited 0; entry 730,722 bytes, ceiling 734,200 unchanged.
The first full run exposed two missing export comments and a three-route
owner guard made stale by the fourth route; both were corrected without
relaxing the ownership or documentation limits.

## Phase 3 — Prove the public lifecycle

**Status: CLOSED.** 13 September 2026 — the actual browser, authoritative
lifecycle, both backing implementations and required-emulator CI held.

**Proof:** drive the actual browser as owner and fresh stranger. Public browse
fetches no canvas snapshot, history, blob, thumbnail, admission or seen-mark;
read/view entry uses the existing door. Unlist retains link access; off/on,
replacement and read→edit→read require explicit republishing. Race listing
with revocation; restart both backings; test foreign replicas, refusals,
takedown/lift and purge. Check noindex responses and unchanged ordinary
discovery/Inbox/watch scope. Run full tests, typecheck and the built-browser
journeys, and inspect CI with the Firestore emulator required.

**Verification:** `node scripts/public-journeys.mjs` now retains the real
CLI/browser walk in the repository. The conductor ran it with two fresh
Chrome profiles: pointer publication, anonymous catalogue hover/focus, zero
private canvas requests before entry, actual unnamed slide rendering and
named read-only entry. A viewer write returned 403 with project, canvas and
operation head unchanged. Unlisting retained known-address access; off/on
stayed unlisted. Request evidence and screenshots were inspected.

The conductor also ran all ten standard built-browser journeys (zero failing),
the deliberately failing journey selftest, all seven grader selftests and
all fourteen metric selftests. Full integrated tests, with both emulator and
bundle required: 5,055 passed across 505 files, three existing ACP/dispatch
skips, exit 0. Workspace typecheck exited 0. The existing lifecycle and
operator tests cover revocation races, fresh backing instances, retained
replicas, takedown/lift, purge, bars, ended and refused callers. Release CI
[34779381108](https://github.com/dglazkov/isocan/actions/runs/34779381108)
passed on source commit 3e4e2bf7 and advanced the generated refs; the final
proof-support scripts additionally passed the same local suite and graders.

## Trajectory

- **2026-09-13** — Public belongs in a separate catalogue. Widening the
  existing working list would pull public canvases into Inbox, agent waits
  and unrelated discovery surfaces. Choosing an entry is the ordinary act
  that makes it a visited canvas.
- **2026-09-13** — Listing is tied to a concrete link grant. A transactional
  decision cannot resurrect its revoked row; replacing a grant starts with
  no publication consent. Sharing remains home-owned desk state.
- **2026-09-13** — The read-before-owner-pass walk exposed an admission
  that treated every live root as equivalent. Both backing mutations now
  admit a stronger proven pass over a weaker ordinary root, while preserving
  stronger standing and the active operator look ceiling on refresh.
- **2026-09-13** — A replica's public page cannot boot if its own built
  assets are redirected to another home. Existing static files load before
  page signposting; only the exact catalogue page is exempt from that
  signpost. Ordinary replica page destinations retain their behavior.
