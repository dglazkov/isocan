---
status: partial
since: 2026-09-23
see: wireframes, judge, design-partner, slides, modules
note: the ideal, as scenes. A person asks for wireframes; a blue-on-white skeleton appears at once and fills as Jev chooses blocks; variations sit beside each screen; the person marks the screens to keep; a clickable prototype is assembled from them with the obvious transitions already wired. Phase 0 closed 23 Sep 2026 — the catalog (18 archetypes, 28 blocks, 22 primitives, 49 intents) draws as blueprint and as wireframe, and `isocan wire render` places a screen; Phase 1 closed the same day — `isocan wire "<request>"` has Jev compose a flow skeleton-first in 7–11 s for about $0.001, one undo per flow. Variations and keep (phase 2) are next.
issue: 350
---

# Wireframes — the journey

Asked for by Dion on 23 September 2026: *when the user asks for wireframes,
use Jev to go through a series of wireframe components and show examples of
screens that put them together to match the prompt; show variations; when the
user tags a series of screens, assemble a prototype app from them, doing all
you can to make the obvious transitions.* And, the same day: *start with a
skeleton in the typical blue on white so it LOOKS like a wire is starting.*

These scenes are the acceptance suite. Mechanism appears only where a scene
forced it; [design.md](design.md) is the mechanism and
[phases.md](phases.md) the walk. The research under all of it is
[Wireframes a typed model can choose](../../research/2026-09-23-wireframe-components.md).

## 1. A wire starts

Priya types in the Chat, or an agent runs in a terminal:

> wireframes for a stock-receiving app for warehouse staff — sign in, scan
> deliveries, see what's outstanding

Within a second the canvas has a row of screens, each one a **blueprint**:
thin blue rules on white, a labelled box per slot — *app bar*, *main*,
*tab bar* — and the screen's name above it (*Sign in*, *Home*, *Deliveries*,
*Delivery*, *Scan*). Nothing is finished and nothing pretends to be. Then the
boxes fill, slot by slot, in grey: a sign-in form, a stats row, a list of
deliveries with a search field, a detail header with a table of lines. The
blue skeleton is how you know it is still being drawn; the grey is what was
chosen.

The same act from the CLI:

```
isocan wire "a stock-receiving app for warehouse staff — sign in, scan deliveries, see what's outstanding"
```

prints each screen as it lands and the one line that says where they are.

**What the scene forces:** a screen exists on the canvas before any model has
answered (a skeleton is a real item, not a spinner); it fills in place rather
than being replaced; both surfaces make the same screens from the same
request.

## 2. The words are real, or honestly missing

The buttons say *Sign in*, *Scan*, *Receive all*, *Back* — because each button
carries an **intent**, and an intent has a label. Headings come from the
screen's archetype. Body copy is grey bars, not lorem ipsum: Jev writes no
prose and the screen does not pretend it did. If an agent is present, it can
write the copy afterwards and the bars become words.

**What the scene forces:** actionable text is typed, never free; nothing
invents prose it cannot justify.

## 3. Variations where the model was unsure

Under *Deliveries* sit two siblings: one where the list is a table, one where
it is cards. Under *Sign in*, none — Jev was certain, and the screen says so
(*one way to draw this*). Variations are spent where the model's own
distribution was split, not sprinkled evenly.

**What the scene forces:** variations come from the distribution of the
first answer, not from asking again; a screen with no honest alternative
says so rather than inventing one.

## 4. Marking the keepers

Priya marks the screens she wants — *Sign in*, *Home*, the table version of
*Deliveries*, *Delivery*, *Scan* — the way she marks slides for a deck: a
mark on the item (📐), from the item's menu, a keystroke, or

```
isocan wire keep <items…>
```

Anyone can take a mark off. Unmarked siblings stay on the canvas; nothing is
deleted.

**What the scene forces:** a keep mark is a property on the item (as a slide
is), not a reaction — a reaction belongs to the person who left it, so nobody
else could remove it.

## 5. The prototype assembles itself

*Make prototype* (or `isocan wire prototype`) adds one more item: the kept
screens as one clickable app. *Sign in* goes to *Home*. A delivery row opens
*Delivery*. The tab bar switches between *Home* and *Deliveries*. *Back*
goes back. The *Scan* button opens *Scan*. A hotspot whose target was never
kept — *Settings*, say — is drawn dashed and says which screen it needs.

Change a kept screen and *Make prototype* again: the prototype gains a
version, it is not replaced.

**What the scene forces:** links are computed from intents, archetypes and
canvas order — never stored, so they cannot drift; the prototype is one
self-contained HTML item (it plays anywhere, as `deck.html` does); missing
targets are named, not silently dropped.

## 6. It is still an ordinary canvas

Every screen is an HTML item. Comment on it, draw on it, undo it — one undo
takes back a whole *wire* request. Take the wireframes module away and every
screen still renders; only the verbs are gone.

**What the scenes force, together — the load-bearing minimum:**

1. A catalog of blocks and archetype recipes, as data, with a renderer that
   draws a spec as a blue skeleton (unresolved) or grey wireframe (resolved).
2. A composer that asks Jev in rounds and writes each answer into the screen
   in place.
3. Variations from the distribution; a keep mark as a property.
4. Link inference from intents and a prototype assembler, in core, so both
   surfaces produce the same prototype.
5. No new operation.
