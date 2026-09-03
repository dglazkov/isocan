---
status: partial
since: 2026-09-02
see: multiuser, multi-identity
note: journeys, design and six phases written 2 Sep 2026; phases 1 to 3 built and walked the same day — the four-rung ladder compared in core, the creator's floor at the door, the read-only canvas, `own` as a grantable row with every grant write owner-gated, a rung change that reaches an open socket as `standing` or `withdrawn`, and the bar as a row that says no; journeys 1 to 3 play, journey 7 for the canvas. Phases 4–6 (the space, the group, the compatibility walk) are designed and not built. Starts from the 1 Sep roles research (a four-rung ladder on one canvas) and adds the space, the group, and the bar, because the journeys need a scope wider than one canvas and a subject wider than one address
---

# Roles — the journeys

These journeys describe who may do what on a canvas, and on a set of
canvases, and how that changes over time. Each journey is an acceptance
test: the work is done when you can walk it on a real deployment and it
behaves as written here. [design.md](design.md) is the mechanism and
[phases.md](phases.md) the walk. If a journey and the mechanism disagree,
the mechanism is what changes.

The starting point is the [1 Sep research](../../research/2026-09-01-roles.md):
four rungs on one ladder, **Owner, Editor, Canvas Viewer, Presentation
Viewer**, each able to do everything the rungs below it. That research
looked at one canvas. These journeys need two more things: a **space**,
which is a named set of canvases that access is set on once, and a
**group**, which is a named set of people that access is given to once.
Neither exists today. Everything below is written so that it could be walked
with today's vocabulary where the vocabulary suffices, and names the gap
where it does not.

Key terms, defined in the multiuser project's
[identity-desk](../multiuser/identity-desk.md) record:

- **Actor**: who you are on a canvas.
- **Badge**: the credential a browser or CLI holds after admission.
- **Grant**: one row saying a subject may enter a canvas. Today the subject
  is `link`, an email address, or a repo, and the row carries `edit` or
  `view`.
- **The door**: the dialog that asks for your name before you enter.
- **Owner**: today, whoever created the canvas. Not grantable.

## What exists today, and what each journey adds

| Today | After these journeys |
| --- | --- |
| Two rungs: `edit`, `view`. `view` is the deck. | Four rungs: `own`, `edit`, `read`, `view`. |
| Owner is `createdBy`. | Creator stays owner. Owner is also grantable. |
| A grant names one canvas. | A grant names one canvas or one space. |
| A subject is a link, an address, or a repo. | A subject can also be a group. |
| Any editor may invite. | Only an owner may invite, or change what the link allows. |
| Withdrawing means revoking one grant on one canvas. | Withdrawing at the space removes the person from every canvas in it. |

## Cast

- **Priya** — made the first canvas, and later the space. Owner.
- **Jordan** — invited to one canvas. Later invited to the whole space.
- **Sam** — a contractor. Gets in, does the work, and is shown out.
- **The design team** — Priya, Jordan, and three people the journeys never
  name. A group.
- **Isaac** — Priya's agent. Holds whatever Priya's badge holds, and no
  more.

The journeys are ordered from the smallest scope outward: journeys 1 to 3
are one canvas, journeys 4 to 6 are the space, journey 7 is the mechanism
under both, and journey 8 verifies nothing changed for anyone who never
touches any of this.

## Journey 1: Limit one canvas to the people you name

Priya has a canvas for a contract that must not leak. Today the canvas was
born with a link grant that admits anyone holding the address.

1. Open **Share**. The dialog shows **Anyone with the link** on, at
   **edit**.
2. Turn the link **off**. The dialog says who may still enter: Priya, and
   nobody else.
3. Under **Invited by name**, enter Jordan's address and choose a rung. The
   choices are **Editor**, **Canvas Viewer**, **Presentation Viewer**. Pick
   **Canvas Viewer**.
4. Jordan opens the link. The door asks for their name, and asks them to
   prove the address the invitation names. They prove it and enter.
5. Jordan sees the whole canvas and can move around it. Nothing on it
   moves under their hand. The toolbar offers no way to create, and a
   dragged item springs back. The refusal, if they reach one by another
   route, says: *you may read this canvas but not change it. Ask Priya, who
   owns it.*
6. Someone who has the address but no invitation opens it and is refused at
   the door: *this canvas is not open to the link. Ask whoever shared it.*

Acceptance criteria:

- Step 5 is enforced by the daemon, not by the app. `isocan` from Jordan's
  terminal, holding Jordan's badge, is refused every write with the same
  code the app would have been.
- Step 5 shows Jordan in the facepile, marked as reading. A person looking
  over your shoulder is a fact about the room.
- Nobody's existing access changes. A grant written before this journey
  with no rung still means edit, and one written with `view` still opens
  the deck.
- The same walk from the terminal: `isocan share --link off`, then
  `isocan share jordan@example.com --as read`.

## Journey 2: Open access one step at a time

The contract is signed. Priya wants Jordan to edit, and later wants the
canvas open to anyone with the link, and wants each step to be one gesture.

1. Open **Share**. Jordan's row reads **Canvas Viewer**. Change it to
   **Editor**. Jordan, who is on the canvas at the time, sees the toolbar
   appear without reloading.
2. Later, turn **Anyone with the link** on at **Canvas Viewer**. Someone
   with the address now enters and reads. Jordan still edits, because a
   named invitation is never less than what the link gives.
3. Later still, change the link to **Editor**. Everyone who came in by the
   link may now edit. Nobody has to re-enter.
4. Priya wants Jordan to be able to invite people without asking her. She
   changes Jordan's row to **Owner**. Jordan's Share dialog now shows the
   controls Priya's shows.

Acceptance criteria:

- Every step is one change to one row. No step revokes and re-grants.
- A person's rung on a canvas is the highest of every grant that admits
  them. Widening the link never lowers anyone; narrowing a named row never
  lowers them below the link.
- Step 1 reaches an open socket. The daemon tells the connected client its
  rung changed, and the app redraws without a reload.
- Step 4 makes Jordan an owner in every sense the daemon knows: Jordan may
  invite, change the link, and make other owners. Jordan cannot remove
  Priya, because the creator is the floor.

## Journey 3: Withdraw access from one canvas

Sam was hired for two weeks and edited alongside everyone. The two weeks
are over.

1. Open **Share**. Sam's row reads **Editor**. Choose **Remove**.
2. Sam's canvas, open in another tab, goes to the door within a few
   seconds: *your access to this canvas was withdrawn.* Nothing Sam did is
   undone. Sam's name stays on every item they made.
3. Sam opens the address again. If the link is on, Sam enters at whatever
   the link gives, as a stranger would. If the link is off, Sam is refused.
4. Priya wants Sam gone even though the link is on. She removes Sam and
   chooses **and keep them out**. Sam is refused at the door regardless of
   the link, until an owner invites them again.

Acceptance criteria:

- Step 2 expels every badge that entered on Sam's invitation, including
  Sam's terminal and any agent Sam enrolled. An agent parked in `isocan
  wait` on that canvas is told why it was dropped.
- Step 3 is the difference between withdrawing an invitation and barring a
  person. The dialog says which one it is doing before it does it.
- Step 4 is a row, not a delete. `isocan share` lists it as **kept out**,
  with who did it and when, and it can be lifted.
- The revoked row keeps who revoked it and when. Grants are desk state,
  not ops, so the canvas history does not show it.

## Journey 4: Make a space, and lock it to a group

Priya's team has eleven canvases. Each has its own link and its own
invitations, and Priya has stopped being sure who can see what.

1. On the canvas list, choose **New space**. Name it *Design*. The list
   now shows *Design* as a heading with nothing under it.
2. Drag the eleven canvases into it. Each moves with whatever grants it
   has. Nothing changes yet, because the space has no grants.
3. Open the space's **Share**. It looks like a canvas's Share, with one
   more row above the invitations: **Every canvas in this space**.
4. Turn **Anyone with the link** off for the space. This turns the link off
   on every canvas in it, in one gesture. The dialog says how many canvases
   that reached and that each one's own link can be turned back on.
5. Under **Invited by name**, enter *design team* and choose **Editor**.
   The design team is a group Priya made earlier from five addresses.
   Everyone in it may now edit every canvas in the space.
6. Jordan, who was invited to one canvas as a Canvas Viewer in journey 1
   and is in the design team, opens that canvas and finds they can edit.
   The space's grant is higher than the canvas's, so the higher one holds.

Acceptance criteria:

- A space is a thing with an id, a name, an owner, and a set of canvases.
  A canvas is in at most one space.
- Access to a canvas is the highest rung from any grant on the canvas or
  on its space. This is the one rule, and both the door and the app apply
  it.
- Step 4 revokes eleven link grants, each with Priya as the revoker, and
  the response says eleven.
- Step 5 admits a person because their attested address is in the group at
  the moment they ask. Membership is read at the door, not copied onto a
  grant.
- A canvas newly created in the space is born with the space's grants and
  no link grant, so a locked space stays locked as it grows.
- The same walk from the terminal: `isocan space new Design`, `isocan
  space add Design <canvas>…`, `isocan share --space Design --link off`,
  `isocan share group:design-team --space Design --as edit`.

## Journey 5: Open a locked space, one canvas at a time

The space is locked to the design team. Priya wants one canvas in it open
to a client, and nothing else.

1. Open that canvas's **Share**. The dialog shows the space's grants first,
   greyed, with a line: *from the space Design, set by Priya.* They cannot
   be edited here.
2. Below them, turn **Anyone with the link** on at **Presentation Viewer**.
   The client opens the address and sees the deck.
3. Invite the client's address as **Canvas Viewer**. The client now reads
   the whole canvas. They see none of the other ten canvases.
4. The client asks to edit. Priya changes the client's row to **Editor**.
   Nothing about the space changes.

Acceptance criteria:

- A canvas in a space can be opened wider than the space, never narrower.
  The space's grants are a floor for its canvases, not a ceiling.
- The client's badge is admitted to one canvas. The canvas list returns
  that canvas with no space on it, and the spaces list is empty.
- The space's Share dialog shows, per canvas, whether it is wider than the
  space, so an owner can find the eleven-minus-ten.

## Journey 6: Withdraw from the space

Sam was in the design team for a project. The project ended.

1. Open the group *design team* and remove Sam's address.
2. Sam's badges, on every canvas in the space, go to the door. Sam is
   refused on each unless that canvas invited Sam by name or its link is
   on.
3. Priya wants Sam out of one canvas that still has its link on. She
   removes Sam from that canvas and keeps them out, as in journey 3.
4. Priya wants Sam out of the whole space regardless of any link. She opens
   the space's Share, enters Sam's address, and chooses **Keep out**. Sam
   is refused on every canvas in the space.

Acceptance criteria:

- Removing an address from a group is one write and reaches every canvas
  every grant on that group touches. The sweep is the same sweep a revoked
  link runs today.
- A person barred from a space is refused on every canvas in it, including
  one whose link is on, and including a canvas moved into the space later.
- Barred rows are visible where the bar was set, with who set it and when.

## Journey 7: Owners, and the floor

Priya leaves the company. The space and its canvases must not become
ungovernable.

1. Before leaving, Priya opens the space's Share and makes Jordan an
   **Owner** of the space. Jordan is now an owner of every canvas in it.
2. Jordan opens the Share of a canvas Priya created. Priya's row reads
   **Owner, created this** and has no Remove. Jordan's own row reads
   **Owner, from the space Design**.
3. Jordan can do everything on the canvas Priya could. Priya's name stays
   on the canvas as its creator.
4. Priya's badges are killed by an innkeeper after she leaves. The canvas
   still has an owner, Jordan, and Priya's row stays as a fact about who
   made it.

Acceptance criteria:

- The creator is always an owner and can never be removed. This is what
  makes journey 3 step 4 safe: nobody can be barred from their own canvas.
- `own` is a rung on a grant, so it can be given, listed, and withdrawn
  like any other. Withdrawing it from the creator is refused with a reason.
- A space has a creator too, with the same floor.
- No ownership transfer exists. Adding an owner and then leaving is how
  handing over works.

## Journey 8: Nothing changed for anyone else

A person who never opens Share, never makes a space, and never invites
anyone.

1. Create a canvas. The link is on at edit, as it always was.
2. Share the address. The person on the other end enters and edits.
3. Run `isocan share --link view`. The deck opens for the next visitor, as
   it does today.
4. Every canvas that existed before this project is in no space and shows
   no space in its Share dialog.

Acceptance criteria:

- No migration. A grant without a rung still means edit, a grant with
  `view` still opens the deck, and a canvas without a space behaves as it
  did.
- The Share dialog for a canvas in no space has no space row. The canvas
  list for a home with no spaces has no headings.
- Every existing test in the multiuser and multi-identity journeys still
  passes.

## What the journeys force

Named here so the design has a list to answer, not to decide them.

- **A rung order in one place.** `own > edit > read > view`, and one
  function that compares. The research already argued this.
- **A scope on a grant.** Today a grant has a canvas id. A space grant
  needs the row to say which of the two it names.
- **A group as a subject.** `group:<id>` beside `link`, `email:`, and
  `repo:`, and a place where membership lives. The door reads membership
  when asked, which means a group is desk state at the home.
- **Highest rung wins, across scopes.** Journeys 2, 4, and 5 all depend on
  this one rule, and the daemon is the only thing that applies it.
- **Barring as a row.** Journey 3 step 4 and journey 6 need a grant that
  says no. A bar outranks any yes except the creator's floor.
- **The sweep reaches through groups and spaces.** Today it re-runs the
  door test against each admission's grant. It has to do the same when the
  grant is on a space or the subject is a group.
- **A rung change reaches an open socket.** Journey 2 step 1.

## Open questions

Written down so they are decided on purpose.

- **Who may make a space?** Anyone on a home, or only people the innkeeper
  names? The journeys assume anyone, because a space is a private thing
  until it is shared.
- **Who may make a group, and who can see its members?** A group whose
  members are visible to every canvas owner who uses it is a directory.
  The journeys assume a group is owned like a space and its members are
  visible to its owners.
- **Does an agent hold its person's rung, or its own?** Isaac holds Priya's
  badge today. A group grant to the design team admits Isaac if Priya is in
  it. The journeys assume yes and say nothing more.
- **Can a canvas be in two spaces?** The journeys say no. The design may
  find a reason to say yes.
