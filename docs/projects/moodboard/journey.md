---
status: partial
since: 2026-10-16
see: design-partner, critique, keys, design-lint, design-competition
note: specified 16 Oct 2026; phase 0 PART-DONE the same day. Starting a design system from buttons and fonts asks a person to decide the smallest things first. A mood board starts from the largest — what the thing should feel like — with generated images that are deliberately not UI (light, material, texture, colour, the room the product lives in). A person keeps what moves them; the kept board sits on the canvas as inspiration; and the design system is derived from it, every token citing the image it came from. Built from what exists — the `gemini` key in `isocan keys`, the daemon's owner-only model routes, design-partner's references, the DESIGN.md direction record and `/design-system`'s "derive it from what is already there" — with two things new: an image route (`POST /api/image`, `isocan mood explore`), and swatches read from a kept image so the CLI can use colours it cannot decode. Phase 0 built the route and `mood explore` behind the `moodboard` experiment; its three real spreads wait on a Gemini key with billing. Phase 1 (keep, drop, more, push) is next.
---

# Mood board

This is the **ideal**: before anyone draws a button, a person should be able
to find out what the thing *feels like* — by reacting to pictures, not by
filling in a form — and then have that feeling carried, traceably, into the
design system and every screen built from it.

The mechanism is [`design.md`](design.md); the walk is
[`phases.md`](phases.md).

## The sentence

> **Explore the feeling, keep what moves you, and let the system be derived
> from what you kept — every colour can say which picture it came from.**

---

## Scene 1 — Maya has words, not a look

Maya is starting Acme Bakery's ordering app. The canvas is empty except for
a note: *"neighbourhood bakery, early mornings, flour on everything, not
twee."*

She opens **Design systems → Explore a look** (or types `/moodboard`, or an
agent runs `isocan mood explore`). She pastes the note's words and asks for
nine.

**She sees** a tray of nine images appear beside her note within a minute,
and none of them is a screen. A loaf on a steel bench under 6 a.m. window
light. A macro of flour on dark linen. A hand-painted shop sign in chipped
enamel. A colour field of crust, butter and oven-black. A paper bag folded
over, stamped once. Each tile says, in a line under it, what it was reaching
for — *light: low and cold, warming*, *material: enamel, paper, steel*.

**The point**: the pictures are about *feeling* — light, material, texture,
era, density, colour — the things a design system expresses, without anyone
having to name a font yet.

## Scene 2 — Keeping, discarding, pushing

Maya keeps four (a click, or `isocan mood keep`), and they move from the
tray onto the **board**, an area on the canvas called *Mood*. She drops
three. For the enamel sign she presses **More like this**, then **Push →
quieter**.

**She sees** four new tiles beside the sign, each a step from it, labelled
with the step taken. She keeps one. The tray never fills the canvas: what
she does not keep is gone when she closes the tray, and a tile she kept can
be dropped again like any item.

She also drags in a photo from her phone of the actual shop window. It joins
the board as a **reference**, not a generation, and *More like this* works on
it too.

**The point**: reacting is faster than specifying, and the board only ever
holds what a person chose.

## Scene 3 — The board becomes the system

With six tiles on the board, Maya opens **Design systems → Derive from the
board** (or `/design-system`, which now asks whether to derive from the board
when there is one).

**She sees** a DESIGN.md appear beside the board, governing the canvas. Its
palette is six colours, each with a chip that, when hovered, lights up the
tile it was read from: *crust #B5651D — from "loaf, 6 a.m."*. Its direction
says *typography: hand-lettered display over a plain grotesque, from the
enamel sign*; *density: generous, from the bag*; *treatments: one stamped
accent per screen*. The reasoning paragraph quotes her original note.

**The point**: nothing in the system is unexplained. A colour without a tile
is a colour a person can ask about.

## Scene 4 — Screens that answer to the board

Maya asks an agent for a checkout screen. It is built against the derived
system, as any screen is. She asks for a critique *with the board*, and a
critic whose lens is the board itself pins a note: *"Working — the stamp
accent. Risk — the total in blue: no tile has blue."*

**The point**: the board keeps working after the system is written, as the
thing to check the work against.

## What is not here

- **Generated UI.** The mood board makes pictures of a feeling, never
  screens; screens are what design-partner and the agents already make.
- **Taste by proxy.** No picture reaches the board without a person keeping
  it. An agent may run an exploration; it may not keep for a person.
- **Imitation.** Explorations are of light, material, colour and era — not
  "in the style of" a living artist or a brand, and never a real person's
  face or a logo. See [`design.md`](design.md) §6.
