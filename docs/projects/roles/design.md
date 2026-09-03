# Roles

**2 September 2026.** Design. Nothing built. The project's status lives in
[journey.md](journey.md)'s front matter. The journeys are the acceptance
suite, this doc is the argument, and [phases.md](phases.md) is the walk.

This doc starts from the [1 Sep research](../../research/2026-09-01-roles.md)
and keeps its two conclusions: the rungs are a total order compared in one
place, and the new rung is spelled `read` so that nothing already written
changes meaning. It then adds what the journeys need beyond one canvas: a
grant that names a set of canvases, a subject that names a set of people, a
row that says no, and a way for a change to reach a person who is already on
the canvas.

## What exists, exactly

Read before designing, so the design changes shape and not logic where it can.

- **The rung is a field on a grant row, copied onto the admission at the
  door.** `Grant.capability` is `"edit" | "view"`, absent means edit, and
  `desk.admit` writes the same value onto the badge's admission. Every
  request after that reads the admission, never the grants
  (`server/grants.ts` `capabilityIn`). A `view` admission is re-asked on
  every request so that an invitation proved after entry takes effect
  (`heldCapability`). An `edit` admission is never re-asked, because nothing
  above edit exists.
- **The door test already picks the highest rung.** `admittingGrant` sorts
  live rows by capability then by age and takes the first that matches the
  badge. Highest-wins is one comparator away from being a four-rung ladder.
- **The sweep is the one recompute.** `server/sweep.ts` `sweepCanvas`
  re-reads every badge admitted to a canvas, re-runs the door test for every
  badge whose provenance no longer stands, expels the ones the door refuses,
  and re-roots the rest with the new grant's capability written over the
  old. It is called after every grant revocation and every replacement.
- **Ownership is `project.createdBy`, checked against the badge's claims.**
  It gates exactly one thing: writing a row whose capability differs from
  the standing one, the link's included. Any editor may invite at edit and
  may turn the link off.
- **Grants are keyed by grant id and queried by `canvasId`.** That is the
  only grant query in either desk. Firestore holds them in one `grants`
  collection; the file desk in one map.
- **Sockets are indexed by canvas only.** `ws.ts` keeps a set of sockets per
  room and never records which badge holds which socket. No server message
  changes a connection's capability; the only server-initiated exits are a
  room-wide close on `canvas-deleted` and on a replica falling behind.
- **A `group:` subject would pass today's attester refusal as if it were the
  link.** `attestedKindOf` returns null for any unknown prefix and
  `attesterRefusal` treats null as "needs no attester".
- **Eleven places test the literal `"view"` to decide whether to write the
  field.** Both desk backings on `admit` and `reroot`, the cloud desk's
  `toGrant`, the grants route, the hello, the API client, the web client, and
  the home link's forwarder. Any rung those places have not met is stored as
  absent, which reads back as edit. The cloud desk's own comment records
  that this shape once escalated `view` to `edit` on the hosted home.
- **`POST /api/oplog/watch` checks no admission.** It takes a list of canvas
  ids from the caller and is not under the canvas-scoped prefix, so any
  badge on the home can read any canvas's oplog. Pre-existing, and named
  here because this design says the refusal is the daemon's.

## The ladder

```ts
export type Capability = "view" | "read" | "edit" | "own";
const RUNGS: readonly Capability[] = ["view", "read", "edit", "own"];
export function atLeast(held: Capability, needed: Capability): boolean;
export function highest(a: Capability, b: Capability): Capability;
```

In `core/src/grants.ts`, beside `capabilityOf`, which keeps answering `edit`
for an absent field. The wire rule changes from "written only when it
narrows" to **written whenever it is not `edit`**. That is the same rule for
every row in the wild, because `view` is the only value that was ever
written.

Every call site that compares changes to `atLeast`:

| Where | Today | After |
| --- | --- | --- |
| `http.ts` onRequest hook, `/api/ops` | `=== "view"` refuses writes | `!atLeast(held, "edit")` refuses writes |
| `http.ts` grants routes | `ownsThisCanvas` for the link's capability | `atLeast(held, "own")` for every write to grants |
| `ws.ts` hello, `GET …/canvas` | `capability?: "view"` | `capability?: Capability`, absent means edit |
| `sweep.ts` | re-roots when the root no longer stands | re-roots when the root no longer stands **or the rung the door would give differs** |
| `admittingGrant` | `rank` is `edit` before `view` | sorts by rung index, descending |
| web `CanvasPage` | `view` opens the deck | `view` opens the deck, `read` opens the canvas with writes hidden, else the editor |
| CLI `share --link` | `on / off / view` | `on / off / view / read / edit`; `--as <rung>` on an invitation |

The refusal for a `read` admission meeting a write is today's `ViewOnlyError`
with its code unchanged and its message widened: *you may read this canvas
but not change it*. Old clients branch on the code and keep working.

**What an old client does with a new rung.** An old CLI or web build reads
`capability` as `view` or not-`view`. It renders a `read` admission as an
editor and has every write refused with `view-only`, which it already knows
how to say. It renders an `own` admission as an editor, which loses nothing.
An old home refuses `read` and `own` on POST with `bad-grant`, because it
already checks the word. Nothing is silently wrong in either direction.

## Who holds what

A person's rung on a canvas is the highest rung from every row that admits
them, across the canvas and its space, with two exceptions applied first:

1. **The creator holds `own` and cannot lose it.** Not a row. `ownsCanvas`
   stays exactly as it is and becomes the floor under everything below. The
   same floor applies to a space's creator over the space. The floor is
   applied at the door, not only on owner routes: today the revoker of a
   link is expelled with everyone else who came in on it, and journey 1
   step 2 says the creator stays.
2. **A bar refuses.** A live row with `bars: true` whose subject matches the
   badge refuses it at the door regardless of any other row, unless the
   badge claims the creator.

The order in `admittingGrant` becomes: gather rows from both scopes, drop
revoked ones, sort the rest by rung then age, take the first match. Then,
only if a bar matched or no row did, ask the floor: does the badge claim
the creator. That keeps the floor's cost, one `claimsOf` read, off the
common path, where a row answers. `admittingGrant` therefore takes the
creator's actor id as an argument. Every caller has it: `admit` and the
socket upgrade hold the snapshot, and `sweepCanvas` is handed it by the
routes that call it. A badge admitted by the floor is admitted with
`{root: "created"}`, the provenance the sweep already keeps without a door
test.

The provenance written onto a row's admission names the row's id, whichever
scope it came from, so the sweep's `{root: "grant"}` case does not change
shape. Its lookup does: it must find the row in the canvas's rows or the
space's rows.

**Held rung when it matters.** The HTTP hook needs `edit` and the admission
answers it, as now. The grants routes and the space routes need `own`, and
for that the server computes `heldRung(desk, canvas, badge)`: the admission's
rung, raised to `own` if the badge claims the creator. One `claimsOf` read,
only on routes that ask for `own`. This is `ownsThisCanvas` with a wider
answer.

**Over a replica, the write names the person.** A forwarded grant write
arrives at the home as the daemon's badge, whose claims are everyone that
daemon has relayed. Today that is enough for the one owner-gated write and
wrong for a shared machine. After this every forwarded write to grants, a
space, or a group carries the actor id the local badge claims, and the home
checks two things: the actor is among the relaying badge's claims, and the
actor holds `own`. That is the trust the home already extends to a daemon
about which of its people is acting, the presence relay's rule, applied to
a write.

**The re-ask.** Today a `view` admission re-runs the door on every request so
that a proof made after entry takes effect. It exists for the one case the
sweep cannot see: a badge that changed, not a grant that changed. It stays,
widened in two ways `heldCapability` hardcodes today: it runs for every
admission below `edit`, so a reader who proves an address is raised too,
and it re-roots to whatever rung the door now gives rather than only to
`edit`. Editors and owners stay on the short-circuit. Every change to a grant, a bar, a space's
membership, or a group's membership is followed by a sweep, and the sweep is
what raises and lowers the people already inside. That makes the sweep the
single recompute for grant-side change.

**The sweep recomputes rungs, not only roots.** `decide` today keeps a badge
whose grant row still stands, and keeps a pass-rooted badge whose minter
survived, without asking what rung either now holds. After this it asks the
door for the rung and re-roots when that differs from the admission's, and
for a pass root it adopts the minter's rung, so an agent is lowered and
raised with the person who enrolled it. `passes.ts` admits with the
minter's rung at mint time instead of none. The cost is one door test per
admitted badge per sweep, which the sweep already pays for every badge whose
root fell.

## What only an owner may do

Every write under `/api/projects/:id/grants` and every write to a space
asks `own`. That includes inviting and turning the link off, which any editor
may do today. This is the one change in behaviour for existing users and it
is deliberate: the research's argument stands, that an editor who can invite
is an owner with extra steps. The refusal names the remedy: *ask <name>, who
owns this canvas*, with the name resolved the way the Share dialog resolves
`createdBy` today.

`own` is grantable. A row at `own` on a canvas makes its holder able to do
everything the creator can, except remove the creator. A row at `own` on a
space makes its holder an owner of the space and of every canvas in it.
Withdrawing `own` is revoking the row, like any other. There is no transfer
flow. Adding an owner and leaving is how a canvas changes hands, and the
creator's row stays on the canvas as a record of who made it.

## The space

A space is desk state at the home, like a grant, and for the same reason:
it is part of what a grant means, and the two-ledger rule says what a grant
means does not travel to a replica.

```ts
export interface Space {
  id: string;            // spc_…
  name: string;
  createdBy: string;     // actor id, the floor
  canvasIds: string[];
  at: string;
  deletedAt?: string;
}
```

The set of canvases lives on the space and not on the canvas record. The
canvas record is oplog state and replicates to every laptop that holds the
canvas, and a laptop has no use for the id of a space it cannot see. It also
means moving a canvas is a desk write and not an op, so nothing in the op
vocabulary changes.

**A canvas is in at most one space.** The write that adds a canvas to a
space refuses when the canvas is already in another. Two spaces would make
the highest-wins rule read from an unbounded set of rows and would make "the
space's Share" ambiguous. If a later journey needs it, the door test already
reads rows from a list of scopes and would not change.

**A grant names one scope.** `Grant` gains a discriminated scope:

```ts
type GrantScope = { canvasId: string } | { spaceId: string };
export type Grant = GrantBase & GrantScope;
```

Every row in the wild has `canvasId` and matches the first arm with no
migration. Firestore adds one query, `where("spaceId", "==", id)`, and the
file desk one filter. `grantsFor(canvasId)` keeps its meaning and
`grantsForSpace(spaceId)` is added beside it, so no caller that asks about
one canvas suddenly sees rows it did not ask for.

**The door reads both.** `admittingGrant` asks `desk.spaceOf(canvasId)`, a
Firestore `array-contains` on `canvasIds`, then merges the two lists. One
extra desk read on every door test, because a canvas in no space cannot be
told apart without asking. The wide canvas list runs a door test per canvas
the badge has not been in, so it memoizes: `spacesFor(badge)` once, and the
canvas-to-space map from those rows, so the list pays one query per visible
space rather than one per canvas.

**The floor, not the ceiling.** A canvas's own rows can only add to what the
space gives, because highest-wins across both scopes cannot subtract. That
is the rule journey 5 depends on and journey 4 step 4 works around: turning
the link off at the space is one space write plus a revocation of every
canvas's live link row, in a loop, each followed by that canvas's sweep. The
response says how many canvases it reached.

**Born in a space.** The birth link grant is written inside
`engine.createProject`, on the op path. A canvas born in a space needs the
engine told not to write it, and the op cannot carry the space, because the
op replicates and the space does not. So `SubmitRequest` gains an optional
`spaceId`, honoured only beside a `project.create`, request state and never
op state. The route checks `own` on the space, adds the canvas to it, and
submits with the birth grant suppressed. A locked space stays locked as it
grows. A canvas moved into a
space later keeps whatever rows it has, and the space's rows apply to it from
the moment it is added. That is why journey 4 moves the eleven canvases
before it sets the space's grants.

**Deleting a space** marks it deleted, leaves every canvas where it was with
its own rows, and sweeps each. Grants on the space become unreachable because
`spaceOf` no longer names it.

**Who may make a space:** any badge that claims an actor. The creator is
the floor, and a space with no grants is visible to nobody else, so making
one is a private act until it is shared.

### Routes

All at the home. A space belongs to the home its creator made it at and
holds only canvases whose home is that home; adding a canvas from another
home is refused with the reason. A replica forwards space and group routes
to its home when it has exactly one, using `homeScoped()`, and refuses them
on a mixed rig with a reason that names the homes. Grants routes keep
forwarding by canvas, as now.

| Route | Needs | Does |
| --- | --- | --- |
| `GET /api/spaces` | a badge | spaces the badge may see: created by its actor, or a live row admits it |
| `POST /api/spaces {name}` | an actor | creates, creator is the floor |
| `DELETE /api/spaces/:id` | `own` on the space | marks deleted, sweeps every canvas in it |
| `PUT /api/spaces/:id/canvases/:canvasId` | `own` on both | adds; refuses if the canvas is in another space |
| `DELETE /api/spaces/:id/canvases/:canvasId` | `own` on the space | removes, sweeps that canvas |
| `GET/POST/DELETE /api/spaces/:id/grants[/:grantId]` | `own` on the space for writes | the grants routes, scoped to the space; a write sweeps every canvas in it |
| `POST /api/spaces/:id/link {capability \| off}` | `own` on the space | journey 4 step 4: sets or revokes the link on every canvas, returns the count |

`GET /api/projects` does not change. It returns the canvas record, which is
oplog state, and a space id does not belong on it. `GET /api/spaces` returns
each space with its `canvasIds`, and the canvas list joins the two. A badge
admitted to one canvas sees no space in the second list and learns nothing
about the space around it.

`spacesFor(badge)` is bounded queries, never a scan, per the desk's
no-fallback rule: spaces by `createdBy` for each actor the badge claims,
spaces named by live rows whose subject is one of the badge's attested
attributes, and spaces named by rows on a group whose `members` contains one
of them. A space has no address, so **a space has no link row**; `link` is
refused as a space subject. **Every canvas in this space** writes the
per-canvas link rows in a loop, as journey 4 step 4 says.

**Names.** A space or group name is unique among the ones a person owns,
not across the home. The wire carries ids. The CLI resolves a name through
the list and refuses an ambiguous one by printing the ids.

**A canvas row below the space's rung** is written, and the dialog and the
CLI say it is below what the space already gives. It takes effect if the
canvas leaves the space.

## The group

```ts
export interface Group {
  id: string;            // ppl_… (grp_ already names a gesture group in the oplog)
  name: string;
  createdBy: string;     // actor id, the floor
  members: string[];     // normalized attributes: email:…, repo:…
  at: string;
  deletedAt?: string;
}
```

A new subject, `group:<id>`, beside `link`, `email:` and `repo:`.
`grantSubjectRefusal` checks the shape. `attestedKindOf` keeps returning
null for it, because `normalizeAttribute` lowercases every attested kind
and an id must not be folded; `attesterRefusal` gets its own `group:` case
instead of leaning on that null: a group subject is allowed when the home
has any attester at all, because its members are attested attributes and
the home must be able to prove one.

**Membership is read at the door.** `attestationSatisfying` has no desk and
cannot answer a group, so `admittingGrant` gains a branch: for a `group:`
row it fetches the group and asks whether any of the badge's attested
attributes is in `members`. One desk read per group row per door test. The
result is not copied onto anything, which is what makes removing a member
one write.

**Adding and removing a member both sweep.** The desk gains
`grantsBySubject(subject)`, Firestore `where("subject", "==", …)`, live
rows only. For each row the server computes the canvases it reaches, one
for a canvas row and the space's list for a space row, and sweeps each. A
removed member is expelled by that sweep. An added member who is already
inside on a lower rung is raised by it, for journey 2's reason: a change
reaches an open socket. An added member who is not inside is admitted at
the door when they arrive.

**Who sees the members:** the group's owners. A canvas or space owner who
uses the group in a grant sees its name and its size. A group is a private
list until its owner says otherwise, and a directory is a different feature.

**Who may make a group:** any actor, same as a space.

### Routes

| Route | Needs | Does |
| --- | --- | --- |
| `GET /api/groups` | a badge | groups the badge's actor made or owns |
| `POST /api/groups {name}` | an actor | creates |
| `GET /api/groups/:id` | `own` on the group, or a live grant names it | the group; members only for owners |
| `PUT /api/groups/:id/members/:attribute` | `own` on the group | adds, sweeps every canvas the group's rows reach |
| `DELETE /api/groups/:id/members/:attribute` | `own` on the group | removes, sweeps the same |
| `DELETE /api/groups/:id` | `own` on the group | marks deleted; its rows stop admitting; sweeps |

## The bar

A bar is a grant row with `bars: true` and no capability. It says its
subject may not enter, on this canvas or on this space, until the row is
revoked. It is a row and not a rung because a rung is compared by
highest-wins and a bar must beat every rung. It is a row and not a separate
table because everything that lists, revokes, and sweeps rows then works on
it without a second path, and `isocan share` prints it in the same table as
**kept out**.

A bar's subject is an address or a repo, never `link` and never a group.
Barring a group is un-inviting it.

The creator cannot be barred. `admittingGrant` checks the floor before the
bars, so such a row would do nothing, and the route refuses to write it
with a reason rather than store a row that has no effect.

**Withdrawing versus barring.** The Share dialog's **Remove** on a row
revokes it. If the canvas's link, or its space, would still admit that
person, the dialog says so before the revoke and offers **and keep them
out**, which writes the bar in the same request: `DELETE …/grants/:id?bar=1`.
The CLI says it in the same place: `isocan share --revoke <who>` prints
*they can still enter by the link; `--bar` to keep them out*.

## Reaching an open socket

Today a rung change reaches a person already inside only by re-rooting the
admission, and the client learns it on its next request. Journeys 2 and 3
want the app to change under the person's hands.

**The room remembers the badge.** `ws.ts`'s room becomes a map from socket
to badge id. That is the whole index: a canvas's sockets, each knowing whose
it is.

**The sweep reports per badge.** `sweepCanvas` returns what it does today
and additionally calls a listener per outcome, `(canvasId, badgeId, outcome)`
where the outcome is `{rerooted, capability}` or `{expelled}`. `ws.ts`
subscribes once, like it does to `engine.onEvent`.

**One new server message.**

```ts
{ type: "standing"; capability: Capability }
```

Sent to every socket the re-rooted badge holds on that canvas. The store sets
`capability` and `CanvasPage` re-picks its surface. An expelled badge's
sockets are closed with `WS_NOT_ADMITTED` and the reason string `withdrawn`,
which the store maps to the page's *your access to this canvas was
withdrawn* rather than *this canvas will not have you*, because the person
was inside and the difference is the whole message.

`isocan wait` holds no socket. It long-polls `POST /api/oplog/watch`, which
today checks no admission at all. That route learns to check one per canvas
in its list, which closes the hole named above, and an expelled badge's next
poll is refused with `not-admitted` and the reason `withdrawn`. The CLI
prints the reason and exits the wait. A replica's home link, which today
redials on any close it does not recognise, learns `WS_NOT_ADMITTED` and
stops, reporting the reason once.

What the daemon enforces between `read` and `view` is therefore nothing: both
may read the oplog and neither may write. The difference is what the home
tells the client to render, and whether the connection appears in presence.
That is stated here so nobody builds a test that expects a refusal.

## Presence says the rung

`PresenceSession` on the wire gains `capability?: Capability`, absent for
edit, set by the server from the connection's admission. The facepile's
hover card says **reading** for `read` the way it says *standing by* for an
available agent, and the Share dialog's roster uses the same word. Two
vocabularies is one too many, so the word comes from one map in core.

`view` connections stay out of presence, as they are today.

## The read-only canvas

The largest single piece of web work, and the one with no mechanism in it.
The store's `capability` becomes `Capability`. `CanvasPage` renders the
editor when `atLeast(capability, "edit")`, the canvas with writes hidden for
`read`, and the deck for `view`.

"Writes hidden" is a list, made once and checked by a test that walks it:
the toolbar and the create actions, drag and resize on items, the text and
stage composers, the comment composer, reactions, the trash, the context
menu's mutating entries, the command palette's mutating commands, and the
Share dialog's controls other than the address. Selection, pan, zoom,
minimap, the context panel, the files panel, versions, history, and following
a person stay. A reader who reaches a write anyway, through a shortcut the
list missed, is refused by the daemon and sees the `view-only` sentence,
which is the same sentence they see today.

A reader cannot comment, by the decision recorded in the journey doc:
comments reach agents, and a rung that can start work is not a viewer.
Reactions are ops and are refused with everything else.

## The Share dialog

Today: a switch and two radios for the link, a field to invite by address,
rows with **Un-invite**, and a roster. After:

- The link's radios become three: **Editor**, **Canvas Viewer**,
  **Presentation Viewer**. Rungs the space already gives are shown as
  given. Every control is disabled with the owner note for anyone below
  `own`, as the two radios are today.
- The invite field gains a rung picker with **Editor** selected. **Owner** is
  in the list.
- Each invited row shows its rung as a picker, and **Remove**. Changing the
  picker is one POST that replaces the row, which the route already does for
  a same-subject re-grant and follows with a sweep.
- Rows from the space render first, greyed, under *from the space <name>,
  set by <who>*, and link to the space's Share.
- Bars render under the invitations as **kept out**, with who and when, and
  a **Let back in**.
- The creator's row reads **Owner, made this** and has no control.

A space's Share is the same component with a space scope and one more row at
the top, **Every canvas in this space**, whose one control is the link
setting from journey 4 step 4. Below the rows it lists the canvases, each
marked when its own rows go wider than the space.

The canvas list draws a heading per space the badge may see and the flat
grid under **No space** last. A card's menu gains **Move to space…**, and
dragging a card onto a heading does the same thing.

## CLI

```
isocan share [who] [--as own|edit|read|view] [--link on|off|edit|read|view]
             [--revoke who [--bar]] [--unbar who] [--space name]
isocan space new <name> | list | add <name> <canvas>… | remove <name> <canvas>… | delete <name>
isocan group new <name> | list | add <name> <address>… | remove <name> <address>… | delete <name>
```

`isocan share` prints a rung column, prints space rows with a *from space*
mark, and prints bars as **kept out**. `--space` turns any `share` invocation
into the space's. `isocan list` groups by space when the home has any.

## Agents hold what their person holds

An agent's badge is admitted through a pass, and the sweep resolves a pass
root by the minting badge's outcome. Today it resolves the outcome only,
keep or expel, and never the rung, so a demoted person's agent would keep
editing. With the sweep change above it also adopts the minter's rung. So an
agent holds the rung of the badge that enrolled it, at the time of the last
sweep, and never more. A group grant that admits Priya admits Isaac.
Removing Priya from the group removes Isaac in the same sweep.

## Considered and left out

- **Ownership transfer.** A second flow with a second refusal. Adding an
  owner and leaving does the job.
- **A Commenter rung.** A comment reaches agents and can start work. Decided
  2 Sep 2026 with the journey doc; the refusal for a reader who tries names
  the owner.
- **A canvas in two spaces.** The door test would not change; everything
  people look at would become ambiguous.
- **`spaceId` on the canvas record.** It would draw headings with no desk
  read and let a replica show the space's name. It would also make space
  membership travel to laptops that cannot see the space, and make moving a
  canvas an op the engine cannot judge.
- **Copying group membership onto grants.** It would let the door skip a
  read and would make removing a member a rewrite of every row. Journey 6
  needs one write.
- **A negative rung.** A bar as `capability: "none"` would sit at the bottom
  of the ladder and lose to every other row under highest-wins. It has to
  win, so it is not a rung.
- **Per-action toggles.** The research's argument. A ladder is one
  comparison.

## What this is still not

- **Not a directory.** Groups are private lists. Nobody can browse who is on
  a home.
- **Not an audit log.** Rows carry who and when, and the sweep returns
  counts. Who saw what is not recorded.
- **Not an innkeeper's tool.** Everything here is done by owners of a
  canvas, a space, or a group. The innkeeper's powers are unchanged.
