---
status: designed
since: 2026-09-14
issue: 309
see: bench, standing-agents, on-demand, agent-custody, sheep-harness, room, memory, inbox
note: phase 0 closed 15 Sep 2026 — the bench is items on the personal canvas, `isocan bench`/`add`/`rm` and **Your bench…** read one derivation in core, and the three states come from three different facts. Four phases, none of which provisions anything or spends money. Phase 0 was the registry and its three-state reachability; phase 1 joins from the panel with `agent.invite` and moves op-types 36 → 37; phase 2 joins from chat; phase 3 makes enrolment write its own rows. The rc in a cell is journey 4 and is NOT here.
---

# The bench — the phases

**Where we are, 15 September 2026.** **Phase 0 is CLOSED** — the bench exists,
on both surfaces, and reachability is measured rather than asserted. Phase 1 is
next (`bench phase 1`), and it is the one that moves `op-types` 36 → 37 for
`agent.invite`. Nothing waits on a person and nothing waits on another project.
One debt is open and named in phase 0's trajectory: the two surfaces measure
from different inputs, and closing that needs a daemon route nobody owns yet.
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

**Status: NOT STARTED.**

**Work.** `agent.invite` in the op vocabulary, its reducer case, its inverse
(refuses, beside `agent.enroll`), `touches.ts`, `opwords.ts`. `op-types` moves
36 → 37 in `.agents/personas/architect.md` **with the argument from
`design.md` written beside it**. `isocan bench join <name>` on the CLI and a
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

---

## Phase 2 — join from chat

**Status: NOT STARTED.**

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
