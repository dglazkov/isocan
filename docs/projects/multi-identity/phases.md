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

**Where we are: NOTHING BUILT.** Design and journeys written 31 Aug 2026.
Scope decided the same day: the door only, the precondition stays copy, and
the whole diff lives in `packages/web` — no server change, no new op, no new
route. Journey 5's acceptance ("no diff under `packages/cli` or
`packages/core`") holds every phase to that, not just the last one.

The order below is dependency order: phase 1 is wiring with a small visible
result and proves the offer reaches the door; phase 2 is the feature, where
the door states and their copy land; phases 3 and 4 are each one branch and
one set of words. The phases are deliberately unequal — phase 2 is the
boulder — because the split follows the proofs: each phase ends at a journey
that can be walked, and a finer split would need invented acceptance tests.

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

**Status: not started.**

**Work:** The wiring [journey.md](journey.md)'s "What the journeys force"
section names: `signin.ts` notifies when its offer cache invalidates (a
module-level subscription in the shape of `onReBadge`), a `useResumable()`
hook reads it, and `IdentityDialog` renders resumable rows in the existing
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

**Findings:** none yet.

---

## Phase 2 — The door starts the proof

**Status: not started.**

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

**Findings:** none yet.

---

## Phase 3 — The refusal renders its remedy

**Status: not started.**

**Work:** The `name-taken` branch: when the door's claim is refused with that
wire code, the dialog renders the refusal with a **Prove your address**
control that opens state B. The branch keys on `ApiError.code`, never on
message text. The CLI's refusal prose is untouched.

**Outcome:** Journey 2 closes. The refusal that names a remedy in prose now
renders it as a control, for the person who typed their real name before
reading anything.

**Proof:** Journey 2 walked: type the taken name, meet the refusal, click
through to being yourself. A test asserts the branch fires on the code alone
(a reworded message still branches). `git diff --stat` for the phase shows
`packages/web` only.

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

No prompt on first claim; that was considered and refused, and this phase
does not reopen it.

**Outcome:** Journey 3 closes end to end: the failure message on the second
machine and the panel it points to on the first machine now tell one story.

**Proof:** Journey 3 walked across both machines, including the return with
no second email round trip. Then the journey 5 sweep, which is the project's
closing proof: the stranger's door, the viewer's deck, the
already-somebody toast, and `git diff --stat` across all four phases showing
no line under `packages/cli` or `packages/core`.

**Findings:** none yet.
