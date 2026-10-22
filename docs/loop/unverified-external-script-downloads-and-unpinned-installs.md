---
title: Unverified external script downloads and unpinned installs
loop:
  - 8a6bc809-e860-4076-9ee3-cad90810aba5
loop_rank: P2
loop_state: ACTIVE
loop_goal: Dependencies healthy
decision: stale
rank: never
project: personas
since: 2026-10-07
note: "Mostly stale: .github/workflows/loop.yml was retired in 7c05c065 and replaced by .github/workflows/keel-loop.yml:140 which installs @google/stitch@0 from npm without curl|bash; only .github/workflows/persona.yml:63 runs an unpinned npm install -g @anthropic-ai/claude-code when ANTHROPIC_API_KEY is set."
---

# Unverified external script downloads and unpinned installs

> **Loop says** (P2): Automated GitHub Actions workflows download unverified installer shell scripts over network and run unpinned CLI package installations at runtime. Nightly automation fetches installer scripts via curl without verifying checksums or signatures before execution. Scheduled persona workflows execute global npm package installations without pinning explicit package versions. These unverified network downloads and floating package versions introduce supply chain risks and pipeline instability into continuous integration.

- `.github/workflows/loop.yml`
- `.github/workflows/loop.yml#L87-L89`
- `.github/workflows/persona.yml#L63`

## Our read

Verified in .github/workflows/keel-loop.yml:137-141 and .github/workflows/persona.yml:61-64: the cited .github/workflows/loop.yml was deleted in commit 7c05c065 (5 Oct 2026) when keel's loop practice replaced it; .github/workflows/keel-loop.yml:140 runs 'npm install -g @google/stitch@0' from npm rather than curling an external shell script. In .github/workflows/persona.yml:61-63, 'npm install -g @anthropic-ai/claude-code' runs only in the scheduled nightly job when env.HAS_KEY == 'true', and persona.yml:88-154 restricts any self-merged PR to docs/reviews/ and docs/decisions.md (guarded by test/workflows.test.ts:330-368).
