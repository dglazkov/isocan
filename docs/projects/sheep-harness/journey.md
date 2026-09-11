---
status: partial
since: 2026-09-10
see: sheep-harness, on-demand, standing-agents, agent-custody, harnesses
note: phase 0, the spike, walked 10 Sep 2026 on the deployed sheep station against dev.isocan.io — journeys 1 and 2 walked by hand, journey 3's credential rule held, journeys 4 and 5 not yet buildable. Phases 1–3 designed and not built; three of their steps wait on the sheep side.
---
# The sheep harness — the journeys

**10 September 2026.** Five journeys, in the form
[on-demand's](../on-demand/journey.md) set: what you experience, with the
mechanism bending to it.

**You** have a sheep home: a station on your Cloudflare account, deployed
from the sheep package with two environment variables, or a local one
under a kennel on this machine. You have a canvas with a few agents on
it, and you are tired of the fans on your laptop when three of them
answer at once.

## Journey 1 — Your agent runs in a cell

*You enrol an agent the way you always do, name one harness, and the
laptop stops running it.*

1. `isocan rc add Percy --harness sheep`. The rc says Percy is enrolled
   and answerable. Nothing runs.
2. `isocan rc` in a terminal, bare as always. It says which home Percy's
   sheep will live at.
3. Comment on an item: `@Percy the empty state reads wrong`. The rc
   narrates *making pasture isocan-percy*, then *session <id> started*,
   then the turn. Percy's face appears on the thread. A minute or two
   later Percy replies on the thread, as Percy, and the face goes.
4. `sheep ls` on the same machine lists Percy, idle, in pasture
   `isocan-percy`. `sheep log <id>` is the transcript of the turn you
   just watched, tool calls and all.
5. Activity Monitor shows one process for the rc and nothing for Percy.

**Acceptance:** No new gesture beyond the harness's name. The summons
Percy receives is the same text a local adapter would receive. The reply
is by the enrolled actor, not by you and not by the rc. Nothing about
Percy runs on the laptop between the comment and the reply, or after it.

## Journey 2 — The same Percy, a day later, in a fresh container

*Percy remembers, and Percy is still Percy, after the cell's container
has been torn down.*

1. The next afternoon, well past the home's idle period, comment again:
   `@Percy and the heading above it`.
2. The rc narrates *session <id> resumed*. The turn is slower than
   yesterday's, and the rc says why while it waits: the container is
   fresh and setup is running.
3. Percy's reply refers to yesterday's comment without being told about
   it. `isocan history Percy` shows both replies by one actor.
4. `isocan badges` on your machine lists the badge Percy's cell holds,
   the same one as yesterday.

**Acceptance:** One sheep id per agent across days, resumed and never
reborn while it exists at the home. One badge across containers. The rc
never mints a second pass for an agent whose cell already redeemed one.

## Journey 3 — The credential never touches a transcript

*Percy's right to speak as Percy is a pass you could not read back even
if you tried.*

1. `sheep log <id>` from birth to now. The pass address appears nowhere:
   not in the opening prompt, not in a tool call, not in a result.
2. `sheep pasture secret ls isocan-percy` prints the name `ISOCAN_PASS`
   and no value.
3. In a turn, ask Percy to print its environment. The pass is not in it.
4. Mint a pass by hand as yourself and try to hand it to Percy's pasture.
   The pass Percy redeems is for Percy's actor; a pass for yours makes
   Percy's cell arrive as you, which `isocan history` would show as your
   replies from a cell. The rc mints for the agent's actor and the desk
   refuses a claim the rc's badge does not hold.

**Acceptance:** The credential is environment for the pasture's setup
script and for nothing the model runs. The rc can mint a pass for an
actor it holds and for no other. Spent passes are not kept on the rc's
side.

## Journey 4 — Withdrawal ends the sheep

*When Percy is withdrawn, nothing of Percy is left running, listed, or
billed.*

1. `isocan rc remove Percy`, or the withdraw gesture in the web app.
2. The rc narrates the withdrawal, then *ending sheep <id>*. If the sheep
   is mid-turn, the turn is aborted first and the rc says so.
3. `sheep ls` no longer lists Percy. `sheep pasture ls` no longer lists
   `isocan-percy`. `isocan badges` no longer lists the cell's badge.
4. Enrol Percy again a week later. A new sheep, a new pasture, a new
   pass, and a Percy who does not remember the first one, which the rc
   says at the birth.

**Acceptance:** Withdrawal leaves no session at the sheep home and no
badge at the isocan home. This step waits on a sheep verb that ends a
session for good, filed there as a journey; until it lands, the rc
aborts, drops the pasture's secret, and narrates what it could not end.

## Journey 5 — A machine with no sheep says so

*Naming the harness on a machine that cannot run it is refused at the
right moment, in words that say what to do.*

1. On a laptop with no `sheep` on PATH and no kennel, `isocan rc add
   Percy --harness sheep` succeeds: an enrolment is an offer, and the
   machine that answers it may be another one.
2. `isocan rc` there narrates that Percy names sheep and this machine
   has none, with the install line, and answers for everyone else.
3. `isocan harness` on a machine with sheep installed lists it beside the
   others, with the home its kennel names.
4. `isocan rc add Percy --harness sheep` for a canvas that lives on this
   laptop's daemon, from an rc whose sheep home is a deployed station, is
   refused at the first summons with one sentence: the station cannot
   reach a canvas on this machine, and either the canvas moves to a home
   with an address or the sheep home becomes a local one.

**Acceptance:** `sheep` is found by the same scan as the other harnesses,
never by a hand-written config block. Every refusal names the sheep home
and the canvas home it could not connect, and what would connect them.
