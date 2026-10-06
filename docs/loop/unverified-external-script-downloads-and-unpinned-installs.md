---
title: Unverified external script downloads and unpinned installs
loop:
  - 8a6bc809-e860-4076-9ee3-cad90810aba5
loop_rank: P2
loop_state: ACTIVE
loop_goal: Dependencies healthy
decision: untriaged
---

# Unverified external script downloads and unpinned installs

> **Loop says** (P2): Automated GitHub Actions workflows download unverified installer shell scripts over network and run unpinned CLI package installations at runtime. Nightly automation fetches installer scripts via curl without verifying checksums or signatures before execution. Scheduled persona workflows execute global npm package installations without pinning explicit package versions. These unverified network downloads and floating package versions introduce supply chain risks and pipeline instability into continuous integration.

- `.github/workflows/loop.yml`
- `.github/workflows/loop.yml#L87-L89`
- `.github/workflows/persona.yml#L63`

## Our read

Not yet checked against the code.
