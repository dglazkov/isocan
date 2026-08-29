# Implementation phases

The [architecture](../../architecture.md) is the map; this doc is the walk.
Each phase is a **discrete amount of work that ends in a testable
outcome** — not a theme, not a milestone: a thing that can be
demonstrated true when the phase closes, and the demonstration is named
up front. The [journey](journey.md) is the acceptance suite:
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
[map](../../architecture.md) if a finding redrew it, commits the phase
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
them mid-task and improvising. Above the phases sits **Standing
lessons** — the handful of things re-learned in three and four different
places, hoisted out of the phases that taught them so they are read once
rather than met once per phase.

**Compacted 2026-08-24, and how to write a finding now.** The Findings
were written long — argument, evidence, and the blow-by-blow of the
session that found each one — and had reached fourteen thousand words
against five thousand of everything else. They are an index now: one
dated line, the claim and nothing else. **The long form is not gone, it
is in `git log -p --follow docs/projects/multiuser/phases.md`** — `--follow`
because this file was `docs/phases.md` until the projects layout — thirty
commits deep, and the date on a line is how the commit that wrote it is
found. What survived the cut is what would change a later session's
behaviour — decisions still
binding, debts still unpaid, and reversals where the obvious move turned
out to be wrong. What was cut is evidence for claims nothing disputes,
and bugs a test now guards: where a test guards it, **the test is the
memory**. Findings written from here on should be this short in the
first place, and the argument that produced them belongs in the commit
message.

**Compacted again 2026-08-25**, because the paragraph above was written
and then not obeyed: five phases closed after it, and each wrote its
Findings at the old length — three times the budget, re-teaching lessons
already standing above. So the budget is a number now. **One entry is
one claim in about forty words**, and a phase's whole Findings section
wants to stay under three hundred. An entry that needs a second sentence
is usually two entries, or one entry and a **Standing lesson**; an entry
that needs a paragraph belongs in the commit message, with the line here
pointing at its date.

Every phase also carries a **Status** line directly under its heading —
`CLOSED` with the date and the commit that closed it, `PART-DONE` with
what is missing, or `NOT STARTED`. It is there so completion is *stated*
rather than inferred from whether Findings say "none yet": a phase can
close without surprising anybody, and an empty Findings section must
never be read as an untouched phase. `grep '^\*\*Status' docs/projects/multiuser/phases.md`
is the whole roster in one screen, and `grep -n '— Open' docs/projects/multiuser/phases.md`
is the roster of unpaid debts — a finding's one piece of content that
nothing else in the repo records, which is why those are marked and why
they were compacted least. When a phase closes, its Status line
moves in the same change as the "where we are" line — one gesture, or
they drift. A finding that redraws
the map edits [architecture.md](../../architecture.md) in the same change —
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

**Where we are: Phase 14 is CLOSED — isocan.io is live, and the launch train has
arrived.** `isocan-io-prod` is a real home at the apex of the domain: its own
project and Firestore, one always-on instance, a load balancer that is now the
ONLY way in, nightly exports, an uptime check that pages, magic-link sign-in,
and a deploy that happens only when somebody moves the `prod` tag. Scene 0 was
played from scratch on the real address with the released CLI, and `isocan
setup` on a machine that has never held a canvas now writes `https://isocan.io`
down as the birth default — with a receipt, and `isocan home --clear` as the
whole of the way back.

**Three things a clean session should know about what launched.** The default is
consulted in `setup`, NOT in `resolveHomeUrl`, and the difference is the whole
care: a checkout is never flipped, nor is a machine that already holds canvases.
Prod's certificate is called `isocan-cert-2` and `prod.env` says why. And the
day's real find was underneath 13.7 rather than in 14: **every `app.log` call in
the server had been writing to nowhere** — `Fastify({})` with no `logger` key
hands back `abstract-logging` — so the instrument 13.7 built for its own worst
failure mode was silent from the day it was typed.

**What is next is a choice, not a queue, and now it is only a choice.**
Everything below is a feature added to a live isocan.io, and its order returns
to being a hypothesis — real users get a vote on whether the spark (11, 12) or
the airplane (12.5, 12.7) matters more. The one debt that sat outside that is
paid: **phase 10.5 closed 29 Aug 2026**, when Paul and Dion walked
`development.md`. Nothing on this project is owed to anybody now. Prod's
sign-in mail is done — magic-link from an aligned sender, proved on a browser
at isocan.io.

**Two things that were true before launch and still are.** The wire keys renamed
in 13.5, so **a pre-rename CLI or replica cannot WRITE to a current home** — it
gets 426 and the upgrade command, reads still work, and Dion and Paul both need
`npx github:dglazkov/isocan#release setup`. And phase 13.5's own unproven half —
that Scene 0's three steps, *run*, produce a canvas — **is now proved**, by
phase 14 against isocan.io. `development.md` has since been walked too — that
was 10.5's, it belonged to Paul and Dion rather than to a session, and they did
it.

The launch-first order set 2026-08-24 by Dimitri ran 10.3 → 10.5 → 13.5 → 13.7
→ 14, and has arrived. The cut line was the journey's own built/unbuilt
boundary: Scenes 0–5 shipped and proven, Scenes 6–7 the entire unbuilt
remainder, so launching first shipped exactly the journey that exists. The
two-surfaces problem phase 10 surfaced still has its address — the airplane arc,
phases 12.5 and 12.7. This line moves as phases close; a clean session starts by
believing it.

**Deliberately open.** Things decided *not* to decide yet, kept here
rather than in a phase because they belong to no phase's Proof and would
otherwise be discovered instead of chosen. A clean session should read
this list, not act on it: each entry is open because acting tired on it
is how it goes wrong.

- **Whether `direct` should be the DEFAULT, opened 2026-08-29 by Dimitri
  (phase 11).** Phase 11 built the switch; which way it points when nobody
  has said is `DEFAULT_MODE` in `packages/cli/src/direct.ts`, one line, and
  it is `daemon` today only because nothing has earned the flip yet. **The
  case for flipping is stronger than it looks.** The daemon's headline
  justification is offline, and offline has never worked for the CLI —
  `HomeUnreachableError` refuses a replica's CLI write when the home is
  unreachable, deliberately, and says so; phase 12.5 is the unpaid debt to
  fix it. Writes forward synchronously to the home's single-writer pipeline
  either way, so the replica **adds** a hop rather than removing one; only
  reads are served locally. And a machine with no CLI replica has exactly
  ONE replica — the browser's, from phase 10 — instead of two that cannot
  see each other, **which is the entire premise of the local-bridge debt
  below**: flipping this would retire phase 12.7, its Private Network
  Access dependency and its failure-mode list, by deleting the thing they
  exist to reconcile. **What it costs** is the airplane thesis, converted
  from a debt into a decision: "a person in the browser and their agent in
  the terminal, one canvas, no network" becomes impossible-and-honest
  rather than half-built-and-silent. Plus fast reads and the on-disk blob
  cache. **What stops it being unconditional:** a machine that IS the home.
  A locally-born canvas needs a daemon to hold it, so the honest
  formulation is *direct when the canvas lives elsewhere, daemon when this
  machine is the home* — and since phase 14 the first is the common case.
  **Open because the evidence is a real session, not an argument**, and
  because flipping it must follow phase 14's care exactly: consulted at
  `setup`, never under a machine that already holds canvases, with a
  receipt and `isocan direct --clear` as the way back.

- **The local bridge, opened 2026-08-24 (phase 10).** Phase 10 gave the
  browser its own replica and queue, and in doing so made visible that a
  machine now has **two** replicas that cannot see each other: the tab's,
  and the daemon's. Offline they queue separately toward a home neither
  can reach. The design — the tab reaching its local daemon through a
  same-origin bridge frame, so the agent and the browser share one
  replica — is written up in
  [local-bridge.md](local-bridge.md) and is **deliberately
  not chosen**. It is open because it trades against three things this
  project holds on purpose: the one-origin rule, "the daemon never serves
  pages to persons", and `home-link.ts`'s refusal to half-build an offline
  queue. Choosing it means the daemon learns to queue (which phase 13
  wants anyway), a browser-policy dependency on Private Network Access,
  and a framing policy the daemon does not have today. Whoever takes it up
  should read the failure modes section first: this makes the local daemon
  a dependency of the browser experience, and a tab silently falling back
  to a *stale* daemon would be the cheerful-wrong-address bug in its worst
  form yet. **Scheduled 2026-08-24:** the airplane arc — phase 12.5 builds
  the queue, phase 12.7 the bridge, both post-launch; this entry stands
  until the full design is written and the browser hypotheses measured,
  which gate 12.7.

- **Canvas or project — CLOSED 2026-08-24 (phase 13.5).** Kept here as a
  headstone rather than deleted, because what it decided still binds. The
  product was a canvas in 160 doc mentions and a project in 712 lines of code;
  the rename landed in phase 13.5 as its own commit, at the moment the entry
  named — the first outside reader. **What renamed:** every identifier, type,
  file, CSS class, CLI verb (`isocan canvas`, with `project` a hidden alias),
  help string and doc. **What did not, and never will without a migration:** the
  op type strings `project.*`, the `/api/projects` routes, the
  `.isocan/project.json` marker, the on-disk `projects/<id>/project.json`
  layout, the `prj_` id prefix, and the two `CanvasState` field names. Each is
  commented at its site. The URL settlement from 2026-08-23 stands unchanged —
  `/p/`, one address, no `/c/` alias — and the catch-all that made a wrong one
  legible shipped in phase 7. **The one thing this entry did not foresee** was a
  sixth category: persisted and wire JSON *keys*, which are neither a route nor
  an op string. Those DID rename, deliberately, and the break is real — see
  phase 13.5's findings.
- **The GC schedule — CLOSED 2026-08-24 (phase 13.7).** Kept as a headstone,
  because what it decided still binds and because the *shape* of the answer is
  worth more than the answer. **Chosen: the in-process timer**, plus
  `POST /api/gc`; the map's line is redrawn and `infra/91-scheduler-gc.sh`
  creates nothing, now permanently rather than pending. Cloud Scheduler was
  **refused, not deferred** — the door admits badges and a cron cannot hold
  one, and both ways to give it one (a long-lived robot key, a second carrier
  at the door) buy a standing risk for a chore. **The one thing the entry did
  not foresee**, and the finding below is the real lesson: choosing a timer
  makes the *instance's lifetime* part of the mechanism, and dev runs at
  `MIN_INSTANCES=0`. The original text below is left standing because it is
  the argument, and because "not urgent and not load-bearing" is still true.

  Nothing schedules
  garbage collection at the hosted home, on purpose;
  [`infra/91-scheduler-gc.sh`](../../../infra/91-scheduler-gc.sh) creates
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
  the [map](../../architecture.md)'s GC line**, which today promises a
  mechanism the code cannot perform. **Scheduled 2026-08-24:** the
  in-process timer, in phase 13.7, with `POST /api/gc`; the entry stands
  until the map's line is redrawn there. **Redrawn 2026-08-24** — see the
  headstone above.

## Standing lessons

A dozen-odd things the phases taught more than once, hoisted out of whichever
phase taught them first — each was re-learned somewhere the earlier telling
could not reach, and a lesson retold once per phase reads as trivia.
Bracketed numbers are the phases that taught it.

- **This system's default answer to a wrong address is a cheerful one**
  [5, 6, 7, 7.5, 8, 9, 10.5, 13.5, 13.7, 14]. `/healthz/` returns the app shell
  at 200; `/c/<id>` renders blank; a refused socket is indistinguishable from a
  network blip; an unmatched `/api/` path returns the web app, so version
  negotiation with an older home works only because HTML fails to parse as JSON;
  a provisioning call on the wrong path got an HTML 404 whose body held no
  `"error"`, and the check passed; `dev.isocan.io/__/auth/action` answered 200
  with the app shell while being shopped as a sender domain, which would have
  swallowed a sign-in code; and the first `.webp` this tree ever served went out
  as `application/octet-stream` and RENDERED anyway, because Chrome sniffs an
  `<img>`. **A step that cannot read back the state it wanted has verified
  nothing** — and there are three sharper forms, each learned later than it
  should have been. **An instrument can be cheerful too:** `returnOobLink`
  reported the old sender domain twice while real mail already carried the new
  one. **A mechanism that cannot fire looks exactly like a mechanism with
  nothing to do:** an idle sweep is silent *by design*, so the only honest proof
  is to hand it something to collect and watch the bytes leave; its sibling is a
  rate limit keyed on the socket address, which puts the whole internet in one
  bucket behind a load balancer and refuses every visitor at 429, looking
  precisely like a limit that works. And sharpest, **the instrument itself was
  cheerful:** `Fastify({})` hands back a logger whose `warn` is
  `function noop () {}`, so every deliberate log line the server ever wrote went
  nowhere — code that reads exactly like logging, under a comment explaining
  what the logging is for, emitting nothing. **When a mechanism's only evidence
  is an instrument, the instrument needs its own proof**, and a spy installed on
  a no-op proves nothing.
- **A guard nobody watched fail is decoration** [6, 10.5, 13.5, 13.7]. They ship
  green, which is the point: three regression tests written after their fix and
  passing against the bug, an image guard matching `img` as an element token, a
  "both halves" case asserting two fields of three, two security cases the URL
  parser was passing on the code's behalf, and a no-third-party guard reading
  rendered markup while webfonts arrive as `url()` in a stylesheet. The
  companion is **a fixture built by today's code cannot see yesterday's
  machine**, which is how phase 10.5's migration bug reached a rig with a full
  green suite behind it.
- **A comment that reasons about a runtime it cannot see is a hypothesis**
  [2, 8, 9, 10, 13.7].
  Wrong twice by not measuring: the blob route held open four phases on a
  cookie argument about a different request, and a service worker argued into
  runtime-caching-only. What a browser *refuses* is equally unprovable in an
  automated tab — Chrome blocks the clipboard while `visibilityState` is
  `hidden`. Infrastructure reads the same way: "the sweep would never fire in
  production" was reasoned from a comment and written into three documents,
  with the uptime check that refutes it sitting in the next file.
- **A guard written as a predicate over a list says yes to the empty list**
  [6]. `[].every()` is vacuously true, and a resume check built on it told a
  client it was current with four ops missing.
- **A proof is what was measured, and by whom** [5, 6, 7, 8, 9, 13.5]. "Two Chrome
  profiles" was two cookie hosts on one profile; "two machines" was two
  `ISOCAN_HOME` directories on one host. Each proves something narrower than
  its sentence, so each says so — and a phase that can prove half its outcome
  states which half. A **control** is what separates a regression from a
  standing bug: removing a snapshot loses a canvas on pre-rename code too, so
  what looked like a data-loss report was the seam all along.
- **An unnamed flake is one nobody can fix** [7, 8, 10]. It cost three phases,
  and was solved not by remembering to capture output but by CI, which is
  merely slower than this machine and had been printing the name for hours.
- **Removing an accidental capability is cheap; finding what stood on it is
  the work** [7, 8]. Narrowing enumeration broke replicas outright and exposed
  two shipped arrivals living off it; the suite found all three callers in one
  run.
- **A rule the build can check is a rule; anything else is a hope** [1, 7].
  `store.ts` imports one type, so it structurally cannot reach `FileStore`; a
  test greps every source file for a hand-built canvas URL, and found three.
- **An honest leaky seam beats a speculative clean one** [1, 2, 9]. Three
  file-shaped methods crossed the `Store` seam named as debts;
  `BadgeRecord.attestations` was refused as an always-empty array and earned
  seven phases later; an `Attester` interface with no implementations was
  written and deleted inside one phase.
- **A fix that falls out as a side effect is a fix that ships untested** [2].
  The first test for one was a tautology that never removed a claim. Relatedly,
  a proof written as "no test edited" means "no test *rewritten*".
- **When a capability looks like it must be compiled in, check whether what
  actually varies is an input the code already needs** [9].
- **Local timing wins races the internet loses** [6, 7.5, 8]. A claim that won
  over loopback lost across the wire, invisible to every local test; a dev walk
  is worth most where the home holds state a scratch daemon cannot fake; and a
  test placeholder naming a real host is a placeholder only until the code
  learns to dial it.
- **A sticky failure status is not a stuck state machine** [5]. The only
  evidence a retry is not coming is a retry that has already not come. Sibling
  shape: when the manual and automatic paths disagree, it is usually the
  automatic one that is wrong and the manual one quietly confirming an ordering
  it does not share.

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

- **2026-08-22 — Open:** `getBlob`'s `{ path }` and the whole blob index still
  cross the `Store` seam, and `Engine.gc` drives the read-modify-write from
  above it.

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

- **2026-08-22** — Badge ids stay out of envelopes, so claims cannot be
  replayed: the public registry replays, the claims table is desk state. Two
  ledgers is a constraint, not a preference.
- **2026-08-22** — `prune()` is retired, because expiring a claim now expires
  authorization. The price is that names are never freed.
- **2026-08-22** — The lost-badge recovery route is key-scoped on purpose; a
  home-wide answer is an impersonation aid and a roster leak at once.

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

- **2026-08-22** — Admissions are earned per visit, so a badge that has been
  nowhere has an *empty* name scope — more permissive than the home-wide walk
  it replaced, not less. `actor.claim` names the canvas it is made from, and
  phase 7 admission-checks it — without that, "is this name taken here" probes
  a room you were never let into.
- **2026-08-22** — The presence check sits off the single-writer chain, because
  `putBlob` is on that queue and a 30 MiB upload would stall every cursor.
- **2026-08-22** — Scope the colour broadcast by presence and a rename stops
  reaching the rooms an absent author's comments live in. "Appears" is history
  **and** presence.
- **2026-08-22** — The desk seam needs four queries, and a CloudDesk that fails
  to write the three denormalized arrays passes on a FileDesk and answers
  nothing in the cloud.

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
[map](../../architecture.md) now names on the badge document. A CloudDesk that
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

- **2026-08-22** — Compaction retains a *set* with holes, so it advances
  `compactedThrough` **and** marks dropped documents: the horizon bounds the
  read, the mark makes it exact. Without both, GC eats a live blob.
- **2026-08-22** — A soft-deleted canvas id is claimed forever in the cloud
  where a file home frees it — the backings' one genuine disagreement, pinned
  on both sides.
- **2026-08-22 — Open, partly discharged:** blob bytes, snapshots and range
  reads still run against an in-process double, and `GcsObjects` is executed by
  nothing but the signing path. Phase 5 discharged the three signing assertions
  against a real bucket; the rest of that surface is unproven.

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

- **2026-08-22** — `--max-instances=1` is per *revision*, so a rollout runs
  two; the create-only schema rather than the flag is what keeps one oplog
  honest. Measured: 150 ops across two rollovers, zero refused.

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
phase 13.5's, since the 2026-08-24 resequencing): solo is the multiuser
topology with one member, and
multi-device falls out — plus the lid-close beat:
tab and daemon each say "I have through N" and stream the tail.

**Proof:** Integration tests with two `ISOCAN_HOME`s against a home;
the lid-close/reopen beat played with Chrome and the CLI.

**Findings:**

- **2026-08-23** — A resume check needs completeness beside contiguity —
  `since + tail.length >= lastSeq`. A quiet canvas leaves nothing to self-heal.
- **2026-08-23** — A replica's oplog is a cache that starts where it joined,
  which is what makes "resumed rather than re-snapshotted" assertable.
- **2026-08-23 — Open, phase 13's:** a replica holds the canvas's state, not
  its history and not its bytes, so it looks complete right up until the home
  is gone — and re-homing would replay a store missing both.
- **2026-08-23** — A forwarded write holds the single-writer chain across an
  HTTP round trip, so the chain now serializes writes against **arrivals**,
  which this process does not control.
- **2026-08-23** — `healthPath()` is defensive rather than necessary: phase 5's
  `/healthz` measurement expired within a day, and what survives is that
  `/api/` is the one prefix the SPA fallback does not answer cheerfully.
- **2026-08-23 — Not verified:** `writer-fenced` 409 through the replica path,
  and a browser at dev driven against a replica.

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

- **2026-08-23** — Narrowing `GET /api/projects` to admissions **breaks
  replicas** — a fresh badge has none, so it never dials and nothing ever
  admits it. A link grant admits whoever presents the address; it does not make
  a canvas enumerable.
- **2026-08-23** — A replica needs its own grant rows, which no design doc
  considered; the local row deliberately does not inherit the home's
  revocation.
- **2026-08-23** — `/api/ops` admitted *after* the write for five phases,
  invisible while the check could not refuse. Wrong order is a no-op until the
  day it matters.
- **2026-08-23** — **4xx is about the request, so its message is safe to
  repeat; 5xx is ours and stays opaque.** Gate on `statusCode`, not framework
  codes.

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
serve pages — [offline-birth.md](offline-birth.md) already
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

- **2026-08-23** — `allocateName` builds its taken-set from admission-scoped
  queries, so a fresh replica allocates in an empty scope and the home refuses.
  The home is asked for a free name and the answer is a **preference, not a
  reservation**.
- **2026-08-23** — The fix reproduced the bug inside itself: `freeName`
  gathered scope with the *claim's* reach. `claimContext` has a **reach** now.
- **2026-08-23** — `Daemon.close()` never drained the writer chain, and
  `exitCode !== null` is null for a signal-killed process. Neither flake was
  fixed by lengthening a timeout.

## Phase 8 — Escalation (Scene 5)

**Status: CLOSED** 2026-08-23 (`370abf6` … `bca4222`). The scene played
against **dev.isocan.io** on deployed code, with a clean shell: the dialog
under Dimitri's own face at dev minted the pass, one pasted command put a
machine that did not exist ten minutes earlier onto the canvas as him, its
agent was handed a name free at the home, and `@Sonia` typed in the browser
at dev woke that agent **on the other machine** — her face in dev's facepile,
her cursor on the canvas, her reply back in the thread.

**Work:** Pass minting from an admitted session; the one-command setup
consuming `address#pass`; the redeemed badge born knowing its person;
`isocan open` appending a daemon-minted pass.

**Outcome:** Scene 5 plays: a thin guest goes thick in one command,
their agent claims its own actor, and a summons executes under their
roof.

**Proof:** The scene, played end to end against dev; vitest for pass
lifecycle (single-use, short TTL, named claim, admission-only form).

**Findings:**

- **2026-08-23** — **A credential in a `#fragment` is invisible to the one
  event a SPA relies on** — read fragments at load *and* on change.
- **2026-08-23** — `setup` refuses to overwrite a different person in
  `identity.json`; the browser overwrites. Two surfaces, two answers, because
  what stands behind the slot differs — do not "fix" it into consistency.
- **2026-08-23** — `?reach=admitted` is caller-stated because one route answers
  two questions; narrowing it wholesale would hide a person's own canvas from
  their own front page.
- **2026-08-23** — Removing enumeration exposed two shipped arrivals carrying
  an address and no admission; both ask by name now through
  `POST /api/home/join`.

## Phase 9 — The desk hardened: attesters and revocation ⚑ provision

**Status: CLOSED** 2026-08-24 (`211e893` … the commits below). Both halves
played, by the conductor, against the real dev Identity Platform project.
The sweep expels down a pass chain and **re-roots** what a surviving grant
still covers — measured `{expelled: 1, rerooted: 1}`: the stranger goes, the
person invited by name stays. The magic-link arrival and resumption were
driven in Chrome — a browser that had never been Jordan proved an address
and became her. The ⚑ provisioning is done: Identity Platform is live on
`isocan-io-dev` with all three attesters confirmed, magic-link as the floor
plus Google and GitHub, whose OAuth apps Dimitri created. `repo:` is
deliberately deferred to phase 11 with its refusal left honest.

**Work:** Firebase Auth wired as the borrowed bench (magic-link email
as the floor, Google, GitHub); attestations written onto badges;
`email:` and `repo:` grants; the provenance sweep with re-rooting;
kill-a-badge; person resumption across browsers. Provisioning: Identity
Platform enabled in the dev project. **`repo:` is deferred with a reason
and its refusal left honest** — see the finding; Google and GitHub are
enabled and verify identically, and what they lack is a button. **What revocation does not
reach, decided in phase 3:** the blob route is deliberately open — a
sandboxed HTML blob has an opaque origin and physically cannot carry a
badge, so the 256-bit content hash is the capability. That is sound
while admission is the only gate, but a sweep that expels somebody does
*not* expel the hashes they wrote down. Either accept it in writing as
the limit of revocation, or give blob URLs a short-lived token — but
decide it here, where expulsion is supposed to mean something.
**Decided 2026-08-24: neither — the route is CLOSED.** The premise was
measured and found false; see the Findings.
**Decided, 2026-08-23: the route is CLOSED** — the argument that held it
open turned out to describe a different request, measured in Chrome. See
the finding below and the comment on `isOpen`.

**Outcome:** Revoking Jordan's email grant expels tab, daemon, and
agent in one sweep; turning off the link stops strangers without
expelling the invited; a phone resumes its person by attestation.

**Proof:** Sweep and re-rooting in vitest; the magic-link arrival and
resumption driven in Chrome.

**Findings:**

- **2026-08-23 — Decided: the blob route is CLOSED.** The argument that held it
  open described a different request — the iframe's own load is issued by the
  parent page and carries the badge cookie. **Expulsion reaches the bytes**,
  and `Cache-Control` gained `private` so no CDN edge caches a credentialed
  response.
- **2026-08-24 — Decided: attesters are configuration, not a constant.** The
  verification ships in every build identically; what varies is the Identity
  Platform project `iss` and `aud` bind to. No compiled-in default.
- **2026-08-24 — Decided: `as:` needs a vouch** — a pass, or a shared
  attestation. **Left open on purpose:** the same session key still resumes
  without one, because that is the shipped lost-badge recovery. A session key
  is a weak vouch, an attestation a strong one.
- **2026-08-23** — A chain adopts its minter's **outcome**, not its stale root;
  a sweep in list order decided one person's two badges by an array.
- **2026-08-23 — Decided, not fixed:** turning the link off can expel the
  person turning it off, because exempting the revoker leaves a badge rooted at
  a revoked grant. The consequence is stated before the click.
- **2026-08-24 — CLOSED in 13.5 (dev) and 14 (prod):** the magic-link floor
  landed in **spam**, because Identity Platform sends from `…firebaseapp.com`
  with no alignment to isocan.io, and a sign-in link in spam is a person who
  cannot get in and cannot know why. The fix was a sender domain isocan owns —
  and a little code, since the sender must serve `/__/auth/action` itself.
- **2026-08-24 — Open, phase 11's:** `repo:` is deferred — it needs the GitHub
  OAuth *access* token, an outbound call on a request path, and a
  credential-custody decision nobody has made. A `repo:` grant cannot be
  written, so the refusal stays honest.
- **2026-08-24** — Signing in stays person-only, but inviting by name and
  reading a badge's proofs are CLI verbs: an agent that could only hand out the
  link would hand out more access than it was asked for.
- **2026-08-24 — Open:** the name-taken refusal ends in `--as` and `--new` in a
  browser. The remedy wants to be data each surface words for itself.

## Phase 10 — Offline in the browser

**Status: CLOSED** 2026-08-24. The tab survives its home: shell from the
service worker, canvas from a durable IndexedDB replica, writes queued and
flushed **before** the tail comes down. Actuated by the conductor with the
home stopped — a second writer was raced in first and the tab's offline op
landed *after* it, at seq 4, under the id it minted while offline; replaying
that id returned the same entry and appended nothing. Blobs offline are
deliberately deferred and fail with a sentence naming the file.

**Work:** The service worker: cached shell, durable browser replica,
ops applied optimistically and queued when the network is gone,
reconnect by the same seq cursor.

**Outcome:** A tab without a network keeps working; on reconnect its
queued ops land in the home's order before the tail comes down —
journey rule 6, physically true.

**Proof:** Chrome offline emulation, actuated: work offline, reconnect,
verify order and convergence on a second profile.

**Findings:**

- **2026-08-24** — **A service worker does not control the page load that
  registers it**, so runtime caching cached nothing on a first visit. At
  install it reads its asset URLs out of `/index.html` — the shell names its
  own assets.
- **2026-08-24** — Every creating op carries a client-minted id, so the
  vocabulary has been accidentally exactly-once from the start. The real damage
  is the **false refusal**: a replay is indistinguishable from a rejection, so
  honest rollback becomes a lie.
- **2026-08-24** — A dial that closes without ever being greeted counts as a
  failure, and two in a row says "offline"; "reconnecting" is truthful about
  the socket and wrong about the situation.
- **2026-08-24 — Open, filed:** nothing in the op vocabulary validates that a
  number is a number — `isocan mv --to 900,900` writes `x: null, y: null` into
  the oplog forever.

## Phase 10.3 — One daemon, many homes

**Status: CLOSED** 2026-08-24. Both halves of the Proof played. The
integration suite stands up one daemon over three canvases — one homeless, one
at each of two scratch homes — and asserts the negative as well as the
positive: each link's handshake count for the other's canvases is
`{resumed: 0, snapshots: 0}`, one home going down refuses exactly its own
canvas while the other two keep taking writes, and a twin offered under a
recorded id is refused rather than adopted. Then walked for real by the
conductor against **dev.isocan.io** on one daemon: two canvases born at dev
and one born local, `isocan home` reporting all three by name, `isocan share`
printing **two different origins from one machine**, an item written from the
terminal landing at dev at seq 2 while the local canvas 404s there, and in
Chrome the local canvas rendering at `127.0.0.1:4471` while the dev-homed one
at that same origin answers the signpost — with the front page listing only
the canvas this daemon is the home of. (Prod's half waits for phase 14, by
necessity.)

**Why now, and why it was always latent.** Three pressures arrived at
once, 2026-08-24. Dion's rig (phase 10.5) holds canvases born local
beside work that should live at dev. Every developer wants to run prod
isocan in one repo and dev isocan in another the moment prod exists —
and phase 14's default-address flip is only *safe* if a shipped default
cannot re-point existing work. And [innkeeper.md](innkeeper.md)'s
second commitment — any innkeeper, a team running its own home — always
implied a person working for two teams, which is two homes on one
machine. All three are the same fact: **the home is a property of the
canvas, not of the daemon** — which the marker has asserted since Scene
0 (it carries the address) and the configuration model has contradicted
since phase 6 (one `home` key, one connection, whole-daemon demotion —
the thing phase 7.5's scratch-home dance was self-defence against).

**Work:** The home-link generalizes from one connection to one per home
named by a served canvas's marker: repo A's marker says isocan.io, repo
B's says dev.isocan.io, and a marker with no address means this daemon
is that canvas's home — Dion's old canvases, unchanged. Credentials
become per-home (a badge is one home's recognition; the daemon carries
one per home it dials). `isocan home` survives re-scoped, not reversed:
it sets the **birth default** — where `isocan setup` births a canvas
absent an explicit address — and reports, per canvas, who answers
where; phase 7.5's refusal of a per-invocation `--home` flag stands,
because a marker is committed configuration, not a flag. `npm run
dev:replica`'s reason to exist mostly dissolves — one daemon can serve
a local-home canvas and a dev replica side by side — and what remains
of it is phase 10.5's doc's job to describe.

**Outcome:** One machine, one daemon; canvases at prod, at dev, and at
home itself, all served concurrently — and a shipped default address
can never re-point existing work.

**Proof:** Integration: one daemon serving three canvases — one
homeless, one at each of two scratch homes — every write flowing to the
right home and refused across lines. Then walked for real: a canvas at
dev beside a locally-homed one, one machine, one daemon. (Prod's half
of the walk waits for phase 14, by necessity.)

**Findings:**

- **2026-08-24** — The sweep's "every canvas on this disk is this home's" was a
  data-loss bug waiting for a second home: two homes can hold one canvas id, and
  the wrong one answers a dial with a snapshot that overwrites the local copy.
- **2026-08-24 — Open, and it reversed the design:** the two-home name flap does
  not self-heal — the roster overwrites a rename before `ensureClaim`'s cache
  can see it, and a one-home control shows the identical flap, so the seam
  predates this phase. The fix is timestamps on the wire.
- **2026-08-24** — A home-scoped question with no canvas in it has no honest
  answer on a mixed rig, and the code's instinct was the **local desk**: a
  plausible, wrong ledger, in silence, about a credential. Refused with
  `ambiguous-home`; a pass escapes because it arrives as `address#pass`.
- **2026-08-24 — Open:** the badge and attest routes still have no home to name,
  so on a mixed rig with no birth default they are refused rather than answered.
  The fix is the pass's: let the request carry its home.
- **2026-08-24 — Open:** a canvas created from the web front page is born at the
  birth default, so it never appears in the `?reach=here` list it came from —
  the button looks like it silently failed.
- **2026-08-24** — A React page cannot ask "is this canvas mine" inside its own
  render: the mount effect dials and opens the replica before any conditional
  render can undo it. The check is a **gate in front of the page**.
- **2026-08-24** — A raw NUL byte makes a source file non-text and **`grep`
  skips it in silence** — in a repo whose own tests grep its sources. Write the
  escape, never the byte.

## Phase 10.5 — Two doors into the repo

**Status: CLOSED** 2026-08-29 — **the two walks happened**, reported by Dimitri.

That is the whole of what this phase was still waiting for, and it was never
something a session could supply: the conductor had verified that every command
in `docs/development.md` works, and could not verify the one property the doc
exists for — that it is legible to somebody who has not read this codebase.
Only Paul and Dion could answer that, and only once each.

**No findings are recorded from either walk, and that is a gap rather than a
result.** The Proof below says every out-of-band question either of them asks
is a finding; none reached this document. Read the empty list as *not
captured*, not as *none arose*. Both instruments are consumed on first use —
after one walk each is an insider — so if either of them asked something the
doc did not answer, this is the last moment it can be written down.

**What was already done, 2026-08-24:** `docs/development.md` is written, both
doors and the common matter, and every command in it was run rather than
remembered — a scratch clone and a scratch `ISOCAN_HOME` for Paul's door, a
reconstructed pre-multiuser rig for Dion's. The dev deploy gates on CI green:
`release.yml` fast-forwards a `green` ref once `npm test` and `npm run
typecheck` pass with the emulator required, and `infra/95-build-trigger.sh`
watches `^green$`.

The ⚑ is **done**: authorized by Dimitri and applied the same day, the live
`isocan-dev-deploy` trigger watches `^green$`, read back and verified — one
trigger, and `_DEPLOY` still the string `"yes"` rather than a YAML boolean,
which is the difference between deploying and reporting success while deploying
nothing.

**What is missing is the doc's own Proof: the two walks themselves.** It names
Paul and Dion, and a proof is what was measured and by whom — the conductor
verified that every command works, and cannot verify that the doc is legible to
somebody who has not read this codebase. That half is their first run, and every
out-of-band question either asks is a finding.

**Work:** `docs/development.md`, written for the two developers who
actually exist rather than an abstract one. **Dion is not new** — he has
been landing changes all along, from a rig built before multi-user: a
local daemon serving pages the old way, canvases born local with no home
in their markers. His door is the **upgrade**: what current main does to
that rig — the daemon that stops serving pages to persons (phase 6
closed that door behind him), `isocan home` and the replica/home duality
(working on the web UI needs a local home, working on the home needs a
replica — phase 7.5 called that inherent, and phase 10.3 softens it),
and the fate of his pre-multiuser canvases: under 10.3's model they
keep working, his daemon their home, unchanged — what stays phase 13's
is moving them *to* a home (adoption) — and the doc says which is which
plainly rather than cheerfully. **Paul is new** — clean machine, nothing
installed. His door is the fresh entry: `git clone` to a running dev
setup to a canvas of his own at dev.isocan.io. Both doors share the
common matter: the clean-shell discipline (`isocan home`, never an
exported `ISOCAN_*`), the conductor model as a human runs it, the hazard
list (a working daemon pointed at dev by accident; `/api/healthz`, never
`/healthz`), and one decided sentence about provisioning access — who
holds GCP on `isocan-io-dev`, and whom a conductor's ⚑ asks. Beside the
doc, one change: **the dev deploy gates on CI green** — Dion is already
pushing, so deploy-on-push already means either developer can take down
the other's dogfood home with a commit that compiles but does not boot,
and CI is already the machine that catches what local timing hides.

**Outcome:** The repo is enterable through either door by somebody who
has read nothing but the doc, and dev.isocan.io survives having more
than one developer pushing.

**Proof:** Two walks, each proving what only its walker can — a proof is
what was measured, and by whom. Paul, on a clean machine, goes from
`git clone` to a canvas of his own at dev following only the doc. Dion,
on his existing rig, follows only the upgrade section, ending with his
daemon a well-behaved citizen of the new world and his old canvases'
status stated by the doc rather than discovered. Every out-of-band
question either of them asks is a finding. Both instruments are consumed
on first use — after one walk each is an insider — which is why this
phase runs now rather than letting the knowledge trickle in over Slack.

**Findings:**

- **2026-08-24 — A machine that predates a file cannot be reconstructed by a
  process that always creates it.** 10.3's migration armed on the absent
  `homes.json`, but birth writes a row and disarms it — so the first
  `isocan home` on an older rig froze every locally-born canvas.
- **2026-08-24** — One rule, disagreed with in three places: the migration,
  `pureReplica` and `GET /api/homes` each read "absent means `null`"
  differently. Each defensible alone; together, one invariant nobody enforced.
- **2026-08-24 — Decided:** a configured home is **not** evidence a machine was
  ever a replica — `isocan home` writes `config.json` before the first dial. The
  evidence is a **badge at that address**, which fails toward "this is mine".
- **2026-08-24** — Phase 6's `/healthz` hazard has narrowed: through the load
  balancer, `dev.isocan.io/healthz` returns the daemon's own body. The rule
  stands for a bare `*.run.app` address, which Google swallows.
- **2026-08-24 — Repointing a Cloud Build trigger:** `provision.sh` cannot (it
  exits early when one exists, and deleting forces the browser step that
  rebuilds the GitHub App connection), and `triggers update github` refuses a
  first-generation trigger with `INVALID_ARGUMENT`. `triggers import` with the
  `id` kept updates in place.
- **2026-08-24** — `_DEPLOY: yes` unquoted in an imported trigger is a **YAML
  boolean**, and `cloudbuild.yaml` tests `!= "yes"` — a pipeline that builds,
  pushes, reports success and deploys nothing. `--format=json` is the only
  rendering that shows which is stored.

## Phase 13.5 — The front door ⚑ provision

**Status: CLOSED** 2026-08-24 (`3344d42` … `ef04b68`). Two of the three
proofs played in full and the third played in half, which this doc requires be
said rather than rounded up. The front page is live on dev and was met by
Dimitri from a private window — a profile that had never seen isocan — wearing
Scene 0's three steps instead of a name prompt. The magic link arrived **in an
inbox**, from `noreply@dev.isocan.io`, through a handler this repo now serves
itself. The rename is green at 1321 tests with project-vocabulary gone from
everywhere a stranger reads. **The half not proven:** "three steps, a canvas"
— that the steps, *run*, land somebody on a canvas. Nobody had run them. That
was not a second debt, it was phase 10.5's Paul walk wearing this phase's
words, and it stayed there rather than being counted twice. **It was paid
there, 29 Aug 2026**, when Paul walked the doc.

**Work:** The front page — the home origin wearing Scene 0's three
steps, built and proven against dev; split out of phase 14 exactly as
its old note predicted, now that launch-first makes the door the head of
the train rather than the tail. Scene 0 is a thread through phases 6,
10, this one and 14: phase 6 made its shape true, phase 10 made its tab
durable, this phase gives it a door, and 14 gives the door its real
address. With it, the two pieces of work whose deadline is the audience
itself. **The rename** — settled 2026-08-24 (see Deliberately open):
launch is the moment the canvas-or-project trigger fires, the first
outside reader, so `projectId` and its seven hundred friends become
canvas vocabulary here, as one mechanical commit of its own so it buries
nothing — the last moment the rename is free. **The sender domain** —
phase 9's spam finding: SPF/DKIM alignment so the magic-link floor lands
in inboxes; DNS on isocan.io, nothing in prod. ⚑: the DNS records and
the Identity Platform sender configuration.

**Outcome:** Scene 0 is enterable against dev by somebody who has read
nothing — and every proof after this phase is played through the same
door a stranger would use.

**Proof:** The front page driven in Chrome from a profile that has never
seen isocan: three steps, a canvas. A magic link that arrives in an
inbox rather than spam. The rename proven by the suite, green, and by
`grep` finding project-vocabulary nowhere a stranger reads.

**Findings:**

- **2026-08-24** — The spam fix is code as well as DNS: the provider moves the
  From: address and the action-link domain together, so the sender domain must
  answer `/__/auth/action`. The daemon serves it.
- **2026-08-24 — Decided: no second origin.** `auth.isocan.io` on Firebase
  Hosting was the researched answer and was refused — a sign-in link on a
  different hostname than the product puts the badge cookie, the service worker
  and the browser replica behind two doors. Firebase Hosting turns out not to be
  required for a custom sender domain.
- **2026-08-24** — An open redirect was one parser quirk from shipping: an
  unknown scheme is not "special", so `continueUrl=foo:\\evil.example/x` keeps
  its backslashes into `pathname` and resolves off-site with a live `oobCode`.
- **2026-08-24 — A sixth contract category nobody had listed: persisted and wire
  JSON KEYS**, as distinct from routes and op strings. `OpEnvelope.projectId`
  and its siblings renamed — **decided by Dimitri: take the break now**, while
  the audience is three people, and make it legible: 426 with the upgrade
  command, because it failed on write with `internal error`.
- **2026-08-24** — Namecheap's MX and SPF are **not** host records: they are
  synthesized by `EmailType=FWD`, so a `setHosts` that omits it deletes email
  forwarding and the SPF with it, invisibly.
- **2026-08-24 — Open, narrowed:** two `v=spf1` records on one name is a
  **permerror**, not a merge, so the apex cannot carry both Firebase's and the
  forwarder's. Measured 2026-08-25: the apex holds exactly one, Firebase's,
  with MX still pointing at the forwarders — the permerror is gone and
  `@isocan.io` forwarding now runs with no SPF of its own. Subdomains do not
  collide, which is why dev never saw this.

## Phase 13.7 — The innkeeper's obligations

**Status: CLOSED** 2026-08-25 (`f7289a9` … the correction commit below). All
three proofs played in full, each measured by the conductor rather than
reported. A mint flood against a real daemon is refused 429 `too-many-badges`
with a `Retry-After`. `/terms` answers 200 `text/html` **from dev**, with every
required claim — the caveat included — grepped out of the bundle the origin
actually serves, because both cheaper checks are cheerful: `/api/gc` answers
401 for any unmatched `/api/` path, and `/terms` answers 200 because the SPA
fallback answers every unmatched GET. And **the sweep was observed on dev**,
unprompted, at `01:33:36Z`: `GC swept 1 blobs (69 bytes) … across 10 canvases`,
an hour and two seconds after the boot sweep, with `startedAt` unchanged — so
the same process swept itself on its ordinary tick. Corroborated two other
ways: the blob went 404 and a dry run reported nothing left. `POST /api/gc` was
exercised against the real Firestore/GCS backing at the same time, which no
vitest run touches — including the empty answer for a badge admitted to
nothing.

**Work:** What [innkeeper.md](innkeeper.md) obligates and no
phase ever owned, due before strangers rather than after. **GC,
chosen:** the in-process timer from Deliberately open — no scheduler, no
credential, no new kind of caller at the door — plus `POST /api/gc`,
wanted either way; the map's GC line is redrawn in the same change.
**Metering:** badges are free to mint, and free may not mean unmetered —
rate limits at the door; quotas stay tuning. **The words:** terms, the
plain privacy statement — the operator can read your canvas; run your
own home if that is unacceptable — a named operator, and the sovereignty
caveat stated honestly: sovereignty by replica is already fact
(`~/.isocan` holds the full store), while re-homing as one command is
phase 13's and launches later.

**Outcome:** The home can host strangers without an unstated obligation,
and the map's GC line tells the truth.

**Proof:** The sweep runs on the timer in vitest and is observed on dev;
a mint flood is refused legibly; the terms page is served from the
origin, caveat included.

**Findings:**

- **2026-08-24** — A timer inside a scale-to-zero process has the **instance's
  life** as its clock, not its interval: the first sweep was an hour away
  against `MIN_INSTANCES=0`. Fixed with a sweep a minute after boot; CPU
  throttling was not the cause and is the first thing anyone will re-suspect.
- **2026-08-25 — correcting the line above.** "It would never have fired in
  production" was reasoned from a comment and written into three documents
  before anybody read `infra/92-uptime-check.sh` sitting next to it — it pings
  dev every 300s, so the instance never idles. Measured: 63 minutes, swept on
  its own. The boot sweep still earns its place, for a home with no heartbeat.
- **2026-08-24** — The door hook admits by **path shape**, so a route with no
  canvas in its path gets no admission check at all. `POST /api/gc` re-asks the
  door's question itself; every home-wide route a later phase adds inherits
  this.
- **2026-08-24** — Proving the home-wide timer fires needs a genuinely aged blob
  — it runs GC's real defaults, so a test passing `graceMs: 0` proves a sweep no
  home performs.
- **2026-08-24 — CLOSED 2026-08-25 in phase 14:** `--ingress=all` leaves the
  `*.run.app` URL reachable around the load balancer, where the entry the meter
  keys on is caller-supplied. Prod runs `internal-and-cloud-load-balancing`; dev
  stays open.
- **2026-08-24 — CLOSED 2026-08-25 in phase 14:** the meter's forwarded-chain
  model was read from Google's docs, never measured, and `ISOCAN_PROXY_HOPS` was
  named only inside `meter.ts`. Measured, the chain is as documented and the
  knob stays unset; `config.sh`, `70-cloud-run.sh` and `infra/README.md` now
  declare it beside the collapse signature — refusals climbing while distinct
  keys sit at 1.
- **2026-08-24** — On a pure replica `/terms` signposts to the birth home rather
  than serving, so "the terms are served from the origin" is a claim about a
  **home**, not about every daemon.

## Phase 14 — isocan.io ⚑ provision

**Status: CLOSED** 2026-08-25 (`00a945e` … the commits below). **Scene 0 played
from scratch on the real address**, and every step of it was measured by the
conductor rather than reported. A directory with an empty `~/.isocan` beside
it; `npx github:dglazkov/isocan#release setup` — the copy a stranger's npx
fetches, not this checkout — wrote `{"home": "https://isocan.io"}` and came
back *"replica of https://isocan.io — ops to CLIs, pages at the home"*; a
canvas made on that machine was born AT the home, which was confirmed from the
outside by reading it off isocan.io with a badge minted at the door; the front
page served the three steps over the real certificate; the canvas opened at
`isocan.io/p/…`, and the browser naming itself **Priya** was refused by name
because the CLI on the replica had already claimed that actor at the home —
one desk, two surfaces, proved by a collision nobody staged. Then an item
written from the terminal on the replica appeared live in that tab.

Everything is provisioned: `isocan-io-prod` with its own Firestore (us-west1,
PITR), buckets, service accounts and registry; Cloud Run at `min-instances=1`;
the load balancer at the apex with the A record in the zone; nightly Firestore
export, run once to prove it; an uptime check with an alert; Identity Platform
with magic-link, `isocan.io` authorized and its attester wired in. **The
promotion gesture was played end to end** — the `prod` tag fired the trigger,
the build deployed, and the service came back with ingress and every
environment variable intact, because `cloudbuild.yaml` moves only the image.
The ingress bypass was DEMONSTRATED against prod's run.app URL before the flag
closed it, then re-checked afterwards: that URL now answers 404 to everything
while the domain answers 200. Prod's sign-in mail was finished the same day and
is a finding below — a real magic-link sign-in played through at isocan.io,
which proves phase 9's attester loop on prod as well. One debt remains, not
load-bearing for anything: the badges minted while demonstrating the bypass are
still desk rows.

**Work:** Stand up `isocan-prod`; the domain; the `release`-branch
promotion; flipping the default home address from unset to isocan.io
(phase 7.5 says why it stays unset until here — and the flip is safe
only by phase 10.3's model: a shipped default is a *birth* default,
markers pin every existing canvas to its home, so flipping re-points
nobody's work). Slim now: the front door
went to phase 13.5 and the obligations to 13.7 — the split this phase's
old note predicted, executed by the 2026-08-24 resequencing. **One cost
that resequencing chose, written here so no session rediscovers it as a
surprise:** phases 12 and 13 now add their persistent structures —
registrations, custody-wrapped tokens, adoption state — after prod
exists, so they land as migrations under strangers rather than
greenfield. Chosen eyes-open: the desk has migration precedent from
phase 2, and early-prod data is small.

**One errand inherited from 13.7**, provisioning-shaped, which is why it waited
for the phase that provisions. `--ingress=all` leaves the `*.run.app` URL
reachable around the load balancer, and the door's meter keys on a forwarded
chain that path does not produce — the rate limit's real bypass.
`--ingress=internal-and-cloud-load-balancing` closes it and has its own blast
radius, so it is a decision made out loud here rather than a fix slipped in
there. Note also that prod's `MIN_INSTANCES=1` changes which half of GC's
rhythm does the work: an always-on instance lives on its hourly tick, and the
boot sweep becomes merely the cheap first one.

**Outcome:** Scene 0 plays for real: a clean machine, isocan.io, three
steps, a canvas born at its hosted home.

**Proof:** The scene, played from scratch, on the real address.

**Findings:**

- **2026-08-25 — The instrument phase 13.7 built was writing to nowhere, and had
  been since it was typed.** `Fastify({})` with no `logger` key gives
  `abstract-logging`, whose `warn` is `function noop () {}` — so every `app.log`
  call in the server was silent, including the refusal line added precisely to
  be visible at 3am. Logging is on at `warn` now, pino's level mapped to
  Google's `severity`; the guard asserts `log.warn.name !== "noop"`.
- **2026-08-25** — The bypass was **demonstrated before it was closed**, the
  only honest way to justify a flag with a blast radius: against prod's run.app
  URL, with the honest socket bucket already refusing at 429, eight invented
  `X-Forwarded-For` values each minted a badge.
- **2026-08-25** — A locked ingress makes **stage order** load-bearing: it may
  only be set on a home whose load balancer exists, so a brand-new prod runs
  stage A once with `ISOCAN_INGRESS=all` and re-runs `70-cloud-run.sh`
  afterwards. The script asks the domain rather than the run.app URL whenever
  ingress is not `all`.
- **2026-08-25** — `gcloud projects describe` cannot tell "no such project" from
  "the resolver is down": a DNS outage had `60-build-image.sh` refuse about a
  project created twenty minutes earlier. Recorded rather than fixed, because
  the direction is safe.
- **2026-08-25** — `80-load-balancer.sh` creates the certificate before it can
  tell you the IP, which is the only order it can — so Google's first validation
  always runs against a domain that does not resolve yet, and on isocan.io it
  stuck at `FAILED_NOT_VISIBLE` rather than retrying into success. A managed
  certificate cannot be re-validated in place: **prod's is `isocan-cert-2`
  forever**, and `prod.env` names it.
- **2026-08-25** — Prod's magic-link mail sent from `firebaseapp.com`, unaligned
  to isocan.io — a stranger's first sign-in email, likely in spam. **CLOSED the
  same day** by the only check that counts: not the console's "verified" (13.5's
  instrument said that twice while lying) but a real sign-in played through to a
  badge PROVED in a browser at isocan.io.
- **2026-08-25 — Namecheap's API takes host names RELATIVE to the domain, and
  the Firebase console emits FQDNs**, so a pasted
  `firebase1._domainkey.isocan.io` becomes `…isocan.io.isocan.io` and fails
  verification in a way that reads as the provider's fault. `setHosts` also
  replaces the entire zone: every write is read-all-then-send-all.
- **2026-08-25 — A single `dig` is a sample, not a state.** `8.8.8.8` answered
  the apex TXT from a SPLIT CACHE for half an hour, so identical queries
  disagreed and a watcher exited on a condition its own readback contradicted.
  Check repeatedly and require agreement — a Verify clicked into a stale answer
  is how the certificate came to be named `-2`.
- **2026-08-25 — Open:** the ~60 badges minted while demonstrating the bypass
  are real desk rows on a brand-new prod — anonymous, admitted to nothing, and
  there is no bulk revoke. Recorded so nobody reads prod's first badge count as
  organic.

---

**After launch: the features.** Everything below ships into a live
isocan.io through the release promotion, and its order returns to being
a hypothesis — real users get a vote on whether the spark or the
airplane matters more. Two arcs are gated on design work that is
session-shaped rather than phase-shaped, the way identity-desk.md and
innkeeper.md were written: `projects/launch/design.md` and its dispatch spike
before phase 12; the completed local-bridge design, its Chrome spike,
and the journey's missing airplane scene before phase 12.7.

## Phase 11 — The thin agent (Scene 6)

**Status: PART-DONE (2026-08-29).** The mechanism is built and unit-proved:
`--direct`, `ISOCAN_DIRECT`, `config.direct`, the `setup` decision, the
daemon-verb refusals and `isocan direct` itself, with
`packages/cli/test/direct.test.ts` asserting the negative that matters — no
daemon is ever started and no store is ever written. The lap was driven by
hand against a scratch home: name, create, list, park, wake, reply. **What
is missing is the Proof as named** — Scene 6 in a real cloud workspace,
against a real home — and the kill test came back with a finding rather
than a pass (below).

**Work:** Setup notices what it stands on — headless, ephemeral, home
address in hand — and skips the daemon; the CLI speaks straight to the
home; `isocan wait` parks at the home itself. **And the door the scene
opens with:** "Run an agent in the cloud…" under your own face, beside
Scene 5's "Bring your own agent…", handing over the line Inna pastes.

**One decision waits at this phase's door, put there on purpose.**
Phase 9's finding defers `repo:` here, and Scene 6's own premise leans
on it: "the committed marker is what admitted her" is true only while
the link grant is on — turn the link off and repo members are locked out
with the strangers. The lean, to confirm when this phase opens: play
Scene 6 on the link grant, keep the `repo:` refusal honest, and record
the lock-out asymmetry as a finding — the OAuth access-token custody
decision belongs with phase 12's design, which is already in the
token-custody business.

**Outcome:** Scene 6 plays **from its own door**: the dialog under your
own face at dev hands over a line, that line pasted into a real cloud
session brings up an agent in an empty ephemeral directory with no
replica and nothing to lose, and it works the canvas; its ring fades
only when its own connection dies.

**Proof:** The scene, played from the dialog at dev into a real cloud
workspace — the same bar phase 8 held itself to, and NOT a scratch
directory, which proves the mechanism and not the journey; a kill test
for ring truth.

**Findings:**

- **2026-08-29 — "thin" is journey vocabulary; the switch is `--direct`.**
  A seat name describes a topology to somebody who read the journey; a
  flag has to say what will happen to somebody who did not.
- **2026-08-29 — direct-versus-daemon is a property of the directory, not
  the vendor.** A CI runner is disposable, a cloud dev workspace has disk
  and persists, a closet server wants a daemon: sniffing the provider is
  wrong for half of them, so no provider is named in the code.
- **2026-08-29 — the guess was deleted, by CI, after turning main red.**
  It was narrow (`CI` set, no TTY, an address in hand) and CI is where it
  fired: `pass.test.ts` spawns `setup <address>` with `CI=true` and no
  TTY, so four unrelated tests began asserting against a direct machine.
  Deleting it is free because the dialog's line carries `ISOCAN_DIRECT=1`:
  **a guess that infers what the UI can state has no job.**
- **2026-08-29 — the seam was one function, because the CLI never touched
  the store.** `paths.canvasesDir` has one caller; canvas data and blobs
  already went over HTTP, so pointing `DaemonClient.base` at the home was
  most of it. Ten hardcoded `127.0.0.1` sites became `resolveBase`.
- **2026-08-29 — `redeemPass` and `joinFromHome` already handled being
  aimed at a home** (the `elsewhere` check, the `not-a-replica` 409 that
  callers swallow). Written for phase 10.3's many-homes, correct here
  untouched.
- **2026-08-29 — `isocan wait` parks at the home and wakes on a mention,
  with no daemon.** Driven for real against a scratch home: parked, a
  second actor asked, `wait` returned with the thread and exited. Nothing
  bound to 127.0.0.1 came up.
- **2026-08-29 — Open: a killed agent's ring lingers for five minutes.**
  The kill test ran and the ring did NOT fade with the connection — CLI
  presence is TTL-based (`SESSION_TTL_MS`, five minutes, swept every ten
  seconds), touched by commands, never socket-bound. Measured: `kill -9`,
  then `who` showed Sonia at t+250s and not at t+300s. So Scene 6's *"her
  ring fades only if her sandbox dies, which is the truth"* is true only
  within a five-minute window, and the pile says "here" about a dead
  sandbox for that long. **Not caused by direct mode** — a thick agent's
  ring behaves the same way — but direct mode is what makes it matter,
  because a torn-down cloud sandbox is the ordinary way this agent ends.
  Fixing it means presence bound to a connection rather than a clock, which
  is a change to the ephemeral plane and not to this phase.
- **2026-08-29 — The scene's own door was assigned to no phase, and this
  one's Outcome let itself off.** "Run an agent in the cloud…" appeared in
  exactly one place in the repo — `journey.md:295` — while its Scene 5
  sibling has been a real component since phase 8. This phase's Outcome
  described the MECHANISM ("an agent in an empty ephemeral directory works
  the canvas") where phase 8's named the scene, so building to it produced
  a verifiable CLI and an unwalkable journey. Caught by Dimitri asking what
  he was verifying. Outcome and Proof rewritten above; the dialog built.
- **2026-08-29 — A scene's UI is load-bearing and easy to lose**, because
  prose in the journey reads like a description rather than a work item.
  **Phase 12 has the same hazard right now:** its registration UI is one
  clause of its Work line, and `launch/design.md` explicitly disclaims it
  ("The registration UI. Where a person creates and reviews one is phase
  12's build"). Whoever opens 12 should name the surface in the Outcome
  before writing code.
- **2026-08-29 — The person picking the menu entry IS the declaration.**
  Direct mode refuses to sniff the vendor, which left Scene 6's "setup
  notices what it stands on" false in a sandbox that sets no `CI`. The
  dialog resolves it without a guess: choosing "Run an agent in the
  cloud…" says the workspace is disposable, so the line it hands over
  carries `ISOCAN_DIRECT=1` and the person still types nothing.
- **2026-08-29 — This worktree was typechecking against the MAIN
  checkout.** No `node_modules/@isocan` of its own, so `@isocan/*`
  resolved up to the main repo's symlinks and a new core export was
  invisible to the web package. Fixed locally with symlinks; worth knowing
  before trusting a green `npm run typecheck` in a fresh worktree.
- **2026-08-29 — Open: `repo:` and the lock-out asymmetry**, untouched by
  this work and still waiting at the door as written above.

## Phase 12 — Agent-on-demand (Scene 7) ⚑ provision

**Status: NOT STARTED.**

**Work:** Registrations per frozen delegation — custody-checked actor,
KMS-wrapped scoped token, per-summons pass in the dispatch payload;
the `workflow_dispatch` hook concretely; the spark's tri-state in the
pile; failure surfaced in the thread. Provisioning: a test repo with
the workflow file and a token scoped to firing it.

**Gated on a design that does not exist yet.** Frozen delegation
([innkeeper.md](innkeeper.md), mechanism 11) answers "may the
home mint this?"; nothing yet answers "what happens when it fires?".
Before this phase opens, `projects/launch/design.md` must own the operational
half: the hook contract written down rather than sloganized; how the
home observes the failure it promises to report — its token reads
nothing, and `workflow_dispatch` answers 204 with no run id, so
pass-redemption-within-a-deadline is the candidate signal; the payload
as a channel that is not private — dispatch inputs are readable by
anyone with repo read for the pass's TTL; the harness credential — the
standing secret in CI the design never mentions because it lives outside
the walls — chosen out loud anyway; a registration's second death, by
vendor token expiry, which is a spark that lies; and summons concurrency
plus the re-run button, which replays a spent pass and so can never
work. With the doc, the spike: fire a real dispatch at a scratch repo
and measure — a design that reasons about a vendor is a hypothesis.

**Outcome:** An `@`-mention with nobody running boots a real workflow
that works the lap and exits; a sabotaged hook says "couldn't start"
where everyone can see it.

**Proof:** The summons fired for real against the test repo; vitest
for custody rules and the registration's place in the provenance
sweep.

**Findings:** *none yet.*

## Phase 12.5 — The queue

**Status: NOT STARTED.**

**Work:** The daemon learns to queue — the debt `home-link.ts` refuses
on purpose, payable now because phase 10 already answered every hard
question in the harder place: client-minted ids, exactly-once replay,
flush-before-tail, the false-refusal honesty. This ports a proven shape
into the process that already has an oplog, durability, and an adoption
path. Deliberately *not* the bridge: after this phase a machine still
has two queues, both honest.

**Outcome:** An agent on a plane can work: a replica's CLI writes
succeed and queue while the home is unreachable, and land in home order
on reconnect, before the tail comes down.

**Proof:** Phase 10's actuation, replayed for the other surface: home
stopped, CLI writes accepted, a second writer raced in first, reconnect
— the queued ops land after it under the ids they minted offline, and
replaying one appends nothing.

**Findings:** *none yet.*

## Phase 12.7 — The bridge

**Status: NOT STARTED.**

**Work:** One replica on a machine, not two: the tab reaches the local
daemon through the same-origin bridge frame of
[local-bridge.md](local-bridge.md) — taken up only after
that design is completed and its browser hypotheses measured (the
127.0.0.1 frame carve-out, and Private Network Access, which browsers
have been reshaping toward permission prompts; a comment that reasons
about a browser is a hypothesis). The journey grows the scene it lacks —
a person and their agent, one canvas, no network — and the failure-mode
list is the center of the work: stale daemon, wrong home, wrong port,
unclaimed badge, each refused legibly, because a tab quietly agreeing
with a stale daemon is the cheerful-wrong-address bug in its worst form
yet. The "never pages to persons" bend is recorded — and phase
10.3 already bent it, since a daemon now serves pages for the canvases it
is the home of, so what 12.7 adds is a frame and not the first exception.
The frame-ancestors lock and the postMessage origin check derive from the
served canvas's home; **that correction is made** — phase 10.3 rewrote
the line in local-bridge.md that said both derive from "one value the
daemon already holds", and `GET /api/homes` is the route that answers it
per canvas. Phase 10's browser replica remains the answer when no daemon
is present.

**Outcome:** The thesis survives the plane: a person in the browser and
their agent in the terminal see each other's work with no network,
through one replica and one queue.

**Proof:** The scene, actuated in Chrome with the network gone; the
no-daemon fallback exercised; the stale-daemon and wrong-home refusals
driven and read.

**Findings:** *none yet.*

## Phase 13 — Offline birth, twins, re-homing

**Status: NOT STARTED.**

**Work:** Adoption from seq 1 on first reconnect; first-writer wins
and the late twin parks whole; re-homing as the generalized push —
work travels, the guest book stays. Thin now: the queue arrives proven
from phase 12.5, so what is left is adoption, the twin rule, and the
push itself. Re-homing's landing also retires the sovereignty caveat
phase 13.7 wrote into the terms — deleting that sentence is part of
this phase's outcome.

**Outcome:** A plane-born canvas adopts its promised home; a twin is
refused and parked, never merged; a re-homed canvas keeps its authors
while the roster re-forms.

**Proof:** Integration tests across scratch homes for all three flows.

**Findings:** *none yet.*

