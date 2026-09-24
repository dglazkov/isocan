---
status: partial
since: 2026-09-23
see: wireframes, judge, design-partner, slides, modules
note: the ideal, as scenes. A person asks for wireframes; a blue-on-white skeleton appears at once and fills as Jev chooses blocks; variations sit beside each screen; the person marks the screens to keep; a clickable prototype is assembled from them with the obvious transitions already wired. Phase 0 closed 23 Sep 2026 — the catalog (18 archetypes, 28 blocks, 22 primitives, 49 intents) draws as blueprint and as wireframe, and `isocan wire render` places a screen; Phase 1 closed the same day — `isocan wire "<request>"` has Jev compose a flow skeleton-first in 7–11 s for about $0.001, one undo per flow. Phase 2 closed the same day — variations sit under each screen where Jev was unsure, and 📐 keeps a screen from the CLI, the menu or ⇧K. Phase 3 closed the same day — `isocan wire prototype` assembles the kept screens into one clickable app with the obvious transitions, missing screens dashed and named. Phase 4 closed the same day — `wire style` restyles every wire into the governing design system (Jev maps its tokens onto the wire's roles), one undo, blueprints staying blue. Phase 5 closed the same day — `/wire` in the Chat does all of it from the canvas through the home's key, walked on isocan.io. Phase 6 measured Jev against 1,318 labelled screens: a third right, overconfident by ~0.4 — so round 1 should over-include and let keep prune. Phase 7 fills wires with sample content from a pack Jev picks; phase 8 made the arrows true, clickable arrows, drew each wire as just the screen, lit prototypes on the minimap and put `/wire` acts in the Chat — both built, their isocan.io walks after the promotion.
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

## 6. In your design system

The canvas has a design system — a `DESIGN.md` Priya imported from her
team's tokens. Until now the wires were the default look: greys, one dark
primary, system type. She chooses the system (or it already governs the
canvas, or the group the flow sits in), and every wire changes: the primary
button takes the brand colour, the type is the brand's, corners and spacing
follow its scale. The blueprints stay blue — blue means *still being drawn*,
in any system. Undo, and they are all grey again; one undo, because it was
one act.

A flow asked for on a canvas that already has a system arrives in it.

```
isocan wire style                 # restyle every wire to the governing system
isocan wire style --default       # back to the default wire look
```

**What the scene forces:** a wire's look is a theme applied to the same
spec, never a different screen; the theme comes from the governing design
system when there is one; mapping a system's tokens onto the wire's roles
is a typed choice (which of *these* colours is the primary action?) — Jev's
kind of question, never an invented colour; restyling is one op group, and
each screen gains a version rather than being replaced.

## 7. Fleshed out

The walk's screens are honest and a little bare: grey bars where the words go.
Priya says `/wire flesh`. Every wire fills with believable content for *this*
app — the deliveries list shows "Parcel 4471 · 3 items · Out for delivery",
"Parcel 4478 · 1 item · Awaiting scan"; the home stats read "12 today · 3
late"; image slots show little greyscale pictograms of parcels; the people are
first names with initials in their avatars. It is still a wireframe — grey,
or her design system's colours — but it reads like the app. The prototype
clicks through the same content. An agent can then write the exact words for
the screens that matter.

**What the scene forces:** sample content is chosen, not invented (a pack Jev
picks, overridable); it is stable across restyles, variations and the
prototype; exact copy is an agent's or a person's, never the typed model's.

## 8. It is still an ordinary canvas

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
5. A theme layer: the default wire look, or the governing design system's
   tokens mapped onto the wire's roles (Jev chooses the mapping).
6. Sample content from packs Jev chooses, seeded per screen, and exact copy
   left to an agent.
7. No new operation.
