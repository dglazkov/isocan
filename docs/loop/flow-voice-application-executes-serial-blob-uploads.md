---
title: Flow voice application executes serial blob uploads
loop:
  - 32bc525e-8886-4ab5-8ccd-5f1bd2b3354c
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPMwQ
decision: declined
rank: never
project: copy-edit
since: 2026-10-07
note: "True mechanism, small optimisation: applyFlowVoice (flow-voice.ts:95-110) uploads changed screen blobs sequentially and rebuilds the prototype once in one undo group; reopen if flow voice shows a measured upload stall."
---

# Flow voice application executes serial blob uploads

> **Loop says** (P2): Applying a selected voice across screens in a wireframe flow executes serial HTTP blob uploads per screen before sending the operation group. The handler awaits host.putBlob sequentially for every screen in the flow. This sequential network bottleneck delays voice updates proportionally to screen count on multi-screen flows.

- `packages/modules/wireframe/src/flow-voice.ts#L91-L102`
- `packages/web/src/lib/flowvoice.ts#L114-L121`

## Our read

Verified in packages/modules/wireframe/src/flow-voice.ts:95-110 and packages/web/src/lib/flowvoice.ts:127-132: `applyFlowVoice` iterates over screens in the flow calling `writeWireCopy` with `{ group, rebuild: false }` and calls `rebuildPrototypes` once at line 108 so all screens and the prototype land as one undo group (docs/projects/copy-edit/phases.md:183-185).
