# The sheep harness

**10 September 2026.** Design, written the evening the spike walked. The
project's status lives in [journey.md](journey.md)'s front matter. The
journeys are the acceptance suite, this doc is the argument,
[phases.md](phases.md) the walk.

The thesis in one line: **an rc's turn is `spawn`, `ensureSession`,
`prompt`, and only the first of those is laptop-shaped.** Replace the
subprocess with a session at a [sheep](https://github.com/dglazkov/sheep)
home and the agent runs in a cell in the cloud, while the rc, its
routing, its cursors and its custody rule stay exactly where they are.

## Where this stands with what came before

[on-demand/design.md](../on-demand/design.md) sketched "isocannery": a
hosted `isocan rc`, sleeping when nobody talks to it. It said the local rc
should be built first so the remote one is a deployment and not a design.
Issue [#210](https://github.com/dglazkov/isocan/issues/210) read the sheep
repository against that sketch and named three shapes: a sheep as the
cheap tier for personas, a parked rc inside a sheep, and a summons that
calls the cell directly. It ordered them personas first, because the other
two reopened the custody argument.

The spike found a fourth shape, and it reopens nothing. **The rc stays on
the laptop and the sheep is the agent's machine.** The rc is still a
program the person started. Every sheep is minted by that rc, listed by
`sheep ls`, endable by `sheep abort`. The parent of every turn is still a
process with the person's name on it, so the on-demand rule holds without
amendment: no agent is spawned at a distance by machinery nobody launched.
What moves is the machine the agent's shell runs on, and that was never
part of the rule.

The price is the one #210 named for shape 2: the rc is a parked long
poll, so a laptop still has to be open. What the laptop no longer does is
run the agent. Seven agents are seven cells, not seven adapter processes,
and a cell costs nothing between turns. The rc in a cell is a later leg;
see the open doors.

#210's decision D7 asked for a new word for the bridge before anything
was built. The spike answered it by not needing one. `sheep` is the name
of a harness in `rc-agents.json`, beside `claude-code`, `pi`, `codex` and
`antigravity`, because a harness is named for the command that runs it.
An agent enrolled with `--harness sheep` is an agent whose sessions are
sheep. Nothing else is new vocabulary.

## What the spike measured

Built and walked 10 September, on the deployed station against
dev.isocan.io. One agent, Shaun, enrolled on a scratch canvas with
`isocan rc add Shaun --harness sheep`. A hand-driven `isocan rc turn`
for the birth, then three summonses from a parked `isocan rc`, each
answered from a container on Cloudflare: a comment posted, a text item
built at the coordinates asked, a reply on the thread, all as the
enrolled actor and on one badge across four turns. The fourth turn came
after the station's ten-minute idle period, in a fresh container, and
the badge was the same.

| Turn | Container | Wall time |
| --- | --- | --- |
| birth and first prompt | fresh | about 2 minutes |
| second, warm | same | 16 seconds |
| third, warm | same | about 40 seconds |
| fourth, after idle | fresh | 3 minutes 40 seconds |

The two minutes on a fresh container is `npm install -g` of the isocan
CLI. Everything else is the model.

## The mechanism

### The three verbs, over `sheep`

`packages/cli/src/sheep.ts` gives the rc a `SheepAgent` with the same
shape as `AcpAgentProcess`: `spawn`, `ensureSession`, `prompt`, `close`.
`adapterFor` in `harnesses.ts` returns it for the harness named `sheep`,
and both places the rc starts a turn (`rc turn` and the parked summons)
branch on that name. The summons text is unchanged. A sheep and a local
adapter receive identical content; the difference is where the turn runs.

- `spawn` refuses what cannot work, in one sentence naming both homes:
  a kennel that names no home, a kennel re-pointed since the sheep was
  born, and a station asked to reach a canvas on this machine's daemon.
- `ensureSession` reads the home's sessions once. The stored id, if the
  home still has it, is resumed. Otherwise a sheep already in the agent's
  pasture is resumed, because a row can forget what the home remembers.
  Only when the herd is empty does it make the pasture, mint the pass,
  and mint a sheep with `sheep new --detach` and no prompt, the pass on
  stdin as the sheep's own secret, narrating each step. The birth spends
  no model turn (phase 2.5). The sheep's id is the row's `sessionId`.
- `prompt` is `sheep attach --wait <id> -- <summons>`. `--wait` queues
  behind a turn already running at the cell; a first summons finds none,
  because the birth runs no turn. The reply streams back as chunks; exit
  is the stop. Before it, the transcript's last entry says how long the
  cell has been quiet, and past the home's ten-minute idle period the rc
  says setup is probably running; a sheep with no transcript has never
  started a container, and the rc says setup runs first. During it, the transcript is read every three seconds and each tool call
  becomes the same inferred status the ACP path produces, because
  `sheep attach` streams only the reply's text.
- `close` does nothing. Nothing runs between turns.

### A pasture per agent

A pasture is what every sheep born into it knows: a tree at `/pasture`,
a setup script run in each fresh container, secrets the setup can read.
The rc makes one per agent, named `isocan-<name>`, and puts three things
in it: `setup.sh`, `BRIEF.md` naming the agent and the canvas, which the
home puts in the system prompt of every model call, and the collab
skill. The pasture was made per agent and not per canvas because the
pass was its secret. Since phase 2.5 the pass is the sheep's own secret
and the pasture holds none, except where the rc falls back to the
pasture's secret at a `sheep` or home from before per-sheep secrets. The
brief still names the agent, so the pasture is still per agent; whether
it becomes the canvas's is an open door, below.

### Identity: the pass, minted for the agent

This was the unknown. A sheep is a second machine answering as Percy,
which is the piece [standing-agents](../standing-agents/design.md) left
open on purpose: the actor credential for a second machine. The
answer was already in the CLI. `isocan pass` mints a short-lived,
single-use credential that puts another machine of yours on a canvas,
arriving as the actor the minting badge holds. The rc's badge holds the
agent's enrolment claim, so `mintPass(canvasId, actorId)` is allowed for
the agent's actor, and refused for any other by the desk's own check.

The pass rides into the cell as `ISOCAN_PASS`, a secret for that one
sheep, given at its mint: `sheep new --secret ISOCAN_PASS` with the value
as the one line of stdin (phase 2.5; before it, the pasture's secret of
that name). A sheep's secrets, like a pasture's, are environment for the
setup script and for nothing else, so the credential is never in a
prompt, never in the transcript, and never readable by the model's own
commands. Ending the sheep ends the secret. `setup.sh` redeems it once:

```sh
isocan setup --direct --no-open --no-install "$ISOCAN_PASS"
```

`--direct` means no daemon in the container; the CLI speaks to the home
itself, which is the shape `ISOCAN_DIRECT` already proved in two suites.
The redeemed badge and identity land in `~/.isocan`, which the script
has symlinked to `/workspace/.isocan-home`, because the workspace is
what the cell syncs and the container's disk is not
([sheep#6](https://github.com/dglazkov/sheep/issues/6) asks for a home directory that survives). That is why the
fourth turn's fresh container was still Shaun.

A pass lives fifteen minutes and works once. It is minted at the birth,
which a summons causes, and that summons goes to the idle sheep at once,
so the sheep's first command, which starts a container and runs setup,
redeems the pass within minutes. Its token is never stored on the rc's
side. Its id
is, on the rc row (phase 2): the desk tells the badge that minted a pass
which badge redeemed it, and that badge is the cell's, which withdrawal
ends.

### Where the home is

Which sheep home an agent's sheep live at is sheep's own rule: the
kennel, a `.sheep/` at or above the directory, else `~/.sheep`, and the
home its config names. The rc walks it from the agent's directory at
birth and writes the kennel and the home onto the rc row beside the
sheep id, with `local` for a local home, whose port changes with every
start. From then on the row decides, not the directory, and the rc runs
`sheep` beside that kennel with `SHEEP_HOME` taken out of its
environment. `isocan harness` lists `sheep` with the home, and `isocan
rc` says at start where each sheep-harnessed agent's sheep live.

The pass carries the canvas's home address, so a sheep talks to wherever
the canvas lives, which for a canvas born at dev.isocan.io is
dev.isocan.io. A canvas on a laptop daemon is reachable from a local
sheep home's Docker container at `host.docker.internal` on the daemon's
port, which is the default, and `config.json`'s `loopbackFromCell`
names another address when a Docker does not answer to that one. A
canvas on a laptop is not reachable from a deployed station, and the rc
refuses at the summons rather than mint a pass nobody can redeem.

## Findings the spike left

Recorded here as what a full build owes, not as trajectory.

- **The install on every fresh container.** Two minutes per cold turn is
  the CLI installed from the release branch. The fix is on the sheep
  side: a way for a pasture's tools to be installed once, [sheep#2](https://github.com/dglazkov/sheep/issues/2). Until then the brief should say the first turn after a
  quiet night is slow. *The brief says so from phase 2.*
- **Withdrawal does not end the sheep.** `agent.withdraw` drops the
  enrolment and the rc row; the sheep stays in `sheep ls` with a
  workspace and a badge. Sheep has no verb that ends a session for good,
  [sheep#1](https://github.com/dglazkov/sheep/issues/1). Until it exists, withdrawal should at least `sheep abort`
  and narrate what is left. *Answered in phase 2: withdrawal runs `sheep
  rm` and ends the cell's badge, and a home deployed before sheep's end
  verb gets `sheep abort` and a sentence saying what remains.*
- **The birth spends a turn.** `sheep new --detach` needs a prompt, so
  the rc pays one model turn to get an id, [sheep#3](https://github.com/dglazkov/sheep/issues/3). It also means a first summons is queued behind the birth,
  which `--wait` handles. *Answered in phase 2.5: `sheep new --detach`
  with no prompt mints an idle sheep, so the birth spends no turn and the
  first summons is the sheep's first prompt.*
- **The face gets no tool beats.** The rc reads `sheep attach`'s text
  stream, so the summoned face shows "reading your comment…" and nothing
  else while the sheep works. `sheep log --json` carries pi's entries
  with tool calls, so this is the rc's to fix, not sheep's. *Answered in
  phase 1 by reading the transcript during the turn.*
- **Setup's output is invisible to the rc.** A pasture's setup writes to
  the cell's log and reaches the model only on failure. The rc narrated
  nothing for the two minutes the install took, [sheep#4](https://github.com/dglazkov/sheep/issues/4).
- **Configuration is hand-written.** The `sheep` block in `config.json`
  names the command and the kennel. `isocan harness` should find `sheep`
  on PATH and a kennel above the directory, the way it finds the others.
  *Answered in phase 1; the block is gone.*
- **The kennel is the directory's.** Sheep resolves its home by walking up
  from the working directory to a `.sheep`, else `~/.sheep`. The rc runs
  sheep with the configured kennel as its working directory, and the
  spike ran on the deployed station because the configured checkout had
  no `.sheep` that day. Which home an agent's sheep live at is a fact the
  enrolment should carry, not one the filesystem decides. *Answered in
  phase 1: the rc row carries it from the birth on.*
- **One agent on two canvases shares one sheep bound to the first.** An
  rc keeps one session per agent across canvases, and the herd check
  finds the agent's sheep whichever canvas summons it. That sheep's CLI
  is bound to the canvas whose pass it redeemed, so a summons from a
  second canvas reaches a cell that answers on the first. Found in phase
  1 by reading, not walked.
- **A cell that cannot rent a container ends its turn in silence.** In
  phase 1's walk the station's container service dropped mid-setup. The
  sheep's every command failed, it ended the turn with `end_turn`, the rc
  advanced the cursor, and the thread heard nothing; the next summons
  worked. From the rc's side this is an agent that chose not to reply.
- **At a station too old to end a sheep, re-enrolment resumes a sheep
  with a dead badge.** Withdrawal there aborts the sheep and ends its
  cell's badge, and the sheep stays in its pasture. Re-enrolling the agent
  finds it in the herd and resumes it rather than birthing a new one, and
  its turns then fail because the badge it holds was ended. Redeploying the
  station removes the case. Found in phase 2 by reading, not walked.
- **A minted sheep's transcript faults at the station during setup.** In
  phase 2.5's walk on sheep-2, a sheep minted into a pasture with its own
  secret ran its first command behind setup, and `GET /s/<id>/transcript`
  answered `500 AgentHarness storage or invariant fault` from then on.
  `sheep attach` died on it with "Internal server error", so the rc saw
  the turn end at `sheep exit 2` while the sheep kept working and replied
  six minutes later; `sheep status` still said running after the reply.
  A pastureless sheep read every three seconds through its turn did not
  fault. The station's container image predated its Worker that day.
  *It did not recur once the station was redeployed whole:* the same
  agent, withdrawn and re-enrolled, was minted and answered in 2 minutes
  10 seconds with setup included.
- **A machine linked to several homes ends a badge at the wrong one.**
  `killBadge` goes to the machine's birth-default home. When a sheep's
  canvas lives at another home, the kill is refused there and the rc
  reports the badge as already ended. Found in phase 2 by reading.

## Open doors

- **The rc in a cell.** With turns already in sheep, the rc is the last
  laptop process. A cell has a durable alarm loop. This is #210's shape 2
  and the on-demand sketch's isocannery in full, and it is a separate
  project, because it changes what a parked long poll costs.
- **The web door.** [agent-custody](../agent-custody/design.md) decided
  the "Add an agent" dialog appears only with a live rc, and the rc
  completes the handshake. That holds. The only new choice the dialog
  could offer is which harness, and `sheep` would be one of them.
- **A pasture per canvas instead.** A pasture is the natural place for a
  canvas's brief, skill and binding, but the pass is the agent's. Sheep
  gained secrets per sheep at the mint
  ([sheep#5](https://github.com/dglazkov/sheep/issues/5)) and the pass is
  one since phase 2.5, so the secret no longer ties the pasture to one
  agent. The brief, which names the agent, still does. Whether the
  pasture becomes the canvas's is not decided.
- **The bill.** #210 asked for a number. The spike ran four turns on one
  agent; the station reports container minutes at `GET /home`, and phase
  3 reads them before and after a week.
