# Implementation phases

The [architecture](architecture.md) is the map; this doc is the walk.
Each phase is a **discrete amount of work that ends in a testable
outcome** — not a theme, not a milestone: a thing that can be
demonstrated true when the phase closes, and the demonstration is named
up front. The [journey](multiuser-journey.md) is the acceptance suite:
a phase that claims a scene is done only when the scene plays.

**How the work runs.** Claude does all of it, and a working session is
a **conductor**: it does not write the code itself. It reads the
"where we are" line below, spawns a subagent on the next phase —
handing it the phase's section, the docs it cites, and `AGENTS.md`'s
house rules — and the subagent does the work: code, tests, Chrome
actuation to drive the web UI (two browser profiles are two people).
The conductor then **verifies the named proof itself** — runs the
suite, replays the scene, drives the browser — never taking the
subagent's word for it; the proofs are named up front precisely so
review is mechanical. Work that fails review goes back down: adjust
the instructions, respawn, re-review. When the proof holds, the
conductor writes the Findings, moves the status line, edits the
[map](architecture.md) if a finding redrew it, commits the phase
whole, and repeats. Phases run in order — each stands on the last;
parallel subagents belong *inside* a phase, never across phases.
Provisioning steps are marked **⚑ provision** and each one is asked
of the user out loud before it runs: the conductor spawns workers
freely, but never a cloud resource without permission.

**How this doc lives.** The surprise log lives here now, folded into
the phases: each phase carries a **Findings** section that accumulates
dated entries as the work teaches us things. A finding that redraws
the map edits [architecture.md](architecture.md) in the same change —
the map stays true, this doc remembers why it moved. The phase *order*
is a hypothesis, not a promise: phases may reorder as findings land,
which is why they have names, and numbers only for today's ordering.

**Where we are: Phase 4 is closed — Phase 5, a home in the sky, is next,
and it is the first ⚑ provision phase.** This line moves as phases close;
a clean session starts by believing it.

---

## Phase 1 — The store seam

**Work:** Extract the `Store` interface; today's file-backed code
becomes `FileStore` behind it, unchanged. The engine compiles against
the interface and nothing else.

**Outcome:** No behavior change, provably — the existing suite passes
untouched, which is the entire point of the phase.

**Proof:** The full vitest suite, green, with no test edited.

**Findings:**

- **2026-08-22 — "no test edited" met a rename, and the proof bent by
  three lines.** `store.test.ts` constructs the concrete class, so a
  rename cannot leave it alone. The conductor authorized exactly the
  identifier substitution and the module path that the file split
  forces — one import, one type annotation, one `new` — and checked
  the whole `test/` diff to confirm nothing else moved. Not an
  assertion, not a fixture. Recorded so no later phase reads "566
  passing, untouched" as literally true. The lesson for the phases
  that follow: a proof written as "no test edited" is really "no test
  *rewritten*", and should be stated that way when it is meant.
- **2026-08-22 — The seam is two files, and that is the point.**
  `store.ts` holds the interface and nothing else — its only import is
  a single `import type` from core, so it has no runtime dependency at
  all. `file-store.ts` holds the class. That split turns "the engine
  compiles against the interface and nothing else" from a claim into a
  grep: `store.ts` structurally *cannot* reach the concrete class, so
  no future edit can quietly re-couple them. `FileStore` is named in
  exactly three places — `daemon.ts` (the composition root that picks
  the backing), `index.ts` (the export), and that one test.
- **2026-08-22 — Three file-shaped methods survived onto the
  interface, on purpose.** An honest leaky seam beats a speculative
  clean one, so today's code crossed unchanged and the debts are named
  instead of paid: `getBlob` returns `{ path }` and `http.ts` streams
  from it; `migrateLegacyAgents()` is a one-time `agents.json` fold-in
  (#59) no cloud backing will ever have; and the blob index crosses
  whole — `blobIndex(id)` hands back the entire record and
  `writeBlobIndex` takes it back.
- **2026-08-22 — The third debt is bigger than a signature, and it
  redrew the map.** `Engine.gc` drives the blob cycle from *above* the
  seam: read the whole index, age each blob, delete files, write the
  index back. So CloudStore's per-blob `blobmeta/{hash}` docs are not
  a schema swap behind an unchanged method — the read-modify-write
  lives in the engine, and Phase 4 must move that loop behind the seam
  before the schema means anything. [architecture.md](architecture.md)
  now says so where the blob row is.
- **2026-08-22 (phase 2) — one of the three debts is already paid.**
  `migrateLegacyAgents()` has left the `Store` interface. It produced
  *claims*, and phase 2 made claims desk state, so it walked out on its
  own rather than being cleaned up: both one-time migrations now live in
  `migrations.ts` and write two ledgers. Two file-shaped methods remain
  on the seam — `getBlob`'s path return and the whole-index blob
  handoff — and the second is still Phase 4's real work.

## Phase 2 — The badge

**Work:** The door, per the desk's mechanism 1: a door endpoint that
mints badges; cookie carrier for browsers, bearer-in-`auth`-block for
daemons and CLIs; the claims registry re-keyed from `sessionKey` to
badge ids with a one-time migration; badge-less requests refused;
`SameSite` plus the Origin check on API and WS upgrade.

**Outcome:** Every surface carries a badge and the daemon recognizes
holders; `sessionKey` survives only as a client's local index. Policy
unchanged — the address still admits.

**Proof:** New door tests in vitest (mint, carry, refuse, migrate);
Chrome confirms the web app lives through the cookie flow; the CLI
lives through the bearer flow.

**Findings:**

- **2026-08-22 — The trap: once claims key on badges, the claims table
  is no longer reconstructible from the oplog.** Badge ids stay out of
  envelopes (mechanism 5 says so), and `loadActors` rebuilt the claims
  table by replaying `actors.jsonl` — so a re-key that left `claims`
  inside `ActorRegistry` would have broken crash recovery *silently*.
  The fix is not a fix: it is the two-ledger rule asserting itself. The
  registry split in half — the public face (ids, names, colors) stays
  in the `Store`, replicates, and replays; the claims table is desk
  state, written directly, never replayed. The architecture had already
  drawn this line in its storage table; the phase discovered it is not
  a preference but a constraint.
- **2026-08-22 — A name was silently lost every thirty days, and
  nobody knew.** `prune()` dropped an aged claim, `actorNames()`
  derived names *from* claims, so an actor whose only claim aged out
  reverted to whatever name was stamped on each op — "Dion 2" still
  talking in a thread after Dion 2 became Di, the exact failure the
  registry exists to prevent. The split fixes it as a side effect,
  which is precisely how a fix ships untested: the first attempt was a
  tautology that never removed a claim. The real proof runs end to end
  through a daemon — rename an actor so the stamped and registry names
  genuinely differ, delete the claim row, reboot, and the canvas still
  shows the stale name while the registry answers with the true one.
- **2026-08-22 — `prune()` is retired, and it is this phase's one
  exception to "Policy unchanged."** A claim row now carries
  authorization, and silently expiring authorization at thirty days
  would quietly unvoice a daemon that "reconnects for months". The
  price, stated rather than smuggled: names stop being freed after
  thirty days. It is smaller than it sounds — `heldNames()` already
  made any name ever used on a canvas permanently taken, so pruning
  only ever freed names for actors that claimed and never touched
  anything — but the Outcome line says policy is unchanged, and here
  it changed.
- **2026-08-22 — The blob route cannot carry a badge, so it stays
  open, and there is now a test that says so on purpose.** A sandboxed
  HTML blob is served with `sandbox allow-scripts` and no
  `allow-same-origin`, which gives it an *opaque origin* and a null
  site-for-cookies: its subresource requests carry no `SameSite`
  cookie at all. The route is open today, so nothing regressed — but
  the hole is now asserted rather than assumed, and Phase 3, which
  re-asks `projectId ∈ admissions` per route, is where it gets decided
  whether a 256-bit content address is capability enough.
- **2026-08-22 — Dev had lost its WebSocket the moment the cookie
  arrived.** `wsUrl()` hardcoded `127.0.0.1` while Vite serves the page
  from `localhost`, and cookies are scoped by *host*, ignoring port —
  so the handshake would have arrived badge-less. Two words fixed it
  (`location.hostname`). Recorded because no test exercises a dev-mode
  socket: it is reasoned, driven by hand, and still the least-covered
  line in the phase.
- **2026-08-22 — Losing a badge strands your claim, and the CLI used
  to lie about it.** A re-badged machine holds no claims, so identity
  resolution came up empty and said "no identity configured — run
  `isocan identity --name`" — which would mint a stranger and leave
  your history behind, the exact mistake `--as` exists to prevent. The
  claim is recoverable *immediately* (`reincarnate` excludes the
  caller's own `sessionKey`, so a same-key claim on a dead badge never
  trips the thirty-minute window); nothing was telling anyone. The
  refusal now names the badge, the actor, and the `--as` that works.
  One narrowing worth keeping: the route answering this is
  **key-scoped** — it reports only about session keys the caller
  already presents. A home-wide answer would say "there is an Isaac
  here, come back as him" to a conversation that is not Isaac, which is
  an impersonation aid and a roster leak in the same breath.
- **2026-08-22 — Badges are keyed by home *address*, not by home.** A
  scratch daemon left running on `127.0.0.1:4441` was talked to by a
  CLI whose `ISOCAN_HOME` pointed somewhere else entirely — the auth
  block matched on the address, so the badge crossed. Pre-existing
  (one default port has always been a footgun) and harmless on a real
  machine that runs one daemon, but Phase 6 gives every local daemon a
  *second* badge for the remote home, and address-keying is the slot
  it will be stored in. Worth knowing before that phase, not during.

## Phase 3 — Actor binding and registry scope

**Work:** The desk's mechanism 5: the membership check in the
single-writer chain — an op, undo/redo, or presence beat may name only
an actor its badge claims; relayed presence checked per actor;
`projectId ∈ admissions` re-asked per route; `not-your-actor` as the
refusal. And mechanism 10, which the same registry work has open on
the table: name uniqueness judged against the claiming badge's
admissions (`heldNames()` stops walking the home) and the color
broadcast narrowed to the rooms where that actor appears — both leaks
that turn real the day phase 5 makes the home multi-tenant. **The
landmine to defuse first, found in phase 2:** the human's actor in
`~/.isocan/identity.json` is *asserted* in the request body and never
claimed by anything, so the moment the membership check goes live it is
refused with `not-your-actor` — for every solo human on every machine,
at once. This phase must either claim the home identity onto the
machine's badge on first use, or grandfather it. Phase 2 deliberately
did not pre-solve it, because that would have been policy; it is written
down here so this phase does not discover it. **A second one, found
while driving phase 2's proofs:** the recovery path re-badges but does
not re-claim. Delete a browser's badge, act on the canvas, and the door
mints a fresh badge whose `claims` list is empty — while the client
happily goes on asserting the actor it held all along. Harmless under
phase 2, where nothing enforces; the day the membership check lands,
the first op after *any* badge recovery is refused. Both clients'
401-to-door paths need to re-claim before they replay.

**Outcome:** "Only the author" and actor-scoped undo become
enforcement; a request naming an unclaimed actor is refused everywhere,
uniformly; two strangers on unrelated canvases can both have an Isaac
and neither ever hears about the other.

**Proof:** Adversarial vitest: speak as an unclaimed actor, undo
someone else's op, relay a foreign actor's presence — all refused; the
honest paths all still pass; a two-tenant test proves name checks and
color repaints never cross admission lines.

**Findings:**

- **2026-08-22 — "A local daemon's badge is admitted to everything on
  it" is false, and mechanism 10 leaned on it.** Admissions are earned
  per visit, so a badge that has been nowhere has an *empty* name scope
  — which is more permissive than the home-wide walk it replaced, not
  less. The visible case is the front door: the identity dialog opens
  before the router mounts, so a fresh browser names itself with a badge
  that has been nowhere, and a second Kenny walks straight in beside the
  first. The fix uses what was already in the vocabulary — `actor.claim`
  carries a `projectId`, so the claim names the canvas in the address
  bar and is judged against that roster. It grants no admission, and
  today it can only reach a canvas the address would have admitted the
  asker to anyway. Under a grant it must be admission-checked, or "is
  this name taken here" becomes a probe into a room you were never let
  into — written into Phase 7's Work.
- **2026-08-22 — The presence check is deliberately off the
  single-writer chain.** Mechanism 5 puts the membership check inside
  it, and for ops, undo/redo and `setColor` that is where it runs. Not
  for presence beats: `putBlob` is on that queue, and a 30 MiB upload
  would stall every cursor in the room behind it. So a beat's check is a
  desk read beside the chain, memoized per socket per actor — a cursor
  flood costs one read, a persona switch is a new question. The race it
  admits is small and self-correcting: a beat can be judged against
  claims a hair stale, and a refused beat is *dropped rather than
  fatal*, because the tab may be mid-claim. Correctness of ops is
  untouched; this is presence, which was always the honest-but-soft
  half.
- **2026-08-22 — `actor.setColor` got a check the design does not
  name, on both of its actors.** Mechanism 5 lists ops, undo/redo and
  presence. `setColor` is an op, so it is checked — but it names an
  actor *twice*, once as the speaker and once as `op.actorId`, and
  repainting somebody else's face is impersonation even when you are
  honestly yourself. Its own comment used to say "any actor can be
  addressed — there is no authentication here". There is now.
- **2026-08-22 — The blob route stays open, and this is the ruling
  Phase 2 asked for rather than another deferral.** The hash *is* the
  capability: 256 bits of content address, obtainable only from canvas
  state that already required admission, on a route that physically
  cannot carry a badge (a sandboxed blob has an opaque origin and a null
  site-for-cookies). Closing it would break every HTML blob with a
  relative asset reference and buy nothing the canvas link does not
  already give away. The limit is honest and now written where it will
  matter: a Phase 9 sweep that expels somebody does not expel the hashes
  they wrote down, so that phase decides whether revocation means that
  too.
- **2026-08-22 — Narrowing the colour broadcast by presence would have
  been the wrong narrowing, quietly.** A colour change repaints the
  rooms where an actor *appears* — and a rename travels the same
  channel, which has to re-letter comments an absent author wrote months
  ago. Scope by who is connected and the rename silently stops reaching
  the rooms that need it most. "Appears" is history *and* presence, and
  the test that says so is the one worth keeping.
- **2026-08-22 — The seam needed four queries, not the two predicted.**
  Phase 2 guessed `claimants(actorId)` and `claimsOf(badgeId)` would
  replace the whole-table read. They do not cover "who holds this
  session key" (the lost-badge recovery Phase 2 itself built) or "whose
  rosters do I share" (the admission scope this phase needed), so there
  are four. Each is one document read or one `array-contains`, and the
  [map](architecture.md) now names the three denormalized arrays that
  answer them — with the warning that a CloudDesk which fails to write
  them passes the suite on a FileDesk and answers nothing in the cloud.

## Phase 4 — CloudStore

**Work:** The second `Store` backing: oplog as create-only
`ops/{seq}` Firestore documents, snapshots and blobs in GCS, per-hash
blob meta docs, the actors pattern likewise. Boot is the existing
snapshot-plus-tail recovery, reading from the cloud. The blob path
splits by size — small blobs through the daemon as today, large ones
by daemon-minted signed PUT URL (the map's 32 MiB answer). **The desk's
backing comes with it, and phase 3 shaped the seam for it in advance:**
`Desk.claims()` is gone, replaced by `claimsOf(badgeId)`,
`claimants(actorId)`, `holdersOf(sessionKey)` and `claimsIn(canvasIds)` —
one document read and three `array-contains` queries, against the
`claimIds` / `claimKeys` / `admittedTo` arrays the
[map](architecture.md) now names on the badge document. A CloudDesk that
does not write those three arrays on every claim and every admission
passes the suite on a FileDesk and answers nothing in the cloud.

**Outcome:** The same engine runs against either backing with
identical behavior, and two writers cannot interleave an oplog — the
second errors loudly.

**Proof:** The store and engine suites run against both backings
(Firestore emulator locally); a crash test kills mid-write and boots
clean; a double-writer test proves the create-only precondition; a
large-blob round trip exercises the signed-URL branch.

**Findings:**

- **2026-08-22 — The no-delete rule was necessary and not sufficient,
  and the gap would have eaten a blob.** Compaction must not delete op
  documents, because a deleted `ops/{seq}` frees that id for creation
  again and holes the create-only precondition. But a horizon alone is
  also wrong: `chooseRetained` extends its cut to a pair-complete set,
  so it can pull an entry back above the line that sits *below* the
  newest dropped seq. A horizon of `max(dropped)` hides that entry; a
  horizon of `min(retained) − 1` bounds almost nothing. So compaction
  does both — it advances `compactedThrough` **and** marks each dropped
  document, and the tail read filters on the mark. The horizon bounds
  the read; the mark makes it exact. Without both, GC sweeps a blob
  that a resurrected entry still references and the undo stack comes
  back holding a dangling hash.
- **2026-08-22 — Debouncing the snapshot would have made a brand-new
  canvas invisible.** `createProject` calls `saveSnapshot` and nothing
  else, so a fully debounced backing answers `projectExists` false and
  `listProjects` empty until a timer fires. The split that fixes it is
  the useful distinction: the *GCS snapshot object* is debounced (it is
  a fast boot, and the oplog is truth), while the `canvases/{id}`
  **document** is written when project metadata actually changes —
  which is not per-op either, so the one-write-per-second-per-document
  ceiling still holds.
- **2026-08-22 — "Identical behavior" is a claim about the engine, not
  about every field of every record.** A cloud boot routinely finds a
  snapshot lagging the log, so `recoveredSeqs` is normally non-empty
  where the file backing's is normally `[]`. The conformance suite
  therefore asserts *convergence* — the state equals what the ops
  produce, `lastSeq` is right — and the empty-recovery assertion stays
  as a FileStore-only case. Worth stating plainly, because it is the
  one place the Outcome sentence needs reading precisely.
- **2026-08-22 — A soft-deleted canvas id is claimed forever in the
  cloud, and this is the one thing the two backings genuinely do not
  agree on.** No-delete means the ops stay at seqs 1..N, so re-creating
  that id would be *fenced* — a lie, since no second writer exists. So
  `CloudStore.projectExists` reports a deleted canvas as existing and
  the engine refuses with `duplicate-id`, where a file home frees the
  id by moving the directory aside. Canvas ids are minted and never
  chosen, so nothing reaches it; pinned on both sides so a later phase
  cannot reach it by accident either.
- **2026-08-22 — The port bought less purity than the design promised,
  and said so.** `ObjectStore` was drawn as five methods of pure
  delegation, on the argument that "read it" would be a complete review
  of the untested surface. In fact `list` was never needed, `stat` and
  `readAll` were, and `append` had to exist because **object stores
  have no append** — the oplog archive wants one, and in GCS that is a
  compose-then-delete, plus a 404 branch. So `GcsObjects` is 143 lines
  with real branching, not 80 without. The bargain still holds — the
  untested surface is one dull file — but "trivial to review" was
  overclaimed and is now "cheap to review".
- **2026-08-22 — Option B needed zero changes to `gc.test.ts`, which
  is the argument for it.** The design predicted two tests would have
  to be pinned as file-only. Keeping the GC policy in the engine and
  moving only the storage down meant the pure logic stayed exactly
  where its tests already were, and none of the seven moved. Phase 1's
  debt is paid without disturbing anything that was already proven.
- **2026-08-22 — The emulator needs Java 21, and the tooling survey
  said 17.** Discovered by running it. The consequence is a design
  input rather than a note: the test setup cannot spawn the emulator
  and inherit `PATH`, because the *wrong* `java` first fails exactly
  like no `java` at all. Discovery is explicit and ordered, a missing
  21+ JRE is its own named skip, and CI pins 21. A second correction
  from the same source: `gcloud emulators firestore start` is a bash
  wrapper that forks a JVM, so killing the wrapper leaves a JVM holding
  a port — teardown kills the process **group**, escalating to SIGKILL,
  after a real 22-second straggler was caught doing exactly that.
- **2026-08-22 — What is still unproven, named rather than implied.**
  Blob bytes, snapshots and range reads run against an in-process
  double, not GCS; everything deciding *what* to store and *where*
  runs against a real Firestore. `GcsObjects` itself is executed by
  nothing but the signing path. And three assertions about signing
  cannot be made without a bucket — they are Phase 5's first act, and
  that phase's Work now says so.

## Phase 5 — A home in the sky (dev) ⚑ provision

**Work:** Stand up `isocan-dev`: Cloud Run service on CloudStore, load
balancer + CDN + managed cert at dev.isocan.io, Cloud Build triggers
from the repo, Firestore PITR and scheduled export, Cloud Scheduler on
the GC endpoint, uptime check. The service reads its backing from the
environment: `ISOCAN_STORE=cloud`, `ISOCAN_GCP_PROJECT`,
`ISOCAN_BUCKET`.

**Two debts phase 4 hands over, both about signing, and the first one
is the kind that gets discovered at 11pm during a deploy.**

1. **The runtime service account needs
   `roles/iam.serviceAccountTokenCreator` on itself.** A Cloud Run
   service account has **no private key**, so `getSignedUrl` cannot
   sign locally; `google-auth-library` falls back to the IAM
   `signBlob` API, which is a network call that role gates. Without
   it the large-blob upload branch fails at the first attempt, in
   production, with an error about credentials rather than about
   permissions. Grant it when the service account is created, not
   when a video fails to upload.
2. **A 30-second signed-URL smoke test is this phase's first act.**
   Phase 4 verified the branch to the edge of the machine — the V4
   signature is cryptographically checked against a canonical request
   re-derived from the URL, and the upload-and-register round trip
   runs against an in-process object store — but three assertions
   cannot be made without a real bucket, and this is where they get
   made: that GCS accepts a signature the service minted; that it
   honors `x-goog-if-generation-match: 0` **inside a signed request**
   (the mechanism that makes blob writes create-only, and the one
   phase 4 is least certain of); and that the service account can sign
   at all under (1). Mint a ticket against the dev bucket, PUT to it,
   PUT again and expect the precondition to refuse the second. Until
   that runs, the branch is unproven in production.

**Outcome:** A real hosted home. Two people at dev.isocan.io see each
other's cursors live; a deploy in the middle of traffic loses nothing.

**Proof:** Chrome, two profiles, one canvas — live correspondence;
ops written during a rollout all land in order (the create-only seam,
observed in production conditions).

**Findings:** *none yet.*

## Phase 6 — Birth at home, replica at home

**Work:** Setup creates the canvas at the home; the marker carries id
and address; the local daemon grows its **home connection** — dial,
present the badge, carry the two planes, reconnect by seq cursor — and
demotes itself to syncing replica. In the same stroke the local
daemon's page server turns home-only: people now have the one origin
to sit at, and the localhost web door closes behind them — ops to
CLIs, never pages to persons.

**Outcome:** Scene 0's shape is true on dev (its front-page door is
phase 14's): solo is the multiuser topology with one member, and
multi-device falls out — plus the lid-close beat:
tab and daemon each say "I have through N" and stream the tail.

**Proof:** Integration tests with two `ISOCAN_HOME`s against a home;
the lid-close/reopen beat played with Chrome and the CLI.

**Findings:** *none yet.*

## Phase 7 — The share (Scenes 1–4)

**Work:** The link grant born at birth as a revocable row; the Share
dialog and roster driving the grant API (button and verb, one
endpoint); arrival thin — actor minted at the door, never provisioned;
cross-internet toasts, badges, and the `@` picker; a parked agent
woken through the relay. **Phase 3 left two marked lines waiting for
this phase and one hole for it to close.** The lines are the policy
points: `admit()` in `http.ts` and the WS upgrade in `ws.ts` each check
`projectId ∈ badge.admissions` and, when it is absent, apply today's
policy — the address admits — and write the admission down. Each is
commented as the place the grant lookup goes, and replacing them is how
the check becomes a refusal without any route having to be found and
edited. The hole is `actor.claim`'s `projectId`: a claim widens its own
name-check scope by naming the canvas it is made from, which today can
only reach a canvas the address would have admitted the asker to anyway.
Under a grant it must be admission-checked, or "is this name taken here"
becomes a probe into a room you were never let into.

**Outcome:** Scenes 1 through 4 play on dev: Priya shares, Jordan
arrives thin, correspondence runs cursor-to-cursor, Isaac wakes on his
name.

**Proof:** The scenes, played — two Chrome profiles and a parked
`isocan wait` — plus vitest for grant rows and door admission.

**Findings:** *none yet.*

## Phase 8 — Escalation (Scene 5)

**Work:** Pass minting from an admitted session; the one-command setup
consuming `address#pass`; the redeemed badge born knowing its person;
`isocan open` appending a daemon-minted pass.

**Outcome:** Scene 5 plays: a thin guest goes thick in one command,
their agent claims its own actor, and a summons executes under their
roof.

**Proof:** The scene, played end to end against dev; vitest for pass
lifecycle (single-use, short TTL, named claim, admission-only form).

**Findings:** *none yet.*

## Phase 9 — The desk hardened: attesters and revocation ⚑ provision

**Work:** Firebase Auth wired as the borrowed bench (magic-link email
as the floor, Google, GitHub); attestations written onto badges;
`email:` and `repo:` grants; the provenance sweep with re-rooting;
kill-a-badge; person resumption across browsers. Provisioning: Identity
Platform enabled in the dev project. **What revocation does not
reach, decided in phase 3:** the blob route is deliberately open — a
sandboxed HTML blob has an opaque origin and physically cannot carry a
badge, so the 256-bit content hash is the capability. That is sound
while admission is the only gate, but a sweep that expels somebody does
*not* expel the hashes they wrote down. Either accept it in writing as
the limit of revocation, or give blob URLs a short-lived token — but
decide it here, where expulsion is supposed to mean something.

**Outcome:** Revoking Jordan's email grant expels tab, daemon, and
agent in one sweep; turning off the link stops strangers without
expelling the invited; a phone resumes its person by attestation.

**Proof:** Sweep and re-rooting in vitest; the magic-link arrival and
resumption driven in Chrome.

**Findings:** *none yet.*

## Phase 10 — Offline in the browser

**Work:** The service worker: cached shell, durable browser replica,
ops applied optimistically and queued when the network is gone,
reconnect by the same seq cursor.

**Outcome:** A tab without a network keeps working; on reconnect its
queued ops land in the home's order before the tail comes down —
journey rule 6, physically true.

**Proof:** Chrome offline emulation, actuated: work offline, reconnect,
verify order and convergence on a second profile.

**Findings:** *none yet.*

## Phase 11 — The thin agent (Scene 6)

**Work:** Setup notices what it stands on — headless, ephemeral, home
address in hand — and skips the daemon; the CLI speaks straight to the
home; `isocan wait` parks at the home itself.

**Outcome:** Scene 6 plays: an agent in an empty ephemeral directory
works the canvas through dev with no replica and nothing to lose; its
ring fades only when its own connection dies.

**Proof:** The scene, played in a scratch directory simulating the
cloud workspace; a kill test for ring truth.

**Findings:** *none yet.*

## Phase 12 — Agent-on-demand (Scene 7) ⚑ provision

**Work:** Registrations per frozen delegation — custody-checked actor,
KMS-wrapped scoped token, per-summons pass in the dispatch payload;
the `workflow_dispatch` hook concretely; the spark's tri-state in the
pile; failure surfaced in the thread. Provisioning: a test repo with
the workflow file and a token scoped to firing it.

**Outcome:** An `@`-mention with nobody running boots a real workflow
that works the lap and exits; a sabotaged hook says "couldn't start"
where everyone can see it.

**Proof:** The summons fired for real against the test repo; vitest
for custody rules and the registration's place in the provenance
sweep.

**Findings:** *none yet.*

## Phase 13 — Offline birth, twins, re-homing

**Work:** Adoption from seq 1 on first reconnect; first-writer wins
and the late twin parks whole; re-homing as the generalized push —
work travels, the guest book stays.

**Outcome:** A plane-born canvas adopts its promised home; a twin is
refused and parked, never merged; a re-homed canvas keeps its authors
while the roster re-forms.

**Proof:** Integration tests across scratch homes for all three flows.

**Findings:** *none yet.*

## Phase 14 — isocan.io ⚑ provision

**Work:** Stand up `isocan-prod`; the domain; the `release`-branch
promotion; the front page — the home origin wearing Scene 0's three
steps.

**Outcome:** Scene 0 plays for real: a clean machine, isocan.io, three
steps, a canvas born at its hosted home.

**Proof:** The scene, played from scratch, on the real address.

**Findings:** *none yet.*
