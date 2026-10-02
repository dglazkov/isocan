---
status: unverified
since: 2026-10-01
issue: 261
never: "a whole design competition with real model-built entries — picked from the Chat, fought, voted from two browsers, the winner taken — on dev.isocan.io; design-competition phases 3–5.5, owed since 13 Sep"
needs: "two people in two browsers, a laptop with the released CLI parked against dev.isocan.io, about forty minutes and some model spend"
---
# A real bout, from the Chat to the winner

**What you need:** two people, each in their own browser, signed in to
<https://dev.isocan.io>. One of them has a laptop with the `isocan` CLI
installed from `#release` and signed in to the same home. Forty minutes.
Better after [can anyone tell whose entry is whose?](2026-10-01-design-competition-bout.md)
has been run — if the packs turn out indistinguishable, this walk is testing
the plumbing of a game nobody can win.

**Why this page exists.** Every part of the competition has been proved with
*synthetic* entries: the picker opens, an arena is laid, votes are counted,
the winner is copied. Nobody has watched three real model-built designs
arrive in their lanes, voted on them as a room, and taken one. That is the
whole product, and it has never happened.

---

## Before you start

1. On the laptop, start your agent runner and leave it running:

   ```bash
   isocan rc
   ```

2. Both people open the same new canvas on dev.isocan.io. Put one ordinary
   text card on it titled **Checkout** — the thing the winner will replace.

## The bout

3. In the canvas's Chat, type `/design-competition`. **You should see** a
   *choose your fighter* screen with portraits. Its Fight button must be
   enabled — if it says no agent runner is parked, step 1 is not running.
4. Pick three fighters, write the brief *"a checkout for a plant shop"*, and
   attach the **Checkout** card as the screen it is about (if the picker has
   no way to, write that down — it is a finding — and skip step 9). Note the
   cost the screen quotes, then press Fight.
5. **You should see** a Brief area and one lane per fighter appear, three
   agent cursors arrive, one in each lane, and entries start to draw. Nothing
   should land outside its lane.
6. When every lane says handed in (`isocan competition status` on the
   laptop), ring the bell:

   ```bash
   isocan competition bell --vote 10m
   ```

   Building should stop and the vote open.

## The vote

7. Each person, in their own browser, ranks the entries 🥇 🥈 🥉 and puts a 🔴
   on the part of one entry they would steal.
8. On the laptop, `isocan competition result`. **You should see** people's
   votes and the fighters' votes counted apart, the dots listed, and no
   fighter's vote for its own entry.
9. On the laptop, `isocan competition take`. **You should see** the
   **Checkout** card gain a new version that is the winning entry; the arena
   itself stays as it was.

## Writing it down

What the cost line quoted against what the rc actually spent, how long the
bout took, and anything that surprised you. Then set this page's front matter
to `works`, or `broken` with an issue, and say so in
[phases.md](../projects/design-competition/phases.md) under phases 3–5.5.
