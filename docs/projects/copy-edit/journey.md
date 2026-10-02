---
status: designed
since: 2026-10-02
see: wireframes, version-diff, design-lint, judge
note: "A deep copy edit, as scenes: ask a screen for N voices of its words, see them side by side in the real screen, take a headline from one and a button from another, see which ones do not fit, keep the product's voice and words, and at wire time choose one voice for a whole flow. The design and evidence are docs/research/2026-10-02-copy-edit.md (#377)."
issue: 377
---

# A deep copy edit — the journeys

**2 October 2026.** The ideal, as scenes; the argument is
[the research note](../../research/2026-10-02-copy-edit.md). Acme content only.

## Scene 1 — Three voices for a screen

Mara selects the *Acme checkout* screen and chooses *Vary the copy…*, asking
for three. A moment later three variants sit beside it, each titled with its
stance — *Plain and direct*, *Warm*, *Benefit-first* — and a line saying why.
Every pixel that is not a word is the same as the original: same layout, same
classes, same images.

## Scene 2 — Side by side, then a mix

She opens the compare: all three, live, in the real screen. She likes
*Benefit-first*'s headline and *Plain*'s button. She picks per string, presses
*Use this mix*, and the original screen gets one new version with exactly those
words. One ⌘Z puts it back; the variants are gone, as *Choose this variation*
already does.

## Scene 3 — The one that does not fit

*Warm*'s button reads "Let's get you all set up and ready". The compare marks it:
two lines in a one-line button. She can still take it — the mark is a fact, not
a refusal.

## Scene 4 — The product's words

The canvas's DESIGN.md has a Voice section: plain, second person, *sign in*
never *log in*. The variants keep to it, and the copy lint flags a screen that
says *Log in* while its neighbour says *Sign in*.

## Scene 5 — A voice for the flow

After `/wire` fleshes a six-screen flow, Mara chooses *Choose a voice*: three
voices for the whole flow, previewed on the first two screens. She picks one and
every screen's words change together, buttons still bound to where they go.

## Scene 6 — An agent does it too

Rowan, an agent, runs `isocan copy <screen>` and gets the deck as JSON, writes
three voices, `isocan copy vary <screen> --from voices.json`, and comments which
it would keep — the same variants, the same compare, the same pick.

## What the scenes force

- A copy deck: strings with roles, stable addresses and layout budgets, from any
  screen; a string-level apply that refuses a stale address.
- Variants that splice words only, as `parent=` variations (no new op).
- An N-up compare with per-string choice, folded as one version.
- A fit check where screens render.
- A Voice section in DESIGN.md and a copy lint.
- Flow-wide voice at wire time, intents untouched.
