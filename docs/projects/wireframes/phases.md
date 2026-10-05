---
status: partial
since: 2026-09-30
see: wireframes, judge
note: the walk. Phases 0–8 closed 23–24 Sep 2026 and were walked on isocan.io (#350); phase 14 (fidelity layers and the tier pill under the screen) closed 2 Oct 2026, live on isocan.io. Wave 2 (#369, phases 9–13, designed 30 Sep 2026) ports the standalone Jev design prototype's best mechanisms into pure TypeScript: Phase 9 is multi-region @container layout templates, density, and data-wf paths; Phase 10 is PriorityGate and entropy-gated /ask in @isocan/core/jev; Phase 11 is surgical single-slot edits (wire edit) and decision Q&A (wire why); Phase 12 is schema-driven AI copy (wire copy --ai) and flow naming (wire name); Phase 13 is concurrent design system synthesis (wire ds) and Jev-budgeted polish (wire polish).
issue: 369
---

# Wireframes — the walk

**23 September 2026 (wave 2 added 30 September 2026).** The order of work for
[design.md](design.md), held to [journey.md](journey.md). Each phase ends with
**Trajectory**: only what the phase discovered that changes the project's
course.

Two rules for every phase, on top of `AGENTS.md`:

- **Every phase ends with something a person can look at on a canvas**, and
  the proof says which browser walk showed it. The renderer is the product;
  a phase that only passes unit tests has not shown anything.
- **Jev runs where the network reaches it.** The cloud container cannot reach
  `api.typesafe.ai` ([judge phases](../judge/phases.md)); every step that calls
  it is local, with `TYPESAFE_API_KEY` loaded (`~/.config/secrets.env` on
  Dion's machine). The stub answerer stands in everywhere else, including CI.

**Where we are: phases 0–8 are CLOSED (23–24 Sep 2026, walked on isocan.io, [#350](https://github.com/dglazkov/isocan/issues/350)); wave 2 phases 9–13 are PART-DONE (30 Sep 2026, [#369](https://github.com/dglazkov/isocan/issues/369)) — built and unit-tested, browser walk next; phase 14 (fidelity layers and the tier pill) is CLOSED (2 Oct 2026, live on isocan.io).** Terminal and canvas both: `isocan wire` / `/wire` compose a flow skeleton-first with Jev, variations sit where it was unsure, 📐 keeps, arrows show the flow, a prototype assembles itself, and every wire restyles into the governing design system; phase 6 measured Jev honestly. Wave 2 ports the standalone Jev design prototype's best mechanisms into pure TypeScript (`@isocan/core/jev` and `@isocan/module-wireframe`) with zero external sidecars: phase 9 built (7 multi-region `@container` layout templates, `density`, and `data-wf`/`data-sec` paths), phase 10 built (`PriorityGate`, `entropyBits`, `gatedChoice`, and entropy-gated `/ask` + `--pin`/`--no-ask`), phase 11 built (`wire edit` surgical single-section edits + prototype rebuild in one op group, and `wire why` decision Q&A over embedded `WireSpec.decisions`), phase 12 built (`TextGenerator` seam in `@isocan/core/jev`, `blockContentSchema`, `wire copy --ai`, `sanitizeFlowTitle`, and `wire name`), and phase 13 built (`proposeThenPick`, `repairContrast`, `wire ds`, `polishIntensityBudget`, `verifyWireContract`, and `wire polish`).

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
- **2026-09-23** — Answered 24 Sep (`7d677186`: on flesh a screen takes the pack's words — Deliveries, Delivery, New delivery — item title too unless someone renamed it, and a lone bare verb takes its object ("Edit delivery"); `--bars` names them back). Was: screens are titled by archetype (*List*, *Detail*), not by domain (*Deliveries*), and a lone button can draw unlabelled (Profile's edit action). Both need words Jev cannot write — an agent's copy pass, or a decision in phase 2.
- **2026-09-23** — Answered 24 Sep (`12992559`: 0.3–0.5 is drawn marked *maybe* and keep prunes; the floor from phase 6's answers). Was: round 1's yes ≥ 0.5 admits borderline screens (search 0.50, verify 0.71 for a request that never mentioned verification). Phase 2's variations or phase 6's calibration should set the cut, not a guess.

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
- **2026-09-23** — Answered 24 Sep (`4ab4e629`: `isocan shortcuts` lists every loaded module's mark keys through a core helper the help panel shares, outside first paint). Was: ⇧K is in the help panel but not core's `SHORTCUTS` table, so `isocan shortcuts` does not list it.

## Phase 3 — Links and the prototype

**Status: CLOSED, 23 September 2026.** 439 module tests and the full suite; a live Jev flow (8 screens, $0.000818) with four kept, `wire links` showing 11 links and 3 dashed, `wire prototype` re-versioning on a changed screen and not on an unchanged one; the conductor's own click-through of the prototype on the canvas — sign in → home (dissolve) → tab → list → row → detail (2 deep) → back → the dashed Settings tab naming what it needs. The canvas arrows did not ship; they move to phase 5 (see Trajectory).

**Outcome:** `inferLinks` and `assemblePrototype` in the module's core; the
inferred links drawn as edges between kept screens; `wire prototype` adds the
prototype as an HTML item and re-versions it on rebuild; `wire link` overrides
one link. Missing targets render dashed and named.

**Proof:** rule tests (each of the five, and the override); a browser walk
that clicks through the warehouse prototype — sign in → home → deliveries →
delivery → back → tab — said out loud; the README's feature line.

### Trajectory

- **2026-09-23** — The canvas arrows between kept screens moved to phase 5. `CoreModule.edges(canvas)` sees item metadata, and a wire's spec lives in its file, so the edge hook cannot compute links; the smallest lazy underlay measured +235 bytes against 15 of margin. Phase 5 must teach the web to read a screen's spec anyway. Storing links as metadata was refused — stored links drift, which design §7 exists to prevent.
- **2026-09-23** — Rule 1 covers the research table's forward intents (→ the next kept screen) and overlay intents (→ a kept screen drawing that overlay; an overlay's confirm returns beneath it). Rule 4 gives a tab only a top-level screen no other nav item already reaches, or two tabs land on one screen.
- **2026-09-23** — Answered 24 Sep (`107dd19e`: `open-list`, `open-feed`, `open-gallery` let a tab name its screen; Jev chose `open-list` unprompted on a live flow). Was: Jev labelled a tab "Profile" and the tab rule sent it to *List* — the intent vocabulary cannot say *this tab is the list*. Tab intents need a per-archetype target (`open-list`, …) or a wave-2 vocabulary.
- **2026-09-23** — The entry chunk is 727,785 against 727,800: **15 bytes**. Phase 5's web door must arrive lazy, or answer the ceiling with a reason.

## Phase 4 — Wires in your design system

**Status: CLOSED, 23 September 2026.** 459 module tests and the full suite; live Jev mappings of two design-competition packs (frog: fog ground, magenta pill primary; Linear: dark ground, indigo primary — one call each, ~300 ms, ~$0.0002), the same four screens looked at default / frog / Linear side by side; a scoped group's flow taking its own system while the canvas's flow took the canvas's; verified by the conductor: a no-change rerun asks nothing and writes nothing, `--default` restyles 34 wires in one group, one undo takes exactly those 34 versions back.

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

### Trajectory

- **2026-09-23** — Jev maps a design system's tokens onto the wire's roles in one call of ~300 ms and ~$0.0002, confidently where the system is clear (primary, ground, ink at 0.98–1.00) and honestly unsure where it is not (frog's copy-bar and base spacing at 0.44–0.45 kept the default and said so). This is the cheap typed question design §9 bet on.
- **2026-09-23** — One `radius` role is too coarse: frog's pill buttons made text fields pills too, and Linear's `xs` 4px base spacing made screens tight. Radius wants a control/container split and spacing wants asking as "padding inside a card", not "base unit".
- **2026-09-23** — A mapping records who answered it (`style.by`), so a stub mapping is never reused by a run that has Jev; and a tied answer keeps the default, because 0.5/0.5 is not a choice.
- **2026-09-23** — `wire "<request>" --in <group>` was added so a flow can be composed inside a scoped group — until now none could be.

## Phase 5 — The web door

**Status: CLOSED, 23 September 2026.** Walked on isocan.io (Dion chose prod over dev: the machine births canvases on isocan.io, and `green` was promoted to prod for the walk), after being built and walked on a local daemon (headless Chrome: blueprint at 400 ms, grey by 3.5 s, keep, five arrows, prototype click-through, restyle, one undo); 478 route/module/web tests including one holding the web and the CLI to identical ops. On isocan.io, in real Chrome: `/wire` in the Chat drew a blue blueprint by 1.2 s and eight grey screens plus eight variations by 13 s through prod's own key (scene 1–3); ⇧K kept four and seven arrows appeared from the specs (4); `/wire prototype` added the prototype ("14 links, 3 dashed") and it clicked through sign in → home → tab → list → row → detail → back (5); with the frog pack set, `/wire style` restyled all 16 wires and re-versioned the prototype (6).

**Outcome:** asking for wireframes from the canvas itself — the Chat and the
Add popover — composed by the home using its own `TYPESAFE_API_KEY` (a
Secret Manager secret on both homes since 23 Sep 2026), with the same
skeleton-first fill, and the arrows between kept screens on the canvas
(moved here from phase 3: the web reads a screen's spec to draw them). `infra/70-cloud-run.sh` carries the secret so a full
re-provision keeps it.

**Proof:** the journey's scenes 1–6 walked on dev.isocan.io in a browser.

### Trajectory

- **2026-09-23** — The home gained one vendor-neutral answerer, `POST /api/judgment`: it forwards a question file with its own `TYPESAFE_API_KEY` behind the same door checks as `/api/ops` plus a per-badge rate limit, and a test holds the key out of every response and log line. Judge phase 2 can adopt it as its hosted seam.
- **2026-09-23** — The composer's canvas half moved behind a `WirePort`: the web runs the CLI's `composeFlow`, `restyle` and `writePrototype` unchanged, and a test holds both surfaces to identical op shapes. A keyless CLI now answers through its home and says so.
- **2026-09-23** — The arrows moved from phase 3 landed as a lazy underlay that reads kept screens' files; `UnderlayFacts.readText` and `DialogHost.{readText,getCanvas,judge,notice}` are the shell additions (authoring.md).
- **2026-09-23** — Answered 23 Sep (phase 8's record: CEILING raised to 730,100 at Dion's call). Was: the entry chunk is **728,367 against CEILING 727,800 — 567 bytes over**, after everything that could be lazy was: the `/wire` command row, the dialog descriptor, and the arrows' "two kept screens?" check must be known at first paint. Under JUMP, so it lands as a performance finding; answering it (raise with this reason, or find 567 bytes elsewhere) is Dion's call.
- **2026-09-23** — Open: modules cannot contribute a row to the Add popover, so `/wire` is the only door there; an Add row wants a module slot.

- **2026-09-23** — The walk moved from dev to isocan.io at Dion's choice; prod was promoted to `green` (`bfb1e65a`) for it.
- **2026-09-23** — Open: the web's composer and restyle run in the page, so closing the tab mid-act stops them partway — seen on prod when the walk closed its tab 6 s into `/wire style` (15 of 16 wires, prototype not rebuilt). One op group, so one undo recovers it, and a second `/wire style` finished it; but a long act wants to say "keep this tab open" or move to the home.
- **2026-09-23** — Open: in the canvas's full-screen item viewer, real mouse clicks on the prototype's bottom bar (tabs, footer buttons) did not route in headless Chrome, while the same clicks worked on the prototype opened directly and as DOM clicks in the viewer. Harness or viewer is unresolved — a person clicking the tab bar in full screen settles it.
- **2026-09-23** — Answered 24 Sep (`8549e905`: right-click a DESIGN.md → *Use as design system*, and `isocan design use`, the same op). Was: `design set` has no web door, so choosing a design system for wires is CLI-only; the walk set frog's `DESIGN.md` from the terminal.
## Phase 6 — Is Jev any good at this?

**Status: CLOSED, 23 September 2026.** The archetype question put to Jev over Enrico's labelled screens (1,318 usable of 1,460; 142 in topics with no archetype), twice (34 options, 20 options) plus a stub baseline, for $0.148 of the approved $1.00; the conductor recomputed the headline from the raw answers. This phase measures rather than draws, so its canvas-rule artifact is the reading below, not a screen.

**The reading.** Strict accuracy **33.3%** over 34 options (**40.3%** over 20), lenient 38.3% / 47.3%; chance is 3%, always-*list* 20.1%; the truth is in Jev's top 3 **61.5% / 70.4%** of the time. Calibration: ECE **0.39** — accuracy rises with p in every bin but sits ~0.4 below it; at p ≥ 0.9 (29% of screens) Jev is right **47.7%** of the time. Latency p50 161 ms, p90 245 ms. The confusions are siblings that share a shape: gallery → list (45), onboarding → welcome (39), sign-in → welcome (35), menu → home (33), form → sign-up (27, mean p 0.86), list → settings (23, mean p 0.90). Reproduce with `packages/modules/wireframe/scripts/calibrate.ts`.

**Outcome:** the archetype question put to Jev against Enrico's 1,460
labelled screens (research §4, *A calibration set that already exists*), and
the reliability curve read. Keep marks from phases 2–5 recorded as labels on
exactly the decisions Jev was unsure of — the calibration data judge needs,
produced for free.

**Proof:** the curve, the accuracy, and what it changes, written here.

### Trajectory

- **2026-09-23** — Round 1's *leave-out* rule is wrong in kind. Jev's p ranks archetypes (the curve rises monotonically) but is overconfident by ~0.4 everywhere, and no cut reaches 60% accuracy — so p can order screens, not exclude them. Round 1 should over-include (top-k, or a 0.3 floor) and let keep/unkeep prune, which is what phase 2 built them for.
- **2026-09-23** — The failures are shape-siblings (gallery/list/feed, sign-in/welcome/sign-up, menu/home), and the options Jev sees are component-id recipes. Rewording each archetype in plain words is the cheapest next measurement (~$0.08 a run, the script already exists) and may be most of the fix.
- **2026-09-23** — A flat stub is perfectly calibrated (ECE 0.001) and useless (3%): ECE is never a gate on its own, only beside accuracy.
- **2026-09-23** — Answered 24 Sep (`12992559`; the 0.3 floor re-measured with plain words stands: 0.3–0.5 right 28–37%, as often as 0.5–0.7). Was: round 1's cut — change `yes ≥ 0.5` to over-include (top-k or a 0.3 floor), re-measured against this script. Owed to a follow-up phase.
- **2026-09-23** — Answered 24 Sep (`need` in `12992559`, `by` on the spec in `c6d98510` — every future keep labels a decision with who made it). Was: keep marks are not yet calibration labels (11 kept, one tied to a single decision). `WireSpec` needs who answered (`by`) and round 1's P(yes) on each screen so every future kept variation labels one decision.
- **2026-09-23** — Answered 24 Sep (350 screens, words beat ids on every accuracy measure by 1–5 points at 17–20% fewer tokens, ECE unchanged ~0.35; kept, and not significant alone). Was: re-run the calibration with plain-words archetype options before changing anything else.

## Phase 7 — Fleshed out

**Status: CLOSED, 23 September 2026.** Walked on isocan.io after the promotion: `/wire flesh` in the walk canvas's Chat chose the inventory pack (p 1.00) through prod's key and fleshed 16 of 16 wires for $0.000045, recorded in the Chat as one op group; looked at by the conductor. Before that: 24 synthetic packs, 44 pictograms, `wire flesh` / `/wire flesh` / `--flesh` / `wire copy`; 506 module tests; Jev chose the expected pack for 12 of 12 requests (11 at p 1.00, holiday approvals → generic); a local warehouse flow fleshed, re-run as a no-op, bars and back in one undo, restyled into Rams with the same words — looked at by the conductor. 

Added 23 Sep 2026 at Dion's ask, looking at the walk canvas's grey bars: sample
content as a step in the process ([design.md §10](design.md), journey scene 7).

**Outcome:** ~24 synthetic content packs in the module's core, each with nouns,
titles, first names, domain metrics and units, statuses, categories, dates and
greyscale SVG pictogram motifs; Jev chooses the pack for a request (one choice,
p recorded, `--pack` overrides); every block and primitive draws `fill`
content when present — lists, cards, tables, stats, charts, feeds, profiles,
image and avatar slots — and falls back to bars when not; content seeded per
screen and slot and stored in the spec; `wire flesh` / `/wire flesh` / `wire
--flesh` as one op group; `wire copy` for an agent's exact words. Content
survives `wire style`, variations and `wire prototype`.

**Proof:**

1. Tests: every block draws with and without content; a spec with content
   round-trips; the same seed gives the same content; restyle and prototype
   keep it; packs hold no real brands (a test over the pack data).
2. **Local, with the key:** Jev's pack choice for 12 varied synthetic
   requests, with p (spot-checked, written in the record); one flow fleshed,
   the same four screens before/after at full size, looked at.
3. On the walk canvas (https://isocan.io/p/prj_riZvAhYwSj), after the push is
   promoted: `/wire flesh` fills the warehouse flow; screenshot; one undo
   takes it back.

### Trajectory

- **2026-09-23** — Item *k* of a flow is built from the flow id and *k*, so the same "Returns batch 70" is the list's first row, the detail's heading and the prototype's — the detail always agrees with the row that opened it. That consistency, more than the words, is what makes a fleshed flow read as an app.
- **2026-09-23** — Jev's pack p is 1.00 on 11 of 12 requests; the 0.4 floor catches the stub, not Jev. `--pack` is the real override.
- **2026-09-23** — The lazy wireframes chunk grew ~92 KB (pack data), first paint unchanged. If it matters, the packs become their own chunk.
- **2026-09-23** — Answered 24 Sep (phase 8: `wire render --all` / `/wire rerender`). Was: a flesh or restyle writes only where the spec changed, so a renderer change never reaches screens already on a canvas. A "re-render" verb is owed before renderer changes ship (phase 8's title/frame change needs it).
- **2026-09-23** — Answered 24 Sep (phase 7 closed on the isocan.io walk, 23 Sep). Was: the walk canvas fleshed on isocan.io after a promotion (proof 3).

## Phase 8 — From real use: true arrows, just the screen, and what people tripped on

**Status: CLOSED, 23 September 2026.** Walked on isocan.io after the promotion (prod at `6e6d749c`, bundle flipped in 260 s): on the walk canvas `/wire rerender` redrew 16 of 16 wires as just the screen and rebuilt the prototype, `/wire flesh` filled them, both acts left their record in the Chat, and the per-hotspot arrows drew over the row — looked at by the conductor. Built by two builders and merged: per-hotspot orthogonal arrows with ordered lanes (0 crossings on the recorded flow, and on the merged walk after a retarget made two jumps interleave), clickable (Play from here, Go to, Change target…/drag, Reset, Remove — each the same `item.update` `wire link` sends, one undo), `/wire links` and `isocan wire play`; wires drawn as just the screen, `wire render --all` / `/wire rerender` (21 of 44 re-rendered, rerun wrote nothing); the minimap's prototype spotlight and ⌘K *Find prototypes*; web `/wire` acts recorded in the Chat inside their own undo group; Porchlight's findings 1, 2, 4, 5, 6, 8, 9, 12 fixed and 3, 7 in part. `npm test` 616 files green, typecheck clean, the deep lane green but for the known git-spec test; both browser walks on local daemons looked at by the conductor.

Everything Dion raised on 23 Sep 2026 looking at the walk canvas and
Porchlight, plus Porchlight's own `docs/isocan-notes.md`, in one phase with
two builders split by file ownership. The arrow design is the research note
[Flow arrows](../../research/2026-09-23-flow-arrows.md).

**A · Arrows (the research's recommendation, both of its phases).**
Orthogonal flow arrows, one per hotspot, starting at the hotspot on the
source screen: a straight run between neighbours, longer jumps routed over
the row on ordered lanes (no crossings), filled 9×8 px heads stopping 10 world
units short of the target, labelled with the hotspot's words where the run
can hold them; tab, back and missing links drawn only while a screen is
pointed at; drawn per kept flow (the cross-flow phantom link is a bug).
Clickable: the underlay gains the write access overlays already have (a shell
change, measured); a selected arrow offers *Play from here* (the prototype
opens at the source screen via a fragment), *Go to <target>*, *Change
target…* (drag the head onto another screen) and *Remove* / *Reset* — the
existing `wire link` override, no new op. `/wire links` in the dialog lists
every hotspot with a target picker for keyboard use.

**B · Just the screen.** A wire is the screen itself: no name strip above
it duplicating the node's title, no phone frame drawn inside the item's frame
(the mismatched corners) — the item's own frame is the device. Because a
renderer change never reaches screens already on a canvas (phase 7's Open),
`isocan wire render --all` / `/wire rerender` re-renders every wire from its
spec as one op group.

**C · Finding prototypes and the record.** A way to see which items are
prototypes on a busy canvas — a "Prototypes" filter/highlight and a strong
highlight on the minimap while it is hovered — and `/wire` results posted into
the Chat as the Wire builder's message (what was made, the numbers), not only
a popup.

**D · Porchlight's findings.** A second flow placed clear of the first (no
overlap); variations and prototypes created inside the flow's group; `wire
link` exiting when its write lands (it took minutes), and two concurrent
`wire link` calls both surviving (read-modify-write race); a link to a screen
kept in another flow resolved; `wire style` a true no-op on a rerun (it
re-versioned 48 wires); text links not coloured with a light primary below
AA contrast; moving a DESIGN.md into a group says it changes what it governs.

**Proof:**

1. Tests for the routing (no crossings on the recorded flow; per-flow
   drawing; per-hotspot starts), the menu actions mapping to `wire link`,
   re-render as one group, placement clear of an existing flow, group
   membership of variations and prototypes, the link race, the style no-op,
   the contrast rule.
2. A browser walk on a local daemon: arrows as designed, an arrow selected,
   retargeted by drag, Play from here opening the prototype at that screen;
   the screen-only render; the prototypes highlight and the minimap
   highlight; `/wire` results in the Chat history.
3. The walk canvas on isocan.io after a promotion.

### Trajectory

- **2026-09-23** — Override storage changed shape: each hotspot's decision is its own property, `wireLink:<slot>#<element>`, because a read-modify-write of one JSON map cannot be made race-safe from outside the reducer; the reducer's per-key merge does it. The old `wireLinks` is read and folded on first write.
- **2026-09-23** — The research's 44-unit first lane lost to the canvas's own item title strip (21 screen px at every zoom): measured on the merged build, 96 units is the lowest lane that clears it down to 0.26 zoom. Jumps whose ends interleave now route under the row.
- **2026-09-23** — The full-screen anchor rides `?at=`, not `#`, because a fragment on a canvas address is where a sign-in pass rides (`lib/arrival.ts`).
- **2026-09-23** — Underlays gained write access and a transient paint layer, through a lazily loaded host (+648 entry bytes instead of +1,969). CEILING raised 727,800 → 730,100 at Dion's call, reason in `scripts/bundle-ceiling.mjs`.
- **2026-09-23** — Answered 24 Sep (`98aefc25`: the blob check ran whole inside the single-writer chain, one HEAD per blob; lesson #95). Was: Porchlight #3, `wire link` / `isocan set` hanging minutes on isocan.io, did not reproduce locally and touches non-wireframe verbs — a home or replica check on isocan.io.
- **2026-09-23** — Answered 24 Sep (`8549e905`: set, import and use print what now governs). Was: `design set` still prints no "this now governs…" note (it lives in `packages/cli/src/main.ts`); `mv --in` and `canvas group add/remove` do.
- **2026-09-23** — Answered 24 Sep (`f0493f68`: em headings, and core's estimate measures them; lesson #96). Was: text-item headings are fixed px (18/15/13.5) against a 16–128 px body, so a large text node's heading is smaller than its body; the fix is em sizes together with the heading size `core/textnode.ts` assumes.
- **2026-09-23** — Answered 24 Sep (`7cdb3890`: `placeLabels` gives each label the zoom it shows from; the longer run keeps its place). Was: on the isocan.io walk two jump labels ("Home", "Row") on adjacent lanes overlapped — label placement checks the run's length, not its neighbours'. Labels want a collision pass.
- **2026-09-24** — A composed flow arrives fleshed: Dion ran `/wire` on isocan.io expecting content and got grey bars. One more Jev call (the pack, asked beside round 1), inside the flow's op group; `/wire basic` / `--basic` opts out, `--flesh` stays for old scripts.
- **2026-09-24** — Plain-words archetype options kept on measurement (350 labelled screens, +1–5 points, −17–20% tokens), but they are not the fix: the misses are still shape-siblings (sign-in → welcome, list → settings), and calibration did not move.
- **2026-09-24** — The prototype sits above its flow and returns there on rebuild unless moved by hand (`wirePrototypeAt`); a selected prototype lights its screens, `wire kept --prototype` answers the same for agents. Underlays gained the viewer's selection.
- **2026-09-24** — The module's property keys left the first-paint record — the web never read them — which is what paid for the placement property and the selection fact under CEILING.
- **2026-09-24** — Anything in a first-paint core file that a lazy chunk imports rides the entry chunk: the ⇧K helper beside `SHORTCUTS` cost 324 bytes until it moved to its own file (`shortcuttext.ts`), after which the entry was 204 bytes lighter than before.
- **2026-09-24** — Keep reads *Use in prototype*, and `/wire` ends with a prototype of Jev's first choices (P(yes) ≥ 0.5; no maybes, no variations) signed `wireKeepBy=jev`, while ⇧K, the menu and the CLI sign as the actor — every swap is now a labelled decision (`eee5ac64`, `bd1fdb8b`).
- **2026-09-26** — A flow's own keeps are signed with the answerer its `by` names — `jev`, `stub` or `agent` — where they had read anything but the stub as `jev`, so an agent's picks were indistinguishable from Jev's. Found by judge phase 1, whose reader takes the answerer from `by` and was unaffected; no shipped path composes a prototype for an agent yet (`wire answer` leaves the picking to it), so no canvas carries the wrong signature.
- **2026-09-24** — Named wire styles need no model: a DESIGN.md that names all eight colour roles maps directly, so Material through Brutalist cost no Jev call; the design packs are still asked.
- **2026-09-24** — Depth, not colour, is what tells systems apart: `surface:` (flat / raised / glass / bold) became isocan's one addition to DESIGN.md. Modules gained item-menu rows (`WebModule.menu`), and the wireframe lazy half now loads wherever a wire is.
- **2026-09-24** — Answered 24 Sep (`6c2387e2`: `ModuleMark.follow` re-versions the flow's prototype in the mark's own op group, on every keep path; a moved prototype stays put, none is created). Was: using or removing a screen does not rebuild the prototype; the Chat record and the CLI say so, but a person swapping a variation expects the prototype to follow.
- **2026-09-24** — Answered 24 Sep (the floor half: re-measured with plain words, it stands. The arrow half stays open:). Was: an unkept *maybe* between kept screens turns their neighbour arrows into jumps over it; worth watching on a real flow. The 0.3 floor came from a which-archetype question, not round 1's yes/no — re-measure once plain-words options land.
- **2026-09-23** — Answered 30 Sep (touch long-press cancel in `CanvasViewport.tsx` now matches `[role=button]`; hotspot positions on resized items remain open). Was: a touch long-press on an arrow may open the canvas menu (the shell's cancel check matches only real buttons and links), and hotspot positions are unverified on an item resized away from its document size.

---

## Phase 9 — Multi-region layout templates, density, and `data-wf` paths

**Status: PART-DONE, 30 September 2026.** Built and verified in unit tests (`packages/modules/wireframe/test/templates.test.ts`, 7/7 green; all 21 wireframe test files and export ratchets green; `npm run typecheck` clean across all 20 workspaces). Browser walk at `1280×800` and `375×812` owed after wave 2 CLI/web verbs land.

**Outcome:** [journey.md](journey.md) scene 9, [design.md](design.md) §11
([#369](https://github.com/dglazkov/isocan/issues/369)).
`packages/modules/wireframe/src/catalog/templates.ts` defines the seven
responsive layout templates (`single`, `split`, `master_detail`, `grid`,
`bento`, `hero_then_grid`, `dashboard`) and each archetype's compatible
templates. `WireSpec` gains `template?: TemplateId` and `density?: "compact" |
"default" | "spacious"`, and `WireSlot` gains `region?: string`. Round 2
(`compose.ts`) asks `template`, `density` (`score`), and per-slot `region`
when multiple regions apply. `render.ts` renders multi-region containers with
pure CSS `@container` queries (leaving `single` byte-identical to phases 0–8),
sets `--w-space` from `density`, and emits `data-sec="<slot>"` on every slot
root and `data-wf="<slot>.<element>"` on every addressable block element
alongside `data-intent` and `data-hot`.

**Proof:**

1. Unit tests (`packages/modules/wireframe/test/templates.test.ts`): every
   template renders valid HTML with its regions and `@container` CSS rules;
   `single` (or absent `template`) is byte-identical to existing renders;
   `density` maps `1 → compact (8px)`, `2 → default (12px)`, `3 → spacious (16px)`;
   Round 2 assigns slots only to regions declared by the chosen
   template while keeping chrome slots (`header`, `nav`, `footer`)
   anchored to the frame; every rendered block carries `data-sec` and
   `data-wf` alongside `data-intent`, and `inferLinks` + `assemblePrototype`
   route hotspots inside multi-region templates.
2. Browser walk: compose a desktop dispatch flow at `1280×800` and a mobile
   flow at `375×812`; verify multi-column regions (`dashboard`,
   `master_detail`, `bento`) render side by side on desktop and collapse cleanly
   inside narrow containers, with flow arrows leaving from the right hotspots.
3. `npm test` and `npm run typecheck`.

### Trajectory

- **2026-09-30** — `TEMPLATE_CSS` (`@container (min-width: 640px)`) is appended by `wireCss(spec)` only when `spec.template && spec.template !== "single"`, keeping `single` and default specs byte-for-byte identical and keeping flat-rule CSS tests untouched.
- **2026-09-30** — Some primitives (`app-bar`'s `"leading"`, `data-table`'s `"row"`) call `ctx.hot(element)` for structural hotspots that are not in `c.elements`; guarding `c.elements?.[element]` before calling `defaultIntent` stamps `data-wf="<slot>.<element>"` everywhere and `data-intent` wherever an actionable element is declared.

---

## Phase 10 — Entropy-gated `/ask` and `PriorityGate` in `@isocan/core/jev`

**Status: PART-DONE, 30 September 2026.** Built and verified in unit tests (`packages/core/test/jev.test.ts` and `packages/modules/wireframe/test/entropy-ask.test.ts`): `entropyBits`, `gatedChoice`, and `PriorityGate` (two-lane `high`/`normal` concurrency semaphore + `429`/`529` retry + `asAnswerer`) in `@isocan/core/jev`, plus `gateFlowDecision`, `formatAskComment`, `parsePinFlags`, `applyPinnedToSpecs`, and `--pin <key=value...>` / `--no-ask` in `@isocan/module-wireframe`. Browser walk with live `/ask` disambiguation remains before closing.

**Outcome:** [journey.md](journey.md) scene 10, [design.md](design.md) §12.
`packages/core/src/jev.ts` gains `entropyBits(probabilities)`,
`gatedChoice(answer, { maxEntropyBits, minConfidence })`, and
`PriorityGate(answerer, { concurrency, maxRetries })` — all pure TypeScript with
zero external dependencies. Interactive composer and edit calls run at
`priority: "high"`, while background polish calls run at `priority: "normal"`
and yield the queue when a high-priority call arrives. On root flow decisions
(`platform`, `pack`, `style.direction`), when `entropyBits > 1.0` and neither
`--no-ask` nor `WireSpec.pinned` is set, the composer surfaces the top 3
options with their probabilities as a canvas `/ask` (or CLI prompt / `--pin
<key=value>`) and records the answer in `WireSpec.pinned` so future turns never
re-ask.

**Proof:**

1. Unit tests (`packages/core/test/jev.test.ts` and
   `packages/modules/wireframe/test/entropy-ask.test.ts`): `entropyBits` returns
   `0` on a deterministic distribution, `1.0` on a 50/50 split, and `~1.58` on
   a three-way split; `gatedChoice` triggers `ask` above `1.0` bit and passes
   through when pinned or `--no-ask`; `PriorityGate` bounds concurrency,
   dispatches queued `high` calls ahead of queued `normal` calls, and retries
   `429`/`529` responses.
2. CLI & browser walk: run `/wire` on an underspecified prompt where root
   entropy exceeds `1.0` bit, verify the 3-option `/ask` surfaces on the canvas,
   answer it, and verify the flow completes with `pinned` recorded in every
   screen's `WireSpec`.
3. `npm test` and `npm run typecheck`.

### Trajectory

- **2026-09-30** — `PriorityGate` accepts either an `Answerer` at construction (`new PriorityGate(answerer, opts)`) or acts as a shared semaphore (`new PriorityGate(opts)` with `gate.asAnswerer(answerer, priority)`), allowing a single gate instance to coordinate `answerer` and `mappingAnswerer` calls across lanes.
- **2026-09-30** — `FlowCanvas.styled` only stamps `spec.pinned` when `activePinned` is non-empty (`--pin` or an answered `/ask`), keeping `WireSpec` output byte-identical on flows that do not pin root decisions.

---

## Phase 11 — Surgical section editing (`wire edit`) and decision Q&A (`wire why`)

**Status: PART-DONE, 30 September 2026.** Built and verified in unit tests (`packages/modules/wireframe/test/edit-why.test.ts`, 4/4 green; `packages/cli/test/surface.test.ts` and export ratchets green): `WireSpec.decisions`, `compactDecisions`, `recordDecisions`, and `explainWireDecision` in `why.ts`; `classifyTurn`, `routeTurn`, `scopeEdit`, `planEditWithJev`, and `editWireOnCanvas` in `edit.ts`; `isocan wire edit` and `isocan wire why` in `edit-cli.ts` and `agent-guide.md`; `/wire edit` and `/wire why` in `dialog.tsx`. Browser walk owed before closing.

**Outcome:** [journey.md](journey.md) scene 11, [design.md](design.md) §13.
`WireSpec` records compact `decisions` (top-3 probabilities and entropy per Jev
question) directly in the item's embedded JSON — no `.session.json` file on
disk. `packages/modules/wireframe/src/edit.ts` and `why.ts` implement:
- `isocan wire edit [<screen>] "<instruction>"` and `/wire edit <instruction>`:
  1-call Jev screen scoping (when no screen is selected/named) + 1-call batched
  `scopeEdit` (`kind: content | add | remove | variant | restyle`, `target`
  slot, `block`, `variant`) that mutates only the targeted slot in `WireSpec`,
  adds one version to the screen item, and rebuilds the flow's prototype via
  `ModuleMark.follow` in the same op group (one undo).
- `isocan wire why [<screen>] ["<question>"]` and `/wire why`: reads
  `WireSpec.decisions`, `need`, `by`, and `variations` from the canvas item and
  explains why the screen, archetype, template, blocks, and style mapping were
  chosen, citing the recorded probabilities.

**Proof:**

1. Unit tests (`packages/modules/wireframe/test/edit-why.test.ts`): `scopeEdit`
   correctly applies `content`, `add`, `remove`, `variant`, and `restyle` to a
   single slot while leaving all sibling slots, `flow`, `screen`, and `pinned`
   untouched; `wire edit` executes in one op group and updates the flow's
   prototype in the same group; `wire why` formats the recorded probabilities
   and runner-up alternatives from `WireSpec.decisions`.
2. Surface & browser walk: select a wireframe screen on the canvas, run
   `/wire edit` to swap one section's variant and add a block, verify one undo
   reverts both the screen version and the prototype version, and run
   `/wire why` to inspect the decision record in the Chat.
3. `packages/cli/test/surface.test.ts`, `npm test`, and `npm run typecheck`.

### Trajectory

- **2026-09-30** — `compactDecisions` stores up to the top-3 options (rounded to 3 decimal places) plus `entropy` (`_H` in bits) per question key in `WireSpec.decisions`, keeping the embedded JSON compact while giving `explainWireDecision` both the winning choice, its runner-up alternatives, and its uncertainty.
- **2026-09-30** — `editWireOnCanvas` uses `followFlowPrototype` (`ModuleMark.follow`) inside the same `opGroupId` as `version.add` + `item.update`, so any surgical edit on a kept screen re-renders the clickable prototype in one undoable canvas gesture.

---

## Phase 12 — Schema-driven AI copy (`wire copy --ai`) and flow naming (`wire name`)

**Status: PART-DONE, 30 September 2026.** Built and verified in unit tests (`packages/modules/wireframe/test/copy-schema.test.ts`, 4/4 green; `packages/modules/wireframe/test/flesh-cli.test.ts`, 8/8 green; `packages/cli/test/surface.test.ts` and export ratchets green): `JsonSchema`, `TextGenerator`, `stubTextGenerator`, and `httpTextGenerator` in `@isocan/core/jev`; `blockContentSchema`, `validateCopyPayload`, `generateWireCopy`, `sanitizeFlowTitle`, `flowNameSchema`, `nameFlow`, `copyAiOnCanvas`, and `nameFlowOnCanvas` in `copy-schema.ts`; `isocan wire copy --ai` and `isocan wire name` in `flesh-cli.ts` and `agent-guide.md`; `/wire copy` and `/wire name` in `dialog.tsx`. Browser walk owed before closing.

**Outcome:** [journey.md](journey.md) scene 12, [design.md](design.md) §14.
`packages/modules/wireframe/src/copy-schema.ts` builds a strict JSON schema
(`blockContentSchema(spec)`) from each screen's resolved blocks and variants,
plus `nameFlow(specs, request)` for coherent brand, screen title, and shared
navigation bar naming across a flow. `@isocan/core/jev` defines the
vendor-neutral `TextGenerator` seam (backed by standard HTTPS JSON-schema
completion when configured, the home proxy, or the `--answerer agent` file
seam, adding zero SDK dependencies). `isocan wire copy --ai` (and `/wire copy`
in the Chat) fills realistic domain copy and media-slot prompts across a screen
or flow and rebuilds the prototype in one op group, while keeping actionable
button labels bound to their typed `Intent`.

**Proof:**

1. Unit tests (`packages/modules/wireframe/test/copy-schema.test.ts`):
   `blockContentSchema` covers all 50 catalog components and their variants, rejects
   malformed payloads, and preserves every actionable `Intent`; `nameFlow`
   keeps shared tab-bar and top-bar labels identical across screens in a flow;
   `wire copy --ai` with a stub `TextGenerator` and `wire copy --apply` with an
   agent JSON file produce identical versioned screens and updated prototypes in
   one op group.
2. Browser walk: compose a flow, run `/wire copy`, verify screen titles,
   navigation labels, and block copy update coherently across both the canvas
   screens and the clickable prototype, and verify one undo restores the pack
   sample content.
3. `packages/cli/test/surface.test.ts`, `npm test`, and `npm run typecheck`.

### Trajectory

- **2026-09-30** — `blockContentSchema` derives each slot's replaceable dot-paths from `wordsOf(slot.fill)` (ensuring unfleshed slots are first shaped via `ensureFleshedForCopy`), omitting non-text slots (`heading`, `divider`, or motif-only fills) from `slots.properties` so strict JSON-schema generators never emit empty slot objects that `applyCopy` would reject.
- **2026-09-30** — Navigation bars (`tab-bar`, `side-nav`, `navbar`) render their item labels through `slot.fill.actions` (`item-1`, `item-2`, ...), so `nameFlow` writes the shared `navLabels` array into `slot.fill.actions` across every screen in the flow to keep bottom tabs and side navs identical.

---

## Phase 13 — Concurrent design system synthesis (`wire ds`) and Jev-budgeted polish (`wire polish`)

**Status: PART-DONE, 30 September 2026.** Built and verified in unit tests (`packages/modules/wireframe/test/ds-polish.test.ts`, 4/4 green; `packages/modules/wireframe/test/theme.test.ts`, 14/14 green; `packages/cli/test/surface.test.ts` and export ratchets green): `POLISH_TOKENS`, `WirePolishPatch`, and `WireSpec.polish` in `spec.ts` and `render.ts`; `DS_DIRECTIONS`, `repairContrast`, `proposeThenPick`, `synthesizeDesignSystem`, and `wireDsOnCanvas` in `ds.ts`; `POLISH_BUDGETS`, `polishIntensityBudget`, `verifyWireContract`, `applyWirePolish`, `planPolishWithJev`, and `polishWireOnCanvas` in `polish.ts`; `isocan wire ds` and `isocan wire polish` in `style-cli.ts` and `agent-guide.md`; `/wire ds` and `/wire polish` in `dialog.tsx`. Browser walk owed before closing.

**Outcome:** [journey.md](journey.md) scene 13, [design.md](design.md) §15.
`packages/modules/wireframe/src/ds.ts` and `polish.ts` implement:
- `isocan wire ds "<request>"` and `/wire ds <request>`: runs `proposeThenPick`
  (Jev selects the best visual direction, `surface:` mode, and `density` from
  candidate directions), synthesizes a complete `DESIGN.md` item on the canvas,
  runs deterministic WCAG AA ($\ge 4.5:1$) contrast validation and lightness
  self-repair (`repairContrast`) across all foreground/background token pairs,
  sets the governing system with `designUse`, and restyles the flow and its
  prototype in one op group (**Swap 1**).
- `isocan wire polish [<screens…>]` and `/wire polish`: Jev scores
  `polish_intensity` ($0\text{–}1$), mapping to a strict budget of
  `0 | 4 | 8 | 12` visual refinement patches stored in `WireSpec.polish` and
  keyed by `data-wf`/`data-sec` paths. Before writing a version (or applying a
  custom primitive override in **Swap 2**), `verifyWireContract` asserts that
  every `data-sec`, `data-wf`, `data-intent`, and `data-hotspot` node is
  preserved and every token contrast stays $\ge 4.5:1$.

**Proof:**

1. Unit tests (`packages/modules/wireframe/test/ds-polish.test.ts`):
   `repairContrast` repairs deliberately low-contrast token pairs to $\ge 4.5:1$
   and passes `design check` with zero warnings; `wire ds` creates the
   `DESIGN.md` item, governs the flow's scope, and restyles all screens +
   prototype in one op group; `polish_intensity` maps to budgets `0 | 4 | 8 |
   12`; `verifyWireContract` accepts valid `WireSpec.polish` patches and rejects
   any patch or override that drops a `data-wf` path or `data-intent` hotspot.
2. Browser walk: run `/wire ds` on a flow, verify the synthesized `DESIGN.md`
   lands on the canvas and restyles every screen and the prototype at AA
   contrast; run `/wire polish`, verify visual refinements apply while flow
   arrows and prototype click-through continue to work; undo once per act.
3. `packages/cli/test/surface.test.ts`, `npm test`, and `npm run typecheck`.

### Trajectory

- **2026-09-30** — `repairContrast` checks foreground role tokens (`ink`, `ink-muted`, `primary`) against both `ground` and `surface` simultaneously (`ensurePairContrast` against the worst of the two backgrounds), and `on-primary` against `primary`, nudging sRGB lightness in 2% steps so synthesized `DESIGN.md` items always pass `checkDesign` with zero AA contrast warnings.
- **2026-09-30** — `verifyWireContract` gates both `WireSpec.polish` patches and **Swap 2** custom primitive overrides by asserting that every `data-sec`, `data-wf`, `data-hot`, and `data-intent` attribute from the unpolished baseline HTML survives in the candidate HTML and every design-system token pair stays $\ge 4.5:1$ before writing a version.

---

## Phase 14 — Fidelity layers, and the tier pill under the screen

**Status: CLOSED, 2 October 2026.** Built, unit-tested
(`packages/modules/wireframe/test/layers.test.ts`), walked in headless Chrome
at 11% and 67% zoom, and promoted to isocan.io the same day (`b63c2f8a`,
`966cf697`). The in-frame overlay that the first cut drew inside every screen
was stripped from the eleven screens it had been stamped on.

**Outcome:** a wireframe screen carries four layers over its wires — `System`
(design-system tokens and domain copy), `Copy`, `Low-Fi` (fluid cards and real
controls) and `High-Fi` (art-directed visual craft) — resolved per item
(`layers.ts`: `resolveItemLayers`, `tierFromLayers`) and switched
non-destructively: each tier's version pointer is kept on the item
(`wireLayer:wire|system|lofi|hifi`), so going back to the wires is a pointer
move, not a regeneration, and one op group. From the terminal,
`isocan wire layer [directive] [<screens…>] [--flow <flow>] [--list]`
(`+system`, `-hifi`, `toggle:copy`, or a tier name); on the canvas, a tier pill
under the screen.

The pill is the part that took three tries, and the reason is written here so
nobody tries the first two again:

1. **A HUD inside the frame** covered the bottom of the design and needed a
   double click (the frame takes the first). Rejected on sight.
2. **A five-pill bar under the screen** — `Wires · ☑System · ☑Copy · ☑Low-Fi ·
   ☑High-Fi · Sync flow` — sat in the right lane, but the lane is
   counter-scaled: zoomed out it was wider than the screen and lay across
   *Full screen* and the size pill. And "Sync flow" said nothing about what it
   did.
3. **One pill, a popover for the rest** (`layers-bar.tsx`): `◧ High-Fi ▾`, the
   size of the size pill beside it, on hover and on selection. Clicking it
   selects the screen and opens a popover with the four checkboxes and one row
   that says what it does — *Apply to all 11 screens in “Showcase”* — the
   flow's name from its group, the count from its screens; disabled for a
   screen that stands alone. It stays open while toggling, closes on Escape or
   a click outside, and belongs to the screen it opened on rather than
   following the pointer. Several selected screens at different tiers read
   `Mixed`. Under 300 on-screen pixels of screen width the pill waits for a
   zoom with room, unless it is already open.

**Proof:**
1. Unit tests (`layers.test.ts`): layer flags render without erasing spec
   style or copy; a `WireSpec` embedded in bespoke High-Fi HTML reads back;
   `applyLayersOnCanvas` switches between saved version pointers; the bar
   renders closed as one pill anchored at `y + height`; `applyToFlowLabel`
   says the count and the flow.
2. Browser walk (headless Chrome against a scratch daemon, 2 Oct): at 11% the
   pill waits; after ⇧2 the pill shows on hover without a popover and does not
   overlap the screen; one click selects the screen and opens the popover with
   four unchecked layers and *Apply to all 10 screens →*; Escape closes it.
3. `tokens.test.ts` (the popover's shadow is `--shadow-pop`),
   `oneblock.test.ts`, `surface.test.ts`, `npm run typecheck`, the web build.

### Trajectory

- **2026-10-02** — The lane under a screen is shared and counter-scaled, so
  anything placed there has to be the size of what is already there; detail
  goes one click away, not beside. The same will hold for any future
  per-screen control.
- **2026-10-02** — A flow's name is its group's title when the flow id names a
  group on the canvas; a bare `grp_…` id is never shown.
- **2026-10-02** — `grid.test.ts` and `place.test.ts` run at their 30/40 s
  budget on a loaded machine and time out whenever the deep lane runs beside
  anything else; green alone and on CI. Not this phase's, but found by it.
