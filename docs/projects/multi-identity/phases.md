# Multi-identity: implementation phases

[`design.md`](design.md) is the argument; [`journey.md`](journey.md) is the
acceptance suite — each phase below names the journey it closes, and a phase
that claims one closes only when the journey is walked for real. Each phase is
a discrete amount of work ending in a testable outcome, named up front.

**How the work runs is defined once, in
[`../multiuser/phases.md`](../multiuser/phases.md), and applies here
unchanged**: the conductor model, one subagent per phase, the conductor
verifying the named proof itself, the finding budget, and the Status line that
moves in the same change as "where we are".

**Phase citations name their project**: write `multi-identity phase 2`, never
a bare "phase 2" — bare numbers in existing code mean the multiuser project.

---

**Where we are: phases 1–2 CLOSED 1 Sep 2026; phase 3 is next.** Design and
journeys written 31 Aug 2026. Scope decided the same day for phases 1–4: the door and the menu, the
precondition stays copy, and the diff lives in `packages/web` — no server
change, no new op, no new route. Journey 5's acceptance ("no diff under
`packages/cli` or `packages/core`") holds phases 1–4 to that, with one named
exception: phase 3 corrects a stale menu label inside the `name-taken`
refusal text in `core/src/claims.ts`. That is a copy fix, not a mechanism.

**Phase 5 was added 1 Sep 2026 and lifts that rule on purpose.** It is the
project's one new op, `actor.join`, and it touches core, the server, the CLI
and the web, because an op that only one surface could send would break the
isomorphism. It runs after phase 4 because it needs what journey 6 steps 1–4
leave the laptop holding: a badge that speaks for both actors.

The order below is dependency order: phase 1 is wiring with a small visible
result and proves the offer reaches the door; phase 2 is the feature, where
the door states and their copy land; phases 3 and 4 are each one branch and
one set of words; phase 5 is the op. The phases are deliberately unequal —
phases 2 and 5 are the boulders — because the split follows the proofs: each
phase ends at a journey that can be walked, and a finer split would need
invented acceptance tests.

**Deliberately open.** Postponed on purpose, so a later session decides
deliberately instead of improvising mid-task:

- **The viewer's second machine.** A person whose second machine holds only a
  view link never meets the door and has nowhere to prove an address
  ([design.md](design.md) names this edge). It waits for a scene that forces
  it; no phase below touches the viewer face.
- **The device-handoff pass.** "Open on another device…" from machine A is a
  different gesture with a different failure profile, works on attester-less
  homes, and belongs to this project as its own later piece of work. Not in
  these phases.
- **Attesters beyond email.** `resumable` is computed per attribute, not per
  address, so a future attester (a repo, a key) rides the same rows. Nothing
  below may assume `email:` is the only prefix, but nothing below builds a
  second attester either.

---

## Phase 1 — The offer reaches the door

**Status: CLOSED** 1 Sep 2026. Proof walked by the conductor against a scratch
daemon borrowing dev's attester: a bearer badge claimed Dimitri and proved
the address; Chrome, as a second badge, became Throwaway, proved the same
address from the identity menu, left, and opened the front page's door — the
Dimitri row was there beside Throwaway, and clicking it made the browser
`usr_Ik0D_mNpU7`, the actor the bearer badge had claimed. Suite and typecheck
green; `test/resumable.test.ts` holds the notice rule and the subscription.

**Work:** The wiring [journey.md](journey.md)'s "What the journeys force"
section names: `signin.ts` notifies when its offer cache invalidates (a
module-level subscriber list with unsubscribe — not the one-slot shape of
`onReBadge`, which holds a single callback), a `useResumable()` hook reads it
and unregisters on unmount, and `IdentityDialog` renders resumable rows in the existing
`.identity-known-row` style wherever it is mounted — `Doorway`, `FrontPage`,
and the `ViewerGate` door prop alike, with nothing threaded through props.

The door-owns-the-offer rule lands here too: with `actor === null`,
`SignInNotice` states what was proved and carries no buttons; the rows are the
door's. With `actor !== null`, the notice is unchanged.

**Outcome:** A browser whose badge already holds an attestation sees who it
may be, at the door, as rows. No entry point exists yet — the attestation must
have been acquired through the identity menu — so this phase is invisible to
anyone who has not already proved an address.

**Proof:** Walked with two browser profiles sharing no storage: profile A is
Dimitri and proves the address; profile B becomes a throwaway name, proves the
same address from the identity menu, then opens the front page's door — the
Dimitri row is there, and clicking it claims the existing actor (`isocan who`
shows one Dimitri). A component test holds the notice rule: `actor === null`
renders no buttons in the notice.

**Findings:**

- **2026-09-01 — Decided: rows are gated on `auth !== null`.** The server
  answers `resumable` from the badge's attestations whether or not the home
  still has an attester, so a home that dropped its attester would still
  vouch. The hook renders nothing in that case, keeping journey 4's rule that
  an attester-less door is byte-for-byte today's door. The cost is that one
  edge, which no scene has asked for.
- **2026-09-01 — A second machine is a second origin.** Two storage-isolated
  "profiles" for a proof need not be two browsers: a bearer badge from `curl`
  plays the desk machine, and one Chrome tab plays the laptop. The proof ran
  against a scratch daemon started with dev's `ISOCAN_AUTH_PROJECT` and
  `ISOCAN_AUTH_API_KEY` (the browser key is public), with `localhost` as the
  authorized domain. Later phases can use the same setup.

---

## Phase 2 — The door starts the proof

**Status: CLOSED** 1 Sep 2026. Journey 1 walked by the conductor on the phase
1 setup: a fresh Chrome badge at a canvas link met state A, opened B in
place, sent the link and read C with the name field live, returned to the
door in D with the Dimitri row above the field and a buttonless notice, and
became the desk badge's actor id. D′ walked by killing the desk badge and
reloading: the door named the proved address and the gesture. The
attester-less door is held byte-for-byte by `test/doorproof.test.ts`.
Journey 4 was not walked separately — Dimitri's call, 1 Sep: the door never
reads a name, so it is journey 1's walk with a different row label.

**Work:** The four states from [design.md](design.md), inside the one dialog:

- **A** — the quiet line (*Already isocan on another machine? Prove your
  address*), gated on `canVerifyEmail(offer)`. On a home with no attester the
  door renders exactly today's door.
- **B** — the address field expands in place; no second dialog.
- **C** — sent; the name field stays usable underneath.
- **D** — the return leg lands at the door and the rows from phase 1 render
  above the name field as the primary action.
- **D′** — proved with nobody to pick up: the message names the exact gesture
  on the other machine (identity menu → "Prove your address") and says to
  come back.

**Outcome:** Journeys 1 and 4 close. A person can start the sign-in from the
second machine, and a person whose names differ across machines has a
persistent entry point instead of a silent fork.

**Proof:** Journey 1 walked for real against a deployment with attestation
configured (dev, or isocan.io with permission), on two machines or two
storage-isolated profiles, ending in one actor. Journey 4 walked the same
way with mismatched names. The attester-less check is a test, not a walk:
with `canVerifyEmail` false, the door's rendered output is today's door.
Journey 3's laptop half (D′, with its exact instructions) is exercised by
proving an address nobody else proved.

**Findings:**

- **2026-09-01 — Decided: D and D′ are read off the offer, not the sign-in
  landing.** The door then says the true thing whenever a proved badge meets
  it, not only on the return leg. The cost is that the offer is cached per
  page load, so a door already open does not see another badge die until a
  reload. No scene asks for that; recorded, not changed.
- **2026-09-01 — The notice offered "Be Dimitri" to Dimitri.** The door's
  claim lands while the sign-in notice is still up, and the `actor !== null`
  branch then offered the person they had just become. The notice now leaves
  the current actor out, the rule VerifyDialog already draws as "you, here".

---

## Phase 3 — The refusal renders its remedy

**Status: not started.**

**Work:** The `name-taken` branch, in both places a browser meets it. When
the door's claim is refused with that wire code, the dialog renders its own
copy — *Dimitri is somebody else here…* — with a **Prove your address**
control that opens state B. When the identity menu's rename is refused with
it, the menu renders the same copy, and the control opens the **Prove your
address** panel in place of the menu. The server's message
is not shown for this code: `claims.ts` throws `name-taken` from two places,
and the one a typed name meets (`requireFree`) names `--as` and `--new`, which
are CLI remedies. The branch keys on `ApiError.code`, never on message text,
and covers both throws. The CLI's refusal prose is untouched, with one
correction: the `admit` refusal in `claims.ts` still names a menu entry called
"Work from your terminal…", which was renamed "Bring your own agent…". The
string changes to the current label. The same stale label sits in
`VerifyDialog.tsx`'s header comment and is corrected there too.

The `claims.ts` string is the one line this project writes outside
`packages/web`. Journey 5 check 4 names it as the sole exception, so the
proof's `git diff --stat` is expected to show exactly that line under
`packages/core` and nothing under `packages/cli`.

**Outcome:** Journey 2 closes, and journey 6 up to its step 3. The refusal
that names a remedy in prose now renders it as a control, for the person who
typed their real name before reading anything and for the person who has been
a second name for weeks and tries to rename their way out.

**Proof:** Journey 2 walked: type the taken name, meet the refusal, click
through to being yourself. Journey 6 walked from a browser that is already
somebody: rename to the taken name, meet the same refusal in the menu, click
through to the panel. A test asserts the branch fires on the code alone
(a reworded message still branches). `git diff --stat` for the phase shows
`packages/web` plus the one corrected string in `core/src/claims.ts`, and
`grep -rn "Work from your" packages` finds nothing.

**Findings:** none yet.

---

## Phase 4 — The words on the first machine

**Status: not started.**

**Work:** The copy-only precondition payment, decided in
[design.md](design.md):

- `VerifyDialog` leads with resumption — *proving an address here is what
  lets your other machines be you* — and mentions invitations second.
- The identity-menu entry's reason moves out of the hover tooltip into words
  a person actually meets.
- The panel's empty case gets journey 3's instructions. Today a badge that
  proved an address nobody else proved sees a list with nothing in it; it
  should read that nobody else here has proved this address and name the
  gesture on the other machine, which is journey 6's last acceptance.

No prompt on first claim; that was considered and refused, and this phase
does not reopen it.

**Outcome:** Journey 3 closes end to end, and journey 6 through step 4: the
failure message on the second machine and the panel it points to on the first
machine now tell one story, whether the person met it at the door or in the
identity menu.

**Proof:** Journey 3 walked across both machines, including the return with
no second email round trip. Journey 6 walked to step 4 from a laptop that is
`Dimitri 2`: become Dimitri, confirm `isocan who` shows one Dimitri and the
roster still offers `Dimitri 2`. Then the journey 5 sweep, which closes the
web-only half of the project: the stranger's door, the viewer's deck, the
already-somebody toast, and `git diff --stat` across phases 1–4 showing no
line under `packages/cli` and, under `packages/core`, only phase 3's
corrected menu label in `claims.ts`.

**Findings:** none yet.

---

## Phase 5 — Two actors become one person

**Status: not started.**

**Work:** `actor.join { from, into }`, designed in [design.md](design.md)'s
"Joining two actors":

- **Core.** The op type, beside `actor.setColor` and `actor.setMark`. The
  registry gains a `joined` map and one function that resolves an actor id
  through it, transitively. `actorNameIn`, the color and mark lookups, the
  inbox's author and mention checks, and the roster all call it before they
  compare. The reducer refuses `from === into`, an id the home does not know,
  and a cycle.
- **Server.** The engine applies the op to the registry the way it applies a
  color, saves the actors log, and replays it on load. The claim check: the
  presenting badge must claim both actors, through `claimsActor`, or the op
  is refused with its own code. Undo walks the joined stack in log order.
- **CLI.** `isocan identity --join <actorId>` sends the op. `isocan who`
  shows one person afterwards. One line in the agent guide.
- **Web.** In the identity menu's roster, a row for a persona this badge also
  claims offers **Fold into <current name>**, with one sentence saying it
  cannot be undone. On success the row leaves the roster and the canvas
  repaints names, colors and marks from the registry it already subscribes
  to.

**Outcome:** Journey 6 closes. A person who spent weeks as a second name on a
second machine ends with one actor, one name over everything they wrote, one
inbox and one undo, and nothing in the log rewritten.

**Proof:** Journey 6 walked to the end on two machines: fold `Dimitri 2` into
Dimitri from the laptop, then confirm on the desk machine that a comment
written as `Dimitri 2` shows Dimitri, that a thread mentioning `Dimitri 2`
is in Dimitri's inbox, that `isocan who` shows one Dimitri, and that Dimitri's
undo reaches an op `Dimitri 2` wrote. Tests hold the refusals: a badge that
claims only one of the two is refused, `from === into` is refused, a cycle is
refused. A test holds that the log entry `Dimitri 2` wrote still carries
`Dimitri 2`'s id after the join. The same op sent from the CLI and from the
web produces the same registry.

**Findings:** none yet.
