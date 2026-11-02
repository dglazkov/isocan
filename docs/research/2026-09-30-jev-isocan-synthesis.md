---
status: noted
since: 2026-09-30
see: wireframes, judge
issue: 369
note: compared a three-process Python/Go/React Jev design prototype (42 blocks, 7 responsive layout templates, entropy-gated /ask, surgical single-section edits, schema-driven AI copy, concurrent two-stage design-system swap, Jev-budgeted class polish) against @isocan/module-wireframe (18 Enrico archetypes, 28 blocks, 49 typed intents, embedded WireSpec, uncertainty variations, true flow arrows, clickable prototype). Designed the pure-TypeScript synthesis as wireframes phases 9–13 (#369) with zero external sidecars or non-standard dependencies.
---

# What a second Jev wireframe builder got right, and how it fits in `/wire`

**30 September 2026.** Two Jev-driven screen builders grew in parallel from the
same starting observation — that a System One model returning calibrated
probability distributions over a fixed catalog can choose screen structure in
hundreds of milliseconds where a generative model spends thirty seconds writing
HTML:

1. **`@isocan/module-wireframe` (`/wire`, [wireframes](../projects/wireframes/))**
   — pure TypeScript inside this repository (`packages/core/src/jev.ts` and
   `packages/modules/wireframe/`), built around self-contained canvas HTML items
   that carry their own `<script type="application/json" id="isocan-wireframe">`
   spec, one op group per user-visible act, 49 typed action intents (`Intent`),
   deterministic link inference, orthogonal canvas arrows, and a self-contained
   clickable prototype item.
2. **A standalone three-process Jev design prototype** — a Python orchestrator,
   a Go HTTP concurrency/retry gateway, and a Node/React/Tailwind SSR render
   sidecar that takes a prompt from a 1.5-second structural wireframe to an
   AI-copy-filled screen, then a token-swapped and custom-primitive-swapped
   high-fidelity screen, and supports conversational follow-up turns (`route` →
   `edit_screen` / `edit_ds` / `answer_question`).

Neither is a superset of the other. The standalone prototype has no typed
action intents, no flow arrows, no clickable prototype, no calibration corpus,
and loses its structured spec once a screen is written to the canvas (holding
state in a local `.session.json` file instead of the item). `/wire` has only a
single vertical stack per screen, no entropy-based clarification when a prompt
is underspecified, no surgical single-section edit verb, no decision-history
Q&A, and no concurrent design-system synthesis or guarded polish pass.

Every mechanism the standalone prototype proved can be ported into **pure,
vendor-neutral TypeScript** inside `@isocan/core` and `@isocan/module-wireframe`
— with no Python, no Go gateway, no React/Tailwind SSR sidecar, and zero new
canvas operations.

---

## 1. Side-by-side comparison

| Dimension | Standalone Jev prototype (Python + Go + React SSR) | Isocan `/wire` (`@isocan/core` + `@isocan/module-wireframe`) | Verdict for the synthesis |
| --- | --- | --- | --- |
| **Runtime & dependencies** | 3 processes: Python orchestrator, Go HTTP gateway, Node React+Tailwind SSR sidecar | Pure TypeScript in `@isocan/core` and `@isocan/module-wireframe`; zero external sidecars | **Keep `/wire`'s pure TypeScript architecture**; port the Go gateway's `PriorityGate` and Python's stage logic into `@isocan/core/jev` and `@isocan/module-wireframe`. |
| **State persistence** | Local `.session.json` on the runner's disk; canvas items hold rendered HTML only | Every screen item embeds `<script id="isocan-wireframe">` (`WireSpec`); stateless across machines and actors | **Keep embedded `WireSpec`**; extend it with `template`, `density`, `pinned`, `decisions`, and `polish` so no local `.session.json` ever exists. |
| **Canvas undo & history** | Direct HTTP item/property writes; multi-step swaps leave separate operations | Single `opGroup` per user-visible act; `item.addVersion` stacks history; `ModuleMark.follow` updates the prototype in the same group | **Keep `/wire`'s single op-group discipline** across every new verb. |
| **Catalog & layout** | 12 archetypes, 42 blocks (119 variants), **7 multi-region `@container` layout templates** (`single`, `split`, `master_detail`, `grid`, `bento`, `hero_then_grid`, `dashboard`), plus a per-screen `density` score | 18 Enrico-calibrated archetypes (90.7% coverage of 1,460 screens), 28 blocks, **single vertical stack only** | **Combine:** keep the 18 Enrico archetypes and add the 7 multi-region `@container` layout templates + Round 2 region assignment + `density` score. |
| **Ambiguity & `/ask`** | **Shannon entropy gate** (`entropyBits > 1.0` or `confidence < threshold`) on root decisions triggers a 3-option user question and pins the answer | Over-includes screens in the `0.3 ≤ P < 0.5` *maybe* band and spawns variations when a slot's runner-up is within `0.15` | **Use both:** entropy-gated `/ask` on root flow decisions (`platform`, `pack`, `direction`); *maybe* screens and sibling variations on screen/slot decisions. |
| **Copy & media** | Dynamic JSON content schema built from each screen's chosen blocks/variants (`block_content_schema`) filled by a fast text model + coherent screen/nav naming (`name_screens`) + media slot prompts | 24 deterministic seeded domain packs (`flesh.ts`) + manual `wire copy` question/answer JSON | **Layer both:** instant deterministic pack fill on Round 3, plus `wire copy --ai` (and `wire name`) using dynamic per-screen JSON schemas behind a vendor-neutral `TextGenerator` seam. |
| **Conversational edits** | **1-call Jev turn router** (`build_screens \| edit_screen \| edit_ds \| answer_question`) + **`scope_edit`** (mutates 1 section: `content \| add \| remove \| variant \| restyle`) + **`answer_question`** citing logged Jev probabilities | Whole-flow re-composition, `wire vary`, `wire style`, or manual spec surgery | **Port `wire edit` and `wire why`:** surgical single-slot edits on `WireSpec` in 1 op group (with automatic prototype rebuild) and decision Q&A read straight from the item's embedded `WireSpec`. |
| **Design system & polish** | **`propose_then_pick`** (4–5 candidate directions → Jev picks → token generation → Swap 1 token restyle + 4.5:1 AA contrast repair → Swap 2 custom primitives with `data-wf` check) + Jev-budgeted class polish (`0 \| 4 \| 8 \| 12` ops) | `wire style` maps an existing `DESIGN.md` or 7 built-in presets + 4 `surface:` modes (`flat \| raised \| glass \| bold`) | **Port `wire ds` and `wire polish`:** direction synthesis into a real `DESIGN.md` item on the canvas (Swap 1), contract-checked block overrides preserving `data-wf` and `data-intent` (Swap 2), and Jev-budgeted polish patches. |
| **Links, arrows & prototype** | None — screens are isolated visual artifacts | 49 typed `Intent` values, deterministic `inferLinks`, orthogonal canvas arrows, self-contained clickable prototype item | **Keep `/wire`'s intent and prototype engine**; require every template and primitive override to preserve `data-intent` and `data-wf`. |

---

## 2. What ports from Go and Python into pure TypeScript

### 2.1 From the Go gateway → `packages/core/src/jev.ts`

The standalone prototype used a Go binary in front of System One for two
reasons that matter in pure TypeScript and one that does not:

- **What does not apply:** internal RPC/credential translation. `@isocan/core/jev`
  already speaks directly to `https://api.typesafe.ai/v1/systemone` (`jevAnswerer`),
  to the canvas home's `/api/judgment` proxy (`homeAnswerer`), to `stubAnswerer`
  in tests, and to the `--answerer agent` file seam.
- **What ports cleanly into `packages/core/src/jev.ts`:**
  1. **`PriorityGate`** — a ~60-line zero-dependency TypeScript class wrapping an
     `Answerer`. Interactive user turns (`wire`, `wire edit`, `wire why`) run at
     `priority: "high"`; background work (`wire polish`, multi-flow batching)
     runs at `priority: "normal"` and yields when a high-priority request
     arrives, bounded by a configurable concurrency limit (default 8) and
     per-call retry with exponential backoff on `429`/`529`.
  2. **Shannon entropy (`entropyBits`) and `gatedChoice`** — for a probability
     distribution $P$ returned by a `choice` question,
     $$H(P) = -\sum_{p_i > 0} p_i \log_2(p_i)$$
     measures how split the judge is across *all* options, complementing top-two
     margin (`p_1 - p_2`). When a root decision (`platform`, `pack`, or
     `direction`) has $H(P) > 1.0\text{ bit}$ or `confidence < threshold`,
     `gatedChoice` returns `{ status: "ask", topOptions }` (the top 3 options
     with their probabilities) unless the caller passed `--no-ask` or a pinned
     value in `WireSpec.pinned`.

### 2.2 From the Python orchestrator → `packages/modules/wireframe/src/`

1. **Multi-region layout templates (`catalog/templates.ts`, `render.ts`):**
   Seven responsive layout templates using pure CSS `@container` queries inside
   the existing zero-dependency wireframe stylesheet:
   - `single` — vertical stack (today's layout, byte-identical when chosen)
   - `split` — two equal columns (`main`, `side`) above 640px container width
   - `master_detail` — 320px list rail (`list`) + fluid detail pane (`detail`)
   - `grid` — responsive 2–3 column card grid (`cells`)
   - `bento` — asymmetric feature grid (`hero`, `wide`, `tall`, `cells`)
   - `hero_then_grid` — full-width header/hero region (`top`) over a 2–3 column grid (`grid`)
   - `dashboard` — top KPI strip (`kpis`) + main chart/table region (`main`) + side feed (`side`)
   Round 2 adds a `template` choice (filtered by archetype compatibility), a
   `density` score (`compact` $< 0.35$, `default` $0.35\text{–}0.65$, `spacious`
   $> 0.65$ mapped to `--wf-space`), and per-slot region assignment when the
   chosen template has more than one region.
2. **Stable element path contract (`data-wf`, `data-sec`):**
   Every rendered section emits `data-sec="<slot>"` and every addressable
   sub-element emits `data-wf="<slot>.<element>"` alongside `data-intent`. This
   gives `wire edit`, `wire polish`, `version-diff`, and hotspot measurement one
   canonical selector vocabulary.
3. **Turn router and surgical section edits (`edit.ts`):**
   `isocan wire edit [<screen>] "<instruction>"` (and `/wire edit` in the Chat)
   runs a 1-call Jev scope+action batch:
   - If no screen item was explicitly passed or selected, a Jev `choice` over the
     flow's screen titles + archetypes picks the target screen.
   - One batched Jev call picks `kind` (`content | add | remove | variant | restyle`),
     `target` slot (from the screen's current `slots`), and `block` / `variant`
     (when adding or flipping a variant).
   - Only that slot in `WireSpec` is mutated; the screen re-renders in place as a
     new version, and `ModuleMark.follow` rebuilds the flow's prototype in the
     same op group.
4. **Decision Q&A (`why.ts`):**
   Every Jev round records its compact top-3 distribution on `WireSpec.decisions`
   (extending the existing `need`, `by`, and `packProb` fields). `isocan wire why
   [<screen>] ["<question>"]` (and `/wire why`) reads `WireSpec.decisions` from
   the canvas item and answers why that archetype, template, block, variation,
   or style mapping was chosen — citing the recorded probabilities without
   needing a local session file.
5. **Schema-driven AI copy and flow naming (`copy-schema.ts`, `generator.ts`):**
   `blockContentSchema(spec)` builds a strict JSON schema for the exact slots
   and variants on a screen. A vendor-neutral `TextGenerator` seam in
   `@isocan/core` (backed by standard HTTPS JSON-schema endpoints when
   configured, the home's proxy, or the `--answerer agent` file seam so the core
   package adds zero SDK dependencies) fills realistic copy (`wire copy --ai`)
   and coherent brand/screen/nav names across a flow (`wire name`), then
   rebuilds the prototype in the same op group.
6. **Concurrent design system synthesis and guarded polish (`ds.ts`, `polish.ts`):**
   - `wire ds "<request>"` runs `proposeThenPick`: generates 4–5 candidate visual
     directions, asks Jev to pick the best match for the flow's domain and
     platform, synthesizes a complete `DESIGN.md` item on the canvas, runs a
     deterministic WCAG AA (4.5:1) contrast check and lightness repair on
     `colors.*` vs `on-*` pairs, and restyles the flow (Swap 1).
   - Guarded polish (`wire polish`) asks Jev for `polish_intensity` (mapping the
     0–1 score to an op budget of `0 | 4 | 8 | 12` class patches) and applies
     only safe, bounded visual utility tokens stored in `WireSpec.polish`,
     verified by a pure contract check that `data-wf` and `data-intent` nodes
     before and after are identical.
