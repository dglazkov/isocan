---
status: partial
since: 2026-09-13
issue: 294
see: sheep-harness, on-demand, standing-agents, agent-custody, harnesses, iso-api
note: designed 13 Sep 2026 from #294. The rc's room — the loop over a cursor, a hold and a prompt that `isocan rc` parks on a canvas — becomes a module, `isocan/rc`, that a host supplies its machine to; the laptop's `isocan rc` is its first consumer and behaves as it does today. Nothing under `isocan/rc` imports `node:*` or `@isocan/server`. One rule the laptop never needed: an agent whose actor another badge holds is narrated once and never claimed, faced or dispatched. Ends when the laptop's rc runs over the module and a browser-platform bundle of it builds; no host is built here. Phase 0 closed 13 Sep 2026: `packages/rc` exists and ships as `isocan/rc` beside `isocan`, holding the dispatch guards, the rc row types, the room's pure helpers and the collab skill as a constant, with the boundary test in the suite; phase 1 closed the same day: the room is `runRoom(deps)` in the module, the laptop's `isocan rc` builds its deps and prints its narration unchanged, and `packages/rc/src` typechecks with no Node types; phase 2 closed too: the sheep's policy is `SheepAgent` over `SheepCommands` in the module, with the laptop's `spawn("sheep")` as one implementation; the claim rule is phase 3: measured the same day, the desk accepts a second badge's claim under the shared enrolment key, so the refusal journey 2's room reads now comes from the cursor and hold routes requiring the actor, and phase 3.5 makes agent keys machine-keyed. Journey 3's walk against `release` failed the same day, because the package's `./rc` export was the Node shim; phase 4 now builds the bundle a host installs, and phase 5 holds the walks of journeys 1 and 2
---
# The room — the journeys

**13 September 2026.** Three journeys, in the form
[sheep-harness](../sheep-harness/journey.md) used: what you experience,
with the mechanism bending to it. The first two are for the person who
runs `isocan rc`. The third is for the person who writes a host.

**You** have a canvas with agents on it. Some run on a local harness,
one runs on the sheep harness, so its turns already happen in a cell.
The rc that answers for all of them is `isocan rc`, parked in a
terminal on your laptop.

## Journey 1 — Nothing changes on the laptop

*The rc you have runs over the module, and you cannot tell.*

1. `isocan rc` in a terminal, bare as always. It narrates the same lines
   it did yesterday: the canvas it holds, which agents it answers for,
   the upgrade window, the harness each agent names, where a sheep's
   home is.
2. Comment on an item: `@Percy the empty state reads wrong`. Percy runs
   on `claude-code`. The rc narrates the summons, Percy's face appears
   on the thread, the tool beats come as they happen, and Percy replies
   as Percy.
3. Comment `@Shaun and the heading above it`. Shaun runs on `sheep`. The
   rc narrates *session <id> resumed*, the setup line the home says,
   the beats from `sheep attach`'s stream, and Shaun's reply.
4. `isocan rc remove Shaun`. The rc narrates the withdrawal, ends the
   sheep, keeps the pasture, and ends the cell's badge, exactly as
   [sheep-harness journey 4](../sheep-harness/journey.md) says.
5. `cat ~/.isocan/rc-agents.json`, before and after. The same shape,
   the same fields. The session pointer file is loaned to Percy's own
   CLI commands mid-turn as before. `isocan rc` still restarts the
   daemon when it stops answering, still refuses a fenced adapter, still
   asks the default-harness question once.

**Acceptance:** `packages/cli/test/rc.test.ts`, `rc-sheep.test.ts` and
`rc-sheep-withdrawal.test.ts` pass unchanged. Every line the rc
narrates is the line it narrated before. The record on disk is
byte-identical in shape. What stays on the laptop, by name, is the
upgrade window, the fence, the harness scan, the default-harness
question, the session pointer file, and the daemon restart; the room
knows none of them.

## Journey 2 — Two rcs answer one canvas

*A second rc for the same canvas does not fight the first for its
agents. It says, once, whose they are.*

1. On a second machine, with a badge of its own, `isocan rc add Wendy
   --harness claude-code` on the same canvas, then `isocan rc`. The
   roster the rc reads has Percy, Shaun and Wendy.
2. The rc narrates, once each: *Percy is not held by this machine — a
   pass minted for Percy hands it over, or re-add it here* and the same for Shaun. It claims
   neither, faces neither, and parks a cursor for Wendy alone.
3. Comment `@Percy`. The first machine answers. On the second, nothing:
   no failed turn, no *retrying in 60s*, no system-voice line in the
   thread saying Percy could not answer.
4. Comment `@Wendy`. The second machine answers, as Wendy.
5. Stop the first rc. The second still says nothing about Percy: the
   actor is held by the first machine's badge until a pass minted for
   Percy hands it over, and that pass is a later issue.

**Acceptance:** an agent on the roster whose actor another badge holds
is narrated once, in one sentence naming the agent and the pass that
would hand it over, and is never claimed, faced or dispatched by this
rc. Dropping the rule reads a failed turn and a system-voice reply
where the sentence should be. The refusal the room reads is the desk's
`not-your-actor`, read once at start and remembered.

## Journey 3 — A host with no Node takes the room

*You are writing a host: a small always-on program with `fetch`, a
key-value store and a timer, and no filesystem, no child processes, no
terminal. You want it to answer for an agent the way `isocan rc` does.*

1. In a scratch directory, `npm install github:dglazkov/isocan#release`.
   Then `node -e 'import("isocan/rc")'`. It resolves, beside `isocan`.
2. A one-line file, `import "isocan/rc"`, through `esbuild --bundle
   --platform=browser`. The bundle builds, and nothing in its externals
   begins with `node:`.
3. `runRoom(deps)` is what you call. `deps` is what your host has: the
   daemon routes over your `fetch`, a badge store of two verbs, the
   canvas and its owner, the rc half of the enrolment record as an
   interface, an adapter per row, a way to end a session that outlives
   the process, a line of narration, a key-value for what the room
   would like to survive a restart, and the clock and the sleep. What
   you get back is `{ stop() }`.
4. Your host reaches a sheep home somehow. You implement `SheepCommands`
   over it: `sessions`, `session`, `pastures`, `pastureNew`,
   `pasturePut`, `pastureSecret`, `mint`, `attach`, `rm`, `abort`. The sheep's policy — a
   pasture per agent, the setup script, the brief, the skill, the pass
   as the sheep's own secret, a sheep resumed from the herd before one
   is born — is the module's, not yours. The collab skill's text comes
   from the module too, because you have no disk to read it from.
5. What the module does not do, you do or do not: upgrade itself, fence
   an adapter, scan a PATH, ask which harness is the default, loan a
   session pointer, restart a daemon. With no local daemon, the room
   retries.

**Acceptance:** `packages/rc/test/boundary.test.ts` proves nothing
reachable from `isocan/rc` imports `node:*` or `@isocan/server`, and
that an esbuild browser-platform bundle of the entry builds with no
`node:` external. The install and the one-line bundle are walked from
a scratch directory against the `release` branch. Every dep in
`RoomDeps` is one the laptop implements in `main.ts` and a test
implements in memory. A host is not built here.

## What the journeys force

- The room is one function over one deps object, and the laptop's
  `isocan rc` is a caller of it that adds the six laptop things around
  the call. Nothing else is a consumer yet.
- The boundary is a test, not a convention: the transitive closure of
  `packages/rc/src/index.ts` names no `node:` module and no
  `@isocan/server` export, and the same closure bundles for the browser
  platform.
- `DaemonRoutes` takes its badge store as a parameter. The two
  fetch-shaped helpers it borrows from `@isocan/server` today move to
  where fetch-shaped code lives.
- The sheep's policy is written once, over a commands interface, and
  the laptop's `spawn("sheep")` is one implementation of it.
- The claim rule: the room claims, faces and dispatches only agents its
  badge may speak as, and says once who answers for the rest.
- The laptop's narration and its record on disk do not change. That is
  what "the existing tests pass unchanged" measures, and those tests
  drive the real CLI binary, so they cannot tell which workspace the
  room lives in.
