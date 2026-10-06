---
title: Design system dialog polling triggers network traffic
loop:
  - bccddcf9-9816-47a8-84e5-7c380f4624b5
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPMwQ
decision: untriaged
---

# Design system dialog polling triggers network traffic

> **Loop says** (P2): Opening the design systems dialog registers a ten-second polling timer. This timer repeatedly requests design system documents over the network. Because the component already subscribes to canvas store sequence changes, fixed polling creates redundant API calls and state re-renders while canvas state is unchanged.

- `packages/web/src/components/DesignSystemsDialog.tsx#L50-L51`

## Our read

Not yet checked against the code.
