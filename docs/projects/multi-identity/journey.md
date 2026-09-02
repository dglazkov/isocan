---
status: partial
since: 2026-09-01
see: multiuser
note: "phases 1–3 closed 1 Sep 2026 (the offer reaches the door; the door starts the proof; the refusal renders its remedy — journeys 1, 2 and 4 close, journey 6 through step 3); phases 4–5 not started. The door grows mechanism 6's surface — resumable rows render exactly as known-identity rows. journey.md is the acceptance suite, design.md the argument, phases.md the walk — five phases. Phases 1–4 are the door and the menu, all in packages/web but one corrected label; scope decided 31 Aug: no server change, no new op, no new route. Phase 5, added 1 Sep, is the one new op: actor.join, folding a second actor into the person who holds both."
---

# Multi-identity — the journeys

These journeys describe how a person becomes the same identity on more than
one machine. Each journey is an acceptance test: the work is done when you can
walk the journey on a real deployment and it behaves as written here.
[design.md](design.md) describes the mechanism and the door states that these
journeys exercise. If a journey and the mechanism disagree, the mechanism is
what changes.

Key terms, defined in the multiuser project's
[identity-desk](../multiuser/identity-desk.md) record:

- **Actor**: who you are on a canvas. Your undo stack, mentions, and
  authorship attach to your actor ID.
- **Badge**: the credential a browser or CLI holds after admission. One badge
  per browser profile per home.
- **Attestation**: a fact a badge proved, such as an email address.
- **The door**: the dialog that asks for your name before you enter.
- **Resumable**: the actors your badge may become, because another badge that
  claimed them proved the same attestation your badge proved.

The journeys are ordered from the main path outward: the first is the feature,
journey 5 verifies that nothing changed for anyone else, and journey 6, added
1 Sep 2026, is the person who already picked a second name before this
existed.

## Journey 1: Resume your identity on a second machine

You use isocan.io as Dimitri on your desk machine, where you proved your email
address at some point (identity menu → **Prove your address…**). You open a
canvas link on your laptop for the first time.

1. Open the canvas link. The door asks for your name. Below the name field, a
   single line reads: *Already isocan on another machine? **Prove your
   address***.
2. Click **Prove your address**. An address field expands in place. No second
   dialog opens.
3. Enter `dimitri@glazkov.com` and send. The door confirms: *Check
   dimitri@glazkov.com. Open the link in this browser.* The name field stays
   usable underneath — you can still enter under any name while you wait.
4. Open the emailed link in the same browser. The tab returns to the door,
   which now shows a **Dimitri** row above the name field, in the same style
   as the rows a returning browser sees.
5. Click the row. You are Dimitri on the laptop: the same actor ID, so your
   undo stack, your mentions, and your authorship are already yours.

Acceptance criteria:

- The journey runs on a real deployment with two physical machines, or two
  browser profiles that share no storage.
- Step 5 binds the laptop's session to the existing actor. No second actor is
  created; `isocan who` and the presence list show one Dimitri.
- While the door is showing, the door owns the offer: the sign-in notice that
  appears after step 4 states what was proved and carries no buttons. The
  rows render in the door, not in a toast over it.
- Steps 1–5 require no server change. The diff that closes this journey
  touches only `packages/web`.

## Journey 2: The name you want is taken

Same person, same laptop, but you skip the quiet line and type the name you
already use.

1. At the door, enter `Dimitri` and submit.
2. The door refuses: *Dimitri is somebody else here. Another surface already
   speaks as them. If that's you:* **Prove your address** *— or pick a
   different name.* These are the door's words, not the server's. The
   server's refusal for a typed name is written for the CLI and names
   `--as` and `--new`.
3. Click **Prove your address** and continue from step 3 of journey 1.

Acceptance criteria:

- The browser branches on the refusal's wire code (`ApiError.code ===
  "name-taken"`), not on its message text. Both `name-taken` throws in
  `claims.ts` — the typed-name refusal and the roster-row refusal — render
  the same door copy.
- The refusal renders a working control, not instructions to find one, and
  no CLI flag appears in the door.
- The CLI's refusal is unchanged in shape: prose that names the remedies, as
  `claims.ts` writes it today. One word changes: the menu entry it names,
  "Work from your terminal…", no longer exists and becomes "Bring your own
  agent…".

## Journey 3: Nobody to pick up

You never proved your address on your desk machine, so the vouch has nothing
to stand on. This is the journey where the feature fails, and the test is that
it fails with instructions instead of a dead end.

1. On the laptop, prove `dimitri@glazkov.com` at the door (journey 1, steps
   1–4).
2. The door reports: *dimitri@glazkov.com is proved on this browser, and it
   lets you pick up nobody new here. If you are already somebody on another
   machine, prove the same address there too — identity menu → "Prove your
   address…" — then come back here.*
3. On the desk machine, open the identity menu and choose **Prove your
   address…**. The dialog's first sentence tells you why this matters: proving
   an address here is what lets your other machines be you.
4. Return to the laptop and reopen the door. The **Dimitri** row is there.

Acceptance criteria:

- Step 2's message names the exact gesture and the exact menu item. A person
  who reads only this message can complete the journey.
- Step 4 requires no second email round trip. The laptop's badge already
  holds the attestation, so one `GET /api/attest` finds the newly resumable
  actor.
- The verify dialog's copy leads with resumption (step 3) and mentions
  invitations second — inverted from today's order.

## Journey 4: A different name doesn't fork you

On your desk machine your name is `dglazkov`. On the laptop you would type
`Dimitri` — a name nobody holds, so no refusal would stop you, and you would
silently become a second actor with a second history. The quiet line is what
prevents this, because nothing else can.

1. At the door, notice *Already isocan on another machine?* before typing a
   new name.
2. Prove your address (journey 1, steps 2–4).
3. The door shows a **dglazkov** row. Click it. You are `dglazkov` on the
   laptop, not a new person named Dimitri.

Acceptance criteria:

- The line renders in the door's fresh state whenever the home can attest
  (`canVerifyEmail(offer)` is true). It is not gated on a refusal having
  happened.
- On a home with no attester — every local daemon in this repository — the
  line does not render, and the door is byte-for-byte today's door.

## Journey 5: Nothing changed for everyone else

The feature must cost nothing to the arrivals it is not for. This journey is
a set of checks, each walked separately.

1. **A stranger on a share link.** They open an edit-capable canvas link on a
   home with attestation configured. They see the door with the name field
   first and the quiet line below it. They type a name and enter. Nothing
   interrupted them; the line asked for nothing.
2. **A viewer.** They open a view-capable canvas link. They get the deck and
   never meet the door, exactly as #88 built it. This design adds nothing to
   the viewer face.
3. **Someone who is already somebody.** With an actor active, they prove an
   address from the identity menu. The existing toast behavior is unchanged:
   the notice reports what was proved and, if another surface answers to the
   same address, offers the switch as buttons. The door-owns-the-offer rule
   applies only while the door is showing.
4. **A CLI.** `isocan` commands see no new behavior. The pass flow and
   `isocan pass` are untouched; the refusal text changes only where it named
   a menu entry that no longer exists.

Acceptance criteria:

- Check 1: entering under a fresh name takes the same number of actions as
  today.
- Check 2: the view path renders `Viewer` with no identity dialog mounted.
- Check 3: with `actor !== null`, the sign-in notice still carries the "Be
  &lt;name&gt;" buttons.
- Check 4: no diff under `packages/cli`, and under `packages/core` only the
  corrected menu label in the `name-taken` refusal (journey 2).

## Journey 6: You already picked a second name

You have used the laptop for weeks as `Dimitri 2`, because the door refused
`Dimitri` and you took the way out it offered. You have written comments as
`Dimitri 2`. Now you want the laptop to be Dimitri.

1. On the laptop, with `Dimitri 2` active, open the identity menu, type
   `Dimitri` into the name field and press **Rename**. The rename carries
   your actor id and the new name, and the home refuses it with `name-taken`
   because Dimitri answers to another actor.
2. The menu renders the same refusal journey 2's door renders: *Dimitri is
   somebody else here. Another surface already speaks as them. If that's
   you:* **Prove your address** *— or pick a different name.* Clicking the
   control opens the **Prove your address** panel in place of the menu.
3. Send the link and open it in this browser. You return with an actor, so
   the notice offers **Be Dimitri**, exactly as journey 5 check 3 describes.
   Reopening the panel lists Dimitri under "You are also".
4. Click **Be Dimitri**. You are Dimitri on the laptop, with Dimitri's actor
   id. `Dimitri 2` stays in this browser's roster, one click away.
5. The identity menu's roster still lists `Dimitri 2`, and because this
   browser now holds both actors, the row offers **Fold into Dimitri**. The
   menu says once that this cannot be undone. Confirm.
6. Every comment you wrote as `Dimitri 2` now shows Dimitri's name, color and
   mark. A thread where somebody @-mentioned `Dimitri 2` is in Dimitri's
   inbox. `isocan who` shows one Dimitri, and the roster row for `Dimitri 2`
   is gone. The log still carries the actor id each op was written with.

Acceptance criteria:

- The rename form's refusal branches on `ApiError.code === "name-taken"` and
  renders the same copy and the same control as the door. No CLI flag appears
  in the menu.
- Step 4 binds the laptop to the existing Dimitri actor. `isocan who` and the
  presence list show one Dimitri; `Dimitri 2` remains a persona in the
  roster and resumes on click.
- Step 5 is `actor.join`, one op, refused unless the presenting badge speaks
  for both actors. The CLI sends the same op as `isocan identity --join
  <actorId>`, and both surfaces read the same result.
- No op in the log is rewritten. `Dimitri 2`'s ops carry the actor id they
  were written with; what changes is how every reader resolves that id.
- After the join, Dimitri's undo reaches an op `Dimitri 2` wrote, and a
  mention of `Dimitri 2` in an old thread counts as a mention of Dimitri.
- If no other machine proved the address, the panel says so in journey 3's
  words: nobody to pick up, prove the same address on the other machine,
  then come back.

## What the journeys force

Named here so the design can be held to it:

- **One row style for both lists** (journeys 1, 4): resumable rows and
  known-identity rows render identically, in the door's existing
  `.identity-known-row` style.
- **The door owns the offer while it shows** (journeys 1, 5): with no actor,
  rows render in the door and the notice carries no buttons; with an actor,
  the toast is unchanged.
- **A subscription, not a prop** (journeys 1, 3): the door is mounted from
  more than one parent, so `resumable` arrives through a `useResumable()`
  hook backed by `signin.ts`'s offer cache, which must notify when it
  invalidates.
- **Refusals branch on code** (journeys 2, 6): `ApiError.code`, never message
  text. The door and the identity menu's rename form are the two places a
  browser sends `actor.claim` and meets `name-taken`, and both render the
  same copy and the same control.
- **A join is an op, not a rewrite** (journey 6): `actor.join` lands in the
  registry beside names, colors and marks, and the log keeps every stamp.
  Readers resolve an actor id through the registry before comparing it, so
  one change reaches names, inbox, presence and undo without touching
  history. It is the project's one new op, and it belongs to phase 5 alone.
- **Only somebody who is both may join them** (journey 6): the op is refused
  unless the presenting badge claims both actors, which is exactly what
  steps 1–4 leave the laptop holding.
- **The gate is the existing gate** (journey 4): `canVerifyEmail(offer)`
  decides every new control, so attester-less homes show none of this.
- **Failure states carry instructions** (journey 3): the message a stuck
  person reads must name the gesture that unsticks them.
