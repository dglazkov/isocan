---
title: "Lack of interactive prototype state flow wiring"
loop: 1d703e35-2101-43eb-abf4-0ef306bf1782
loop_rank: P2
loop_state: DISMISSED
loop_goal: "What canvas tools teach us"
decision: stale
rank: never
project: wireframes
since: 2026-09-29
note: "Stale: assemblePrototype already ships a playable router with a history stack over the kept screens. Richer state or event logic would be a new ask. Reopen with a flow it cannot express."
---

# Lack of interactive prototype state flow wiring

> **Loop says** (P2): The wireframe architecture renders static HTML screen blobs and static connection lines without an interactive event execution engine. Hotspots contain link target screen identifiers, but components lack an event-driven transition dispatcher or state playback engine on the canvas. As a result, creators and automated agents cannot simulate, test, or validate interactive multi-screen state transitions directly on presentation cards.

- `packages/modules/wireframe/src/render.ts#L524-L544`
- `packages/modules/wireframe/src/arrows.tsx#L71-L82`
- `packages/modules/wireframe/src/spec.ts#L23-L96`
- `packages/web/src/components/PhonePresenting.tsx#L29-L73`
- `packages/web/src/components/StageEditor.tsx#L59-L75`

## Our read

packages/modules/wireframe/src/prototype.ts (assemblePrototype) already compiles every kept wireframe screen into a self-contained playable HTML prototype with a built-in history stack router, data-go/data-back hotspot navigation, and dashed data-needs indicators for unlinked targets. The other files Loop cited are unrelated: packages/web/src/components/PhonePresenting.tsx is the mobile slide-deck presenter bar (slide counter, speaker notes sheet, fullscreen toggle), and StageEditor.tsx is the CodeMirror source editor.
