---
status: unverified
since: 2026-10-01
issue: 257
never: "whether a designer pack makes an agent's work recognisably that designer's — design-competition phase 0, owed since 13 Sep"
needs: "three people who know the Kare, Rams and Linear packs, about forty minutes each; someone (or an agent) to run three bouts beforehand"
---
# Can anyone tell whose entry is whose?

**What you need:** three people who have read the roster — the Kare, Rams and
Linear cards in [`packs.md`](../projects/design-competition/packs.md) — and
nine finished entries, which part one produces. The people need no repo and no
CLI; they need a screen and a pencil.

**Why this page exists.** The design competition is built: `isocan
competition` lays an arena, casts one agent per designer pack, and counts
votes. Every later phase — standings, remix, bring-your-own-fighter, picking
the model as well as the designer (#262, #263, #276) — assumes the packs make a
difference you can SEE. Nobody has checked. If three people cannot tell *Road
Signs* (Kare) from *Less but Better* (Rams) better than chance, the packs are
adjectives, and that is cheaper to learn now than after another phase is built
on them. This is [phase 0](../projects/design-competition/phases.md#phase-0--a-bout-by-hand-and-two-numbers).

---

## Part one: three bouts (an operator — an agent can do this part)

1. On a scratch canvas, run one bout per brief:

   ```bash
   isocan competition new "a checkout for a plant shop" --fighters kare,rams,linear
   ```

   ```bash
   isocan competition start
   ```

   Then `isocan competition status` until all three lanes have handed in.
   Repeat with two more briefs of your choosing — different enough that a
   style has to survive a change of subject.
2. **Write down the cost** of each bout: turns and tokens from the rc's own
   accounting. That is the second number phase 0 owes; the picker will quote
   it before Fight.
3. Note, while it runs: does each fighter stay in its lane? Does a critique in
   a rival's lane wake the rival? Does bare `isocan design --css` still print
   the canvas's own system?
4. Export the nine entries as images. Strip every label, number them 1–9 in a
   shuffled order, and keep the key somewhere the judges cannot see it.

## Part two: the matching (three people, separately)

5. Give each person the nine images and the three cards. Ask one question per
   image: **which designer made this?** No discussion between judges.
6. Score: correct matches out of 27 per person. **Chance is 9.**

**You should see:** clearly better than chance — most people getting well
over half right. **If they are near 9:** the packs are not distinctive, and
the next work is pack content (phase 2), not features. That is a result, not
a failure — write it down.

## Writing it down

Record the three briefs, both numbers and what changed in the packs because of
them in `docs/projects/design-competition/phase-0.md` (the phase's
acceptance), then set this page's front matter to `works` — or `broken`, with
the issue, if the machinery itself got in the way.
