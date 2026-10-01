---
status: open
since: 2026-10-01
see: canvas-groups
note: "Four proposals for working with groups by hand, each checked against the code. (1) ⌘/Ctrl takes one item: hold it to aim at and drag a single member of a group from any scope, and drop it outside the frame to take it out. Today nothing can drag an item out of a group, because the frame grows to keep it. This needs no new op: transform with containerId already moves and reparents in one undo, and null means the canvas. (2) Stacks: a group shown as a slightly messy pile of cards, the top one upright in the middle and the rest turned and nudged behind it. The turns are seeded from each item's id, so every viewer sees the same pile. It fans into a hand of cards on hover and opens into a temporary grid on click. The layout is stored on the group and members keep their positions, so spreading the stack restores them exactly. (3) Lift: a new --shadow-lift token while dragging, with no scale and no offset, so where you see it is where it lands. (4) Others see the drag live: it travels on presence, not as ops, so nothing replays and a landed move cancels the live view. A prototype in groups-stacks/ shows the first three."
---

# Getting things in and out of groups, stacks, and the lift

**1 October 2026.** Dion asked for three things: an easier way in and out of
groups, with a modifier that reaches for one item rather than its group;
**stacks**, a group shown as a pile you can fan and open, "with some really
nice visuals"; and a **shadow while dragging**, so a moved item reads as
picked up rather than merely selected, without growing, because a bigger card
hides where it will land. Mid-way he added a fourth: **show a drag live to
everyone else** instead of a jump on release, without replaying moves that
have already landed.

Everything below was checked against the tree on the day. `file:line`
references are to `main` at `2d100930`. A throwaway harness,
[`groups-stacks/prototype.html`](groups-stacks/prototype.html), shows
proposals 1–3. Open it in a browser and press the cards.

## What is true today

**A group is an ordinary item that owns nothing.** `properties.kind ===
"group"` (`core/src/canvas-groups.ts:12,81`). Membership is the child's
`item.containerId` (`core/src/model.ts:189`), and every structural change is one
op, `group.change`, whose output has an exact inverse, so one act is one undo
(`ops.ts:241`, `invert.ts:60`).

**A click on a member takes the outermost group.** "Root-scope clicks reach the
outermost group; inside a group they reach direct children"
(`canvas-groups.ts:109-114`). Reaching a member means stepping in first:
double-click, Enter, the menu, or breadcrumbs. Esc steps back out
(`CanvasPage.tsx:838-871`).

**Nothing can drag an item out of a group.** This is the gap Dion is feeling. The rule is
deliberate: "Dragging it out does not silently detach it: the frame grows on
commit to enclose it" (`docs/projects/canvas-groups/design.md:132`). In the
drag code, "only a named different destination deliberately changes the
relationship" (`ItemView.tsx:613`). Joining is decided by the **pointer**:
the deepest frame under it, outlined in accent with an *Add to …* pill
(`canvas-groups.ts:333-346`, `styles.css:5102`). Leaving is a menu item
(*Remove from group*, one level up), the group dialog, or the CLI
(`isocan canvas group remove [--to-root]`). **The web has no "to the
canvas"**; `toRoot` is CLI-only.

**The modifiers on a press or a drag today.** Every one is taken except ⌘ / Ctrl:

| | at the press | during the move |
| --- | --- | --- |
| Shift | selection (add, drag the selection; `press.ts`) | snap harder, 18 px instead of 6 |
| Alt | reach the item underneath (cycles the stack under the pointer) | no drop target |
| ⌘ / Ctrl | — | — |

**A dragged item barely changes.** `.item.dragging` is `opacity: 0.92; z-index:
2` (`styles.css:1240`), with the same `--shadow-card` it had at rest. There are
two elevations in the system, `--shadow-card` and `--shadow-pop`, plus
`--lift` for silhouettes. Position goes through React state
(`ItemView.tsx:584-619`), and one `item.move` / `items.move` is sent on
release.

**Other people see a jump.** Presence carries cursor, selection, text selection
and signal every 33 ms (`canvasStore.ts:723-737`), and **no drag offset**.
A viewer watches your cursor carry nothing across the canvas, and then the item
teleports when your op lands.

**Groups have no collapsed form.** `design.md:747` lists "collapsed groups" as
later work. The only "stack" in the app is the **version stack**: blank plies
offset 5 and 10 px down-right behind an item with versions
(`ItemView.tsx:908-909`). Group stacks must not be confused with it.

## 1. ⌘ takes one item

**The proposal.** Holding ⌘ (Ctrl off a Mac) changes what the pointer is
aiming at, from the group to the item under it, at any depth and from any
scope:

- **Hover with ⌘ held:** the dashed hover outline that today previews the group
  moves to the single item under the pointer. You see what a press will take
  before you press.
- **⌘-click:** selects just that item and sets the scope to its parent, as if you
  had stepped in. Esc steps out the way it does today. This is Figma's
  *deep select*, on the same key
  ([shortcut reference](https://www.nobledesktop.com/shortcuts/figma/mac),
  [deep-select thread](https://forum.figma.com/archive-21/deep-select-how-to-select-something-that-is-below-an-group-15612)).
  tldraw reaches the same place by clicking twice into a focused group
  ([groups](https://tldraw.dev/sdk-features/groups)), which isocan already has
  as double-click.
- **⌘-drag:** drags just that item, **and lets it leave**. The pointer decides
  the destination, as it already does for joining. Over another frame the pill
  says *Add to Archive*. Over its own frame nothing changes. Over open canvas
  the pill says ***Out of Onboarding*** and the drop puts it on the canvas.
  Without ⌘ a drag keeps today's rule, where the frame grows, so nobody detaches
  anything by accident. ⌘ is the deliberate act the design note asked for.
- **⌘ pressed or released mid-drag** re-reads the destination live, the way
  Shift's snapping already does, so you can pick up an item normally and decide
  at the edge.

**Why ⌘, and not a gesture.** ⌘ is the one modifier with no meaning on a press
or drag here, and it is the key designers already use for this. The rejected
alternative is a *tear-off*: drag past the frame by some distance and the item
detaches. It is discoverable, but it brings back exactly the accidental detach
the groups design ruled out, and its threshold would be a guess.

**What it costs.** No new op: `transform` already takes `containerId`, and
`null` is the canvas (`canvas-groups.ts:1056`, `destination(…,
action.containerId ?? null, …)`), so move-and-leave is one act and one undo
today. The work is in the web's press and drop code (`press.ts`,
`ItemView.tsx`, `groupgestures.ts`), plus the hover preview.

**Details to get right:**

- **On a Mac it must be ⌘, never Ctrl,** because Ctrl-click is a right-click
  there. `shortcut()` in core already spells modifiers per platform.
- **An annotation follows its target.** The resolver refuses to separate them
  ("detach the annotation before changing its group"), so a ⌘-drag of an item
  with marks takes the marks along, as a plain drag does.
- **Touch has no modifier.** A long press that lifts the item (see 3) is the
  touch spelling of ⌘-drag. It's a later step.

**Smaller doors that go with it.** Both surfaces should be able to do the same
things, so:

1. ***Move to canvas*** in the context menu beside *Remove from group*. This is the
   web door for `toRoot`, which only the CLI has today.
2. **⌘⇧G on a member takes it out**, the way ⌘⇧G on a group ungroups it. It's
   the same intent at the next level down.
3. **`isocan mv <item> --out [--to-root]`** for agents, the twin of
   `mv --in`. `group remove` already does the work; `mv` is the verb an agent
   reaches for.

## 2. Stacks

**The proposal.** A group can be shown **stacked**, as a pile of cards: one
card upright on top in the middle, and the other members behind it, each turned
and nudged a little, so their edges show on every side. It looks like a
hand-squared stack of playing cards, a slightly messy rectangle, rather than a
neat offset. Hover fans it into a hand; click opens it. Stacking is a toggle on
the group's title band (*Stack* / *Spread*), with a CLI twin.

**What it looks like** (the prototype draws exactly this):

- **At rest:**
  - The top card sits upright at full size. Behind it are up to six more
    members, each turned between 3° and 9° either way and nudged up to about
    17 px in any direction.
  - Each card behind is tinted lightly with its own colour, so the rim of the
    pile says what is in it: *these things* rather than *more of this thing*.
  - A count badge sits on the corner.
- **The mess is seeded, not random.** Each card's turn and nudge come from a
  hash of its item id. The same pile looks the same to every viewer, never
  reshuffles on a re-render, and nothing about it is stored.
- **It can't be mistaken for a version stack.** That one is blank plies stacked
  neatly 5 and 10 px down-right; this is coloured, turned and centred.
- **Hover:** the pile **fans** into a hand of cards. It spreads in an arc about
  its bottom centre, with the top card staying in the middle, cards alternating
  left and right at 9° and 26 px a step, over 200 ms on the item-arrival curve
  (`cubic-bezier(.2,.7,.2,1)`).
  - Titles sit at each card's outer edge, so all of them read.
  - Pointing at a card lifts it with the drag shadow from 3, which says "you
    could take this one".
  - This is the macOS Dock's *fan*, sized for a canvas
    ([Stacks](https://en.wikipedia.org/wiki/Stacks_(Mac_OS))).
- **Click:** the stack **opens** into a grid in front of the canvas, a temporary
  view behind a scrim that Esc closes. That is the Dock's *grid* mode. Each card
  can be ⌘-dragged out to leave the group (1), and a plain click selects or
  peeks it. Nothing on the canvas moves while it is open.
- **Reduced motion:** fan and open happen without the transition. The positions
  are the same.

**The decision underneath: shared or per-viewer?** *Recommend shared.*
Stacking a group is an arrangement, like squaring a pile of paper on a shared
desk, and a stack one person sees and another doesn't is a canvas two people
describe differently. So it is a `GroupLayout` field (`display: "stack"`), set
with the existing `group.change` `layout` action, so it is one undo with no
new op type. Fanning and opening are per-viewer and never written.

**Members keep their spread positions.** Stacking draws them at the stack, and
leaves `x`/`y` untouched. *Spread* puts every member back exactly where it was,
and an agent reading positions reads the truth. That is the invariant to
test.

**What a stack must still do:**

- **Dropping onto a stack adds to the group.** The drop-target outline works
  unchanged on the stack's footprint.
- **Agents see it.** `isocan canvas group show` says
  `stacked`. `isocan canvas group stack <group> [--spread]` is the verb.
  Addressing a member by name still works. Placing into a stacked group places
  in spread space, so spreading shows it where it was put.
- **It's cheaper to draw.** Only the top card renders its content; the edges
  are a strip and a title. A 40-item stack costs one card and four edges,
  where today it costs 40 cards. The frame census
  (`scripts/frames.mjs`) should hold that.
- **The frame's footprint shrinks while stacked.** Nothing on the canvas
  reflows, and isocan never reflows, so a stacked group simply occupies less.
  Spreading takes the original footprint back. If something has been placed in
  that space meanwhile, the spread group overlaps it, exactly as dragging a
  group there would. That is honest and needs no rule.

**Later, not now:** a stack chosen automatically at low zoom, which belongs
to semantic zoom (#203); and choosing which member sits on top. In the first
version the top is the first member, the order `groupDescendants` already gives.

## 3. The lift

**The proposal.** While an item is being dragged, it wears a new shadow token,
`--shadow-lift`: deeper and softer than `--shadow-card`, offset down, in both
themes. **Its size and its position do not change**. Physically a picked-up card
would look bigger, being nearer to you, but then you could not see where it will
land. Dion's point stands, and it matches the motion note's rule: "Nothing for
items being dragged by hand. Their position is a fact"
(`docs/research/2026-08-28-motion.md:115`). A shadow is decoration (kind 1 in
that note), so it moves nothing.

The values the prototype uses:

| | light | dark |
| --- | --- | --- |
| `--shadow-card` (today, at rest) | `0 1px 2px α.08, 0 10px 24px -14px α.28` | black `.4 / .7` |
| `--shadow-lift` (proposed, dragging) | `0 2px 4px α.10, 0 22px 44px -14px α.38` | `0 2px 4px α.5, 0 24px 48px -12px α.85` |

Two stacked shadows, a tight contact one and a soft ambient one: the same
construction as Material's interactive elevations, which reserve their highest
levels for dragged things
([elevation](https://m3.material.io/styles/elevation/applying-elevation)).

**How it behaves:**

- **It lifts only once the press has become a drag** (past the 3 px threshold), so a
  click never flickers a shadow.
- **It eases in over 120 ms and settles over 160 ms on release.** The settle is
  what makes a drop read as *put down* rather than *let go*. Reduced motion
  swaps instantly.
- **`opacity: 0.92` comes off.** The shadow now says *moving*, and a
  translucent card is harder to read exactly when you are placing it.
- **When a group is dragged, the frame lifts and its members don't.** Twenty
  lifted cards inside a lifted frame read as mud.
- **A layer in a fanned stack uses the same token on hover.** One meaning
  across the app: *lift* means *you could take this*.
- **Not Trello's tilt.** Trello rotates a dragged card by direction and speed
  ([the mechanics](https://uxdesign.cc/how-to-fix-dragging-animation-in-ui-with-simple-math-4bbc10deccf7)).
  It's charming on a list, and wrong on a canvas where an item's edges snap to
  guides: a tilted card's edges are not where its box is.

**What it costs.** One token in both theme blocks, which `test/tokens.test.ts:77`
requires; one rule change at `styles.css:1240`; and the transition. It's the
smallest of the four and the right first step.

**Found beside it:** `components/questionnaire.css:11` has `box-shadow: 0
12px 32px -8px var(--shadow-pop)`. That puts a whole shadow where a colour
belongs, so the declaration is invalid and the questionnaire has no shadow at
all. It's a one-line fix, not done here.

## 4. Others see the drag, live

**The proposal.** A drag in progress travels to other viewers on the
**presence** channel, beside the cursor that already travels there. It is never
sent as ops. Viewers draw the dragged items offset and lifted, tinted with the
mover's identity colour, following the mover's hand. Then the one real
`item.move` lands, exactly as today.

```ts
// added to the presence message (protocol.ts:401), only while dragging
drag?: {
  gesture: string;                   // one id per drag
  roots: string[];                   // the selection ROOTS, not the closure
  from: { x: number; y: number };    // the first root's position when the drag began
  dx: number; dy: number;            // the offset the mover SEES — snapped, so viewers see the same spot
  into?: string | null;              // the drop target the mover sees, if any
}
```

**Why this doesn't replay, and stays right under bad conditions:**

- **Presence is state, not a log.** The server keeps the latest message per
  session and nothing else (`server/src/presence.ts`). A viewer who arrives
  late gets where the drag *is*, never where it *was*. Nothing is stored, so
  nothing replays, and an undo or a history scrub never meets a drag frame.
- **A drag that has landed cancels itself.** A viewer draws the drag only while
  the item still sits at `from`. When the real move lands, the item is no longer
  at `from`, so the ghost disappears whatever order the two messages arrived in.
  The same check covers someone else moving the item meanwhile: their move wins
  and the ghost goes. No sequence number is needed, and no clock either.
- **The release race.** If the mover's last presence frame (no `drag`) arrives
  before the op, a naive viewer snaps the item back to `from` and then jumps it
  forward. So a viewer holds the last offset for up to about a second after
  the `drag` field disappears, until the op lands. Then it settles in place, with
  the shadow easing down, like the mover's own release. If no op comes (the drag
  was cancelled with Esc, or failed), the item glides home after that second.
- **The mover vanishes mid-drag.** Their presence goes stale and is dropped as it is
  today, and the ghost glides home. Nothing gets stuck "being moved" forever.
- **Motion as data.** Viewers interpolate the offset with the cursor's own lerp
  (0.22 for a person), the motion note's second kind. It is the same smoothing,
  so the item and the cursor carrying it move together, and dropped frames turn
  into smoothness rather than stutter.

**Will it scale?**

- **The bandwidth is small, and only while someone is dragging.** One offset per
  gesture, not per item. Roots, not the closure: dragging a group of 200 sends
  one id, and viewers expand descendants from their own copy of the canvas.
  Beyond about 50 roots (a big marquee selection), send the selection's bounding
  box instead and draw one lifted outline. At the existing 33 ms throttle a
  drag costs about 30 small messages a second per mover, already the cursor's
  budget.
- **Drawing is the real risk, and it has been measured.** On 26 Sep a
  collaborator dragging one item froze every viewer's canvas at two frames a
  second, through whole-canvas subscriptions, fixed to p50 33 ms
  ([frame budget](2026-09-26-frame-budget.md)). A remote drag at 30 Hz is that
  exact load again. So the ghost must be applied as a CSS `transform` written
  per item, outside React state, and the census in `scripts/frames.mjs` gets a
  "remote drag" case before this ships, not after.
- **Many movers at once** each send their own drag; viewers draw each in its
  mover's colour. Two people dragging the same item is already settled by
  whose op lands last, and each ghost cancels against `from`.

**What it costs.** One optional field in the presence message and its relay,
plus a viewer-side store keyed by gesture with the `from` check, the hold-on-release
and the stale timeout. No new op, no change to the log, no change to undo.
Agents do not drag; their moves are instant ops and keep arriving as today.

## Order, and what each needs

1. **The lift (S).** One token, CSS only. Checked by eye in both themes, which
   the prototype already shows. Nothing waits on it.
2. **⌘ takes one item (M).** Hover preview, ⌘-click, ⌘-drag with *Out of …*,
   *Move to canvas*, ⌘⇧G on a member, and `mv --out`. No op change. It is
   driven in a real browser before it is called done, because a drag is the
   thing a unit test can't prove.
3. **Live drag for viewers (M).** Presence field, viewer store, and a
   frame-census case first.
4. **Stacks (L).** A `GroupLayout` field, render, fan, open, CLI verb,
   agent-guide line. It reuses 1–3: the lift on a fanned layer, ⌘-drag out of
   an open stack, and a stack's top card moving live for viewers.

**Decisions for Dion:**

1. **Stacks shared or per-viewer?** I recommend shared.
2. **⌘-drag out lands where?** I recommend wherever the pointer is: another frame,
   or the canvas, never "one level up". The pill names it before you let go.
3. **Should a plain drag ever detach?** I recommend no. Keep the frame-grows rule,
   and keep ⌘ as the one deliberate way out.
