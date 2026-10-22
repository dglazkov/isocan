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

**Where we are, 22 Oct 2026:** phase 0 CLOSED — the engine, the `assemble`
and `idle` recipes and `isocan motion new`. Next: motion phase 1, the
movie. Dion decided [`design.md`](design.md) §7 — our own engine, MP4
first, no faces — and asked for every phase.

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

**Status: NOT STARTED.**

- The render page of §4 with WebCodecs H.264 into MP4; `isocan motion
  render` through the headless browser; the video item with
  `renderedFrom`; caps.

**Proof:** a 6 s, 60 fps, 1080² MP4 of the logo: 360 frames, decoded
frames 0, 72 and 359 equal the player's `render(t)` at those times
(within encoder tolerance), plays on the canvas; the same render from
the web's hidden frame yields the same decoded frames.

## Phase 2 — Select, animate, scrub

**Status: NOT STARTED.**

- Web, lazily loaded behind `motion`: *Animate…* on a selection of SVGs
  (recipes, and words through the parked agent); the player's scrubber;
  comments with `at`; *Refresh from sources*; *Render movie…*.
- The agent guide's motion section; `--say` for an agent writing the spec
  itself.

**Proof:** a browser journey through Scenes 1–3 on a scratch daemon with
the scripted harness standing in for the agent; one real agent run by
hand writing Scene 1's spec from the words.

## Phase 3 — Formats and a person's walk

**Status: NOT STARTED.**

- WebM (VP9) and GIF; the remaining recipes (`reveal`, `orbit`,
  `emphasis`).

**Proof:** each format plays on the canvas and outside isocan; a
`docs/verify/` walk: a person animates something of their own and judges
whether the motion feels right, which no check can say.
