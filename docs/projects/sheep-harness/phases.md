# The sheep harness — the walk

**10 September 2026.** The order of work for [design.md](design.md). Each
phase ends with **Trajectory**: only what the phase discovered that
changes the project's course.

**Where we are: phases 0 to 2.5 closed, 10 and 11 September. Phase 3,
the week with the bill, is next and needs the shepherd (⚑).** Three steps below wait on the sheep side and
are marked ⇢ with the journey filed there. Three more journeys are filed
for findings phase 1 works around rather than waits on, and one for what
phase 1 found:
[sheep#4](https://github.com/dglazkov/sheep/issues/4) (setup visible to
the dog), [sheep#5](https://github.com/dglazkov/sheep/issues/5) (a
secret per sheep), [sheep#6](https://github.com/dglazkov/sheep/issues/6)
(a home directory that survives the container) and
[sheep#7](https://github.com/dglazkov/sheep/issues/7) (entries on
`attach`'s stream). ⚑ marks a step that
needs the shepherd's permission or account.

## Phase 0 — The spike

**Status: CLOSED (2026-09-10).** `packages/cli/src/sheep.ts`, the branch
in `adapterFor`, the two spawn sites in `main.ts`, and `sheepBirth`.
Config by hand: a `sheep` block in `config.json` naming the command, the
kennel, and what a loopback home is called from a container.

**Outcome:** an agent enrolled with `--harness sheep` answers summonses
from a cell. Four turns on the deployed station against dev.isocan.io:
one hand-driven birth, three summonses from a parked rc, one of them in
a fresh container after the idle period, all on one badge.

**Proof:** the walk itself, recorded in design.md's table. No test: the
spike's job was to find out whether the seam existed.

**Trajectory:** the identity question that standing-agents left open and
#210 planned a phase for was answered by `isocan pass` unchanged, minted
for the agent's actor, so no new credential is designed. The spike ran on
the deployed station rather than the local home planned, because the
configured checkout had no kennel that day; which home an agent's sheep
live at becomes a fact the enrolment carries (phase 1) instead of one
the filesystem decides. #210's D7, a new word chosen first, is answered
with no new word.

## Phase 1 — The harness proper

**Status: CLOSED (2026-09-10).** Journey 1 walked by the conductor on
the deployed station against a scratch canvas at dev.isocan.io: `isocan
harness` listed sheep with `https://sheep-2.dglazkov.workers.dev (kennel
~/.sheep)`, the bare rc said where Timmy's sheep would live, and a
comment was answered from a fresh cell in 2 minutes 17 seconds, the text
item built and the reply on the thread as Timmy, with `read
/pasture/brief.md`, `bash isocan --agent-help`, `bash isocan text …` and
`bash isocan comment anchor …` on the face as they happened. `sheep ls`
listed Timmy, idle, in pasture `isocan-timmy`. Journey 2 walked twelve
minutes later with Timmy's row id and home cleared by hand: the rc found
the sheep in the pasture's herd and resumed it with no second pass, and
said the cell had been quiet for 12 minutes so setup was probably
running. It was, and the station's container service dropped during it
("Container service disconnected"). Timmy recalled the first comment
from its transcript but could not reach the canvas, and ended the turn
without a reply. The next summons got a fresh container and the reply,
by Timmy, in 1 minute 51 seconds.
Journey 5's refusals are the suite's, and its step 3 is the walk's
first line. Journey 1's step 5 is amended; see the trajectory.

**Outcome:** `sheep` is a harness like the others. `isocan harness` finds
it by scan: the command on PATH, and the kennel above the rc's directory
or `~/.sheep`, printing the home the kennel names. The `sheep` config
block goes away; `homeAs` survives as the one thing a scan cannot know,
under a name that says what it is. The rc row carries the sheep home's
address beside the sheep id, so a summons from a different directory
resumes the same sheep, and before any birth the rc reads the pasture's
herd, so a sheep the row forgot is resumed rather than born twice. The
birth narrates each step it takes and what it costs, and the first
summons after a quiet period says setup is probably running while it
waits, a guess from the clock until
[sheep#4](https://github.com/dglazkov/sheep/issues/4) lets the home say. The summoned face gets tool beats: `prompt`
reads `sheep attach --json` and turns pi's tool-call entries into the
inferred statuses the ACP path already produces.

**Proof:** `packages/cli/test/rc.test.ts` gains the sheep harness against
a fake `sheep` on PATH that records its arguments and answers from a
script: enrol, birth, summons, resume, the row's home and id, and a
birth refused because the pasture's herd already holds a sheep. The scan's
kennel walk is a pure function with a table test.

**Door:** whether `--harness sheep` on a canvas that lives on a laptop
daemon, from a deployed station, is refused at enrolment or at the first
summons. Enrolment is an offer and the machine that honours it may be
another; the design says refuse at the summons, in one sentence naming
both homes. Decide at the door.

**Door decided:** at the summons, as the design and journey 5 say. `rc
add --harness sheep` succeeds anywhere. A station asked to reach a
loopback canvas is refused at `spawn`, before a pass is minted, in one
sentence naming the station, the canvas's address, and the two moves
that would connect them.

**Trajectory:**

- `sheep attach --json` prints the last assistant entry when the turn
  ends and nothing while it runs, so it cannot carry tool beats. The rc
  reads the transcript instead, `sheep log --json --since <entry>` every
  three seconds during a turn and once after it. Journey 1's step 5
  said the only extra process during a turn is `sheep attach`; it is
  amended to name the `sheep log` beside it, and
  [sheep#7](https://github.com/dglazkov/sheep/issues/7) asks for an
  entry stream on `attach` that would let the read go.
- The row carries the kennel as well as the home, because a local home's
  address is whatever port its daemon last got. The home is recorded as
  `local` for one, and a kennel that names a different home than the row
  is refused rather than answered with a second sheep.
- `homeAs` became `loopbackFromCell` and is optional: without it a
  loopback canvas is addressed as `host.docker.internal` on the daemon's
  port, which is what a local sheep home's Docker answers to.

## Phase 2 — Withdrawal, and the cost of a cold turn

**Status: CLOSED (2026-09-11).** Journey 4 walked by the conductor on
two sheep homes against the scratch canvas at dev.isocan.io, with the
pass route deployed there. On a local sheep home (Docker, the faux
model) `rc remove` ended the sheep, `sheep ls` came back empty, the
pasture stayed with a herd of none, the row went, and the pass read back
through the laptop's replica said it was never redeemed; re-enrolling
birthed a new sheep into the kept pasture and said it would not remember
the first. On sheep-2, a station deployed before sheep's end verb, a new
agent's first turn redeemed its pass, `isocan badges` listed the cell as
`cell (Shirley's sheep)`, and `rc remove` during a 90-second turn aborted
it, said the station cannot end a sheep, kept the pasture, and ended the
cell's badge by name; no system voice reached the thread. The same
station's phase-1 agent, whose row had no pass, was withdrawn with the
sentence naming `isocan badges --kill`. That walk found the aborted turn
exiting cleanly, which the parked rc logged as "turn ended"; it now
reads as a withdrawal, with a test. The walk left Timmy's and Shirley's
sheep, and a probe, on sheep-2; they were ended with `sheep rm` once the
station was redeployed.

**Outcome:** `agent.withdraw` for a sheep-harnessed agent aborts a
running turn, ends the sheep for good, leaves the pasture and says so,
and narrates each. `isocan badges` on the rc's machine lists a cell's badge as the
agent's surface and ends it with the sheep. A cold turn's install goes
away: the pasture's setup finds the CLI already there.

⇢ Ending a sheep for good needs a sheep verb
([sheep#1](https://github.com/dglazkov/sheep/issues/1)). Until it lands,
withdrawal aborts and says what remains. The secret is a spent pass and
sheep has no verb to drop it, so it stays.

⇢ Installing once needs a sheep mechanism
([sheep#2](https://github.com/dglazkov/sheep/issues/2)). Until it lands,
the brief says a cold turn is slow.

⇢ A birth without a spent turn needs `sheep new` to mint without a
prompt ([sheep#3](https://github.com/dglazkov/sheep/issues/3)).
Until it lands, the opening prompt stays and `--wait` queues the first
summons behind it. Once it lands, the pass moves from the birth to the
first summons: a pass lives fifteen minutes and setup runs on the first
command that rents a container, so a pass minted at an idle birth would
expire unredeemed. (Built in phase 2.5.)

**Proof:** `packages/cli/test/rc.test.ts`'s "withdrawal ends the sheep"
cases, against the fake `sheep`, which now answers `rm` and `abort`, can
make a turn or a birth take a while, and can answer `rm` the way a station
deployed before sheep's end verb does. `rc remove` with no rc running
ends the sheep once beside the row's kennel, keeps the pasture, reaps the
row, and ends the badge a test badge made by redeeming the pass from the
pasture, after `isocan badges` listed it as `cell (Percy's sheep)`;
re-enrolling births `s_2` into the same pasture with a new pass and says the
sheep does not remember the first. A withdrawal under a parked rc's running
turn aborts it and reads as a withdrawal: no "turn FAILED", no system-voice
reply in the thread, no second `attach`. The web's withdraw op is ended by a
parked rc, a withdrawal made while no rc ran is ended at the next rc's
start, one landing while the rc starts is ended too (the rc reaps once more
after its start tip, pinned by a source-shape test because the window
cannot be forced), and one landing while the sheep is being born is ended
by the summons that birthed it. An older home gets `sheep abort` and the "still
at" sentence; a sheep already gone is said as already ended; a sheep behind
two canvases stays until its last row goes.
`packages/server/test/passes.test.ts` covers the pass read: its minter
learns `redeemedBy`, any other badge, canvas or id gets `unknown-pass`, and
a replica's read forwards to the home. The birth case with no opening
prompt waits on sheep#3.

**Trajectory:**

- Which badge is the cell's is answered exactly, not by matching actors.
  The desk already recorded which badge redeemed a pass; a new route,
  `GET /api/projects/:id/passes/:passId`, reads that back to the badge that
  minted the pass and to no other, forwarded to the home on a replica. The
  rc row keeps the birth's pass id (`cellPass`), never its token. A home
  deployed before this route cannot say, and the rc then names
  `isocan badges --kill` instead of guessing.
- sheep#1 landed while the phase was planned, so withdrawal ends the sheep
  with `sheep rm` and falls back to `sheep abort` only at a home deployed
  before it. The two homes word their refusals differently, so a refusal
  is read against `sheep ls`: a sheep no longer listed was already ended,
  and one still listed is at a home that cannot end it.
- One agent on two canvases shares one sheep, so withdrawal from one canvas
  leaves the sheep and its badge while another row on the machine still
  names them, and hands that row the pass.

## Phase 2.5 — The birth without a turn

**Status: CLOSED (2026-09-11).** Walked by the conductor on sheep-2
against the scratch canvas at dev.isocan.io: a new agent's first summons
minted its sheep with no turn spent, `sheep ls --json` listed
`ISOCAN_PASS` among that sheep's secrets, the new pasture held none, and
the agent replied as itself naming the canvas, which only `BRIEF.md` had
told it; `isocan badges` listed its cell. The station's transcript read
then failed for that sheep (`500 AgentHarness storage or invariant
fault`), which ended the rc's `attach` two minutes into setup, and the
reply landed eight and a half minutes after the summons. A pastureless
sheep read while polled did not fault, so the fault is the station's,
recorded in design.md; the station's container image was also still the
one from before the day's redeploy, which stopped midway. Once the
station was redeployed whole, the same agent was withdrawn (its sheep
and cell badge ended, the pasture kept), re-enrolled, minted into the
kept pasture, and answered in 2 minutes 10 seconds.

Pays phase 2's step that waited on
[sheep#3](https://github.com/dglazkov/sheep/issues/3), which closed on
11 September together with
[sheep#5](https://github.com/dglazkov/sheep/issues/5).

**Outcome:** a birth spends no model turn. The first summons for an
agent with no sheep mints one with `sheep new --detach --name <agent>
--pasture isocan-<agent> --secret ISOCAN_PASS`, the pass address the
one line of stdin and no prompt, and sends the summons straight to it
with `sheep attach --wait`, so the sheep's first command runs setup and
redeems the pass within the fifteen minutes it lives. The pass is the
sheep's own secret, never the pasture's, so nothing is left in a kept
pasture and ending the sheep ends it. The pasture keeps `setup.sh`, the
brief and the skill; the brief is `BRIEF.md`, which the home puts in the
system prompt of every model call. The birth says "sheep <id> minted —
no turn spent; its first container runs setup before this summons", and
a sheep found in the herd with no transcript yet gets the same warning
before its summons. A `sheep` or a home from before per-sheep secrets
mints the sheep and drops the secret without refusing, so the rc reads
the new sheep's `secrets` in `sheep ls --json`; when `ISOCAN_PASS` is
missing, the same pass goes to the pasture's `ISOCAN_PASS` secret, the
phase 1 birth's credential, the one sheep minted is used, and one
sentence says the home cannot keep a secret for one sheep.

**Proof:** `packages/cli/test/rc.test.ts`'s "the birth without a turn"
cases, against the fake `sheep`, which now reads `new --secret`'s values
from stdin, keeps them per sheep and drops them with the sheep, lists
the names in `ls --json`, mints with no transcript under `--detach` with
no prompt, and can answer `new --secret` the way a `sheep` or home from
before sheep#5 does. A parked rc's summons mints with exactly `new
--detach --name Percy --pasture isocan-percy --secret ISOCAN_PASS`, the
pass on stdin and in no argument, no pasture secret set, and the one
call carrying a prompt is the `attach` with the summons, which opens
the transcript. The fallback sets the pasture secret between the mint's
listing and the `attach`, leaves one sheep, and says so. Phase 1's
"enrol, birth, resume" case checks the same from `rc turn`, and that the
resume mints no pass; the herd case that a found sheep mints none and is
said to have no transcript yet; the phase 2 cases redeem the sheep's own
secret, and journey 4's finds it gone with the sheep and the kept
pasture holding none. Putting back the opening prompt reddens two cases,
and putting back the pasture secret five.

**Trajectory:**

- The fallback is detected from `sheep ls --json`, not from a refusal.
  Neither side refuses: a `sheep` from before `--secret` takes the flag
  and its name as stray words, and a home from before per-sheep secrets
  ignores the `secrets` field of the mint, and both mint the sheep and
  exit 0. The sheep minted is kept, since nothing of it has run, and the
  pass goes to the pasture before its first command.
- The brief is `BRIEF.md`, not `brief.md`. The home puts only
  `/pasture/BRIEF.md` in the system prompt, and until now the opening
  prompt was what told the sheep to read the lowercase file. Pastures
  made before keep a `brief.md` that the rc no longer writes or reads.

## Phase 3 — The walk, with the bill

**Outcome:** journeys 1 to 5 walked on the deployed station with a real
model, by the shepherd, over a week on one canvas with two agents on the
sheep harness and one on a local one. `GET /home` on the station read
before and after: container minutes, and the model spend from the
transcripts, written into design.md as the number #210 asked for.

⚑ The shepherd's station and Anthropic key, for the week.

**Proof:** the journeys' acceptance lines, checked against the rc's
narration and `sheep log`, and the two numbers.

**Trajectory:** to be written at close.

## Later, and not here

The rc in a cell, which is #210's shape 2 and the on-demand sketch's
isocannery in full. A pasture per canvas once secrets can be per sheep.
The web dialog offering a harness. Each is a project of its own; this
one ends when an agent on the sheep harness can be enrolled, summoned,
resumed and withdrawn with nothing left behind, and its cost is known.
