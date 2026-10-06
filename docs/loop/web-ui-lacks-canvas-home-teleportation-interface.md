---
title: Web UI lacks canvas home teleportation interface
loop:
  - 41a4ba45-b636-474b-b64f-e25a1fdb15ca
loop_rank: P2
loop_state: ACTIVE
loop_goal: Always isomorphic
decision: untriaged
---

# Web UI lacks canvas home teleportation interface

> **Loop says** (P2): The CLI provides the `isocan teleport` command to transfer a canvas history and blobs to another home server. The API client implements `client.teleport()` to invoke the daemon endpoint. However, the Web UI lacks any interface or dialog component to execute canvas home teleportation.

- `packages/cli/src/main.ts#L6729-L6765`
- `packages/api/src/routes.ts#L1235-L1251`

## Our read

Not yet checked against the code.
