# Agents on demand — the walk

**30 August 2026.** The order of work for [design.md](design.md), with the
design's open decisions parked at the door of the phase that forces each
one — every door states its question in full, so this doc needs nothing
outside itself. [journey.md](journey.md) is the acceptance suite: its map
says which phase closes which journey, and a phase that claims one closes
only when the journey walks. Each phase ends with **Trajectory**: only
what the phase discovered that changes the project's course — a door
decision reversed, a phase reordered, scope cut or added. It is not a
work log or a list of insights; a phase that went as planned leaves it
empty.

**Where we are: phases 1, 2 and 2.5 are closed (2026-08-30).** The
park's cursor is durable (phase 1); enrolment is a record in canvas
state with its rc half beside the machine, the verbs exist in both
spellings, and a bare `isocan rc` parks, announces itself on the
presence plane, and narrates — enrolments, withdrawals, and summonses it
cannot yet answer (phase 2); the tray and the *Add an agent* dialog are
live, with dismissal on the row and the rc supplying where-and-how for
web adds (phase 2.5, personas deferred). Phase 3 (the ACP client) is
next. Before the walk began, the mechanism was revised once already.
The design's first draft had agents enrolling themselves from inside a
session (`ISOCAN_HOOK`, a new exit code) and the daemon spawning turns.
Withdrawn 30 Aug in review — see the mechanism section of design.md for
the record. The shape of record is **`isocan rc`**: a long-running
command the user starts, which parks against the home on behalf of its
enrolled agents and vends their sessions over ACP — with `isocan agent`
as its vocabulary twin, the same machinery spoken by an agent. Two things
landed ahead of the walk, 30 Aug: the routing predicate is `reasonFor` in
`packages/core/src/inbox.ts` — one function, shared by `wait` and the
inbox — so the `rc` imports the rule instead of becoming its third copy
(phase 4 records the remainder: the summons-through-any-filter
composition still lives in the `wait` loop, and moves to core when the
`rc` needs it); and `isocan wait` itself changes not at all in this
project.

Phase 1 is worth building whether or not the rest happens — it closes
useful under `wait` alone.

## Phase 1 — Durable cursors

**Status: CLOSED (2026-08-30).** Journey 3's plain-park half walks: the
outcome's `kill -9` scene is driven end to end in
`cli/test/wait-cursor.test.ts` against a real daemon and a real spawned
park, and every proof below is a passing test.

**Work:** Move the park's cursor out of the parked process (`let cursors`
in `main.ts`), per actor per canvas, advancing only when a turn completes.
Nothing else changes; `--since` becomes something nobody has to know
about.

**Closed at this door, 2026-08-30 — cursor custody: the daemon the park
polls.** Not the true home and not a CLI-side file: the row lives with
the local daemon, beside its other machine-local facts (`server/src/
park.ts`, `park-cursors.json` next to `homes.json`), never behind the
`Store` seam and never replicated. The deciding facts: `wait`'s one
address is `127.0.0.1`, so the row is reachable exactly when a park can
poll — including with the home link down, which is precisely when parks
resume; a replica writes the home's seqs verbatim, so the row means the
same thing wherever the canvas is homed; and a replacement `rc` is
same-machine anyway, because `cwd` and harness are machine facts, so
true-home custody bought a cross-machine resume nothing can use. For a
locally-homed canvas the daemon IS the home, so the design's `home:
{ …cursor }` sketch survives; moving custody later is a data move, not a
semantic change. Plain `wait` uses this storage today — the phase's value
before any `rc` exists — and the rows are per actor off one shared read,
the shape journey 3's one-quiet-connection fact requires.

**Closed at this door, 2026-08-30 — one cursor, one reader, newest
adopts.** One row per actor per canvas; every claim mints a lease
(`parkId`), and a delivery or advance carrying a stale lease is refused
with `park-adopted`. The displaced park learns at the exact moment it
would have double-delivered — before emitting anything — and exits 3,
which the help text and agent guide define as "stand down", not "park
again". Refusing the second reader was rejected because a `kill -9`'d
park would leave a lease that blocks the resume this phase exists for
(unless a TTL un-blocks it, the clock-based lie journey 7 bans
elsewhere); a cursor per registration was rejected because two live rows
deliver the same comment twice as new by construction.

**Closed at this door, 2026-08-30 — redelivered is not new: a delivery
record beside the cursor, and a machine-checked mark.** The row is three
watermarks, `cursor ≤ rehanded ≤ delivered`: a wake records `delivered`
without advancing; the cursor advances only on completion evidence at the
next claim. The evidence, in order: the actor authored an op after the
delivery (the reply is the proof — the daemon checks the log, the agent
is not trusted to remember), or the actor came back to park after the
batch was already re-handed once marked. Absent both, the batch goes out
again with `redelivered: true` on each entry — never as new — so an
entry is handed at most twice, the second time flagged, then settled.
The bound is deliberate: a batch whose two turns both died is committed
rather than redelivered forever, because an agent whose correct response
to a change-wake is "nothing" must be able to park through it.

**Outcome:** `kill -9` a parked agent mid-gap, park again: nothing in the
gap is missed, and `--since` was never typed. *(Holds — the first test in
`wait-cursor.test.ts` is this scene verbatim.)*

**Proof:** vitest — a wake advances the cursor only on completion; a
killed park resumes from its stored cursor; two readers on one actor
behave as the door decision says; a death after the reply but before the
advance does not present the same comment as new. All four in
`cli/test/wait-cursor.test.ts`; the row's arithmetic pinned at the unit
in `server/test/park.test.ts`.

**Trajectory:** *nothing — the phase went as planned.*

## Phase 2 — `isocan rc` and the enrolment records

**Status: CLOSED (2026-08-30).** Every outcome below is a passing test in
`cli/test/rc.test.ts` (the verbs, both record halves, survival across
restart, the narration asserted against a real spawned `rc`) and
`core/test/agents.test.ts` (the record's shape and the mentionability it
was stored for).

**Closed at this door, 2026-08-30 — where the home half lives: canvas
state, written by ops.** `agent.enroll` and `agent.withdraw` join the op
vocabulary; the record is `canvas.agents` (`EnrolledAgent` in core's
`model.ts`), non-undoable like `actor.claim` — standing never moves on a
casual ⌘Z. The deciding fact, found in the code: mention candidates
derive from canvas state (`mentions.ts`), so an enrolled-but-never-spoken
Sian was UNMENTIONABLE under any other storage — no `@Sian`, no summons,
ever. With the record in canvas state, everything this phase and 2.5 need
falls out of the isomorphism: `@Sian` resolves, the web tray reads the
snapshot it already has, a running `rc` notices record changes through
the watchLog park it already holds, the record replicates to remote
homes, survives restarts because the oplog does, and withdrawal removes
the row while the log keeps the story — journey 8's acceptance by
construction. The rc half (`harness`, `cwd`, `sessionId`) is a machine
fact and lives in `~/.isocan/rc-agents.json` (`cli/src/rc.ts`), the same
canvas-fact/machine-fact split `backing.ts` draws for files. The enrolled
actor is minted through the ordinary `actor.claim`, keyed
`agent:<canvasId>:<name>` on the enrolling machine's badge — so a worn
name is refused by the registry rather than silently doubled, and
re-enrolling Sian after a withdrawal hands the same Sian back; phase 3
rebinds the actor to its adapter-born session key when a session first
exists.

**Closed at this door, 2026-08-30 — the residue: `isocan rc` refuses
inside a harness session.** One line, naming the right verb (`isocan
agent`). A bare rc in a tool call would block the turn until the harness
killed it, while standing up a parent-of-agents no person started; the
naming door drew the divide in the vocabulary, and the refusal is that
divide holding mechanically.

**Closed at this door, 2026-08-30 — where the person's word is checked:
in the open, for now.** An agent's `isocan agent add` is an op in the log
with the adding agent as author, narrated live by a running `rc`, visible
in the tray 2.5 builds, and withdrawal is one gesture away — an unasked
add cannot be quiet, and this phase's agents cannot act (no dispatch
until phase 4), so today's exposure is a record, not a running process.
The decision is explicitly provisional: phase 4's door revisits it with
the mechanical context phase 2 structurally lacks — a summoned turn knows
whether a person's comment started it. `isocan agent add` also refuses
`--canvas` outright: the syntax is the containment, and the flagged
point-anywhere form is a person's (`isocan rc add`).

**Work:** The long-running command itself: started by the person, bare —
the directory's binding supplies the canvas, the enrolment records supply
the roster — and quiet at start, the way `claude rc` is: starting it
spawns nothing and lists nothing, it enables. Its narration is of events
as they happen — a summons, an addition, a refusal — and the roster is
read where rosters are read, `isocan who`. (A summons at this phase is
recognized and narrated, never answered: `reasonFor` is importable
today, so the `rc` can say *summons for Sian — no way to start a
session yet*; dispatch, and the rest of the routing rule, are phase
4's.) The enrolment record in its
two halves (`home: { canvasId, actorId, rules, cursor }`,
`rc: { actorId, harness, cwd, sessionId }`), and the verbs that create
and withdraw an enrolment. The web doors that journeys 1 and 8 walk
through are phase 2.5, built on what this phase stores. Withdrawal ships
beside enrolment at every step — here as the record verb, in 2.5 as the
tray control — so standing can never be granted by a build that has no
way to take it back.

**Closed at this door, 2026-08-30 — one binary or two, and the name.**
Both went at once, by Dimitri's decision: ditch "steward" and split the
command along the user/agent divide — **`isocan rc`** is what a person
types, **`isocan agent`** is what an agent types, same usage, different
words. One binary; the divide lives in the vocabulary, so who may do what
is legible in what they type. (The earlier lean toward a separate binary
is recorded as history; the clarity it wanted is what the word split
provides.) One residue stays live: a bare `isocan rc` in an agent's tool
call would block the turn until the harness kills it, and an
agent-started `rc` is a parent of agents — whether `isocan rc` refuses
inside a harness session is decided when the verb ships.

**At this door — the enrolment gesture.** Personas are templates a
person assigns when an agent is created — never standing entries the
repo pre-declares. (Corrected by Dimitri 2026-08-30; the first draft of
this door derived a roster from `.agents/personas/`, and that reading is
withdrawn — "not yet," in his words, so it may return as a decision, not
an assumption.) What journey 1 fixes: bare `isocan rc` takes no
arguments (the binding supplies the canvas, the enrolments supply the
roster), and **enrolment is a record, not a message to a live process**
— it works with nothing running, and a running `rc` notices record
changes without a restart. The gestures split across two phases: the
web doors are phase 2.5's, and this phase builds what they stand on —
the records and the verbs. The agent's verb is
`isocan agent add <name>`, and **the syntax is the containment**: it
takes no `--canvas` and no `--dir` — both come from where the agent
already is — so an agent can only ever add an agent beside itself. The
flagged, point-anywhere form (`isocan rc add`) is a person's, and lives
as plumbing rather than a journey door; so does the withdrawal verb — a
person at a terminal is looking at the `rc`, and the `rc`'s own gesture
is the coarse one: Ctrl-C stops answering for everyone. One timing
fact, recorded in the journey map too: the ask doors —
`@Sian add a reviewer`, `@Sian you're done here` — mechanically need a
summoned turn, so they *walk* when phase 4 lands; what this phase
delivers is the verbs and records the walk will use. The door's hardest
question: nothing mechanical separates an agent running
`isocan agent add` because it was asked from running it unasked. The
person's word is the gesture, and the walk owes a decision on where
that word is checked — or an argument for why the `rc`'s narration plus
the thread's visibility is check enough. The record's `rules` half is
stored here exactly as the gesture hands it over and interpreted by
nobody yet: what a rule may say is phase 4's door, decided where
dispatch first reads one.

**Closed at this door, 2026-08-30 — `ISOCAN_HOOK`, kept as a headstone.**
The first draft enrolled agents from inside their own sessions when this
variable was set, and the review found it had no setter in the session
that mattered. The `rc` revision removes the question: enrolment is a
person's gesture (or an agent's, on a person's word), nothing needs to
appear in any agent's environment, and `wait` keeps its exact current
contract.

**Outcome:** `isocan rc` starts bare and spawns nothing. An enrolment
created by verb appears in the roster record, and a withdrawal takes it
back out — both with or without an `rc` running, a running `rc`
narrating each as an event. Kill the `rc`; the enrolments survive to its
next start. (What `who` calls the added agent is phase 6's word.)
*(All hold — `cli/test/rc.test.ts`, including the summons narrated as
"no way to start a session yet".)*

**Proof:** vitest for the record's two halves, the add and withdrawal
verbs, and survival across restart; the narration asserted, not
assumed. *(Done — plus the two refusals: rc inside a harness session,
and `agent add --canvas`.)*

**Trajectory:** *nothing — the phase went as planned.* (The facts that
decided the storage door are recorded in the door itself, where they
belong.)

## Phase 2.5 — The web doors

**Status: CLOSED (2026-08-30).** The dialog and the tray were driven in
the real app against a real canvas — add with no rc (the line handed
over), add with an rc parked (narrated live, rc half supplied), dismiss
from the row (narrated, rc half reaped) — and the mechanics are pinned in
`cli/test/rc.test.ts` ("the web doors' mechanics"), `core/test/
agents.test.ts` (the roster rows), and `web/test/agenttray.test.ts` (the
gestures go through the same ops the CLI sends).

**Closed at this door, 2026-08-30 — how the dialog knows an rc is
parked: a presence-plane announcement.** The rc holds a session of a new
kind, `"rc"` — no cursor, no face, no roster row, filtered from every
rendering — so the existing machinery pays three times: the web already
receives presence over WS, home-links already relay it to remote homes,
and the TTL already retires a crashed rc. Ctrl-C stands the announcement
down deliberately. This is the dialog's convenience signal and
explicitly NOT the "answerable" truth — phase 6 still owes the
connection-bound derivation, and the roster's word here is `enrolled`,
never `answerable` (a web test forbids the word in rendering code).

**Closed at this door, 2026-08-30 — the rc supplies WHERE and HOW.** A
web add writes only the home half (a browser cannot touch
`~/.isocan`); the parked rc, hearing `agent.enroll` — and once at start,
for enrolments it missed — writes the missing rc-half row itself: its
own directory, harness unsaid. The home half is authoritative: rc rows
with no standing enrolment are dead and reaped at reconcile. A verb run
on the machine already said more than the rc can guess, so adoption
writes only when the row is absent.

**Closed at this door, 2026-08-30 — personas: deferred entirely, by
Dimitri.** No picker, no field on the record — "let's defer that until
personas machinery is fully fleshed out." The dialog is name-only.
Journey 1's step 2 therefore walks with a caveat: the persona-template
half of the gesture (and journey 4's rules-defaulted-by-template) waits
on the personas project, and whoever takes it up starts here.

**Work:** The gestures where the people are, built on phase 2's records:
the agent tray with a row per enrolled agent; *Add an agent* — name it,
pick a persona template — which decides WHO while the parked `rc`
supplies WHERE and HOW, the two halves of the custody split staying on
their sides, falling back to handing over a line when no `rc` is
parked; and the per-row *Dismiss*. Routing rules are set in the same
add gesture, defaulted by the persona template — never a second thing
to remember (journey 4). How a template declares those defaults is
decided with the personas project at the table, not by this walk alone,
and what a rule may say is phase 4's door — the dialog stores what the
template hands it, and journey 4's "adjustable there" finishes at phase
4 with the vocabulary. Dismissal lives on the canvas (journey 8): the tray
control, and the ask — `@Sian you're done here`, the gesture that
dismissed Charlie on the multiuser phase-11 proof canvas — which
mechanically means the agent removes its own standing on the person's
word, through phase 2's verb. The ask door only works while the agent
still answers, which is phase 4's to make true; the tray is how you
dismiss one that no longer does.

**Outcome:** An agent added from the dialog appears in the roster; with
no `rc` parked, the dialog hands over the line instead. A tray
dismissal takes the standing away and leaves the history untouched.
Journeys 1 and 8 close here, with the caveats their map rows carry.
*(All hold, driven live — plus the persona caveat above.)*

**Proof:** The dialog and the tray driven in the app against a real
canvas; the records asserted after each gesture. *(Done — screenshots in
the session, records asserted in `rc.test.ts` through the same ops the
dialog sends.)*

**Trajectory:** one discovery changed the build, not the course: the
agent tray had NO standing door — it opened only from the rail strip's
faces, which exist only while agents are live, so the canvas journey 1
starts on (no agents yet) could never reach *Add an agent*. The rail
strip now carries a permanent agents button. And one decision narrowed
scope: personas are out of this phase entirely (the door above), so the
walk hands the personas project a starting point rather than a
half-built picker.

## Phase 3 — The ACP client in the `rc`

**Status: NOT STARTED.**

**Work:** The `rc` speaks ACP over stdio to locally spawned agents. `fs`
and `terminal` omitted from client capabilities — the spec treats omitted
as unsupported — so the agent keeps its own disk and shell and does
canvas work through the CLI it already knows. And the spawned session
speaks as its enrolled actor: the CLI inside it resolves identity by
`<harness>:<session id>` (`identity.ts`), so the `rc` owns writing that
binding for each adapter-born session before its first prompt — without
it, Sian's reply would not land as Sian.

**At this door — session persistence is a hypothesis; spike it.** The
`rc`'s sessions are adapter-born, which retires the first draft's harder
question (loading a terminal-born session through the SDK — now moot
unless session promotion is ever wanted, and nothing here wants it). What
remains: whether `session/load` restores an adapter-born session after
the `rc` restarts, and what the adapter's known subprocess-death bugs do
to a session mid-turn. The spike: create a session, end the turn, restart
the `rc`, load the session, prompt it. Either answer feeds phase 2's
`sessionId` field: a real resume handle, or bookkeeping for a session
that is always rebuilt. A design that reasons about a vendor is a
hypothesis.

**Outcome:** The `rc` starts a turn in a named agent on this machine and
reads its `stopReason`.

**Proof:** The spike's answer written into design.md; an integration test
that spawns a real adapter and completes one turn.

**Trajectory:** *nothing yet.*

## Phase 4 — Dispatch

**Status: NOT STARTED.**

**Work:** On an op that the routing rule matches for an enrolled agent,
the `rc` starts a turn carrying what `wait` would have returned. The
rule is imported, never copied — and it is more than `reasonFor`:
journey 4's "a mention comes through any filter" lives today as
composition in the `wait` loop (`main.ts` checks the summons before the
filters ever run), so sharing the rule means hoisting that composition
to core beside `reasonFor`, or the `rc` becomes the second copy of
exactly the piercing that must never drift. The self-wake guard holds;
the cursor advances per phase 1 when the turn completes. Delivery is
batched the way a `wait` wake is: journey 3 has Sian waking once for
three overnight comments, so a summons carries every pending matched
entry, and ops that land mid-turn sit behind the cursor and become the
next summons when the turn completes. And the
summoned session is seen: journey 2 shows presence appear when the turn
starts and fade when it ends. The park lands presence on a summons today
(`landPresence` in `main.ts`); a summoned session never parks, so this
phase owes the equivalent — the design names this seam as a failure mode
("two doors disagreeing"), and it closes here or journey 2 does not
walk.

**At this door — what a rule may say.** Journey 4's example rules are
"only the items Sian owns, only version and comment changes." Op-type
filters exist today (`--op`), and item filters name specific items
(`--item`) — "the items Sian owns" is a predicate neither expresses.
The record has carried `rules` opaquely since phase 2; this phase is
the first to read one, so it decides the vocabulary: today's filters
only, and journey 4's example bends to match; or ownership and whatever
else, defined in core beside `reasonFor` so `wait`, the inbox, and the
`rc` read one grammar. Journey 4's acceptance adds a surface obligation
either way: the rules must be readable in one place — ask what an agent
answers for and why — so the `rules` half of the record gets its reader
here.

**At this door — what a summons delivers.** The design says two things:
"the payload `wait` would have returned, same JSON" and "isocan composes
the prompt — the ~1,045-token brief or the ~15,000-token guide." They are
different claims about the same moment, and the `rc` makes the choice
heavier: an enrolled agent's *first* summons is `session/new`, so cold
arrival is the norm, not the edge case. Decide the shape: the JSON
verbatim as the prompt; a composed brief that carries the JSON; the guide
for a fresh session and the brief for a loaded one. Journey 9 bounds
every option: `isocan wait --json` must remain a faithful stand-in for a
summons — delivery differs, content never does — so the `wait` JSON
stays the contract's inspectable core, and whatever wraps it is fixed
and documented, never varied per summons. The cold-arrival risk
named in "What would make this fail" — an agent that does not re-orient —
is the other half of this decision, and the auto-upgrade window (the
design's open question about `considerUpgrade` losing its park) can be
settled here too: the `rc` sees `end_turn` and knows the idle moment
exactly.

**Outcome:** A comment addressed to an enrolled, not-running agent
produces a reply in the thread, the canvas showed the agent while it
worked, and the only process anyone started by hand is `isocan rc`.

**Proof:** The scene, played on a real canvas, presence included; vitest
for the dispatch-on-match path, the mention-through-any-filter path, and
the self-wake guard.

**Trajectory:** *nothing yet.*

## Phase 5 — A limit and a reason

**Status: NOT STARTED.**

**Work:** A ceiling on turns per agent per hour, a record of what the
ceiling stopped, and a cycle guard — the per-actor self-wake rule does
not stop A waking B waking A. Silence surfaced: a turn that fails to
start — or starts and dies before replying — reaches the thread it
failed for; journey 5's acceptance covers both, because an agent that
quietly stops answering looks exactly like an agent with nothing to say. The
`rc`'s own narration carries the same facts on its side of the glass.

**At this door — who says the agent couldn't answer.** Journey 5's
refusal lands in the thread, but the broken party is the one who would
have written it: a comment authored as Sian would put words in the mouth
of an agent that never ran. Decide the author — the `rc` speaking
plainly as machinery, the person whose `rc` it is, or a distinct voice —
so a refusal is never mistaken for the agent answering.

**Outcome:** Two agents set to wake each other stop at the guard, the
stop visible in the thread and the narration; a failed start, or a death
mid-turn before any reply, is readable in the thread it failed for.

**Proof:** vitest for the guard and the ceiling; driven failures of both
kinds — never started, and died mid-turn — whose messages land in the
thread.

**Trajectory:** *nothing yet.*

## Phase 6 — The roster

**Status: NOT STARTED.**

**Work:** What `isocan who` says about an agent that is not running.
Presence stays ephemeral; this is a second, durable fact read alongside
it. The `rc`'s liveness is part of the answer, and **journey 7 has
already decided the hard half**: its acceptance says "answerable" is
never claimed while the `rc` that would answer is dead — no window, no
TTL lie — and by the journeys' own rule the mechanism is what bends. So
this door does not choose between connection-bound and clock-bound; it
owes the connection-bound implementation. The inherited fact that makes
it work rather than a slogan: CLI presence today is clock-based (the
multiuser walk's phase 11 measured a killed ring lingering up to five
minutes), so `rc` liveness needs a connection-bound path that plain CLI
presence does not yet have.

**At this door — the word.** The design's own open: there is no good word
yet for enrolled-but-not-running. Only the word is open — journey 7's
acceptance requires telling "will answer if I comment" from "is
answering right now" from "is gone," so a first version that collapses
to two states would fail the walk; the earlier two-state option is
withdrawn (2026-08-30, journey review). The presence grammar (ring, dim, spark)
was Scene 7's and Scene 7 was never vetted — nothing here inherits it
without a fresh look.

**Outcome:** `isocan who` distinguishes a running agent, an answerable
agent, and an absent one — including "enrolled, but the `rc` is gone, so
nobody is coming." All three, per journey 7's acceptance.

**Proof:** vitest for `who`'s output in all states, dead `rc` included.

**Trajectory:** *nothing yet.*

## Deliberately not in the walk

- **Sponsorship** — an agent making another agent answerable on its own.
  Rests on Scene 7, which is not vetted; journey 1's comment door is a
  person asking, with the agent as the interface.
- **The remote transport** (WebSocket, isocannery). isocannery is
  `isocan rc`, hosted; building the hosting is another project. The one
  thing that holds regardless: it is the same program wherever it runs,
  and isocan never learns which.
- **Session promotion** — converting a live terminal session into an
  enrolment. The first draft's mechanism required it; the `rc` does not.
  If it ever returns, it brings the cross-launcher `session/load`
  question back with it.
