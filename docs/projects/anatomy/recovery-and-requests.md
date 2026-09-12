# Read recovery and analysis requests

12 September 2026. Follow-up on `anatomy` after the fluid-exploration checkpoint.

1. Add an item-scoped diagnostic reader. Healthy concepts remain browsable when
   another concept, relationship, or optional checkpoint is invalid. Preserve
   strict imports/exports and mutations. Show repair links and retry, clear stale
   snapshots on a failed root read, and expose the same report through the CLI.
2. Resolve analysis targets in one shared helper. Explicit selection, attachment,
   an unambiguous sole analysis, stale references, and repository mismatch have
   the same meaning in both clients. Requesting work does not change attachment
   or repository. Subsequent imports do not silently replace either property.
3. Record requests as versioned native files linked to native Chat. Return stable
   request/comment IDs, show requested versus agent-reported work and outcomes,
   and support guarded claim, completion, failure, cancellation requests and
   retries through the CLI. UI requests use the same operations. No submitted
   request implies a worker exists or has repository access.
4. Verify partial reads, strict write refusal, target ambiguity/mismatch, request
   races and transitions with reducer and daemon tests. Drive recovery and status
   in the browser, then run the full suite, typecheck and production build.

Run records use native items and conditional `item.edit`; this work needs no
Anatomy-specific daemon route. Multi-item import is still a resumable sequence,
not a transaction. Cancellation asks the worker to stop and needs acknowledgement;
it cannot reverse work already performed. A reported running state is a worker's
claim, not proof that its process remains alive.

## Acceptance record

Implemented all four steps. Request records are module-owned native files; no
new core operation or public host capability was necessary. File recovery and
request transitions use `item.edit`, preserving conditional apply and undo.
Module CLI guide and command instructions describe the same operations as the
browser. The generic native file viewer is retained; the module adds a focused
historical-body preview because that viewer does not expose version recovery.

Focused tests cover malformed concepts, optional checkpoints, duplicate IDs,
parent cycles, wrong file types, strict export refusal, empty root reads,
validated recovery, stale recovery rejection and undo. Request tests cover
attachment precedence, missing/ambiguous targets, repository mismatch,
non-mutating targeting, concurrent duplicate requests and claims, failed Chat
delivery/resume, executor ownership, revision/result validation, cancellation
racing a worker write, acknowledgement, retry and direct-Chat record-only work.
The real daemon/CLI journey verifies diagnostic reads, recovery and the complete
request → claim → failure → retry → cancellation → retry → completion path.

Browser acceptance used a separate synthetic canvas. A malformed workflow left
three healthy concepts visible with item-scoped diagnostics and graph editing
disabled. Previewing its prior version showed its full saved body; restoring it
returned all four concepts and cleared diagnostics. No other concept, native ID,
position or discussion was replaced. Request submission showed **Requested;
awaiting agent**, and native Chat said nobody was parked. Browser cancellation
remained pending until the CLI acknowledged it. Browser retry retained the old
receipt and linked a new one. A synthetic CLI completion showed its reviewed
revision and explicit “no repository scan performed” limitation; View result
opened the correct analysis Overview. Changing the associated repository made
the update button unavailable with a mismatch explanation; choosing New analysis
made the new target explicit. The synthetic repository setting was restored.

The open request history originally squeezed the desktop canvas to 28 px.
Bounding and scrolling the history restored 235 px of stage at 1280 × 720.
A 390 × 844 check had no horizontal overflow; the narrow-screen history is capped
at 180 px to leave room for the stage and inspector. Temporary viewport settings
were reset. The real repository analysis was not modified by these checks.

The execution boundary remains deliberate: records preserve reported outcomes,
not a liveness monitor; no-worker or no-access requests do not invent work.
Completion records the executor's reviewed revision, not a server-verifiable
repository scan. Bulk imports are still sequential native operations, not atomic
transactions. Recovery restores a validated file body; title/relationship
metadata repairs use native metadata editing. Semantic patches, checkpoint diff
and change-set previews remain the next separate work.


Final suite: **4,190 tests passed, 70 skipped**, plus workspace typecheck and
production build. The entry remains approximately 665 KB; diagnostics, request
operations and recovery dialogs stay in the lazy module workspace. CLI guide
surface and shared-operation reachability checks pass. No hosted deployment,
new real-repository scan, or recruited-user study was part of this test run.

A final browser check held an unsaved workflow draft while another client broke
an unrelated concept. The editor stayed mounted with the exact draft and an
inline explanation, Save was disabled, and repairing the other file re-enabled
Save without changing the draft. The synthetic failure and draft were cleaned
up. Final narrow measurements left a 150 px stage and 196.5 px inspector fully
inside the 844 px viewport with request history open. Request creation and its
Chat post also share one undo group; the real CLI test removes and replays both.
