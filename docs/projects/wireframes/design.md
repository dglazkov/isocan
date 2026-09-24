---
status: designed
since: 2026-09-23
see: wireframes, judge, design-partner, slides, modules, mindmap
note: the mechanism. Screens are HTML items carrying their spec as embedded JSON; a module holds the catalog (archetype recipes, blocks, primitives, intents), the renderer (blue skeleton → grey wireframe), the Jev composer (three rounds), link inference and the prototype assembler, and a theme layer — the default wire look, or the governing design system's tokens mapped onto the wire's roles by Jev (§9). No new op. The keep mark is a property, like a slide.
issue: 350
---

# Wireframes — the design

The research is
[Wireframes a typed model can choose](../../research/2026-09-23-wireframe-components.md);
read its *short version* before this. The journey is [journey.md](journey.md).
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
- **Intents** — the 49-value vocabulary (research §3), each with a label and,
  where it has one, a navigation rule.

Everything a Jev question offers is an id from these tables, so a question's
options are generated, never typed by hand.

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
item next to the flow and gains a version when rebuilt. It never navigates
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

**Exact copy is the agent's.** `wire copy <screen>` prints, per slot, what
words it holds and what it wants (the questions/answer seam of §4, with text
answers); `wire copy <screen> --apply <file>` writes them. An agent parked on
the canvas can do it for a whole flow; the person can edit any screen's text as
an ordinary new version.

**Doors.** `isocan wire flesh [screens…|--flow <id>] [--pack <id>]` and
`/wire flesh` from the Chat; `wire "<request>" --flesh` fleshes as it draws.
One op group, one undo, a version per screen — the same shape as `wire style`.

## Done means done on both surfaces

1. **Ops** — none new: `item.add`, `item.addVersion`, `item.update`, op groups.
2. **CLI** — `isocan wire <request>`, `wire vary`, `wire keep|unkeep`,
   `wire link`, `wire prototype`, `wire style`, `wire flesh`, `wire copy`, `wire questions|answer`, as the module's verbs.
3. **Agent guide** — the module's own `agent-guide.md`.
4. **Core** — catalog, renderer, link inference and assembler in the module's
   core, so the web and the CLI draw and link identically.
5. **README** — a line in the feature list when phase 3 closes.
6. **Tests** — renderer, rounds, variations, links and assembly are pure;
   the skeleton-then-fill and the click-through are browser walks, said out
   loud (a journey in `scripts/journeys.mjs`).

## What it refuses

- **No lorem ipsum, no invented copy.** Bars until an agent writes words.
- **No free-text labels on actionable elements.** Intents or nothing.
- **No stored links.** Computed, with a per-link override.
- **No model in the box.** Jev is one answerer behind a seam; the stub and an
  agent are the others.
