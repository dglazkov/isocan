---
status: designed
since: 2026-09-23
see: wireframes, judge
note: the walk. Phase 0 is the catalog and the renderer (skeleton and wire), no model. Phase 1 is Jev composing a flow skeleton-first on a canvas. Phase 2 variations and keep. Phase 3 links and the prototype. Phase 4 the web door. Phase 5 calibration against Enrico.
issue: 350
---

# Wireframes — the walk

**23 September 2026.** The order of work for [design.md](design.md), held to
[journey.md](journey.md). Each phase ends with **Trajectory**: only what the
phase discovered that changes the project's course.

Two rules for every phase, on top of `AGENTS.md`:

- **Every phase ends with something a person can look at on a canvas**, and
  the proof says which browser walk showed it. The renderer is the product;
  a phase that only passes unit tests has not shown anything.
- **Jev runs where the network reaches it.** The cloud container cannot reach
  `api.typesafe.ai` ([judge phases](../judge/phases.md)); every step that calls
  it is local, with `TYPESAFE_API_KEY` loaded (`~/.config/secrets.env` on
  Dion's machine). The stub answerer stands in everywhere else, including CI.

**Where we are: phase 0 is CLOSED (23 Sep 2026) — the catalog is data, and it draws.** `packages/modules/wireframe/` holds wave 1 (18 archetypes, 28 blocks, 22 primitives, 49 intents) and `renderWire`, which draws a blue-on-white blueprint where a slot is undecided and a grey wireframe where it is chosen; `isocan wire render|spec|catalog` put screens on a canvas. **Next: wireframes phase 1** — Jev draws a flow, local, with the key.

## Phase 0 — The catalog, drawn

**Status: CLOSED, 23 September 2026.** 370 tests hold the catalog and the renderer; the 36-screen gallery was looked at on a canvas and at full size (blueprint, half-drawn, wireframe), and the module was removed and restored with `wire` leaving and returning.

**Outcome:** `packages/modules/wireframe/` exists as a module (core, web, cli,
agent guide), holding wave 1's catalog as data — 18 archetype recipes, 28
blocks, the 22 primitives they name, the 49 intents — and `renderWire(spec)`,
which draws a spec as a blue-on-white skeleton where a slot is unresolved and
a greyscale wireframe where it is chosen. `isocan wire render <spec.json>`
adds the screen to a canvas as an HTML item with its spec embedded. No model.

**Proof:**

1. A test renders every archetype three ways — all slots null (blueprint),
   half resolved, all resolved with each block's default props — and asserts
   the embedded spec round-trips (`readWire(renderWire(s))` deep-equals `s`),
   that every block and primitive in every recipe draws, and that an
   unresolved slot draws in the skeleton palette and a resolved one does not.
2. The catalog is self-consistent: every block a recipe names exists, every
   intent an element accepts exists, every question a recipe implies has ≤ 4
   structural options and ≤ 255 of any kind (the research's numbers, held by
   a test).
3. A browser walk: a canvas with the 18 archetypes as blueprints in one row
   and as wireframes in the row below, screenshotted, and looked at.
4. Removing the module from both lists: the screens still render (they are
   HTML), `wire` is gone from `--help`.

### Trajectory

- **2026-09-23** — The web half registers after all: `test/modules.test.ts` requires a module in both lists or neither. It registers only the record (+46 bytes); the entry chunk is 727,779 against 727,800, so **21 bytes** of margin remain for phases 2–4's web work.
- **2026-09-23** — A declined optional slot is absent from `slots`; an undecided one is present with `block: null`. The design's spec had no way to say *declined*; `alternatives` still cannot offer "none" for an optional slot, which phase 2's variations will need.
- **2026-09-23** — Open: the design-system gate (`refuseUnsystematisedScreen`) counts wireframes as undesigned screens — after six, a real HTML screen's `isocan add` is refused. Wireframes should be exempt (detectable by `readWire`). Phase 1 composes whole flows, so it meets this first.
- **2026-09-23** — Open: recipes set default intents but not default props, so *Home* draws a Back chevron in its app bar. A per-recipe prop override is needed before phase 1's screens look right.

## Phase 1 — Jev draws a flow

**Status: NOT STARTED.**

**Outcome:** `isocan wire "<request>"` composes a flow: a blueprint appears
at once, round 1 (flow) turns it into one blueprint per archetype, rounds 2–3
fill each screen in place via `item.addVersion`; the whole request is one op
group. The answerer seam with three implementations — Jev (`TYPESAFE_API_KEY`),
the uniform stub (seeded), and an agent via `wire questions` / `wire answer`.
Measured: calls, latency per round, input tokens and cost for a real flow.

**Proof:**

1. Pure tests of the rounds against the stub: questions generated from the
   catalog, answers applied to specs, chrome fixed once per flow.
2. **Local, with the key:** the journey's warehouse request run for real;
   the screens, the measured latency and spend written into this phase's
   record. A person watching the canvas sees blue first, then grey.
3. One undo removes the whole flow.

## Phase 2 — Variations and keep

**Status: NOT STARTED.**

**Outcome:** variations from the distribution (argmax, then flip the least
certain decision; nothing under the 0.10 floor), placed as siblings under
their screen with `variantOf`. `wireKeep` as a property shown as 📐, set by
`wire keep|unkeep`, the item menu and a keystroke.

**Proof:** tests of variation selection on recorded Jev distributions; a
browser walk of keeping and unkeeping from the menu; the keep marks read back
from the CLI.

## Phase 3 — Links and the prototype

**Status: NOT STARTED.**

**Outcome:** `inferLinks` and `assemblePrototype` in the module's core; the
inferred links drawn as edges between kept screens; `wire prototype` adds the
prototype as an HTML item and re-versions it on rebuild; `wire link` overrides
one link. Missing targets render dashed and named.

**Proof:** rule tests (each of the five, and the override); a browser walk
that clicks through the warehouse prototype — sign in → home → deliveries →
delivery → back → tab — said out loud; the README's feature line.

## Phase 4 — The web door

**Status: NOT STARTED.**

**Outcome:** asking for wireframes from the canvas itself — the Chat and the
Add popover — composed by the home using its own `TYPESAFE_API_KEY` (a
Secret Manager secret on both homes since 23 Sep 2026), with the same
skeleton-first fill. `infra/70-cloud-run.sh` carries the secret so a full
re-provision keeps it.

**Proof:** the journey's scenes 1–5 walked on dev.isocan.io in a browser.

## Phase 5 — Is Jev any good at this?

**Status: NOT STARTED.**

**Outcome:** the archetype question put to Jev against Enrico's 1,460
labelled screens (research §4, *A calibration set that already exists*), and
the reliability curve read. Keep marks from phases 2–4 recorded as labels on
exactly the decisions Jev was unsure of — the calibration data judge needs,
produced for free.

**Proof:** the curve, the accuracy, and what it changes, written here.
