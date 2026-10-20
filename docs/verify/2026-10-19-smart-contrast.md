---
status: unverified
since: 2026-10-19
never: Whether the ink on the canvas reads right to a person's eyes on every ground in both themes — the lifted periwinkle as "selected", black words with a glow on Desert, the glass plate under Desert's names, the crossfade when somebody changes the background — and whether anything that stands on the ground was missed.
needs: The web app in a desktop browser, a canvas you may change the background of (with three or four cards, a text note and a slide with speaker notes), twenty minutes, and ideally a second person on the same canvas for step 6.
---

# Smart contrast, by eye

**Status: `unverified`.**

**What you need:** a desktop browser, twenty minutes, and a canvas you do
not mind changing the background of. The home must be at or after the
smart-contrast phase 4 commit (19 October): dev.isocan.io once that commit is
green, or a local daemon on a current checkout. Put on the canvas three or four
cards, one text note made with the **T** tool, and a slide with a speaker
note (`isocan slides add`, then `isocan slides note`). A second person, or a
second browser window signed in as somebody else, helps for step 6.

**Why this page exists.** The names over cards, the kind icons beside them,
the words of a text note, a speaker note's caption and the selection ring
used to take their colour from the app's light/dark setting. The canvas's
background does not follow that setting. Now they take it from the
background instead. Every one of those colours is measured against every
background (`groundcontrast.test.ts`), and a headless-browser journey reads
them off the page (`scripts/journey-smart-contrast.mjs`). **Neither can say
whether the result looks right**: whether the lighter blue still reads as
"selected", whether black words on sand look intentional, whether the plate
looks designed or patched on. Two calls were made by the builder without a
person, and this walk is where they are confirmed or overturned (design.md,
"Decided by the conductor").

**Where the setting lives.** The app's theme: ··· → Settings (or your
system's light/dark). The background: ··· → **Background**.

---

## 1. The screenshot that started it

Dark theme, any dark background (Space Galaxy or Night). Click a card.

**You should see:** the name above the card turns a light periwinkle blue,
plainly readable, not a dark blue that sinks into the background.

**If the name is hard to read,** or the blue no longer says "selected" to
you, say which.

## 2. Snow, in dark mode

Still in the dark theme, choose **Background ▸ Snow**.

**You should see:** within about a fifth of a second, every name, kind icon,
text-note word and the speaker-note caption turn dark. The cards stay dark
grey, because they follow your theme. The selected card's ring and name turn
a deep navy.

**If anything on the snow is still light grey or white,** say what it is.
That is something the inventory missed.

## 3. The other way round: Galaxy in light mode

Switch the app to the light theme and choose **Space Galaxy**.

**You should see:** white cards with dark words inside, and light names and
notes on the dark sky outside them.

## 4. Desert, the one in the middle

Choose **Desert**, in both themes.

**You should see:** each card's name, with its icon, sitting on a small
frosted pill. A text note's words in black with a soft white glow, readable
over the dark streaks of the sand as well as the light ones. The selection
ring a deep blue.

**Say whether** the pill looks like part of the design or a patch, and
whether black words on sand look intentional. White was the other choice
(4.11:1 against black's 5.11), and it may simply look better to you.

## 5. Ocean and a photograph

Choose **Ocean**, then a photograph of your own: ··· → Background →
**A picture of yours…**.

**You should see:** light names and notes on both. The selection ring and
the selected name are the light periwinkle, the same on every dark
background.

## 6. Somebody else changes the background

With a second person or window on the same canvas, have them pick
**Snow**, then **Night**.

**You should see:** your names and notes crossfade along with the background
on your screen, with nothing to click. Undo puts the old background back, and
the ink follows.

## 7. The plain canvas

Choose **Background ▸ Clear**, in both themes.

**You should see:** exactly what the canvas looked like before this work.
A selected name in the dark theme is now the lighter blue from step 1. That
was the original fix, and it is the one intended change here.

---

## What this walk does not cover

- **Agents.** `isocan canvas background` says the tone, and a hex colour is
  warned about against the real background. A CLI test proves that.
- **Pictures under a lighter scrim.** Every picture is dark under today's
  scrim. Sampling is built and unit-proved for a day when that changes.
- **Reduce motion.** The crossfade is instant under it, and the journey
  proves that.
