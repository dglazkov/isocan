---
title: Flow voice application executes serial blob uploads
loop:
  - 32bc525e-8886-4ab5-8ccd-5f1bd2b3354c
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPMwQ
decision: untriaged
---

# Flow voice application executes serial blob uploads

> **Loop says** (P2): Applying a selected voice across screens in a wireframe flow executes serial HTTP blob uploads per screen before sending the operation group. The handler awaits host.putBlob sequentially for every screen in the flow. This sequential network bottleneck delays voice updates proportionally to screen count on multi-screen flows.

- `packages/modules/wireframe/src/flow-voice.ts#L91-L102`
- `packages/web/src/lib/flowvoice.ts#L114-L121`

## Our read

Not yet checked against the code.
