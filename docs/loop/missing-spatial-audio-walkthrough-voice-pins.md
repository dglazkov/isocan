---
title: "Missing spatial audio walkthrough voice pins"
loop: b9fc06b4-34e8-405b-baa6-ba32bf195ac5
loop_rank: P2
loop_state: DISMISSED
loop_goal: "What canvas tools teach us"
decision: declined
rank: never
project: voice-agent
since: 2026-09-29
note: "Holds as a feature gap, and premature: talk and the voice agent are live sessions that no person has yet walked (docs/verify). Reopen once the basic conversation is judged to work."
---

# Missing spatial audio walkthrough voice pins

> **Loop says** (P2): isocan provides voice synthesis and Gemini Live talk integration, but operates audio as transient browser sessions rather than spatially pinned commentary callouts. The voice harness and Gemini Live tools manage canvas operations and text threads, but lack mechanisms to attach audio blobs to spatial coordinates. Also, canvas viewport tools support comment pins and drawing, but lack spatial audio recording or playback pin tools. Consequently, collaborators cannot record or play back localized voice walkthroughs directly on spatial canvas elements.

- `packages/modules/talk/src/core.ts`
- `packages/modules/talk/src/web.tsx`
- `packages/voice-agent/src/live.ts`
- `packages/core/src/itemthread.ts`
- `packages/web/src/components/CanvasViewport.tsx`

## Our read

grep of packages/core/src finds no audio blob or media kind tied to a coordinate; packages/modules/talk and packages/voice-agent run transient Gemini Live sessions over canvas operations. Comment pins exist (itemthread.ts) so the anchor half is built. What is missing is recording, storage and playback. voice-agent is still waiting on a human walk of the basic conversation (docs/verify), which is the honest order.
