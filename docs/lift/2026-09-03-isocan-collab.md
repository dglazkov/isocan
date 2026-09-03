# Skill lift — isocan-collab

Measured 2026-09-03. Same fixtures, same prompt, same tools and turn budget (25); the skill is the only difference. Not a score.

| | without | with |
| --- | --- | --- |
| runs | 4 | 4 |
| **fires** — the item gained a version | 4 | 4 |
| **helps** — canvas version passes its golden task | 3 | 3 |
| the file passes (whatever reached the canvas) | 3 | 2 |
| **costs** — mean turns | 21.8 | 17.8 |
| mean $ | 1.10 | 1.02 |
| mean seconds | 99 | 127 |
| model, as reported | claude-opus-5[1m] | claude-opus-5[1m] |

## Every run

| task | kind | condition | landed | replied | canvas | file | turns | $ | s | stop |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| revise-heading | revise | without | yes | yes | 5/5 ✓ | 5/5 ✓ | 21 | 0.97 | 80 | completed |
| revise-heading | revise | with | yes | yes | 5/5 ✓ | 5/5 ✓ | 18 | 0.63 | 63 | completed |
| create-empty-state | create | without | yes | yes | 5/7 | 5/7 | 20 | 1.08 | 98 | completed |
| create-empty-state | create | with | yes | yes | 5/7 | 5/7 | 26 | 1.44 | 282 | max_turns |
| repair-contrast | repair | without | yes | yes | 4/4 ✓ | 4/4 ✓ | 22 | 1.19 | 111 | completed |
| repair-contrast | repair | with | yes | yes | 4/4 ✓ | 2/4 | 15 | 1.20 | 100 | completed |
| arrange-sections | arrange | without | yes | yes | 3/3 ✓ | 3/3 ✓ | 24 | 1.17 | 105 | completed |
| arrange-sections | arrange | with | yes | yes | 3/3 ✓ | 3/3 ✓ | 12 | 0.80 | 61 | completed |

Read alongside `docs/projects/evals/plan.md` Stage 5: one run per cell; the
prompt named the canvas and the item, which is why "fires" cannot separate the
conditions here; the `create-empty-state` failures were the task's, and the
suite is v2 for it.

Checks the canvas version failed:

- create-empty-state · without: ≥ 1 × [data-state=empty]
- create-empty-state · without: header untouched
- create-empty-state · with: ≥ 1 × [data-state=empty]
- create-empty-state · with: header untouched
