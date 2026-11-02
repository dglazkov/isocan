---
title: Canvas viewport computations isolated in web client
loop:
  - 937a2c3a-97cb-4ca2-84fd-fa2e14cfd705
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPPn4
decision: untriaged
---

# Canvas viewport computations isolated in web client

> **Loop says** (P2): The web client implements pure canvas spatial calculations locally for item bounding boxes, viewport fitting, camera reveal panning, and coordinate transformations. Shared core modules provide item alignment and placement slot allocation, but omit viewport spatial geometry. Isolating viewport math in the web client prevents non-browser clients and automated agents from calculating canvas bounding boxes or camera framing without duplicating client logic.

- `packages/web/src/lib/viewport.ts#L135-L183`
- `packages/web/src/lib/viewport.ts#L18-L37`
- `packages/core/src/layout.ts#L89-L146`
- `packages/core/src/placement.ts#L1-L100`

## Our read

Not yet checked against the code.
