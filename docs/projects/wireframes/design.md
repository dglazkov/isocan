---
status: partial
since: 2026-09-30
see: wireframes, judge, design-partner, slides, modules, mindmap
note: the mechanism. Screens are HTML items carrying their spec as embedded JSON; a module holds the catalog (archetype recipes, blocks, primitives, intents, and 7 @container layout templates), the renderer (blue skeleton → grey wireframe with data-sec/data-wf paths), the Jev composer (three rounds behind a PriorityGate and entropy-gated /ask), link inference and the prototype assembler, surgical single-slot edits (wire edit) and decision Q&A (wire why), schema-driven AI copy (wire copy --ai), and a theme/synthesis layer (wire style, wire ds, wire polish). No new op, and zero external sidecars.
issue: 369
---

# Wireframes — the design

The research is
[Wireframes a typed model can choose](../../research/2026-09-23-wireframe-components.md)
and [What a second Jev wireframe builder got right](../../research/2026-09-30-jev-isocan-synthesis.md);
read their short versions before this. The journey is [journey.md](journey.md).
This doc names the pieces and the lines between them.

## The debt it discharges

design-partner records `fidelity: "wireframe"` and delivers nothing different
for it: an agent writes a full HTML screen at lower fidelity, slowly and at a
model's price. There is no catalog, no cheap generator, and no way from a set
of screens to something you can click through. The decision half of the loop
(`prefer`, `choose`, `design compare`) is built and waiting for a cheap source
of alternatives.

## The pieces

### 1. The spec — what a screen is

A screen is **an HTML item** whose file carries its own spec:

```html
<!-- isocan:wireframe -->
<script type="application/json" id="isocan-wireframe">{ …spec… }</script>
<style>…</style>
<main>…rendered…</main>
```

So it renders anywhere an HTML item renders, survives the module's removal,
and a CLI can read it back with no DOM. The spec:

```ts
interface WireSpec {
  v: 1;
  request: string;          // the words that asked for it
  flow: string;             // id shared by every screen of one request
  archetype: ArchetypeId;   // "sign-in", "home", "list", "detail", …
  title: string;            // from the archetype, or an agent
  platform: "app" | "web" | "site";
  slots: WireSlot[];        // in recipe order
  variantOf?: string;       // item id of the screen this varies
  need?: number;            // round 1's P(yes) for this archetype (§4)
  maybe?: true;             // round 1 was unsure: drawn, marked until kept
}
interface WireSlot {
  slot: string;             // "app-bar", "main", "tab-bar", …
  block: BlockId | null;    // null = not yet chosen → drawn as skeleton
  props: Record<string, string | number | boolean>;
  intents?: Record<string, IntentId>;  // actionable element → intent
  p?: number;               // the probability Jev gave the chosen block
  alternatives?: Array<{ block: BlockId; p: number }>;  // runner-ups
}
```

`block: null` is the skeleton state. A spec with every slot null is a
blueprint; one with every slot chosen is a wireframe; anything between is a
wire being drawn.

### 2. The catalog — data, not code

In the module's core (`packages/modules/wireframe/src/catalog/`):

- **Archetypes** — wave 1's 18 recipes (research §2): each an ordered list of
  slots, each slot fixed, optional (yes/no) or a choice among 2–4 blocks.
- **Blocks** — wave 1's 28 composites (research §1, *Blocks*): each with typed
  props (`choice` enums, flags, counts as `score`), the actionable elements
  that take an intent, and a draw function over primitives.
- **Primitives** — the 22 the recipes name directly: button, text-field,
  list-item, image, avatar, tab, … Each draws itself in both modes.
- **Intents** — the 52-value vocabulary (research §3's 49, and since 24 Sep 2026 three tab targets — `open-list`, `open-feed`, `open-gallery` — so a tab can say it IS one of the flow's screens), each with a label and,
  where it has one, a navigation rule.

Everything a Jev question offers is an id from these tables, so a question's
options are generated, never typed by hand. The one exception is how an
archetype *reads* to the model: `ARCHETYPE_WORDS` says each in plain words
("a list of things you can scroll…"), round 1 asks about each in them, and
an answer maps back to the id — the spec never holds the words. On 350 of
Enrico's screens they read 1–3 points more accurately than the recipe's
component ids, for ~20% fewer input tokens, with calibration unchanged
(ECE ~0.35).

### 3. The renderer — skeleton, then wire

`renderWire(spec): string` — pure, in the module's core, used by both
surfaces. Two looks, one layout:

- **Skeleton** (a slot with `block: null`): the classic blueprint — white
  ground, 1px blue rules (`#2f6fed` family), the slot's name in small blue
  caps, dashed where a slot is optional and undecided. A whole blueprint is
  what appears the instant a request is made.
- **Wire** (a chosen block): greyscale, from the design-competition IDEO
  pack's tokens — grey fills, dark grey text, one accent grey for the primary
  action. Real labels on actionable elements (from intents); grey bars for body
  copy.

The screen is sized to its platform (app 390×844, web 1280×800, site
1280×auto) and scales on the canvas like any item.

### 4. The composer — asking Jev

Three rounds, as the research's question plan, each round's `state` carrying
the request and the previous answers, calls within a round in parallel:

1. **Flow** — which archetypes the request needs (one yes/no each), the
   platform, the nav pattern, the header alternative. Fixes the chrome for
   every screen, so a flow is coherent. It **over-includes and lets keep
   prune** (phase 6: Jev's P(yes) orders screens but is overconfident by
   ~0.4, so it cannot exclude them): P(yes) ≥ 0.5 is a screen of the flow,
   0.3 up to 0.5 is drawn in its running place marked *maybe* (`maybe` on
   the spec, `wireMaybe` on the item from the op that adds it; the canvas
   draws a dashed blue outline and tag outside the screen while it is not
   kept, so keeping it clears the mark with no second write; no variations
   until kept), and
   under 0.3 is declined. Every screen records its P(yes) as `need`, so a
   keep or an unkeep labels the decision it answers.
2. **Structure**, per screen — each optional slot (yes/no), each block choice.
3. **Props and intents**, per screen — each chosen block's enums, flags,
   counts, and each actionable element's intent (filtered to the intents that
   element can take).

**Skeleton first, in place.** Before round 1 answers, nothing is known but the
request, so the composer adds **a single blueprint** titled with the request
at once. When round 1 answers, that blueprint becomes the first screen and one
more blueprint is added per remaining archetype; each later round writes
`item.addVersion` into the same items, so a screen fills rather than being
replaced. All of one request
is one op group: one undo takes the wire back. The first frame a person sees
is blue within one round trip of the daemon, not of the model.

**The answerer is a seam.** A round is a question file in Jev's own request
shape (one `state`, named questions); answers come back in Jev's response
shape. Three answerers implement it:

- **Jev** — `POST https://api.typesafe.ai/v1/systemone`, key from
  `TYPESAFE_API_KEY` (set on this machine and on both homes' Cloud Run
  services as a Secret Manager secret, 23 Sep 2026). Model `jev-latest`.
- **Stub** — uniform over the options; deterministic under a seed. What the
  tests use, and what runs where there is no key.
- **An agent** — `isocan wire questions` prints the file, `isocan wire answer`
  applies one. So a bring-your-own agent can answer in Jev's place, and isocan
  still ships no model.

This client is small on purpose, and shaped as the `Judgment` seam in
[judge/design.md](../judge/design.md) will be: when judge phase 2 lands that
interface in core, the Jev answerer here becomes one implementation of it.

### 5. Variations — from the distribution

Every answer returns the whole distribution. Variation 1 is the argmax
everywhere. Each further variation flips the **least certain** remaining
decision to its runner-up (research §4). A decision whose runner-up is under
a floor (0.10 to start) offers no honest variation; the screen says *one way
to draw this*. Variations are sibling items (`variantOf`) placed under their
screen, added in the same op group.

### 6. Keep — a property, like a slide

`wireKeep = "yes"` via `item.update`, displayed as 📐 — the slides precedent
(`packages/core/src/slides.ts`: a property, because a reaction is the reactor's
and nobody else could remove it). `isocan wire keep|unkeep <items…>`, the
item menu, and a keystroke set it. Order of the kept screens is reading
order, as slides are.

**Its words are the prototype's** (24 Sep 2026, Dion): "Keep" read as "don't
delete", which every screen already is; what the mark does is put a screen in
the prototype. So a person sees *Use in prototype* / *Remove from prototype*
in the menu and *In the prototype* on the 📐, and `isocan wire use|unuse`
say the same; the property, ⇧K and `wire keep|unkeep|kept` keep their names.

**A composed flow picks its own first choices** (24 Sep 2026, Dion): after
round 3 (and the flesh), each row round 1 was confident of (P(yes) ≥ 0.5)
has its first-choice screen marked — never a *maybe*, never a variation —
and the prototype is built above the row, in the flow's op group, so `/wire
<request>` ends with something you can click and one undo takes it all
back. `basic` picks nothing. **Who marked it** rides beside the mark as
`wireKeepBy`: the answerer (`jev`, `stub`) for a pick the flow made, the
actor's id for one a person or an agent made (⇧K, the menu, `wire use`) —
core's `moduleMarkPatch` writes `<property>By` for any mark. A person
swapping a variation in for one of Jev's picks is then a label, not a
guess.

**The prototype follows its marks** (24 Sep 2026, Dion): using a screen in
the prototype or removing it — ⇧K, the item menu, `wire use|unuse|keep|
unkeep` — re-versions its flow's prototype in the mark's own op group, so
one undo takes back both. Only a prototype that exists follows; marks never
make one. The shell's generic mark toggle knows nothing of prototypes: a
mark may carry `follow` (`ModuleMark.follow`), which the module's LAZY half
supplies in place of the record's mark, and the shell awaits it once the
mark's ops are in the replica — so it reads the canvas the mark left, and a
quick run of ⇧K presses rebuilds once per press. `follow.ts` is the one
function both surfaces call. `wire prototype` stays the explicit rebuild
for a screen whose content changed.

### 7. Links — computed, never stored

`inferLinks(kept: WireScreen[]): Link[]` — pure, in core. Rules (research
§3, *The obvious transitions*), in priority order:

1. An intent with a target archetype goes to the first kept screen of that
   archetype (`sign-in` → first post-auth screen; `open-settings` →
   settings).
2. `back` → the previous screen in the flow's navigation stack.
3. A list or card row → the first kept `detail` after it in reading order.
4. Tab *i* of a tab bar / side nav → the *i*-th kept top-level screen.
5. Anything else actionable with a navigating intent and no kept target →
   a **dashed** hotspot naming the archetype it needs.

A person can override one link (`isocan wire link <item> <element> <target>`),
stored as a property on the source screen — the mind map's edge precedent.
The canvas draws the inferred links between kept screens as module edges
(`CoreModule.edges`), so the flow is visible before the prototype exists.

### 8. The prototype — one item

`assemblePrototype(kept, links): string` — pure, in core, beside
`deckHtml`. One self-contained HTML file: every kept screen as a section, a
tiny router, the links as click handlers, a slide/fade transition by link
kind (push for forward, pop for back, none for tab). It is added as an HTML
item centred above the flow's kept row — over the arrows' highest lane, and
higher if something is already there — and gains a version when rebuilt — by `wire prototype`, a restyle or a
flesh, or a screen used in it or removed (§6); a
rebuild puts it back above the row unless a person has moved it
(`wirePrototypeAt` records where the composer placed it). It never navigates
the canvas — screens run in sandboxed frames, and a prototype that routes
inside itself needs no bridge out.

### 9. Style — the default wire, or your design system

Asked for by Dion on 23 Sep 2026: a default look, and the governing design
system when there is one, with every wire changing when it changes.

**One spec, two layers.** The spec says *what* is on a screen; a **theme**
says how it looks. `renderWire(spec, theme?)` draws the wire look from a
small set of **roles**, CSS custom properties the blocks and primitives use
and nothing else:

| Role | Default (the IDEO greys) |
| --- | --- |
| `ground`, `surface`, `line` | white, light grey, mid grey |
| `ink`, `ink-muted`, `bar` | near-black, grey, light grey (copy bars) |
| `primary`, `on-primary` | dark grey, white |
| `radius` | 8px |
| `font` | the system sans stack |
| `space` | 8px unit |

The **blueprint look never takes a theme**: blue on white means *still being
drawn* in every system, so an unresolved slot is always blue.

**The theme comes from the governing design system.** `designSystem(canvas,
{ at })` in core already resolves which `DESIGN.md` governs a place (a group's
scoped system first, then the canvas's). Its parsed tokens are the options.
**Mapping tokens onto roles is Jev's question**: one `choice` per role over
the system's own token names (*which of these colours is the primary
action?*, *which is body text?*), the state carrying each token's name, value
and group. A role whose answer is unsure (p under 0.5) keeps the default and
says so. Font, radius and spacing come from the system's typography, radius
and spacing scales directly when they are unambiguous, and from a Jev choice
when there are several. The resolved mapping is stored in the spec as
`style: { source: "default" } | { source: "design-system", itemId, versionId,
roles }`, so a screen records which system and which version drew it.

**All change, as one act.** `isocan wire style` resolves the governing system
for each wire on the canvas (a flow in a scoped group takes that group's),
asks Jev for the mapping once per system version (cached by version, so a
canvas of forty wires is one call per system, not forty), and writes a new
version of every wire whose theme changed — one op group, one undo.
`--default` restores the default look. `wire "<request>"` uses the governing
system from the start. When a new version of the governing `DESIGN.md`
arrives, the wires say they are behind it (the spec names the version) and
`wire style` brings them forward; restyling automatically on every design
edit is refused for now — it would rewrite forty items behind somebody's
back.

*Saying so on the canvas* (26 Sep 2026, the Stitch Loop review): a wire
behind its system shows a small quiet **behind** tag under its bottom-right
corner, and the DESIGN.md one saying how many wires are behind it — both
derived on every render from the wire's spec and the system's current file
(`behind.ts`), never written. Clicking either, or *Restyle to <system>* in
the item menu, runs `wire style <screens>` for those wires' flows: one op
group, one undo — the person's click, so the refusal above stands. "Behind"
is narrower than "drawn from an older version": a wire is behind when a
token one of its roles took is gone or holds another value, a role that had
nothing to draw from now has something, or the `surface:` changed. A
version that only adds tints is not — the restyle would write nothing for it
(`alreadyLooks`, Porchlight #9), and a mark no click can clear is noise.
`wire style --check` reads the same function, in the same words.

**Wire styles — a named look** (24 Sep 2026, Dion: *"change the style from
'house' (default) to 'material' … 'shadcn' maybe with glassmorphism … and
others most popular"*, and *"right click on a wire and have 'Style'"*). A
wire style is a DESIGN.md the module ships in `assets/styles/` — `material`,
`shadcn`, `glass`, `ios`, `fluent`, `carbon`, `brutalist`, original token
sets inspired by each system, system font stacks only, each `design check`
clean at AA — or one of the design competition's nine packs by name.
`house` is the greys. Choosing one (`presets.ts`, `applyPreset`) is three
acts anybody could do by hand, as ONE op group: place the file beside the
flow (`wirePreset=<id>`), make it the design system of the flow's group, or
the canvas when it is in none, with core's `designUse` op; restyle. A scope
already wearing a wire style re-versions that one item rather than adding a
second, so the version stack is the history of looks tried. `house` trashes
it. A scope governed by a DESIGN.md somebody wrote is refused, never
versioned over: a preset landing as a new version of a person's own system
is a surprise. The module's own styles name their tokens for the roles
(`colors.ground` … `colors.on-primary`, `typography.body`, `rounded.base`,
`spacing.base` — all eight colour roles or it does not apply, because
Linear's `primary` is its text colour), so the mapping is read, not asked:
no Jev call. Packs are asked, as any system. Doors: `wire style --preset
<name> [screens…]`, `--list`; `/wire style <name>`, `/wire style` alone a
picker (`/wire style system` is the plain restyle it used to be); and a
wire's right-click **Style ▸**, the shell's submenu with a tick, whose rows
come from the module's lazy half (`WebModule.menu`) and open the dialog
with `style <name>` — one code path for all three.

**Surfaces.** Colour, type, corners and spacing are not what tells Material
from Fluent from glass; depth is. A DESIGN.md may say `surface: flat |
raised | glass | bold` (core's `designSurface`; absent or unknown is flat,
and `design check` warns on the unknown). The style records it
(`style.surface`), the frame wears `s-<surface>`, and `render.ts` adds that
surface's sheet — roles only, like the wire sheet: `raised` lifts cards,
bars and sheets on two-layer shadows of the ink; `glass` draws a gradient
ground from the system's primary and surface and makes every pane a
half-transparent fill with a `backdrop-filter` blur (verified live inside
the sandboxed item frame); `bold` draws 3px ink borders and hard offset
shadows. Flat wires are byte-identical to before.

### 10. Fleshed out — sample content instead of bars

Asked for by Dion on 23 Sep 2026, looking at the walk canvas: *it shows empty
skeleton lines — flesh it out and put sample data in there, an attempt to make
it realer even in wireframes: little images, text, etc.* — as a step in the
process, not a hand edit.

**Three content levels on one spec, like the two looks of §9:** *bars* (today's
default — grey bars where copy goes), *sample* (a curated content pack fills
every list, card, table, stat and image), and *copy* (exact words an agent
wrote for this request). Blueprints never take content: blue means still being
drawn.

**Sample content comes from packs, because Jev cannot write.** The module's
core holds ~24 synthetic packs, one per common domain (deliveries and
logistics, recipes and food, a shop, fitness, travel, events, finance, tasks,
tools and lending, pets, home services, jobs, news, music, learning, health,
real estate, social, …, and *generic*). A pack holds believable nouns and item
titles, people's first names, subtitles, prices and metrics in the domain's
units, statuses, categories, dates, and a small set of greyscale pictogram
motifs (a parcel, a pan, a drill …) drawn as inline SVG in image, thumbnail and
card-cover slots; avatars become initials. No real brands, no real people.
**Jev chooses the pack**: one `choice` question over the pack ids with the
request as state — its kind of question — recorded with its probability;
`--pack <id>` overrides a wrong guess.

**Filling is deterministic.** Each slot's content is drawn from the pack by a
seed of the screen's item id and the slot, and written into the spec
(`content` on the spec, `fill` on each slot), so a restyle, a variation, the
prototype and a re-render all show the same "Parcel 4471 — 3 items — Out for
delivery", and nothing flickers.

**The pack names the screens** (24 Sep 2026). A fleshed list is titled
"Deliveries" rather than "List" — the spec's `title`, and the item's in the
same op group — from the pack's nouns (`domainTitle`: list, gallery, detail,
form, search); a title an agent gave the spec, or a name a person gave the
item, is left alone, and `--bars` names them back. A block's lone bare verb
takes its object the same way ("Edit delivery", "Edit profile"), as
`fill.actions` — words from the pack, never a model's.

**Exact copy is the agent's.** `wire copy <screen>` prints, per slot, what
words it holds and what it wants (the questions/answer seam of §4, with text
answers); `wire copy <screen> --apply <file>` writes them. An agent parked on
the canvas can do it for a whole flow; the person can edit any screen's text as
an ordinary new version.

**Doors.** `isocan wire flesh [screens…|--flow <id>] [--pack <id>]` and
`/wire flesh` from the Chat. One op group, one undo, a version per screen —
the same shape as `wire style`. **A composed flow arrives fleshed** (24 Sep
2026, Dion: he expected the words as part of composing): `wire "<request>"`
and `/wire <request>` ask for the pack beside round 1 (one call more), the
screens land grey in round 2 and fill in round 3, in the flow's own op
group, so one undo takes the flow back content and all; its variations take
the same pack. `wire --basic "<request>"` / `/wire basic <request>` compose
plain grey wires; `wire flesh --bars` takes content off afterwards.

### 11. Multi-region layout templates, density, and `data-wf` paths

Added 30 Sep 2026 ([#369](https://github.com/dglazkov/isocan/issues/369)).
Scenes 1–8 lay every screen's slots in a single vertical stack, which fits a
375px phone screen and fails a desktop console or tablet workspace.

**Seven layout templates (`catalog/templates.ts`).** A screen's `WireSpec` may
name `template?: TemplateId` (absent or `"single"` is the existing vertical
stack, byte-identical to phases 0–8) and `density?: "compact" | "default" |
"spacious"`:

| `TemplateId` | Regions | `@container` layout | Compatible archetypes |
| --- | --- | --- | --- |
| `single` | `main` | Single column at all widths | All 18 archetypes |
| `split` | `main`, `side` | 2 columns (`1fr 1fr`) above `640px`, stacked below | `detail`, `form`, `checkout`, `profile`, `onboarding` |
| `master_detail` | `list`, `detail` | `320px 1fr` split with inner scroll above `640px` | `list`, `inbox`, `chat`, `search`, `notifications` |
| `grid` | `header`, `cells` | Header over `repeat(auto-fill, minmax(240px, 1fr))` | `gallery`, `feed`, `home`, `search` |
| `bento` | `hero`, `wide`, `tall`, `cells` | 12-column asymmetric bento grid above `640px` | `home`, `dashboard`, `profile` |
| `hero_then_grid` | `top`, `grid` | Full-width hero/banner over 3-column feature grid | `welcome`, `home`, `gallery`, `onboarding` |
| `dashboard` | `kpis`, `main`, `side` | Top KPI strip over `2fr 1fr` main + side rail | `dashboard`, `home`, `profile` |

**Round 2 asks template, region, and density in the same call.** When
`device` is `"desktop"` or `"tablet"` (or when an archetype offers multiple
templates), Round 2 adds:
- `template`: a `choice` over the archetype's compatible templates;
- `density`: a `score` ("How information-dense should this screen be?"), mapped
  at `< 0.35 → "compact"` (`--wf-space: 6px`), `0.35–0.65 → "default"`
  (`--wf-space: 8px`), `> 0.65 → "spacious"` (`--wf-space: 12px`);
- `<slot>.region`: when the compatible templates have multiple regions, each
  content slot (chrome slots `top-bar`, `tab-bar`, `bottom-bar` stay anchored to
  the frame) gets a region `choice` constrained to that template's regions.

**Stable element paths (`data-sec`, `data-wf`).** Every rendered slot root
carries `data-sec="<slot>"` and every addressable element inside a block carries
`data-wf="<slot>.<element>"` alongside `data-intent` and `data-hotspot`. This
gives `wire edit`, `wire polish`, `version-diff`, and hotspot measurement one
selector contract.

### 12. `PriorityGate` and entropy-gated `/ask` in `@isocan/core/jev`

**`PriorityGate`.** `packages/core/src/jev.ts` wraps any `Answerer` in a
zero-dependency `PriorityGate(answerer, { concurrency: 8 })`. Interactive calls
(`wire`, `wire edit`, `wire why`) pass `priority: "high"`; background work
(`wire polish`, batch restyling) passes `priority: "normal"` and yields the next
slot in the queue whenever a high-priority call is waiting. Transient `429` and
`529` responses back off exponentially up to 3 attempts inside the gate.

**Shannon entropy and `gatedChoice`.** For a `ChoiceAnswer` with distribution
$P = \{p_1, \dots, p_k\}$, `entropyBits(probabilities)` computes:
$$H(P) = -\sum_{p_i > 0} p_i \log_2(p_i)$$
Top-two margin ($p_1 - p_2$) catches a two-way tie (used for slot variations in
§5); Shannon entropy catches a multi-way split across root decisions. On
root flow questions (`platform`, `pack`, `style.direction`), `gatedChoice`
checks whether $H(P) > 1.0\text{ bit}$ or `confidence < threshold`. When
triggered (and neither `--no-ask` nor a pinned value in `WireSpec.pinned` is
present), the composer pauses before Round 2, posts a canvas `/ask` (or prints
the 3-option choice in the CLI) showing the top 3 options and their
probabilities, and records the chosen option in `WireSpec.pinned` so subsequent
edits never re-ask.

### 13. Surgical section editing (`wire edit`) and decision Q&A (`wire why`)

**No `.session.json` on disk.** Every screen item on the canvas already embeds
its `WireSpec`. Extending `WireSpec` with compact `decisions?: Record<string, {
choice: string; top: Record<string, number>; entropy?: number }>` (the top 3
probabilities and entropy per question) makes every screen self-describing across
machines and sessions.

**Turn routing and `wire edit`.** `isocan wire edit [<screen>] "<instruction>"`
(and `/wire edit <instruction>` in the Chat) modifies a single section of a
screen without re-composing the flow:
1. **Target screen (`scopeScreen`):** if a screen id/title is passed or selected
   on the canvas, use it; otherwise ask one Jev `choice` over the flow's screens
   (`title — archetype`).
2. **Scoped edit (`scopeEdit`):** one batched Jev call with `{ request,
   instruction, archetype, template, slots }` asks:
   - `kind`: `choice` over `content | add | remove | variant | restyle`;
   - `target`: `choice` over the screen's existing `slots` (by `slot: block`);
   - `block`: `choice` over the catalog's blocks (used when `kind === "add"` or
     replacing a block);
   - `variant`: `choice` over the target block's variants (used when `kind ===
     "variant"`).
3. **Apply in one op group:** mutate only the targeted slot in `WireSpec`,
   re-render HTML, write `item.addVersion`, and run `ModuleMark.follow` so the
   flow's clickable prototype updates in the same op group (one undo).

**Decision Q&A (`wire why`).** `isocan wire why [<screen>] ["<question>"]` (and
`/wire why` in the Chat) reads `WireSpec` and `WireSpec.decisions` from the
screen(s) and prints a structured explanation of why the screen exists (`need` P
and `by`), why its archetype and template were chosen (with runner-up
probabilities), why each slot picked its block and whether a variation was
spawned, and how its theme/pack was selected.

### 14. Schema-driven AI copy (`wire copy --ai`) and flow naming (`wire name`)

Sample content packs (§10) fill screens in 0 ms with deterministic domain data.
When a person or agent wants copy written for the exact prompt:

- **`blockContentSchema(spec)` (`copy-schema.ts`):** a pure function in
  `@isocan/module-wireframe` that inspects a screen's resolved `slots`, blocks,
  and variants and returns a strict JSON schema describing every heading, body
  line, table cell, stat label/value, form field label/placeholder, and media
  slot description on that screen — while keeping actionable button labels locked
  to their typed `Intent` unless an explicit intent-compatible label is allowed.
- **`nameFlow(specs, request)`:** a small schema across all screens in a flow
  that names the brand, each screen's specific title, and shared navigation bar
  labels so tab bars and headers match across every screen.
- **`TextGenerator` seam (`packages/core/src/jev.ts`):** a vendor-neutral
  interface `{ generateJson<T>(prompt: string, schema: JsonSchema): Promise<T> }`
  with three implementations:
  1. Standard HTTPS JSON-schema completion (using `ISOCAN_TEXT_API_KEY` /
     `ISOCAN_TEXT_MODEL` over `fetch`, zero SDK dependencies);
  2. The home's proxy route when signed in;
  3. The file-based `--answerer agent` seam (`wire copy <screen>` writes the
     JSON schema alongside the current slots; `wire copy <screen> --apply
     <file>` validates against `blockContentSchema(spec)` and applies it).

### 15. Concurrent design system synthesis (`wire ds`) and guarded polish (`wire polish`)

**`wire ds "<request>"` (`ds.ts`).** When a canvas has no governing `DESIGN.md`
and the user wants a custom system rather than one of the 7 built-in presets:
1. **`proposeThenPick`:** generate 4–5 candidate visual directions (or draw from
   an expanded direction bank when running without a text generator) and ask Jev
   one `choice` question (`ds.direction`) + `surface` choice (`flat | raised |
   glass | bold`) + `density` score to pick the direction that fits the flow's
   domain and platform.
2. **Token synthesis & deterministic WCAG AA repair (`repairContrast`):**
   synthesize a complete `DESIGN.md` with all eight colour roles
   (`ground`, `surface`, `ink`, `muted`, `border`, `primary`, `on-primary`,
   `accent`), typography, radius, spacing, and `surface:`. Before writing, a
   pure contrast pass checks every foreground/background pair (`ink` on
   `ground`/`surface`, `muted` on `ground`/`surface`, `on-primary` on `primary`)
   and nudges OKLCH/HSL lightness until every pair meets $\ge 4.5:1$ (WCAG AA)
   and `design check` passes with zero warnings.
3. **Swap 1 in one op group:** write the `DESIGN.md` item beside the flow, set
   it as the governing system with `designUse`, restyle every wire in the flow,
   and rebuild the prototype — all inside one op group.

**`wire polish [<screens…>]` and Swap 2 contract checks (`polish.ts`).**
- **Jev-budgeted polish (`polish_intensity`):** Jev scores `polish_intensity` on
  each target screen ($0\text{–}1$), which maps deterministically to an op
  budget of `0` ($< 0.25$), `4` ($0.25\text{–}0.50$), `8` ($0.50\text{–}0.75$),
  or `12` ($> 0.75$) patches. Each patch in `WireSpec.polish` is a typed
  `{ target: string; add?: PolishToken[]; remove?: PolishToken[] }` keyed by a
  valid `data-wf` or `data-sec` path on that screen, restricted to an allowlist
  of visual refinement classes (emphasis, surface elevation, border treatment,
  spacing rhythm).
- **Contract gate (`verifyWireContract`):** whether applying `WireSpec.polish`
  or a custom primitive override (**Swap 2**), a pure verification function
  asserts before committing that:
  1. Every `data-sec` and `data-wf` path present in the unpolished wireframe is
     still present in the output HTML;
  2. Every `data-intent` and `data-hotspot` attribute is preserved intact so
     `inferLinks`, canvas flow arrows, and the clickable prototype never lose a
     transition;
  3. Every token reference resolves and foreground/background contrast stays
     $\ge 4.5:1$.
  Any patch that violates the contract is rejected before a version is written.

## Done means done on both surfaces

1. **Ops** — none new: `item.add`, `item.addVersion`, `item.update`, op groups.
2. **CLI** — `isocan wire <request>`, `wire vary`, `wire keep|unkeep`,
   `wire link`, `wire prototype`, `wire style [--preset <name>|--list]`,
   `wire flesh`, `wire copy [--ai]`, `wire name`, `wire edit`, `wire why`,
   `wire ds`, `wire polish`, `wire questions|answer`, as the module's verbs.
3. **Agent guide** — the module's own `agent-guide.md`.
4. **Core** — `PriorityGate`, `entropyBits`, `gatedChoice`, and `TextGenerator`
   in `@isocan/core/jev`; catalog, templates, renderer, surgical editor,
   decision explainer, schema builder, DS synthesizer, polish contract checker,
   link inference and assembler in the module's core, so the web and the CLI
   draw, edit, and link identically.
5. **README** — a line in the feature list when phase 3 closes.
6. **Tests** — renderer, templates, entropy gate, surgical edits, schema copy,
   DS contrast repair, polish contract gate, links and assembly are pure; the
   skeleton-then-fill, multi-region responsive layouts, and click-through are
   browser walks, said out loud (a journey in `scripts/journeys.mjs`).

## What it refuses

- **No lorem ipsum, no unvalidated free-form copy.** Pack content or
  schema-validated `wire copy` only.
- **No free-text labels on actionable elements.** Intents or nothing, preserved
  across every template, restyle, and polish pass.
- **No stored links.** Computed, with a per-link override.
- **No local `.session.json` state.** Every screen's `WireSpec` (including
  `template`, `density`, `pinned`, `decisions`, and `polish`) lives inside the
  canvas item itself.
- **No model or sidecar in the box.** Jev and `TextGenerator` sit behind pure
  TypeScript seams in `@isocan/core`; the stub and an agent are the other
  answerers, and no Python, Go, or React SSR sidecar process exists.

