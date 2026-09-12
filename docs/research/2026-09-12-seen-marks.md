---
status: built
since: 2026-09-12
issue: 147
see: 2026-08-29-the-inbox.md, switcher, roles, multi-identity, memory
note: designed and built 12 Sep — one fact, `(person, canvas) → { seq, at }`, kept on the home's DESK rather than on any canvas's log. No new op: the vocabulary stays at 33. The inbox reads the mark as "what is new"; the switcher reads the same mark as "where I was lately". No read receipts, deliberately and by construction
---
# Seen-marks: one fact, read two ways

**12 September 2026.** The decision two features had both stopped on, and the
build that followed it the same day.

- **The inbox** ([#147](https://github.com/dglazkov/isocan/issues/147), step 2)
  wanted to say what is NEW rather than listing everything, and
  [the research note](2026-08-29-the-inbox.md) stopped at "this needs a durable
  read marker, and that is a decision nobody has made".
- **The switcher** ([#134](https://github.com/dglazkov/isocan/issues/134), walk
  step 4) wanted a **shared "lately"** — the canvases you were on recently,
  the same on your laptop and your desktop, instead of one list per browser.

Dion decided on 11 Sep that a new op was acceptable *if one was genuinely
needed*, and that the two had to be designed together rather than apart. This
is that design. **One fact serves both**, and it turned out not to need an op.

---

## The fact

```
(person, canvas) → { seq, at }
```

One row per person per canvas. `seq` is the canvas's own oplog sequence — the
head you had in front of you. `at` is the instant the mark was written, stamped
by the home that holds the canvas.

That is the whole of it. Everything below is where it lives, how it merges, and
what each half is for.

### Per canvas, not per thread (**D1**)

The 29 August note argued this and the build agrees, for the reason it gave:
**a per-thread mark makes every glance a write.** Ten threads opened is ten
rows; on a busy canvas attention itself starts replicating, and the ephemeral
plane exists precisely so that looking is free. A per-canvas high-water mark
costs at most one write per canvas per visit and answers the question the inbox
actually asks — *is there anything here for me that I have not seen* — exactly.

What it gives up, said plainly: it cannot tell you *which* of two threads you
have read. The per-thread watermarks in `localStorage`
(`web/src/stores/unreadStore.ts`) still do that, they stay where they are, and
they stay per browser. The durable mark is the coarse one; the local one is the
fine one. Two records, two jobs, and the coarse one is the only one that
crosses machines — which is the half that was missing.

### Both a seq and a timestamp, because they answer different questions (**D2**)

The natural instinct is to pick one. Neither one is enough:

- **`seq` alone** answers *has anything happened on this canvas since I looked*
  in one integer comparison against `lastSeq`, with no clock anywhere and no
  scan. It cannot answer *which comment is new*, because a `Comment` carries
  `createdAt` and not the seq of the op that wrote it, and giving it one would
  mean touching every comment ever written.
- **`at` alone** answers *which comments are new* — `comment.createdAt > at`,
  both stamped by the same home's clock, which is what makes the comparison
  honest. It cannot cheaply answer *has anything happened*, because a canvas
  whose items moved wrote no comment, and it is a wall clock: two homes'
  clocks disagree and a mark is meaningless the moment it is compared against
  a stamp from somewhere else.

So both, each doing the thing the other cannot, and each monotonic on its own.
The oplog is the clock **within** one canvas; the wall clock is the only thing
comparable **across** canvases, which is exactly what "lately" needs.

---

## Where it lives, and why it is not on the canvas

The project's rule is that **the canvas is the record**. The counter-argument
is that being seen is not the canvas's business. The [memory
design](../projects/memory/design.md) already carries the test that settles it,
inherited from the [context project](../projects/context/design.md): three
questions decide whether a proposal is canvas state — *can it be undone, can
everyone see it, does it work with the network off*.

**A seen-mark fails all three, and it fails them by design** (**D3**):

- **Undo is meaningless.** "Un-see this" is not an act anybody performs. A
  ⌘Z that silently walked your inbox backwards would be a bug with a feature's
  name.
- **Everyone must NOT see it.** This is the whole privacy question, below.
- **Offline it degrades, and that is acceptable.** A mark you could not write
  because the home was unreachable costs you a canvas showing as unread that
  you had in fact read. Self-correcting on the next visit, and the only
  direction this feature is allowed to be wrong in.

Failing all three is not a near miss. It is the proof that the fact is not
canvas state, and the canvas's oplog is therefore the wrong place for it: an op
would have to be exempted from replication, from undo, from the wire shapes and
from the log itself — four exceptions to the definition of an op, which is
another way of spelling "this is not an op".

So it lives on **the desk** — the home's private ledger, beside grants, passes,
spaces and the claims table. That seam is the two-ledger rule made mechanical:
`store.ts` holds what replicates, `desk.ts` holds what must never travel, and
"is this replicated?" is answered by which module a type is imported from. A
seen-mark is imported from the desk, so it structurally cannot reach another
person's replica. There is no wire shape for somebody else's marks anywhere,
and the only read is scoped to the actors the asking badge already claims.

What that costs, said out loud: the mark is **not in the canvas's history**.
Nobody can audit it, replay it, or undo it, and a canvas exported with
`isocan export` carries no seen-marks — which is right, because they are not
the canvas's, and would be a privacy leak in a directory people commit to git.

### And therefore: no new op (**D4**)

Dion's decision permitted exactly one new op with a justification in the
architect's terms. The honest answer is that none is needed, so none was added.
**The vocabulary stays at 33.**

The invariant that holds for all 33 and would not hold for a 34th here:
**every op is appended to a log, and its effect is visible to everyone who can
see the thing it is about.** The home-scoped `actor.*` family — `claim`,
`setColor`, `setMark`, `join` — is not a counter-example: those land in
`actors.jsonl`, and a colour and an emoji are public by their whole purpose.
A seen-mark would break the second half of that sentence on purpose, and would
break the first half too, because a log line per glance is "attention
replicates" written into a file.

There is a well-trodden second path for precisely this class of thing, and the
journey's own rule 5 names it: per-person and innkeeper-private state is
**written through the daemon API — never an op**. Grants took it, passes took
it, spaces took it. Seen-marks take it, and the isomorphism is unharmed,
because both surfaces call one route through one typed client: the CLI through
`DaemonRoutes`, the web through `lib/api.ts`, neither spelling a URL, both
merging with the same function in `@isocan/core`.

This is also why a `read`-rung viewer is never refused their own marks. A
canvas-scoped op meets the capability gate in `POST /api/ops` and a viewer is
turned away at it; the seen routes are not canvas-scoped writes and ask no
capability, because a private note about your own attention is not an edit to
anybody's canvas.

---

## Monotonicity: the merge rule, in one function

`advanceSeen` in `core/seen.ts` is the only place either half of the mark is
compared, and it is a join on each component independently:

```
seq → max(stored.seq, incoming.seq)
at  → max(stored.at,  incoming.at)      // ISO strings, lexicographic
```

Three consequences, each of which is a test:

- **A mark never goes backwards.** An old client that has been holding a stale
  `lastSeq` for ten minutes cannot pull your mark back; its write is a no-op on
  the `seq` and may only move `at`.
- **Two machines racing converge.** Each component is a max, so the merge is
  commutative, associative and idempotent — the order the two writes arrive in
  cannot change the answer.
- **A revisit still counts even when nothing happened.** `at` moves on its own,
  which is not a curiosity: a canvas you read for an hour and changed nothing
  on is exactly the canvas you come back to, and it is the case "lately" exists
  for. That is why the two components move independently rather than as a pair.

**Multi-identity.** A mark is keyed by actor id, a person can be two actors,
and `actor.join` folds one into the other. Writes resolve through the join map
first, so new marks land on the surviving id; reads merge — with the same
`advanceSeen` — across every actor the asking badge claims, which after a join
is both of them, because a badge that claims both is precisely what `actor.join`
requires. So a fold needs no migration and loses nothing: Dimitri 2's marks and
Dimitri's marks are one person's marks the moment one badge holds both.

---

## Privacy: this is not a read receipt, and must not become one (**D5**)

A durable record of what you have read is a read receipt waiting to happen, and
on a shared canvas that is a harm rather than a feature. The people who read a
design without commenting are not doing anything they owe anybody an account
of, and a product that starts showing *Dion saw this 4 minutes ago* has changed
what it costs to look at something.

So the position is explicit: **isocan does not have read receipts, and this
mark must not be used to build them by accident.** The guards are structural
rather than remembered —

1. The mark is desk state. The desk has no replication path at all; nothing in
   `store.ts` can reach it and nothing in an oplog carries it.
2. There is no route, wire shape or derivation anywhere that returns another
   actor's marks. `GET /api/seen` answers only for the actors the presenting
   badge claims.
3. The presence plane already answers the legitimate version of the question —
   *is somebody here right now* — honestly, live, and without a durable record.
   That is the surface a "who has seen this" request should be pointed at.

The honest caveat, because saying "private" without it would be a lie: **the
home can see it.** The machine that holds the canvas holds the desk, and a home
already holds every op you have ever written there. What this design promises
is that no *person using isocan* is ever shown another person's mark, by any
surface, and that adding one would mean adding a route that does not exist and
crossing a seam that is enforced by imports.

---

## What each surface says

**`isocan seen`** — the terminal's view of the same fact, and the shared
"lately" in its plainest form: your canvases, most recently seen first, each
saying how long ago and whether it has moved since.

```
$ isocan seen
Acme redesign      seen 2h ago · moved since
Test canvas        seen yesterday
Sprint desk        seen 3d ago · moved since
```

`isocan seen --mark` moves the mark for the bound canvas to its head — what an
agent does after reading a canvas, and what the web does when you open one.

**`isocan inbox --new`** — the inbox, filtered to what has arrived since your
mark for each canvas. The tally line grows one number, so the count is per
reason as the 29 August reading argued it should be:

```
2 named you · 7 in the Chat · 1 in threads you are in · 4 new
```

Everything else about the inbox is unchanged. The filter is still `inboxOn`;
`newSince` is a second, separate function that takes the entries the rule
already produced and splits them. The routing rule has one definition and this
does not become a second one.

**The web** does the smallest honest thing: opening a canvas writes the mark
(one request, only when it actually advances), and the switcher's "lately" is
ordered by the marks when the daemon answers, falling back to this browser's
`localStorage` recents when it does not. A person on two machines now finds the
same canvases at the top of ⌘O on both.

What the web deliberately does NOT grow here: a home-level inbox panel. That is
[#147](https://github.com/dglazkov/isocan/issues/147) step 3, it wants the
cross-home canvas list that step 3 also has to solve, and a small surface that
is true beats a large one that is half-wired.

---

## Is "lately" really the same fact? (yes, and here is the seam)

The question worth being suspicious of: "where I was" and "what I have seen"
sound like two facts, and building one mechanism for two facts is how a product
ends up with a field that means neither.

They are the same fact **because of when the mark is written**. The mark is
written when you open a canvas, not when you finish reading it — so it always
carries both meanings at once: *I was here at `at`*, and *everything up to
`seq` was in front of me*. The inbox reads the second half; the switcher reads
the first. Neither reader needs a field the other does not.

Where they would come apart, named so a later change notices: if the mark ever
moved on something that is **not** a visit — a background poll marking things
seen, a "mark all read" button, an agent sweeping canvases — then `at` stops
meaning "I was there" and the switcher's list starts filling with canvases
nobody went to. So the rule is one line and it is in the code: **only a visit
writes a mark.** `isocan seen --mark` is a visit (an agent that read the canvas
says so); opening the canvas in a browser is a visit; nothing else writes.

---

## Decisions

**D1. The mark is per (person, canvas), not per (person, thread).** 12 Sep
2026. A per-thread durable mark makes every glance a write and makes attention
itself replicate; a per-canvas high-water mark costs one write per visit and
answers the inbox's question exactly. The per-thread watermarks stay in
`localStorage`, per browser, doing the fine-grained job they already do.

**D2. "Seen" is a seq AND a timestamp.** 12 Sep 2026. The seq answers "has
anything happened here" against `lastSeq` with no clock and no scan; the
timestamp answers "which comment is new" (comments carry `createdAt`, not a
seq) and is the only thing comparable across canvases, which is what "lately"
orders by. Each is monotonic on its own, so a revisit that changed nothing
still moves `at`.

**D3. A seen-mark is desk state, not canvas state.** 12 Sep 2026. It fails all
three of the context project's tests on purpose — it cannot be undone, everyone
must not see it, and offline it degrades harmlessly — which is the proof that
it is not the canvas's record. It lives behind the desk seam, which has no
replication path, so "no other replica can learn it" is a fact about imports
rather than a convention. Given up: it is not in the canvas's history, not
replayable, and not carried by `isocan export`.

**D4. No new op — the vocabulary stays at 33.** 12 Sep 2026. Dion permitted one
on 11 Sep if one was genuinely needed. The invariant that holds for all 33 is
that an op is appended to a log and its effect is visible to everyone who can
see the thing it is about; a seen-mark breaks both halves deliberately, and
would need exemptions from replication, undo, the wire shapes and the log — four
exceptions to the definition. The journey's rule 5 already names the path this
takes instead: private per-person state is written through the daemon API,
never an op, as grants, passes and spaces are. The isomorphism holds because
both surfaces call one route and merge with one function in core.

**D5. No read receipts, and the guards are structural.** 12 Sep 2026. A durable
record of what you have read is a read receipt waiting to happen, and on a
shared canvas that is a harm. No route, wire shape or derivation returns another
actor's marks; `GET /api/seen` answers only for the actors the presenting badge
claims; the legitimate question ("is somebody here now") is already answered
honestly by the presence plane. The home can see the ledger, as it can see every
op — that is stated rather than hidden.

## What would make this fail

- **A second writer that is not a visit.** A "mark all read" control, a
  background sweep, an agent tidying its inbox — any of them moves `at` without
  anybody having been there, and the switcher's "lately" quietly becomes a list
  of canvases nobody visited. The one-line rule is in `seen.ts`'s comment and in
  this note; a change that breaks it should have to argue with both.
- **A mark that goes backwards.** The merge is the only comparison and it is a
  max on each half; a second comparison written somewhere else is how that stops
  being true. `core/test/seen.test.ts` holds it.
- **Somebody adding the read receipt.** It would take one route returning marks
  for an actor the badge does not claim. That is why the scoping is in the route
  and not in the caller.
- **A count that is a lie on the second device** — the 29 August note's own
  named failure, now answered: the count comes from a mark the home holds, so
  both devices read the same one.
