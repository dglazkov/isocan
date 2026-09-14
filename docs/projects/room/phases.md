# The room — the walk

**13 September 2026.** The order of work for [design.md](design.md).
Each phase ends with **Trajectory**: only what the phase discovered
that changes the project's course. A phase that went as planned leaves
it empty.

**Where we are: every phase CLOSED by 14 Sep 2026. The laptop's `isocan rc` runs over `runRoom` and the module's `SheepAgent` in `isocan/rc`; a worker bundles it from `#release`; a second rc leaves another machine's agents alone; agent keys are machine-keyed. Journeys 1, 2 and 3 are walked. What remains is Open, not a phase: isocan.io carrying phase 3.5, and an rc from before phase 3 against an upgraded home.** Seven phases, none
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
- **2026-09-13** — Open: when an adapter's fence or spawn throws, the face stays on, its heartbeat never stops, and the session pointer is not taken back; true before the move and kept byte-for-byte. Waits on a decision about what a failed open owes the thread; [#298](https://github.com/dglazkov/isocan/issues/298).

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

**Status: CLOSED 2026-09-13.** `parkClaim` and `rcHold` refuse `not-your-actor` for an actor the badge does not hold. The room claims its own rows' agents before parking, and says once of any other agent that it is not held by this machine. Two real rcs on one canvas answer their own agents with no cursor trade.

**Outcome:** the claim rule, as decided in design.md. `/api/park/claim`
and `/api/rc/hold` refuse, with `not-your-actor`, an actor the
presenting badge does not hold. The room parks each agent's cursor at
start and at each adoption. For an agent in this machine's own rows it
claims the actor under its own key first. It reads a `not-your-actor`
from `parkClaim` and remembers it under `state`. It narrates `<name> is
not held by this machine — a pass from whoever holds <name> hands it
over` once, and
it holds, faces and dispatches nothing for that agent. An agent later
handed over by a pass is picked up at the next start; the room does not
poll for it.

**Proof:**
- `packages/server` gains a test that a badge refused the actor gets
  `not-your-actor` from `parkClaim` and from an `rcHold` naming it, and
  that a badge holding the actor is unaffected.
- A new case in `rc.test.ts` runs two rc processes on one canvas with
  two badges, the second's roster holding an agent the first's badge
  claimed. The second narrates the line once and never dispatches. A
  summons for that agent is answered by the first, with no failed turn,
  no turn-away and no system-voice reply from the second. A summons
  for the second's own agent is answered by the second. The cursor
  never changes hands. Dropping the route check reads the tug of war.
- `room.test.ts` gains the same over in-memory deps, with a `routes`
  that refuses the park. It also checks the refusal is remembered
  across a second `runRoom` over the same `state`, and that an agent in
  this machine's rows is claimed before it is parked.
- Existing `rc.test.ts`, `rc-sheep` and `rc-sheep-withdrawal` cases
  pass unchanged, except the three that enrol an orphan and expect it
  adopted ("a web add … gets its rc half", "an rc that starts late
  reconciles the enrolments it missed", "the web's withdraw, seen by a
  parked rc, ends the sheep"). Those now enrol the way web Add does.
  `home-link.test.ts`'s hold of an actor its badge does not hold now
  claims that actor first.

**Trajectory:**

- **2026-09-13** — Premise reversed: the desk accepts a second badge's `actor.claim` under the shared `agent:<name>` key (same-key vouch, lost-badge recovery), so the room never reads `not-your-actor`. Two rcs trade the cursor through unchecked `parkClaim`/`rcHold` instead. Probes against a real daemon; design.md, the claim rule.
- **2026-09-13** — Decided (Dimitri): the refusal comes from `parkClaim`/`rcHold` requiring the actor, and derivable agent keys become machine-keyed (phase 3.5); the desk's same-key recovery stays. Tradeoffs in design.md, the claim rule.
- **2026-09-13** — Orphan enrolments are inert (Dimitri): unheld cannot be told from held elsewhere without claiming. The line says "not held by this machine"; three rc tests that adopted orphans now claim the actor on the rc's badge first.
- **2026-09-13** — A hold refused mid-room means this badge lost claims (a re-badge re-claims only the person). The room re-claims its own rows' agents under their keys and retries once, and never calls its own agents not held.
- **2026-09-13** — Open: an rc from before this phase parks and holds before claiming, so against an upgraded home, a web-adopted agent it never summoned refuses its whole hold until its upgrade window lands. Not exercised by phase 5's walks (no pre-phase-3 rc was running); waits on the first such rc a person runs.

**Formerly:** the room claimed each agent's actor at start and read
`not-your-actor` from the claim. Re-cut on 13 Sep 2026, when the desk
turned out to accept that claim.

## Phase 3.5 — Keys nobody else derives

**Status: CLOSED 2026-09-14.** Agent keys are `agent:<mac>` from `~/.isocan/agent-secret`; agents move at `isocan rc` start (seven moved on Dimitri's home in the walk) and at enrolment; a second badge presenting `agent:<name>` is refused after the move; a dual-held agent is not held here; the hosted measurement ran on dev.

**Outcome:** an agent's session key is a keyed hash of a secret kept in
this machine's `~/.isocan` and the agent's name. Enrolment, the room's
claim and the environment injected into a turn all present it. The
same machine derives the same key, so re-enrolling after a withdrawal,
enrolling on a second canvas and lost-badge recovery hand back the same
actor. Existing agents are rebound to the new key by the badge that
holds them, and their rows under `agent:<name>` are retired, so the old
key stops working. Another machine's claim under the old or the new
key is refused.

**Proof:**
- A server or CLI test: a second badge presenting `agent:<name>` for an
  enrolled agent is refused after migration, while it was allowed
  before.
- The machine that enrolled the agent still claims it after a
  re-badge.
- Re-enrolling the same name from the same machine returns the same
  actor.
- A turn's injected environment speaks as the agent.
- The rc tests pass unchanged except where they spell `agent:<name>`,
  and each such change is named.
- Measured once on dev.isocan.io with a second badge, as an Open entry
  if that badge needs a person: whether admission narrowed the old
  hole there.

**Trajectory:**

- **2026-09-13** — Retiring `agent:<name>` needs no desk op: `bindClaim` keeps one row per actor per badge, so claiming the machine key with `as` from the same badge drops the old row. The move runs at `isocan rc` start and at enrolment.
- **2026-09-13** — An agent another badge also holds under `agent:<name>` cannot move, and its summons failed where it ran before. Decided (Dimitri): not held here, the phase 3 line, no claim or dispatch; transient refusals (the minute after, a live face) are not that.
- **2026-09-13** — The desk's `name-taken` refusal of `as` now carries `reason` (`held-elsewhere`, `claimed-just-now`, `live`), held-elsewhere first; the room reads it rather than the sentence. A field on an existing refusal, not an op.
- **2026-09-14** — The line dropped "or re-add it here" (Dimitri), untrue on a machine still holding a dual-held agent under its old key: now "a pass from whoever holds <name> hands it over".
- **2026-09-14** — Measured on dev.isocan.io: admission does not narrow the old hole; a fresh door badge claiming another badge's actor under the same derivable key got 200, a different key 400 `held-elsewhere`. Only agents moved to machine keys are closed.
- **2026-09-14** — Open: an agent is closed only once the home runs phase 3.5 and its owner's rc has moved it; isocan.io and every rc not yet upgraded keep the old key. Waits on a prod deploy and on each owner's upgrade.

## Phase 4 — The bundle a host installs

**Status: CLOSED 2026-09-13.** A host that installs `isocan` from `release` and bundles `import "isocan/rc"` for the browser gets the module: the `browser` condition names the release-built bundle, the installed-tree test holds it, and the walk below passed.

**Outcome:** a host that installs `isocan` from `release` and bundles
`import "isocan/rc"` for the browser platform gets the module, not the
Node shim. The root manifest's `./rc` export gains a `browser`
condition, ahead of `default`, that names an ESM bundle of
`packages/rc/src/index.ts`. `@isocan/core` is inlined, and the bundle
has no `node:` import. `scripts/release.mjs` builds that bundle with
esbuild and commits it to the release branch, the way it commits
`packages/web/dist`. On main the `browser` condition names the source
entry, which a bundler in the checkout can resolve. `default` stays
`rc.mjs` for Node.

**Proof:** a test over the release half, run against a scratch
installed tree: the manifest `releaseManifest` writes, and the bundle
the release step builds, laid out as `node_modules/isocan`. A one-line
`import "isocan/rc"` then bundles through esbuild with
`platform: "browser"` and no `node:*` external allowed, and exits
clean. It is falsified by removing the `browser` condition, which
reads `node:module` from `rc.mjs`. The boundary test and the no-Node
typecheck still pass. `npm test`, `npm run test:deep` and
`npm run typecheck` pass whole. Walked after it lands and CI rebuilds
`release`: from a scratch directory, `npm install
github:dglazkov/isocan#release`, `node -e 'import("isocan/rc")'`
exits 0, and `esbuild --bundle --platform=browser` over a one-line
file importing `isocan/rc` exits 0 with no `node:` among the bundle's
externals, output recorded here.

**Trajectory:**

*nothing beyond the re-cut recorded under Formerly.*

**Walked 13 Sep 2026** against `release` at d8ec18b, from a scratch
directory:
- `npm install github:dglazkov/isocan#release` exits 0. The `./rc`
  export is `{ types: ./types/rc/src/index.d.ts, browser:
  ./packages/rc/dist/index.mjs, default: ./rc.mjs }`, and the bundle
  is 143,431 bytes.
- `node -e 'import("isocan/rc")'` gives 16 exports and exits 0.
- `esbuild entry.mjs --bundle --platform=browser --format=esm
  --metafile=meta.json` over `import "isocan/rc";` builds `out.js` at
  82.8 KB and exits 0. The inputs are `entry.mjs` and the bundle, the
  externals list is `[]`, and `node:` appears 0 times in the output.

**Formerly:** phase 4 was "The bundle, and the walk": journeys 1, 2 and 3
walked together after phase 3. Re-cut 13 Sep 2026, when journey 3's
walk against `release` at e4af490 failed. `esbuild --platform=browser`
resolved `isocan/rc` to `rc.mjs` and could not resolve `node:module`,
`node:crypto` (tsx) or `@isocan/rc`. The boundary test bundled the
source entry, never the package as a host installs it. The bundle is
this phase; the walks of journeys 1 and 2 are phase 5.

## Phase 5 — The walks

**Status: CLOSED 2026-09-14.** Journeys 1, 2 and 3 walked: journey 1 on dev.isocan.io from Dimitri's own home with a claude-code turn and a sheep turn on a redeployed sheep-2, journey 2 with two real rcs, journey 3 against `release`.

**Outcome:** journeys 1 and 2 walked, after phases 3 and 3.5 land. Journey 1
on this laptop against dev.isocan.io, with one agent on `claude-code`
and one on `sheep`, a turn each, then the sheep agent withdrawn: the
narration and the record on disk read as before. Journey 2 with two
rcs on one canvas, two loopback badges on this laptop standing in for
the second machine. Journey 3 is walked again against the `release`
that carries phase 3.

**Proof:** the walks, recorded against the journeys' acceptance lines.
`npm test`, `npm run test:deep` and `npm run typecheck` pass whole.

**Walked 13–14 Sep 2026.**

- **Journey 2.** A scratch daemon on port 4571 served two homes, one
  per machine: Nico's with Percy and Wren's with Wendy, both on
  `claude-code` and started with the checkout's CLI.
  - Each rc said the other's agent exactly once: "Wendy is not held by
    this machine — a pass minted for Wendy hands it over, or re-add it
    here", and the same for Percy.
  - `@Percy` from Nico was answered by the first rc ("Hello Nico, Percy
    here…"). `@Wendy` from Wren was answered by the second.
  - Neither log has a failed turn, "could not hold", "another park
    adopted", "retrying" or a system-voice comment.
  - The first rc was then stopped, and a new `@Percy` got nothing from
    the second, which had stayed quiet overnight (about 10 hours, 18
    lines).
  - Acceptance held: one sentence naming the agent and the pass, and
    never claimed, faced or dispatched.
- **Journey 1.** On dev.isocan.io at c80959e, from Dimitri's own
  `~/.isocan`, with the laptop's daemon restarted on 70b83aa. sheep-2
  was redeployed at sheep d663fcb first, with Dimitri's yes.
  - The rc opened on "Acme Room Walk": "5 harnesses here … every agent
    enrolled here named its own", "7 agents moved to this machine's own
    keys (Percy, Ziggy, Pepper, Timmy, Bramble, Shirley, Lamb)",
    answering on the canvas, listen policy, and "Shaun's sheep will
    live at https://sheep-2.dglazkov.workers.dev".
  - `@Quill` on claude-code: summons, session started, a reply as Quill
    ("Acknowledged — I'll take another pass at the empty-state copy…"),
    turn ended.
  - `@Shaun` on sheep: "sheep 01a08e18… is already in pasture
    isocan-shaun — resuming it rather than birthing a second", "has
    never run setup … installing isocan", "session resumed", "setup
    running …", "setup ok (3m 10s)", a reply as Shaun, turn ended.
  - `isocan rc remove Shaun` ended the sheep ("its container and
    workspace are gone") and kept the pasture ("stays — it is yours").
    Because the sheep was resumed and not born, no pass was recorded, so
    the rc said the cell's badge is not known here and named `isocan
    badges --kill`, and that badge was ended by hand. That path predates
    this project: `bornPass` was set only at a birth before the move too.
  - `rc-agents.json` had the same set of fields before and after
    (`actorId, canvasId, cellPass, cwd, harness, name, sessionId,
    sheep`), and the only row added was Quill's.
- **Journey 3, again.** Against `release` at c80959e, which carries
  phases 3 and 3.5: the install exits 0, `import("isocan/rc")` gives 15
  exports (`enrolmentKey` left in phase 3.5), and the browser one-liner
  exits 0 with inputs `entry.mjs` and the bundle, externals `[]` and no
  `node:`.

**Trajectory:**

- **2026-09-14** — Walked on the real home by Dimitri's choice. The rc's first start moved seven agents across his homes to machine keys, as decided in phase 3.5.

## Later, and not here

The host: a Worker with a Durable Object beside a sheep station,
sheep#12, and the custody argument for a room nobody started. `isocan
pass --agent <name>`, the hand-over. Each is a project or an issue of
its own; this one ends when the laptop's rc runs over the module and a
browser-platform bundle of it builds.
