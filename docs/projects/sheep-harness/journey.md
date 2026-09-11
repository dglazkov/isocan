---
status: partial
since: 2026-09-10
see: sheep-harness, on-demand, standing-agents, agent-custody, harnesses
note: phases 0 and 1 closed 10 Sep 2026 — sheep is a harness found by scan, its home carried on the rc row, a forgotten sheep resumed from its pasture's herd, the birth and a quiet cell narrated, tool beats on the face from the transcript. Journeys 1 and 2 walked on the deployed station against dev.isocan.io, journey 3's credential rule holds, journey 5's refusals are in the suite. Journey 4 is phase 2's, and waits on sheep#1 (its verb is on sheep's main); phase 3 is the week with the bill.
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
5. Activity Monitor shows one process for the rc. While Percy's turn
   runs there is one more, `sheep attach`, a thin client waiting on the
   cell, and every few seconds a `sheep log` that reads the transcript
   for the face's tool beats and exits; when the reply lands they are
   gone. No model and no agent runtime ever appear. The transcript read
   goes when `sheep attach` streams entries
   ([sheep#7](https://github.com/dglazkov/sheep/issues/7)).

**Acceptance:** No new gesture beyond the harness's name. The summons
Percy receives is the same text a local adapter would receive. The reply
is by the enrolled actor, not by you and not by the rc. The only things
of Percy's that run on the laptop are the client that carries a turn and
the transcript reads beside it, for the length of that turn, and nothing
after it.

## Journey 2 — The same Percy, a day later, in a fresh container

*Percy remembers, and Percy is still Percy, after the cell's container
has been torn down.*

1. The next afternoon, well past the home's idle period, comment again:
   `@Percy and the heading above it`.
2. The rc narrates *session <id> resumed*. The turn is slower than
   yesterday's, and the rc says while it waits that the cell has been
   quiet long enough for its container to be fresh, so setup is
   probably running. It is a guess from the clock, and the rc says so,
   until the home can tell it.
3. Percy's reply refers to yesterday's comment without being told about
   it. `isocan history Percy` shows both replies by one actor.
4. `isocan badges` on your machine lists the badge Percy's cell holds,
   the same one as yesterday.

**Acceptance:** One sheep id per agent across days, resumed and never
reborn while it exists at the home. One badge across containers. The rc
never mints a second pass for an agent whose sheep still exists: before
a birth it reads the pasture's herd, not only its own row, and a sheep
found there is resumed even when the row had forgotten it.

## Journey 3 — The credential never touches a transcript

*Percy's right to speak as Percy is a pass you could not read back even
if you tried.*

1. `sheep log <id>` from birth to now. The pass address appears nowhere:
   not in the opening prompt, not in a tool call, not in a result.
2. `sheep pasture secret ls isocan-percy` prints the name `ISOCAN_PASS`
   and no value.
3. In a turn, ask Percy to print its environment. The pass is not in it.
   Ask Percy to show its isocan home. It can: the badge the pass redeemed
   is Percy's own, kept in the workspace so it survives the container,
   and Percy holds it the way any agent holds its own badge. What Percy
   cannot do is mint a pass for anyone, because its badge holds no
   claim but Percy's.
4. Mint a pass by hand as yourself and try to hand it to Percy's pasture.
   The pass Percy redeems is for Percy's actor; a pass for yours makes
   Percy's cell arrive as you, which `isocan history` would show as your
   replies from a cell. The rc mints for the agent's actor and the desk
   refuses a claim the rc's badge does not hold.

**Acceptance:** The pass is environment for the pasture's setup script
and for nothing the model runs. The badge it redeems is the agent's
standing credential, readable by the agent and by nothing outside its
cell, and it speaks for the agent alone. The rc can mint a pass for an
actor it holds and for no other. Spent passes are not kept on the rc's
side.

## Journey 4 — Withdrawal ends the sheep

*When Percy is withdrawn, nothing of Percy is left running, listed, or
billed. The pasture stays: it is yours, not Percy's.*

1. `isocan rc remove Percy`, or the withdraw gesture in the web app.
2. The rc narrates the withdrawal, then *ending sheep <id>*. If the sheep
   is mid-turn, the turn is aborted first and the rc says so.
3. `sheep ls` no longer lists Percy. `isocan badges` no longer lists the
   cell's badge. `sheep pasture isocan-percy` still names the pasture,
   with a herd of none, and the rc said it would be left.
4. Enrol Percy again a week later. A new sheep born into the same
   pasture, a new pass, and a Percy who does not remember the first one,
   which the rc says at the birth.

**Acceptance:** Withdrawal leaves no session at the sheep home and no
badge at the isocan home. The pasture is never removed by the rc; sheep
has no verb for it and the pasture is the shepherd's. This step waits on
a sheep verb that ends a session for good, filed there as a journey;
until it lands, the rc aborts and narrates what it could not end. The
pasture's secret is a spent pass and needs no dropping.

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
