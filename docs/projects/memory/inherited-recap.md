# Inherited recap heads — recent work without another history copy

This discharges the recap-head contribution left out of memory phase 1.
The record remains the canvas's operation history. An inherited head is a
bounded, deterministic reading of recent activity, not a model summary or a
new stored memory record. Memory phase 5 builds this contract after phase 4.

## What appears in Context

Each readable ordinary inheritance layer contributes **Recent work** beside
its design and pins, with that source's provenance. It describes the latest
100 operations: the covered sequence and time range, operation/comment
counts, up to five displayed actor names and eight currently visible touched
items with their counts. Each displayed name/title is capped at 160 Unicode
code points. The response reports omitted rows, clipped labels and earlier
available operations explicitly. One shared set of limits and one report
formatter in core serve CLI, web and MCP summaries.

This is activity metadata, never raw Operation/LogEntry values, Chat text,
item content, blob hashes or version bodies. Excluded items and descendants
of excluded groups contribute no item id/title rows. Removed or trashed items
contribute no resurrected names from old operations. Counts still describe
the covered operations; omitted item details are reported as such. Displayed
actor names summarize the recorded labels, following the existing recap's
meaning, and are not a new identity or permission model.

Local Context keeps its existing behavior. Personal layers remain current
design and pins only. The ordinary-source recap route refuses every personal
source, including an owner's request or a card relabelled as ordinary. A
person may still deliberately read their own full history through its existing
door; automatic inheritance does not acquire that authority.

## One authoritative reading

The daemon exposes `GET /api/projects/:id/context/recap`; the Node route
adapter calls it as `recapHead`, and the browser-safe Context port supplies
`sourceRecap`. Its response identifies source canvas, authoritative home,
source title and revision beside a typed `RecapHead`. Composition validates
that source/home before attaching the head to the inherited layer.

The route enforces automatic personal exclusion before any generic
canvas-scoped snapshot-loading hook, even when a caller omits the policy
header or sends a stronger direct-source policy. The caller still needs the
ordinary source's read admission and all existing operator/lifecycle checks.
Actual requests preserve expected home, exclusion and cancellation through
badge recovery and replica forwarding. An unknown/foreign authority refuses;
a retained replica cannot supply a previous success. Queued assembly rechecks
the source restriction before opening runtime or archive data.

Security checks use the router's matched API route and decoded parameters,
not the raw URL spelling. Fastify accepts encoded static segments: an encoded
`api` or `projects` segment must still require a badge, admission and the same
source policy. This applies to the shared API openness, Origin, lifecycle,
capability and source checks, including existing snapshot/history routes.
Parameter encoding keeps its existing meaning; forwarding retains the actual
request URL while both homes enforce the matched route. The phase's audit
found anonymous snapshot/history access and unadmitted recap access when the
router and raw-path hooks disagreed, so this shared correction precedes closure.

Assembly occurs inside the engine's existing writer queue, which also owns
GC and mutation. It reads the current runtime and archive coherently, removes
duplicate seqs and sorts them. The needed recent range must be contiguous and
end at the captured revision; missing required history is unavailable, never
a successful empty summary. Older available entries may be counted without
claiming that unexamined history is complete. Real GC and restart preserve
the same head when no new operation has arrived.

Core's existing deterministic recap machinery should be reused or factored
for the calculation, but its raw `recent` entries must not enter Context.
The current backing API materializes its archive: this phase bounds the
response and inherited contribution, not storage I/O. It introduces no stored
index, background job, model call or claim of a bounded archive scan.

## Assembly and surfaces

Only Context assembly requests heads for eligible ordinary inheritance.
Design resolution and `design check` must not start fetching history.
Excluded links/ancestors are removed before all source requests; personal,
unknown and foreign source cards open no recap/log data. If a head alone is
unavailable, its layer retains the valid design and pins with a named reason
for Recent work. It never reports zero changes merely because a read failed.

CLI `isocan context`, the desktop/phone Context view and MCP
`read_context_summary`/ordinary Context resources expose the same head and
provenance. There is no new CLI verb or MCP tool: existing context commands
already express the intent. No new Operation is needed. Shared snapshots,
oplogs, frozen requests, exports and `read_personal_context` remain unchanged
by these reads. No source content is copied into the destination.

Keep the 734,200-byte entry ceiling. If new assembly brings eager code into
the entry, measure and separate the existing automatic-classification path
from deferred Context computation rather than raising the number. The public
API and both preview/Context behaviors must remain intact.

## Proof

A real source's mutations appear with matching bounds/provenance on CLI,
web and actual MCP transport. More than 100 operations and excessive row and
label sizes prove the bounds and omissions. A distinct Chat/body marker,
excluded item title and removed-item title never appear. Actual archive GC,
restart and a held read/GC interleaving preserve a coherent current range;
missing required history reports unavailable.

Unlinked/excluded, denied, copied-personal, absent-header personal and foreign
requests prove exclusion before private snapshot/runtime/log/archive/blob
reads, including authoritative forwarding and unreachable homes. A failed
head preserves readable design/pins, and the local design still governs.
Actual HTTP probes also cover encoded static prefixes/suffixes, anonymous and
unadmitted callers, HEAD and encoded parameters on recap and existing
snapshot/history routes. URL spelling cannot change the security decision.
Read-only shared state and frozen manifests remain byte-identical. Run the
full suite with Firestore and bundle required, workspace typecheck, build and
real browser acceptance on the final source. No service, credential, paid
resource or live personal data is needed.
