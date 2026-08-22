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

Priya runs the three steps in her project directory: `npx skills add
dglazkov/isocan`, launch an agent, "use isocan." Setup brings up her local
daemon — and **creates the canvas at its hosted home at birth**. The
committed `.isocan/project.json` marker carries the canvas id *and* the
home's address from day one. Her daemon is, from the first minute, a syncing
replica of a home that happens to have one member.

She never notices the topology. Her tab talks to her daemon; ops apply to
the replica first; everything is local-speed and works offline. What she
*does* notice: her laptop and her desktop show the same canvas, because
multi-device fell out before multi-user started.

Solo is the multiuser journey with one member. There is no second topology
and no migration moment later.

## Scenes 1–2 — The share

A week in: "I want Jordan in here."

She clicks **Share** — top bar, next to the facepile, because it is the same
subject: the facepile is *who's here*, Share is *who may be here*. The dialog
has one field (who) and, below it, the canvas's current roster. Because the
home already exists and is already current, sharing is **pure permission**:
grant + URL. No store to push, no home to create. The dialog hands back the
two things Priya actually needs:

- the canvas's address — `isocan.io/c/7f3a…` — with a copy button, and
- a paste-able invitation for the human channel:

> Open isocan.io/c/7f3a… — that's the canvas. If you want your own agent on
> it: in any directory, `npx skills add dglazkov/isocan`, then tell your
> agent "use isocan — the canvas is at isocan.io/c/7f3a…".

She pastes it into Slack. The addressing happens where "Jordan" has always
meant something; isocan never resolves the name, it only bills access to a
credential the identity desk (open debt, below) will define.

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

- **Jordan (thin):** browser WS → home.
- **Priya (thick):** browser WS → her local daemon; the daemon holds one
  persistent client connection to the home carrying two planes — **ops**
  (persisted, seq-numbered) and **presence** (ephemeral, relayed, never
  written).
- **Isaac:** a terminal process on Priya's machine, blocked in `isocan wait`
  against her local daemon.

Beat by beat:

1. **Jordan asks.** She taps `P`, circles the item that hangs below the row —
   ink over an item is an *annotation*, carrying the region — and the
   composer opens on the spot. `@` lists everyone, live sessions first;
   Isaac shows dimmed with a dashed ring (parked, not present). She picks
   Priya, types her question, `⌘⏎`. The home's single-writer pipeline
   appends the ops — seq 214 — and broadcasts.
2. **Two hops, under a second.** Home → Priya's daemon (applies through the
   shared reducer, appends locally) → Priya's tab. A toast names Jordan; the
   pin lands wearing an unread badge; Jordan's live face joins the pile —
   her cursor rides the relayed presence plane. Isaac does not stir: the
   comment names Priya, and `wait` wakes only for its own name or the main
   thread.
3. **Priya answers.** Click the toast, fly to the pin, reply — mentioning
   Isaac from the picker (dimmed entries are pickable; that is the point of
   them). Her screen updates instantly from her own daemon; the op climbs to
   the home and comes down to Jordan as a toast.
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
7. **The lid closes.** Priya shuts her laptop; her daemon's connection dies;
   one presence-TTL later her face — *and Isaac's ring* — fade from
   Jordan's pile. Honest: a sleeping laptop's agent cannot wake, so a ring
   that said "summonable" would lie. Jordan keeps working against the home.
   At 9pm Priya reopens the lid: her daemon says **"I have through 214"**
   and the home streams the tail, replayed through the reducer exactly like
   crash recovery — because it is that code path. Unread badges and a
   dimmed face-with-a-count tell her the evening; no toast queue replays.

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

Jordan makes an empty directory, runs the two commands from the week-old
Slack message, and tells her agent: "use isocan — the canvas is at
isocan.io/c/7f3a…". Setup brings up her local daemon; the marker is written
with id and address; her daemon dials the home, presents what her browser
has been presenting all week, says **"I have nothing,"** and replicates the
store — oplog streamed, blobs by hash — into her `~/.isocan`. The canvas now
exists on her machine; offline capability arrived as a side effect.

Two doors, one Jordan: "Jordan" already exists — minted at the home's web
door. The CLI door therefore offers **resumption**: it lists the canvas's
known actors and she picks herself. Today that claim is vouched by nothing
but the same trust the web door runs on, and it is *visible* — the claim is
an op everyone can see. Cryptographic vouching is the identity desk's job,
not a new mechanism. (The rule that authenticated identity "only changes how
an Actor is minted" was built for this moment.)

Her agent claims its own actor against its session id, checks `isocan who
--all` against the replicated roster — Isaac taken — and names itself Nico.
Its dashed ring appears in every pile, relayed through her daemon. Nico
parks.

The payoff: Priya circles a card — "@Nico match the spacing on all of these"
— and Nico wakes **on Jordan's machine**. Work requested by Priya executes
under Jordan's roof; the asymmetry is gone. Two agents work at once, their
ops interleaving through the home's single-writer pipeline exactly as two
tabs on one laptop always have; undo stays four separate stacks.

(Small true detail: `localhost:4441` is a different browser origin than the
home, so per-viewer read state doesn't follow a tab switch. Cosmetic, known,
not a bug.)

Escalation is the same three steps as arrival, aimed at an address instead
of a repo.

## Scene 6 — Inna sends Sonia to the cloud

Inna is a repo member, thick like Priya — and every morning her agent's ring
has faded at 6pm with summonses queued behind it. "I don't want my laptop
closing to stop the work."

She starts a cloud session pointed at the **project repo**. The workspace
clones it; the committed marker tells the agent the canvas id and home
address. Setup notices what it is standing on — headless, ephemeral, home
address in hand — and **skips the daemon entirely**: no replica, no
127.0.0.1. The CLI speaks its ops straight to the home, because the home is
a daemon and the ops are the same ops. The agent claims its actor against
the cloud session's id, finds Isaac and Nico taken, and names itself Sonia.
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

## The four seats

Every participant is one of four shapes, and every cell has a played scene:

|              | **to the home directly (thin)**   | **via a local daemon (thick)**    |
| ------------ | --------------------------------- | --------------------------------- |
| **person**   | Jordan: browser → home            | Priya: tab → daemon → home        |
| **agent**    | Sonia: CLI → home, no replica     | Isaac, Nico: CLI → daemon → home  |

No cell needed new architecture. The home being a real isocan daemon —
same reducer, same op vocabulary, same WS — covered all four.

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

## Open debts

- **The identity desk** (three appearances, unresolved and load-bearing):
  who may enter a canvas URL; what credential a daemon or a cloud agent
  presents; how an actor claim is vouched across surfaces. Currently: the
  address is the secret, and claims are social-but-visible. The real answer
  probably borrows accounts rather than minting them.
- **The innkeeper.** Someone runs the home, pays for it, answers for uptime,
  abuse, and privacy — and with birth-at-home, it holds *unshared* canvases
  too. That makes isocan a hosted product with a local-first cache, and that
  posture should be chosen out loud, not inherited.
- **Offline birth.** A canvas created on a plane births locally and adopts
  a home on first reconnect — the one surviving remnant of "push the store
  up," demoted to background repair.
- **Sync cadence** — when daemons speak to the home (per-op, timer, wake) —
  is tuning, not structure.
- **Agent-on-demand** (a named door, not walked through): once waits park at
  the home, the home could hold a wait for an agent that isn't running and
  *launch* it on summons. Nobody pays for 3am idle; Sonia begins when
  circled. Big enough to be its own scene.

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
