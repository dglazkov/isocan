# An admitted request, its brief and its evidence

The debt is that phase 1 can answer a question only after someone has supplied
an existing JSON brief. An ordinary request needs one durable identity, a
readable brief and a continuation path that both clients can use. This is the
phase 2 mechanism. It extends [contracts.md](contracts.md); it is not a claim
that the implementation or model-quality proof has shipped.

## Two canonical acts

`design.request` has five discriminated actions: start, update, resume, cancel
and complete. Start creates a brief item; the other actions conditionally
version that item. `design.receipt` creates a separate evidence item. Each
visible act has one operation and one ordinary item/group inverse. Completing
the brief precedes publishing a receipt bound to that exact completed version.
Completed progress does not imply verified readiness.

The serialized writer validates the payload and current state, generates the
JSON bytes with `Store.putBlob`, then resolves one closed item effect through
the existing placement and group normalization. It must not recursively call
`Engine.putBlob` while holding the writer queue. The canonical specialized
operation records the resolved effect; replay does not resolve placement,
context, actors or policy again. This is not a generic atomic batch.

Each admitted ItemVersion has a small canonical marker: record kind, request
ID, epoch, originating operation ID, authenticated public-intent digest and
bounded retained reference metadata.
The JSON remains the record, parsed on demand; the marker is admission and
retention information, not a second cached brief. Generic uploaded JSON is
readable but acquires no canonical standing. Public item add/edit/restore and
version fields cannot forge the marker or bypass lifecycle guards. Content
changes to an admitted brief use the request operation. Published receipts
retain their exact authored evidence; currentness is derived, never patched
into old evidence. Ordinary removal and internal undo/redo still work.

Use a distinct request/receipt decoder feature. A questionnaire-capable client
is not necessarily capable of decoding these versions or operations. Enforce
request and response/inverse negotiation on HTTP, sockets, replicas, archived
retries and restored versions. Preserve the original caller's feature header
through a relay, as phase 1 established.

## Authority, retries and restoration

Start captures one stable request ID, item ID, version ID and operation ID.
For canvas chat, the writer resolves the actual source comment and its author,
including actor joins. For an external request, the authenticated submitting
actor is its author; a claimed person in a payload cannot establish human
custody. The mutating actor and original requester are distinct facts. Ordinary
canvas permissions apply to every lifecycle act.

Fresh updates and completion require the current captured brief version and
epoch. Resume/takeover is explicit, advances the epoch, records its reason and
acting identity, and preserves original source, requester and settled facts.
It may deliberately reconcile an edited source's newly captured body. Ordinary
updates cannot silently rewrite source identity or reset cancellation standing.
The writer captures source body identity and an ordered comment boundary, not
only source ID and timestamps. Missing source or missing boundary is stale.

A literal `/cancel` by the original requester in the source thread after that
boundary cancels current work. Quoted text, another actor and arbitrary
client timestamps cannot do so. Typed cancellation also covers external work
and the visible task control. Resume deliberately captures a new boundary.
While cancellation or a newer epoch is current, an old worker cannot complete
or publish accepted evidence. A removed source cannot be replaced silently:
restore it explicitly or start a new request with honest new provenance.

**Undo intentionally restores facts.** Restoring an earlier active version
may restore that identity's eligibility if all source, cancellation and context
guards still hold. A surviving literal requester `/cancel` still blocks work.
This does not promise irreversible worker revocation across an explicit Undo;
no hidden monotonic revocation ledger is introduced. Delete/restore follows
the same rule. Normal resume advances epoch and refuses old work while the
newer version is current.

Apply phase 1's stable retry boundary: compare exact intended payload, identities
and authenticated actor before generic receipt lookup, including archived
history. An identical accepted retry remains an observation after cancellation;
changed payload or actor conflicts. Delivery preserves accepted/pending/refused,
`submittedOpId`, actual canonical `opId` or null, and receipt/snapshot evidence.
Unknown fields are rejected rather than silently acquiring future semantics.
For lost-ack snapshot confirmation, matching an operation ID alone is insufficient:
a changed-content retry might have been refused while the original version
remains visible. The writer-owned digest binds the validated public semantic
operation and canonical authenticated actor, excluding its resolved effect,
with deterministic key-order-independent serialization. Compare that digest
before reporting snapshot-confirmed acceptance. Public input cannot supply it.

## Context, source bytes and governing identity

Reuse the existing context manifest and its writer resolution. When a source
comment has a captured scope, prefer that frozen scope. An absent frozen scope
must not be described as the original selection. Explicitly record a current
selected-root or ambient-pin capture where needed, including legacy canvases;
do not introduce a new inheritance precedence or require migration just to
start a design task. Admission can call `contextManifest` or
`ambientContextManifest`, then `hydrateContextManifest`; these existing helpers
do not require group mode. Preserve the separate comment/HTTP group gates.
Record frozen-source, current-selected-roots or current-ambient-pins provenance;
legacy closure uses actual roots/annotations/pins, not geometric containment.

Extract reusable governing-document orchestration from the current audit
reader behind injected read ports. Preserve `governingDesign`, `designSystem`,
`readInheritedCanvases` and policy-bearing `sourceBlobText` semantics. The
server cannot import API, which already depends on server; shared pure selection
and a small injected orchestration belong below both clients where required.
The Node port retains `automaticSourceClient` checks on actual reads and the
browser uses its existing design-audit I/O. Do not reuse the old CLI handlers:
`design show` is local-only and `design check` downloads inherited bytes without
the scoped source client. `designStanding` is not target-governing selection.
Preserve explicit `design=none` separately. Phase 3’s
[systems mechanism](systems-and-defaults.md) clarifies that it exempts a required
system without erasing an incumbent, with a versioned decoder widening.

Local or explicitly copied/pinned references retain exact source and visual
versions. Retained entries are flat, deduplicated and bounded, with design
markers stripped from retained copies: selecting this brief or another brief
cannot recursively embed cached workflows. Include these roots in snapshot,
log, inverse, pruning and actual blob collection. A hash inside JSON alone is
not a GC root. Inherited/private references keep origin identities and
permission-bearing reads; admission must not copy private bytes into shared
retention merely to make evidence durable. Revocation remains unavailable.
Historical readable bytes are not evidence that a live binding is still current.
`brief.context` and declared `receipt.context` are live contextual bindings,
checked for current versions alongside output and governing selection. In
contrast, `facts.sources`, explicit reference artifacts and check evidence are
exact historical citations: require permitted retained bytes, not newest-version
equality. An intentional v1/v2 pair from one item must remain usable. Changing
the chosen citation is an explicit brief edit. Check local receipt context at
publication and read as well as remote context in the shared reader.

## Adaptive questions and continuation

Expose one compact procedure plus current next-step data through shared API
and `design workflow`. Both real entry points, `summonsPrompt` and hosted
`BRIEF` in packages/rc, point to it alongside the shipped agent guide. Keep the
collaboration skill a doorway and the frozen phase 0 baseline resources intact.
The acting agent identifies semantic creation, extension or refinement from
the request, including designed HTML and connected applications. Archive import
and precise edits bypass a new interview. A MIME hook is not admission.

Automatic starts explicitly declare automatic admission and obey the canvas
`design.workflow` property: absent/off preserves the current default,
`adaptive-v1` enables the candidate, and unknown is unsupported. Explicit manual
start remains available while off. Disabling enrollment cannot prevent reading,
editing or resuming existing work. No private harness rollout switch is added.

Resolve supplied facts, selected/inherited context, incumbent design and delivery
before asking. Offer zero to three initial material questions in one batch,
with recommendations and consequential assumptions visible. An optional validated
question-set discovery field distinguishes initial, consequential follow-up
(with a new reason), and explicit interview (with provenance); questions bind
to stable fact IDs. Enforce the initial allowance over the admitted request's
canonical publication history, including archived events, not merely current
comments. Resume does not reset it. Reissue/retry preserves the same allowance;
it cannot smuggle in extra initial questions. A deliberate removal/Undo does
not erase the historical fact that a person was asked. Phase 1's existing
32-question protocol and legacy/manual question behavior remain compatible.

Shared reads expose effective submitted outcomes and immutable answer IDs even
when a later brief version makes the old questionnaire stale. Do not version
the brief after every partial answer and strand the rest of the batch. Reconcile
a settled batch deliberately, preserving the exact accepted response/source
bindings. Skipped, dismissed and delegated are not supplied answers. Later
entrances read this history and settled facts before choosing another question.

Native harness conversations use the same bounded plan. Their supplied facts
are explicitly reported by the authenticated agent, including audience/task
provenance; they are not human-authored canvas questionnaire outcomes. Do not
require a second interview to manufacture custody, and do not publish a question
for an unavailable human identity then close it by quoting them. The daemon
cannot independently count dialogue it never observes; phase 7's transcript
measures actual question burden through both entrances.

The smallest compatible schema extensions are continuation/source capture and
accepted-response provenance on the brief; discovery purpose/fact bindings on
questions; and an explicit governing binding on receipts. Old unadmitted v1
JSON stays readable. Canonical admission requires these new invariants, and
unknown future fields remain invalid rather than guessed.

## Evidence and currentness

A receipt binds an exact completed brief and exact canvas output, or an actual
repository revision/build/runtime. It records source diagnostics, browser/task
checks and craft review separately, with tool versions, scope, relevant states,
viewports, failures and retrievable evidence. These are attributed reports,
not daemon-issued browser attestations. An iframe loading, screenshot existing
or prose saying done cannot establish an actual task check. Without browser
capability, the result is an unverified draft. Ready remains limited to the
agreed scope and requires the existing check/critical-defect contract.

Add a bounded governing binding: selected scope/target and expected governing
winner reference and the independent explicit exemption. Historical phase-2
null-artifact bindings remain readable; phase 3 widens the combination under
`design-requests-v2`, as [recorded here](systems-and-defaults.md). The shared reader re-resolves it at the
output's actual scope, so a new closer system, group move or inheritance-order
change invalidates relevant evidence even if the old hashes still exist.
Compare relevant input identities, not whole canvas revision or unrelated chat.
Expose current/stale/unavailable, reasons and affected checks. Verify relevant
local identities at the writer for fresh acts. Remote source currentness remains
a permission-bearing derived read; there is no cross-home atomicity claim.
Repository runtime freshness is attributed observation unless an adapter can
actually recheck the named build. Retained stale evidence remains readable.

## Both surfaces

The bounded CLI is `design workflow [request]`, `design start <file>
[--automatic]`, `design brief [request]` with mutually exclusive lifecycle
options, and `design receipt [request]` with optional publication file. Expose
corresponding CanvasHandle methods and one browser-safe read model. Preserve
existing design/questionnaire commands. Reads filter by request ID, source
thread/comment or output item and return exact brief identity, real provenance,
allowed acts, answer history, remaining question budget and evidence freshness.
Register help, quick reference, installed entry exports and vocabulary audit
when the verbs ship, not as empty promises.

Use one compact Design task card in chat, the brief's canvas face and beside
its output. It shows audience/main task, Using context, consequential assumptions,
delivery, progress, questions and Open result. Correct expands only the relevant
field/section and saves conditionally; a stale edit keeps its draft for recovery.
Start, resume, cancel and finish use the shared acts without a specification
approval ritual. Completion editing records actual output/checks/limits, never
a bare verified checkbox. Output association comes from the shared reader.

Lazy-load validated brief/receipt faces and panels. Ordinary JSON retains its
existing behavior; invalid records remain readable/downloadable with a truthful
error. On narrow screens use a disclosure instead of another permanent column.
The existing initial entry-size ceiling remains unchanged. Exact reference cards
use retained versions, human titles/filenames, suitable thumbnails and exact-byte
open/download. Current-version ItemThumb alone is insufficient. IDs belong in
expanded provenance. Reuse existing safe renderers and visibility limits.

## Named proof and remaining boundary

Walk equivalent sparse operational requests through canvas chat and an external
agent, then switch entrances to resume without repeated settled questions.
Exercise the complete receiving task in actual Chrome: empty state, invalid
quantity, saved result and correction, at phone and desktop widths. A connected
app receipt names and exercises the actual runtime. The no-browser path is a
draft. Also prove precise-edit/import bypass, literal and typed cancel, source
edit/removal, old epoch, intentional Undo restoration, stale conditional edits,
retry after a lost acknowledgement, exact retained references after GC/restart,
relevant governing drift and unaffected unrelated chat. Test old-client decoding
and both real discovery entry points.

Scripted agent fixtures establish routing and contracts; actual browser actions
establish the synthetic task behavior. Neither establishes generated-design
quality. Phase 3 deepens contextual defaults, phase 5 integrates shared repair,
and phase 7 runs the fixed-baseline model comparison and real-user study. No paid
provider, new cloud resource or recruitment is authorized by this mechanism.
