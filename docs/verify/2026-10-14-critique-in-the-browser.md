---
status: unverified
since: 2026-10-14
never: "a critique asked for and read by a person in the browser — whether two critics' pins can be told apart, whether the read is legible, and whether the whole thing feels like asking two colleagues; critique phase 4"
needs: "the web app with the Critique experiment on, `isocan rc` running on your machine with an agent harness you are happy to spend on (two critics, at most 6 turns and $0.40 each, plus one builder run), a canvas with one screen — twenty minutes"
---
# A critique, in the browser

**What you need:** isocan open in a browser on a canvas with one screen you
do not mind a critic looking at, **Critique** ticked in Settings →
Experiments, and `isocan rc` running in a terminal on your machine. Twenty
minutes.

**Why this page exists.** Critique was built and proven end to end in a
real browser, but by a script: the critics and the builder were a scripted
stand-in, and the clicks were aimed by code. Three things only a person can
judge: whether pins that sit near each other can be told apart, whether the
read says something a person can act on, and whether asking feels like
asking two colleagues or like filling in a form.

---

1. Open **Critics**, from ⌘K or a screen's right-click menu. Add *Inevitable*
   and *Form Follows Emotion*.
   **You should see** two cards appear on the canvas, each with three
   questions and a credit line.
2. Right-click your screen → **Critique with…** → tick both → **Ask**.
   **You should see** one thread open on the screen naming both critics,
   and within a minute or two, pins appear on the screen in two colours.
3. Click a few pins.
   **You should see** each note open where its pin is, saying *Working*,
   *Risk* or *Blocker*, which of the critic's questions it comes from, and
   one change. **Check:** can you tell two pins that sit close together
   apart, and do the two colours read as two people?
4. When both critics say they are done, open **The read** from the thread.
   **You should see** what they agree on, where they split, and any blocker.
   **Check:** is it something you could act on without reading every note?
5. If there is a split, press **Build both** and pick a builder.
   **You should see** two variations of your screen beside it, each saying
   which critic it answers, and your screen unchanged.
6. Optional: ask one of the critics, in the thread, to fix something.
   **You should see** it refused, with a sentence saying it may only leave
   notes.

## Writing it down

What felt right, what did not, and anything you could not tell apart. Set
this page's front matter to `works`, or `broken` with an issue, and add a
line under critique phase 4 in
[phases.md](../projects/critique/phases.md).
