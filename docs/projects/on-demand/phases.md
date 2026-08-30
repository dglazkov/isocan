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

**Where we are: nothing built, and the mechanism revised once already.**
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

**Status: NOT STARTED.**

**Work:** Move the park's cursor out of the parked process (`let cursors`
in `main.ts`), per actor per canvas, advancing only when a turn completes.
Nothing else changes; `--since` becomes something nobody has to know
about.

**At this door — cursor custody.** The design splits the enrolment record
along custody: the home holds what routing needs, the `rc` holds what
running the agent needs. The cursor could live on either side. At the
home, it survives the `rc`'s death and a replacement resumes exactly; at
the `rc`, the home stays untouched and two `rc`s can never fight over one
row. Decide which — and whether today's plain `wait` park uses the same
storage, which is what makes this phase useful before any `rc` exists.
One mechanism fact to carry into the decision: journey 3 allows the whole
roster exactly one quiet connection, so an `rc` parks once and fans out —
the storage must let several per-actor cursors advance independently off
one shared read, not assume one park per cursor.

**At this door — one cursor, two doors.** An actor parked via `wait`
while also enrolled with an `rc` — or parked twice — shares one per-actor
per-canvas cursor row; advance-on-completion from two readers skips or
double-fires. Decide: a single-reader rule (the second reader refuses, or
adopts the row), or a cursor per registration rather than per actor.

**At this door — redelivered is not new.** Journey 3 promises both
halves: nothing in a gap is missed, and the same comment is never
delivered twice as new. Advance-on-completion alone is at-least-once
delivery — a park that dies after the agent replied but before the cursor
advanced redelivers that comment on resume. Decide how the second promise
is kept: a delivery record beside the cursor, a mark on redelivered
entries so the turn knows it may already have answered, or an argument
for why the reply already in the thread is the check. "Never twice as
new" is acceptance, not aspiration; the door owes a mechanism.

**Outcome:** `kill -9` a parked agent mid-gap, park again: nothing in the
gap is missed, and `--since` was never typed.

**Proof:** vitest — a wake advances the cursor only on completion; a
killed park resumes from its stored cursor; two readers on one actor
behave as the door decision says; a death after the reply but before the
advance does not present the same comment as new.

**Trajectory:** *nothing yet.*

## Phase 2 — `isocan rc` and the enrolments

**Status: NOT STARTED.**

**Work:** The long-running command itself: started by the person, bare —
the directory's binding supplies the canvas, the enrolment records supply
the roster — and quiet at start, the way `claude rc` is: starting it
spawns nothing and lists nothing, it enables. Its narration is of events
as they happen — a summons, an addition, a refusal — and the roster is
read where rosters are read, `isocan who`. The enrolment record in its
two halves (`home: { canvasId, actorId, rules, cursor }`,
`rc: { actorId, harness, cwd, sessionId }`), the gestures that create an
enrolment, and the gesture that withdraws one. This
phase owns journey 8 (dismissal): enrolment and withdrawal are one phase,
so standing can never be granted by a build that has no way to take it
back.

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
changes without a restart. Journey 1 names enrolment's two doors, and
journeys 1 and 8 walk through both, so this phase builds both — neither
is deferrable, and the web half (the agent tray with its rows, the *Add
an agent* dialog, the per-row *Dismiss*) is this phase's work as much as
any verb: the web dialog (*Add an agent*
→ name it, pick a persona template), which decides WHO while the parked
`rc` supplies WHERE — the two halves of the custody split staying on
their sides — falling back to handing over a line when no `rc` is
parked; and a prompt to an agent you already have — a comment on the
canvas like any other ask, so this door is also the web app. Its
mechanism is `isocan agent add <name>`, and **the syntax is the
containment**: the agent's form takes no `--canvas` and no `--dir` —
both come from where the agent already is — so an agent can only ever
add an agent beside itself. The flagged, point-anywhere form
(`isocan rc add`) is a person's, and lives as plumbing rather than a
journey door. One timing fact, recorded in the journey map too: the ask
doors — `@Sian add a reviewer`, `@Sian you're done here` — mechanically
need a summoned turn, so they *walk* when phase 4 lands; what this phase
delivers is everything the walk will use — the verbs, the records, the
web doors. Journey 4 adds one more property: routing rules are set in
the same gesture that adds the agent, defaulted by the persona template
— never a second thing to remember. How a template declares those
defaults is decided with the personas project at the table, not by this
walk alone. The door's hardest question: nothing mechanical separates an
agent running `isocan agent add` because it was asked from running it
unasked. The person's word is the gesture, and the walk owes a decision
on where that word is checked — or an argument for why the `rc`'s
narration plus the thread's visibility is check enough. Dismissal lives on the canvas (journey 8): the
agent-tray control, and the ask — `@Sian you're done here`, which is the
gesture that dismissed Charlie on the phase-11 proof canvas, and which
mechanically means the agent removes its own standing on the person's
word. The ask door only works while the agent still answers; the tray is
how you dismiss one that no longer does. A CLI record verb may exist as
plumbing, but it is not a journey door: a person at a terminal is looking
at the `rc`, and the `rc`'s own gesture is the coarse one — Ctrl-C stops
answering for everyone.

**At this door — what a rule may say.** Journey 4's example rules are
"only the items Sian owns, only version and comment changes." Op-type
filters exist today (`--op`), and item filters name specific items
(`--item`) — "the items Sian owns" is a predicate neither expresses.
Decide the vocabulary the record's `rules` field may hold: today's
filters only, and journey 4's example bends to match; or ownership and
whatever else, defined in core beside `reasonFor` so `wait`, the inbox,
and the `rc` read one grammar. Journey 4's acceptance adds a surface
obligation either way: the rules must be readable in one place — ask
what an agent answers for and why — so the `rules` half of the record
needs a reader, not only a writer, and this phase owns it.

**Closed at this door, 2026-08-30 — `ISOCAN_HOOK`, kept as a headstone.**
The first draft enrolled agents from inside their own sessions when this
variable was set, and the review found it had no setter in the session
that mattered. The `rc` revision removes the question: enrolment is a
person's gesture (or an agent's, on a person's word), nothing needs to
appear in any agent's environment, and `wait` keeps its exact current
contract.

**Outcome:** `isocan rc` starts bare and spawns nothing. An agent added
through the web door appears in the roster, and a withdrawal takes it
back out — both with or without an `rc` running, a running `rc`
narrating each as an event. Kill the `rc`; the enrolments survive to its
next start. (The ask doors walk with phase 4; what `who` calls the added
agent is phase 6's word.)

**Proof:** vitest for the record's two halves, the add and withdrawal
gestures, and survival across restart; the narration asserted, not
assumed.

**Trajectory:** *nothing yet.*

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
