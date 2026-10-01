---
status: designed
since: 2026-10-01
see: canvas-groups
note: "the walk: lift, ⌘ takes one item (with hover that says what a press takes), live drag for viewers, stacks."
issue: 373
---

# Groups by hand — the walk

**1 October 2026.** The order of work for
[the research note](../../research/2026-10-01-groups-stacks-lift.md), held to
[journey.md](journey.md). Decided by Dion the same day: stacks are shared and
remembered (opening is not); ⌘-drag-out lands where the pointer is; a plain
drag never detaches.

**Where we are, 1 Oct 2026: nothing built. Next: groups-by-hand phase 1, the lift.**

Two rules for every phase, on top of `AGENTS.md`:

- **A drag is proved by driving one.** Every phase ends with a journey in
  `scripts/journeys.mjs` (its own daemon, its own temp home, real Chrome) that
  presses, moves and releases, and asserts on state.
- **No new op type.** Everything here is `group.change` actions, presence
  fields and CSS. A phase that seems to need an op stops and says so.

## Phase 1 — The lift

**Status: NOT STARTED.**

**Outcome:** while an item (or a group's frame) is being dragged it wears
`--shadow-lift`, defined in both theme blocks, eased in once the press becomes
a drag and settled on release; no scale, no offset, and `opacity: 0.92` comes
off. A group drag lifts the frame, not its members. Reduced motion swaps
without transition.

**Proof:**

1. `npm test` and `npm run typecheck`; `test/tokens.test.ts` holds the token in
   both themes; a test holds that `.item.dragging` adds no transform or scale.
2. A journey `lift` that presses an item, moves it 40 px, and reads the item's
   computed `box-shadow` mid-drag (the lift) and after release (the card's).

## Phase 2 — ⌘ takes one item

**Status: NOT STARTED.**

**Outcome:** the research note's hover table, built: one function (from
`scopedHit`) decides both the dashed outline and what a press takes, replacing
CSS `:hover` for items in groups; the space inside a frame takes the pointer at
the canvas level. ⌘ (Ctrl off a Mac) hovers and presses the item under the
pointer at any depth; ⌘-drag may leave its group, landing where the pointer is,
with an *Out of …* / *Add to …* pill, as one `transform` with `containerId`.
Plain drags keep the frame-grows rule. *Move to canvas* in the menu, ⌘⇧G on a
member, `isocan mv <item> --out [--to-root]`, the agent-guide line, and
`shortcuts.ts` rows.

**Proof:**

1. `npm test`, `npm run typecheck`; core tests of the hit function over every
   row of the table; CLI test of `mv --out`.
2. A journey `group-reach` that hovers a member and the gap (group outlined),
   ⌘-hovers (member outlined), ⌘-drags a member out to the canvas (one item
   fewer, one undo restores it), and plain-drags one past the frame (still a
   member, frame grew).

## Phase 3 — Others see the drag

**Status: NOT STARTED.**

**Outcome:** the presence message carries an optional `drag` (`gesture`,
`roots`, `from`, `dx`, `dy`, `into`), sent only while dragging at the existing
throttle; viewers draw the roots' closure offset by a per-item CSS transform,
lifted and edged in the mover's colour, lerped like cursors. A ghost cancels
when its item is no longer at `from`, holds ~1 s after the field disappears
until the op lands, and glides home if none comes or the mover goes stale.
Over ~50 roots it sends a bounding box.

**Proof:**

1. `npm test`, `npm run typecheck`; unit tests of the viewer store: cancel on
   landed move, cancel on someone else's move, hold through the release race,
   stale timeout, no replay for a late joiner.
2. `scripts/frames.mjs` gains a remote-drag case, measured before and after,
   with no regression past the 26 Sep numbers.
3. A journey `live-drag` with two browser sessions: the viewer sees the item
   offset mid-drag and at the final spot after release.

## Phase 4 — Stacks

**Status: NOT STARTED.**

**Outcome:** `GroupLayout.display: "stack"`, set by the `layout` action (one
undo), shared and stored; members' positions untouched. Rendered as the seeded
messy pile (turns a pure function of item ids, up to six behind, tinted),
fanned into a hand on hover, opened into a temporary grid on click (never
stored; Esc closes), with *Stack* / *Spread* on the title band and
`isocan canvas group stack <group> [--spread]`. Only the top card renders its
content. Dropping onto a stack adds to it; ⌘-drag out of the open grid leaves.

**Proof:**

1. `npm test`, `npm run typecheck`; core tests that stacking leaves every
   member's `x`/`y` unchanged and that the pile's transforms are stable for the
   same ids; CLI test of `stack`/`--spread`.
2. A journey `stack` that stacks a group, reloads (still stacked), fans, opens,
   closes with Esc, and spreads (every member where it was).
