---
title: "Limited real-time spatial presence during agent co-design"
loop: ed7526eb-76b8-4fdc-805e-b5dacb8cd5fb
loop_rank: P2
loop_state: DISMISSED
loop_goal: "What canvas tools teach us"
decision: stale
rank: never
project: design-competition
since: 2026-09-29
note: "Stale: presence already broadcasts cursor, selection and item-anchored activity for agents, so live focus is visible today. Loop itself dismissed it. Reopen if a specific missing signal is named."
---

# Limited real-time spatial presence during agent co-design

> **Loop says** (P2): isocan manages multi-agent design tasks through turn-based competition bouts and background CLI summonses rather than live spatial co-editing feedback. Presence protocols track socket connection status and owner permission grants, but do not broadcast transient spatial focus coordinates, active selection boxes, or item-level editing indicators. Consequently, human designers cannot observe live agent cursor movements or see which spatial canvas element an agent is actively modifying.

- `packages/modules/design-competition/src/bout.ts`
- `packages/core/src/roster.ts`
- `packages/core/src/summons.ts`

## Our read

packages/core/src/protocol.ts:301-330 carries per-actor cursor {x,y}, selection ids, text attention, a 20-second signal, and activity anchored to an item or a freestanding point that clients animate. Agents write it via explicit cursor commands, so the claim that presence tracks only socket state is false. bout.ts and roster.ts were not the right place to look.
