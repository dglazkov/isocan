---
status: built
since: 2026-09-23
see: wireframes, judge, design-partner, slides, modules
note: the ideal, as scenes. A person asks for wireframes; a blue-on-white skeleton appears at once and fills as Jev chooses blocks, arriving with sample content for this app; screens Jev was unsure of are drawn marked maybe, and variations sit where its answer was split. The flow chooses its own first picks and ends with a clickable prototype above the row, which the person corrects with Use in prototype; true arrows show the flow on the canvas, every wire restyles into the governing design system, and each act leaves a record in the Chat. Phases 0–8 closed 23 Sep 2026 and were walked on isocan.io; the 24 Sep follow-ups — the maybe band, first picks with the prototype at the end, fleshed by default — are in the scenes. Five debts stay open in phases.md.
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

**And then it reads like the app** (24 Sep 2026). A composed flow arrives
fleshed — sample content from a pack Jev picked for this request (scene 7) —
unless she asked for `/wire basic`, which keeps plain grey wires. A screen Jev
was unsure the request needs is drawn in its place all the same, with a dashed
outline and a *maybe* tag: the flow over-includes and lets her prune, because
Jev's confidence ranks screens well and excludes them badly (phases.md,
phase 6).

The same act from the CLI:

```
isocan wire "a stock-receiving app for warehouse staff — sign in, scan deliveries, see what's outstanding"
```

prints each screen as it lands and the one line that says where they are.
From the Chat, the act leaves one message — the Wire builder's — saying what
was made and what it cost.

**What the scene forces:** a screen exists on the canvas before any model has
answered (a skeleton is a real item, not a spinner); it fills in place rather
than being replaced; both surfaces make the same screens from the same
request; a screen the model was unsure of is shown, marked, rather than
left out.

## 2. The words are real, or honestly missing

The buttons say *Sign in*, *Scan*, *Receive all*, *Back* — because each button
carries an **intent**, and an intent has a label. Headings come from the
screen's archetype. Body copy is never lorem ipsum: it is sample content
chosen from a pack (scene 7) or, in a basic flow, grey bars — Jev writes no
prose and the screen does not pretend it did. The exact words are an agent's
or a person's to write.

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

## 4. What goes in the prototype

The flow has already chosen (24 Sep 2026): every screen Jev was confident the
request needs has its first choice marked for the prototype (📐) — never a
*maybe*, never a variation — and the mark says the answerer put it there.
Priya corrects it the way she marks slides for a deck: the table version of
*Deliveries* instead of the cards, the *maybe* for *Settings* in after all.
The words say what the mark does — *Use in prototype*, *Remove from
prototype* — from the item's menu, ⇧K, or

```
isocan wire use <items…>
```

Anyone can take a mark off. Unmarked siblings stay on the canvas; nothing is
deleted.

**What the scene forces:** a keep mark is a property on the item (as a slide
is), not a reaction — a reaction belongs to the person who left it, so nobody
else could remove it — and it records who put it on, because a screen the
flow chose and one a person chose are different evidence.

## 5. The prototype assembles itself

`/wire` ends by adding one more item above the row, and *Make prototype* (or
`isocan wire prototype`) makes it again whenever she wants: the kept screens as
one clickable app. *Sign in* goes to *Home*. A delivery row opens
*Delivery*. The tab bar switches between *Home* and *Deliveries*. *Back*
goes back. The *Scan* button opens *Scan*. A hotspot whose target was never
kept — *Settings*, say — is drawn dashed and says which screen it needs.

On the canvas the same links are drawn as arrows between the screens — true
arrows that start at the hotspot and route over the row without crossing — and
an arrow can be clicked: *Play from here*, *Go to*, *Change target…*,
*Remove*. Put a screen in or take one out, and the prototype gains a version;
it is never replaced.

**What the scene forces:** links are computed from intents, archetypes and
canvas order, and only a person's own change is stored, per hotspot — so a
recompute never drifts and never loses a choice somebody made; the prototype is one
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

A basic flow's screens are honest and a little bare: grey bars where the words
go. Priya says `/wire flesh` — which a composed flow no longer needs, because
since 24 Sep it arrives this way. Every wire fills with believable content for *this*
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
takes back a whole *wire* request, its record in the Chat included. That
record says what was made and summons no agent. On a busy canvas the
prototypes light up on the minimap. Take the wireframes module away and every
screen still renders; only the verbs are gone.

**What the scenes force, together — the load-bearing minimum:**

1. A catalog of blocks and archetype recipes, as data, with a renderer that
   draws a spec as a blue skeleton (unresolved) or grey wireframe (resolved).
2. A composer that asks Jev in rounds and writes each answer into the screen
   in place.
3. Variations from the distribution; *maybe* screens where round 1 was
   unsure; a keep mark as a property that says who put it on, set first by
   the flow.
4. Link inference from intents and a prototype assembler, in core, so both
   surfaces produce the same prototype; a person's per-hotspot overrides
   stored beside it; arrows drawn from the same links.
5. A theme layer: the default wire look, or the governing design system's
   tokens mapped onto the wire's roles (Jev chooses the mapping).
6. Sample content from packs Jev chooses, seeded per screen and on by default
   for a composed flow, and exact copy left to an agent.
7. No new operation.
