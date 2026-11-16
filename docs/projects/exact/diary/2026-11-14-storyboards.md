# 2026-11-14 — tests as storyboards (isocan exact phase 5)

A canvas (isocan) draws each `test` block as a storyboard: the steps as
written, and per host a frame per step. **Run** is Exact's own `test <host>`
on a copy of the one test with `screenshot <file>` after every step; a red run
gets the driver's `tree` from a cold `agent <host> --json` replay up to the
failing step. **Verify** is `verify <host> --json`. **Record** (Drive mode)
reads `state` before and after the recorded presses and proposes `expect`
lines from what moved; the test is written only on the person's Keep.

The fixture gained `checkout.test.contract`, and for one run a planted bug:
`place-order`'s testId became `submit-order` when `engine.name == "hermes"`
and `exactViewport().pointer == "fine"` — Hermes with a precise pointer, so
macOS only (iOS is `coarse`, the web runs no Hermes). Removed afterwards.

## Rough
- `test` has no `--json` and no per-step reply: a frame per step needs a copy
  of the test with `screenshot` lines, and its failure lines then name the
  copy's lines, which a tool maps back.
- The tree at a failure needs a second cold drive (`agent --json` replay).
- `expect state cart == ["1"]` is a syntax error: literals are number,
  string, bool, none and `[]`; a recorder writes `cart.0 == "1"` instead.
- `verify --json` names test-end shots by test name, not route; its desktop is
  1280×900; and macOS has no leg.
- Telling iOS from macOS took `exactViewport().pointer`; nothing names the
  host (rightly discouraged, but a planted bug had to find a way).

## Lean in
- Inserting `screenshot` steps did not change a verdict on any host; frames
  are deterministic across runs (web and macOS frames repeat byte-for-byte).
- The failure line ("no view matches place-order …; targets here: buyer-name,
  submit-order …") is exactly what a storyboard needs to show.
- `verify web`'s first-screen shots were byte-identical to the canvas's own
  captures of the same screen.

## Needed
- `test --json`: one reply per step, the tree on failure (by hand: screenshot
  lines + a replay)
- list literals in `expect state` (by hand: by entry)
- a route beside each `verify` check's shot (by hand: only the first screen is
  placed)

## Checkpoints
- one 13-step checkout test with a frame per step: web ~8 s, iOS ~43 s, macOS
  ~16 s; run on all three from the canvas ~67 s
- recording on the web (two presses, a state read before and after): ~4 s
- `verify web` ~25 s, `verify ios` ~80 s
