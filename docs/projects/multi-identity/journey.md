---
status: designed
since: 2026-08-31
see: multiuser
note: "the door grows mechanism 6's surface — resumable rows render exactly as known-identity rows. journey.md is the acceptance suite, design.md the argument, phases.md the walk — four phases, all in packages/web. Scope decided 31 Aug: the door only; the precondition stays copy; no server change, no new op, no new route."
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
the last verifies that nothing changed for anyone else.

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
   different name.*
3. Click **Prove your address** and continue from step 3 of journey 1.

Acceptance criteria:

- The browser branches on the refusal's wire code (`ApiError.code ===
  "name-taken"`), not on its message text.
- The refusal renders a working control, not instructions to find one.
- The CLI's refusal is unchanged: prose that names the remedies, exactly as
  `claims.ts` writes it today.

## Journey 3: Nobody to pick up

You never proved your address on your desk machine, so the vouch has nothing
to stand on. This is the journey where the feature fails, and the test is that
it fails with instructions instead of a dead end.

1. On the laptop, prove `dimitri@glazkov.com` at the door (journey 1, steps
   1–4).
2. The door reports: *dimitri@glazkov.com is proved on this browser. Nobody
   else here has proved it, so there is nobody to pick up. If you are Dimitri
   on another machine, prove the same address there too — identity menu →
   "Prove your address" — then come back here.*
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
4. **A CLI.** `isocan` commands see no new behavior. The refusal text, the
   pass flow, and `isocan pass` are untouched.

Acceptance criteria:

- Check 1: entering under a fresh name takes the same number of actions as
  today.
- Check 2: the view path renders `Viewer` with no identity dialog mounted.
- Check 3: with `actor !== null`, the sign-in notice still carries the "Be
  &lt;name&gt;" buttons.
- Check 4: no diff under `packages/cli` or `packages/core`.

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
- **Refusals branch on code** (journey 2): `ApiError.code`, never message
  text.
- **The gate is the existing gate** (journey 4): `canVerifyEmail(offer)`
  decides every new control, so attester-less homes show none of this.
- **Failure states carry instructions** (journey 3): the message a stuck
  person reads must name the gesture that unsticks them.
