# The room

**13 September 2026.** Design, written from
[#294](https://github.com/dglazkov/isocan/issues/294) and a read of
`runRcRoom` the same day. The project's status lives in
[journey.md](journey.md)'s front matter. The journeys are the
acceptance suite, this doc is the argument, [phases.md](phases.md) the
walk.

The thesis in one line: **the rc's room is a loop over a cursor, a
hold and a prompt, and only the prompt was ever laptop-shaped.** The
sheep harness moved the prompt into a cell. What keeps the loop on the
laptop now is where it is written, inside `packages/cli/src/main.ts`,
reaching for the disk, the process table and the terminal directly.
Move it into a module that is handed those things, and the laptop's
`isocan rc` becomes one host of it.

## Where this stands with what came before

[on-demand/design.md](../on-demand/design.md) sketched "isocannery", a
hosted `isocan rc`, and said the local rc should be built first so the
remote one is a deployment and not a design.
[#210](https://github.com/dglazkov/isocan/issues/210) named a parked rc
inside a cell as its shape 2 and set it aside because it reopened the
custody argument. [sheep-harness](../sheep-harness/design.md) built a
fourth shape, the rc on the laptop and the sheep as the agent's
machine, and left the rc in a cell as its first open door: "with turns
already in sheep, the rc is the last laptop process."
[sheep#12](https://github.com/dglazkov/sheep/issues/12) asks for that
host from the sheep side.

This project is the step before the host. It ends when the laptop's rc
runs over the module and a browser-platform bundle of the module
builds. No host is built, and no custody rule changes: the room is
still started by somebody, on a machine that holds a badge, and every
turn it dispatches is by an actor that badge holds. What a host does
with the module is the host's, and the custody argument for a room
nobody started is that host's project to make.

## What is laptop-shaped in the room today

`runRcRoom` is about 1,050 lines of `main.ts`, `async (ctx, canvas,
shared) => never`. Everything it decides with is already in
`@isocan/core`: `dispatchReason`, `answerPolicy`, `turnedAway`,
`speakersFor`, and the rest, none of which imports `node:`. What it
reaches for that a host without Node cannot supply:

| Reach | Where | Becomes |
| --- | --- | --- |
| `console.log`, through `rcLine` | some forty sites | `deps.narrate(line)` |
| `process.cwd()`, `process.env` | the room's start | values the caller passes |
| `readRcAgents`, `adoptRcAgent`, `setRcSessionId`, `removeRcAgent`, and `setRcCellPass` through `withdrawSheep` | `rc.ts`, on `rc-agents.json` | `deps.rows`, an interface with those verbs |
| `AcpAgentProcess.spawn`, `SheepAgent.spawn` | the first summons | `deps.adapterFor(row)` |
| the session pointer file, read and written around a turn | `readSessionFile`, `writeSessionFile` | stays in `main.ts`, around the call |
| `autoUpgrade`, `considerUpgrade` | the start and each wake | stays in `main.ts` |
| `fenceSpec`, `fenceNote` | the first summons | stays in `main.ts`, inside the laptop's `adapterFor` |
| `scanHarnesses`, `onPath("sheep")` | the start | stays in `main.ts`, inside the laptop's `adapterFor` |
| `ctx.client.ensureDaemon()` | when the daemon stops answering | stays in `main.ts`; the room retries |
| `skillSource()` reading `SKILL.md` | the sheep birth | the module exports the text |
| `withdrawSheep` | withdrawal of a sheep-harnessed agent | `deps.endSession(row, narrate)` |

Two of the issue's names are already outside the room:
`settleDefaultHarness` and the `harnessSessions` refusal run in the `rc`
command's action before any room starts, and stay there.

Four pure helpers live in `main.ts` by accident of history: `itemCenter`,
`threadLocus`, `nameResolver`, and `summonsPrompt`, the last a closure
inside the room that captures the canvas title. `gateTurn` in `rc.ts`
has no imports at all and a test of its own, `guards.test.ts`. All five
move into the module unchanged.

`RcShared`, what the rc holds across rooms, is the guards per agent,
the session ids, whose word each agent's latest turn carries
(`origins`), the upgrade state and the stand-downs. The first three are
the room's; the upgrade is the laptop's.

## The module

### `packages/rc`, exported as `isocan/rc`

A new workspace beside `api`, `core`, `server` and `cli`. The root
manifest gains `"./rc"` beside `"."`, with a `types` entry at
`packages/rc/src/index.ts` and a default at `rc.mjs`, a mirror of
`index.mjs`: register tsx and the workspace loader, import
`@isocan/rc`, re-export by name, because a static `export *` resolves
before the loaders register
([iso-api phase 4](../iso-api/phases.md) found that).
`packages/cli/bin/workspace-loader.mjs` gains one map entry.
`scripts/release.mjs` today rewrites only the `"."` export's `types` and
emits types for three workspaces; it learns to loop over every export
key and to include `packages/rc/src`. Whether `./rc` survives the
release manifest is a test over the manifest the script writes, not a
push.

### `runRoom(deps): Room`

The whole of `runRcRoom` minus the laptop. `Room` is `{ stop(): Promise<void>;
done: Promise<void> }`: `stop` aborts both long polls, the hold and every
sleep, then ends the room's announcement session; `done` settles when the
room ends, and rejects with what ended it, so a refusal the daemon
answered still ends `isocan rc`. `RoomDeps`:

- `routes`: the daemon routes the room calls, as an interface the module
  declares over `@isocan/core`'s request and response types:
  `snapshot`, `getLog`, `watchLog`, `sendOp`, `claimActor`,
  `actorBindings`, `createSession`, `updateSession`, `endSession`,
  `parkClaim`, `parkDelivered`, `parkAdvance`, `rcHold`. The module
  imports nothing from `@isocan/api`: `routes.ts` names `Buffer` in its
  blob methods and calls `Buffer.from` at run time, which a host has
  no use for and a no-Node typecheck refuses. The laptop hands the room
  `ctx.client`, and the compiler checks `DaemonClient` against the
  interface at that call, so the two cannot drift. `ApiError`, which the
  room reads refusals by, moves to core with `@isocan/api` re-exporting
  it, so `instanceof` still holds. A host implements the interface over
  its `fetch`, or constructs `DaemonRoutes` if it can carry it.
  `DaemonRoutes` itself is still made host-shaped here: it is fetch-only
  by its own rule and by `packages/api/test/boundary.test.ts`, but it
  still imports four things from `@isocan/server`: `readBadge` and
  `writeBadge`, which read a file, and `askTheDoor` and `bearerHeader`,
  which are a fetch and a pure function that happen to live in
  `badge-store.ts`. The first two become a constructor parameter,
  `badges: { read(): Promise<StoredBadge | null>; keep(badge): Promise<void> }`,
  with the file-backed store as the CLI's argument. The other two move
  to `@isocan/core`, beside the door vocabulary they already speak
  (`DOOR_ROUTE`, `BADGE_SCHEME`, `formatBadgeToken`), and
  `@isocan/server` re-exports them; `@isocan/api` cannot be their home,
  because `api` depends on `server` and `server` calls `askTheDoor`
  itself. The `BuildStamp` and `StoredBadge` types move to core with
  them.
- `canvas`, `owner`: what the room is parked on and who it answers to.
- `rows`: the rc half of the enrolment record, an interface with the
  verbs the room uses. The row type moves into the module; `rc.ts`
  keeps the file-backed implementation and re-exports the type, so
  `rc.test.ts`'s import of it survives.
- `origin`, `cwd`: the address the canvas lives at, for the opening
  line, and the directory an agent that arrives with no rc half runs
  in. Values, where the laptop read `ctx.homeOf` and `process.cwd()`.
- `adapterFor(row)`: two stages, `{ harness, open(turn) }`. The room
  needs the harness's name, and the refusal when there is none, before
  it claims the actor and puts the face on; the laptop's session
  pointer needs the face's id before the spawn. `open` returns
  `{ ensureSession, prompt, close }`, the shape `AcpAgentProcess` and
  `SheepAgent` share. The laptop's implementation is where the fence,
  the scan, the pointer loan and the spawn live.
- `whereOf(row)`: where a row's sessions run, said once at start, or
  null. The laptop's answers from `onPath("sheep")` and the kennel.
- `enrol(ask)`: the last hop of the web's "add an agent" on this
  machine, handed over by the hold: prepare the directory the ask
  names, claim the actor, write the row, enroll. The laptop's reads a
  template from disk.
- `endSession(row, narrate)`: withdrawal's half for a session that
  outlives the process. Today that is `withdrawSheep`; for a local
  adapter it is nothing.
- `narrate(line)`: one line, no level. The laptop prints it.
- `state`: a key-value, `get`, `set`, `delete`, string keys, JSON
  values, for what the room would like to survive a restart: the guard
  per agent, the sets of what has been said, the turned-away keys,
  whose word each turn carried (keys `guard:<actor>`, `session:<actor>`,
  `origins:<actor>`, `said:<canvas>:…`). The laptop hands it a `Map`, so nothing
  survives a restart there, which is what happens today. The room reads
  its state back at start, so a host that persists the store gets a
  room that does not repeat itself.
- `limits`, `clock`, `sleep`: the guard limits, `now()`, and a `sleep(ms,
  signal)`. A test hands it a clock it advances by hand and runs a night
  in a second.
- `skill`: not a dep. The module exports the collab skill's text as a
  string constant, generated from `.agents/skills/isocan-collab/SKILL.md`
  by a script and checked by a test that the two agree, since a module
  with no disk cannot read the file at run time.

### `SheepAgent` over `SheepCommands`

`packages/cli/src/sheep.ts` is 660 lines and node-shaped throughout:
`spawn`, `readFileSync`, `os.homedir`, and `readConfigFile` from
`@isocan/server`. Its policy is not: a pasture per agent named
`isocan-<agent>`, `setup.sh`, `BRIEF.md`, the skill put into the
pasture, the pass as the sheep's own secret with the pasture-secret
fallback for a home from before, a sheep resumed from the herd before
one is born, tool beats read from `attach --wait --json`'s stream,
withdrawal as `rm` with `abort` for a home from before. That policy
moves into the module as `SheepAgent` over an interface:

```
interface SheepCommands {
  sessions(): Promise<SheepRow[]>;            // sheep ls --json
  session(id): Promise<SheepRow | null>;
  pastures(): Promise<string[]>;              // sheep pasture ls
  pastureNew(name): Promise<void>;
  pasturePut(name, path, body): Promise<void>;
  pastureSecret(name, key, value): Promise<void>;
  mint(opts, secrets): Promise<string>;       // sheep new --detach … --secret; the id
  attach(id, text, onEntry): Promise<Reply>;  // attach --wait --json
  rm(id): Promise<RmAnswer>;
  abort(id): Promise<boolean>;                // whether a turn was running
}
```

`mint` answers the id because `sheep new` prints only that, and whether
the sheep kept its secret is read back with `session(id)`. `attach`
takes no signal: a turn is stopped at the home, by `rm`. `SheepAgent`
is handed `where`, the place as a sentence, because naming a local home
reads a kennel path, which is the host's.

The laptop implements each with `spawn("sheep", …)`, in `sheep.ts`,
which keeps `findKennel`, `kennelHome`, `sheepPlaceFor` and the
`loopbackFromCell` read, because where a sheep home is on this machine
is a laptop question. Another host implements the interface however it
reaches a sheep home. `rc-sheep.test.ts` and
`rc-sheep-withdrawal.test.ts` keep their fake `sheep` on PATH and pass
unchanged, because they drive the real CLI.

### The claim rule

Today the room claims a cursor for every agent on the roster and
`claimActor`s each at its first summons. When another badge holds the
actor, the desk refuses with `not-your-actor`. `DaemonClient` reads
that code and tries `reclaimIdentity` once, which is for a badge that
lost its own identity and not for an actor somebody else holds; it
fails, the turn fails, the system voice says in the thread that the
agent could not answer, and the room retries in sixty seconds. On one
laptop that is rare. For a second rc answering the same canvas, which
is the point of a room a host can run, it is the common case.

The rule the laptop never needed: **the room claims, faces and
dispatches only agents its badge may speak as.**

**Measured 13 September, before phase 3 built anything: the desk does
not refuse a second badge's claim.** Both machines claim an agent under
the same key, `agent:<name>`, and `Engine.vouch` does not count a row
under the same session key as held elsewhere, because that is how a
badge that lost its credential gets its actor back. So a second badge's
`actor.claim` gets 200 and becomes a second holder, and
`not-your-actor` appears only for an actor a badge never claimed. Two
real rcs on one canvas never fail a turn. Instead they trade the
cursor, because `parkClaim` and `rcHold` check nothing about the actor,
and the second posts a turn-away in the system voice. Three things were
broken, not one:
- The cursor and hold routes check nothing.
- An agent's session key can be derived from its name, which anyone
  admitted to the canvas can see. Same-key recovery assumes a key is
  secret, as a harness's session id is.
- There was no refusal for a room to read.

**Decided 13 September (Dimitri), two changes:**

1. **The cursor and hold routes require the actor** (phase 3).
   `/api/park/claim` and `/api/rc/hold` refuse, with `not-your-actor`,
   an actor the presenting badge does not hold, as every other route
   that names an actor already does. The room parks each agent's
   cursor at start, before it claims anything for that agent. A
   `not-your-actor` from `parkClaim` is the refusal the room reads. It
   is remembered under `state`, and the agent is narrated once:
   `<name> is answered elsewhere; a pass minted for <name> hands it
   over`. The room then parks no cursor, holds no answerability, puts
   on no face and fails no turn for that agent. For an agent in this
   machine's own rows, the room first claims the actor under its own
   key, then parks, so a machine that re-badged still takes up its
   own agents. The refusal is read from a route `DaemonClient` does
   not heal, because the reclaim only answers `not-your-actor` by
   reclaiming the machine's own identity, which does not make the
   badge hold somebody else's agent. If the code shows it does, phase
   3 records that.
2. **Agent keys nobody else can derive** (phase 3.5). An agent's
   session key becomes a keyed hash of a secret kept in this machine's
   `~/.isocan` and the agent's name. The same machine derives the same
   key every time, so re-enrolment, a second canvas, the environment
   injected into a turn and lost-badge recovery all behave as before.
   Another machine cannot derive the key, so its claim is refused as
   `name-taken`, unless it holds a pass or a vouch. Existing agents are
   rebound to the new key by the badge that holds them, and their rows
   under `agent:<name>` are retired. The desk's custody rules do not
   change.

Given up, knowingly: the option of having the desk stop same-key
recovery across badges, which would cost that recovery for people too;
"any machine picks up Percy by name", which was never designed; and a
machine that loses `~/.isocan` entirely keeps its agents only through a
pass. A liveness rule, where the second rc takes over when the first
stops, was set aside, because journey 2 step 5 chooses custody.

What hands an agent over is `isocan pass --agent <name>`, a pass that
arrives as an agent this badge holds. The desk already allows the mint;
it is words and a flag, and a second issue once the module exists.

## What stays in `main.ts`

Around the call to `runRoom`, by name: the upgrade window
(`autoUpgrade`, `considerUpgrade`), the sandbox fence, the harness scan
and the default-harness question, the session pointer file loaned to
the agent's own CLI commands mid-turn, and the daemon restart when
`ensureDaemon` is what a lost connection needs. A host with no local
daemon has nothing to restart and retries. The `rc` command's action
keeps `settleDefaultHarness` and `harnessSessions`, where they already
are.

## Distribution and the boundary

Nothing reachable from `packages/rc/src/index.ts` imports `node:*` or
`@isocan/server`. The test is `packages/rc/test/boundary.test.ts`, by
the method of `packages/api/test/boundary.test.ts`: walk the relative
imports transitively from the entry, scan each file's non-comment lines
for `from "node:` and `@isocan/server`, and expect no offenders. Beside
it, the method of `packages/api/test/context-reader.test.ts`: esbuild
the entry with `bundle: true, platform: "browser"` and expect no
`node:` in the output. Those two test the source. A host tests the
package, and the package's `./rc` default is `rc.mjs`, which registers
tsx and a loader: `esbuild --platform=browser` over an installed
`isocan/rc` reads `node:module` and cannot resolve `@isocan/rc`
(measured against `release` at e4af490). So the export gains a
`browser` condition ahead of `default`. On main it names the source
entry. On `release` it names an ESM bundle of that entry with
`@isocan/core` inlined, which `scripts/release.mjs` builds with
esbuild and commits beside `packages/web/dist`. A test lays the
release manifest and that bundle out as an installed tree and bundles
a one-line import through it. That test, with the two above, is
journey 3's acceptance inside the suite. The scratch-directory install
and the one-line bundle against `release` are its walk.

The existing tests are indifferent to where the room lives, with one
exception. `rc-fixture.ts` starts a real in-process daemon and `spawn`s
the real CLI binary, and every behavioural assertion is against the
child's output and `rc-agents.json`. "Pass unchanged" therefore measures
exactly what journey 1 asks, that the narration and the record are
byte-identical, and costs nothing beyond keeping two import paths alive
(`adoptRcAgent` and `RcAgentRow` from `../src/rc.ts` in `rc.test.ts`,
`gateTurn` in `guards.test.ts`). The exception is two describes in
`rc.test.ts` that read `main.ts`'s text, because the startup window they
guard (an enrolment or a withdrawal landing between the opening and
the start tip) could not be forced through a spawned CLI. Over in-memory
deps it can, so they leave `rc.test.ts` for `room.test.ts` as
behavioural tests of that window, and every other case stays as it is.

## Open doors

- **The host.** A Worker with a Durable Object beside a sheep station,
  sheep#12. A separate project, because it decides what a room nobody
  started may do, which is the custody argument #210 set aside.
- **`isocan pass --agent <name>`.** The hand-over. A second issue once
  the module exists.
- **What `state` promises.** The laptop hands the room a `Map` and loses
  it at exit, as today. A host that persists the store gets a room that
  remembers what it said and whose word a turn carried. Whether the
  guard's window should survive a restart, and for how long, is
  decided when a host exists to ask.
- **Bytes on a host.** `DaemonRoutes`'s blob methods speak `Buffer`. The
  room never calls them; a host that wants them decides how bytes cross
  its `fetch`.
- **A pasture per canvas.** Unchanged from sheep-harness's door; the
  `SheepCommands` interface does not decide it.
