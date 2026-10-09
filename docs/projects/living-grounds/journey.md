---
status: designed
since: 2026-10-09
see: groups-by-hand
note: "Living grounds: canvas backgrounds that answer the cursor — grass that parts where you walk, a starfield whose gravity your cursor bends, a night meadow where your cursor is a firefly. Everyone's cursor touches the ground, agents' included, and items rest on it. Drawn by a lazy WebGL layer that sleeps when nothing moves, so an idle canvas stays idle. Scenes here; the mechanism is design.md; the walk is phases.md."
---

# Living grounds — the scenes

**9 October 2026.** Dion, with a screen recording of another canvas tool whose
grass bends under the cursor: *"I really like this 'touching grass' effect. can
we have dynamic backgrounds like this where the cursor 'walks over' etc. Create
some others too such as having the space example where it's changing gravity...
or the cursor creating a firefly at night with lights behind etc.... probably
this is all using shaders etc? Please spec it out."*

isocan already has grounds: five themes (galaxy, ocean, mountains, farm,
desert) and a custom picture, set per canvas with `isocan canvas background`
and drawn as CSS behind the items. None of them move. These scenes are the
grounds that do. What makes them isocan's rather than a screensaver is scene
3: the ground is shared, so it answers everyone's cursor, the agents' too.

## Scene 1 — Walking on grass

Maya opens a canvas whose ground is **Meadow**. Under the screens is a field of
grass, dense and slightly stirring, as though there is a breeze. She moves the
cursor across it and the blades bend away from where it passes, then lift back
up behind it over a second or so, leaving a fading trail like footsteps. She
drags fast and the grass lies flatter, longer. She stops; within a few seconds
the field is still enough that nothing on screen is moving, and her laptop's
fan never notices it was there.

She zooms out to see the whole board. The blades thin into a textured green
that still parts, more broadly, under the cursor. She zooms in on one screen
and individual blades are there, crisp. Under each item the grass is pressed
flat in its shape, the way a sheet of paper flattens a lawn, so the items read
as resting on the field, not floating over a wallpaper.

## Scene 2 — Gravity in space

Ravi's canvas is **Orbit**: deep space, a few thousand faint stars and dust.
His cursor is a small mass. Stars near it drift toward it and swing past on
curving paths. He holds still and a slow eddy forms around the pointer. He
moves off and the field relaxes back to its drift. He holds the mouse button
down on empty canvas, a press he would make anyway to start a marquee, and the
cursor's pull reverses for as long as he holds: the stars flee. When he lets go
everything settles. The pull is strong enough to see and never strong enough
to pile every star on his pointer.

## Scene 3 — Somebody else walks by

Maya and Ravi are on the same Meadow canvas. Ravi's cursor crosses the far side
of the board, and Maya sees the grass bend under his cursor too, in his trail.
An agent, Scout, is working on a screen at the top; its cursor's small moves
leave small trails. The ground is a picture of who is here and where they
have been in the last few seconds. Nobody had to turn anything on.

## Scene 4 — Fireflies at night

**Night** is a dark meadow under a dim sky, with a band of soft out-of-focus
lights far behind, like a town across a field. Maya's cursor is a firefly: a
small warm glow that brightens as she moves and dims when she stops. Where it
passes, a few more fireflies lift out of the grass, drift up and wander off,
blinking, then fade after a while. On a canvas with four people there are four
fireflies hunting around, and a slow swarm of the ones they woke. Items on the
canvas catch a faint warm light when a firefly passes near.

## Scene 5 — Choosing, and calming it down

Dion right-clicks the canvas, picks **Background ▸ Meadow**, and everyone on the
canvas sees the field appear, the same as choosing Galaxy today. An agent sets
it from a terminal with `isocan canvas background meadow`.

Ana finds moving grass distracting while she reads. Her system's *reduce
motion* setting is on, so for her it is already a still picture of the meadow:
no sway, no trails. A colleague without that setting picks **Motion ▸ Calm**
in the background menu: the grass still parts under cursors but never sways on
its own. Their choices are their own; the canvas keeps its ground.

On a laptop with no WebGL, or one that is struggling, the ground is a painted
still of the same scene, and nothing else changes.

## What the scenes force

1. **A drawn layer, not CSS.** Thousands of blades bending under several moving
   points, particles under a force field, glows that light their surroundings:
   a GPU fragment and vertex program per ground, on a canvas element behind the
   items. Today's grounds are CSS backgrounds and cannot do this.
2. **The ground is the canvas's, the motion is each viewer's.** Which ground a
   canvas wears is shared and stored, as today (`theme`, set through
   `project.update`). The motion (trails, particles, sway) is computed in each
   viewer's browser from the cursors it can see, never stored and never sent.
3. **Every visible cursor is an input.** The viewer's own pointer, and the
   presence cursors of people and agents already on screen, feed one field the
   ground reads. Nothing new travels over the wire.
4. **Items press the ground.** Each item's rectangle is an input too: the ground
   is flattened, darkened or avoided under it, so items sit on the ground.
5. **It sleeps.** When nothing has moved for a few seconds the ground settles
   and stops drawing. An idle canvas must still pass `idle-at-rest` (15% main
   thread). Hidden tabs draw nothing.
6. **World or window.** A world-anchored ground pans and zooms with the items,
   with detail that thins out as you zoom out. A pinned ground stays put, as
   pinned grounds do today.
7. **Respect for attention.** Reduced motion gives a still frame. Each viewer
   can choose Calm or Still. No ground may lower the contrast of items over it
   below what today's grounds allow.
8. **Free on first paint.** Nothing about living grounds is in the entry chunk
   but the theme names. The layer and each ground load only on a canvas that
   wears one.
