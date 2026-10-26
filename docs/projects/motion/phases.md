# Motion — the walk

[`journey.md`](journey.md) is the ideal and [`design.md`](design.md) the
mechanism. Each phase ends with something a person can do, behind the
`motion` experiment, and switched off again by unticking it.

**Ordered so determinism is proven before anything depends on it.** The
engine and one recipe first, because a movie that differs from its preview
is the failure this design exists to prevent. Then the movie, because it is
the point. Then the web's doors and words, then the rest of the formats
and a person's walk.

**Phase citations name their project**: `motion phase 1`.

**Where we are, 25 Oct 2026:** every phase is built. Phases 0–2 are
CLOSED; motion phase 3 is PART-DONE, waiting only on a person's
[walk](../../verify/2026-10-22-motion-in-the-browser.md) — whether motion
feels right on their own drawings, which no check can say. Nothing is
waiting on code.

---

## Phase 0 — The engine and one motion item

**Status: CLOSED, 22 Oct 2026 — `isocan motion new <svg…> --recipe assemble|idle` builds a motion item that plays on the canvas; `render(t)` is pure (the 1.2 s frame pixel-identical twice and after 0.3 s, in headless Chrome, `scripts/motion-proof.mjs`).**

- `@isocan/core/motion`: the engine of `design.md` §1, the principle
  checks, and the `assemble` and `idle` recipes.
- `isocan motion new <svg…> --recipe assemble` builds the motion item of
  §2 from the selected SVGs' canvas positions, with scripts and remote
  references stripped.

**Proof:** unit tests that `render(t)` is pure (the same `t` gives the
same transforms in any order, any number of times); the three-part logo
of Scene 1 as a motion item that plays on a scratch canvas in a real
browser; two renders of the frame at t = 1.2 s pixel-identical.

### Trajectory

- **2026-10-22** — The engine has one source by being one self-contained function: the document carries `createMotionEngine.toString()`, so whatever toolchain compiled core is the text the document runs. A bare-`vm` test and the release-bundle CLI test compare frames with core's copy; a closure inside it would break both.
- **2026-10-22** — Each new CLI module now meets three ceilings at once (startup bytes, module count, cold-start guide). Motion raised two by a dated sentence each — startup read 5 → 5.1 MB after its SVG parsers went lazy, cold start 3,500 → 3,600 — rather than fix the shape.
- **2026-10-22** — Open: CLI modules register and teach at startup; the next module pays the same three ceilings. On-demand module registration is its own piece of work, outside this project.
- **2026-10-22** — Open: the player's Play and time readout sit over the bottom of the stage (over the wordmark on Scene 1's logo). Phase 2's scrubber owns the fix.

## Phase 1 — The movie

**Status: CLOSED, 22 Oct 2026 — `isocan motion render` makes a 360-frame 1080² H.264 MP4 in 17 s that lands as a video item with `renderedFrom`; decoded frames 0/72/359 sit within 2.2 of the page's own pictures and each nearest its own, and the hidden-frame path decodes to the CLI's frames exactly.**

- The render page of §4 with WebCodecs H.264 into MP4; `isocan motion
  render` through the headless browser; the video item with
  `renderedFrom`; caps.

**Proof:** a 6 s, 60 fps, 1080² MP4 of the logo: 360 frames, decoded
frames 0, 72 and 359 equal the player's `render(t)` at those times
(within encoder tolerance), plays on the canvas; the same render from
the web's hidden frame yields the same decoded frames.

### Trajectory

- **2026-10-22** — The render page lives under the canvas's address, not at an item-only route as `design.md` §4 first said: an item id names no canvas to read it from. The design now names `MOTION_RENDER_ROUTE`.
- **2026-10-22** — Modules can run isocan's own `scripts/*.mjs` through `CliHost.runPackageScript` (module API 0.2.10 → 0.2.11): the render page needs the headless browser, and a module could not start a process before.
- **2026-10-22** — Open: `mp4-muxer` (MIT, 11.5 KB gzipped, in the render chunk only) is marked deprecated upstream; its successor Mediabunny is MPL-2.0 and larger. Replace it, or own the muxing, before it breaks — nothing forces it yet.
- **2026-10-22** — Open: rendering a motion on a personal canvas follows `canvas shot`'s owner-credential path but was not exercised; a walk on a personal canvas owes it.

## Phase 2 — Select, animate, scrub

**Status: CLOSED, 22 Oct 2026 — *Animate…* (recipes in the browser, words to the lead), `motion new --spec`/`edit`/`refresh`, a scrubber below the stage, comments at a moment that scrub the player back, and *Render movie…*, walked by the `motion` journey in headless Chrome; one real Codex turn wrote and ran Scene 1's spec from the words (wheat on its `base`, `loop: true`).**

- Web, lazily loaded behind `motion`: *Animate…* on a selection of SVGs
  (recipes, and words through the parked agent); the player's scrubber;
  comments with `at`; *Refresh from sources*; *Render movie…*.
- The agent guide's motion section; `--say` for an agent writing the spec
  itself.

**Proof:** a browser journey through Scenes 1–3 on a scratch daemon with
the scripted harness standing in for the agent; one real agent run by
hand writing Scene 1's spec from the words.

### Trajectory

- **2026-10-22** — The recipe build runs in the browser (parse5 and css-tree's parser subpaths, a lazy chunk), so *Animate…* needs no daemon route.
- **2026-10-22** — Words go to the canvas's lead in the Chat, not through `enrol`: the same path a summons takes, so any parked agent can answer.
- **2026-10-22** — A real agent read the ask's "answer with `isocan motion new …`" as "reply with this text" and printed the command; the scripted stand-in could not have. The ask and the guide now say RUN it — the motion on the canvas is the answer.
- **2026-10-22** — Open: a looping motion replays its entrance every cycle; "assemble, then idle forever" has no shape yet. The guide tells an agent to say so or offer the idle as a second motion. An engine change, not scheduled.
- **2026-10-22** — Open: a motion item's properties (`motionSeconds`, `motionSources`) describe its newest version; flipping back to an older version leaves them describing the newest.

## Phase 3 — Formats and a person's walk

**Status: PART-DONE, 25 Oct 2026 — WebM (VP9) and GIF beside MP4 from our own encoders, and the `reveal`, `orbit` and `emphasis` recipes; every format decodes cleanly outside isocan (ffmpeg, zero errors), each decoded frame nearest its own picture, the hidden-frame path matching the CLI's (the GIF byte for byte). A person's [walk](../../verify/2026-10-22-motion-in-the-browser.md) is owed.**

- WebM (VP9) and GIF; the remaining recipes (`reveal`, `orbit`,
  `emphasis`).

**Proof:** each format plays on the canvas and outside isocan; a
`docs/verify/` walk: a person animates something of their own and judges
whether the motion feels right, which no check can say.

### Trajectory

- **2026-10-25** — Both new encoders are our own — a WebM muxer (~130 lines, with SeekHead and Cues so players can seek) and a GIF encoder (~270 lines, exact palettes up to 256 colours, median cut beyond) — because `webm-muxer` is deprecated like `mp4-muxer` and its successor is MPL. That leaves `mp4-muxer` the one deprecated muxer, replaceable the same way.
- **2026-10-25** — GIF defaults to 30 fps, refuses above 50 (delays are hundredths of a second; browsers slow anything under two to a tenth) and refuses past 64 MB on an estimate made before any frame is drawn. The estimate is generous (0.05 bytes a pixel against 0.004 measured on the logo); a busier drawing is its real test.
- **2026-10-25** — The follower check now reads a bell's start, so pulses that fire together warn; before, bell-only moves were skipped silently. `orbit` carries its one-beat lag in each wave's phase, not `follows`: a loop has no start for a follower to trail.
- **2026-10-25** — Open: the person's walk in `docs/verify/2026-10-22-motion-in-the-browser.md` — whether motion feels right on their own drawings, whether the WebM and GIF play in Safari, Slack and a slide, and whether GIF palettes band. Waits on Dion.

