---
status: designed
since: 2026-09-23
see: wireframes, judge
note: the walk. Phase 0 is the catalog and the renderer (skeleton and wire), no model. Phase 1 is Jev composing a flow skeleton-first on a canvas. Phase 2 variations and keep. Phase 3 links and the prototype. Phase 4 wires in your design system. Phase 5 the web door. Phase 6 calibration against Enrico.
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

**Where we are: phases 0–2 are CLOSED (23 Sep 2026).** The catalog draws (0); `isocan wire "<request>"` has Jev compose a flow skeleton-first, about $0.001 and 7–16 s a flow (1); variations appear under each screen where Jev was unsure, and screens are kept with 📐 from the CLI, the item menu or ⇧K (2). **Next: wireframes phase 3** — links and the prototype.

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

- **2026-09-23** — The web half registers after all: `test/modules.test.ts` requires a module in both lists or neither. It registers only the record (+46 bytes); the entry chunk is 727,779 against 727,800, so **21 bytes** of margin remain for phases 2–5's web work.
- **2026-09-23** — A declined optional slot is absent from `slots`; an undecided one is present with `block: null`. The design's spec had no way to say *declined*; `alternatives` still cannot offer "none" for an optional slot, which phase 2's variations will need.
- **2026-09-23** — Closed in phase 1 (`fidelity: "wireframe"`): the design-system gate (`refuseUnsystematisedScreen`) counted wireframes as undesigned screens — after six, a real HTML screen's `isocan add` is refused. Wireframes should be exempt (detectable by `readWire`). Phase 1 composes whole flows, so it meets this first.
- **2026-09-23** — Closed in phase 1 (`Recipe.props`): recipes set default intents but not default props, so *Home* drew a Back chevron in its app bar. A per-recipe prop override is needed before phase 1's screens look right.

## Phase 1 — Jev draws a flow

**Status: CLOSED, 23 September 2026.** Two live Jev flows (the journey's warehouse request: 9 screens, 19 calls, $0.000815, 7.3 s; the conductor's own recipe-sharing request: 12 screens, 25 calls, $0.001122, 11.2 s), each screen's version history blueprint → filled in place, one undo removing each whole flow, the agent path without a key, and 397 tests.

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

### Trajectory

- **2026-09-23** — Jev on wireframe rounds is **1.8–4.9 s per round**, not judge phase 0's 193–351 ms: round 1 carries ~21 questions in one call. A flow is 7–11 s of model time, which makes skeleton-first the whole experience rather than a nicety. Cost matched the estimate (~$0.001 a flow).
- **2026-09-23** — The first live run drew a different tab bar on each screen. Chrome's *props* are now asked once per flow and copied to every screen (only `selected` stays per screen), and no block may carry the same intent twice. Design §4's "fixes the chrome" meant blocks; it now means blocks and their props.
- **2026-09-23** — The design-system gate exempts wireframes by a core property, `fidelity: "wireframe"` (`isWireframeScreen` in `design-scope.ts`), not by the file's marker, because the gate reads item metadata and never file contents.
- **2026-09-23** — Watching blue turn grey live was not walked: `canvas shot` takes ~17 s against a 7 s flow. The version history proves the in-place fill; the live watch moves to phase 5's browser walk (the web door), where a person asks from the canvas.
- **2026-09-23** — Open: screens are titled by archetype (*List*, *Detail*), not by domain (*Deliveries*), and a lone button can draw unlabelled (Profile's edit action). Both need words Jev cannot write — an agent's copy pass, or a decision in phase 2.
- **2026-09-23** — Open: round 1's yes ≥ 0.5 admits borderline screens (search 0.50, verify 0.71 for a request that never mentioned verification). Phase 2's variations or phase 6's calibration should set the cut, not a guess.

## Phase 2 — Variations and keep

**Status: CLOSED, 23 September 2026.** 6,493 tests; a live Jev flow (Acme Couriers: 6 screens, 13 calls, $0.000597) with variations under their screens and two marked *one way to draw this*, looked at; `wire vary|keep|unkeep|kept` from the CLI; the conductor's own browser walk kept *List* with ⇧K and *Detail* from the item menu, and `wire kept` read all three back in reading order.

**Outcome:** variations from the distribution (argmax, then flip the least
certain decision; nothing under the 0.10 floor), placed as siblings under
their screen with `variantOf`. `wireKeep` as a property shown as 📐, set by
`wire keep|unkeep`, the item menu and a keystroke.

**Proof:** tests of variation selection on recorded Jev distributions; a
browser walk of keeping and unkeeping from the menu; the keep marks read back
from the CLI.

### Trajectory

- **2026-09-23** — Modules had no way to put a mark, a menu entry or a keystroke on an item. A data-only `ModuleMark` on the core record now gives any module all three without the shell importing it; the wireframe 📐 is its first user.
- **2026-09-23** — The mark's ~550 bytes of first paint were paid by moving slides' write half and speaker notes out of the entry chunk (`core/slidewrites.ts`): net −22 bytes, 727,757 against 727,800. The web phases have 43 bytes of margin, so phase 5 must be lazy from the start.
- **2026-09-23** — Include decisions now carry probability (`omit` alternatives, a `declined` list), and most screens have a section near 0.3 — so *one way to draw this* is rare (one or two screens a flow), and variations are plentiful rather than scarce.
- **2026-09-23** — Open: a variation's flipped block gets default props and intents (round 3 never asked about the runner-up), and flip names come from block ids ("with stacked list"). Phase 4's restyle or phase 5's web door should ask round 3 for the flipped block.
- **2026-09-23** — Open: ⇧K is in the help panel but not core's `SHORTCUTS` table, so `isocan shortcuts` does not list it.

## Phase 3 — Links and the prototype

**Status: NOT STARTED.**

**Outcome:** `inferLinks` and `assemblePrototype` in the module's core; the
inferred links drawn as edges between kept screens; `wire prototype` adds the
prototype as an HTML item and re-versions it on rebuild; `wire link` overrides
one link. Missing targets render dashed and named.

**Proof:** rule tests (each of the five, and the override); a browser walk
that clicks through the warehouse prototype — sign in → home → deliveries →
delivery → back → tab — said out loud; the README's feature line.

## Phase 4 — Wires in your design system

**Status: NOT STARTED.**

**Formerly:** phase 4 was the web door; inserted 23 Sep 2026 when Dion asked
for wires that use the canvas's design system, and the web door became
phase 5 so it opens onto both looks.

**Outcome:** design §9. The renderer draws the wire look from theme roles;
the default theme is today's greys; `wire style` maps the governing design
system's tokens onto the roles with Jev (one choice per role, cached per
system version) and restyles every wire on the canvas as one op group;
`wire style --default` restores; `wire "<request>"` starts in the governing
system; a scoped group's system governs the flows inside it. Blueprints stay
blue.

**Proof:**

1. Tests: every block and primitive draws only through the roles (no literal
   colour in the wire stylesheet outside the default theme); a theme round-
   trips in the spec; restyle is one op group and a version per changed wire.
2. **Local, with the key:** two design systems from the design-competition
   packs (synthetic canvases), the mapping Jev chose for each written into
   this phase's record with its probabilities; the same flow shown default,
   in system A, and in system B, side by side, looked at.
3. One undo takes a restyle back; a scoped group's flow takes its own system.

## Phase 5 — The web door

**Status: NOT STARTED.**

**Outcome:** asking for wireframes from the canvas itself — the Chat and the
Add popover — composed by the home using its own `TYPESAFE_API_KEY` (a
Secret Manager secret on both homes since 23 Sep 2026), with the same
skeleton-first fill. `infra/70-cloud-run.sh` carries the secret so a full
re-provision keeps it.

**Proof:** the journey's scenes 1–6 walked on dev.isocan.io in a browser.

## Phase 6 — Is Jev any good at this?

**Status: NOT STARTED.**

**Outcome:** the archetype question put to Jev against Enrico's 1,460
labelled screens (research §4, *A calibration set that already exists*), and
the reliability curve read. Keep marks from phases 2–5 recorded as labels on
exactly the decisions Jev was unsure of — the calibration data judge needs,
produced for free.

**Proof:** the curve, the accuracy, and what it changes, written here.
