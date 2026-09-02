# Standing agents — the walk

**1 September 2026.** The order of work for [design.md](design.md). Each
phase ends with **Trajectory**: only what the phase discovered that
changes the project's course.

**Where we are: phase 1 closed (2026-09-01); phase 2 is next.**

## Phase 1 — One name, one machine, many canvases

**Status: CLOSED (2026-09-01).** Mechanisms 1 and 2. The enrolment key
is `agent:<name>`; the summons environment carries `ISOCAN_CANVAS`, read
like `--canvas`; the `agent add` containment reads the flags alone.

**Outcome:** `isocan rc add --canvas <ref> <name>` for a name this
machine already answers for is the same actor on both canvases, one row
per canvas in `rc-agents.json`; a CLI run the way a summons runs it — the
injected environment, an unbound directory — speaks as that agent and
acts on the summons's canvas.

**Proof:** `packages/cli/test/rc.test.ts` — "one agent, one name, one
machine, many canvases": both rosters carry one actor id, `whoami` under
the injected environment is that actor, `isocan text` under it lands on
the second canvas and not the first, and an explicit `--canvas` in the
agent's spelling is still refused while the environment is not.

**Trajectory:** the research put `isocan history` first because nothing
could be woken when it was written. With the wake built, identity was
what blocked, so the order inverted. The cross-machine half (a second
machine answering as the same name) stays a vouch, deliberately.

## Phase 2 — The rc parks everywhere its rows name

**Door:** the spelling. `isocan rc --all`, or bare `isocan rc` in an
*unbound* directory meaning "every canvas this machine answers for" —
the second reads well but makes an unbound `rc` do something large by
default, which the on-demand design's "nothing runs that nobody
started" rule frowns on. Decide at the door.

**Outcome:** one rc, one process, holds and cursors on every canvas in
`rc-agents.json`; a summons on any of them starts that agent's session
with `ISOCAN_CANVAS` set to the one that summoned; the ceiling and the
cycle guard stay per agent across canvases. Narration names the canvas
once there is more than one.

**Proof:** the running-rc test with two canvases — a comment on each,
answered on each, one session handle per agent.

## Phase 3 — `available` in the web roster

**Outcome:** an answerable-but-not-running agent renders as a third
thing in the facepile, visibly not *here*. `isocan who` already knows;
the web learns.

**Proof:** a web test for the three states, and the accessibility pass
(a state told by colour alone is not told).

## Phase 4 — `isocan history <actor>`

**Outcome:** the cross-canvas fold: every canvas an actor has stood on,
what it did there, from the logs. No new state.

## Deliberately not in the walk

- **The actor credential** — a second machine answering as the same
  name without a person's vouch. Designed in the many-canvases note; a
  new long-lived secret with its own rotation and revocation story, and
  a different project.
- **Agents spawning agents.** The research's tree of depth one stands.
