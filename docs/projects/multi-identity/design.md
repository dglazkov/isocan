# Multi-identity

**31 August 2026.** Design. Nothing built. The project's status lives in
[journey.md](journey.md)'s front matter — the journeys are the acceptance
suite, this doc is the argument.

Being the same person on more than one machine. The mechanisms this leans
on were designed in the multiuser project's
[identity-desk](../multiuser/identity-desk.md) doc — the badge, the
attestation, the vouch predicate — and built there through phase 9 and
phase 14. That doc is a record now; this is where the design moves.

**The debt this discharges.** A person who is Dimitri on their desk machine
walks to a laptop and wants to be Dimitri there. Today there is no gesture that
starts from the laptop. The door asks for a name and refuses the one they
want. Which refusal depends on what the browser sent. A browser that has been
Dimitri before clicks the roster row, sends the actor id, and reads *"Dimitri
is somebody else here (another surface already speaks as them)"* with the
prose remedy *"prove the address they signed in with"*. A browser that has
never been Dimitri types the name, sends no actor id, and reads *"Dimitri is
taken here"* with remedies that are CLI flags — `--as`, `--new` — and no
mention of an address at all. Neither renders a control that proves one, and
the second does not even say that proving one would help.

The identity desk's mechanism 6 — person resumption across browsers — is not
missing. It was designed, built in phase 9 stage 2, and played on prod in
phase 14: a badge proves an attribute, `engine.resumable` finds every actor
claimed by another badge that proved the same attribute, and `claims.ts` lets
the second badge become that actor because the vouch stands. **What is missing
is a surface.** The mechanism has no door.

## What already exists, which is nearly all of it

Worth stating first, because it decides how much of this doc is design and how
much is wiring:

- **The vouch works end to end.** `adoptIdentity` on an actor this browser has
  never worn sends `as` + `name`; `vouch()` finds `vouchedBy`; the claim
  stands. `server/test/resumption.test.ts` plays it.
- **`GET /api/attest` already answers `resumable` for the presenting badge**
  (`core/src/attest.ts`). A browser that has proved an address already knows
  who it may be, in one GET, with no email round trip. The comment there says
  it was answered *"so a surface can offer it as a button"*. No surface does.
- **The return leg already renders with no actor.** `SignInNotice` sits outside
  `Doorway` in `App.tsx`, so a tab coming back from an inbox already shows
  "Be Dimitri" over the door.

So the gap is one thing: **nothing lets a person start the sign-in from the
door.** Everything downstream of that first click is built.

## The idea

`knownIdentities()` is who this browser has **been** — localStorage, this
machine, the multiuser project's phase 3 roster. `AttestOffer.resumable` is who
this browser **may be** — the desk, any machine, on the strength of something
it proved.

These are the same act to the person: a face and a name you click to become.
They should render as the same rows, in the same place, in the door's existing
`.identity-known-row` style. Coming back on a new machine should look exactly
like coming back in the same browser, because that is what it is. The only new
thing is how the door came to know — and that is not the person's problem.

That is the whole design. Everything below is states and edges.

## The door, in four states

The door today has two: first-time (a name field) and returning-in-this-browser
(roster rows, then the field). The third person standing at it — returning on a
new machine — gets nothing. These states add them without disturbing the
majority arrival, a stranger on a share link for whom the name is a label and
not a login.

One arrival never meets the door at all, and that is deliberate rather than a
gap in these states: since #88, a canvas whose admission can only view goes
straight to the deck — `ViewerGate` asks the home before asking for a name,
and the viewer face offers nothing that writes and asks for no identity. Every
state below therefore concerns edit-capable arrivals. It does leave one edge
this design names and does not decide: a person whose second machine holds
only a view link to their own canvas has no door and no place to prove an
address, even though a view admission re-asks the door per request and a
proved email would let a named invitation take effect. That edge waits for a
scene that forces it.

**A — Fresh.** Unchanged: name field, Start. Plus one quiet line beneath:

> Already isocan on another machine? **Prove your address**

Gated on `canVerifyEmail(offer)`, which is the existing rule that a home having
borrowed nothing shows no control whose only outcome is a refusal. On every
local daemon in this repo, state A is exactly today's door.

**B — Address open.** The line expands **in place**. Not a second dialog: the
door is already the top layer and stacking a panel on it would put two
"who are you" surfaces on screen at once.

**C — Sent.** *"Check dimitri@glazkov.com. Open the link in this browser."* The
name field stays live underneath, and that is load-bearing rather than
generous — attestation adds a way and removes none, so a person must never be
trapped waiting on an inbox to get to a canvas they could have entered as
anybody.

**D — Proved, with rows.** The tab returns on `continueUrl`, `beginSignIn()`
settles, and the resumable rows render **above** the name field as the primary
action. One click and they are themselves, with the actor id their undo stack,
their mentions and their authorship already hang off.

**D′ — Proved, and nobody to be.** The other machine never proved this address,
so the vouch has nothing to stand on. This state must be actionable rather than
a shrug, because it is the only moment the person is guaranteed to be looking
at the problem:

> dimitri@glazkov.com is proved on this browser. Nobody else here has proved
> it, so there is nobody to pick up.
>
> If you are Dimitri on another machine, prove the same address there too —
> identity menu → "Prove your address" — then come back here.

## Two fixes that fall out

**The refusal gets a control instead of prose.** `claims.ts` throws
`name-taken` from two places, and both reach the door. `admit` refuses a claim
that carries an actor id somebody else holds — the roster-row case — and its
prose names the pass and the address as remedies. `requireFree` refuses a
fresh claim whose name somebody else answers to — the typed-name case, which
is what a new machine does — and its prose names `--as` and `--new`, which are
the CLI's remedies and mean nothing in a browser. The CLI needs both messages
as written. The browser has the code on `ApiError` and should render its own
words for it, the same words for both throws, because to the person they are
one refusal:

> **Dimitri is somebody else here.** Another surface already speaks as them.
> If that's you: [Prove your address] — or pick a different name.

The server's message text is not shown in this branch. Every other refusal
code still renders the server's words, as today.

The door is not the only place a browser meets this code. The identity menu's
rename form sends `actor.claim` with the current actor id and a new name, and
a person who has been `Dimitri 2` on a second machine and types `Dimitri`
there meets `requireFree`'s refusal with the CLI flags in it. Journey 6 is
that person. The same branch renders the same copy in the menu, and its
control opens the **Prove your address** panel in place of the menu, the way
the menu already opens its other panels.

This is the reactive path, and it catches the person who types their real name.
State A's persistent line catches the other one, which is quieter and worse: a
person whose other-machine name was `dglazkov` types `Dimitri`, meets no
refusal at all, and **silently forks themselves into two actors** with two
histories. Nothing today notices that; a persistent entry point is what makes
it avoidable, which is why it is not enough to hang this off the refusal.

**While the door is showing, the door owns the offer.** Today the resumption
buttons ride in a dismissible toast over a dialog asking the person to pick a
name — the wrong weight for somebody whose entire errand was to become
themselves. The rule:

- `actor === null` → the door renders the rows; the notice says only what was
  proved, and carries no buttons.
- `actor !== null` → today's behaviour is right and unchanged. You were already
  somebody, you proved an address, and a toast offering the switch is exactly
  the correct interruption.

## Wiring

`IdentityDialog` is mounted by both `Doorway` and `FrontPage`, so `resumable`
must not arrive as a prop threaded from two parents — the front page's "Been
here before?" button would otherwise be the one entrance that could not offer
resumption.

`signin.ts` already owns the offer cache and already invalidates it after a
successful attest (`offer = null`, so the next reader re-asks). It needs to
**notify** as well as invalidate: a module-level subscriber list with an
unsubscribe, read through a `useResumable()` hook that registers on mount and
leaves on unmount. Not the one-slot shape of `onReBadge` and `onOfflineWrite`,
which hold a single callback and would drop the previous reader when a second
door mounted. The dialog then works wherever it is mounted, which is the
property that makes this one change rather than two.

**No server change, no new op, no new route for any of the above.** An address
field and the states inside one dialog, a subscription, and a `name-taken`
branch. The one op this project adds is the join, in its own section below,
and it arrives only after all of this is built.

## The precondition, and why it stays copy

The mechanism's real asymmetry: resumption on the laptop requires the desk
machine to have proved the address **at some earlier time**, and nothing ever
asks it to. The precondition is discovered on the machine that cannot pay it.

**Decided: copy, not a prompt.** Two changes, no new mechanism:

- `VerifyDialog` leads with being invited by email and mentions resumption
  second. Invert it. The sentence *"it lets this browser be a person your other
  machines already are"* is the reason a person would ever open this panel, and
  it should say plainly that proving here is what makes you resumable
  elsewhere.
- The identity-menu entry's visible label says "Prove your address…", which is
  accurate and silent on why. The why — *"so this browser can be a person your
  other machines already are"* — already exists, but only as a hover tooltip,
  which a person hunting for this is not guaranteed to meet.

**Considered and refused: prompting on first claim.** Offering the address once,
the first time a browser becomes somebody, would pay the precondition before it
is needed. It was refused because it puts a second modal between a person and
the canvas at the exact moment the journey says to get out of the way — and
because the population it helps is people who will have a second machine, which
the door cannot know and must not assume.

The residual cost is stated rather than hidden: a person who never opens the
identity menu on their first machine will meet state D′ on their second, and
will have to walk back. D′ tells them how. That is the trade.

## Joining two actors

Added 1 Sep 2026, and the one place this project writes a new op.

A person who was `Dimitri 2` on the laptop for a while and then becomes
Dimitri leaves two actors behind, each with its own comments, mentions and
undo history. The canvas shows two people who were both them, and every
reader who scrolls up sees it. The switch alone does not fix this, and the
first draft of this design left it open. It is now phase 5.

**The op is `actor.join { from, into }`**, and it belongs to the family
`actor.setColor` and `actor.setMark` already define: home-scoped, applied to
the actor registry, written to the actors log, replayed on load, and not
undoable. The registry gains one map, `joined`, from an old actor id to the
id it was folded into. The log is not touched. Every op `Dimitri 2` wrote
still carries `Dimitri 2`'s id, which is the rule the registry has always
worked by: history keeps what it recorded, nobody is shown it.

**Readers resolve before they compare.** Today `actorNameIn` looks a name up
by actor id; colors and marks do the same; the inbox asks whether a comment's
author id or mention list is this actor; presence lists actors by id; undo
walks the entries one actor id wrote. Each of those gets the id through the
`joined` map first, transitively, in one function in core. That is the whole
mechanism, and it is why a mention of `Dimitri 2` in an old thread reaches
Dimitri, why Dimitri's undo reaches an op `Dimitri 2` wrote, and why `isocan
who` shows one person.

**Who may send it.** The op is refused unless the presenting badge claims both
actors. That is not a new kind of check: `claimsActor` already answers it for
every write. It is exactly what journey 6 leaves the laptop holding after
step 4, its own claim on `Dimitri 2` and its vouched claim on Dimitri, and it
means no stranger can fold anybody into anybody. The op is also refused when
`from` equals `into`, when either id is unknown to the home, and when the
join would close a cycle.

**Decided, because a join has to decide them:**

- *Undo stacks combine.* The person is one, so their undo is one, in log
  order. A join is not itself undoable, like every registry op, and the
  menu says so once before it sends.
- *Old mentions reach the new person.* The mention was resolved to an actor
  id when it was written, and that id now resolves to Dimitri.
- *The old name is released.* `Dimitri 2` stops answering to anyone, so the
  name is free again. The roster row for it leaves this browser.
- *Direction is the person's choice.* The row offers to fold the persona
  named on it into the actor currently active. Folding Dimitri into
  `Dimitri 2` is the same op with the ids swapped, and nothing prevents it.

**Both surfaces.** The web offers it from the identity menu's roster, on a row
for a persona this badge also claims. The CLI sends the same op as
`isocan identity --join <actorId>`, and the agent guide gains one line saying
when an agent would want it, which is almost never.

## Considered and left out

**Handing the identity to another device from machine A.** A pass already does
this — `mintPass` exists, `arrival.ts` redeems a `#pass` from a URL, and
`mintPass`'s own comment (`web/src/lib/api.ts`; core's `passes.ts` carries the
longer argument) says omitting the actor is the admission-only shape because
*"Scene 5 hands your identity to your own second machine"*. A
sibling of "Bring your own agent…" reading "Open on another device…" would be
small, would work on **every** home including the attester-less ones this
design leaves out, and would skip the inbox entirely.

It is left out on purpose, not forgotten. It is a different gesture with a
different failure profile: it needs both machines in front of you at once and
it dies with machine A, so it answers neither the stolen laptop nor the new
job. It is also canvas-scoped — a pass names a canvas — so it could never be
offered from the front page, where a person with no canvas in hand is standing.
The two belong on opposite machines and do not compete for the door. If it is
built, it belongs to this project as its own later piece of work.

**The word "sign in."** `VerifyDialog`'s header argues at length that the word
must not appear, because isocan has no accounts and the word sends people
hunting for a password, an account-settings page and a way to delete an account
that does not exist. That argument holds and is not reopened. But the mental
model arrives whether or not the word does — the request that produced this
design opened *"I signed in into isocan.io as Dimitri"* — so the door speaks in
the person's frame without using the word. "Already isocan on another machine?"
is the frame; nothing on the panel promises an account.

## What this is still not

An account. A person who never proves an address uses isocan exactly as they
did: the link still admits, a badge is still free, and the roster still brings
them back in the browser they started in. Nothing here is required to enter
anything, which is the property that decides every gate in state A.
