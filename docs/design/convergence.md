# Convergence

The canvas can diverge and cannot converge. `/variation` makes N alternatives
as siblings; nothing brings the winner home. This proposes the operation that
does, and argues for the shape that keeps the losers.

Two independent lines of work reached this gap on the same day: the
[market survey](../research/2026-08-23-agents-on-the-canvas.md), looking at
what the category shipped, and the [atlas journey](../atlas-journey.md), whose
Scene 8 cannot be finished without it. That agreement is most of the case for
building it.

## What exists, and the shape of the hole

Divergence is well served. `/variation` writes N children carrying
`parent=<source>`, each with its own author, versions, threads and undo;
`/format` lays them under the thing they came from. Nobody is editing over
anybody, and the alternatives are real items rather than states of one item.

Convergence exists too — but only **vertically**, inside a single item.
`item.setCurrentVersion` picks which version of one item is current, and
`isocan version promote` is its verb.

There is nothing **horizontal**. No operation moves a sibling's content back
into the parent it was made from, and no verb in the CLI says *this one won*.
The canvas's answer today is that somebody copies a file by hand, which is
outside the vocabulary and therefore outside undo, outside the log, and
invisible to everybody else.

## Why this is an operation and not a property

The house rule prefers a convention in `properties` over a new op, and it has
paid repeatedly — `parent`, `annotates`, `star`, `role`, `region` are all
relationships that cost no vocabulary. It does not stretch to this one.

A property can record an opinion (`chose=<childId>`) but cannot move bytes. The
parent's own content would stay stale, so `isocan get`, a download, and every
future reader would receive the thing that lost. For the atlas that is fatal —
`data.mjs` *is* the parent, and the winning variation's data file has to become
the source or the next rebuild undoes the decision.

So: a new `Operation`. One, because choosing is one user-visible act and the
house rule is one op per act so it is one undo.

## The proposal

```ts
| { type: "item.adopt"; itemId: string; chosenId: string }
```

`itemId` is the parent doing the adopting; `chosenId` is the child whose
content becomes current. Applying it:

1. Every child of `itemId` — found by the `parent` property — contributes its
   current blob as a **new version of the parent**, in canvas order so the
   result is stable and replayable.
2. The version contributed by `chosenId` becomes current.
3. The child items are retired to the trash, whole, the way `item.delete`
   already retires them.

One op, one undo, one entry in the log with the actor on it.

### The losers become versions, and this is the argument

The obvious design is *winner wins, losers to trash*. This proposes folding
**all** of them into the parent's stack instead, for three reasons.

**It is what the version stack is for.** A stack is the alternatives to one
thing, ordered, with one current. Three variations of a screen are exactly
that; they were only siblings because there was no other way to make them in
parallel.

**The repo already believes this.** `docs/changelog/README.md`: *where a day's
work was later reverted, the entry says so rather than quietly dropping it — a
road not taken is worth as much as the one taken, and costs less to read.* A
convergence that discards the roads not taken contradicts a value this codebase
states out loud.

**It tidies the canvas, which is a real cost today.** After two rounds of
`/variation` a canvas is a field of near-identical cards. Adopting collapses N
cards into one item with a deeper stack, and `S` still shows everything that
was considered. The canvas gets simpler and loses nothing.

### The inverse is the expensive half, and this doc was wrong about it

The forward path is easy. The inverse has to remove the versions that were
added and restore the retired children.

**An earlier version of this section said the pieces already existed** —
`item.removeVersion`, `item.restoreVersion` and `items.restore` — and called
that a sign the seam was left open on purpose. The
[architecture review](../reviews/2026-08-24-architecture.md) checked, and it is
not: `invert.ts` returns `Operation | null`, **one** operation, so an inverse
cannot be three of them. Adopting needs a new internal op that undoes the whole
act in one step, the way `items.delete` has one.

That is a cost this proposal understated rather than a blocker — but it changes
the size of the work, and the review's counter-shape is the better starting
point: the op carries `contributions: { childId, versionId }[]`, so the reducer
validates a set it was handed rather than minting version ids itself, which it
has no business doing when every other version carries a client-minted id. The
thread post moves out of the op and into the verb for the same reason.

**The risk to design against** is a partial inverse: an undo that restores the
children but leaves the versions, or the reverse, is worse than no undo,
because the canvas ends in a state neither the person nor the log expects.
Whatever else is cut, the inverse is atomic or the op does not ship.

### Keep the argument, not only the outcome

The reasoning about why one won lives on the losing sibling's thread. Retiring
that sibling takes the reasoning with it — the exact loss the changelog rule
exists to prevent, reintroduced by the fix.

So adopting **posts the decision to the parent's thread**: what was chosen,
what it was chosen over, and by whom. The canvas keeps the *why*, which is the
part that is expensive to recover, and it costs one comment.

## Both surfaces

Per the house rule, before this is done:

- **CLI**: `isocan choose <item>` — "adopt this one; its siblings become
  versions of what they came from". The verb is the intent, not the mechanism.
- **Web**: a "Keep this" action on a variation, wherever the fan-out is.
- **Agent guide**: a verb agents are not told about does not exist, and
  `surface.test.ts` will fail the build until it is there — though note the
  [architecture review](../reviews/2026-08-23-architecture.md) found that check
  is a substring match, so it may pass vacuously. Fix that first or this lands
  undocumented and green.

## Open

- **What if the parent is gone?** A variation whose source was deleted has
  nowhere to go home to. Refuse, and say so.
- **What about a child with its own children?** Adopting a subtree is a
  different act and probably not this op. Refuse for now.
- **Order.** Canvas order is proposed because it is stable and visible; creation
  order is defensible too. Pick one and write it down — a stack whose order
  depends on the reader is not a history.
- **Timing.** This touches the reducer both clients share, while the multiuser
  build is mid-flight. It is small, but it is not a change to land unannounced.
