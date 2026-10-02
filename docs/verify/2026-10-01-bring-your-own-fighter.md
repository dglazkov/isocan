---
status: unverified
since: 2026-10-01
issue: 263
never: "a teammate's own designer pack, published from their git repo, showing up as a tenth fighter and fighting — design-competition phase 6, owed since 13 Sep"
needs: "a second person with their own GitHub repo and a DESIGN.md they like; thirty minutes, both of you at a terminal"
---
# Bring your own fighter

**What you need:** two people. **The author** writes a pack and pushes it to a
GitHub repo of their own. **The host** has a canvas, the `isocan` CLI and
`isocan rc` running. Thirty minutes.

**Why this page exists.** A pack can be written and added from a directory,
and the synthetic tests prove it. What has never happened is the real path:
somebody who is not on this repo makes a fighter, publishes it the way they
would publish anything, and somebody else installs it and watches it fight.

---

## The author

1. Write a pack from a `DESIGN.md` you already have (any design system you
   like — your own, not a famous designer's):

   ```bash
   isocan competition fighter new "My House Style" --design ./DESIGN.md --self --out ./my-house-style
   ```

   `--tagline`, `--avatar` (an SVG emblem) and `--ref` are optional; see
   `--help`.
2. Push `./my-house-style` to a GitHub repo and send the host its
   `github:owner/repo` spec.

## The host

3. Add it:

   ```bash
   isocan module add github:owner/repo --yes --proposed
   ```

   **You should see** it described as *data only — runs nothing*. If it says
   anything else, stop: that is a bug.
4. List the roster:

   ```bash
   isocan competition fighters
   ```

   **You should see** the new fighter beside the built-in ones, with where it
   came from.
5. Open the picker in the Chat (`/design-competition`). **You should see** a
   portrait for it. Pick it and two built-in fighters, give a brief, Fight.
6. **You should see** it build in its lane like the others, using its own
   design system — not the canvas's and not a neighbour's.

## Writing it down

Whether the author could write the pack without asking anyone, and whether
the entry looked like *their* style. Set this page's front matter to `works`,
or `broken` with an issue.
