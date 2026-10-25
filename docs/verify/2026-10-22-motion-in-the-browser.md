---
status: unverified
since: 2026-10-22
never: "a person animating a drawing of their own in the browser and judging whether the motion feels right — whether parts turn where they should, whether the timing reads, and whether the movie they download is the thing they watched; motion phase 3"
needs: "the web app with Motion ticked in Settings → Experiments, a canvas with two or three SVGs of your own (a logo, an icon set, a drawing), and `isocan rc` running with an agent you are happy to spend a turn on — fifteen minutes"
---
# Motion, in the browser

**What you need:** isocan open in a browser on a canvas with two or three
SVGs you made or chose, **Motion** ticked in Settings → Experiments, and
`isocan rc` running in a terminal with an agent parked. Fifteen minutes.

**Why this page exists.** Motion was built and proven end to end in a real
browser, but by a script: the drawings were a made-up logo, the agent that
wrote motion from words was a scripted stand-in (one real turn ran, from a
terminal), and "it looks right" was checked by pixel counts. Only a person
can say whether a motion *feels* right.

---

1. Select your SVGs, right-click → **Animate…** → **assemble**.
   **You should see** a motion item appear beside them and play: the parts
   arrive one after another, then settle. **Check:** does each part turn
   or grow from where you would expect (its base, its hinge), or from its
   middle?
2. Scrub the player to a moment you want to change, press **⇧C**, and leave
   a comment there.
   **You should see** the comment say *at 1.2 s* (or wherever you were).
   Scrub away, then open the comment: the player goes back to that moment.
3. **Animate…** again, this time typing how it should move in your own
   words, and **Ask** your agent.
   **You should see** a new motion from the agent within a minute or two.
   **Check:** did it do what you said? Where it didn't, was it a reasonable
   reading of your words?
4. Say "slower" (or anything) about it in the Chat.
   **You should see** the motion gain a version; flip between versions.
5. **Render movie…** → MP4.
   **You should see** a video item beside the motion. Download the MP4
   and play it outside isocan. **Check:** is it the motion you watched —
   same timing, nothing cut, nothing extra?
6. **Animate…** with each of **reveal**, **orbit** and **emphasis**.
   **Check:** does orbit's small drift and lean read as alive rather than
   as something moving you have to watch, and does emphasis's pulse say
   *look here*?
7. **Render movie…** → **WebM**, and play it outside isocan (Safari, a
   Slack message, a slide). Do the same with the GIF. **Check:** does the
   GIF of your drawing show banding where it has gradients or many colours,
   and do its 30 fps default and size refusal read sensibly?
8. Optional: edit one of your SVGs (a new version), then **Refresh from
   sources** on the motion.

## Writing it down

What felt right, what did not, and which part moved wrongly and how. Set
this page's front matter to `works`, or `broken` with an issue, and add a
line under motion phase 3 in [phases.md](../projects/motion/phases.md).
