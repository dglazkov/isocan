---
title: "Evaluation scripts depend on unpinned external CLIs"
loop: df9a031e-f9fc-4f20-a896-1f206e88e872
loop_rank: P2
loop_state: ACTIVE
loop_goal: "Dependencies healthy"
decision: untriaged
---

# Evaluation scripts depend on unpinned external CLIs

> **Loop says** (P2): Core repository scripts invoke external CLI binaries directly without pre-flight binary checks, version constraints, or capability verification. Automation scripts spawn commands such as stitch, claude, gh, and docker directly on the process environment PATH. When these CLI tools are missing or mismatched across execution environments, scripts throw unhandled errors or produce unreliable evaluation results.

- `scripts/loop.mjs`
- `scripts/loop.mjs#L92`
- `scripts/converge-night.mjs#L118`
- `scripts/canvas-board.mjs#L415`
- `scripts/first-minute.mjs#L70`
- `scripts/calibrate.mjs#L128`

## Our read

Not yet checked against the code.
