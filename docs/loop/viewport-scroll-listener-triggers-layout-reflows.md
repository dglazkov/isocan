---
title: "Viewport scroll listener triggers layout reflows"
loop: b663dbb7-5bd5-4f4d-8761-99a2fa98d8bc
loop_rank: P2
loop_state: DISMISSED
loop_goal: "Fast everywhere, local-first"
decision: declined
rank: never
project: new
since: 2026-09-29
note: "Partly true but narrow: the querySelectorAll and layout reads in scrollerIn run only for a wheel over a selected item, and ordinary panning skips them (CanvasViewport.tsx:226-265). Reopen with a profile showing jank."
---

# Viewport scroll listener triggers layout reflows

> **Loop says** (P2): The global wheel event handler queries DOM subtrees and reads layout dimensions on every scroll tick. Calling `querySelectorAll`, reading layout properties, and checking computed styles on high-frequency wheel events forces synchronous layout reflows on the main thread. This forced layout work creates frame jank and delays UI updates during canvas navigation.

- `packages/web/src/components/CanvasViewport.tsx#L225-L257`

## Our read

CanvasViewport.tsx:213-245: scrollerIn does querySelectorAll and reads scrollHeight/getComputedStyle, but scrollSelectedContent returns early at L226 unless the target sits in a [data-item-id] frame whose id is in selectedItemIds. Plain canvas panning goes straight to ui.setViewport(pan(...)) at L262-265 with no DOM queries, and pinch returns before that. So the claim is true only for wheel over a selected item, where the scan is scoped to that item content. No profile was run.
