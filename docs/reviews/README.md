# Reviews

Standing reviews of this repo, by the four personas in
[`.claude/agents/`](../../.claude/agents/). Each one is a pass by somebody
whose only job is that lens: design, architecture, tests, and the market.

They exist because the work moves fast and the things that rot quietly —
a token nobody used, a test that asserts nothing, a dependency that stopped
being justified — are exactly the things nobody notices while shipping.

## How the memory works

Every run **reads before it looks**. The index below is the first thing a
persona opens, so a run in October knows what a run in August already
measured and can say "still true", "fixed", or "worse" instead of rediscovering
it. A finding that keeps reappearing across runs is a finding that needs a test,
not a third mention.

- **Findings** land here as `YYYY-MM-DD-<persona>.md`, newest first in the table.
- **[lessons.md](lessons.md)** is different and more valuable: the standing list
  of failure modes this codebase has actually produced, each with the guard that
  now catches it. It is append-only in spirit — a lesson leaves only when the
  thing it describes has become impossible.
- **Market research** goes to [`docs/research/`](../research/) instead, which
  already exists for exactly that and has its own index.

## What makes a finding worth writing down

The same bar the `/design-audit` command holds: cite the line, or the measured
value, or the command whose output you pasted. "Improve consistency" is not a
finding. "`--chip-hover` is declared in both themes and referenced nowhere
since 0e51081" is.

Say what is GOOD too, specifically. A review with no green is a review people
stop believing, and it is the half that tells you what not to break.

| Date | Persona | What it found |
| --- | --- | --- |
| [2026-08-23](2026-08-23-qa.md) | qa | Baseline. 63 mutations, **60 killed** — the reducer, inverses and per-actor undo stacks are genuinely guarded. Three real findings. `110027d` committed a live mutation into `packages/core/src/reducer.ts`, dropping `item.add`'s trash check, so **main is red** (fix in the working tree). Lesson #2's guard defined its own `nameOf` and imported nothing — reintroducing "null is working" left it 10/10 green; the rule now lives in `sessionName` and the test imports it (5 mutations, 5 killed), though seven other call sites still use the stamped name. The reducer's own "every mutation stamps updatedAt/updatedBy" was never checked — dropping `item.move`'s stamp was the one genuine survivor (now 13 mutations, 13 killed). `oneblock`'s count only sees a *second* bare rule: 2 mutations on the 57 classes that lack a canonical block survived the whole suite; partly closed with a derived modifier invariant. A no-op `discardUndoTarget` HANGS the suite instead of failing it — new `undo-stacks.test.ts` (10/10). All 45 skips are the emulator-gated cloud suites, correctly designed and CI-enforced. The daemon-takeover flake did not reproduce in 8 runs or under 3× CPU oversubscription, and the port hypothesis measured 0 collisions in 3,900 allocations; hardened anyway with a per-worker port range and failures that name their cause. |
| [2026-08-23](2026-08-23-design.md) | design | Baseline. The two worst app findings share one root cause: `--accent` is a FILL in dark and the app uses it as ink — 14 rules paint text at 2.5–2.9:1 on graphite, and the focus ring itself is 2.90:1 on nine of nineteen focusable controls (under SC 1.4.11's 3:1) while measuring 6.9–7.8:1 in light. `--accent-text` already exists for this. `color-scheme` is never declared, so scrollbars and native controls stay light in dark mode. Teal and Amber are 4.23/4.24:1 under their white initials. Spacing and radii still have no guard: 23 distinct spacing values (64% off the 4px grid) and 13 literal radii against 11 uses of `--radius`. Added `packages/web/test/accent.test.ts` (green, mutation-tested) to ratchet the 14. Marketing: the focus ring is 1.81:1 inside the closing band, and the crew chips wear four colours `IDENTITY_COLORS` does not contain — one of them the cobalt the product reserves. |
| [2026-08-23](2026-08-23-architecture.md) | architect | Isomorphism holds — every op the web issues, the CLI issues. But `surface.test.ts:49` matches substrings, so `session move` is registered and absent from the guide with the build green; nothing watches the web surface at all. Three computations duplicated across clients, one already divergent (a 5,200-byte file is "5.1 KB" in the CLI and "5 KB" in the files panel). `npm test` failed a different test in 2 of 3 runs. README drift in four places, one self-contradicting ("On call" vs #60). |
