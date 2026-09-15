---
status: designed
since: 2026-09-14
issue: 309
see: bench, standing-agents, on-demand, agent-custody, sheep-harness, room, memory, inbox
note: phases 0, 1 and 2 closed 15 Sep 2026 — the bench is items on the personal canvas, `isocan bench`/`add`/`rm` and **Your bench…** read one derivation in core with three states from three different facts; `agent.invite` (op-types 40 → 41) then joins an agent you already have to a canvas with NO rc parked, from the panel or `isocan bench join`, preserving `rules` and `writtenBy` so a join cannot widen who may summon; phase 2 put the same act in the Chat as `@Name join`, with a refusal that takes the name and nothing else so it cannot distinguish a name on somebody else's private bench from one that exists nowhere. Four phases, none of which provisions anything or spends money. Phase 0 was the registry and its three-state reachability; phase 1 joins from the panel with `agent.invite` and moves op-types 36 → 37; phase 2 joins from chat; phase 3 makes enrolment write its own rows. The rc in a cell is journey 4 and is NOT here.
---

# The bench — the phases

**Where we are, 15 September 2026.** **Phases 0, 1 and 2 are CLOSED** — the
bench exists on both surfaces with reachability measured rather than asserted;
an agent you already have joins a canvas from the agents panel with no rc
parked anywhere; and `@Name join` does the same from the Chat, sending the same
op and refusing in a sentence that cannot tell a stranger whether a name exists.
Phase 3 is next (`bench phase 3`), the last: enrolment writing its own row. Nothing
waits on a person and nothing waits on another project. Two debts are open and
named in the trajectories: the two surfaces measure reachability from different
inputs (needs a daemon route nobody owns yet), and four `op-types` arrived from
design-partner without an argument beside the number.
No phase here provisions a cloud resource or spends money — the one thing that
would, the rc in a cell, is journey 4 and deliberately out of scope.

**Rules this project keeps, beyond the house rules.**

1. **Each phase ends with something a person can use from both surfaces.**
   `AGENTS.md`'s "done means done on both surfaces" is the house rule; here it
   binds tighter, because the bench's whole claim is that it follows a person
   between CLI and web.
2. **No phase may reduce reachability to a boolean.** Three states, always,
   even when only two are reachable in practice. A phase that ships a boolean
   paints journey 4 out and will be rejected at verification.
3. **A bench row confers nothing.** Any phase that makes a row grant standing,
   reach, or the right to summon is wrong, however convenient.

---

## Phase 0 — the bench reads

**Status: CLOSED.** 15 September 2026 — `isocan bench` and **Your bench…** in
the identity menu both read `benchRows()` in core, and the three states are
reached from three different facts rather than asserted.

The registry exists and can be looked at. No joining, no new op.

**Work.** An agent is an item on the personal canvas with
`properties.kind = "agent"` and the fields `design.md` names. `isocan bench`
lists them with the three-state reachability, `--json` included. **`isocan
bench add <name>` and `isocan bench rm <name>`** write and remove a row, taking
the agent from what this machine already knows — the rc rows in
`~/.isocan/rc-agents.json` and the enrolments they name — so adding to the
bench never mints an actor and never needs an rc handshake. The web shows the
same rows under the identity menu as **Your bench**. `roster()` is the source
of the first two states.

**Amended 14 Sep, before briefing.** The Proof as first written could not be
run: it asked for three rows on a bench, and nothing in the phase wrote one —
phase 3 is what fills the bench from enrolment, and until then the rows have to
come from somewhere. A phase whose proof cannot be executed is a phase that
will be marked by a proof that was not the one named, so the writer moved here.

**Proof.** From a clean home: enrol two agents from this machine the ordinary
way, `isocan bench add` each, and add a third row for an agent this machine has
no rc row for. `isocan bench --json` returns three rows with states
`ready`/`elsewhere`/`unreachable` respectively. A test asserts all three are
reachable values and that no code path collapses them to two. The web rows are
read from the same derivation — a test fails if the panel computes a state of
its own. `isocan bench rm` removes a row and leaves the agent's enrolments
untouched, asserted, because "a bench row confers nothing" has to cut both
ways. Full suite and typecheck.

**Closes.** Journey 1.

### Trajectory

- **2026-09-15** — `ready` is decided before anything else, so a relayed hold
  outranks this machine holding no row. A laptop that has never heard of an
  agent must not print `unreachable` over one that is answering — journey 4's
  case, decided here rather than left to the phase that needs it.
- **2026-09-15** — `elsewhere` is evidenced by a running row on this machine
  **or** an enrolment on a canvas the reader can see. That second half is what
  lets a browser reach the state at all, and it is why phase 0 needed no
  daemon route.
- **2026-09-15** — Open: the two surfaces measure from different inputs. A tab
  cannot read `~/.isocan/rc-agents.json`, so an agent with a running row here
  and no enrolment anywhere reads `elsewhere` in the terminal and
  `unreachable` in the tab. Journey 1 promises the same state on both. It is
  one function with different inputs, not two derivations, and the fix is a
  daemon route serving the machine's running rows. Waits on a phase that owns
  `packages/server/src`.
- **2026-09-15** — `bench add` resolves a null rc harness to this machine's
  default and writes it down, rather than storing null and resolving at read.
  Deliberate: a browser cannot scan a machine's harnesses, so resolving late
  would have forced the panel to compute something core could not, which is
  the one thing this phase forbids.

### Integration correction, 15 September 2026

Release run [34937549827](https://github.com/dglazkov/isocan/actions/runs/34937549827)
failed on `07c493d8`: 45 unused exports exceeded the existing ceiling of 39.
Design-partner integration independently reproduced the guard failure (46 with
its own additions). Seven new bench implementation details had no external
uses: four property/filename constants, the item predicate and two supporting
types. Keeping those local preserves the consumed bench API, three-state
behavior and generated declarations without raising the ceiling. The actual
bench CLI, core and web cases plus the export guard pass (13 tests); core
also typechecks. The design-partner landing gates verify the integrated tree.
The original phase 0 proof above is not evidence that its release CI passed.

---

## Phase 1 — join from the agents panel

**Status: CLOSED.** 15 September 2026 — `agent.invite` carries provenance, the
agents panel offers Join above *Add an agent…* with no rc parked anywhere, and
the walk was falsified as well as run.

**Work.** `agent.invite` in the op vocabulary, its reducer case, its inverse
(refuses, beside `agent.enroll`), `touches.ts`, `opwords.ts`. `op-types` moves **by
exactly one** in `.agents/personas/architect.md`, with the argument from
`design.md` written beside it. (The design said 36 → 37; by the time the phase
ran the tree was at 40, so the real move is 40 → 41. One op is the promise; the
absolute number is whatever the day says.) `isocan bench join <name>` on the CLI and a
**Join** control on each bench row in the agents panel, above *Add an agent…*.

**Proof.** Joining with no parked rc on the target canvas succeeds and the
agent appears in `roster()` and in mention candidates — this is the phase's
whole point, and a test that only covers the parked case proves nothing.
Joining does not start a turn, does not alter `listen` grants, and does not
change any other canvas's rules; each asserted, because "confers nothing" is
the rule most likely to erode. `web-only-ops` stays 0. A walk: join an agent
from the panel on a canvas whose rc is not running, and read the roster back
from the CLI.

**Closes.** Journey 2.

### Trajectory

- **2026-09-15** — Join is gated on HAVING a bench, never on a parked rc.
  "No rc, no button" is right for a stranger and wrong for an agent whose
  custody is already settled; one rule for both acts is what made an agent's
  fifth canvas as hard as its first.
- **2026-09-15** — The reducer preserves `rules` AND `writtenBy` on an invite
  to an already-standing agent. Re-stamping `writtenBy` would hand the inviter
  authorship of a gate somebody else wrote — widening `listen` by the back
  door. All three preservations were mutation-checked; each fails a test.
- **2026-09-15** — `EnrolledAgent.invitedFrom` is written and read by nothing,
  deliberately. The moment anything reads it to decide reach or a right to
  summon, `agent-custody`'s fence has a hole. It is provenance for a person.
- **2026-09-15** — `op-types` read 36 in the persona while `ops.ts` held 40:
  four ops arrived from design-partner without raising the bound, so the
  nightly reported a miss nobody had written down. The bound is now 41 and
  those four are still owed an argument by the project that added them.
- **2026-09-15** — Open: phase 0 pushed `unused-exports` past its ceiling (45
  against 39) and reached `main` red, found only when this phase gated. Paid
  the same day by un-exporting the seven — none had a caller outside
  `bench.ts`. The ceiling was NOT raised. A phase that gates green on its own
  base can still cross a SHARED ceiling when other projects land beside it.
- **2026-09-15** — `packages/cli/test/bench.test.ts` crossed the ten-second
  line (7.5s → 12.9s) and moved to `DEEP`, so the phase's CLI proof no longer
  runs in `npm test`. `test:deep` and CI still run it.

---

## Phase 2 — join from chat

**Status: CLOSED.** 15 September 2026 — `@Name join` is a command chip in the
composer, sending phase 1's `agent.invite` and no new op, and the refusal is
leak-proof by construction rather than by wording.

**Work.** `@Name join` as a command chip, over the existing
`findCommandSpans`/`findMentionSpans` machinery. Mention candidates gain the
asker's bench, marked so the composer can show *not here yet*. The thread gets
one line when the join lands, because the canvas is the only channel.

**Proof.** `@Sian join` from Sian's owner resolves and enrols; the same line
from somebody else resolves nothing and is refused with *"Sian is not on your
bench"* — never *"unknown name"*, which would leak the shape of a private
canvas. A test asserts the refusal wording, because the wrong wording here is
an information leak rather than a typo.

**Closes.** Journey 3.

### Trajectory

- **2026-09-15** — The refusal takes the name and NOTHING else, and a test pins
  its arity and its body. Leak-safety is the absence of an argument rather than
  a filter somebody must remember: with no second input there is nothing from
  which "on another bench" and "nowhere" could be told apart. Both mutations
  were checked — adding an argument fails, and so does the wording.
- **2026-09-15** — A refused `@Name join` is answered to the asker and posted
  NOWHERE. Putting the refusal in the thread would tell the whole canvas which
  names somebody tried, which is the same probe by a second route.
- **2026-09-15** — The thread's line is written only on an ACCEPTED receipt,
  never from the optimistic echo. `sendEchoed` applies locally first, so a
  store read-back would have posted "she answers here" for an invite the home
  refused.
- **2026-09-15** — The chat join's core vocabulary is its own module, not more
  exports on `bench.ts`. Merged, the entry chunk grew 3,936 bytes because a
  composer is eager and `bench.ts` is not. **The eager half of a feature has to
  be a separate file from the lazy half** — `bundle-ceiling.mjs` already taught
  this once as `arrow.ts`, and an import is all it takes to undo the split.
- **2026-09-15** — Bench candidates reach the composer only; `rehypeChips`
  keeps the canvas's own. A rendered body is read by everybody and a bench by
  one person, so a bench-drawn chip would be one nobody else's browser agrees
  with.
- **2026-09-15** — Open: a plain `@Sian hello` chips in the composer but stores
  no mention, because `makeComment` reads the canvas roster. That is the safe
  side — storing it would be the first thing to read a bench row as reach — but
  composer and comment now disagree about whether the name resolved. Decide it
  deliberately rather than by widening `makeComment`.
- **2026-09-15** — `CEILING` 743,900 → 745,000, agreed by Dion with the
  arithmetic in front of him rather than after the fact. Margin is 84 bytes and
  the reason says so: the next composer change raises it again and argues,
  rather than inheriting headroom nobody agreed to.

---

## Phase 3 — enrolment writes its own row

**Status: NOT STARTED.**

**Work.** Enrolling an agent anywhere — `isocan agent add`, the rc's
handshake, a join — writes or updates its bench row, so the registry fills
itself. Decide and record whether withdrawal removes the row or marks it.

**Proof.** An agent added the old way appears on the bench without anyone
touching the bench. Withdrawing it leaves the bench in the state the phase
decided, with the decision recorded in `design.md`'s Open. A bench with no
personal canvas yet does not fail the enrolment — the registry is a
convenience and must never be able to break the act it records.

**Closes.** The residue of journey 1 — a bench that is true without being
curated.

---

## Not in this project

**Journey 4, the rc in a cell.** It is written in `journey.md` so these four
phases do not forbid it, and it is somebody's next project. It needs a
long-lived credential at the isocan door whose blast radius is undecided
(`ISOCAN_BEARER`, and the same question sheep asks), and a Cloudflare account,
which is provisioning: asked with a price, before it is taken.
