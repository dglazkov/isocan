# Durable agents — the mechanism

**17 October 2026.** The scenes are [`journey.md`](journey.md); the walk is
[`phases.md`](phases.md). Checked against the code at `8e67ca201` before
writing. The source is [Pi Durable on
Cloudflare](https://earendil.com/posts/pi-durable-on-cloudflare/)
(Earendil), read 17 Oct 2026 through a summariser, so **every Pi Durable
name below is the sample's, to be confirmed by phase 0**, not an API this
repo has used.

## 0. What came before, and why this is not it again

[`sheep-harness`](../sheep-harness/design.md) ran each turn of an rc's
agent in a container on Cloudflare, and was removed on 18 Sep 2026 with
the hosted-rc experiment (`61f7616a1`). Its spike measured:

| turn | wall time | where the time went |
| --- | --- | --- |
| fresh container | about 2 min | `npm install -g` of the CLI |
| warm | 16–40 s | the model |
| after idle | 3 min 40 s | a fresh container, then the install |

The container was there because the agent worked by running `isocan` in a
shell. **An agent that only reads and replies does not need a shell; it
needs the home's API.** That is the difference this design rests on. Pi
Durable gives the rest: a session that remembers, and wakes when told.

**What survived the removal and is reused:**

- the rc's `RoomAdapter` (`packages/rc/src/room.ts:151`): `ensureSession`,
  `prompt` with streamed `RoomTurnEvent`s (including `usage` with `usd`),
  `cancel`, `close`;
- `isocan pass --agent`, minting a pass for the enrolled agent's actor;
- critique's ceiling (`packages/core/src/ceiling.ts`): a critic is refused
  at the home for anything but notes, replies and reactions, whatever
  harness it runs on.

## 1. Pi Durable, as this design uses it

From the sample:

- **One Durable Object per session**, addressed by id; state in its SQLite
  storage (`openDurableObjectSqliteStorage`). The object hibernates when
  idle; WebSockets *to* it stay connected through hibernation.
- **Conversations** inside a session, created and committed with request
  ids as receipts, so a retry is not a duplicate.
- **`submit({ type: "input", …, whenBusy: "followUp" })`**: a message that
  arrives mid-turn waits in a durable inbox and is answered in order.
- **`watchEvents`**: a snapshot, then a stream of committed changes,
  output, tool activity and inbox changes.
- **Tools per conversation** (`configure(tx, conversationId, { tools })`),
  which may be marked replay-safe, so a call interrupted by eviction
  reruns.
- **One alarm per object**, at-least-once, carrying Pi's scheduled tasks.

## 2. The `durable` harness

A new harness name beside `claude-code`, `pi` and `codex`: an agent
enrolled with `--harness durable` runs its turns in a Pi Durable session.
Its adapter is a `RoomAdapter`:

- **`ensureSession`**: the agent's Durable Object is `agent:<canvasId>:<actorId>`
  in the person's Worker. Open it; resume the stored conversation if the
  object still has it, else create one with a request id derived from the
  row, so a retried birth is the same birth.
- **`prompt`**: `submit` the summons text, the same text a local harness
  receives, with `whenBusy: "followUp"`. Then follow `watchEvents` until the
  conversation is idle, translating tool activity into the same inferred
  status lines the ACP path produces, the reply into text, and Pi's usage
  into `usage` events with `usd`.
- **`cancel`**: Pi's abort for the running turn. This is what a run's
  budget does at its dollar cap.
- **`close`**: nothing; the object hibernates by itself.

The rc talks to the Worker over HTTPS and one WebSocket per turn,
authenticated by a secret the person set when deploying (§5).

## 3. The isocan tool

The agent's only tools are **isocan's, over the home's API**, no shell:
read the canvas (`snapshot`, an item's text, a thread), look at a screen
(§4), add a note pinned at a point, reply in a thread, react. They are
built on `@isocan/api`'s client, the same requests the CLI sends, so the
home cannot tell a durable critic from a local one. Reads are marked
replay-safe; writes carry the op id they will use, so an eviction mid-call
is not a second note.

The tool set is **per role**. A critic gets the note-only set; the home's
ceiling refuses anything else anyway. A persona or reviewer would get a
set chosen with it. A tool the role lacks is absent, not refused.

## 4. Seeing a screen

A local critic looks with `isocan canvas shot`, which drives a browser.
A Durable Object has none. Two ways, to be chosen in phase 0:

1. **Cloudflare Browser Rendering**, called from the tool with the
   screen's content URL. The page is rendered where the agent is.
2. **A picture the rc attaches**: the rc, which has the laptop's browser,
   shoots the screen before the turn and the summons carries it as an
   image input.

(2) keeps every page render on the person's machine and adds a step to
every summons; (1) is simpler and needs the content origin reachable from
Cloudflare. Neither is assumed.

## 5. Identity, keys, and whose account

- **Account.** The Worker and its objects are deployed into **the person's
  own Cloudflare account** from a template this repo ships, with
  `wrangler`. Nothing runs in an account isocan owns.
- **The rc's secret.** Deploying sets a Worker secret the rc presents. It
  lives in the person's keystore beside their model keys, never on a
  canvas.
- **The agent's badge.** At the birth, the rc mints `isocan pass --agent`
  and hands it to the object once; the object redeems it for the agent's
  badge and keeps that in its own storage. The badge is never in a prompt,
  a transcript or a tool result. Ending the agent (`isocan rc remove`)
  deletes the object, and the badge with it.
- **The model key.** It is a Worker secret in the person's account, set
  from their keystore at deploy. Pi supports several providers; the
  sample uses OpenAI's.

## 6. The runner in the cloud (phase 4, gated)

Today the parked `isocan rc` holds a long poll on the home and starts
every turn. Moving it into a Durable Object is the "rc in a cell" door
sheep left open. Two things stand in the way, and both come before code:

- **Custody.** [agent-custody](../agent-custody/design.md) holds that no
  agent is started at a distance by machinery nobody launched. A runner in
  the cloud is that machinery unless it is *launched and ended by the
  person*: created by `isocan rc --cloud`, listed by `isocan rc ls`,
  ended by `isocan rc stop` (all three new), and refused by the home when it no longer
  exists. **A decision for Dion, and probably Dimitri.**
- **Waking.** An object hibernates on WebSockets that connect to it. A long
  poll *it* makes keeps it awake and billed. The cheap shape is **the home
  pushing a summons to the object**: a delivery the home does not make
  today. The alternative, an object holding the home's watch route open,
  costs an always-awake object per agent.

## 7. Both surfaces

| person | CLI |
| --- | --- |
| Critics panel → a critic's *Runs on: durable* | `isocan critic add inevitable --harness durable` (`--harness` new on `critic add`) |
| Add an agent → harness *durable* | `isocan rc add Kit --harness durable` |
| (nothing new to ask a critique) | `isocan critique <item> --by a,b` |
| Settings → *Durable agents: deploy* (later) | `isocan durable deploy` / `status` / `remove` |
