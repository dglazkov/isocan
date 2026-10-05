---
title: "Toolbar background image upload blocks canvas patch"
loop: 8c5cf4b7-71b7-439d-adf4-407dbd7b7d07
loop_rank: P2
loop_state: ACTIVE
loop_goal: "Fast everywhere, local-first"
decision: untriaged
---

# Toolbar background image upload blocks canvas patch

> **Loop says** (P2): Setting a canvas background image via the toolbar file input awaits synchronous HTTP blob uploads before dispatching project update operations. High network latency delays updating the canvas ground state until the file upload request completes. If the upload request fails, local state updates do not execute.

- `packages/web/src/components/Toolbar.tsx#L245-L273`

## Our read

Not yet checked against the code.
