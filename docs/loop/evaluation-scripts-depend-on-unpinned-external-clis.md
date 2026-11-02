---
title: Evaluation scripts depend on unpinned external CLIs
loop:
  - df9a031e-f9fc-4f20-a896-1f206e88e872
loop_rank: P2
loop_state: ACTIVE
loop_goal: Dependencies healthy
decision: stale
rank: never
since: 2026-10-07
note: "Stale and by design: every cited script already handles missing or failing host CLIs gracefully (loop.mjs:779,815; first-minute.mjs:69-72; canvas-board.mjs:411-428; converge-night.mjs:118-121; calibrate.mjs:128-144), and host tools like docker, gh, claude, and stitch are environment binaries rather than npm-lockable packages."
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

Verified across all cited scripts: (1) scripts/loop.mjs:779 catches ENOENT when spawning claude and returns a clean skipped message, and scripts/loop.mjs:815 catches ENOENT on stitch and throws a descriptive LoopError('stitch is not installed (set KEEL_STITCH, or put stitch on PATH)'). Note that line 92 cited by Loop is inside typed() YAML scalar parsing (scripts/loop.mjs:90-100). (2) scripts/first-minute.mjs:69-72 defines dockerAvailable() to pre-flight check 'docker info' before running container benchmarks, and pins 'FROM node:22-slim' in DOCKERFILE (line 53). (3) scripts/canvas-board.mjs:411-428 wraps execFileSync('gh', ...) in try/catch and returns { unknown: ... } with an explicit comment (lines 404-409) that absent gh, auth, or network must degrade to 'unknown'. (4) scripts/converge-night.mjs:118-121 and scripts/calibrate.mjs:128-144 wrap spawnSync('claude', ...) in JSON try/catch blocks and record terminal_reason or exit status without throwing unhandled errors.
