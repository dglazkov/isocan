---
status: unverified
since: 2026-10-10
never: Whether the seven living grounds feel like what they are named for, whether their motion distracts from reading a card, and whether Full, Calm and Still are the right three, judged by a person's eyes and hand.
needs: The web app in a desktop browser with a mouse or trackpad, a canvas with a few cards on it, and twenty minutes. Reduce motion must be off in the system settings.
---

# The living grounds, by eye and hand

**Status: `unverified`.**

**What you need:** a desktop browser, a mouse or trackpad, twenty minutes, and
a canvas you do not mind changing the background of. The home must be at or
after commit `50d8a8152` (10 October): dev.isocan.io once that commit is
green, or a local daemon on a current checkout. Turn **Reduce motion** off in
the system settings first, or every ground is a still picture and there is
nothing to judge.

**Why this page exists.** Seven backgrounds now move under the cursor:
Meadow, Night, Space Galaxy, Snow, Aurora, Pond and Zen garden. What they do
is measured. A journey per ground proves it wakes when the pointer moves,
marks the place the pointer crossed, and is asleep within a few seconds of
the pointer stopping; `scripts/frames.mjs --grounds` proves none of them
drops a frame on the machine it ran on. **None of that says whether grass
feels like grass**, whether the motion pulls the eye off a card you are
reading, or whether a ground called Pond looks like one. Those were decided
by whoever wrote the shaders, looking at screenshots.

**The one trap.** How much a ground moves is a setting of yours, kept in this
browser: ··· → Background, at the bottom, **Motion**. It starts on **Full**.
If a ground does nothing in steps 1–4, look there before deciding it is
broken.

---

## 1. Put a canvas on Meadow

Open a canvas with five or six cards on it (add a few notes if it is empty).
Open the **···** menu, then **Background**, and choose **Meadow**.

**You should see:** the canvas sitting in a field of grass, drawn behind the
cards. The cards themselves are unchanged. With the pointer held still, the
grass stops moving within a few seconds.

## 2. Walk on the grass

Move the pointer slowly across bare canvas, then quickly, then in a small
circle, then stop. Then move it along the edge of a card.

**You should see:** blades leaning away from the pointer as it passes and
standing back up behind it, with a short trail that closes like grass and not
like a smear or a spotlight. Where a card sits, the grass is pressed flat
under it. The question is one word: **does this feel like grass?** Yes means
you would describe it to somebody as "the cursor walks through grass" without
being told that is the idea.

**If it reads as something else** (a ripple, a glow, a texture sliding), say
what it reads as, and whether slow or fast movement was the worse of the two.

## 3. Each of the other six, one at a time

For each row, choose the ground from ··· → Background, do what the row says
on bare canvas, and answer before reading the name again: **what is this
ground?**

| Ground | Do this | You should see |
| --- | --- | --- |
| **Night** | move the pointer across the dark, then rest it near a card | the pointer as a firefly; more fireflies waking along its path; grass lit where the light falls; the card nearest the light catching a warm glow |
| **Space Galaxy** | move, then rest for ten seconds, then hold the mouse button down | stars curving in toward the pointer; a slow swirl around it while it rests; stars scattering outward while the button is held |
| **Snow** | draw a line, wait five seconds without moving, then move somewhere else for a while | a trodden trail where the pointer went, still there after the wait, slowly snowed over while you move elsewhere |
| **Aurora** | move left to right across the top half, slowly | ribbons of light leaning toward the pointer and brightening near it; a card near the pointer catching some of the light |
| **Pond** | drag the pointer through the water; pass it near a fish | ripples spreading from the pointer's path and dying away; koi darting out of the way |
| **Zen garden** | draw two or three slow lines; look at the sand around a card | raked lines where the pointer went, softening over a few seconds; raked rings around each card, like a stone |

**You should see:** each one recognisable as its name within a few seconds of
moving, without the table. Yes for a ground means a person who had not been
told its name would guess it, or something near it.

**Write down any ground you would not have named**, and what you would have
called it instead. One ground reading as another (Snow as sand, Pond as
glass) is the useful answer here.

## 4. Night, in the dark

Choose **Night** again. Hold the pointer still until the ground stops, then
look at the bottom half of the screen without moving.

**You should see:** grass. Dark, but blades you can make out against the
ground, under a dim sky, before any firefly lights it. Then move the pointer:
the grass near the light should look like the same grass, brighter.

**If the ground reads as plain black** until the pointer lights it, that is
the finding. Say what screen you are on and how bright it is set; an earlier
build read nearly black at rest and was changed, by eye, on one display.

## 5. Read a card while the ground moves

Stay on Night, with Motion on **Full**. Open or zoom to a card with a few
paragraphs of text and read it for a minute the way you normally would: the
pointer resting beside the text, then moved now and then to scroll or select.
Do the same on **Aurora** and on **Pond**.

**You should see:** the words, and nothing pulling your eye off them. Yes
means that after a minute you could not say what the ground was doing while
you read. While the pointer rests the ground should have stopped (Space
Galaxy's swirl is the one exception, and it stops after about fifteen
seconds).

**If something drew your eye,** say which ground, and whether it was motion
you caused by moving the pointer or motion nobody caused. Those have
different fixes, and the second is what Calm exists for.

## 6. Full, Calm and Still

On **Aurora**, open ··· → Background and, at the bottom, set **Motion** to
**Calm**. Move the pointer, then rest it. Set it to **Still** and do the same.
Set it back to **Full**. Repeat on **Meadow**.

**You should see:**

- **Full:** the ground answers the pointer and also moves a little by itself
  for a moment after you stop.
- **Calm:** the ground answers the pointer and does nothing else. The instant
  you stop, it is settling and then still; nothing drifts.
- **Still:** a picture of the ground. Nothing answers the pointer.

Yes means you can tell the three apart by looking, the names fit what each
does, and one of them is a setting you would actually leave on. The cards and
everybody else's view should be untouched by the change.

**If Full and Calm look the same on a ground,** say which ground. If you
would want a fourth setting, or only two, say that.

## 7. The Background menu on a short window

Make the browser window short, about 600 pixels tall (a laptop with the dock
showing and devtools open is about this). Open ··· → Background.

**You should see:** about twenty rows, each with a small picture of its
ground that drifts when you point at it. The list scrolls inside the menu;
every row, and **Motion** at the bottom, can be reached without resizing the
window. Yes means you found the ground you wanted and the Motion setting
without hunting.

**If the menu runs off the screen,** if Motion cannot be reached, or if
twenty rows is simply too many to choose from, say which.

---

## What this walk does not cover

- **How fast it is on a slower machine.** The frame cost was measured on an
  M4 Pro; the budget names an M1 and nobody has run it on one. If a ground
  stutters for you, say what machine you are on.
- **Other people's cursors.** A second person's or an agent's cursor parts
  the grass too; a journey proves it, and whether it is pleasant with four
  people on a canvas is a different walk.
- **Reduce motion, and browsers without WebGL2.** Both show the still
  picture, and a journey per ground proves that.
- **A phone.** There is no pointer to walk with; nobody has decided what a
  living ground does under a finger.
