# Personal memory — a private source brought here deliberately

This finishes memory phase 2 and the personal part of phase 4. The existing
local and inherited layers remain. The canonical memory design is revised
before implementation because actor identity, agent delegation and browser
presence were conflated in its original sketch.

## One person, one home, one private birth

A personal canvas belongs to a canonical person identity at one authoritative
home. Resolve actor joins before lookup; names are display labels, never keys.
An agent actor does not acquire a personal canvas by claiming a session. First
explicit use requires an authenticated claimed actor currently eligible as a
person under the existing registry. That act enrolls a durable owner;
last-harness changes cannot undo enrollment. A claimed actor id alone cannot
designate some other person's personal canvas. This does not invent a stronger
immutable person credential than the current registry provides.

Birth is lazy on first explicit use of Your canvas or the personal CLI/API,
not an extra side effect of every actor.claim. From that first use onward the
same private canvas is available across projects on that home. This preserves
the intended experience without creating empty canvases for every login, agent
claim or migration. ~name is its initial editable title only.

The Desk atomically reserves a stable canvas id for that owner. FileDesk
serializes concurrent requests through one authoritative daemon instance; its
existing files do not provide cross-process writer exclusion. Its proof uses
concurrent requests and sequential crash/reopen. CloudDesk additionally proves
cross-instance transactional reservation and CloudStore fencing. This phase
does not invent a FileStore multiwriter guarantee. The writer creates it with
its trusted withoutLinkGrant path, never by creating a public link and
revoking it afterward, and never in an inherited default space. Concurrent
calls, retry, a restart between reservation and birth, and a name change
resolve to the same id. A deleted personal canvas stays deleted; ensure
reports that state instead of silently replacing it. A reserved/created birth
state and stable birth operation distinguish a never-written reservation from
a deleted, purged or unavailable source. Metadata-only lifecycle lookup
distinguishes absent, incomplete, live, deleted, taken-down and purged. An
incomplete birth reads only the exact reserved birth envelope after
authorization, matches its id/owner/opId, reconstructs without appending seq1
again, and replays any remaining tail. Existing load() does not recover a
project.create missing its metadata; that narrow recovery must be implemented
rather than assumed. Restoration uses the existing lifecycle. No editable
project property is ownership authority.

If joined identities already have two personal canvases, keep both datasets.
The canonical identity's existing binding wins, otherwise select an existing
alias binding deterministically. Never merge contents, delete a canvas, or
write a new one merely to hide the ambiguity. The extra canvas remains an
ordinary owned canvas. The response can name the preserved extra binding to
its owner. Existing consents and delegations stay attached to their original
source dataset; choosing another primary never transfers an agent to the
winning source. Fresh source access needs a fresh owner allow/link act. The
mutable last-harness classification may guide first-use UX, but cannot change
an established binding. Both backings must retain these decisions. All primary
and preserved alias bindings retain trusted personal-source classification; a
join cannot make a previously private birth eligible for automatic link/space
migration.

A replica also retains a narrow private classification marker: source id and
authoritative home, learned from that configured home before adoption. This
marker carries no owner, binding or delegation authority and never travels as
an Operation. Automatic local link/space migration consults it as well as the
home's primary and preserved personal records; adopting a private source must
not create a local link grant. Source reads still ask the authority, and an
unreachable home remains a refusal rather than permission to use the replica.
Ordinary teleport cannot transfer this home-owned binding and consent. It
refuses a personal source before reading its log/blobs or creating destination
state; preserving private custody across a move needs a separate design.
Deliberate owner export remains available and does not retarget the binding.

## Explicit consent, independent of a browser heartbeat

An owner's enabled link means personal memory is present on that project. This
replaces the original literal 'while she is on the canvas' sentence: standing
agents, CLI work and offline local homes cannot depend on a live browser tab.
Closing the tab does not unlink. Unlink deletes the concrete card and disables
that edge; its identity-bound consent remains so ordinary undo restores the
edge. Agent revocation is the separate durable privacy act.

The home privately records owner, source, destination canvas and concrete link
item id. The owner must be claimed and able to edit the destination. Each link
gesture has a requestId: retries reuse its reserved item and operation
identity, while an explicit relink uses a new requestId rather than replaying
an already-undone operation receipt. A link operation reserves its consent
record and submits the Context group and personal card as one existing
group.change. A failed submission leaves no live edge. Undo deletes that edge;
redo restores the same identity. Deleting the card unlinks it, and undo
restores it while its consent remains. Copying the card to a new id/canvas,
forging memory=personal, or editing its source never confers consent. Readers
validate the current item and source against the trusted record. Shared
metadata is only the owner label, source address and linked state; it carries
no private source title/content preview.

Agents are explicitly delegated by the owner for one concrete personal source,
naming stable actor ids at the same home. Delegation is durable Desk state,
independently revocable, and is never inferred from enrollment, name, harness
session key, badge co-location or an RC control policy. Every personal route
requires an explicit actor; the ordinary single-claim fallback and badge-wide
creator floor do not select the owner. The active caller must be claimed by
the presenting badge, and must be the owner or a currently delegated agent.
Another person is not automatically a delegate. Joining identities resolves
ownership but does not turn unrelated agents into delegates.

This is actor-correct application authorization. An untrusted process given
the owner's unrestricted bearer credential already has the owner's general
powers; actor selection does not sandbox that process. No stronger credential
isolation is claimed. Ordinary deliberate sharing of the private canvas uses
its existing door, but does not automatically enable a personal layer.

## Read privately before composing Context

A dedicated authoritative read first validates destination admission, caller,
link consent, live source state and delegation, then reads the source. On
refusal it must perform zero source snapshot/blob reads. Cross-home links fail
visibly before source fetch unless an authenticated route reaches the source's
actual authority. A replica forwards the destination-scoped request to its
recorded home; it never treats a retained local copy as authority.

Personal summaries carry explicit kind=personal and owner provenance. They
compose after local and inherited summaries. A person's preferences never
silently replace the project's governing design system. Shared helpers in core
determine link reading order, personal card metadata and layer/report labels.
The API owns one resolution path used by CLI and web; MCP builds on that path.
A failed personal read leaves a private-layer refusal heading, not a
successful empty result.

Trusted personal-source classification also gates ordinary inherited and plain
canvas cards: changing memory=personal to inherit, or copying the source
address into a fresh ordinary card, must never cause an automatic private
snapshot, presence, thumbnail or screenshot fetch. Resolve classification
before a preview or linked-source read, and redact while it is unknown. The
classification route is metadata-only and sits outside canvas-scoped hooks
that preload snapshots. API and MCP call it before title resolution or
Home.canvas as well as before linked composition; no hook may fetch the
private source first. Personal classification is reserved before birth and
never retroactively attached to an unrelated ordinary canvas. Direct
deliberate entry to a source keeps its existing authorized door.

The agent must be able to read the current text of contributed pins and the
design system, not merely count them. A separate explicit personal-context
read returns these current authorized pieces with provenance and readable
text. Non-text pieces remain metadata. Bounded responses report truncation; no
silent clipping or wholesale Chat/history inheritance. Summary responses need
not materialize those bytes. Each read rechecks authorization and link state.
No endpoint grants general write access to the private source.

MCP ambient tools/resources never guess a personal owner from a machine's
shared badge. Personal layers require an explicit claimed tool session.
Ambient MCP listing, direct canvas/item reads and resources must exclude or
refuse personal sources as well, rather than filtering only Context layers.
Explicit direct-source calls require canonical source ownership or a current
concrete canvas/explicit-space grant after explicit claimed actor selection.
Named email/repository/group proofs belong to the badge, not exclusively to
one selected actor; deliberate ordinary sharing keeps that established
meaning. A live link may authorize a known address but never discovery.
Generic reads require read and mutations require edit before target
resolution; a read preflight cannot borrow a badge-wide own admission for a
later write. Existing admissions are not proof for this narrow preflight: pass
provenance has no recipient actor or pass id, so it cannot independently
authorize a non-owner's personal direct read. A pass that transfers the actual
owner claim qualifies through ownership. These limits leave the ordinary human
source door unchanged and do not rewrite grants across the product. The source
policy is immutable per request, carried through JSON, blob and stream
transport and authoritative forwarding with its cancellation signal. A
preflight is not the final authority: the server derives actual read/edit/own
intent, rejects requests beyond the declared ceiling, checks current source
ownership/grants before admission or content reads, and rechecks at the writer
entry before mutation. Its effective capability constrains existing owner
checks as an additional requirement; no shared badge admission is rewritten.
Replicas return the authoritative response for these requests, not a retained
snapshot. This provides current checks on the request and writer, not a new
cross-instance transaction joining every grant and canvas write. No mutable
last-policy field may bleed between callers.

The dedicated personal layer/read remains limited to the source owner and its
named delegates; delegation never grants whole-source Chat/history or general
writes. Calls remain actor-correct before any private source read. Existing
read_context/frozen-request semantics stay unchanged; a dedicated
read_personal_context tool exposes the explicit private read in phase 4. The
ambient listing/resolution and explicit direct-source protections land in
phase 2 with the first personal birth; they cannot wait for the new tool.

## Both surfaces and the shared boundary

Your canvas in Context offers open, link/unlink and explicit agent access
controls to the owner. The source card is always redacted: no canvas snapshot,
thumbnail, persisted screenshot fallback or hover preview. Its memory mark
must not toggle a personal link into ordinary inheritance. A read-only guest
can see that the owner brought personal memory and cannot enable it.

CLI context personal inspects/ensures the person's canvas; its link/unlink,
allow/revoke and read subcommands use the same routes. Home choice is explicit
and shown in output: one personal canvas per person per authoritative home.
Standalone CLI status/ensure uses the connected daemon's home unless the caller
selects `--home`; it need not resolve a working canvas. Your canvas inside a
project uses that project's authoritative home for status, birth, open and
link alike. Destination-scoped status/ensure forwards through the recorded
home connection, including on a daemon holding projects from several homes.
It never births locally and then links a different personal source remotely,
and the browser does not send local cookies directly to an arbitrary home.
An explicit home that disagrees with the destination is refused visibly.
The existing web entry rule still redirects a remote canvas to its home before
Context renders. Personal memory introduces no replica-render exception or
browser credential bridge; the browser claims and opens its canvas at that
authority through the ordinary entry flow.
The general context command prints the third heading for an authorized caller.

Private results are cleared synchronously on observed actor, target/home, link
state or authorization changes. Remote revocation takes effect on the next
authoritative read or received invalidation; no instantaneous global cache
revocation is claimed without a channel. Late responses for an old identity
cannot repopulate the new view; no private browser localStorage, shared cache
or service-worker cache is introduced. A fresh authorized read is the source
of truth.

Personal bytes, source titles, version/hash references and screenshots never
flow automatically into the shared project's snapshot/oplog, comments, frozen
request manifests, exports or summary caches. The visible source address and
owner label are the deliberate disclosure. Frozen context still walks only the
project's own groups/items. Sharing a public project containing a personal
card advertises no private piece. Exporting the personal canvas itself remains
the owner's existing explicit export act.

## Proof that closes this work

Use two synthetic people and their allowed/unallowed agents, including a badge
holding multiple person/agent claims. Prove stable private birth under
concurrency, failure/retry, rename, join and both-backing restarts. Assert no
birth link, Public row or space; no private source fetch on invalid caller,
forged/copied personal, inherited or plain card, unlinked card, revoked
delegate or foreign authority.

Drive the real browser to link, see a redacted card, inspect the owner layer,
unlink and undo. Drive actual CLI commands through the same consent and read
paths. Use an authorized agent to read a pinned synthetic preference's bytes;
prove the other agents cannot. Changing browser identity clears private data.
Shared snapshots, oplogs, exports and frozen requests contain none of the
private markers/versions/hashes. Public browse remains metadata only.

Run the whole suite, typecheck and build without changing the entry ceiling.
Phase 4 additionally uses a real MCP client/transport for all three layers,
explicit delegated and unauthorized sessions, ambient exclusion and request
freezing. Recap-head contribution and context pin --from are separate old
promises, not silently declared complete by personal memory.
