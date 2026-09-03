# Roles: implementation phases

[`design.md`](design.md) is the argument; [`journey.md`](journey.md) is the
acceptance suite. Each phase names the journey it closes, and a phase that
claims one closes only when the journey is walked for real. Each phase is a
discrete amount of work ending in a testable outcome, named up front.

**How the work runs is defined once, in
[`../multiuser/phases.md`](../multiuser/phases.md), and applies here
unchanged**: the conductor model, one subagent per phase, the conductor
verifying the named proof itself, the finding budget, and the Status line
that moves in the same change as "where we are".

**Phase citations name their project**: write `roles phase 2`, never a bare
"phase 2".

---

**Where we are: roles phases 1 to 4 CLOSED 2 Sep 2026; roles phase 5 is
next.** Journeys, design and phases written 2 Sep 2026; phases 1 to 4
built and walked the same day.

The order is dependency order and it is also scope order: phases 1 to 3 are
one canvas and change no storage shape; phase 4 adds the space and the first
new desk row; phase 5 adds the group; phase 6 is the proof that nobody else
noticed. Phases 1 and 4 are the boulders. Phase 1 because the read-only
canvas is the largest single piece of web work in the project, and phase 4
because it is the first row the desk has grown since passes.

**One rule for every phase.** The refusal is the daemon's. A control the app
hides is courtesy; a test that only proves the app hid it proves nothing.
Every phase's proof includes a request from the CLI, holding the lower badge,
refused with the code the design names.

**Deliberately open.** Postponed on purpose, so a later session decides
instead of improvising mid-task:

- **The viewer's second machine**, carried over from multi-identity: a person
  whose second machine holds only a `view` link never meets the door. A
  `read` link does meet it, which narrows the edge but does not close it.
- **A space's front page.** `GET /api/spaces` and a heading on the canvas
  list are enough for the journeys. A page per space, with its own address
  to share, is a later piece of work.
- **Repo-membership groups.** A group whose members are `repo:` attributes
  rides the same rows. Nothing below builds a repo attester, which
  `attest.ts` still refuses.

---

## Phase 1 — The ladder, and the read-only canvas

**Status: CLOSED** 2 Sep 2026. Journey 1 walked by the conductor on a scratch
daemon borrowing dev's attester, with the CLI as the creator and two Chrome
origins as two people: the link turned off from the Share dialog and the
creator stayed; a second address invited at **Canvas Viewer**, proved from
the identity menu, entered with no tool rail, and a dragged item did not
move; the same badge's `POST /api/ops`, `…/passes` and `…/grants` were
refused with `view-only`; the facepile hover, the Share roster and
`isocan who` said *reading*; a bearer badge that proved the same address
from the terminal was admitted at `read`, refused an op with `view-only`,
and still read the oplog watch; `--link view` from the CLI opened the deck
for a stranger while the invitee kept `read`. `--as read`, a bad rung
refused, and `--link read` walked from the CLI. Suite 279 files, 3084
tests; typecheck clean.

**Closes journey 1.**

**Work:**

- `core/src/grants.ts`: `Capability` widens to four values; `RUNGS`,
  `atLeast`, `highest`; the wire rule becomes "written whenever not edit";
  a `capabilityWord` map for the two vocabularies the design names. The
  refusal message behind `VIEW_ONLY` widens to *read* and keeps its code.
- `core/src/grants.ts` also gains `narrowed(capability)`, the one place that
  decides whether the field is written, replacing the eleven literal
  `"view"` tests the design lists.
- `server/grants.ts`: `admittingGrant` sorts by rung index and takes the
  creator's actor id, applying the floor when no row admits or a bar
  matches. `heldCapability` runs for every admission below `edit` and
  re-roots to the rung the door gives.
- `server/file-desk.ts`, `cloudstore/src/cloud-desk.ts`: `admit`, `reroot`
  and `toGrant` write any rung that is not edit. Conformance cases for
  `read` and `own` round-tripping on both backings.
- `server/http.ts` `POST /api/oplog/watch` checks admission per canvas in
  its list. `server/home-link.ts` forwards any rung.
- `server/http.ts`: the onRequest hook and `/api/ops` ask `atLeast(held,
  "edit")`. POST grants accepts the four words and refuses any other with
  `bad-grant`. `GET …/canvas` returns the admission's rung whenever it is
  not edit.
- `server/ws.ts`: the hello carries the rung whenever it is not edit;
  `presence-roster` entries carry it too. `read` connections stay in
  presence; `view` stays out.
- `core/src/protocol.ts`: `capability?: Capability` on `snapshot`,
  `resumed`, `CanvasSnapshotResponse`, `PresenceSession`.
- `api/src/routes.ts`, `web/src/lib/api.ts`: `createGrant` sends the
  capability whenever it is not edit.
- `cli`: `share --link read|edit`, `share <who> --as <rung>`, a rung column
  in the table, `who` says *reading*, and `agent-guide.md` names the new
  flags, which `surface.test.ts` requires.
- `web`: the store's `capability` becomes `Capability`; `ViewerGate` sends
  `read` to the door; `CanvasPage` picks among three surfaces; the read-only
  canvas is the editor with the design's list of writes hidden, held by a
  test that walks the list; the facepile hover and the Share roster say
  *reading*; the Share dialog's link radios become three (**Editor**,
  **Canvas Viewer**, **Presentation Viewer**) and the invite field gains the
  same picker.

**Proof:** On a scratch home with dev's attester, as in multi-identity, the
conductor turns a canvas's link off, invites a second address at `read`,
proves it in a second browser profile, and sees the canvas with no toolbar
and no way to move anything. From a terminal holding the second badge,
`isocan` is refused on an op with `view-only`. The facepile on the first
browser shows the second person marked as reading. Then, from the first
browser, `--link view` on the CLI and the second profile's next visit opens
the deck, proving the old value still means what it meant. Suite and
typecheck green; `server/test/view-only.test.ts` grows the `read` cases and
a test walks the hidden-writes list.

**Findings:**

- **2026-09-02 — Open: the door offers no proof to a refused invitee.** A
  named invitee with the link off lands on *this canvas will not have you*
  with no attester; proving runs through the identity menu. Journey 1 step
  4 says the door asks.
- **2026-09-02 — The refusal cannot name the owner yet.** `ViewOnlyError`
  is thrown from the hook, which holds no snapshot; *ask Priya, who owns it*
  waits for phase 2's owner-naming refusal.
- **2026-09-02 — A bootstrap admission stores no rung; a floor admission
  stores `own`.** Phase 2's `heldRung` must raise by claims, not by the
  stored rung.
- **2026-09-02 — `home-link.ts` carries a `\x00` in a key, so `grep` calls
  it binary.** The eleventh literal `"view"` was found with `grep -a`.
- **2026-09-02 — The terminal half of a proof is `curl`.** The `isocan`
  binary carries its daemon's badge, so a lower badge is a bearer badge from
  the door against the same routes.
- **2026-09-02 — Firebase invalidates an earlier sign-in link when a second
  is sent to the same address.** One link per badge, in sequence.

## Phase 2 — Owners, and a change that reaches the room

**Status: CLOSED** 2 Sep 2026. Journey 2 walked by the conductor on the
phase 1 scratch home, the CLI as the creator and a Chrome tab as the
invitee: the invitee proved the address from the door itself and entered
at `read`; the creator raised the row to `edit` from the CLI and the open
tab grew its toolbar with no reload; the invitee's terminal badge, now an
editor, was refused an invitation with `not-owner` naming the creator; the
creator raised the row to `own` and the tab's Share dialog went live
without a reload, invited a third address, and showed the creator's row
with no control; the creator revoked the row and the tab rendered *your
access to this canvas was withdrawn* while the terminal badge's oplog
watch was refused with reason `withdrawn`. Suite 281 files, 3104 tests;
typecheck clean.

**Closes journeys 2 and 7.** Journey 7 is closed for the canvas; its space
half is re-walked in phase 4.

**Work:**

- `server/grants.ts`: `heldRung(desk, project, badge)`, the admission's rung
  raised to `own` if the badge claims the creator. `ownsThisCanvas` is
  retired into it.
- `server/http.ts`: every write to grants asks `atLeast(heldRung, "own")`,
  inviting and the link included. The refusal is `NOT_OWNER`, unchanged in
  code, with a message that names the owner. A row naming the creator's
  own address is refused as redundant: the creator holds `own` without one.
- `server/sweep.ts`: `decide` re-roots when the rung the door would give
  differs from the admission's, not only when the root fell, and a pass root
  adopts the minter's rung. `passes.ts` admits at the minter's rung. Every
  outcome is reported to a listener as `(canvasId, badgeId, outcome)`.
- `server/home-link.ts`: forwarded grant writes carry the local badge's
  actor id; the home checks it against the relaying badge's claims before
  asking `own`. `WS_NOT_ADMITTED` stops the redial and is reported once.
- `server/ws.ts`: the room maps socket to badge id. The sweep listener sends
  `{type: "standing", capability}` to a re-rooted badge's sockets and closes
  an expelled badge's with `WS_NOT_ADMITTED` and reason `withdrawn`.
- `core/src/protocol.ts`: the `standing` message.
- `web`: the store applies `standing`; `CanvasPage` re-picks its surface with
  no reload. The close reason `withdrawn` renders *your access to this canvas
  was withdrawn*. The Share dialog: **Owner** in both pickers, each invited
  row's rung is a picker, the creator's row reads **Owner, made this**, and
  every control below `own` is disabled with the owner note.
- `cli`: `--as own`; `share` prints **owner, made this** on the first line.
  `isocan wait` prints `withdrawn` from the watch's refusal and exits.

**Proof:** The conductor, as a non-creator editor, is refused an invitation
from the CLI with `NOT_OWNER`. As the creator, they raise a `read` invitee to
`edit` while that person's browser is open, and the toolbar appears without
a reload. They raise the same person to `own`, and that person's Share
dialog shows live controls and can invite a third address. That person
cannot remove the creator. `server/test/sweep.test.ts` grows the rung-only
re-root case; a socket test asserts the `standing` message reaches exactly
the re-rooted badge's connections and no other.

**Findings:**

- **2026-09-02 — The door offers the proof to a nameless arrival.** The
  welcome dialog has *Prove your address* and sends the link itself. Phase
  1's open finding narrows to the named person's refusal page.
- **2026-09-02 — A creator's agent holds `own` through a pass**, because a
  `created` root reads as `own` and a pass adopts the minter's rung. An
  owner's agent can invite. Agent-custody's question, not this project's.
- **2026-09-02 — Open: a replica's parked `isocan wait` is not told
  `withdrawn`.** The expulsion lands on the daemon's home link, not on the
  local watch route.
- **2026-09-02 — The watch route's `withdrawn` memory is in-process.** A
  second home instance would forget it; one instance today. Phase 6 note.
- **2026-09-02 — Keep the CLI's scratch-home entry in `~/.isocan/identity.json`
  between phases.** Removing it makes the next phase's CLI a stranger,
  admitted by whatever the link says.

## Phase 3 — Withdrawal, and the bar

**Status: CLOSED** 2 Sep 2026. Journey 3 walked by the conductor on the
scratch home, the CLI as the creator, a Chrome origin as the invitee's
browser and a bearer badge as their terminal: invited at `edit` with the
link off, the invitee entered; removed from the CLI, their tab rendered
*your access to this canvas was withdrawn* and their terminal's oplog
watch was refused with reason `withdrawn`. With the link on they re-entered
as a stranger on both surfaces; the creator's Share dialog **Remove** said
*can still enter by the link* and offered **and keep them out**, which
dropped both surfaces to the door with `not-admitted` while a fourth
stranger was admitted by the same link; the dialog and `isocan share`
listed the bar as **kept out** with who and when; `--unbar` re-admitted
them. The creator's-address refusal is held by test only: the scratch
creator has proved no address, so the route had nothing to match. Suite
292 files, 3169 tests; typecheck clean.

**Closes journey 3.**

**Work:**

- `core/src/grants.ts`: `Grant.bars?: true`; `grantSubjectRefusal` refuses a
  bar on `link` or a group; `isBar`.
- `server/grants.ts`: `admittingGrant` checks the floor, then bars, then
  rungs.
- `server/http.ts`: `DELETE …/grants/:id?bar=1` revokes and writes the bar
  in one request; `POST …/grants` with `bars: true` writes one directly;
  revoking a bar is the ordinary DELETE. Barring the creator's address is
  refused with a reason. The DELETE response says whether the link or the
  space would still admit the subject, so the dialog can ask before it acts.
- `server/sweep.ts`: nothing, if phase 2 did its work; the door test carries
  the bar. A test proves a barred person inside is expelled by the sweep the
  bar's write runs.
- `web`: **Remove** on a row; the *they can still enter by the link* line
  with **and keep them out**; **kept out** rows with **Let back in**.
- `cli`: `--revoke <who> [--bar]`, `--bar <who>`, `--unbar <who>`, and the
  **kept out** rows in the table.

**Proof:** The conductor invites a third address at `edit`, has it enter in a
second profile with a terminal parked in `isocan wait`, then removes it from
the first browser. The second profile lands on the door with the withdrawn
sentence within the heartbeat, the parked wait prints the reason and exits,
and every item the person made keeps their name. With the link on, the same
person re-enters as a stranger; the conductor removes them again with **and
keep them out**, and they are refused at the door with `not-admitted` while
a fourth stranger is admitted by the same link. `isocan share` lists the bar
with who and when. `server/test/grants.test.ts` grows the bar cases.

**Findings:**

- **2026-09-02 — A barred person's agent is not barred.** Its badge proves
  no address, so with the link on the sweep re-roots it at the link.
  Pinned in `sweep.test.ts`; agent-custody's question.
- **2026-09-02 — A bar needs an attester.** On a home with none, `--bar` is
  refused with `no-attester`, because such a bar keeps nobody out.
- **2026-09-02 — Inviting a barred address replaces the bar** with no
  confirm. Journey 3 step 4's *until an owner invites them again*.
- **2026-09-02 — The kept-out row names a badge id, not a person.** The
  browser has no badge-to-name lookup; the CLI table is the same.

## Phase 4 — The space

**Status: CLOSED** 2 Sep 2026. Journeys 4 and 5 walked by the conductor with
addresses in place of the group, on the scratch home with the CLI as the
creator: a space made, three canvases moved in, `--space … --link off`
reached three; two addresses invited at `edit` on the space, and one of
them entered all three canvases with no canvas row on any; one canvas's
own link at `view` showed a stranger that deck and refused them on the
other two, and `GET /api/spaces` as that stranger named no space; removing
a canvas from the space refused the space's invitee on it; the invitee
raised to `own` on the space invited a third address on a canvas they held
no row on. In Chrome the canvas list drew the space's heading and **No
space** last, the space's Share showed **Every canvas in this space** and
marked the two canvases wider than the space, and the canvas dialog showed
the space's rows greyed under *from the space*. Suite 295 files, 3208
tests; typecheck clean.

**Closes journeys 4 and 5, with addresses in place of the group; re-walks
journey 7 for the space.** Journey 4 step 5 is walked with five invitations
by address and closed for real in phase 5.

**Work:**

- `core/src/grants.ts`: `Space`, `GrantScope`, `scopeOf`, the space routes'
  shapes and refusal codes.
- `server/desk.ts` and both backings: `spaces` as a row, `putSpace`,
  `space(id)`, `spaceOf(canvasId)`, `spacesFor(badge)`, `grantsForSpace`,
  and the conformance cases for each, including the no-fallback rule.
  Firestore gets the `canvasIds` array-contains index and the `spaceId`
  query.
- `server/grants.ts`: `admittingGrant` merges both scopes; `heldRung` over a
  space; the sweep's row lookup covers space rows.
- `server/http.ts`: the space routes from the design's table, forwarded on
  a replica through `homeScoped()` and refused on a mixed rig; `SubmitRequest`
  gains `spaceId`, honoured beside `project.create`, and `engine.createProject`
  takes a flag that suppresses the birth link grant; `link` refused as a
  space subject. `GET /api/projects` does not change.
- `server/sweep.ts`: `sweepSpace(desk, spaceId)` as a loop over
  `sweepCanvas`, reporting the count of canvases reached.
- `web`: the canvas list draws headings and **No space**; a card's menu has
  **Move to space…** and dragging onto a heading does the same; the Share
  dialog renders space rows greyed with the *from the space* line; the
  space's Share with **Every canvas in this space** and the per-canvas
  wider-than-the-space mark.
- `cli`: `isocan space new|list|add|remove|delete`, `share --space`,
  `list` grouped by space, name-to-id resolution with the ambiguity refusal,
  and `agent-guide.md` updated.

**Proof:** The conductor makes a space, moves three canvases into it, turns
the space's link off and sees the response name three canvases, invites two
addresses at `edit` on the space, and has one of them enter each canvas
without an invitation on any canvas. One canvas gets its own link turned on
at `view`; a stranger sees that deck and is refused on the other two.
Removing a canvas from the space refuses the space's invitee on it. As a
space owner granted at `own`, a second person invites on a canvas they never
touched. From the CLI holding a badge admitted to one canvas only, `GET
/api/spaces` names no space. Conformance runs green on both desks.

**Findings:**

- **2026-09-02 — A space creator's floor is a provenance, `{root: "space"}`**,
  re-asked by every sweep because a canvas can leave a space; `created`
  is never re-asked. `rungOfAdmission` reads both as `own`.
- **2026-09-02 — The Firestore row holds `holding` beside `canvasIds`**: the
  array-contains index, emptied on the tombstone. Single-field queries only,
  so no composite index.
- **2026-09-02 — A badge in on an older edit link stays rooted at the link**
  when a same-rung space row arrives; a space revoke then re-roots rather
  than expels.
- **2026-09-02 — Open: `stillAdmittedBy` is by subject only.** A space row
  for another attribute of the same person is not seen.
- **2026-09-02 — Open: the list's Move to space… is gated on the canvas's
  creator**; an owner by row moves a canvas from the CLI or the Share.
- **2026-09-02 — `GET /api/spaces` runs one `grantsForSpace` per space** to
  hide bar-only spaces. A query per space; fine today.
- **2026-09-02 — A shell holding the scratch `ISOCAN_HOME` makes the CLI
  read the scratch home's identity.** Start the daemon in a subshell.

## Phase 5 — The group

**Status: not started.**

**Closes journeys 4 and 6.**

**Work:**

- `core/src/grants.ts`: `Group`, the `group:` subject in `GrantSubject`,
  `grantSubjectRefusal` and `attestedKindOf` cases, the group routes' shapes.
- `server/attest.ts`: `attesterRefusal` has an explicit `group` case.
- `server/desk.ts` and both backings: `groups` as a row, `putGroup`,
  `group(id)`, `groupsFor(badge)`, `grantsBySubject(subject)`, and
  `spacesFor(badge)` learning the group branch, conformance cases.
- `server/grants.ts`: the `group:` branch in `admittingGrant`, reading
  membership at the door.
- `server/http.ts`: the group routes; member add and remove sweep every
  canvas every live row on the group reaches, through the space list for
  space rows.
- `web`: a **Groups** section in the identity menu or the canvas list, where
  a group is made and its members edited; the invite field accepts a group
  name; a group row shows its name and size.
- `cli`: `isocan group new|list|add|remove|delete`, `share group:<name>`,
  and `agent-guide.md` updated.

**Proof:** The conductor makes a group of three addresses, grants it `edit`
on the space from phase 4, and a member enters every canvas in the space
with no other row naming them. Removing that member from the group drops
their open browser to the door on every canvas in the space within the
heartbeat, and a canvas whose own link is on re-admits them as a stranger. A
member added while already inside at `read` by a canvas row sees the toolbar
appear without a reload. `GET /api/groups/:id` as a canvas owner who is not the
group's returns the name and size and no members.

## Phase 6 — Nothing changed for anyone else

**Status: not started.**

**Closes journey 8.**

**Work:** No code by intent. A walk on prod after the deploy, and the
compatibility cases the design promises: a pre-project grant with no rung
admits an editor; a `view` link opens the deck; a canvas in no space shows no
space row and the list shows no heading; a CLI from before phase 1 against
the new home reads a `read` admission as an editor and is refused writes
with `view-only`; the new CLI against a home from before phase 1 has `--as
read` refused with `bad-grant`. Every multiuser and multi-identity journey
test still passes. If any of these needs code, the phase that broke it is
reopened rather than this one growing work.

**Proof:** The conductor walks journey 8 on isocan.io with a canvas that
existed before the deploy and records the commit sha the home reported.

---

## What the phases leave open

- **The rung an rc holds when its person's badge is killed.** The sweep
  resolves the pass root by the minter's outcome, and a killed minter
  expels. That is today's behaviour and the design keeps it. Whether an
  agent should survive its person's departure is agent-custody's question.
- **Sweep cost on a large space.** `sweepSpace` is one `sweepCanvas` per
  canvas, each reading every badge in the canvas. Fine for eleven. A space of
  hundreds needs the sweep to run off the request path, and nothing here
  decides where.
