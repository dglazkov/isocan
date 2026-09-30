---
status: partial
since: 2026-09-30
see: wireframes, judge, design-partner, slides, modules
note: the ideal, as scenes. Phases 0–8 closed 23–24 Sep 2026 and were walked on isocan.io: skeleton-first composition with Jev, sample content packs, maybe screens and uncertainty variations, clickable prototype above the row, true flow arrows, and DESIGN.md restyling (#350). Wave 2 (#369, phases 9–13, 30 Sep 2026) ports the best of the standalone Jev design pipeline into pure TypeScript: phase 9 built (7 multi-region @container layout templates + density + data-wf/data-sec paths); phase 10 built (PriorityGate and entropy-gated /ask on root decisions); phase 11 (wire edit and wire why) is next, followed by phase 12 (wire copy --ai and wire name) and phase 13 (wire ds + wire polish).
issue: 369
---

# Wireframes — the journey

Asked for by Dion on 23 September 2026: *when the user asks for wireframes,
use Jev to go through a series of wireframe components and show examples of
screens that put them together to match the prompt; show variations; when the
user tags a series of screens, assemble a prototype app from them, doing all
you can to make the obvious transitions.* And, the same day: *start with a
skeleton in the typical blue on white so it LOOKS like a wire is starting.*

These scenes are the acceptance suite. Mechanism appears only where a scene
forced it; [design.md](design.md) is the mechanism and
[phases.md](phases.md) the walk. The research under all of it is
[Wireframes a typed model can choose](../../research/2026-09-23-wireframe-components.md)
and [What a second Jev wireframe builder got right](../../research/2026-09-30-jev-isocan-synthesis.md).

## 1. A wire starts

Priya types in the Chat, or an agent runs in a terminal:

> wireframes for a stock-receiving app for warehouse staff — sign in, scan
> deliveries, see what's outstanding

Within a second the canvas has a row of screens, each one a **blueprint**:
thin blue rules on white, a labelled box per slot — *app bar*, *main*,
*tab bar* — and the screen's name above it (*Sign in*, *Home*, *Deliveries*,
*Delivery*, *Scan*). Nothing is finished and nothing pretends to be. Then the
boxes fill, slot by slot, in grey: a sign-in form, a stats row, a list of
deliveries with a search field, a detail header with a table of lines. The
blue skeleton is how you know it is still being drawn; the grey is what was
chosen.

**And then it reads like the app** (24 Sep 2026). A composed flow arrives
fleshed — sample content from a pack Jev picked for this request (scene 7) —
unless she asked for `/wire basic`, which keeps plain grey wires. A screen Jev
was unsure the request needs is drawn in its place all the same, with a dashed
outline and a *maybe* tag: the flow over-includes and lets her prune, because
Jev's confidence ranks screens well and excludes them badly (phases.md,
phase 6).

The same act from the CLI:

```
isocan wire "a stock-receiving app for warehouse staff — sign in, scan deliveries, see what's outstanding"
```

prints each screen as it lands and the one line that says where they are.
From the Chat, the act leaves one message — the Wire builder's — saying what
was made and what it cost.

**What the scene forces:** a screen exists on the canvas before any model has
answered (a skeleton is a real item, not a spinner); it fills in place rather
than being replaced; both surfaces make the same screens from the same
request; a screen the model was unsure of is shown, marked, rather than
left out.

## 2. The words are real, or honestly missing

The buttons say *Sign in*, *Scan*, *Receive all*, *Back* — because each button
carries an **intent**, and an intent has a label. Headings come from the
screen's archetype. Body copy is never lorem ipsum: it is sample content
chosen from a pack (scene 7) or, in a basic flow, grey bars — Jev writes no
prose and the screen does not pretend it did. The exact words are an agent's
or a person's to write.

**What the scene forces:** actionable text is typed, never free; nothing
invents prose it cannot justify.

## 3. Variations where the model was unsure

Under *Deliveries* sit two siblings: one where the list is a table, one where
it is cards. Under *Sign in*, none — Jev was certain, and the screen says so
(*one way to draw this*). Variations are spent where the model's own
distribution was split, not sprinkled evenly.

**What the scene forces:** variations come from the distribution of the
first answer, not from asking again; a screen with no honest alternative
says so rather than inventing one.

## 4. What goes in the prototype

The flow has already chosen (24 Sep 2026): every screen Jev was confident the
request needs has its first choice marked for the prototype (📐) — never a
*maybe*, never a variation — and the mark says the answerer put it there.
Priya corrects it the way she marks slides for a deck: the table version of
*Deliveries* instead of the cards, the *maybe* for *Settings* in after all.
The words say what the mark does — *Use in prototype*, *Remove from
prototype* — from the item's menu, ⇧K, or

```
isocan wire use <items…>
```

Anyone can take a mark off. Unmarked siblings stay on the canvas; nothing is
deleted.

**What the scene forces:** a keep mark is a property on the item (as a slide
is), not a reaction — a reaction belongs to the person who left it, so nobody
else could remove it — and it records who put it on, because a screen the
flow chose and one a person chose are different evidence.

## 5. The prototype assembles itself

`/wire` ends by adding one more item above the row, and *Make prototype* (or
`isocan wire prototype`) makes it again whenever she wants: the kept screens as
one clickable app. *Sign in* goes to *Home*. A delivery row opens
*Delivery*. The tab bar switches between *Home* and *Deliveries*. *Back*
goes back. The *Scan* button opens *Scan*. A hotspot whose target was never
kept — *Settings*, say — is drawn dashed and says which screen it needs.

On the canvas the same links are drawn as arrows between the screens — true
arrows that start at the hotspot and route over the row without crossing — and
an arrow can be clicked: *Play from here*, *Go to*, *Change target…*,
*Remove*. Put a screen in or take one out, and the prototype gains a version;
it is never replaced.

**What the scene forces:** links are computed from intents, archetypes and
canvas order, and only a person's own change is stored, per hotspot — so a
recompute never drifts and never loses a choice somebody made; the prototype is one
self-contained HTML item (it plays anywhere, as `deck.html` does); missing
targets are named, not silently dropped.

## 6. In your design system

The canvas has a design system — a `DESIGN.md` Priya imported from her
team's tokens. Until now the wires were the default look: greys, one dark
primary, system type. She chooses the system (or it already governs the
canvas, or the group the flow sits in), and every wire changes: the primary
button takes the brand colour, the type is the brand's, corners and spacing
follow its scale. The blueprints stay blue — blue means *still being drawn*,
in any system. Undo, and they are all grey again; one undo, because it was
one act.

A flow asked for on a canvas that already has a system arrives in it.

```
isocan wire style                 # restyle every wire to the governing system
isocan wire style --default       # back to the default wire look
```

**What the scene forces:** a wire's look is a theme applied to the same
spec, never a different screen; the theme comes from the governing design
system when there is one; mapping a system's tokens onto the wire's roles
is a typed choice (which of *these* colours is the primary action?) — Jev's
kind of question, never an invented colour; restyling is one op group, and
each screen gains a version rather than being replaced.

## 7. Fleshed out

A basic flow's screens are honest and a little bare: grey bars where the words
go. Priya says `/wire flesh` — which a composed flow no longer needs, because
since 24 Sep it arrives this way. Every wire fills with believable content for *this*
app — the deliveries list shows "Parcel 4471 · 3 items · Out for delivery",
"Parcel 4478 · 1 item · Awaiting scan"; the home stats read "12 today · 3
late"; image slots show little greyscale pictograms of parcels; the people are
first names with initials in their avatars. It is still a wireframe — grey,
or her design system's colours — but it reads like the app. The prototype
clicks through the same content. An agent can then write the exact words for
the screens that matter.

**What the scene forces:** sample content is chosen, not invented (a pack Jev
picks, overridable); it is stable across restyles, variations and the
prototype; exact copy is an agent's or a person's, never the typed model's.

## 8. It is still an ordinary canvas

Every screen is an HTML item. Comment on it, draw on it, undo it — one undo
takes back a whole *wire* request, its record in the Chat included. That
record says what was made and summons no agent. On a busy canvas the
prototypes light up on the minimap. Take the wireframes module away and every
screen still renders; only the verbs are gone.

---

*Added 30 September 2026 ([synthesis research](../../research/2026-09-30-jev-isocan-synthesis.md),
[#369](https://github.com/dglazkov/isocan/issues/369)): scenes 1–8 build a
flow from a vertical stack of blocks. Scenes 9–13 add multi-region desktop and
tablet layouts, entropy-gated clarification when a root choice is split,
surgical single-section edits and decision Q&A, schema-driven copy, and
two-stage design system synthesis — all in pure TypeScript on the same embedded
`WireSpec`.*

## 9. Layouts that are not a single column

Priya asks for a warehouse dispatch console on desktop:

> wireframes for a desktop dispatch console — live fleet map and alerts, split
> order queue with detail drawer, and weekly throughput dashboard

A desktop dashboard is not a phone stack stretched to 1280px. *Throughput*
lands in a `dashboard` template — a top KPI strip over a two-column chart and
activity region. *Orders* lands in `master_detail` — a 320px queue rail beside
the selected order's detail pane. *Overview* lands in `bento`. Inside each
screen, `@container` rules collapse the regions cleanly when viewed narrow, and
Jev's `density` score (`compact` for the dispatch queue, `spacious` for a
marketing hero) sets the spacing scale. Every section carries a stable
`data-sec` and `data-wf` path alongside its `data-intent` hotspots, so flow
arrows still leave from the exact button inside its region.

**What the scene forces:** a template catalog (`single`, `split`,
`master_detail`, `grid`, `bento`, `hero_then_grid`, `dashboard`) rendered with
pure CSS `@container` queries in `renderWire(spec)`; Round 2 choosing the
screen's template, assigning slots to regions, and scoring `density`; and
stable `data-sec` / `data-wf` attributes on every rendered block.

## 10. Asking when the root decision is a coin toss

Priya types a deliberately terse brief:

> wireframes for Acme Pulse

Is that a mobile consumer fitness app, a desktop team-health dashboard, or a
watch companion? Instead of guessing at 0.36 probability and spending thirty
screens on the wrong platform, the composer checks the Shannon entropy of Jev's
root distribution (`platform`, `pack`, `direction`). When entropy exceeds
1.0 bit, `/wire` posts an `/ask` on the canvas (or prints the 3-option prompt
in the CLI) with Jev's top three candidates and their probabilities: *Mobile
app (38%) · Desktop web app (35%) · Marketing site (19%)*. Priya clicks
*Desktop web app*; her choice is pinned in `WireSpec.pinned`, and the flow
composes immediately without asking again on future edits. Passing `--no-ask`
takes Jev's top pick without stopping.

**What the scene forces:** `entropyBits` and `gatedChoice` in
`@isocan/core/jev`, a `PriorityGate` so interactive turns jump ahead of
background polish, and `pinned` on `WireSpec` so a clarified root decision
sticks across edits and variations.

## 11. Changing one section, and asking why

Looking at the *Deliveries* screen, Priya wants the filter bar replaced with a
segmented status toggle and wants to know why *Scan* was drawn as a modal sheet
instead of a full screen. She selects *Deliveries* and types:

> /wire edit swap the filter bar for segmented status tabs

or in the terminal:

```
isocan wire edit <screen> "swap the filter bar for segmented status tabs"
```

One batched Jev call scopes the edit (`kind: "variant"`, `target: " slot_1"`)
and mutates **only that slot** in `WireSpec`. *Deliveries* gains one version in
two seconds, and `ModuleMark.follow` updates the flow's clickable prototype in
the same op group. Then she asks:

```
isocan wire why <screen> "why is this a master-detail layout?"
```

and `/wire why` reads the decision distributions stored in the screen's own
`<script id="isocan-wireframe">` (`master_detail: 0.64, split: 0.21, single:
0.09`) and answers from the recorded numbers — no local `.session.json` file
required.

**What the scene forces:** `wire edit` / `/wire edit` (1-call Jev turn router +
`scopeEdit` over `content | add | remove | variant | restyle`, mutating one
slot and rebuilding the prototype in one op group) and `wire why` / `/wire why`
reading compact `decisions` recorded on `WireSpec`.

## 12. Words and media written to the screen's exact schema

Sample packs (scene 7) fill a flow in zero model milliseconds, but before
showing the prototype to warehouse staff Priya wants copy written for *her*
exact prompt ("cold-chain biologics receiving at Dock 4"). She runs:

```
isocan wire copy --ai
```

or `/wire copy` in the Chat. For each screen in the flow, the module derives a
strict JSON schema from its chosen blocks and variants (`blockContentSchema`),
names the brand, screens, and shared navigation items coherently across the
flow (`nameFlow`), and fills every slot and media prompt in one structured pass
behind a vendor-neutral `TextGenerator` seam (or writes the schema questions
for `--answerer agent` when no text model key is configured). One op group
versions every screen and rebuilds the prototype.

**What the scene forces:** `blockContentSchema(spec)` derived from the block
catalog, `nameFlow` for cross-screen navigation coherence, and a
vendor-neutral `TextGenerator` seam in core that works with standard HTTPS
JSON-schema endpoints, the home, or the `--answerer agent` file seam.

## 13. Synthesizing a design system and a guarded polish pass

When a canvas has no `DESIGN.md` yet and none of the seven built-in presets is
quite right, Priya runs:

```
isocan wire ds "industrial high-contrast amber for warehouse scanners"
```

Jev scores 4–5 candidate visual directions (`proposeThenPick`), synthesizes a
complete `DESIGN.md` item on the canvas, checks and self-repairs every
foreground/background pair to WCAG AA (4.5:1) contrast, and restyles the flow
(**Swap 1**). When she wants finer visual hierarchy on a hero screen, `isocan
wire polish <screen>` asks Jev for `polish_intensity` — mapping its 0–1 score
to a strict budget of `0 | 4 | 8 | 12` class patches stored in
`WireSpec.polish` — and verifies before writing that every `data-wf` and
`data-intent` node is preserved so flow arrows and the prototype never break.

**What the scene forces:** `wire ds` (`proposeThenPick` + `DESIGN.md` synthesis
+ deterministic 4.5:1 contrast repair in one op group) and `wire polish`
(Jev-budgeted class patches on `WireSpec.polish` guarded by `data-wf` and
`data-intent` equivalence).

---

**What the scenes force, together — the load-bearing minimum:**

1. A catalog of blocks, archetype recipes, and 7 responsive `@container` layout
   templates, as data, with a renderer that draws a spec as a blue skeleton
   (unresolved) or grey wireframe (resolved) with stable `data-sec`/`data-wf`
   element paths.
2. A composer that asks Jev in rounds through a concurrency-bounded
   `PriorityGate`, gates high-entropy root decisions with `/ask`, and writes
   each answer and its compact decision distribution into the screen in place.
3. Variations from the distribution; *maybe* screens where round 1 was
   unsure; a keep mark as a property that says who put it on, set first by
   the flow.
4. Link inference from intents and a prototype assembler, in core, so both
   surfaces produce the same prototype; a person's per-hotspot overrides
   stored beside it; arrows drawn from the same links.
5. A theme and synthesis layer: the default wire look, a governing `DESIGN.md`
   mapped onto the wire's roles, or a newly synthesized `DESIGN.md` (`wire ds`)
   with deterministic AA contrast repair and Jev-budgeted `wire polish` patches
   that preserve `data-wf` and `data-intent`.
6. Sample content from packs Jev chooses on by default, plus schema-driven AI
   copy (`wire copy --ai`) and surgical single-slot edits (`wire edit`) and
   decision Q&A (`wire why`).
7. No new operation, and zero external sidecar processes.

