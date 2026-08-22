# Multi-user without giving up the sequencer

**Status: exploration. Nothing here is implemented.** This is a design doc on a
long-lived branch, written to be argued with. Line references point at `main`
as of `c56e57c`.

## The question

isocan today is one machine's canvas. The daemon binds `127.0.0.1`
(`packages/server/src/daemon.ts:66`), and `claims.ts:25` says the quiet part
out loud: *"Trust: there is no authentication. Any client can present any
session key, which is fine for a daemon that only listens on localhost for the
people and agents of one machine."*

That sentence is not an oversight — it is a scope. The question is what it
costs to widen the scope to two machines, and whether the answer changes what
isocan is.

The provocation was nostr. The conclusion is that we should borrow its ideas
and refuse its protocol, and the rest of this document is why, and what that
looks like in this tree.

## I. What must not break

Everything below is downstream of four things this codebase has already
decided. A multi-user design that damages any of them is the wrong design,
however good it looks on a whiteboard.

**One reducer, one place.** The README's isomorphism guarantee is the product:
*"The CLI and the web app cannot diverge, because they speak the same
vocabulary to the same engine."* That guarantee is not a property of the
vocabulary alone. It is a property of the vocabulary **plus** a single
authoritative application of it. `Engine.enqueue`
(`packages/server/src/engine.ts:122`) is where the guarantee physically lives.

**`seq` is load-bearing.** The single-writer chain assigns a monotonic
per-project sequence, and it is not decoration. `UndoStacks` stores seqs and
nothing but seqs (`packages/server/src/undo.ts:20-25`). The oplog reads by
`sinceSeq`. `WatchLogRequest.cursors` (`packages/core/src/protocol.ts:132`) is
a map of project id to seq. The snapshot carries `lastSeq`. Remove total order
and all of that has to be redesigned at once.

**Inverses are computed against real pre-state.** `applyAndPersist`
(`engine.ts:457`) inverts *before* applying, against the state the op is about
to change. Undo replays stored inverses rather than re-deriving them. This is
only meaningful if there is one agreed prior state to have inverted against.

**Presence is not history.** `protocol.ts:35` — *"the ephemeral plane: daemon
memory + WS fan-out only — never the oplog, never storage, never undo."*
`presence.ts` writes nothing to the store, and that separation should survive
contact with a network.

## II. Why not nostr itself

Nostr fits isocan uncannily well in four places and fatally in one.

It fits because `OpEnvelope` (`packages/core/src/ops.ts:228`) is already an
event minus `pubkey` and `sig`; because `model.ts:6` left the hole on purpose
(*"authenticated identity later only changes how an Actor is created, not this
model"*); because blobs are already sha256 content-addressed
(`packages/server/src/store.ts:314`) and content-addressed blob distribution is
a solved problem; and because the durable/ephemeral split above is precisely
the split nostr encodes in its kind ranges.

It fails on ordering. Nostr has no total order and no arbiter — `created_at`
is client-supplied and unverifiable. Adopting it means giving up `seq`, and
giving up `seq` means rewriting the inverse engine, all of `undo.ts`, and every
cursor in the watch protocol, in one change, in exchange for a property
(availability without a host) that isocan has never claimed to want. The
directory-is-its-project binding (#60) says the opposite: a canvas is
*somebody's*, the way a working directory is.

There is a second, smaller reason. A nostr event carries one signature over
one immutable payload, which forbids the daemon from normalizing an op after
the author signs it. `engine.ts:485` deliberately rewrites `{anchorItemId}` to
concrete coordinates *"so the logged op never references ephemeral client
selection state."* Under a single-signature model that normalization has to
move client-side, before signing — which is exactly the layering the comment
was written to prevent.

So: the ideas, not the wire.

## III. The design

### 1. Durability classes

The cheapest piece, and the one worth doing whether or not anything else here
ships.

isocan already has durability classes; they are just enforced by which
function you call rather than declared anywhere. Ops go to `appendLog`
(`store.ts:133`). Presence goes to memory. And two ops are *already*
replaceable in the nostr sense, hand-implemented: `actorNames()`
(`claims.ts:213`) picks the newest claim per actor id, and `colors` is a map
keyed by actor rather than a log to fold. Meanwhile `gc.ts:13`'s
`DEFAULT_KEEP_OPS = 500` is a retention policy with no vocabulary to express
itself in.

Give the vocabulary a durability table in `@isocan/core` — one entry per op
type, one of `regular` / `replaceable` / `ephemeral` — and let the store, the
gc, and (later) a sync peer read the same table instead of each knowing the
rules separately. This is a refactor with no wire change and no crypto, and it
pays for itself in `gc.ts` alone.

### 2. Keys, and what they delete

An actor id becomes a public key. `Actor.id` is already an opaque string
(`newActorId()` mints `usr_<nanoid>`), so the model does not change — which is
what `model.ts:6` promised.

What this deletes is most of `claims.ts`. The session-key registry, the 30-day
prune (`claims.ts:87`), the 30-minute `CLAIM_STANDS_MS` window
(`claims.ts:95`), and the "is this actor visibly someone right now" liveness
check in `reincarnate` are all scaffolding around *not having a key*. An agent
that resumes with the same key simply is the same actor; `--as` becomes "load
this key"; the whole race that `applyClaim` (`claims.ts:123`) serializes
against stops being a race.

What this does **not** delete is the name logic, and that distinction matters.
`requireFree`'s error message — *"@Kenny would reach both of you"* — is a
product feature, not identity plumbing. Under keys it becomes a **petname
layer**: the canvas maps keys to memorable local names and enforces uniqueness
within itself. Nostr chose global-and-secure and gave up memorable; isocan can
choose memorable-and-secure and give up global, which for a per-directory
canvas is the better trade.

### 3. Two signatures: intent, then order

This is the load-bearing idea, and it is the one nostr cannot express.

Split the envelope into a layer the author signs and a layer the home signs.

**Inner — the author's claim.** Over `{opId, projectId, pubkey, op}`, signed
with the actor's key, before normalization. It asserts exactly one thing: *"I,
this key, asked for this."*

**Outer — the home's claim.** Over the resulting `LogEntry`: `{seq, ts,
normalizedOp, inverse, hash of the inner}`, signed with the home's key. It
asserts a different thing: *"I put that at seq 41, at this time, resolved the
anchor to these coordinates, and this is its inverse."*

Two signatures because there are two distinct trust claims, and collapsing
them is what forces normalization out of the daemon. `resolvePlacement` stays
at `engine.ts:485` where it belongs. `ts` stays daemon-assigned. The inverse
stays computed from real pre-state. And the `actor` field stops being
something any client can type.

Note honestly what a verifier can and cannot check. It can check that the
author asked for X and that the home says it resolved to Y. It **cannot** check
that Y is a correct resolution of X without replaying the canvas. That is
fine — it is the same trust already extended to the home for ordering — but it
should be written down rather than discovered later: **the author is trusted
for intent, the home for order and resolution.**

Two consequences fall out immediately.

*Undo needs a signature too.* An undo issues an internal op from a stored
inverse (`INTERNAL_OP_TYPES`, `ops.ts:220`). The author signs *"undo my seq
41"*; the home signs the entry it produced, including which inverse it
applied. `UndoRedoRequest` grows a signature.

*Two existing checks stop being honor-system.* `reducer.ts:321` refuses a
`comment.update` from a non-author — currently by trusting an unauthenticated
field. Actor-scoped undo has the same shape. Both become real.

### 4. Presence: sign the session, not the beat

Presence claims identity — *this cursor is Kenny's* — so on a shared canvas it
cannot stay unsigned, or anyone can puppet anyone's cursor. But signing every
cursor beat is absurd.

Sign the session open, not the beats. A signed session-open event binds a
session id to a pubkey; the beats carry the session id over the socket that
presented it. Presence stays ephemeral, stays out of the oplog, and stays
cheap — the guarantee at `protocol.ts:35` is untouched.

### 5. Blobs by hash, not by project

`store.ts:314` already hashes. The one real change is the route:
`/api/projects/:id/blobs/:hash` (`packages/server/src/http.ts:322`) scopes a
blob by project, but under sharing the project scope is a fiction — the hash is
the truth, and the same bytes on two canvases are the same blob. De-scope the
path so any peer can serve any blob and the receiver verifies for free. Keep
the HTML-sandboxing headers exactly as they are.

### 6. The sync peer

Multi-user appears here, and not before.

The daemon is already the only writer for canvases it owns. Add a second role
with **no authority**: a peer that holds signed entries, verifies signatures,
forwards bytes, and never interprets an op. Your laptop stays authoritative for
its own canvases and subscribes to a peer for canvases it does not own. Writes
to somebody else's canvas are inner-signed requests forwarded to the home that
owns it, which sequences them and republishes.

This is "someone hosts the game," and it is much less to build than a backend,
because the peer has no reducer, no undo stacks, and no opinions.

### 7. Agent keys, by delegation

An agent holding a long-lived key is a key you cannot rotate, and agents are
half the users here.

The home key signs a capability: *this session key may act as actor X until
T*. The agent holds only the session key; rotation is expiry. Nostr tried
delegation (NIP-26) and walked away from it for lack of anyone to delegate
*from* — isocan has a home that genuinely is an authority, so the mechanism
works here for the same reason it failed there.

## IV. What it costs

**A crypto dependency**, in a repo with five runtime deps. `@noble/curves` plus
`@noble/hashes` are the right shape — audited, dependency-free, small. Note the
repo-specific tax: the root `package.json` comment explains that CLI runtime
deps must be declared at the root as well, because a git install of the
`release` branch installs the root package only (#47). Two new deps means two
new entries in both places.

**An unsigned past.** Every existing oplog entry is unsigned. `sig` has to be
optional, and verification has to graduate rather than switch on: `local`
accepts unsigned (today's behavior, unchanged), `strict` rejects unsigned from
the network. A canvas's history is unsigned up to the day keys arrive. That is
a fact about the data, not a bug to hide.

**A key to lose.** Today losing `~/.isocan/identity.json` costs a name. With
keys it costs an identity — your undo stack, the comments addressed to you, the
things only you may edit. Backup and recovery become real product surface, and
the honest mitigation is that a home can re-attest a lost key to an actor,
because the home is an authority. This is worth designing before it is needed.

**Verification is not free.** Schnorr verification per op is cheap in
isolation, but oplog replay on daemon start walks every entry, and `gc` walks
the log again. Verify on ingest and on demand; do not verify on every replay of
a log this home already accepted.

## V. Open questions

1. **Does an unowned canvas exist?** If the owning home is offline, is the
   canvas readable-but-frozen, or does ownership hand off? Frozen is simpler
   and matches the directory metaphor. Handoff is what people will ask for.
2. **What is the home's key, exactly?** Per machine, or per canvas? Per machine
   is simpler; per canvas means a canvas can move between machines without the
   history changing who ordered it.
3. **Is the petname map an op?** Uniqueness needs an arbiter, and the home is
   one, which suggests yes — a canvas-scoped op alongside `actor.setColor`. But
   it makes every canvas carry its own name table.
4. **Where does `wait` listen?** `WatchLogRequest` is home-scoped today. A peer
   subscription is a second source of wakeups, and the on-call design was
   already retired once (#60).
5. **Does the CLI need the home key?** If the CLI and daemon are the same
   machine, the daemon can sign on the CLI's behalf. If not, the CLI is a remote
   client and needs its own delegation.

## VI. Staging

Ordered so that each step is defensible on its own and nothing is stranded if
the branch stops here.

1. **Durability classes in core.** No crypto, no wire change. Pays for itself
   in `gc.ts` and `store.ts`.
2. **Keys in `identity.json` + inner signature + verify at the engine**, with
   `unsigned` accepted. Localhost behaves identically; the oplog becomes
   verifiable.
3. **Outer countersignature.** The sequencer half. `LogEntry` gains a home
   signature; undo requests gain an author signature.
4. **Blob paths de-scoped to the hash.**
5. **Signed session-open for presence.**
6. **The sync peer.** Multi-user is visible for the first time.
7. **Petnames over keys.** Keep `claims.ts`'s collision voice; drop its
   session-key scaffolding.

Steps 1 and 4 are worth doing whether or not the rest happens. Step 2 is the
hinge — it is the change `model.ts:6` has been describing since it was written.

## What this does not change

Worth stating plainly, because it is the point of the whole approach. The
single writer stays. `seq` stays. Inverse-based undo stays. One reducer applied
at one place stays, and so the isomorphism guarantee stays. Every verb in the
CLI surface keeps working on a canvas that is now shared, because sharing was
added under the vocabulary rather than through it.
