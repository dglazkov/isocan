---
title: Web UI lacks canvas home teleportation interface
loop:
  - 41a4ba45-b636-474b-b64f-e25a1fdb15ca
loop_rank: P2
loop_state: ACTIVE
loop_goal: Always isomorphic
decision: proposed
rank: never
project: multiuser
since: 2026-10-07
note: "By design: re-homing a local daemon's canvas and converting the daemon into a forwarding replica is an administrative CLI act alongside serve, stop, gc, export, and import rather than a browser canvas gesture."
---

# Web UI lacks canvas home teleportation interface

> **Loop says** (P2): The CLI provides the `isocan teleport` command to transfer a canvas history and blobs to another home server. The API client implements `client.teleport()` to invoke the daemon endpoint. However, the Web UI lacks any interface or dialog component to execute canvas home teleportation.

- `packages/cli/src/main.ts#L6729-L6765`
- `packages/api/src/routes.ts#L1235-L1251`

## Our read

The claim holds in the code: packages/cli/src/main.ts:6732-6784 registers 'isocan teleport <canvas> --to <home>' and calls client.teleport (packages/api/src/routes.ts:1235-1251), while no component in packages/web invokes that route. As documented in packages/cli/src/main.ts:6742-6746, teleport migrates a local daemon's canvas history and blobs to a remote home and rewrites the local daemon into a replica, which is an operator/CLI lifecycle command rather than an in-canvas UI action.
