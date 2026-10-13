---
title: Web UI version inspector lacks pruning capability
loop:
  - a2198098-7c13-46c5-8e52-d2add8f807b9
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPPn4
decision: untriaged
---

# Web UI version inspector lacks pruning capability

> **Loop says** (P2): Core operations support version pruning with custom thresholds, and the command line tool exposes full pruning options. The web user interface version comparison modal lacks any controls or actions to prune version history. The fan view only offers version pruning when version count exceeds fourteen, with a hardcoded threshold of fourteen. Web user interface users cannot manage item storage or prune version history on demand.

- `packages/core/src/ops.ts#L327`
- `packages/cli/src/main.ts#L8830`
- `packages/web/src/components/VersionCompare.tsx#L188-L197`
- `packages/web/src/components/VersionFanOut.tsx#L21-L112`

## Our read

Not yet checked against the code.
