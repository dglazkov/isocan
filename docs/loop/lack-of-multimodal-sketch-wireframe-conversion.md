---
title: "Lack of multimodal sketch wireframe conversion"
loop: d81bb9b4-12f2-4599-b1cc-4dec3916dbd2
loop_rank: P2
loop_state: ACTIVE
loop_goal: "What canvas tools teach us"
decision: accepted
rank: later
project: wireframes
since: 2026-09-29
note: "Holds as a feature gap: wire takes a text request only, and a sketch or screenshot is the natural input for a wireframe. Needs a model that reads images. Take it after wireframes phase 8, which comes from real use."
---

# Lack of multimodal sketch wireframe conversion

> **Loop says** (P2): isocan stores freehand ink drawings as raw vector coordinate arrays and uploaded UI reference media as static raster image blobs. The design request pipeline accepts text briefs and context references without ingesting or parsing visual spatial structures from ink sketches or image assets. Consequently, users and AI agents cannot convert hand-drawn wireframe sketches or reference screenshot layouts into editable wireframe specifications on the canvas.

- `packages/core/src/drawing.ts`
- `packages/core/src/media.ts`
- `packages/api/src/design-request-reader.ts`
- `packages/core/src/design-brief.ts`
- `packages/modules/wireframe/src/spec.ts`

## Our read

packages/modules/wireframe composes flows by choosing catalog blocks from a text request; nothing in it or in api/design-request-reader.ts reads an image or an ink drawing (drawing.ts stores raw strokes). The wireframes design deliberately has Jev choose from a fixed catalog, so a sketch would have to be described to it first. Real, and a later phase, after phase 8 from real use.
