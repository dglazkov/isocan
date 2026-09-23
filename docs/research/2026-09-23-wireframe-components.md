---
status: designed
since: 2026-09-23
see: judge, design-partner, modules, mindmap
note: surveyed what seventeen sources — eleven wireframing tools and kits, four pattern references and datasets, two generative-UI catalogs — treat as a component, for a feature where TypeSafe's Jev composes screens by choosing from a fixed catalog. The union, de-duplicated, is 123 entries — 73 primitives, every one named by at least two of ten enumerated sources (29 by five or more), and 50 composite blocks. The finding that shapes the build is that Jev cannot write a tree, so it must choose composites into slots of a fixed recipe, which is what the two catalog-choosing products (Figma First Draft, Relume) already do; once a screen's archetype is chosen, no structural question over 34 recipes has more than 4 options, so the 255-option ceiling never binds. The binding constraint is instead that Jev writes no prose — and a prototype's links hang on labels — so actionable text becomes a typed `intent` (49 values, 40 of them concepts by name in Rico's lexicon of 197 mined button labels) and links are computed from intents, archetypes and canvas order rather than generated. Wave 1 is 18 archetypes and 28 blocks, covering 90.7% of Enrico's 1,460 human-labelled screens; the same labels are a free calibration set for the archetype question.
---

# Wireframes a typed model can choose

**23 September 2026.** Asked for a new feature, *wireframes*: a person asks
for them; a cheap typed model — TypeSafe's Jev, which answers `choice`
questions over up to 255 named options plus `score` and yes/no questions,
returns calibrated probabilities and writes no prose
([the System One note](2026-09-19-system-one-and-the-ledger.md)) — composes
screens by **choosing** components from a fixed catalog. Variations are shown,
the person tags the screens they want, and a clickable prototype is assembled
from them. The catalog therefore has to be enumerable, parameterised by a small
typed prop set, composable by layout slots, and renderable as grayscale HTML on
a canvas node.

The question asked: what do the established tools treat as a component, what
screen archetypes do they recognise, how do they prototype, and how big should
isocan's first catalog be.

Nothing is built. Every count below was read or computed on 23 Sep 2026; the
scripts that produced the tables were run against the sources named beside
them, and where a figure is an estimate or an inference it says so.

## The short version

1. **The field agrees on about thirty components and argues about the rest.**
   Unioning ten enumerated lists (Balsamiq, component.gallery, Apple's HIG,
   Mobbin, Wired Elements, A2UI, json-render, Rico, Excalidraw's lo-fi
   libraries, wireframe.cc) and folding synonyms gives **73 primitives, every
   one named by at least two sources, 29 by five or more.** Button, text
   field, select, image and slider are named by nine or ten of the ten. Add
   **50 blocks** — composites named by pattern libraries (Relume, Mobbin's
   screen patterns, Enrico's topics) — and the catalog is **123 entries**.
2. **Jev must choose blocks, not primitives.** A generator that can write a
   tree (Balsamiq AI, MockFlow's MCP, Whimsical AI, A2UI, json-render) composes
   primitives. The two products whose output is a *choice from a library* —
   Figma's First Draft ("building blocks—or stacks of components") and Relume
   (one sitemap section, one library component) — choose composites. Jev
   cannot write a tree, so it is in the second group by construction: the
   **tree comes from an archetype recipe, and Jev fills its slots.**
3. **Inside a recipe, no structural question has more than four options.**
   Measured over 34 recipes: 128 section positions — 51 fixed, 28 a yes/no on
   whether to include one block, 49 a choice among two to four blocks (40 of
   two, 8 of three, one of four). A screen asks between 0 and 8 structural
   questions, 2.6 on average. The largest questions in the whole design are the
   archetype (34 options) and the intent vocabulary (49). **The 255 ceiling is
   sixty times the largest structural question and five times the largest
   question of any kind.** It would bind only on Relume-scale growth: Relume's
   React library holds 1,524 components in 50 categories, and its *Feature
   Sections* category alone holds 527.
4. **The real constraint is prose, not width.** Figma's five component
   property types map onto Jev's question types — variant → `choice`, boolean →
   yes/no, instance swap → `choice` over the slot's blocks, slot → the recipe —
   except **text**, which Jev cannot produce. A prototype's links hang on
   exactly that text ("Sign in", "Back"). So actionable text becomes a typed
   **`intent`**: 49 values, 40 of them concepts by name in Rico's lexicon of
   197 button labels mined from real apps.
5. **Links can be computed, not generated.** Figma AI and Balsamiq AI use a
   model to wire prototypes because their labels are free text. With typed
   intents, archetypes and the canvas's own reading order, "back → previous",
   "row → detail", "tab *i* → sibling *i*" and "Sign in → first post-auth
   screen" are rules. A hotspot whose target screen was never kept renders
   dashed and names the archetype it needs — the prototype becomes a list of
   the screens still missing.
6. **Half of this is already in isocan under other names.** The decision half
   (`prefer`, `choose`, `react`, `design compare`), linear click-through
   (`slides` + `deck.html`), annotation (the Pen over an item, comments,
   post-its), a greyscale wireframe token set (the design-competition *IDEO*
   pack) and make-real's iteration loop (ink over an item wakes the agent
   parked on it, which rebuilds). What is missing is the catalog, its
   renderer, the composer, and link inference.

## What was read

| Source | What it treats as a component | Measured 23 Sep 2026 | Licence — what isocan may take |
| --- | --- | --- | --- |
| [Balsamiq](https://balsamiq.com/learn/ui-control-guidelines/) | "UI controls", edited through a properties panel; linkable | 77 control type ids across two open BMML parsers ([a 66-control dump](https://github.com/cory/mockup/blob/master/lib/data/balsamiq-all-controls.xml), [napkee](https://github.com/enricoberti/napkee)'s 72 parsers); 40 current guideline articles | Proprietary: names only |
| [Whimsical](https://whimsical.com/blog/fast-collaborative-wireframing-app) | "Elements", with sizes and states, in a fixed-order searchable launcher | not enumerated publicly; shortcuts documented for text, avatar, button, divider, image, input, icons | Proprietary: names only |
| [Moqups](https://moqups.com/hc/stencils/) | "Stencils" in categories plus UI kits (iOS, Material, Bootstrap) | categories only in the help centre | Proprietary: names only |
| [MockFlow WireframePro](https://mockflow.com/wireframing/ui-components/) | "Components" in packs; "over 100 native components" | categories only; [MCP server](https://github.com/mockflow/wireframepro-mcp) read | App proprietary; the MCP server is MIT |
| [wireframe.cc](https://wireframe.cc/docs/) | "Stencils", offered by the shape you draw | 17 documented, each with a shortcut key | Proprietary: names only |
| [Excalidraw libraries](https://github.com/excalidraw/excalidraw-libraries) | Library items (drawings) | 232 libraries indexed; 4 wireframe libraries read: 23, 69, 22 and 8 items | MIT |
| Figma ([First Draft](https://help.figma.com/hc/en-us/articles/23955143044247-Use-First-Draft-with-Figma-AI), [component properties](https://help.figma.com/hc/en-us/articles/5579474826519-Explore-component-properties), community kits) | Components with typed properties; First Draft's "building blocks" | 5 property types; First Draft library sizes are community-reported only (below) | Free community files are [CC BY 4.0](https://help.figma.com/hc/en-us/articles/360042296374-Figma-Community-copyright-and-licensing); paid kits are not |
| [Relume](https://www.relume.io/react-categories/navbars) | Page *sections* | **50 categories, 1,524 components** (sum of each category page's own count) | Proprietary: names only |
| [Uizard](https://support.uizard.io/en/articles/6435343-creating-an-interactive-project) | Components that re-render between wireframe and mockup mode | not enumerated | Proprietary: names only |
| [tldraw make real](https://tldraw.dev/blog/make-real-the-story-so-far) | none — a picture goes to a vision model | — | [make-real-starter](https://github.com/tldraw/make-real-starter) is AGPL-3.0 |
| [Wired Elements](https://github.com/rough-stuff/wired-elements) | Hand-drawn custom elements | 25 | MIT (last push Oct 2023) |
| [component.gallery](https://component.gallery/components/) | Components across design systems, with aliases | 60 components, 95 design systems, 2,671 examples | Names and aliases |
| [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/components) | Components in 8 categories | 64 | Names only |
| [Mobbin](https://mobbin.com/explore/mobile/ui-elements) | UI elements (Control, Imagery, Overlay, View) and screen patterns | 54 mobile and 66 web elements outside its SEO "Others" group; 10 screen-pattern groups | Proprietary: names only |
| [Rico semantics](https://dl.acm.org/doi/10.1145/3242587.3242650) via [Enrico](https://github.com/luileito/enrico) | Component types, button concepts, icon classes mined from 72k Android screens | Enrico's legend files: 24 component types, 197 text-button concepts, 97 icon classes (the paper reports 25 types and 135 icon classes); Enrico: 1,460 screens in 20 topics | Enrico repository MIT |
| [A2UI](https://a2ui.org/reference/components/) · [json-render](https://github.com/vercel-labs/json-render) | Catalogs a model composes within | 16 (A2UI v0.9 basic) · 36 (json-render's shadcn catalog) | Apache-2.0 both |

## How each tool treats a component, and the idea worth taking

**Balsamiq.** Controls carry state in properties, and nearly every control is
linkable. Controls with several targets — Link bar, AppBar — get [one link per
sub-item](https://balsamiq.com/support/creating-and-editing/linking/), a link
can target "Go Back (in Full Screen)", and "Link to a new board" creates the
missing screen from the link. Its AI [plans a user flow first and then
wireframes each step](https://balsamiq.com/support/docs/creating-and-editing/wireframing/),
returning "an editable wireframe made up of Balsamiq UI elements". On
[19 March 2026](https://balsamiq.com/blog/introducing-prototyping/) the tool
that spent eighteen years refusing fidelity shipped **Generate prototype**:
select the wireframes of a flow, and [an interactive prototype appears as its
own node on the board](https://balsamiq.com/support/creating-and-editing/prototyping/),
regenerable after edits and downloadable as a standalone `.html` — the same day
as an MCP server. *For isocan:* flow first, then screens; per-sub-item links;
a missing link target is an invitation to make the screen; and the prototype
is a separate, regenerable node — which is exactly the shape of an isocan item
with a version stack.

**Whimsical.** The [design notes](https://whimsical.com/blog/fast-collaborative-wireframing-app)
are the best argument for a small catalog on record: "if you look closely at
the majority of the websites and apps out there, it's amazing how few
components are really used… Buttons, text, images, and a few form elements can
often get you most of the way." Constraint is the feature — buttons are Small,
Medium or Large, text has six sizes, states (disabled, focused) are a toolbar
toggle, everything sits on a 4px grid. Its [elements launcher](https://whimsical.com/blog/why-we-optimized-left-handed-shortcuts-in-wireframes)
tried recency ordering and went back to a fixed order because a changing order
disoriented people. [Whimsical AI](https://whimsical.com/ai/ai-wireframes) is
"powered by Claude" and produces wireflows. *For isocan:* sizes and states as
enums, not numbers; a fixed catalog order wherever a person picks by hand.

**Moqups.** The cleanest prototyping model of the set: an interaction is
[trigger, action, target](https://moqups.com/hc/interactions/). Triggers are
click/tap, right-click, double-click, mouse enter, mouse leave. [Page
interactions](https://moqups.com/hc/interactions/page-interactions/) are Go to
Page, Open Link, Go Back; [object interactions](https://moqups.com/hc/interactions/object-interactions/)
are Toggle Visibility, Show, Hide, Scroll to — which is how it fakes dropdowns,
modals and toggles without new screens. *For isocan:* the split between
*navigation* (a new screen) and *state* (same screen, something shown) is the
split the transition rules below need.

**MockFlow.** Over a hundred components in packs. Its MCP server's
`render_wireframe` has the model **write HTML with inline CSS**, and a
converter turns each element back into an editable component
([MIT source](https://github.com/mockflow/wireframepro-mcp)). The tool
description is worth reading for one instruction: when adding a screen to an
existing app, keep "the SAME… header/nav/footer chrome… ONLY the main content is
new." *For isocan:* the chrome is chosen once per flow and held fixed; only
`main` varies per screen. The HTML-first route itself is what isocan's agents
already do.

**wireframe.cc.** You drag a rectangle and the [stencil menu offers only what
fits its shape](https://wireframe.cc/docs/) — "a vertical scrollbar can only be
inserted if you draw a high and narrow rectangle." Master pages hold headers,
sidebars and footers shared across pages, and every stencil can link to a page.
*For isocan:* **the slot filters the options.** That is the whole question
design in one gesture.

**Excalidraw libraries.** Community wireframe kits, MIT, as drawings. The
69-item *Basic UX/wireframing elements* library encodes state in the item
name — "Selected disabled checkbox (text+icon)", "Rounded toggle (ON)". *For
isocan:* state is a prop, not a separate component; the names are a ready-made
check that the prop set covers what people draw.

**Figma.** Component properties are typed: [Boolean, Instance swap, Text,
Variant, and Slot](https://help.figma.com/hc/en-us/articles/5579474826519-Explore-component-properties).
First Draft generates from libraries whose "building blocks—or stacks of
components" are "used to piece together your design"; a community post of
[11 Feb 2025](https://forum.figma.com/suggest-a-feature-11/when-will-figma-ai-allow-you-to-connect-your-own-library-37491)
lists them as Basic app (315 components), App wireframe (317), Basic site (166)
and Site wireframe (163) — reported by a user, not by Figma. The complaint in
that thread and [another](https://forum.figma.com/ask-the-community-7/can-i-manually-use-the-first-draft-libraries-to-customize-the-design-47617)
is that the person cannot use those libraries by hand to keep refining what the
AI made. *For isocan:* the property types are the prop schema (mapping below),
and **the catalog the model chooses from must be the catalog a person and an
agent can place by hand** — both surfaces, no private library.

**Relume.** A site is a sitemap of pages, each a list of sections; "the title
and description of a section in the sitemap helps inform AI what component to
generate", deleting a section in either view deletes it in both, and
[replacing a component keeps its copy](https://www.relume.ai/resources/docs/how-to-create-and-edit-wireframes-in-the-relume-site-builder).
Counted from its category pages: 1,524 components, of which Feature Sections
527, Hero Header Sections 125, Stats 60, CTA 58, Multi-step Forms 46. *For
isocan:* sections are the unit for sites, and a flat library of that size needs
three levels of question, not two.

**Uizard.** Wireframe mode is a [toggle over one design](https://uizard.io/blog/benefits-of-wireframe-mode-for-product-teams/)
between low and medium fidelity. Screens link by dragging from a component to a
target screen, with a transition and duration; its own FAQ lists no hover, no
swipe, no same-page jump. *For isocan:* keep the composition (a spec) separate
from the renderer, so the same screen can later render with the canvas's own
design system.

**tldraw make real.** A selection is exported as an image and sent to a vision
model with instructions to return HTML, which lands in an iframe shape; to
iterate you annotate the result and press the button again, with the previous
HTML passed back because iframes export as blank boxes. *For isocan:* **good
idea, wrong shape for Jev** — Jev is text only. isocan already has the loop
with a bring-your-own agent: ink over an item becomes an annotation that wakes
the agent parked on it.

**Open-source lo-fi kits.** [Wired Elements](https://github.com/rough-stuff/wired-elements)
(25 elements, MIT), [Rough.js](https://github.com/rough-stuff/rough) (MIT),
[PaperCSS](https://github.com/papercss/papercss) (ISC),
[DoodleCSS](https://github.com/chr15m/DoodleCSS) (MIT) — hand-drawn looks,
not catalogs. The only project named "wireframe CSS" with any following,
[agauniyal/wireframe](https://github.com/agauniyal/wireframe), has 161 stars and
was last pushed in 2020. There is no maintained grayscale-HTML wireframe kit to
adopt; the renderer is ours to write, and the greyscale token set already exists
in this repository as the design-competition *IDEO* pack
(`packages/modules/design-competition/assets/packs/ideo/DESIGN.md`: ink
`#222222`, 1.5px wire strokes, `#ececec` fills, crossed image placeholders).

**Generative-UI catalogs.** [A2UI](https://a2ui.org/reference/components/)
(v0.9 basic catalog, 16 components) and
[json-render](https://github.com/vercel-labs/json-render) (a Zod-typed catalog;
its shadcn set is 36 components, each with typed `props`; 7 also declare
`slots` and 14 declare `events`)
are 2026's standard answer to "let a model build UI safely": the model emits a
JSON tree constrained to a catalog. Jev cannot emit a tree. But the catalog
shape — typed props, named slots, declared events — is the right shape for
ours, and a spec in that shape exports to either later.

## 1 · The canonical catalog

**How it was built.** Each entry names, per source, what that source calls the
thing; component.gallery's alias lists (Alert: *Notification, Feedback,
Message, Banner, Callout*; Badge: *Tag, Label, Chip*) settled most synonyms.
"Named by" counts the ten enumerated primitive sources; blocks are counted
against the pattern sources. A source is counted once per entry even where it
has several names for it. Whimsical, Moqups, MockFlow and Uizard are not
counted, because none publishes a complete list.

**Source keys.** BQ Balsamiq · CG component.gallery · HIG Apple HIG · MB Mobbin
UI elements · WE Wired Elements · A2 A2UI · JR json-render · RC Rico · EX
Excalidraw libraries · WC wireframe.cc · RL Relume · MS Mobbin screen patterns ·
EN Enrico topics · MF MockFlow MCP example prompts · BA Balsamiq AI
documentation examples.

**Slots.** Seven, taken from the HTML landmarks the
[ARIA practices](https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/)
map (`header`/banner, `nav`/navigation, `main`, `aside`/complementary,
`footer`/contentinfo) plus the two layers a screen has that a document does not:
`overlay` (dialog, sheet, drawer, popover, menu) and `toast`. `nav` is placed
top, side or bottom by the shell. In the recipes below, `shell` is the frame
and its nav placement, and `fab` is a corner of `main`. `nested` means the
component only appears inside a block.

**Props, and the question each becomes.** Figma's five property types, plus
the two it leaves to numbers, each map onto one Jev question type — except
text:

| Figma property | Prop here | Jev question | Example |
| --- | --- | --- | --- |
| Variant | enum, at most 8 values | `choice` | `variant` primary·secondary·tertiary·destructive |
| Boolean | `y/n`, and every optional section | yes/no | `search` y/n; `stats-row?` |
| Instance swap (with preferred instances) | a slot's alternatives | `choice` over at most 4 blocks | list body: `stacked-list`·`card-grid`·`data-table` |
| Slot | a layout slot | none — the recipe fixes it | `main` |
| — | count range | `score` over ordered levels | `rows` 3–12 |
| — | selected index | `choice` over 1…n, n ≤ 6 | `tab-bar` `selected` |
| **Text** | **none** | **Jev writes no prose** | actionable text → `intent` (49 values, §3); headings from the archetype's own name; body text as redacted bars |

### Primitives — 73, each named by two or more of ten sources

These are the renderer's vocabulary. A person or an agent can place any of
them by hand; Jev meets them inside blocks and where a recipe names one
directly (a `heading`, a `search-field`, a `tab-bar`).

**Layout** (10)

| id | named by | props that matter at wireframe fidelity | slots |
| --- | --- | --- | --- |
| `frame` | 3 · BQ HIG EX | `device` phone·tablet·browser·desktop·watch; `orientation` portrait·landscape | root |
| `box` | 4 · BQ HIG EX WC | `fill` none·light·dark; `label` y/n | any |
| `stack` | 3 · CG A2 JR | `direction` row·column; `gap` s·m·l; `align` start·center·end | nested |
| `grid` | 3 · HIG MB JR | `columns` 2–6; `items` 2–24; `content` cards·images | main |
| `card` | 7 · CG MB WE A2 JR RC EX | `media` none·top·left; `actions` 0–2; `elevated` y/n | main, aside |
| `divider` | 7 · BQ CG MB WE A2 JR WC | `axis` horizontal·vertical; `label` y/n | nested |
| `split-view` | 2 · BQ HIG | `panes` 2–3; `axis` horizontal·vertical | main |
| `fieldset` | 2 · BQ CG | `legend` y/n; `fields` 1–8 | main, aside |
| `accordion` | 5 · BQ CG HIG MB JR | `items` 2–8; `open` index or none; `multi` y/n | main, aside |
| `scroll-area` | 4 · BQ HIG EX WC | `axis` vertical·horizontal; `bar` y/n | main |

**Navigation** (14)

| id | named by | props that matter at wireframe fidelity | slots |
| --- | --- | --- | --- |
| `app-bar` | 3 · MB RC EX | `title` y/n; `leading` none·back·menu·close; `actions` 0–3; `search` y/n | header |
| `tab-bar` | 4 · BQ HIG MB RC | `items` 3–5; `selected` index; `labels` y/n | nav (bottom) |
| `tabs` | 9 · BQ CG HIG MB WE A2 JR RC EX | `count` 2–6; `selected` index; `style` line·pill·vertical | header, main |
| `side-nav` | 4 · CG HIG MB EX | `items` 3–10; `selected` index; `groups` 0–3; `collapsed` y/n | nav (side) |
| `breadcrumbs` | 5 · BQ CG HIG MB EX | `depth` 2–5 | header, main |
| `pagination` | 3 · CG MB JR | `pages` 3–10; `current` index; `style` numbered·prev-next | main, footer |
| `link` | 5 · BQ CG MB WE JR | `intent` (action vocabulary) | any |
| `menu-bar` | 2 · BQ HIG | `items` 3–8; `selected` index | header, footer |
| `dropdown-menu` | 5 · BQ CG HIG MB JR | `items` 2–8; `dividers` 0–2; `destructive` y/n | overlay |
| `page-indicator` | 2 · HIG RC | `count` 2–6; `current` index | main, footer |
| `steps` | 2 · CG MB | `count` 2–6; `current` index; `labels` y/n | header, main |
| `tree` | 4 · BQ CG HIG MB | `depth` 1–4; `expanded` y/n | nav (side), aside |
| `search-field` | 6 · BQ CG HIG MB WE EX | `scope` y/n; `state` empty·typing·filled | header, main |
| `toolbar` | 3 · BQ HIG MB | `actions` 2–8; `overflow` y/n | header, footer |

**Input** (21)

| id | named by | props that matter at wireframe fidelity | slots |
| --- | --- | --- | --- |
| `button` | 9 · BQ CG HIG MB WE A2 JR RC EX | `intent`; `variant` primary·secondary·tertiary·destructive; `size` s·m·l; `icon` none·leading·only; `state` default·disabled·loading | any |
| `icon-button` | 3 · BQ WE EX | `intent`; `shape` round·square | header, any |
| `fab` | 2 · MB WE | `intent`; `extended` y/n | fab |
| `button-group` | 4 · CG JR RC EX | `count` 2–4; `variant` primary-first·equal | main, footer |
| `segmented-control` | 4 · CG HIG MB JR | `count` 2–5; `selected` index | header, main |
| `text-field` | 9 · BQ CG HIG MB WE A2 JR RC EX | `kind` text·email·password·number·phone·code; `label` y/n; `helper` y/n; `state` default·focus·filled·error·disabled | main, header |
| `textarea` | 6 · BQ CG WE JR EX WC | `rows` 2–8; `counter` y/n; `state` default·focus·error | main |
| `select` | 9 · BQ CG HIG MB WE A2 JR EX WC | `options` 2–8; `state` closed·open·disabled | main, header |
| `combobox` | 3 · CG HIG MB | `suggestions` 0–6; `multi` y/n | main, header |
| `checkbox` | 8 · BQ CG MB WE A2 JR RC EX | `count` 1–8; `checked` none·some·all; `state` default·disabled | main |
| `radio-group` | 7 · BQ CG MB WE JR RC EX | `count` 2–6; `selected` index; `layout` stacked·inline·cards | main |
| `switch` | 8 · BQ CG HIG MB WE JR RC EX | `on` y/n; `label` y/n; `state` default·disabled | main |
| `slider` | 10 · BQ CG HIG MB WE A2 JR RC EX WC | `range` y/n; `ticks` y/n; `value` 0–100 (score) | main |
| `number-stepper` | 6 · BQ CG HIG MB RC EX | `min` 0–1; `max` 5–99 | main |
| `date-picker` | 8 · BQ CG HIG MB WE A2 RC EX | `mode` field·calendar·range; `time` y/n | main, overlay |
| `time-picker` | 3 · HIG MB A2 | `format` 12h·24h | main, overlay |
| `color-picker` | 4 · BQ CG HIG MB | `swatches` 4–12; `custom` y/n | main, overlay |
| `file-upload` | 4 · CG HIG MB EX | `kind` dropzone·button·image; `files` 0–5 | main |
| `rating` | 3 · CG HIG MB | `max` 5·10; `value` 0–max (score); `readonly` y/n | main |
| `rich-text-editor` | 2 · CG HIG | `toolbar` y/n; `rows` 4–20 | main |
| `label` | 2 · BQ CG | `required` y/n | nested |

**Display** (10)

| id | named by | props that matter at wireframe fidelity | slots |
| --- | --- | --- | --- |
| `heading` | 6 · BQ CG A2 JR EX WC | `level` 1–4; `align` start·center | any |
| `text` | 8 · BQ CG HIG A2 JR RC EX WC | `lines` 1–8; `size` s·m·l; `style` body·caption·quote; `redacted` y/n | any |
| `image` | 10 · BQ CG HIG MB WE A2 JR RC EX WC | `kind` photo·illustration·logo; `ratio` 1:1·4:3·16:9·3:4; `caption` y/n | any |
| `icon` | 7 · BQ CG MB A2 RC EX WC | `glyph` (icon vocabulary); `size` s·m·l | nested |
| `avatar` | 4 · CG MB JR EX | `size` s·m·l; `kind` image·initials; `stack` 1–5; `status` y/n | nested, header |
| `badge` | 4 · CG MB JR EX | `kind` dot·count·label; `tone` neutral·success·warning·danger | nested |
| `chip` | 3 · BQ MB EX | `count` 1–8; `selectable` y/n; `removable` y/n | main, header |
| `tooltip` | 5 · BQ CG MB JR EX | `placement` top·right·bottom·left | overlay |
| `list` | 7 · BQ CG HIG MB A2 RC WC | `rows` 3–12; `leading` none·icon·avatar·thumbnail·checkbox; `trailing` none·chevron·switch·meta·badge; `lines` 1–3; `dividers` y/n | main, aside, nav |
| `description-list` | 2 · CG HIG | `pairs` 2–10; `layout` stacked·inline | main, aside |

**Data** (6)

| id | named by | props that matter at wireframe fidelity | slots |
| --- | --- | --- | --- |
| `table` | 6 · BQ CG HIG MB JR EX | `columns` 3–8; `rows` 3–15; `select` y/n; `sort` y/n; `row-actions` y/n | main |
| `chart` | 3 · BQ HIG EX | `kind` bar·column·line·area·pie·donut·sparkline; `series` 1–4; `legend` y/n | main, aside |
| `progress-bar` | 8 · BQ CG HIG MB WE JR EX WC | `value` 0–100 (score); `label` y/n; `indeterminate` y/n | main, header |
| `progress-ring` | 3 · HIG WE EX | `value` 0–100 (score); `label` y/n | main |
| `calendar` | 2 · BQ EX | `view` month·week·day·agenda; `events` 0–8 | main |
| `map` | 3 · BQ MB RC | `pins` 0–8; `controls` y/n | main |

**Feedback** (4)

| id | named by | props that matter at wireframe fidelity | slots |
| --- | --- | --- | --- |
| `alert` | 4 · CG MB JR EX | `tone` info·success·warning·danger; `dismissible` y/n; `action` y/n | main, header |
| `toast` | 2 · CG MB | `tone` neutral·success·danger; `action` y/n | toast |
| `spinner` | 5 · CG HIG MB WE JR | `size` s·m·l; `label` y/n | main, overlay |
| `skeleton` | 3 · CG MB JR | `shape` text·card·list·media; `rows` 1–8 | main |

**Media** (3)

| id | named by | props that matter at wireframe fidelity | slots |
| --- | --- | --- | --- |
| `media-player` | 5 · BQ CG WE RC EX | `kind` video·audio; `controls` y/n; `ratio` 16:9·9:16·1:1 | main |
| `carousel` | 4 · BQ CG MB JR | `slides` 2–8; `current` index; `peek` y/n | main |
| `web-view` | 2 · HIG RC | `url-bar` y/n | main |

**Overlay** (5)

| id | named by | props that matter at wireframe fidelity | slots |
| --- | --- | --- | --- |
| `modal` | 9 · BQ CG HIG MB WE A2 JR RC EX | `kind` dialog·alert·fullscreen; `actions` 1–3; `destructive` y/n; `dismiss` y/n | overlay |
| `sheet` | 2 · HIG MB | `edge` bottom·side; `detent` half·full; `kind` sheet·action-sheet | overlay |
| `drawer` | 4 · CG MB JR RC | `edge` left·right; `items` 3–10 | overlay |
| `popover` | 4 · CG HIG MB JR | `placement` top·right·bottom·left; `arrow` y/n | overlay |
| `keyboard` | 2 · BQ HIG | `kind` text·numeric·email | overlay (bottom) |

### Blocks — 50, the unit Jev chooses

A block is a pre-composed arrangement of primitives with its own small prop set.
Its internals are fixed by the renderer; what varies is what the props say. ★
marks the eight blocks named by one pattern source only — each is a whole
Relume category or a Mobbin screen pattern, and each is kept because an
archetype cannot be drawn without it.

| id | category | named by | props that matter at wireframe fidelity | slots |
| --- | --- | --- | --- | --- |
| `navbar` | navigation | 4 · RL CG MB EX | `links` 3–7; `cta` 0–2; `search` y/n; `mobile` hamburger·links | header |
| `topbar-banner` | navigation | 2 · RL MB | `dismissible` y/n; `link` y/n | header |
| `footer` | navigation | 2 · RL CG | `columns` 1–5; `newsletter` y/n; `social` y/n; `legal` y/n | footer |
| `app-shell` | layout | 2 · RL MS | `nav` top·side·bottom·none; `aside` y/n | root |
| `page-header` ★ | layout | 1 · RL | `breadcrumbs` y/n; `actions` 0–3; `tabs` y/n; `meta` y/n | header, main |
| `sign-in-form` | auth | 3 · RL MS EN | `social` 0–3; `remember` y/n; `forgot` y/n; `signup-link` y/n | main, overlay |
| `sign-up-form` | auth | 3 · RL MS BA | `fields` 2–6; `social` 0–3; `terms` y/n; `signin-link` y/n | main, overlay |
| `verify-code` | auth | 2 · MS HIG | `digits` 4–8; `resend` y/n | main |
| `forgot-password` ★ | auth | 1 · MS | `step` request·sent | main |
| `onboarding-step` | onboarding | 4 · RL MS EN BA | `media` illustration·image·none; `steps` 2–5; `current` index; `skip` y/n | main |
| `wizard` | input | 3 · RL MS BA | `steps` 2–6; `current` index; `summary` y/n | main |
| `form-block` | input | 5 · RL MS EN CG EX | `fields` 2–10; `sections` 1–3; `actions` submit·submit+cancel | main, overlay |
| `filter-panel` | input | 3 · RL MS MB | `groups` 2–6; `apply` y/n | aside, overlay |
| `settings-group` | input | 5 · MS EN HIG MF BA | `groups` 1–4; `rows` 2–8; `row` switch·chevron·value·mixed | main |
| `composer` | input | 3 · MS EN BA | `toolbar` y/n; `attachments` y/n; `kind` text·media·drawing | main |
| `stats-row` | data | 4 · RL MS HIG MF | `count` 2–4; `trend` y/n; `chart` y/n | main |
| `stacked-list` | data | 3 · RL EN MB | `rows` 3–12; `leading` icon·avatar·thumbnail·none; `trailing` chevron·meta·action·none; `sections` 0–3 | main, aside |
| `card-grid` | data | 3 · RL MB HIG | `items` 3–12; `columns` 2–4; `media` y/n | main |
| `data-table` | data | 4 · RL MS MB MF | `columns` 3–8; `rows` 5–15; `toolbar` y/n; `pagination` y/n; `select` y/n | main |
| `map-with-list` | data | 2 · MS EN | `pins` 3–10; `list` sheet·side | main |
| `blog-list` | content | 3 · RL MS EN | `posts` 3–9; `layout` list·grid·featured | main |
| `long-form` | content | 3 · RL MS EN | `sections` 1–6; `toc` y/n | main |
| `timeline-section` | content | 2 · RL MS | `events` 3–8 | main |
| `detail-header` | content | 2 · RL MS | `media` none·hero·carousel; `meta` 0–4; `actions` 0–3 | main |
| `chat-thread` | social | 2 · MS EN | `messages` 3–12; `composer` y/n; `attachments` y/n | main, footer |
| `comment-list` ★ | social | 1 · MS | `comments` 2–10; `nested` y/n; `composer` y/n | main |
| `notification-list` ★ | social | 1 · MS | `items` 3–12; `grouped` y/n; `unread` 0–5 | main, overlay |
| `profile-header` | social | 2 · MS EN | `avatar` s·l; `stats` 0–3; `actions` 0–2; `cover` y/n | main |
| `feed-post` | social | 2 · MS EN | `media` none·image·video·link; `actions` 2–4; `count` 1–6 | main |
| `gallery-section` | media | 3 · RL MS EN | `items` 4–12; `layout` grid·masonry·carousel | main |
| `player` | media | 2 · MS EN | `kind` audio·video; `artwork` y/n; `queue` y/n | main |
| `pricing-tiers` | commerce | 4 · RL MS EX MF | `tiers` 1–4; `highlight` index; `toggle` monthly·yearly·none | main |
| `comparison-table` ★ | commerce | 1 · RL | `plans` 2–4; `rows` 4–12 | main |
| `product-card-list` | commerce | 2 · RL MS | `items` 3–12; `layout` grid·list; `price` y/n; `rating` y/n | main |
| `cart-summary` | commerce | 3 · MS MF BA | `lines` 1–6; `promo` y/n; `totals` y/n | main, aside |
| `payment-form` | commerce | 3 · MS MB MF | `methods` 1–4; `saved` y/n | main |
| `order-summary` ★ | commerce | 1 · MS | `lines` 1–6; `status` placed·shipped·delivered | main, aside |
| `hero` | marketing | 3 · RL CG EX | `media` none·right·left·background·below; `ctas` 1–2; `form` y/n | main |
| `feature-grid` | marketing | 2 · RL MS | `items` 2–6; `columns` 2–4; `media` icon·image·none | main |
| `cta-section` ★ | marketing | 1 · RL | `ctas` 1–2; `media` y/n; `form` y/n | main |
| `testimonials` | marketing | 2 · RL CG | `count` 1–6; `layout` single·grid·carousel | main |
| `logo-strip` | marketing | 2 · RL MB | `count` 4–8 | main |
| `faq` | marketing | 2 · RL CG | `items` 3–10; `layout` accordion·two-column | main |
| `team-grid` | marketing | 2 · RL MS | `members` 3–12; `columns` 2–4 | main |
| `contact-section` | marketing | 2 · RL MS | `form` y/n; `map` y/n; `channels` 1–4 | main |
| `empty-state` | feedback | 2 · MS CG | `media` y/n; `action` 0–2; `cause` first-use·no-results·cleared | main |
| `error-state` ★ | feedback | 1 · MS | `kind` 404·offline·generic·permission; `retry` y/n | main |
| `success-state` | feedback | 2 · MS BA | `summary` y/n; `actions` 1–2 | main |
| `confirm-dialog` | overlay | 3 · MS EN HIG | `destructive` y/n; `input` y/n | overlay |
| `cookie-consent` | overlay | 2 · RL MS | `kind` banner·modal; `preferences` y/n | overlay, footer |

### What was left out, and why

- **Annotation** — Balsamiq's sticky note, callout, arrow, curly braces,
  red X and scratch-out; wireframe.cc's annotation; MockFlow's notes, arrows,
  brackets. **isocan already has this category** under its own names: the Pen
  (ink over an item becomes a mark *about* it), anchored comments, and post-it
  notes. Rebuilding it inside a wireframe would give a canvas two annotation
  systems that cannot see each other.
- **Device chrome beyond the frame** — status bars and browser toolbars.
  `frame` carries `device`; the rest is the renderer's business, not a choice.
- **Named by one source and needed by no recipe** — camera (Balsamiq's
  Webcam; Enrico's *camera* topic is 8 of 1,460 screens), coach marks, kanban,
  code block, command palette, keyboard key. Each can join when a recipe needs
  it.
- **Folded into props rather than kept as entries** — logo and illustration
  (`image` `kind`), quote (`text` `style`), verification code (`text-field`
  `kind` code), gallery (`grid` `content` images), audio controls
  (`media-player` `kind` audio), lightbox (`modal` `kind` fullscreen), tag
  cloud (`chip`).

## 2 · Screen archetypes

The pattern libraries agree on the screens as firmly as the component lists
agree on the parts. Enrico is the one with a measured distribution: 1,460 screens
sampled at random from Rico's Android apps and labelled by hand into 20 topics
([design_topics.csv](https://github.com/luileito/enrico/blob/master/design_topics.csv)).
It is a 2017-era Android sample, so web apps and marketing sites are absent
from it; Mobbin's screen patterns and Relume's section categories cover those.

| Enrico topic | Screens | Share | Archetype here |
| --- | ---: | ---: | --- |
| list | 265 | 18.2% | `list` |
| tutorial | 163 | 11.2% | `onboarding` |
| gallery | 144 | 9.9% | `gallery` |
| login | 141 | 9.7% | `sign-in` |
| form | 103 | 7.1% | `form` |
| settings | 90 | 6.2% | `settings` |
| menu | 79 | 5.4% | `menu` |
| bare | 76 | 5.2% | `welcome` |
| modal | 67 | 4.6% | `confirm` |
| profile ("a user profile or product") | 63 | 4.3% | `profile`, `detail` |
| news | 59 | 4.0% | `feed` |
| other | 52 | 3.6% | — |
| terms | 39 | 2.7% | `legal` |
| search | 35 | 2.4% | `search` |
| mediaplayer | 32 | 2.2% | `player` |
| editor | 18 | 1.2% | `editor` |
| chat | 11 | 0.8% | `chat` |
| maps | 9 | 0.6% | `map` |
| camera | 8 | 0.5% | — |
| calculator (the README's *Dialer*) | 6 | 0.4% | — |

The eight largest topics are 72.7% of the sample. **The eighteen wave-1
archetypes below cover 1,324 of the 1,460 screens (90.7%)**; all three waves
cover 1,394 (95.5%). What remains is *other*, *camera* and *calculator*.

Mobbin groups its screen patterns into Account Management, New User
Experience, Commerce & Finance, Communication (empty state, error, loading,
permission, success, terms), Content (home, feed, and a family of *detail*
screens), Data (dashboard, charts, forms), Social, User Collections and
Utility, plus Actions, which are patterns within a screen rather than screens ([mobile](https://mobbin.com/explore/mobile/screens),
[web](https://mobbin.com/explore/web/screens)). Its *detail* family is the gap
Enrico hides inside *profile* and *list*, and it earns `detail` its own recipe.

**A recipe** is the tree Jev cannot write. Each slot holds a sequence of
sections; a section is fixed, optional (one yes/no), or a choice among two to
four blocks. Where a recipe offers alternatives for `header`, `nav` or
`shell`, the question is asked **once per flow** and every screen reuses the
answer — MockFlow's "the SAME header/nav/footer chrome… ONLY the main content is
new" and wireframe.cc's master pages, turned into a rule — so only `main`,
`aside` and `footer` are asked per screen. Every id below is checked against
the catalog by the script that measured it.

**Wave 1**

| archetype | evidence | recipe (slot: sequence; `a \| b` = one choice; `?` = yes/no) |
| --- | --- | --- |
| `welcome` (app) | EN bare 76 · MS Welcome & Get Started, Splash Screen | **main**: `image` → `heading` → `text`? → (`button` \| `button-group`) → `link`? |
| `onboarding` (app) | EN tutorial 163 · MS Guided Tour & Tutorial · RL Onboarding Forms | **main**: `onboarding-step` \| `wizard`; **footer**: (`page-indicator` \| `steps`) → (`button` \| `button-group`) |
| `sign-in` (app, site) | EN login 141 · MS Login · RL Sign Up & Log In | **header**: (`app-bar` \| `navbar`)?; **main**: `image`? → `heading` → `sign-in-form`; **footer**: `link`? |
| `sign-up` (app, site) | MS Signup · RL Sign Up & Log In | **header**: `app-bar`?; **main**: `heading` → (`sign-up-form` \| `wizard`); **footer**: `link`? |
| `verify` (app, site) | MS Verification, Forgot Password | **header**: `app-bar`; **main**: `verify-code` \| `forgot-password` |
| `home` (app, web) | MS Home, Dashboard · MF 'SaaS dashboard with sidebar, stats cards, and data table' | **shell**: `app-shell`; **header**: `app-bar` \| `page-header`; **nav**: `tab-bar` \| `side-nav`; **main**: `stats-row`? → `chart`? → (`data-table` \| `stacked-list` \| `card-grid` \| `feed-post`); **aside**: (`filter-panel` \| `stacked-list`)? |
| `list` (app, web) | EN list 265 · MS Browse & Discover · RL Stacked Lists | **header**: `app-bar` \| `page-header`; **nav**: (`tab-bar` \| `side-nav`)?; **main**: `search-field`? → (`chip` \| `segmented-control` \| `tabs`)? → (`stacked-list` \| `card-grid` \| `data-table`); **fab**: `fab`? |
| `gallery` (app, site) | EN gallery 144 · MS Browse & Discover | **header**: `app-bar` \| `navbar`; **main**: `chip`? → (`card-grid` \| `gallery-section` \| `product-card-list`) |
| `detail` (app, web) | MS Product / Article / Event / Post Detail · RL Product/Event/Portfolio Headers | **header**: `app-bar`; **main**: `detail-header` → (`text` \| `long-form` \| `description-list`) → (`comment-list` \| `card-grid`)?; **footer**: (`button` \| `button-group`)? |
| `form` (app, web) | EN form 103 · MS Add & Create, Edit · RL Forms | **header**: `app-bar` \| `page-header`; **main**: `form-block` \| `wizard`; **footer**: `button` \| `button-group` |
| `settings` (app, web) | EN settings 90 · MS Settings & Preferences · BA 'settings page with toggles' | **header**: `app-bar` \| `page-header`; **nav**: `side-nav`?; **main**: `profile-header`? → (`settings-group` \| `form-block`) |
| `menu` (app) | EN menu 79 · MS App Layout | **main**: `profile-header`? → `list`; **overlay**: `drawer` \| `sheet` |
| `profile` (app, web) | EN profile 63 · MS My Account & Profile, User / Group Profile | **header**: `app-bar`; **main**: `profile-header` → (`tabs` \| `segmented-control`)? → (`card-grid` \| `stacked-list` \| `feed-post`) |
| `feed` (app) | EN news 59 · MS News Feed, Social Feed | **header**: `app-bar`; **nav**: `tab-bar`; **main**: (`tabs` \| `chip`)? → (`feed-post` \| `blog-list`); **fab**: `fab`? |
| `search` (app, web) | EN search 35 · MS Search, Filter & Sort | **header**: `search-field`; **main**: `chip`? → (`stacked-list` \| `card-grid` \| `empty-state`); **aside**: `filter-panel`? |
| `confirm` (app, web) | EN modal 67 · HIG Alerts · MS Confirmation, Delete | **overlay**: `confirm-dialog` \| `sheet` \| `modal` |
| `state` (app, web) | CG Empty state · MS Empty State, Error, Acknowledgement & Success | **main**: `empty-state` \| `error-state` \| `success-state` |
| `legal` (app, site) | EN terms 39 · MS Terms & Conditions, Privacy Policy | **header**: `app-bar`; **main**: `long-form`; **footer**: `button`? |

**Wave 2**

| archetype | evidence | recipe (slot: sequence; `a \| b` = one choice; `?` = yes/no) |
| --- | --- | --- |
| `storefront` (app, site) | MS Shop & Storefront · RL Product List Sections | **header**: `app-bar` \| `navbar`; **main**: `search-field`? → (`chip` \| `filter-panel`)? → (`product-card-list` \| `card-grid`) |
| `cart` (app, site) | MS Mobile Shopping Cart · MF 'cart summary' · BA 'shopping cart' | **header**: `app-bar`; **main**: `cart-summary` → `empty-state`?; **footer**: `button` |
| `checkout` (app, site) | MS Checkout, Payment Method · MF 'checkout page with cart summary and payment form' | **header**: `steps` \| `app-bar`; **main**: `form-block` → `payment-form`; **aside**: `order-summary` \| `cart-summary`; **footer**: `button` |
| `order-placed` (app, site) | MS Order Confirmation, Order Detail | **main**: `success-state` → `order-summary` |
| `pricing` (app, site) | MS Pricing, Subscription & Paywall · RL Pricing Sections | **header**: (`navbar` \| `app-bar`)?; **main**: (`heading` \| `page-header`) → `pricing-tiers` → `comparison-table`? → `faq`?; **footer**: `footer`? |
| `landing` (site) | RL Navbars, Hero Header, Feature, CTA, Testimonial, Footer sections | **header**: `navbar`; **main**: `hero` → `logo-strip`? → `feature-grid` → (`stats-row` \| `testimonials`)? → `cta-section`; **footer**: `footer` |
| `about` (site) | RL Team, Timeline, Stats sections | **header**: `navbar`; **main**: (`hero` \| `page-header`) → `stats-row`? → `team-grid` → `timeline-section`?; **footer**: `footer` |
| `contact` (site) | RL Contact Sections · MS Help & Support | **header**: `navbar`; **main**: `page-header` → `contact-section` → `faq`?; **footer**: `footer` |
| `blog` (site) | RL Blog Sections, Blog Post Headers · MS Article Detail | **header**: `navbar`; **main**: `page-header` → (`blog-list` \| `long-form`); **footer**: `footer` |
| `master-detail` (web) | RL Application Shells, Sidebars, Tables · MS Dashboard | **shell**: `app-shell`; **header**: `page-header`; **nav**: `side-nav`; **main**: `data-table` \| `stacked-list`; **aside**: `description-list` \| `card` |

**Wave 3**

| archetype | evidence | recipe (slot: sequence; `a \| b` = one choice; `?` = yes/no) |
| --- | --- | --- |
| `chat` (app, web) | EN chat 11 · MS Chat Detail, Chat Bot | **header**: `app-bar`; **main**: `chat-thread` |
| `notifications` (app, web) | MS Notifications | **header**: `app-bar`; **main**: `notification-list` \| `empty-state` |
| `player` (app) | EN mediaplayer 32 · MS Audio Player, Video Player | **header**: `app-bar`?; **main**: `player` |
| `map` (app) | EN maps 9 · MS Map, Location & Address | **header**: `search-field` \| `app-bar`; **main**: `map-with-list` |
| `editor` (app, web) | EN editor 18 · MS Media Editor, Draw & Annotate · BA 'blog post editor' | **header**: `toolbar` \| `app-bar`; **main**: `composer` \| `rich-text-editor` |
| `comments` (app, web) | MS Comments | **header**: `app-bar`; **main**: `comment-list` |

Wave 1 names 28 blocks and 22 primitives directly; waves 1–2 name 43 blocks,
all three 48. Two blocks — `topbar-banner` and `cookie-consent` — are in the
catalog for a person to place by hand and in no recipe yet.

**The escape hatch.** Enrico's *other* is 3.6% of real screens, and some
requests will not fit any recipe. For those an `other` archetype lets Jev fill
`main` as a sequence of up to five sections, each a choice over every block and
primitive eligible for `main` — 93 options today, still inside 255. It is the
only large question in the design, and it is the one to route to the
bring-your-own agent when Jev's answer is flat.

## 3 · Prototyping from wireframes

### How the tools do it

| Tool | What carries a link | Triggers | Actions | Transitions | Who wires it |
| --- | --- | --- | --- | --- | --- |
| Balsamiq | almost any control; one link per sub-item of a Link bar or AppBar | click in presentation mode | go to board, go to URL, "Go Back (in Full Screen)", link to a new board or a duplicate | none | the person; since Mar 2026 also Balsamiq AI, which generates a separate HTML prototype node |
| Moqups | any object, or a Hotspot | click/tap, right-click, double-click, mouse enter, mouse leave | Go to Page, Open Link, Go Back · Toggle Visibility, Show, Hide, Scroll to | — | the person |
| Figma | any layer | [on click/tap, while hovering, while pressing, mouse enter/leave/down/up, after delay, on drag, key/gamepad, video events](https://help.figma.com/hc/en-us/articles/360040315773-Connect-your-prototype) | navigate, overlay, back, scroll to, open URL | instant, dissolve, smart animate, move in/out, push, slide | the person, or [Figma AI](https://help.figma.com/hc/en-us/articles/24004778051479-Make-interactions-with-AI): "Create simple flows between a selection of top-level frames. Add interactions to back or next buttons. Link to individual frames from a navigation menu." — and "Consistent layer naming can help improve Figma AI output" |
| Uizard | a component, dragged to a screen | click | go to screen, open link (paid) | a transition and a duration | the person; no hover, no swipe, no same-page jump |
| wireframe.cc | any stencil | click in preview | go to page | none | the person |
| Whimsical | arrows between screens (*wireflows*) | — | — | — | the person, or Whimsical AI |

Two things are consistent across all six. **Back is universal and is
history, not a named target** — Balsamiq, Moqups and Figma each have it as its
own action. And **the AI wiring that exists is modest by the vendors' own
account**: Figma documents three moves (linear flow, back/next buttons, nav menu
to frames) and asks for good layer names, because it is reading names to
guess intent. isocan does not have to guess: the intent is a typed prop.

### The obvious transitions, as rules

Order is geometry, as it already is for slides: kept screens are read in rows,
and "next" means the next kept screen. "Nearest" means the nearest kept screen
of that archetype in reading order.

| Hotspot | Goes to | Transition | Why it is obvious |
| --- | --- | --- | --- |
| item *i* of `tab-bar`, `side-nav`, `navbar`, `menu-bar` | the flow's *i*-th top-level screen | none | Figma AI's "link to individual frames from a navigation menu"; Balsamiq's per-sub-item links |
| `intent` back, or the `app-bar`'s leading chevron | the previous screen in history | pop | Back in Balsamiq, Moqups and Figma |
| `intent` close / dismiss / cancel on an overlay | the screen under the overlay | overlay out | Figma's overlay actions |
| `intent` continue, next, done, submit, save, apply, accept, confirm | the next kept screen | push | Figma AI's "back or next buttons" and "simple flows" |
| `intent` skip in an onboarding run | the first kept screen after the run | dissolve | Mobbin's New User Experience flows end at home |
| a row or card of `stacked-list`, `card-grid`, `data-table`, `feed-post`, `product-card-list`, search results | nearest `detail` | push | list/detail — Enrico's largest topic and Mobbin's detail family |
| `intent` add or edit, and `fab` | nearest `form` (or a `modal` holding `form-block`) | push or overlay | Mobbin's Add & Create and Edit |
| `intent` delete | a `confirm` overlay; its confirm returns to the origin | overlay | HIG Alerts; Mobbin's Delete and Confirmation |
| `intent` filter, sort, share, more, menu, info | the matching overlay: `filter-panel`, `sheet`, `dropdown-menu`, `drawer`, `popover` | overlay | Moqups's object interactions; Figma's overlays |
| `intent` sign-in, in a `sign-in-form` | first kept post-auth screen (`home`, `list` or `feed`) | dissolve | the root changes; there is no "back" into a login |
| `intent` sign-up, forgot-password, log-out | `sign-up`, `verify`, `sign-in` | push, push, dissolve | Rico's *register*, *forgot password*, *logout* concepts |
| `intent` search, settings, profile, notifications, cart, checkout, buy, home, terms, contact, upgrade, help, messages | nearest screen of that archetype (`buy` → `order-placed`) | push, or none when the target is a nav item | the intent names the archetype |
| `tabs` and `segmented-control` inside `main` | the same screen with `selected` = *i* | none | Moqups fakes this with Show/Hide, not a page |
| accordion, select, switch, checkbox, carousel, pagination, page indicator | nothing — state within the screen | — | object interactions, not navigation |

Four transitions are enough, and each carries information rather than
decoration, which is the line [the motion note](2026-08-28-motion.md) drew:
**none** (a sibling — tabs, nav items), **push/pop** (deeper, back),
**overlay in/out** (something over this screen), **dissolve** (the root
changed — signed in, finished onboarding). Smart animate and slide add nothing
at wireframe fidelity.

### The intent vocabulary

49 intents, grouped by what they do to navigation: forward 10 (continue, next,
get-started, done, submit, save, apply, confirm, accept, skip), auth 4
(sign-in, sign-up, forgot-password, log-out), back 4 (back, cancel, close,
dismiss), detail 1 (open), form 2 (add, edit), overlay 7 (filter, sort, share,
delete, more, menu, info), jump to an archetype 13 (search, settings, profile,
notifications, cart, checkout, buy, home, terms, contact, upgrade, help,
messages), and in place 8 (like, follow, play, select, copy, retry, upload,
remember).

Checked against Rico's lexicon of 197 text-button concepts — normalised labels
mined from real Android screens — **40 of the 49 are concepts in it by name**
(Rico's *login*, *register* and *logout* standing for sign-in, sign-up and
log-out), two more by an obvious synonym (*favorites* for like, *premium* for
upgrade), and seven are absent: get-started, done, submit, confirm, cancel
(present only as Spanish *cancelar*), dismiss and cart. The vocabulary does not
have to be invented; it has to be pruned. A button's rendered label is its
intent's default wording, which is how a wireframe gets "Sign in" on its button
without Jev writing a word.

### What cannot be inferred, and what to do instead

- **Branches** — valid versus invalid form, success versus error. A wireframe
  prototype shows the happy path; an `error-state` screen, if kept, is reached
  from nothing. Say so rather than invent a trigger.
- **Which row goes where.** Every row goes to the one `detail` screen, the
  convention hand-made prototypes follow too.
- **Gestures.** Swipe and hover are absent from Uizard entirely; leave them out.
- **A target that was never kept.** The hotspot renders dashed and says which
  archetype it needs ("no `settings` screen yet"). This is Balsamiq's "Link to a
  new board" turned inside out: the prototype becomes the list of screens still
  to make, and the archetype of each is already known.

## 4 · Asking Jev

### What is measured, and what is not

From [judge phase 0](../projects/judge/phases.md), five calls on 19 Sep: a
131-option `choice` cost **2,365 input tokens** (output is free), latency was
**193, 195, 289, 306 and 351 ms**, and the cost per call **$0.0000993**. The
returned distribution was sparse — **127 of 131 options came back at exactly
0** — and repeated calls moved the top probability by about ±0.035. Many
questions ride one `state` in a single call. Nothing has been measured on
wireframe questions; everything below about cost is an estimate from that one
call's density, and nothing about accuracy is claimed at all.

### The question plan

Three rounds per request, each round's `state` carrying the previous answers,
calls within a round in parallel. The order of the screens is not asked: it
is the archetypes' own running order (welcome → onboarding → sign-in → home →
list → detail → form → settings…), laid out on the canvas in rows.

| Round | Asked once per | Questions | Largest option set |
| --- | --- | --- | --- |
| 1 · the flow | request | one yes/no per archetype ("does this need a sign-in screen?"), the platform (app · web · site), the nav pattern (`tab-bar` · `side-nav` · `navbar` · none), and the recipes' header alternatives | 4 (beside 34 yes/no questions) |
| 2 · structure | screen | each optional section (yes/no) and each choice among blocks | 4 |
| 3 · props and intents | screen | each chosen block's enums (`choice`), flags (yes/no), counts (`score`), and each actionable element's `intent` | 49 (intents, filtered per element) |

A flow of eight screens is 17 calls in three rounds — at the measured latency,
roughly 0.6 to 1.1 seconds of model time if each round runs in parallel. At
the measured density (about 18 input tokens per option, instructions and state
included, for long path-shaped option names) such a flow is in the order of
tens of thousands of input tokens — about a tenth of a cent at $0.042 per
million. **Estimates, both**, to be replaced by the first real run.

**Why not category first, then component.** It was the obvious proposal and it
is the wrong question: *which category?* is not a decision a screen has, it
doubles the calls, and it cannot express the constraint that matters —
coherence across a flow — which the rounds above express by fixing the chrome
in round 1. The slot is the filter (wireframe.cc's lesson), and the recipe
makes it small. Category first earns its place only if one slot's alternatives
grow past a hundred or so near-synonyms, as Relume's 527 feature sections would.
There is a measured reason to avoid near-synonyms in any one question: on the
only card on record, Jev put 0.99 on the right *branch* of a folder tree and
split it 0.72 / 0.23 between a parent and its child — "the judge knows the
region and not the depth". Options inside one question should be as distinct
as the catalog's de-duplication can make them.

### Variations come from the distribution, not from asking again

Jev returns the whole distribution for every question. The first variation is
the argmax everywhere. Each further variation flips the **least certain**
decision — the choice point whose runner-up holds the most probability — to its
runner-up. Variations are then spent exactly where the model was unsure, and
when the person keeps one screen and drops another, that is a label on the very
decision the model was unsure of: the calibration data the judge project needs,
produced as a side effect. The sparse distribution cuts both ways — a question
whose runner-up is at zero offers no honest variation, and the right response
is to say so (or hand that slot to the agent), not to sample noise.

### It stays bring-your-own-agent

The question set for a screen is a file — Jev's own request shape, one `state`
and named questions — and the answers are a file in Jev's response shape. Jev
answers it through the judge seam; [the judge design's](../projects/judge/design.md)
uniform stub answers it (random but valid screens, which is what the tests
want); and any agent can answer it through the CLI. Jev is one answerer, not a
dependency, which keeps this on the right side of "isocan does not ship a
model".

### A calibration set that already exists

Enrico's 1,460 screens come with DOM-like view hierarchies
([hierarchies.zip](http://userinterfaces.aalto.fi/enrico/resources/hierarchies.zip),
16 MB uncompressed) and human topic labels. Flattened to text, each is a
question — *which of these archetypes is this screen?* — with a known answer.
It is not round 1 exactly, which reads a request rather than a screen, but it
measures whether Jev can tell the archetypes apart at all, which round 1
depends on. That is the ledger pattern from the System One note again: labels
a person already produced, used before anyone trusts the model.

## Where it lands in isocan

### What already exists

| The feature needs | isocan already has |
| --- | --- |
| Show variations, pick one | `prefer <winner> --over <other>` (cheap, repeatable), `choose` (final; folds the winner into its source, one undo), `design compare` / `respond` / `decide` for structural alternatives |
| A cheap mark on screens | `react` — one bit per person, both surfaces |
| An ordered set of screens | `slides`: a property set by `item.update`, order is geometry, `deck.html` exports one self-contained file from core's `deckHtml` |
| Notes on a wireframe | the Pen's annotations, anchored comments, post-its |
| Make-real's iterate loop | ink over an item wakes the agent parked on it, which rebuilds |
| A greyscale look | the design-competition *IDEO* pack's tokens, in DESIGN.md form, which core already parses |
| A kind of thing that can be removed | modules — the mind map is the precedent: "a node is a text node and an edge is a property", and a home without the module still shows the nodes |
| One undo for a batch | op groups (`group` on an operation), as `choose` already uses |

### What would be new, walked against *done means done*

1. **Ops.** None new. A screen is an HTML item (`item.add`) rendered from a
   spec that rides inside it as a `<script type="application/json">` block, so
   the screen renders anywhere an HTML item does and outlives the module.
   Variations are sibling items made from the screen, added in one op group.
   *Keep* is a property set by `item.update`, as a slide is. A person's link
   override is a property on the screen, as a mind-map edge is; **inferred links
   are not stored** — they are computed from where the screens are and what their
   intents say, as the mind map computes its lines, so there is nothing to drift.
   The prototype is one more HTML item, assembled from the kept screens, that
   gains a version when it is rebuilt — Balsamiq's separate, regenerable node.
2. **CLI verbs.** A module family, say `isocan wire`: compose a flow from a
   request, vary a screen, keep, link, assemble the prototype, and print or
   apply the question file for an agent to answer. A person can also place any
   block by hand into a slot — Figma's complaint, answered.
3. **Agent guide.** The module's own `agent-guide.md`, as the mind map has.
4. **Core helpers.** The catalog, the recipes, the renderer (spec → greyscale
   HTML), the intent → transition rules and the prototype assembler all compute
   the same thing on both surfaces, so they live in core or the module's core —
   beside `deckHtml`, which is the nearest relative.
5. **README** and **6. tests**: the renderer and the rules are pure; the
   click-through is a browser walk to be said out loud.

The prototype stays inside the existing sandbox. HTML items render in
`allow-scripts` frames without same-origin, and the only message bridge out of
one today is the measuring probe. A single self-contained prototype that routes
between its own sections needs no bridge; clicking from one canvas item into
another would need one, and is not needed for the first version.

**Fidelity, stated plainly.** Jev-composed screens are structure. The
design-partner workflow asks structural alternatives to carry "the same
realistic scenario", and the IDEO pack says "never lorem ipsum"; Jev can supply
neither. So a composed screen is one fidelity step below the design-partner's
working wireframes: its headings come from its archetype, its buttons from
their intents, and its body text renders as redacted bars — until an agent,
if one is present, writes the copy. That is also the natural division of
labour: the cheap model goes wide on structure, and the agent or the person
converges.

**Is this built out of fear?** Whimsical, Balsamiq, MockFlow and Relume all
ship AI wireframing now, so the question has to be asked. The case on merit is
isocan's own: [the design-partner research](2026-09-14-design-partner.md) says
"Wireframes should be easy to obtain and offered when they help", and the decision
half of the loop is already built and waiting for a cheap generator. If a
competitor's feature were the only reason, the answer would be the agent-authored
wireframes isocan already produces.

## Recommendation

**Build wave 1 as a module: 18 archetypes, 28 blocks, and the primitives
they draw with — start from the 22 the recipes name directly (17 of them named
by three or more sources; the other five — `page-indicator`, `steps`, `sheet`,
`fab`, `description-list` — by two) and add from the 44 named by four or more
only as a block needs one. Ask Jev in three rounds — flow, structure, props —
with the chrome fixed once per flow, so that no question exceeds 49 options and
no structural question exceeds 4; give actionable text a typed `intent`, and
compute every prototype link from intents, archetypes and canvas order instead
of asking a model for it.** Before any of it is trusted, put the archetype
question to Jev against Enrico's 1,460 labelled screens and read the
reliability curve.

Categories in the order the recipes need them: navigation and layout first
(`app-bar`, `tab-bar`, `side-nav`, `navbar`, `app-shell`, `page-header`), then
input and auth (`form-block`, `sign-in-form`, `sign-up-form`, `verify-code`,
`settings-group`), display and data (`stacked-list`, `card-grid`, `data-table`,
`detail-header`, `stats-row`), then feedback and overlay (`empty-state`,
`error-state`, `success-state`, `confirm-dialog`). Commerce and marketing are
wave 2; social, media and utility wave 3. Grow props before blocks: a block
chosen and then repeatedly dropped by the person is the signal that a prop is
missing, and Relume's 527 feature sections are what growing blocks instead
looks like.

**Runner-up: category first, then component, over a flat catalog.** It keeps
every question under 255 and needs no recipes, which is why it was the first
idea. It lost because it asks questions a screen does not have, doubles the
calls, and cannot hold a flow together — the tab bar can change between two
screens because nothing ties them. Keep it in reserve for the day one slot's
alternatives outgrow a hundred.

**Runner-up: let a model write the tree.** A2UI, json-render and MockFlow's MCP
all do this well — the model emits a spec or HTML, and the catalog validates it.
It lost because Jev cannot do it, and because isocan already does it: that is
what an agent authoring working wireframes through `design compare` is. It
stays as the escape hatch — the `other` archetype and any question whose
distribution comes back flat go to the bring-your-own agent, which is the
judge project's rule applied here: the typed model triages, and something that
can explain itself takes what it is unsure of.

## What this does not claim

- **No accuracy.** Not one wireframe question has been put to Jev. The cost and
  latency lines are estimates from one measured call's density.
- **Naming is not usage.** "Named by 9 of 10" says the field agrees a thing
  exists, not that screens use it often. Enrico's topic counts and Relume's
  category counts are the only frequency figures here.
- **The Balsamiq list is old.** The 77 control types come from two open parsers
  of Balsamiq's older BMML format. Current Balsamiq documents its controls in 40
  guideline articles and may have control types those parsers never knew.
- **Mobbin's lists include SEO pages.** Its "Others" element group and the
  *Misc*/*Others* screen groups were excluded as landing pages, not taxonomy.
- **First Draft's library sizes are second-hand** — one user's forum post, not
  Figma.
- **The props are proposals.** They are drawn from the sources' own properties
  (Whimsical's sizes and states, Balsamiq's properties, Excalidraw's variant
  names, A2UI's and json-render's schemas) but have not been tried by a person.

## Sources

Tools and products:
[Balsamiq UI control guidelines](https://balsamiq.com/learn/ui-control-guidelines/) ·
[Balsamiq linking](https://balsamiq.com/support/creating-and-editing/linking/) ·
[Balsamiq AI prototyping](https://balsamiq.com/support/creating-and-editing/prototyping/) ·
[Balsamiq AI wireframing](https://balsamiq.com/support/docs/creating-and-editing/wireframing/) ·
[Introducing prototyping in Balsamiq, 19 Mar 2026](https://balsamiq.com/blog/introducing-prototyping/) ·
[BMML control dump](https://github.com/cory/mockup/blob/master/lib/data/balsamiq-all-controls.xml) ·
[napkee](https://github.com/enricoberti/napkee) ·
[Whimsical: a fast, collaborative wireframing app](https://whimsical.com/blog/fast-collaborative-wireframing-app) ·
[Whimsical: left-handed shortcuts](https://whimsical.com/blog/why-we-optimized-left-handed-shortcuts-in-wireframes) ·
[Whimsical AI wireframes](https://whimsical.com/ai/ai-wireframes) ·
[Moqups stencils](https://moqups.com/hc/stencils/) ·
[Moqups interactions](https://moqups.com/hc/interactions/) ·
[Moqups page interactions](https://moqups.com/hc/interactions/page-interactions/) ·
[Moqups object interactions](https://moqups.com/hc/interactions/object-interactions/) ·
[MockFlow components](https://mockflow.com/wireframing/ui-components/) ·
[MockFlow component packs](https://support.mockflow.com/article/80-component-categories) ·
[MockFlow WireframePro MCP](https://mockflow.com/mcp/wireframepro/) ·
[wireframepro-mcp (MIT)](https://github.com/mockflow/wireframepro-mcp) ·
[wireframe.cc docs](https://wireframe.cc/docs/) ·
[Excalidraw libraries](https://github.com/excalidraw/excalidraw-libraries) ·
[Figma: First Draft](https://help.figma.com/hc/en-us/articles/23955143044247-Use-First-Draft-with-Figma-AI) ·
[Figma: component properties](https://help.figma.com/hc/en-us/articles/5579474826519-Explore-component-properties) ·
[Figma: connect your prototype](https://help.figma.com/hc/en-us/articles/360040315773-Connect-your-prototype) ·
[Figma: make interactions with AI](https://help.figma.com/hc/en-us/articles/24004778051479-Make-interactions-with-AI) ·
[Figma Community licensing](https://help.figma.com/hc/en-us/articles/360042296374-Figma-Community-copyright-and-licensing) ·
[Figma forum: connect your own library](https://forum.figma.com/suggest-a-feature-11/when-will-figma-ai-allow-you-to-connect-your-own-library-37491) ·
[Figma forum: use the First Draft libraries by hand](https://forum.figma.com/ask-the-community-7/can-i-manually-use-the-first-draft-libraries-to-customize-the-design-47617) ·
[Lo-fi Wireframe Kit](https://lofiwireframekit.com/) ·
[Relume React categories](https://www.relume.io/react-categories/navbars) ·
[Relume: create and edit wireframes](https://www.relume.ai/resources/docs/how-to-create-and-edit-wireframes-in-the-relume-site-builder) ·
[Uizard: interactive projects](https://support.uizard.io/en/articles/6435343-creating-an-interactive-project) ·
[Uizard: wireframe mode](https://uizard.io/blog/benefits-of-wireframe-mode-for-product-teams/) ·
[tldraw: make real, the story so far](https://tldraw.dev/blog/make-real-the-story-so-far) ·
[make-real-starter](https://github.com/tldraw/make-real-starter)

Open kits, catalogs and standards:
[Wired Elements](https://github.com/rough-stuff/wired-elements) ·
[Rough.js](https://github.com/rough-stuff/rough) ·
[PaperCSS](https://github.com/papercss/papercss) ·
[DoodleCSS](https://github.com/chr15m/DoodleCSS) ·
[agauniyal/wireframe](https://github.com/agauniyal/wireframe) ·
[A2UI component gallery](https://a2ui.org/reference/components/) ·
[json-render](https://github.com/vercel-labs/json-render) ·
[component.gallery](https://component.gallery/components/) ·
[Apple HIG components](https://developer.apple.com/design/human-interface-guidelines/components) ·
[ARIA landmark regions](https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/)

Pattern libraries and datasets:
[Mobbin screen patterns](https://mobbin.com/explore/mobile/screens) ·
[Mobbin UI elements](https://mobbin.com/explore/mobile/ui-elements) ·
[Liu et al., Learning Design Semantics for Mobile Apps, UIST 2018](https://dl.acm.org/doi/10.1145/3242587.3242650) ·
[Enrico](https://github.com/luileito/enrico) ·
[Enrico project page](https://userinterfaces.aalto.fi/enrico/)

In this repository:
[the System One note](2026-09-19-system-one-and-the-ledger.md) ·
[judge phases](../projects/judge/phases.md) and [design](../projects/judge/design.md) ·
[design-partner design](../projects/design-partner/design.md) ·
[the design-partner research](2026-09-14-design-partner.md) ·
[motion](2026-08-28-motion.md) ·
[modules](2026-09-04-modules.md) ·
the agent guide's *Choosing between variations* and *The slide deck* ·
`packages/modules/mindmap/agent-guide.md` ·
`packages/modules/design-competition/assets/packs/ideo/DESIGN.md`
