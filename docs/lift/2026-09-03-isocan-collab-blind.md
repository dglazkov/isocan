# Skill lift — isocan-collab (blind)

Measured 2026-09-03. Same fixtures, same prompt, same tools and turn budget (25); the skill is the only difference. **Blind**: the prompt does not say where the work is — the agent has to find the comment on its canvas. Every cell 3 times. Not a score.

| | without | with |
| --- | --- | --- |
| runs | 6 | 6 |
| **fires** — the item gained a version | 6 | 6 |
| **helps** — canvas version passes its golden task | 6 | 6 |
| the file passes (whatever reached the canvas) | 6 | 0 |
| **costs** — mean turns | 23.2 | 14.7 |
| mean $ | 1.03 | 0.99 |
| mean seconds | 105 | 92 |
| model, as reported | claude-opus-5[1m] | claude-opus-5[1m] |

## Every run

| task | kind | condition | run | landed | replied | canvas | file | turns | $ | s | stop |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| revise-heading | revise | without | 1 | yes | yes | 5/5 ✓ | 5/5 ✓ | 23 | 1.21 | 118 | completed |
| revise-heading | revise | with | 1 | yes | yes | 5/5 ✓ | 3/5 | 14 | 0.94 | 65 | completed |
| revise-heading | revise | without | 2 | yes | yes | 5/5 ✓ | 5/5 ✓ | 24 | 1.04 | 129 | completed |
| revise-heading | revise | with | 2 | yes | yes | 5/5 ✓ | 3/5 | 14 | 1.02 | 75 | completed |
| revise-heading | revise | without | 3 | yes | yes | 5/5 ✓ | 5/5 ✓ | 23 | 0.96 | 98 | completed |
| revise-heading | revise | with | 3 | yes | yes | 5/5 ✓ | 3/5 | 16 | 1.03 | 201 | completed |
| arrange-sections | arrange | without | 1 | yes | yes | 3/3 ✓ | 3/3 ✓ | 21 | 0.95 | 97 | completed |
| arrange-sections | arrange | with | 1 | yes | yes | 3/3 ✓ | 2/3 | 14 | 0.98 | 72 | completed |
| arrange-sections | arrange | without | 2 | yes | yes | 3/3 ✓ | 3/3 ✓ | 22 | 0.97 | 95 | completed |
| arrange-sections | arrange | with | 2 | yes | yes | 3/3 ✓ | 2/3 | 14 | 0.90 | 61 | completed |
| arrange-sections | arrange | without | 3 | yes | no | 3/3 ✓ | 3/3 ✓ | 26 | 1.06 | 94 | max_turns |
| arrange-sections | arrange | with | 3 | yes | yes | 3/3 ✓ | 2/3 | 16 | 1.04 | 79 | completed |
