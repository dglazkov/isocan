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
dated entries as the work teaches us things. Beside the "where we are"
line sits **Deliberately open** — the short list of decisions postponed
on purpose, so a later session chooses them awake instead of meeting
them mid-task and improvising.

Every phase also carries a **Status** line directly under its heading —
`CLOSED` with the date and the commit that closed it, `PART-DONE` with
what is missing, or `NOT STARTED`. It is there so completion is *stated*
rather than inferred from whether Findings say "none yet": a phase can
close without surprising anybody, and an empty Findings section must
never be read as an untouched phase. `grep '^\*\*Status' docs/phases.md`
is the whole roster in one screen. When a phase closes, its Status line
moves in the same change as the "where we are" line — one gesture, or
they drift. A finding that redraws
the map edits [architecture.md](architecture.md) in the same change —
the map stays true, this doc remembers why it moved. The phase *order*
is a hypothesis, not a promise: phases may reorder as findings land,
which is why they have names, and numbers only for today's ordering.
**One correction to that, learned 2026-08-23:** the numbers stopped
being positions some time ago. Roughly fifty comments in the code name a
phase by number — "phase 9's sweep", "phase 13's offline birth" — as
forward references to work not yet done, and renumbering would silently
falsify every one of them. So a phase inserted into the middle gets a
**fractional number** rather than a renumbering, and this list is read
in the order it is written rather than by counting. Names are the
identity, numbers are the address, and the address is load-bearing.

**Where we are: Phase 8 is built and played on one machine, and is
PART-DONE until it is played against dev — that walk is the next thing to
do, and it needs the code deployed there.** The question phase 8 inherited
is settled: a replica no longer enumerates its home, it mirrors the canvases
it was let into, and the pass is what writes the admission that lets one in.
After dev, Phase 9 — attesters and revocation — is next, and it inherits a
pass-shaped debt: an admission rooted `{root: "pass", badgeId}` is a chain
the sweep must walk a hop at a time, and nothing has ever walked it. This line moves as phases close; a clean
session starts by believing it.

**Deliberately open.** Things decided *not* to decide yet, kept here
rather than in a phase because they belong to no phase's Proof and would
otherwise be discovered instead of chosen. A clean session should read
this list, not act on it: each entry is open because acting tired on it
is how it goes wrong.

- **Canvas or project, opened 2026-08-23 (phase 7).** The product is a
  **canvas** in every doc — 160 mentions against 15 of "project" — and a
  **project** in every line of code: 712 `projectId`, plus
  `project.create`, `listProjects`, `ProjectListPage`. The map splits the
  difference and specifies the Firestore schema as `canvases/{id}`. The
  seam became visible where it matters most, in the address a stranger
  pastes: the journey and the desk design both wrote
  `isocan.io/c/7f3a…`, and **nothing ever served `/c/`** — the app has
  had exactly two routes, `/` and `/p/:projectId`, all along. Measured
  in a browser, `/c/<id>` returns 200, serves the app shell, and renders
  a **blank page**: no catch-all route, so React Router matches nothing
  and draws nothing. **Settled by Dimitri, 2026-08-23: keep `/p/`, fix
  the docs** — it works, it is tested, and a second URL shape for one
  canvas is a cost that lasts forever. The docs now say `/p/`.
  What stays open is the **rename itself**, deliberately: it touches
  every file, buys no behaviour, and would bury whatever phase it landed
  in. It is recorded here rather than in a phase because the thing that
  will eventually force it is not a feature but an audience — the first
  time somebody outside this repo reads `projectId` in the agent guide
  and asks what a project is. Until then the split is a known cost, not
  a bug, and the one place it must never leak again is a URL. The
  blank-page half is **not** open: a catch-all route that says the
  canvas is not here is phase 7's, because a share link is the one
  address strangers hand each other and its failure has to be legible.
- **The GC schedule, opened 2026-08-22 (phase 5).** Nothing schedules
  garbage collection at the hosted home, on purpose;
  [`infra/91-scheduler-gc.sh`](../infra/91-scheduler-gc.sh) creates
  nothing and explains why at length. Two independent blockers: the door
  admits **badges** and Cloud Scheduler cannot hold one (a Google OIDC
  token runs through `parseBadgeToken` and parses as nothing, so the
  request is badge-less and correctly refused), and there is **no
  home-wide GC route** — only `POST /api/projects/:id/gc`, one canvas at
  a time, with nothing enumerating them. Three ways out are drawn in
  that script; a fourth, and the current lean, is to **sweep in-process
  on a timer** — no scheduler, no credential, no new kind of caller at
  the door, and the fit is good because garbage only accrues while a
  home is in use, which is exactly when an instance is alive. Whatever
  is chosen, `POST /api/gc` is wanted either way, including by a person
  who just wants to collect the whole home. **Not urgent and not
  load-bearing:** GC reclaims blobs no live entry references, the bill
  for not reclaiming them is cents at journey scale, and correctness
  does not depend on it. A home can run un-swept for a long time. It
  should not run un-swept forever, and whichever answer wins **redraws
  the [map](architecture.md)'s GC line**, which today promises a
  mechanism the code cannot perform.

---

## Phase 1 — The store seam

**Status: CLOSED** 2026-08-22 (`e917de5`).

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

**Status: CLOSED** 2026-08-22 (`003481e`).

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

**Status: CLOSED** 2026-08-22 (`fb6e586`).

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

**Status: CLOSED** 2026-08-22 (`a8a1e39`).

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

**Status: CLOSED** 2026-08-22 (`a624cd5` … `756f6f8`). All four
provisioning stages live at `https://dev.isocan.io`, auto-deploying on
push, and both halves of the Proof played. GC remains unscheduled on
purpose — see **Deliberately open**.

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

**Five more, added while writing the artifacts rather than discovered at
deploy time.** The `infra/` scripts, the Dockerfile and the two smoke
tests exist now; writing them against a machine nobody could reach
turned up five places where the map meets Google and needs a word
changing. Each is small; each would have been an evening.

3. **The daemon bound `127.0.0.1` and nothing could tell it not to.**
   Cloud Run's startup probe connects to the container's port from
   *outside* the container, so a loopback bind fails a deploy with "the
   user-provided container failed to start and listen on the port" — a
   message that reads like a crash and is not one. `DaemonOptions.host`
   plus `ISOCAN_BIND` is the answer, environment rather than flag for
   the same reason `ISOCAN_STORE` is. Done in this phase's artifacts;
   `http.ts`'s `loopbackBound` already anticipated it in a comment, and
   binding wide turns the localhost-trust clause off by itself.
4. **Cloud Scheduler cannot reach the GC endpoint, and there is no
   home-wide GC route.** The map says "Cloud Scheduler calls the
   existing GC endpoint … authenticated by OIDC service identity,
   behind the door like every route." The door admits **badges**:
   `presentedBadge` runs an `Authorization: Bearer …` value through
   `parseBadgeToken`, a Google OIDC JWT parses as nothing, and the
   request is refused — correctly. And the only route is
   `POST /api/projects/:id/gc`, one canvas at a time, with nothing
   enumerating them. Two pieces of work: a home-wide `POST /api/gc`
   that walks `listProjects()`, and a decision about what the door
   admits (a verified OIDC caller as a second carrier for maintenance
   routes — a desk decision, not a provisioning one). Not urgent:
   un-swept blobs cost cents. `infra/91-scheduler-gc.sh` refuses to
   create a job and lays out the three ways forward.
5. **Cloud CDN in front of a daemon that sets a cookie on the shell.**
   `registerStaticWebApp` is the SPA fallback for every unmatched GET
   and mints a badge with `Set-Cookie` when the caller has none — the
   desk's "badged on the page load" beat. Cloud CDN will not cache a
   response carrying `Set-Cookie`, so that case is safe by accident;
   but the same URL served to an *already-badged* caller carries no
   cookie and is cacheable, and once that copy is in the cache the next
   badge-less arrival gets a page that badges nobody. The daemon emits
   no `Cache-Control` at all today, so the backend is configured
   `USE_ORIGIN_HEADERS` — nothing cached until the origin says so. The
   work: `no-store` on the shell, `immutable` on the hashed asset
   filenames vite already emits, then the CDN caches exactly the right
   things.
6. **The object store's scratch objects cannot be swept by a lifecycle
   rule.** `GcsObjects.append` composes `<key>.part-<ts>-<rand>` beside
   the archive and its comment says "the bucket's lifecycle rule is
   where that gets swept". GCS lifecycle conditions match by prefix and
   by suffix; that name's prefix is a real object's key and its suffix
   is random, so no rule can name the scratch without also naming the
   blobs beside it. Move scratch under a fixed `scratch/` prefix and
   one `matchesPrefix` rule with `age: 1` does it. A fraction of a cent
   either way — recorded because the comment currently promises
   something the bucket cannot do.
7. **Two flags in the map that a deploy would have argued with.** The
   stack table says Node 22; CI pins 24, both Google client libraries
   want ≥22, and the container is built on 24 — a lagging line rather
   than a decision. And `--max-instances=1` is **per revision**, so it
   does not mean one process: during a rollout the draining revision
   and the new one each have one. That is exactly the deploy overlap
   the map already names, and the create-only precondition is what
   makes it safe — but nothing should be written as if the flag
   prevented it.

**Outcome:** A real hosted home. Two people at dev.isocan.io see each
other's cursors live; a deploy in the middle of traffic loses nothing.

**Proof:** Chrome, two profiles, one canvas — live correspondence;
ops written during a rollout all land in order (the create-only seam,
observed in production conditions).

**Findings:**

- **2026-08-22 — Stage A is provisioned and the home is real.**
  `isocan-io-dev` in `us-west1`, Cloud Run at `min=0/max=1`, Firestore
  with PITR, two buckets, three service accounts. A canvas created in a
  browser — "Acme Sprint Board", `prj_M6E50pTpki` — persisted as
  Firestore documents and read back through a freshly minted badge.
  Phases 2 and 4 are therefore true in production and not only in the
  suite: the door mints, `/api/projects` is 401 without a badge and 200
  with one, and the oplog is where CloudStore says it is.
- **2026-08-22 — Phase 4's debt is discharged: all three signing
  assertions PASS against a real bucket.** Including the one Phase 4 was
  least sure of — `x-goog-if-generation-match: 0` **is** honored inside a
  signed request, so the second PUT of a ticket is refused with 412 and
  blob writes really are create-only. And a service account with no
  private key signed in 423ms through the IAM `signBlob` path, which
  worked only because `roles/iam.serviceAccountTokenCreator` went in at
  service-account creation. One extra came back off-spec and is recorded
  rather than smoothed: dropping a signed header returns **400, not
  403** — GCS rejects such a request as malformed before it evaluates
  the signature, so a client that gets an upload wrong sees "bad
  request" rather than "forbidden".
- **2026-08-22 — Google's frontend swallows the exact path `/healthz`,
  and the architecture had built two things on it.** Measured against
  the live home: `/` 200, `/nonexistent` 200, `/healthz/` 200,
  `/HEALTHZ` 200, and `/healthz` a 404 from Google's own error page —
  with the container's request log never seeing it at all. The uptime
  check the map specifies would have monitored Google's frontend
  instead of the daemon, a check that cannot fail for the right reason;
  and `infra/70-cloud-run.sh`'s own gate ended a *successful* deploy
  with "deployed, but not serving", which is how this was found. The
  daemon now also answers `/api/healthz` — under `/api/`, deliberately,
  because that is the one prefix the SPA fallback does not answer with
  a cheerful 200, so a vanished handler shows up as a red check instead
  of a green lie. `/healthz` is untouched and still correct on
  localhost; this is an addition, not a rename. The interception itself
  is unverifiable outside a deployed home, so no local test pretends
  otherwise — what is pinned is that both paths are one handler.
- **2026-08-22 — The Proof is played, and the deploy overlap behaved
  exactly as designed.** The correspondence half — two people at
  dev.isocan.io, cursors live — was exercised by Dimitri, not by this
  session, and is recorded on his word rather than measured here; that
  attribution matters, because a proof is only worth what its witness
  saw. The rollout half was measured: 150 ops written continuously
  against the live home while the service took **two** revision
  rollovers (`isocan-00010-vmn` → `isocan-00012-krt`). Every one
  succeeded — **zero refused** — and the oplog reads back 150 entries,
  seqs ascending, contiguous from 31 to 180 with no gaps and no
  duplicates, and the order they landed is the order they were written.
  This is phase 4's create-only precondition observed under the
  condition it was built for and could previously only be shown against
  an emulator: during a rollout two instances briefly exist, and the
  schema — not an agreement — is what keeps one oplog honest. Left
  behind on purpose: 150 `thr_roll*` threads on the dev canvas, which
  are the evidence.
- **2026-08-22 — Stage D, and two gcloud shapes that only fail when you
  run them.** Continuous deploy works: a push to `main` builds, runs the
  container's own boot check, pushes, and deploys — revision
  `isocan-00004-q8v` from image `:b4642d5`, the commit sha, with the
  canvas intact across the rollout. Getting there corrected three
  things. **The connection check could never have passed:**
  `95-build-trigger.sh` verified the repository with `gcloud builds
  repositories list`, which is 2nd-gen Developer Connect only, while the
  console flow it instructs you to use — and the `triggers create github
  --repo-owner/--repo-name` form it then calls — are 1st gen. The two
  generations cannot see each other, so a correctly connected repository
  always listed empty and the script refused forever. There is no
  1st-gen "list what is linked" command, so the create is the check.
  **And `triggers create github` names its trigger with `--name`**, not
  a positional, unlike most `create` verbs.
- **2026-08-22 — `images:` is pushed after every step, which makes it
  useless to a step that deploys.** The first trigger build failed with
  `Image …:da3e43a not found` while the registry still held only the
  previous tag — `_TAG` had expanded correctly, the bytes simply were
  not there. Cloud Build pushes the top-level `images:` list only once
  all steps finish. That is fine for a build-only run, which is why
  `60-build-image.sh` never hit it and why `70-cloud-run.sh` deploying
  afterwards always worked; it is exactly wrong for an in-build deploy,
  which runs while the image exists nowhere but the worker's local
  docker. The push is its own step now, before deploy. Worth noting the
  shape of this bug: **the manual path and the automatic path disagreed
  about when a push happens, and only the automatic one was wrong** —
  so every hand-run of Stage A had been quietly confirming an ordering
  that continuous deploy did not share.
- **2026-08-22 — Two principals, one tarball.** `gcloud builds submit`
  uploads the source as the *human*, and Cloud Build reads it as the
  *build service account*. Nothing bridges them, so the first build died
  on a 403 that talks about a storage object and reads like a corrupt
  upload. Folded into `infra/40-service-account.sh`.
- **2026-08-22 — The managed certificate, and a mistake of mine worth
  keeping.** `dev.isocan.io` is live on a Google-managed cert, and the
  ordering the README describes is real: the load balancer and its
  static IP must exist first, then DNS points at it, and only then can
  the cert validate. What the README did not say is that the cert was
  created **before** the A record existed, so Google probed, failed, and
  parked the domain in `FAILED_NOT_VISIBLE` — a *sticky* verdict, not a
  live one. With DNS then correct, a verified chain (one IP, both
  forwarding rules, cert on the proxy that serves 443), and no CAA
  record in the way, it still read FAILED for ten minutes. I concluded
  the state machine was stuck and recreated the certificate. The
  background watcher then logged the original going **ACTIVE at
  19:45:25** — within seconds of my deleting it. The diagnosis was
  right and the patience was wrong: Google's retry had already
  succeeded, and recreating cost seven more minutes for nothing.
  The lesson, which is the reason this is written down: **a sticky
  failure status is not a stuck state machine.** When the chain is
  verifiable and DNS is clean, the correct action is to wait, because
  the only evidence that a retry is not coming is a retry that has
  already not come — and ten minutes is not that evidence. Create the
  cert *after* the DNS record next time and the whole episode does not
  occur. A cert also lags its own `ACTIVE` by a few minutes at the
  edge: 19:52 active, 19:53 serving.
- **2026-08-22 — The image's own boot test could not boot the image,
  and was right not to.** `cloudbuild.yaml`'s smoke step starts the
  container to check it serves; the image bakes `ISOCAN_STORE=cloud`,
  and a cloud home correctly refuses to start without a bucket. The step
  now overrides to the file backing: what it tests is that the *image*
  boots, not that a build step can reach Firestore — a build step has no
  business talking to the real home.

## Phase 6 — Birth at home, replica at home

**Status: CLOSED** 2026-08-23 (`2f3e0aa`). Both halves of the Proof
played: the integration tests stand up a home and two replicas on
separate `ISOCAN_HOME`s, and the lid-close beat was played by hand with
Chrome and the CLI against real daemons. Then played again against
**dev.isocan.io** over `wss:` — fourteen checks, all green — which is
also how phase 5's health-path finding was discovered to have expired.

**Work:** Setup creates the canvas at the home; the marker carries id
and address; the local daemon grows its **home connection** — dial,
present the badge, carry the two planes, reconnect by seq cursor — and
demotes itself to syncing replica. In the same stroke the local
daemon's page server turns home-only: people now have the one origin
to sit at, and the localhost web door closes behind them — ops to
CLIs, never pages to persons. **One thing phase 5 found so this phase
does not:** the CLI's staleness and liveness probes (`daemonPidOn`,
`ensureDaemon`'s startup poll, `warnIfStale`, `stopDaemons`, and
`client.healthz()` under all of them) hardcode `/healthz`, which is
correct against 127.0.0.1 and silently WRONG against a hosted home —
Google's frontend swallows that exact path and answers its own 404, so
a probe that has never left localhost will read a live home as dead the
first time it is pointed at one. The daemon already answers
`/api/healthz` with the same body from the same handler; the home
connection must use that path, and the choice of path becomes a
property of the address rather than a constant.

**Outcome:** Scene 0's shape is true on dev (its front-page door is
phase 14's): solo is the multiuser topology with one member, and
multi-device falls out — plus the lid-close beat:
tab and daemon each say "I have through N" and stream the tail.

**Proof:** Integration tests with two `ISOCAN_HOME`s against a home;
the lid-close/reopen beat played with Chrome and the CLI.

**Findings:**

- **2026-08-23 — "Is my cursor past the horizon" is the wrong question,
  and the empty answer to it is the dangerous one.** Compaction retains
  a **set, not a suffix**: `chooseRetained` walks undo/redo causes back
  into the past, so the live log after a GC has holes. A resume check
  written as "is `since` past `compactedThrough`" would therefore be
  wrong on any canvas with undo history, and the worker got that right
  on its own — contiguity from `since + 1` is the honest test. What
  contiguity cannot see is the empty tail: `[].every()` is vacuously
  true, and `chooseRetained` returns `[]` outright for `keepOps <= 0`,
  which `POST /api/projects/:id/gc` passes straight through from a
  request body. Measured on the working tree: a canvas at seq 6, gc with
  `keepOps: 0`, a socket at `?since=2` — and the answer was
  `{"type":"resumed","from":2,"lastSeq":2}`, telling the client it was
  current while four ops were missing. A tab self-heals on the next op,
  because the gap check fires; **a quiet canvas leaves nothing to fire**,
  and from this phase on that client can be a replica daemon that
  believes it is in sync. The check needs completeness beside
  contiguity — `since + tail.length >= lastSeq`. Recorded because the
  shape recurs: a guard written as a predicate over a list is a guard
  that says yes to the empty list.
- **2026-08-23 — A replica's oplog is a cache, not a copy of the
  history, and the map said otherwise.** A joining replica can only
  present cursor 0, and a cursor that cannot be served is answered with
  a snapshot — so a replica's log starts where it joined. Verified as a
  *mutation of the conductor's own proof* rather than reasoned: with the
  home made unable to serve a tail, the reopened replica's local oplog
  came back `[]` while its state converged exactly, against `[1,2,3,4,5]`
  when it genuinely resumed. That is also what makes "it resumed rather
  than re-snapshotted" assertable at all — contiguity of the local log
  is the observable difference, and it is what both the test and the
  hand-played beat check. [architecture.md](architecture.md) now says
  the log is a cache where it used to imply a replica ends up holding
  the history.
- **2026-08-23 — A replica discovers canvases by a home-wide route, so
  a multi-tenant home would replicate strangers onto a laptop.** The
  home connection polls `GET /api/projects`, which is not scoped to the
  asking badge's admissions. Solo is correct — one member, which is
  Scene 0 and everything this phase proves — but the moment a home has
  two members a replica pulls down canvases it was never admitted to.
  The narrowing is mechanism 10's and belongs on the route, in phase 7;
  it is on the [map](architecture.md) now rather than in a worker's
  head, because "everything is per-canvas" is exactly the belief phase
  4's finding warned would be acted on later by somebody who did not
  check.
- **2026-08-23 — A person cannot be one actor in the tab and the
  terminal while both are live — and the reported reason was the wrong
  one.** The worker reported this as `reincarnate`'s 30-minute window
  refusing with `name-taken`, called it "the one place phase 6 leans on
  phase 8", and it is neither. Measured: the refusal is
  `claims.ts`'s **liveness** clause — *"usr_… is somebody right now
  (live on a canvas) — becoming them would be one actor wearing two
  faces"* — and with no live face the same `--as` claim **succeeds**,
  which is the recovery the registry itself prints as the remedy. The
  guard consults `presence.roster`, which was per-daemon before this
  phase too, so tab-and-CLI-as-one-live-actor was refused exactly this
  way when both sat on one local daemon: the constraint is pre-existing
  and phase 6 does not lean on passes for it. Recorded at length
  because the correction matters more than the fact — a finding that
  names the wrong mechanism sends the next phase to fix the wrong code,
  and this one would have sent phase 8 after a problem it does not own.
- **2026-08-23 — Two badges, and the one that had a slot waiting.**
  `client.ts`'s `StoredBadge` comment predicted this phase in writing —
  "keyed by home address, so phase 6's second badge … has a slot waiting
  instead of needing a second file" — and it was right, but the slot was
  in the wrong package: the door knock and the badge store lived in the
  CLI, and the daemon needed both. They moved to
  `packages/server/src/badge-store.ts` and both surfaces import one
  mechanism. The prediction paid off; the location did not, which is
  the ordinary fate of a seam designed one caller early.
- **2026-08-23 — A forwarded write holds the single-writer chain across
  an HTTP round trip, and that opened a window the design did not have
  before.** With the write in flight the local store still said "I have
  nothing" about a canvas one line from being written, so the home
  connection dialled with `since=0`, was correctly answered with a
  snapshot, and adopted it *over* the entry about to land — losing seq 1
  from the replica's own log. Fixed twice over (`Engine.settled()`
  before reading a cursor; `adoptRemoteSnapshot` refusing when the local
  `lastSeq` already equals the snapshot's). The general shape is worth
  keeping: the chain used to serialize writes against writes, and now it
  serializes writes against *arrivals*, which are not under this
  process's control.
- **2026-08-23 — Blobs are not ops, but items are named by them.** The
  write-forwarding list was written as "ops", and a replica that
  forwarded only ops replicated a canvas of items whose bytes nobody
  else could resolve. Uploads go to the home first and are kept locally
  too; a local blob miss reads through to the home, Range passed up.
- **2026-08-23 — A test pointed at the real dev home, and only stage 2
  made it fire.** `replica.test.ts` used `https://dev.isocan.io` as a
  configured address. Harmless while a replica merely declined to serve
  pages; the moment a replica *dials*, the suite started knocking on the
  live dev home's door. Now `https://home.invalid` (RFC 2606, which can
  never resolve). A placeholder that names a real host is a placeholder
  only until the code grows the ability to use it.
- **2026-08-23 — The address was dialled, and everything held over the
  real wire.** Recorded on Dimitri's run rather than this session's, and
  the attribution matters: a replica pointed at **dev.isocan.io**, badge
  minted at the real door, one socket over **wss:** through the load
  balancer. All fourteen checks passed — the canvas born through the
  replica exists at dev; a write forwards and the item is at the home by
  name; the lid closes, the evening is written at dev by another actor,
  the lid reopens and the local oplog comes back contiguous `[1,2,3]`.
  That last is the phase's whole claim: it **resumed** rather than
  re-snapshotting, across the internet, through a load balancer, against
  a Cloud Run instance that had cold-started from zero.
- **2026-08-23 — And the run overturned phase 5's health-path finding
  inside a day.** Phase 5 measured `/healthz` on the dev home as a
  branded 404 from Google's frontend that never reached the container.
  Re-measured on the same home one day later, it returns **the daemon's
  own body** — `pid`, `root: /app`, byte-identical to `/api/healthz`.
  Whether Google's frontend changed or something in the load balancer
  did is not established, and that is exactly the finding: the fact the
  map rested on was never ours, and it moved without notice.
  What survives is the *other* argument, which never depended on the
  frontend and which the same measurement sharpens: `/healthz/` and
  `/HEALTHZ` come back as **1001 bytes of `index.html`** at 200, so a
  check on a near-miss path is green forever and cannot fail for the
  right reason — `/api/` is the one prefix the SPA fallback does not
  answer cheerfully. `healthPath()` is therefore **defensive rather than
  necessary** now, and is kept on those terms.
  [architecture.md](architecture.md) keeps both reasons in order, the
  expired one first, rather than deleting the dead one — a map that
  quietly drops a reason teaches the next reader that the surviving one
  was always the whole story.
- **2026-08-23 — A replica is not a backup, and the map said it was the
  best one.** Found by walking Scene 0's multi-device beat by hand: two
  replicas of one home, a file added on the first, and the second
  machine listing the item perfectly while holding **zero bytes of it**.
  Blobs a replica did not itself upload are streamed from the home on
  demand and are **not cached** — the second machine's blob directory
  was still empty after reading the file through twice. Put beside the
  earlier finding that a replica's oplog begins where it joined, the
  shape is clear: a replica holds the canvas's **state**, not its
  **history** and not its **bytes**.
  [architecture.md](architecture.md)'s backups bullet said "the best
  backup remains a thick replica — sovereignty by replica is also
  disaster recovery"; it was written before replicas existed and is now
  corrected, because it fails in the one direction that matters — a
  replica looks complete right up until the home is gone.
  **This is phase 13's problem before it is anyone else's.** Re-homing
  is drawn in [offline-birth.md](design/offline-birth.md) as "a thick
  replica offers its store to a *new* home … hello, badge, offer,
  replay", and the store it would offer today is missing precisely the
  two things a replay consumes. Whether re-homing is restricted to the
  originating replica, or a replica learns to backfill history and
  blobs, is a phase 13 decision — named here so it is chosen rather than
  discovered.
- **2026-08-23 — Scene 0's multi-device beat works, including the race
  nobody had run.** A marker carried to a second machine by git — the
  clone case — resolves against a replica that has never heard of the
  canvas, and it does so without a `duplicate-id`: the command was run
  deliberately in the window before the home connection's first sweep,
  and the binding still landed on the existing canvas rather than trying
  to create it again. What the second machine then sees is the first
  machine's work, which is the beat Scene 0 promises and the one that
  makes solo multi-device fall out of the multiuser topology.
- **2026-08-23 — What the conductor did NOT verify, stated plainly.**
  The `writer-fenced` (409) pass-through is proven by construction — one
  branch, one error shape — and not by execution: a real fence needs two
  writers against one oplog, which a `FileStore` home does not produce,
  and the dev run did not force a rollout underneath itself. Phase 5
  measured the real thing against the hosted home under a rollout; this
  phase did not re-measure it through the replica path. Nor was a
  **browser at dev.isocan.io** driven against a replica: the hand-played
  Chrome half ran entirely against local daemons, and the dev half was
  CLI-only.

## Phase 7 — The share (Scenes 1–4)

**Status: CLOSED** 2026-08-23 (`995fbe5`). Scenes 1–4 played by the
conductor against real daemons: the Share dialog beside the facepile, the
CLI verb reporting the same address, Jordan arriving on nothing but a
link, and a parked `isocan wait` on a replica woken by a mention typed in
a browser at the home.

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

**Findings:**

- **2026-08-23 — The same silent failure, a third time, one layer down.**
  Stage 1 taught the socket to refuse (4402) and 4404 already existed, and
  the browser handled *neither*: both fell into the ordinary 800 ms
  reconnect backoff, so a canvas whose link had been switched off, or a
  mistyped id, sat forever on "reconnecting" over an empty canvas. That is
  the third instance of one pattern in two days — phase 6's `/healthz/`
  answering 200 with the app shell, `/c/<id>` rendering a blank page, and
  now a refusal indistinguishable from a network blip. **The shape: this
  system's default answer to a wrong address is a cheerful one.** Both are
  terminal states with their own copy now, and the door was not loosened
  to do it — only its legibility changed.
- **2026-08-23 — Discovery by enumeration is the wrong primitive, and
  phase 6's debt is only partly paid.** Narrowing `GET /api/projects` to
  admissions alone **breaks replicas**, measured rather than reasoned: a
  fresh replica's badge has no admissions, `HomeLink.sweep` unions the
  local list with that route, both come back empty, so it never dials and
  nothing ever admits it. A link grant admits whoever *presents* the
  address; it does not make a canvas enumerable, and enumeration is what
  discovery currently needs. The shipped compromise is the door's own test
  on the listing — a badge sees what it is admitted to plus what a grant
  *would* admit it to — which closes the leak for a revoked link and
  leaves it open while the link is on. The honest wording for phase 6's
  finding is therefore **"narrowed to the door's test; full closure needs
  phase 8's pass"**, not "paid". And the deeper question, named here so
  phase 8 chooses it rather than meets it: a replica arguably should
  replicate **the canvases its markers name**, not everything a home will
  show it. Enumerate-and-mirror was never the design; it was the easiest
  thing that worked when there was one member.
- **2026-08-23 — A replica needs its own grant rows, which no design doc
  had considered.** The desk's mechanisms only ever discuss the *home's*
  door. Without a local row a second machine's CLI does not get a clean
  403 — it gets "this directory is bound to project prj_… which does not
  exist in this home yet", because the local listing hides the replicated
  canvas from a fresh local badge. The local row is a different sentence
  in a different ledger: *who on this machine may reach the local copy*. It
  deliberately does **not** inherit the home's revocation — what stops a
  laptop is that its badge is expelled at the home and replication goes
  stale, which is phase 9's to state.
- **2026-08-23 — `/api/ops` was admitting AFTER the write.** Harmless for
  five phases, because the check could not refuse; the moment it could, a
  refusal that arrives after the op has landed is not a refusal. Now the
  door runs before `engine.submit` for every op naming a canvas, and the
  conductor confirmed by hand that a refused write leaves `lastSeq`
  untouched. The general lesson is about *order surviving a change in
  meaning*: code that runs in the wrong order is invisible while it is a
  no-op, and correct-looking right up until the day it matters.
- **2026-08-23 — A caller's mistake was being reported as our failure.**
  `DELETE` with `Content-Type: application/json` and no body returned
  **500 "internal error"**. Pre-existing — `/api/commands` and
  `/api/presence/actors` had always done it — because Fastify refuses an
  empty JSON body and `setErrorHandler` collapsed the unknown error to
  500. It became this phase's because stage 1 adds a revoke that both
  surfaces call, and plenty of clients set that header unconditionally.
  The fix is better than the report asked for: gate on **`statusCode`**
  rather than a list of `FST_ERR_CTP_*` codes, because Fastify already
  tags a caller's mistake 4xx and its own failures 5xx. The rule that fell
  out is worth keeping — **4xx is about the request, so its message is
  safe to repeat; 5xx is ours and stays opaque.**
- **2026-08-23 — The address got a forcing function, not just a
  decision.** Keeping `/p/` would have been a comment somebody violated in
  a month, so the prefix now has exactly one definition in
  `core/address.ts` and a test greps every source file for a hand-built
  canvas URL in either spelling. It found three on its first run — the
  CLI's `open` and two in the project list. Same instinct as
  `surface.test.ts` catching a verb missing from the agent guide: a rule
  the build can check is a rule, and anything else is a hope.
- **2026-08-23 — How the Proof was actually played, stated so nobody
  over-reads it.** The Proof says "two Chrome profiles"; the conductor
  used **two cookie hosts** — `127.0.0.1` and `localhost`, which are
  different hosts for cookies and therefore different badges, on one
  profile. That is a real second person as far as the desk is concerned
  and it is how Jordan arrived on nothing but a link. What it does not
  exercise is a genuinely separate browser profile's storage, and the
  badge cookie is `HttpOnly` by design, so a third arrival needs a third
  host or a real profile. Everything else played: the parked agent on a
  **replica** woke from a mention typed in a browser at the **home**, the
  `@` picker showed him LIVE across the relay, and his "reading your
  comment…" came back the other way.
- **2026-08-23 — One unreproduced flake, recorded rather than closed.**
  Stage 1 reported a single failing test in one run out of seven and could
  not name it — the grep that would have captured it swallowed the name.
  It did not recur in roughly twenty subsequent runs (six full suites and
  eight of the concentrated integration files by the conductor, plus the
  worker's own). Left open on purpose: a flake nobody can name is not a
  flake anybody has fixed. The operational lesson is the cheap one — **a
  stress loop that does not capture failures by name is a stress loop that
  buys nothing.**

## Phase 7.5 — The home you answer to

**Status: CLOSED** 2026-08-23 (`af7b2ab` … `5f3aaf9`). The walk played
against **dev.isocan.io** on deployed code: `isocan home` in one command,
a nameless claim that allocated `Nico` rather than colliding, a canvas
born at the home, a marker carrying its address, and an item written from
the terminal and read back at dev. It was PART-DONE for an hour while the
last leg was chased — see the findings, where two of the conductor's own
diagnoses were wrong before the third one measured it.

**Why this exists, since it was not in the original walk.** Phase 6
shipped replicas, and then Dimitri tried to walk Scene 0 with them. It
took three exported environment variables, a scratch `ISOCAN_HOME`, a
hand-started daemon in its own terminal, and a URL read out of a marker
file. None of that is a missing feature in the journey — it is a missing
**verb**. `config.json` has had a `home` key since phase 6 and
`resolveHomeUrl` has always read it; nothing was ever able to write it,
so the only ways to become a replica are an environment variable and a
text editor. The scratch home was not incidental either: setting the
variable globally would have demoted the working daemon and stopped it
serving pages, so the temp directory was self-defence against the
configuration model.

This is **not only dev ergonomics.** Commitment 2 says `isocan serve` on
a rented VM is a complete home; anyone pointing their daemon at their
own innkeeper's home needs this verb, and today they would have to be
told about an environment variable. House rule 2 says an agent should
not need a pointer for an intent, and "answer to this home" is an
intent.

**Work:** `isocan home` — show the current role, set a home, clear it —
writing `config.json` and restarting the daemon so the change takes.
`npm run dev:replica` for the repo's own use: a replica against dev on a
fixed port with its own `ISOCAN_HOME`, because working on the web UI
needs a local home and working on the home needs a replica, and that is
inherent rather than a bug (the one-origin rule means a replica cannot
serve pages — [offline-birth.md](design/offline-birth.md) already
accepts it). `isocan setup` finishing the walk when a home is
configured, printing the canvas's address at the home rather than
leaving it to be read out of a marker file. The agent guide and the
README told about all of it.

**Not a reversal, and the comment must say so.** Phase 6 deliberately
refused a `--home` *flag*, on the same grounds as `ISOCAN_BIND` and
`ISOCAN_STORE`: "innkeeper configuration, not a per-invocation choice an
agent should be able to reach for." A verb that writes persistent
configuration is a different thing from a per-command override, and the
original reasoning survives intact. Say that where somebody would
otherwise read this as phase 6 being undone.

**The default address stays deferred to phase 14, and this phase
sharpens why.** A CLI that shipped with `isocan.io` as its default would
turn `isocan serve` in this checkout into a replica of production.
Opt-in is right for us; opt-out is right for a shipped product; the flip
belongs with the promotion gesture, where it is one line.

**Outcome:** Pointing a daemon at a home is one command. The Scene 0
walk against dev needs no environment variables and no scratch
directories.

**Proof:** The walk played with a clean shell — no `ISOCAN_*` exported —
against dev.isocan.io. The baseline is known and painful: phase 7's own
proof was played with the full dance, so this phase's proof is that same
walk with the exports deleted.

**Findings:**

- **2026-08-23 — A name allocated on a replica was a name the home would
  refuse, and the obvious diagnosis was wrong.** The walk's first
  `isocan identity --session` against dev failed with *"Isaac" is taken
  here*. The conductor assumed a race — the home's actor registry not yet
  replicated — **and tested it, and it was not.** With eleven names
  confirmed replicated locally and a twelve-second wait, allocation still
  picked Isaac. The real cause is a **scope mismatch**: `allocateName`
  builds its taken-set from *admission-scoped* queries, and a fresh
  replica's badge has no admissions — `desk.ts` says so on purpose
  ("a badge that has never been in a canvas shares a roster with
  nobody"). So the local answer is right by its own rules and wrong at
  the home, which judges the same name against its own scope. It looked
  like it self-healed on retry; that was **accidental** — the failed
  attempt left Isaac claimed locally, so allocation moved to the next
  roster entry, burning names until one was free at both ends.
  The fix asks the home for a free name and treats the answer as a
  **preference**, not a reservation: forwarding the claim itself would
  put a local session key into the home's ledger — the precise thing
  `Engine.claim` forbids — and would make a nameless claim *fail* when
  the home is unreachable, which a replica must survive. Two replicas
  asking in the same instant can still be handed the same name; closing
  that needs a reservation, and a reservation is a claim, so it is named
  in the code rather than half-built.
- **2026-08-23 — The fix reproduced the bug inside itself, and it took a
  real remote home to show that.** Asking the home for a free name was
  the right shape, and `freeName` was built from `claimContext` — which
  gathers scope with the CLAIM's reach, admissions only. A replica's
  badge is minted fresh and admitted to nothing at the moment it asks, so
  every roster name looked free and the home returned the one name
  guaranteed to collide. Measured against dev with **one badge and two
  calls a single GET apart**:

      no admissions           -> {"name":"Isaac"}   (taken on a canvas)
      after one admitting GET -> {"name":"Nico"}

  It passed every local test because a replica's sweep admits its badge
  in milliseconds over loopback, so by claim time the scope was
  populated; across the internet the claim wins that race. The refusal
  then names a canvas the badge had **not** been in when it asked, which
  is what made it so hard to read.
  The conductor got there third. The first diagnosis was a registry race
  (tested, wrong). The second was "dev runs old code" — plausible, since
  dev genuinely lacked the route, and **still wrong**: dev was redeployed
  and the walk failed identically. Only then did the one-badge-two-calls
  measurement isolate it. Both wrong diagnoses were *reasonable* and both
  would have shipped a fix for a bug that was not there. What finally
  worked was reducing to a single call whose answer could only mean one
  thing.
  The fix gives `claimContext` a **reach**: `freeName` alone asks for
  "admissible" — admissions plus whatever a grant would admit this badge
  to, through the same `admittingGrant` the projects listing walks. That
  is the same trick phase 7 used when scoping `GET /api/projects` to
  admissions broke replicas, for the same reason, and the code says so
  rather than leaving two coincidences. Disclosure is a strict function
  of what the asker can already obtain: one name, never the taken set,
  across canvases `GET /api/projects` already lists to that badge. A
  revoked link drops the canvas out, and judging a name admits nobody —
  both asserted.
- **2026-08-23 — The flake was two flakes, both timing, and one of them
  was a product bug.** Dimitri's read — *"flakes come from when I forget
  to design the tests to not depend on timing"* — was right on both
  counts. Caught by running the suite twenty times and writing **full
  output to a file per run**, which is the whole lesson: two earlier
  sightings were lost because the reporter grepped a stream that had
  already scrolled, and an unnamed flake is one nobody can fix.
  **The first was not a test bug at all.** `Daemon.close()` never drained
  the engine's single-writer chain. `app.close()` destroys sockets, which
  does not cancel a handler already running behind one, so a request that
  had reached `engine.claim` had work still queued — and that work wrote
  to the desk *after* `desk.close()` had drained and returned. Caught in
  the act with a post-close write detector: a `.tmp-*` file appearing in
  a `desk/` directory belonging to a daemon that had said it was shut.
  Under test that is `ENOTEMPTY … rmdir …/desk`; in a container it is a
  write racing process exit. `await engine.settled()` in `close()` is the
  fix, and it is safe there rather than earlier only because the home
  connection is closed above it.
  The second was a test asking the wrong question: `exitCode !== null` is
  **null for a process killed by a signal**, so on the SIGKILL path the
  helper read a dead daemon as alive and waited on an `exit` event that
  had already fired. Intermittent because `stopDaemons` only escalates to
  SIGKILL when a daemon misses its SIGTERM grace, which happens under a
  loaded suite and never on an idle machine. Neither was fixed by
  lengthening a timeout or sleeping in teardown — both of which hide a
  signal rather than remove it.
- **2026-08-23 — And the shutdown could not always shut down.**
  `runDaemon`'s handler was `close().then(() => process.exit(0))` with no
  catch, so a rejection from `desk.close()` or `store.close()` left a
  process alive with its handlers detached: stopped serving, will not
  die. That is *exactly* the condition that makes `stopDaemons` escalate
  to SIGKILL — so chasing a flake caused by the escalation is how the
  line got read at all. It now logs and exits 1, because a close that
  could not flush is not a clean shutdown and a process reporting success
  is one nobody investigates. Named and not fixed: a `close()` that never
  *settles* hangs the same way, and a watchdog that killed a daemon
  mid-flush would be its own bug.
- **2026-08-23 — The cheerful wrong address, a fourth time, now between
  versions.** `GET /api/actors/free-name` against dev returns **HTTP 200
  and the web app**, because an unmatched `/api/` path on a badged
  request falls through to the SPA handler. After `/healthz/`, `/c/<id>`
  and the refused socket, this is the same shape in a new place — and
  this one has teeth beyond legibility: **a replica's version
  negotiation with an older home works only because parsing HTML as JSON
  throws.** The fallback is correct by accident rather than by design.
  A route that does not exist under `/api/` should say so; that is the
  general fix, and it wants doing before something asks a question whose
  wrong answer is not conveniently unparseable.

## Phase 8 — Escalation (Scene 5)

**Status: PART-DONE** — built and played whole on this machine
(`3aa561b` and the commit beside it), and **not yet played against dev**,
which is what the Proof names. The scene ran end to end on two `ISOCAN_HOME`
directories and a real browser: the tab minted the pass, one pasted command
escalated the second machine, its agent claimed its own actor, and an
`@`-mention typed at the home woke that agent under the other roof. What is
left is the same walk against `dev.isocan.io`, which needs this code deployed
there.

**Work:** Pass minting from an admitted session; the one-command setup
consuming `address#pass`; the redeemed badge born knowing its person;
`isocan open` appending a daemon-minted pass.

**Outcome:** Scene 5 plays: a thin guest goes thick in one command,
their agent claims its own actor, and a summons executes under their
roof.

**Proof:** The scene, played end to end against dev; vitest for pass
lifecycle (single-use, short TTL, named claim, admission-only form).

**Findings:**

- **2026-08-23 — A pass that lands in the bar of a tab that is already
  open never arrives at all.** Measured in Chrome while driving the web
  half: pointing an open canvas tab at *its own address* with `#<pass>`
  appended is a **same-document navigation**. Nothing reloads, the entry
  point never runs again, and the credential simply sits in the address
  bar doing nothing — no redemption, no refusal, no page to read. It is
  the cheerful wrong address in its quietest form yet, and this codebase
  has now met that shape five times. `isocan open` usually escapes it by
  spawning a new tab, but "usually" is not a property: a person pasting
  the line into the bar of the tab they already have open lands here
  every time. The fix is four lines — a `hashchange` listener that
  reloads when the new fragment is a pass, after which the page comes
  back through the ordinary arrival path. It cannot loop, because the
  fragment is stripped with `replaceState`, which fires no `hashchange`.
  **The general lesson is about fragments, not passes:** a credential
  carried in a `#fragment` is invisible to the one event a SPA usually
  relies on (a page load), so anything that arrives that way has to be
  read at load *and* on change.
- **2026-08-23 — The same handed identity is adopted differently on the
  two surfaces, on purpose.** `setup` refuses to let a pasted command
  overwrite a DIFFERENT person already in `identity.json` — that file is
  a machine's one durable answer to "who owns this laptop", and nothing
  stands behind it. The browser does the opposite and overwrites: the
  persona it displaces is still one click away in the identity menu's
  "Switch to" roster, and the tab was opened by a link that names who it
  is for, so refusing would burn a single-use pass and leave the person
  looking at somebody else's face. Two surfaces, one mechanism, two
  answers — because what is behind the slot differs, not because either
  side got it wrong. Recorded so a later phase does not "fix" the
  asymmetry into consistency.
- **2026-08-23 — A copy button cannot be proven in an automated tab.**
  The dialog's Copy was driven both by a real click and from the page,
  and `navigator.clipboard.writeText` neither resolved nor rejected:
  Chrome blocks the clipboard while `document.visibilityState` is
  `hidden`, which is what an automated tab is. The command itself was
  read off the screen and out of the DOM, and the fallback path (a
  refusal message, plus `user-select: all` on the command so it can be
  selected by hand) is what a real browser would show. Worth knowing
  before the next phase writes a Chrome proof around a clipboard.
- **2026-08-23 — Discovery by enumeration is gone, and the thing that
  replaced it is not one mechanism but two.** Narrowing the sweep was the
  easy half: `HomeLink.sweep` asks
  `GET /api/projects?reach=admitted`, the route answers admissions and
  nothing else when a caller asks that question, and a replica mirrors
  what it was let into. Measured on real daemons before and after: a
  scratch replica pointed at a home holding two link-granted canvases
  replicated **both** in under two seconds, and now replicates **none**,
  indefinitely. What the narrowing revealed is that **two shipped
  arrivals carried an ADDRESS and no admission** and were living entirely
  off enumeration — a `.isocan/project.json` cloned by git onto a second
  machine (Scene 0's multi-device beat) and a pass-less
  `isocan setup <address>`, both of which have their own tests and one of
  which stage 3 wrote a week ago. They were not designed to enumerate;
  they worked because the home listed itself. So the arrival now says
  what it wants — `POST /api/home/join`, one canvas by name, the home
  running the same door test it would have run when the sweep dialled —
  and the CLI speaks it where the marker is resolved. **The general
  shape: removing an accidental capability is cheap, and finding
  everything that was standing on it is the work.** The suite found all
  three callers in one run (14 failures, five files); no amount of
  reading would have.
- **2026-08-23 — The narrowing had to be caller-stated, because one
  route answers two different questions.** `GET /api/projects` is the
  BROWSER's list as well as the replica's, and on a solo home the
  household is one machine: a canvas created from the CLI is admitted to
  the CLI's bearer badge while the person's tab carries a cookie badge
  that has never been in it. Narrowing the route wholesale would have
  hidden a person's own canvas from their own front page — a worse bug
  than the one being fixed. So `?reach=admitted` is stated by the caller
  and the wide answer is the default, which also makes the change
  backwards compatible in the direction that matters (an old replica
  polling a new home gets exactly what it always got). Sniffing the
  carrier was the obvious shortcut and is the one this codebase already
  refuses; the vocabulary is deliberately the same two words
  `claimContext`'s `NameReach` uses one layer down, because it is the
  same distinction.
- **2026-08-23 — A canvas born on a replica survives on two legs, and
  only one of them was obvious.** The brief asked why birth-on-a-replica
  keeps replicating after the narrowing, and the honest answer is that
  it is over-determined: the forwarded `project.create` lands in the
  local store (so the sweep's local half names it, which is also what
  makes "a home that is down must not make a replica forget" true — one
  line, two properties), AND the home writes `{root: "created"}` onto
  the creating daemon's badge, so the narrow listing names it too. The
  second leg is the one a reader would doubt and the one asserted
  directly, with the replica's own home badge, because it is invisible
  from the machine that owns it and it is what survives a local store
  being thrown away.
- **2026-08-23 — The design doc lost an argument to the browser, and the
  doc moved.** Mechanism 1's diagram had redemption minting a THIRD badge
  (`H-->>D: badge B₃`), and the code endows the badge the caller already
  presents. The reason is not convenience: a browser holds a cookie badge
  before it can ask for anything, and the door deliberately never returns a
  cookie's secret in a body — so "the reply carries a new badge" is a shape a
  browser physically cannot receive, and what it would mean there is
  re-setting the one cookie and dropping its admissions. The design's
  substance survives untouched — a badge that arrived knowing nothing leaves
  knowing its person, and badges still "differ only in dowry". Ruled by the
  conductor and [identity-desk.md](design/identity-desk.md) now says what the
  code does, with the argument beside it. The same section also stops drawing
  the pass as a branch the door runs on every arrival: it is a route, because
  a single-use credential presented on every request is a contradiction.
- **2026-08-23 — How the Proof was actually played on this machine, stated
  so nobody over-reads it.** Two "machines" were two `ISOCAN_HOME`
  directories and two daemons on one host, which is a real second machine as
  far as every ledger involved is concerned — separate desk, separate badge,
  separate identity file, separate store — and it is how the escalation was
  driven: the tab minted the pass, `setup <address>#<pass>` in an empty
  directory pointed the daemon, redeemed, replicated, and wrote the marker;
  the agent there claimed its own actor; and `@`-mentioning it in a browser
  **at the home** woke it **on the other machine**, its face in the facepile
  and its cursor on the canvas. What that does NOT exercise is the internet
  between them, which is exactly what phase 7.5 learned can turn a passing
  local test into a failure at a real home — a claim won a race over loopback
  that it lost across the wire. So the dev walk is not a formality here, and
  the phase stays PART-DONE until it is done.
- **2026-08-23 — Turning off a link stops arrivals; it does not empty a
  laptop, and that is still correct.** Measured: a machine enrolled by a
  pass keeps both its canvases after the link grant is revoked at the
  home, while a sixth machine's pass-less `setup` of the same canvas is
  refused and says so. Admissions stand until something expels them,
  which is phase 9's sweep. What changed here is only that the refusal
  is now LEGIBLE — a cloned marker whose home will not have this machine
  gets "…would not hand this machine prj_… : this badge is not admitted
  … mint a pass from a session that is already on it", where before the
  narrowing it got a canvas it should not have had, and after the
  narrowing but before the join route it would have got silence.

## Phase 9 — The desk hardened: attesters and revocation ⚑ provision

**Status: NOT STARTED.**

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

**Status: NOT STARTED.**

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

**Status: NOT STARTED.**

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

**Status: NOT STARTED.**

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

**Status: NOT STARTED.**

**Work:** Adoption from seq 1 on first reconnect; first-writer wins
and the late twin parks whole; re-homing as the generalized push —
work travels, the guest book stays.

**Outcome:** A plane-born canvas adopts its promised home; a twin is
refused and parked, never merged; a re-homed canvas keeps its authors
while the roster re-forms.

**Proof:** Integration tests across scratch homes for all three flows.

**Findings:** *none yet.*

## Phase 14 — isocan.io ⚑ provision

**Status: NOT STARTED.**

**Work:** Stand up `isocan-prod`; the domain; the `release`-branch
promotion; the front page — the home origin wearing Scene 0's three
steps; and flipping the default home address from unset to isocan.io
(phase 7.5 says why it is unset until here).

**This phase bundles two things, noticed 2026-08-23, and may split.**
Provisioning prod is genuinely last. The **front door** — the front page
and the default address, the two things that make the product enterable
by somebody who has read nothing — has no dependency on prod and could
run against dev. Until it exists, every Proof from phase 6 onward is
played by somebody who already knows the environment variables, which is
how the phase 7.5 gap stayed invisible until a person tried the walk.
**Scene 0 is not a phase; it is a thread through phases 6, 10 and 14** —
which is why phase 6 could only claim its *shape* was true while this
phase claims it "plays for real". Left as one phase for now because
there are no strangers yet; split it the moment there are.

**Outcome:** Scene 0 plays for real: a clean machine, isocan.io, three
steps, a canvas born at its hosted home.

**Proof:** The scene, played from scratch, on the real address.

**Findings:** *none yet.*
