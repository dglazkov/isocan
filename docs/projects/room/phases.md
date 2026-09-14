# The room — the walk

**13 September 2026.** The order of work for [design.md](design.md).
Each phase ends with **Trajectory**: only what the phase discovered
that changes the project's course. A phase that went as planned leaves
it empty.

**Where we are: phases 0–2 CLOSED 13 Sep 2026; the laptop's `isocan rc` runs over `runRoom` and the module's `SheepAgent` in `isocan/rc`. Next: room phase 3, answered elsewhere, which waits on Dimitri: the desk accepts a second badge's claim, so where the refusal comes from is a custody decision (design.md, the claim rule).** Five phases, none
needing a person: no ⚑ step, no cloud resource, no second machine
except journey 2's walk, which two loopback badges on one laptop can
stand in for (the roles project's proof recipe). The rule for every
phase: `packages/cli/test/rc.test.ts`, `rc-sheep.test.ts` and
`rc-sheep-withdrawal.test.ts` pass unchanged (save `rc.test.ts`'s two
source-shape describes, which phase 1 moves to `room.test.ts`), and the boundary test is
in the suite from phase 0 on, so a `node:` import cannot land in the
module by accident at any later phase.

## Phase 0 — The workspace

**Status: CLOSED 2026-09-13.** `@isocan/rc` holds the guards, the row types, the pure helpers and `COLLAB_SKILL`; the boundary test, the manifest test and the skill test are in the suite, and the rc tests pass unchanged.

**Outcome:** `packages/rc` exists, is exported from the root manifest as
`isocan/rc` beside `.`, resolves through `packages/cli/bin/workspace-loader.mjs`
on main, and survives `scripts/release.mjs`'s pruning of the release
manifest. It holds what needs no design to move: `gateTurn` and the
guard types from `rc.ts`, `RcAgentRow` and `SheepPlace` as types,
`itemCenter`, `threadLocus`, `nameResolver`, `summonsPrompt` from
`main.ts`, and the collab skill's text as a generated constant. `rc.ts`
and `main.ts` import them back from `@isocan/rc`. `rc.mjs` at the root
mirrors `index.mjs`.

**Proof:** `packages/rc/test/boundary.test.ts`: the transitive closure
of `packages/rc/src/index.ts` names no `node:` module and no
`@isocan/server` export, and an esbuild browser-platform bundle of the
entry builds with no `node:` in its output; falsified by adding
`import "node:fs"` under `packages/rc/src`. `packages/cli/test/guards.test.ts`
passes over the moved `gateTurn`. A test over the manifest
`scripts/release.mjs` writes: `exports["./rc"]` is present with its
`types` re-aimed at the emitted `.d.ts`, and the emitted types include
`packages/rc`. A test that the skill constant equals
`.agents/skills/isocan-collab/SKILL.md`. `npm test` and
`npm run typecheck` whole.

**Trajectory:**

- **2026-09-13** — The boundary walk follows `@isocan/*` through each workspace's `exports`, and `@isocan/api`'s root re-exports `client.ts` and `connect.ts`, which reach `node:` and `@isocan/server`. Phase 1's `routes` dep comes through an api subpath that reaches `routes.ts` alone; added to its Outcome.
- **2026-09-13** — The walk and the bundle read imports only, so a bare `process` or `Buffer` under `packages/rc/src` passes both: the workspace's tsconfig carries Node's types for its tests. Phase 1's Proof gains a typecheck of `src` without them.
- **2026-09-13** — Moving `askTheDoor` and `bearerHeader` to `@isocan/api` for `@isocan/server` to import back is a cycle, since `api` depends on `server`. They move to `@isocan/core`; phase 1's "api no longer imports server" narrows to `routes.ts`'s closure.

## Phase 1 — The room over its deps

**Status: CLOSED 2026-09-13.** `runRoom(deps)` is the room; `main.ts` builds the laptop's deps around it, `routes.ts` no longer imports `@isocan/server`, `packages/rc/src` typechecks without Node's types, and `room.test.ts` runs eight cases over in-memory deps and a hand clock.

**Outcome:** `runRoom(deps): Room` in the module, the whole of
`runRcRoom` minus the laptop, with `RoomDeps` as design.md lists them:
`routes`, `canvas`, `owner`, `rows`, `adapterFor`, `endSession`,
`narrate`, `state`, `limits`, `clock`, `sleep`. `DaemonRoutes` takes its
badge store as a constructor parameter, `askTheDoor` and `bearerHeader`
move to `@isocan/core` with `@isocan/server` re-exporting them, and
`routes.ts`, with everything it reaches, no longer imports
`@isocan/server`. The room imports nothing from `@isocan/api`: its
`routes` is an interface the module declares over core's types,
`ApiError` moves to core, and the laptop's `ctx.client` is checked
against the interface where it is passed. `main.ts`'s
`runRcRoom` becomes the laptop's consumer: it builds the deps from
`ctx`, the file-backed rows, the file-backed badge store, an
`adapterFor` that fences, scans and spawns, a `narrate` that prints, a
`Map` for state, and wraps the call with the upgrade window, the
session pointer file and the daemon restart. The `rc` command's action
is unchanged.

**Proof:** `rc.test.ts` passes unchanged but for its two source-shape
describes of the startup window, which become behavioural cases in
`room.test.ts`: an enrolment landing between the opening and the start
tip is adopted and claimed with the same sentence as any other, and a
withdrawal there is reaped. The boundary test now covers
the room and still passes, and `packages/rc/src` typechecks under a
tsconfig with no Node types, falsified by a bare `process.env` there. `packages/api/test/boundary.test.ts` gains
`@isocan/server` to its forbidden list for `routes.ts`. A new
`packages/rc/test/room.test.ts` over in-memory deps and a hand-advanced
clock: a summons is dispatched to the adapter the deps name and the
reply lands through `routes`; `stop()` ends the hold and both polls
within one tick; a second `runRoom` over the same `state` does not
re-narrate what the first said and keeps the first's guard; a
`routes` that refuses with a lost connection is retried with no
`ensureDaemon` in sight. A night of the guard's window in under a
second by the clock.

**Trajectory:**

- **2026-09-13** — Reversed phase 0's subpath entry: `routes.ts` uses `Buffer` in its blob methods, so a room importing it fails the no-Node typecheck. The room declares its routes as an interface over core's types, `ApiError` moves to core, and nothing of `@isocan/api` is in the module's closure.
- **2026-09-13** — `rc.test.ts` held two source-shape describes that read `main.ts`, so "passes unchanged" could not survive the move. They become behavioural tests in `room.test.ts`, where in-memory deps can force the startup window the spawned CLI could not.
- **2026-09-13** — `RoomDeps` grew past design.md's list: `origin`, `cwd`, `whereOf`, `enrol`, and a two-stage `adapterFor`, because the face and the pointer loan sit between naming a harness and spawning it. `Room` gained `done`. design.md now lists them.
- **2026-09-13** — Open: when an adapter's fence or spawn throws, the face stays on, its heartbeat never stops, and the session pointer is not taken back; true before the move and kept byte-for-byte. Waits on a decision about what a failed open owes the thread.

## Phase 2 — The sheep over commands

**Status: CLOSED 2026-09-13.** The sheep's policy is `SheepAgent` and `endSheep` over `SheepCommands` in the module; `sheep.ts` keeps the kennel, the cell's loopback and the `spawn("sheep")` implementation, and the rc sheep tests pass unchanged.

**Outcome:** `SheepAgent` moves from `packages/cli/src/sheep.ts` into
the module, rewritten over `SheepCommands` as design.md gives it, so
the pasture, the setup script, the brief, the skill, the secret with
its fallback, the herd read before a birth, the beats from `attach`'s
stream, and `rm` with `abort` for a home from before are written once.
`sheep.ts` keeps the laptop's half: `findKennel`, `kennelHome`,
`sheepPlaceFor`, the `loopbackFromCell` read, and a `SheepCommands`
implementation over `spawn("sheep", …)` with `SHEEP_HOME` and
`SHEEP_TOKEN` stripped and the kennel's directory as cwd. The laptop's
`adapterFor` returns the module's `SheepAgent` over that implementation
for a row naming `sheep`, and `endSession` is `withdrawSheep` over the
same.

**Proof:** `rc-sheep.test.ts` and `rc-sheep-withdrawal.test.ts` pass
unchanged against the fake `sheep` on PATH. `packages/rc/test/sheep.test.ts`
over an in-memory `SheepCommands` that records its calls: a birth is
`mint` with the pass among the secrets and no prompt, then `attach`
with the summons; a sheep found in the herd is resumed with no `mint`;
a home that drops the secret gets `pastureSecret` and one sentence;
withdrawal is `rm`, which ends a running turn itself, and at a home
from before `rm` the listing and then `abort`; the pasture is never
removed. The boundary test still passes with `SheepAgent` in the
closure.

**Trajectory:**

- **2026-09-13** — `SheepCommands` is not design.md's as written: `mint` answers an id (whether the secret held is read with `session`), `attach` takes no signal, `abort` answers whether a turn ran, and `SheepAgent` takes its place as a sentence from the host. design.md now says so.

## Phase 3 — Answered elsewhere

**Status: NOT STARTED.** Nothing built; the premise was measured false before any code, and the phase waits on a custody decision.

**Outcome:** the claim rule. At start and at each adoption the room
claims each agent's actor once, reads `not-your-actor`, remembers it
under `state`, narrates `<name> is answered elsewhere; a pass minted for
<name> hands it over` once, and parks no cursor, puts on no face and
fails no turn for that agent. The room reads the refusal itself: either
the claim goes through a route the client does not heal, or the
client's `reclaimIdentity` is told the claim is the room's, decided by
what `DaemonClient` allows and recorded here. An agent later handed
over by a pass is picked up at the next start, since the pass is a
later issue and the room does not poll for it.

**Proof:** a new case in `rc.test.ts`: two rc processes on one canvas
with two badges, the second's roster holding an agent the first's badge
claimed; the second narrates the line once and never dispatches, a
summons for that agent gets no failed turn and no system-voice reply
from the second, and a summons for the second's own agent is answered.
Falsified by dropping the rule, which reads a failed turn where the
line should be. `room.test.ts` gains the same over in-memory deps with
a `routes` that refuses the claim, and checks the refusal is
remembered across a second `runRoom` over the same `state`.

**Trajectory:**

- **2026-09-13** — Premise reversed: the desk accepts a second badge's `actor.claim` under the shared `agent:<name>` key (same-key vouch, lost-badge recovery), so the room never reads `not-your-actor`. Two rcs trade the cursor through unchecked `parkClaim`/`rcHold` instead. Probes against a real daemon; design.md, the claim rule.
- **2026-09-13** — Open: where the refusal comes from — the desk's same-key vouch, a new desk query beside `actorBindings()`, and/or `parkClaim`/`rcHold` refusing an actor the badge does not hold. A custody rule; waits on Dimitri.
- **2026-09-13** — Open: because an agent's session key is derivable from its name, the same-key recovery path lets a badge other than the enrolling one take up the agent's actor; seen on a solo loopback daemon, unmeasured on a hosted home. Waits on Dimitri.

## Phase 4 — The bundle, and the walk

**Status: NOT STARTED.**

**Outcome:** journeys 1, 2 and 3 walked. Journey 3's install and bundle
from a scratch directory against the `release` branch, which CI
rebuilds from every push to main, so this phase waits one CI run after
phase 3 lands. Journey 1 on this laptop against dev.isocan.io with one
agent on `claude-code` and one on `sheep`, a turn each, then the sheep
agent withdrawn: the narration and the record on disk read as before.
Journey 2 with two rcs on one canvas, two loopback badges on this
laptop standing in for the second machine.

**Proof:** from a scratch directory, `npm install
github:dglazkov/isocan#release`, then `node -e 'import("isocan/rc")'`
exits 0, then `esbuild --bundle --platform=browser` over a one-line
file importing `isocan/rc` exits 0 with no `node:` among the bundle's
externals, output recorded here. The three walks, recorded against the
journeys' acceptance lines. `npm test` and `npm run typecheck` whole.

**Trajectory:** to be written at close.

## Later, and not here

The host: a Worker with a Durable Object beside a sheep station,
sheep#12, and the custody argument for a room nobody started. `isocan
pass --agent <name>`, the hand-over. Each is a project or an issue of
its own; this one ends when the laptop's rc runs over the module and a
browser-platform bundle of it builds.
