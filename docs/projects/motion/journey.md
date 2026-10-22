---
status: partial
since: 2026-10-22
see: wireframes, moodboard, design-partner, modules
note: specified 22 Oct 2026; phase 0 CLOSED the same day — `isocan motion new <svg…> --recipe assemble|idle` builds a motion item that plays on the canvas from a pure render(t). Select one or more SVGs on the canvas — a drawing, an uploaded icon, an illustration an agent wrote — say how they should move, and get a motion item that plays live on the canvas; then render it to a movie (MP4, WebM, GIF) that lands beside it as a video item. The motion vocabulary — one shared clock, poses flowed between, parts turning on real pivots, followers a beat late, idle motion that never quite stops — is after rossark0/rossark-motion-skill (MIT), whose targets are React Native and SwiftUI; here it is the web, and the same deterministic render(t) drives the preview and every frame of the movie. Built from what exists — SVG items, video items, the headless browser `isocan canvas shot` already drives — with three things new: a small motion engine in core, a motion item, and a renderer that encodes frames with WebCodecs, the same page for the web and the CLI.
---

# Motion

This is the **ideal**: a still drawing on the canvas should be a few words
away from moving well — not a keyframe editor, not an export dialog, but
*"make the logo assemble, then breathe"* — and a few clicks away from a
movie anyone can play.

The mechanism is [`design.md`](design.md); the walk is
[`phases.md`](phases.md).

## The sentence

> **Point at a drawing, say how it moves, and keep the movie — the same
> clock drives what you watch on the canvas and every frame you export.**

---

## Scene 1 — The logo assembles

Maya has Acme Bakery's logo on the canvas as three SVGs a designer drew in
isocan: the wheat stalk, the wordmark, the circle around them. She selects
all three and chooses **Animate…** (or an agent runs `isocan motion new`).

She types *"assemble: the circle draws on, the wheat grows up from the
base, the wordmark settles in last; then a slow idle sway."*

**She sees** a new item beside the three: the logo, moving. The circle
strokes on; the wheat rises from its root (it turns on its base, not its
middle); the wordmark arrives a beat after the wheat stops; then the stalk
sways a few degrees forever. Under it, a scrubber and the motion's length
(*2.4 s, then loops*).

**The point**: the positions and stacking she already had on the canvas are
the scene. She did not rebuild the logo somewhere else to animate it.

## Scene 2 — Adjusting by talking and by scrubbing

*"Slower wheat, and less sway."* The motion item gains a version; she can
flip between versions with the canvas's version stack as with any item.
She scrubs to 1.2 s to look at one moment, and leaves a comment pinned to
the motion item at that time: *"wordmark overshoots here."* The comment
remembers the time.

**The point**: a motion is an item. It has versions, comments and history
like everything else, and a moment in it can be pointed at.

## Scene 3 — The movie

She chooses **Render movie… → MP4, 1080 × 1080, 60 fps, 6 s**.

**She sees** a progress line (*frame 212 of 360*), then a video item beside
the motion: 6 seconds, plays on the canvas, downloads as an `.mp4`. Its
details say what it was rendered from (the motion item's version, the three
SVGs' versions, fps and size).

From the CLI, the same: `isocan motion render <item> --mp4 --fps 60
--seconds 6` produces the same video item, frame for frame.

**The point**: the movie is the preview, recorded. Nothing she watched on
the canvas differs from what she ships.

## What is not here

- **A timeline editor.** Motion is said, chosen from a recipe, or edited as
  text by an agent or a person; there are no keyframe tracks to drag.
  Scrubbing is for looking and pointing, not authoring.
- **Character rigs and lip-sync.** The skill this is after does faces and
  full-body acting in native apps. Here the first recipes are the ones
  a canvas needs most (reveal, assemble, idle, orbit, emphasis); faces are
  a later door.
- **Sound.** Movies are silent.
