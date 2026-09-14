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

The whole of `runRcRoom` minus the laptop. `Room` is `{ stop(): void }`,
an abort that ends both long polls and the hold. `RoomDeps`:

- `routes`: `DaemonRoutes` over a `fetch`. `DaemonRoutes` is fetch-only
  by its own rule and by `packages/api/test/boundary.test.ts`, but it
  still imports four things from `@isocan/server`: `readBadge` and
  `writeBadge`, which read a file, and `askTheDoor` and `bearerHeader`,
  which are a fetch and a pure function that happen to live in
  `badge-store.ts`. The first two become a constructor parameter,
  `badges: { read(): Promise<StoredBadge | null>; keep(badge): Promise<void> }`,
  with the file-backed store as the CLI's argument. The other two move
  to `@isocan/api`, and `@isocan/server` imports them from there. The
  `BuildStamp` and `StoredBadge` types move with them or to core.
- `canvas`, `owner`: what the room is parked on and who it answers to.
- `rows`: the rc half of the enrolment record, an interface with the
  verbs the room uses. The row type moves into the module; `rc.ts`
  keeps the file-backed implementation and re-exports the type, so
  `rc.test.ts`'s import of it survives.
- `adapterFor(row)`: `{ ensureSession, prompt, close }`, the shape
  `AcpAgentProcess` and `SheepAgent` share. The laptop's implementation
  is where the fence, the scan and the spawn live.
- `endSession(row, narrate)`: withdrawal's half for a session that
  outlives the process. Today that is `withdrawSheep`; for a local
  adapter it is nothing.
- `narrate(line)`: one line, no level. The laptop prints it.
- `state`: a key-value, `get`, `set`, `delete`, string keys, JSON
  values, for what the room would like to survive a restart: the guard
  per agent, the sets of what has been said, the turned-away keys,
  whose word each turn carried. The laptop hands it a `Map`, so nothing
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
  mint(opts, secrets): Promise<SheepRow>;     // sheep new --detach … --secret
  attach(id, text, onEntry, signal): Promise<Reply>;  // attach --wait --json
  rm(id): Promise<RmAnswer>;
  abort(id): Promise<void>;
}
```

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
dispatches only agents its badge may speak as.** At start, and again
when a row is adopted, the room claims each agent's actor once. A
`not-your-actor` refusal is remembered under `state`, the agent is
narrated once, `<name> is answered elsewhere; a pass minted for <name>
hands it over`, and no cursor is parked, no face put on, no turn
failed for it. The client's automatic reclaim is not a substitute: the
room reads the refusal before the client's healing would have hidden
it, or the client's retry is told not to, and phase 3 decides which by
what the code allows.

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
`node:` in the output. The two together are journey 3's acceptance
inside the suite; the scratch-directory install and the one-line
bundle against `release` are its walk.

The existing tests are indifferent to where the room lives.
`rc-fixture.ts` starts a real in-process daemon and `spawn`s the real
CLI binary; every assertion is against the child's output and
`rc-agents.json`. "Pass unchanged" therefore measures exactly what
journey 1 asks, that the narration and the record are byte-identical,
and costs nothing beyond keeping two import paths alive
(`adoptRcAgent` and `RcAgentRow` from `../src/rc.ts` in `rc.test.ts`,
`gateTurn` in `guards.test.ts`).

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
- **A pasture per canvas.** Unchanged from sheep-harness's door; the
  `SheepCommands` interface does not decide it.
