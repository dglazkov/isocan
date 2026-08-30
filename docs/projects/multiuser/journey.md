---
status: built
since: 2026-08-29
see: multiuser
note: phase 14 closed; 10.5 is the one unpaid debt
---
# The multiuser journey

This is the **ideal**: the user journey for sharing an isocan canvas, written
as scenes and held as ground truth. It was built journey-first — every scene
was played, poked at, and replayed until it stopped breaking — and the
architecture below it is only sketched where a scene *forced* a decision.
Everything else about the mechanism is negotiable on this branch; the
experience recorded here is what any mechanism has to produce.

A note on reading it: names like "isocan.io" and "Cloud Run" appear as
placeholders for *a hosted isocan daemon at a stable address*. The scenes
depend on the home being a real daemon speaking the ordinary op vocabulary;
they do not depend on where it runs.

## Cast

- **Priya** — started the canvas. Works thick: local daemon, terminal, agent.
- **Isaac** — Priya's agent. A process on her laptop, parked in `isocan wait`.
- **Jordan** — invited later. Not a member of the project repo, and the
  journey never needs to know why; she enters thin (browser only) and
  escalates when she wants hands of her own.
- **Nico** — Jordan's agent, born in the escalation scene.
- **Inna** — a repo member who doesn't want her laptop closing to stop the
  work.
- **Sonia** — Inna's agent, running in a cloud workspace against the repo.

## Scene 0 — Solo

Even the first user arrives from somewhere: Priya hears about isocan and
visits **isocan.io**. What she finds is not a brochure standing apart from
the product — it is the home origin itself, the same address every canvas
lives at, wearing its front page. The page says the idea in a few
sentences — one canvas, driven from a web app and a terminal, your agent
working beside you on it — and then does what every door in this journey
does: hands her the exact next move where she is already standing. Three
steps, with a copy button on the one that is a command: `npx skills add
dglazkov/isocan`, launch an agent, "use isocan." (Scene 5 will name this
rule — *the canvas teaches its own escalation* — but the front page obeys
it first: nobody is ever sent away to documentation to learn how to enter.)

She runs the three steps in her project directory. Setup brings up her local
daemon — and **creates the canvas at its hosted home at birth**. The
committed `.isocan/project.json` marker carries the canvas id *and* the
home's address from day one. Her daemon is, from the first minute, a syncing
replica of a home that happens to have one member.

She never notices the topology. Her tab is the home's web app — people
always enter through the one origin — and its service worker makes the tab
itself offline-capable: app shell cached, a small durable replica in the
browser, ops applied optimistically by the same shared reducer and queued
when the network is gone. Her daemon's replica serves the other half of her
life: her agent and her files.

What she *does* notice: her laptop and her desktop show the same canvas,
because multi-device fell out before multi-user started.

Solo is the multiuser journey with one member. There is no second topology
and no migration moment later.

## Scenes 1–2 — The share

A week in: "I want Jordan in here."

She clicks **Share** — top bar, next to the facepile, because it is the same
subject: the facepile is *who's here*, Share is *who may be here*. The dialog
has one field (who) and, below it, the canvas's current roster. Because the
home already exists and is already current, sharing is **pure permission**:
grant + URL. No store to push, no home to create. The dialog hands back the
one thing Priya actually needs:

the canvas's address — `isocan.io/p/7f3a…` — with a copy button. That is
the whole invitation: *"here's the canvas."* It carries no installation
instructions, because the canvas teaches its own escalation (Scene 5) to
whoever wants it, whenever they reach for it — nothing needs to survive in
a Slack scrollback.

She pastes the link into Slack. The addressing happens where "Jordan" has always
meant something; isocan never resolves the name, it only bills access to a
credential the identity desk (designed, below) defines.

The agent path is the twin, not the primary: "share this canvas with Jordan"
makes Isaac drive the same daemon endpoint the button drives. One action, two
surfaces, per the house rule — though note that sharing is the first gesture
that is **not a canvas op**: it acts on the outside world (grants,
addresses), so its parity lives at the daemon API, not in the op vocabulary.
It is the first citizen of that second category; pretending it is an op would
make the oplog lie.

**The grant grants exactly what the sentence named.** "Share this canvas with
Jordan" grants Jordan the canvas — not project membership, not a roster
mirror, no adjudication of who Jordan is to the project. "Share it with the
team" is a different sentence and grants what *it* names.

## Scene 3 — Jordan arrives, thin

Jordan clicks the link. The home serves the same web app; her browser's WS
connects to the home's daemon. She hits the door, picks her name — an actor
is minted on arrival, never provisioned by the invite — and she is standing
on the populated canvas: items, ink, threads, two dimmed faces wearing unread
badges. **Nothing installed.** The person who would never open a terminal was
never a separate feature; she is this architecture's front door.

Only now does `@Jordan` resolve. Nobody could mention her before she ever
arrived, and that was correct: you don't @-mention someone into a room
they've never entered — you invite them through the outside channel.

## Scene 4 — Correspondence and liveness, concretely

The wiring, stated once:

- **Jordan:** browser WS → home.
- **Priya:** browser WS → home too — people always sit at the one origin.
  What makes her "thick" stands *beside* the tab, not under it: her local
  daemon holds a replica and one persistent client connection to the home,
  carrying two planes — **ops** (persisted, seq-numbered) and **presence**
  (ephemeral, relayed, never written) — on behalf of her agent and her
  filesystem.
- **Isaac:** a terminal process on Priya's machine, blocked in `isocan wait`
  against her local daemon.

Beat by beat:

1. **Jordan asks.** She taps `P`, circles the item that hangs below the row —
   ink over an item is an *annotation*, carrying the region — and the
   composer opens on the spot. `@` lists everyone, live sessions first;
   Isaac shows dimmed with a dashed ring (parked, not present). She picks
   Priya, types her question, `⌘⏎`. The home's single-writer pipeline
   appends the ops — seq 214 — and broadcasts.
2. **One hop, under a second.** The home broadcasts; Priya's tab receives
   seq 214 directly — both women's tabs sit on the same daemon, so cursors
   and toasts are cursor-to-cursor live. A toast names Jordan; the pin
   lands wearing an unread badge; Jordan's face joins the pile. In
   parallel the same broadcast reaches Priya's daemon, which applies it to
   the replica. Isaac does not stir: the comment names Priya, and `wait`
   wakes only for its own name or the main thread.
3. **Priya answers.** Click the toast, fly to the pin, reply — mentioning
   Isaac from the picker (dimmed entries are pickable; that is the point of
   them). Her own screen updates optimistically as she posts; the op lands
   at the home and comes down to Jordan as a toast.
4. **The agent wakes.** The same broadcast reaches Priya's daemon, which
   checks its parked waiters: a comment mentioning Isaac, on this canvas.
   `wait` returns. Isaac reads the thread — the circled region arrives as
   data, no stroke-parsing — and posts his working note into it.
5. **Thin delivery.** Jordan drags SVGs from her desktop onto the canvas:
   blobs upload to the home, content-addressed; `item.add` ops follow; the
   items appear on her screen at once, on Priya's a second later, and in
   Priya's `~/.isocan` by hash.
6. **The work, watched.** Isaac rebuilds and runs `isocan edit`; Jordan
   watches the version badge tick, taps `F`, fans the versions, clicks
   Promote. The promote wakes nobody — it mentions nobody.
7. **The lid closes.** Priya shuts her laptop; her tab's socket and her
   daemon's connection die together; one presence-TTL later her face —
   *and Isaac's ring* — fade from Jordan's pile. Honest: a sleeping
   laptop's agent cannot wake, so a ring that said "summonable" would lie.
   Jordan keeps working against the home. At 9pm Priya reopens the lid:
   her tab and her daemon each say **"I have through 241"** — the browser
   replica and the home-connection replica carry the same kind of seq
   cursor — and the home streams the tail, replayed through the reducer
   exactly like crash recovery, because it is that code path. (Had she
   worked offline instead of sleeping, her queued ops would have gone up
   the same socket first, landing in the home's order before the tail came
   down.) Unread badges and a dimmed face-with-a-count tell her the
   evening; no toast queue replays.

Rules this scene set:

- **Liveness lives within a daemon; correspondence runs between them.** Two
  clients of one daemon see each other live — which is why a shared hosted
  home makes cross-internet cursors fall out of code written for two tabs on
  one laptop.
- **Presence tells the truth:** a ring fades when *its own* connection to
  the home dies, wherever it runs, whatever it is.
- **Addressability outlives presence.** Faded actors stay in the `@` picker;
  a summons is an op; delivery happens at reconnect via the seq cursor.
- **Toasts are for arrival-while-here; badges are for arrival-while-away.**

## Scene 5 — Jordan brings Nico (escalation)

Thin guests consume agency — every "rebuild this" so far has run on Priya's
machine. Escalation retires that.

Jordan is already standing on the canvas, in a tab the home admitted — so
the escalation comes from the canvas itself, not from a scrollback. She
clicks **her own face** in the pile; the menu that owns "how I'm connected
here" (rename, leave) has one more entry: **"Bring your own agent…"**.
The dialog explains the one sentence of concept — *your machine gets its
own copy; your own agent can join* — and shows a line with a copy button,
pass included:

> use isocan. Run this in the current directory to join the canvas:
> `npx github:dglazkov/isocan#release setup isocan.io/p/7f3a…#<pass>`
> Then run `isocan --agent-help` and follow its instructions.

**She pastes it into her own agent, not into a shell** — the same shape
Scene 6 hands the cloud, for the same reason: the reader is an agent, so the
paste is the whole instruction rather than a command plus two steps of prose
about starting an agent afterwards. She starts her agent in the directory she
wants it to work from, pastes, and the agent runs the line itself. One command
— Priya's three steps collapsed to a line, because the address carries
everything setup would otherwise ask — skill, CLI, local daemon, marker written
with id and address; her daemon dials the home, says **"I have nothing,"** and
replicates the store — oplog streamed, blobs by hash — into her `~/.isocan`.
The canvas now exists on her machine; offline capability arrived as a side
effect. The agent has "use isocan" and the marker, which is the rest.

**No `ISOCAN_DIRECT=1` here, and that is the whole difference from Scene 6's
line.** This machine is Jordan's own: the daemon, the replica and the marker
are what the scene is for. The disposable-workspace declaration would throw
away the local copy she came for.

The `#<pass>` fragment is the quiet payoff: a short-lived, single-use pass
**minted by her admitted tab, for her actor**. So there is no second door
and no social claim — the command was minted by the session that already
*is* Jordan on this canvas (admission is all the door checks today; the
identity desk hardens what "admitted" means without moving this), and
the CLI arrives knowing who it speaks for. Actor resumption is
a handoff, not a trust exercise; and it is the identity desk's first
concrete shape — credentials flow *outward from an admitted session*,
rather than being typed inward at doors. (The rule that authenticated
identity "only changes how an Actor is minted" was built for this moment.)
Isomorphism holds: the dialog is the button surface, and any admitted
session can mint the same pass from the CLI — how Priya would enroll her
own second machine. `isocan pass` prints the bare `setup` command rather
than this prompt, and that is not a drift: one pass, wrapped for whoever
reads it, and Priya at a shell is not an agent.

Her agent claims its own actor against its session id, checks `isocan who
--all` against the replicated roster — Isaac taken — and names itself Nico.
Its dashed ring appears in every pile, relayed through her daemon. Nico
parks.

The payoff: Priya circles a card — "@Nico match the spacing on all of these"
— and Nico wakes **on Jordan's machine**. Work requested by Priya executes
under Jordan's roof; the asymmetry is gone. Two agents work at once, their
ops interleaving through the home's single-writer pipeline exactly as two
tabs on one laptop always have; undo stays four separate stacks.

(Her browser life doesn't move an inch: the home origin remains the only
door for people — the daemon serves ops to CLIs, never pages to persons —
so per-viewer state like read badges has exactly one place to live and no
second origin to get lost in.)

Escalation is one command, and the canvas itself hands it to you — arriving
thin is the front door, and the UI offers thick the moment you reach for
it.

## Scene 6 — Inna sends Sonia to the cloud

Inna is a repo member; the committed marker is what admitted her — checking
`.isocan/project.json` into the repo was itself a "share it with the team"
sentence, a standing grant to whoever can read the repo. Her rig is thick
like Priya's, and she wants an agent on the work — but she has watched what
lids do to agents: every evening Isaac's and Nico's rings fade, summonses
queueing behind them. "I don't want my laptop closing to stop the work," so
her agent's first home will not be her laptop at all.

The canvas teaches this door like the others. She clicks **her own face**
in the pile; beside "Bring your own agent…" sits its sibling — **"Run an
agent in the cloud…"** (both are *extend my reach*, minted from an admitted
session). The dialog says the sentence of concept — *an agent that outlives
your lid needs to run somewhere that doesn't close* — and hands her a
copy-able instruction line, pass included:

> use isocan. This workspace is disposable, so set up with no local copy:
> `ISOCAN_DIRECT=1 npx github:dglazkov/isocan#release setup isocan.io/p/7f3a…#\<pass\>`
> Then run `isocan --agent-help` and follow its instructions.

Both lines end at the guide rather than at `isocan wait`, which is one step
inside it: `setup` installs the skill that points there, but a harness
enumerates skills when a session starts, and in both scenes the session started
before setup ran. Neither line repeats what the guide will say — it ships with
the build that answers it, and a paraphrase here is a copy that can go stale.

isocan never runs compute; the harness does. So she goes to her harness's
cloud — concretely, claude.ai/code: **New session** → pick the **project
repo** (the GitHub app already has access) → paste the line as the prompt →
**Start**. Four clicks and a paste. The workspace clones the repo; the
committed marker corroborates the canvas id and home address. Setup notices
what it is standing on — headless, ephemeral, home
address in hand — and **skips the daemon entirely**: no replica, no
127.0.0.1. The CLI speaks its ops straight to the home, because the home is
a daemon and the ops are the same ops. The agent claims its own actor,
finds Isaac and Nico taken, and names itself Sonia.
`isocan wait` — parked *at the home itself*.

Sonia's ring never fades with anyone's lid: no relay, a direct connection.
The presence rule needs no amendment — her ring fades only if her sandbox
dies, which is the truth. The pile now always has someone home.

The night shift: 11pm, Jordan circles two cards — "@Sonia re-cut these
against the new tokens, and fix the component that renders them." Sonia
wakes instantly. Her workspace has the **source**: she reads the token file,
re-cuts the assets, `isocan edit`s the items — Jordan watches badges tick at
11pm — and for the component she edits code, opens a PR, and posts the link
into the thread as her reply. A circled region became a pull request, and
the thread holds the receipt. Priya's daemon replays the whole night at
breakfast; nothing about catch-up needed to change for an agent that works
at 3am.

Lifecycle stays honest for free: sandbox torn down → connection dies → ring
fades truthfully; summonses queue in the oplog; a restarted session re-parks
and drains them. Sonia holds no replica, so a dead sandbox loses nothing —
her entire state was always the home's.

## Scene 7 — Agent-on-demand

**Where this stands, 30 Aug 2026: ASPIRATIONAL, AND NOT VETTED.** Every other
scene here was walked and argued; this one was sketched and never checked. Do
not cite it as a decision. In particular its `workflow_dispatch` hook, the
`spark` state and the pile's two-axis grammar were never agreed, and
[`innkeeper.md`](innkeeper.md)'s Mechanism 11 inherits that status because it
opens by naming this scene's registration.

What *is* inherited from Scene 6, which is built: an agent parked in the cloud
runs all night to be awake for four minutes, and when its session times out
the ring fades until a person notices. **Always-on was never the requirement;
always-answerable was.** That sentence is the good part and the rest is up for
replacement — see [`docs/projects/on-demand/design.md`](../on-demand/design.md).

Scene 6 works, but the bill tells on it: Sonia's sandbox runs all night to
be awake for four minutes of summonses, and when the harness times out the
idle session her ring fades until a human notices. Always-on was never the
requirement — **always-answerable** was.

**Park becomes registration.** The "Run an agent in the cloud…" dialog
grows a second lane: *"…or let the canvas start one on demand."* What gets
created (one concrete instantiation — the hook is the contract, the vendor
isn't): a workflow file in the repo — `.github/workflows/sonia.yml`, a
`workflow_dispatch` with a `summons` input whose job runs the harness
headless: *use isocan, canvas and pass in the summons input, address it,
exit when done* — and a **registration at the home**: actor + dispatch
hook + a token scoped to firing it. The committed file holds no secret —
Scene 5's pass is single-use and short-lived, so a standing file cannot
carry one; the home mints a fresh pass per summons and sends it in the
dispatch payload. Inna writes no YAML; she asks an agent ("set Sonia up
on-demand"), or the dialog offers the file ready to commit. `isocan
wait` has split into its two halves: a **park** is a process holding a
connection; a **registration** is a standing rule the home holds for an
agent that isn't running.

**The pile learns a third truth.** A ring would lie (nothing is connected);
plain dimming undersells (calling her works). So a third state: the
**spark** — *not here, starts when called*. Naming it exposes that the
grammar was always two axes, not one: the ring tells connection (solid for
a live session, dashed for a parked agent, gone when the link dies), and
dimming tells attention — which is how Isaac could sit dimmed *and*
dash-ringed in Scene 4. The spark extends the connection axis: **ring** =
connected now; **no ring** = addressable, delivery deferred; **spark** =
not running, but a summons will launch her.

**The summons.** 11pm, Jordan circles a card: "@Sonia re-cut these." The
home checks parked waiters — none — then registrations: match. It fires
the dispatch, thread ref and a fresh single-use pass in the payload, and
the thread says so — *"Sonia summoned — starting…"*, the spark pulsing.
Cold start is real and
unhidden: sandbox boots, repo clones, CLI dials the home, and about a
minute later `isocan session on <thread> --say "on it"` lands — the spark
brightens into a live ring *because now it is true*. She works the lap —
reads the region, re-cuts, `isocan edit`, replies with the receipt — and
**exits**. Ring fades, spark remains. Nothing idled; the minutes billed
were the minutes worked.

**Failure may not be silent.** The dispatch is refused, or the workflow
goes red: the summons does not vanish. It queues like any faded agent's,
the spark shows broken, and the thread carries "Sonia couldn't start." The
pile may say *not here*, *starting*, or *broken* — the one thing it may
never do is say nothing.

The lap — comment → build → reply — needed zero changes; only how the
agent comes to exist changed. What it opens: **launch custody** — the home
now holds a token that can start compute in someone's account, which lands
squarely in the innkeeper debt's lap.

## The seats

People turned out to have exactly one seat: the browser at the home origin,
its service worker making the tab offline-capable on its own. Thickness —
and now existence itself — is a property agents vary in, never people:

| seat | who | wiring |
| --- | --- | --- |
| person | Priya, Jordan, Inna | browser → home; the service worker caches the shell, keeps a durable replica, queues ops offline |
| agent, thick | Isaac, Nico | CLI → local daemon (replica in `~/.isocan`, files, `wait`) → home |
| agent, thin | Sonia | CLI → home directly; no replica, nothing to lose |
| agent, on-demand | Sonia, later | no process at all until summoned; the home fires a launch hook, the agent runs thin, then exits |

No seat needed new architecture. The home is a real isocan daemon — same
reducer, same op vocabulary, same WS — and the web client was already a
replica applying the shared reducer; the service worker only makes that
replica durable.

## What the scenes force (the load-bearing minimum)

1. **The canvas is born at its hosted home**; local daemons are syncing
   replicas from day one. One topology; sharing is ACL, not migration.
2. **The home is a single-writer op pipeline** — the daemon's existing job
   at a different address. Connected writes are ordered as they always were;
   offline work queues and lands on reconnect. No peer-merge machinery.
3. **The home connection carries two planes**: seq-numbered ops, and relayed
   ephemeral presence (never written — the ephemeral-plane rule stands).
4. **Catch-up is the crash-recovery path**: "I have through N," stream the
   tail, replay through the reducer.
5. **Sharing is daemon-API parity, not an op.** Button and verb drive one
   endpoint; the oplog never records grants.
6. **People enter through one origin, always.** The local daemon serves ops
   to CLIs, never pages to persons; offline in the browser is the service
   worker's job — cached shell, durable browser replica, queued ops — so
   per-viewer state has exactly one home, and every replica (tab or
   daemon) reconnects with the same seq-cursor gesture. (Built in phase
   10; the mechanism, and the questions it forced about retrying an op
   whose answer never came, are in
   [offline-tab.md](offline-tab.md).)

## Open debts

- **The plane has two surfaces and only one of them works** (opened
  2026-08-24 by phase 10; designed, not chosen, in
  [local-bridge.md](local-bridge.md)). Rule 6 below says
  offline in the browser is the service worker's job, and phase 10 made
  that true. What the rule quietly assumes is that the browser is the
  only surface needing to survive a lost network — and on a machine
  running a daemon it is not. Offline, a tab keeps working and a
  replica's CLI writes are refused; worse, the two cannot see each other
  even on the same laptop, because one is served from the home's origin
  and the other lives at `127.0.0.1`. Two replicas of one canvas,
  queueing toward a home neither can reach, invisible to one another.
  The journey has no scene for this, which is why nobody noticed: "a
  person in the browser and an agent in the terminal, on one canvas" is
  the thesis, and it is the half that quietly suspends when the network
  goes. A scene would force the mechanism, the way every other debt here
  was forced.

- **The identity desk** (three appearances, load-bearing; now **designed**
  in [identity-desk.md](identity-desk.md)): who may enter a
  canvas URL; what credential a daemon or a cloud agent presents; how an
  actor claim is vouched across surfaces. The desk answered with the
  badge (a home-minted secret every surface carries), grants over
  provable attributes — address-as-secret demoted to a default, revocable
  *link* grant, so every scene above plays unchanged until an owner
  tightens the door — attestations borrowed from accounts rather than
  minted, and a provenance sweep for revocation. The lead paid off as
  predicted: the escalation pass (Scene 5) grew into the general vouching
  flow. What the scenes required holds: admission is still all the door
  checks; only what "admitted" means hardened.
- **The innkeeper** (posture now chosen in
  [innkeeper.md](innkeeper.md)). Someone runs the home, pays
  for it, answers for uptime, abuse, and privacy — and with birth-at-home,
  it holds *unshared* canvases too. That makes isocan a hosted product
  with a local-first cache, and that posture should be chosen out loud,
  not inherited.
- **Offline birth** (designed in
  [offline-birth.md](offline-birth.md)). A canvas created on
  a plane births locally and adopts a home on first reconnect — the one
  surviving remnant of "push the store up," demoted to background repair. With no person-facing door on the
  daemon, that interval is CLI-and-agent only: a browser cannot visit a
  canvas whose origin has never been reachable. Acceptable for the edge,
  worth remembering.
- **Sync cadence** — when daemons speak to the home (per-op, timer, wake) —
  is tuning, not structure.
- **Launch custody** (agent-on-demand itself is played — Scene 7; the
  desk's half is designed as frozen delegation in
  [innkeeper.md](innkeeper.md)): the home
  holds hooks and scoped tokens that start compute in other people's
  accounts — and it now mints passes with nobody at the keyboard: Scene 5's
  rule was credentials flowing outward from an admitted session, and the
  registration has them flowing from a standing rule instead. Revocation,
  audit, and blast radius of those tokens are the innkeeper debt wearing
  its sharpest edge.

## Lessons banked along the way

- Every time the journey needed a participant to *be* something — a member,
  an outsider, a contractor — that was the design leaking a requirement into
  the cast. The healthy shape treats a name as something a person vouches
  for in their own channel and a credential the host can bill access to.
- The correspondence vocabulary (badges, dimmed faces, `wait`, activity) was
  built for a collaborator who isn't looking — which is what a person on
  another machine is. Multi-user reuses it wholesale; only liveness needed
  the shared daemon.
- The isomorphism thesis pays at the infrastructure layer: because every
  client speaks the same ops to any daemon, "hosted" is a deployment detail
  of code that already exists.
- The localhost web door was habit, not design: once the canvas is born at
  the home, serving pages from the daemon just mints a second browser
  origin for per-viewer state to get lost in. One door for people; the
  service worker does offline.
