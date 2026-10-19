---
status: partial
since: 2026-10-19
see: living-grounds, design-lint
note: "Smart contrast: everything isocan draws straight onto the canvas ground — an item's name, its kind icon, a selected name, a speaker note's caption, a chromeless text node — takes its ink from the ground it is standing on, not from the app's light/dark theme. Change the ground and the ink follows. Phases 0–3 are built: the ink on the ground follows its tone with a crossfade, Desert puts names on a glass plate, and pictures are sampled. Telling agents (the CLI) and a person's walk follow. Scenes here; the mechanism is design.md; the walk is phases.md."
---

# Smart contrast — the scenes

**19 October 2026.** Dion, with two screenshots of a slide on a dark canvas,
the selected slide's name drawn in a blue that all but disappears into the
ground: *"Can you spec out 'smart contrast' where colors change based on how
dark/light the colors are such as the background. So like in this case the
blue name isn't readable right now.... so instead a different contrast color
is chosen when the background is this dark. When a new background is chosen
the system takes a look and changes the contrast to match...."*

isocan has two kinds of surface, and only one of them knows which it is.
**Cards** are the app's: a white card in light mode, graphite in dark, and the
ink inside follows. **The ground** is the canvas's: a dot grid that follows the
app, or one of eleven grounds and any picture somebody uploads, which do not —
Space is dark whatever the app is wearing, and Snow is light. Everything drawn
*between* cards, straight onto the ground, still takes its ink from the app.
That is the bug in the screenshot, and it has a mirror image nobody has
reported yet.

## Scene 1 — The name you selected

Maya is in dark mode, on a canvas whose ground is near-black. She clicks the
first slide of a deck. Its name above the card turns from grey to the accent
— and the accent is a mid blue that measures **3.32:1** against that ground,
on eleven-pixel text that needs 4.5. She has to lean in to read the thing she
just picked.

With smart contrast, the selected name turns a lifted periwinkle instead. It
still says "this one, in the accent", and it reads at a glance. Nothing else
on the screen changed, and nothing should have.

## Scene 2 — Snow, in dark mode

Ravi works in dark mode and gives a canvas the Snow ground. Today every name
above every card, the kind icons beside them, and the words of every
chromeless text note are light grey and white — on a field that is nearly
white. A note reads at **1.19:1**: it is gone.

With smart contrast, the moment Snow lands, the ink on the ground crossfades
to dark, in about a fifth of a second. The cards stay graphite, because they
are his and he chose dark mode. The ground's ink is the ground's.

## Scene 3 — Somebody changes the background

Maya picks **Background ▸ Night** from the menu while Ravi is watching. On
both screens the field darkens and every name over it lightens with it, in
the same moment. Neither of them chose a colour, and nothing was written to
the canvas to make it happen: the ink is a fact about the ground, worked out
by each browser from the ground it is drawing. Undo puts Snow back, and the
ink goes back with it.

## Scene 4 — The ground in the middle

Desert is a warm sand that sits almost exactly in the middle: white text on
it measures 4.11, dark text 3.70. No ink passes. Rather than pick the
least-bad grey, the names over Desert sit on a small frosted plate — the same
glass the menus wear — and the ink is the plate's. It looks deliberate,
because it is: this is the one ground where neither answer is good enough.

## Scene 5 — A photograph

Dion uploads a photo of a beach for a canvas's ground. Under the scrim every
picture already gets it is dark, and the names over it read light. If a
later build lightens that scrim for pale pictures, the same rule takes a
look at the picture it is actually drawing and picks again — no table to
update, no person to remember.

## Scene 6 — An agent writes on the ground

Scout, an agent, is asked to leave a note beside a screen on a Night canvas,
in "amber". `isocan canvas background` has already told it the ground is
dark, and "amber" resolves to the amber that reads on a dark ground. When it
tries a raw hex instead, the CLI warns the way it does today — but measured
against Night, not against the app's page ground, which is a colour this
canvas does not have.

## What the scenes force

1. **A ground has a tone — dark, light, or mid — and it is derived, never
   stored.** It comes from the colour the ground is actually drawn in: the
   dot grid's is the app's; a seeded ground's is its measured mean; a
   picture's is sampled. Nothing new on the canvas, no new op, nothing to
   undo but the ground itself.
2. **The ink on the ground is its own tier of tokens**, separate from the
   ink inside cards. A card follows the app; the ground's ink follows the
   ground. Flipping the whole theme under a dark ground would turn every
   card graphite in light mode, which is a different bug.
3. **Every token in that tier passes on every ground it can land on**, and a
   test measures it — the same way `textcolour.test.ts` already holds named
   colours to 4.5:1 per surface.
4. **Mid is a real answer.** A ground where no ink reaches the floor gets a
   plate under its chrome, not a compromise grey.
5. **A ground change crossfades the ink**, instantly under reduced motion.
6. **Agents are told the tone**, and the CLI's colour warnings measure
   against the real ground.
