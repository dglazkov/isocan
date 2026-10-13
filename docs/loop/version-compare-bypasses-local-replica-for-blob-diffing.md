---
title: Version compare bypasses local replica for blob diffing
loop:
  - 53eef6f4-0b86-4059-8827-4d2e1daf4ba7
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPMwQ
decision: untriaged
---

# Version compare bypasses local replica for blob diffing

> **Loop says** (P2): Opening the version compare inspector fetches version blobs over HTTP without querying local IndexedDB replicas. The comparison handler issues direct network requests to the remote API, causing version comparison to fail offline or stall on network latency. This network dependency violates local-first principles when inspecting canvas version history.

- `packages/web/src/lib/compare.ts#L38-L49`
- `packages/web/src/components/VersionCompare.tsx#L85-L95`
- `packages/web/src/lib/api.ts#L860-L870`

## Our read

Not yet checked against the code.
