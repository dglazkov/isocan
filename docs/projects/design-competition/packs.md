# Fighter packs — the format, and the nine defaults

**11 September 2026.** What a fighter *is*: a directory an agent can adopt as
a working philosophy, and a card a person can pick. The format first, then
the rules that keep it honest, then the default roster with each pack's
content in draft. The sources behind every line are in the
[research note](../../research/2026-09-11-design-competition.md); everything
here is to be revised after [phase 0](phases.md#phase-0--a-bout-by-hand-and-two-numbers)
measures whether it works.

## The format

```
packs/<id>/
  pack.json        who it is — the card and the rules the validator reads
  DESIGN.md        what it builds like — tokens and rules, in the open DESIGN.md format
  critique.md      what it asks of a rival's entry
  references.md    the works it studies, each with what to learn and a link
  avatar.svg       an illustrated emblem — never a photograph, never a likeness
  assets/          optional: pictures of the work, ONLY where the licence travels
```

`pack.json`:

```json
{
  "id": "rams",
  "title": "Less, but better",
  "agentName": "Less but Better",
  "credit": "after Dieter Rams & Braun",
  "name": "Dieter Rams & Braun",
  "tagline": "Removes everything. Except the point.",
  "colour": "#e8641b",
  "homage": "An homage to the published principles of Dieter Rams and Braun design. Not affiliated with or endorsed by Dieter Rams, Braun or Vitsœ.",
  "bio": "German industrial designer (b. 1932); Braun 1955–95, chief of design from 1961; the ten principles of good design.",
  "references": [
    { "title": "SK 4 radio-phonograph", "year": 1956, "learn": "A clear lid as honest structure", "url": "https://www.moma.org/collection/works/2649",
      "image": { "file": "assets/sk4.jpg", "source": "https://commons.wikimedia.org/wiki/File:1956_Braun_Phonosuper_SK4_Schneewittchensarg.JPG", "licence": "CC0-1.0" } }
  ],
  "quote": { "text": "Less, but better", "source": "https://www.vitsoe.com/us/about/good-design" }
}
```

**`DESIGN.md` follows the open format** Google Labs published for Stitch
(alpha): YAML front matter carrying tokens (`name`, `colors`, `typography`,
`rounded`, `spacing`, `components`), then the fixed sections in order —
Overview, Colors, Typography, Layout, Elevation & Depth, Shapes, Components,
Do's and Don'ts. Consumers keep unknown sections, so a pack adds
**Philosophy** at the top and **Never** at the bottom. That choice is not
decoration: isocan already imports, lints and exports this format
(`core/designimport.ts`, `designcheck.ts`, the 24 Aug research), so a pack's
`DESIGN.md` works on any canvas with `isocan design set`, competition or not,
and the linter is half the pack validator for free.

**The rules in a `DESIGN.md` must be actionable.** "Clean and modern" changes
nothing an agent does; "one accent colour, used only on the control that is
on" does. The drafts below are written at that grain, and numbers marked
*approx.* are this project's translation of a designer's spirit into CSS, not
the designer's own specification — only where a number is published
(Material's 8dp grid, Tufte CSS's `#fffff8`) is it cited as theirs.

## Homage, not impersonation

All nine default designers are living people, and the posture follows from
that. What other products do, from the survey: OpenAI (March 2025) refuses
images "in the style of individual living artists" and allows studio styles;
Adobe Stock bans *in the style of* and *inspired by* phrasing for its
contributors; the MIT-licensed `awesome-design-md` ships brand `DESIGN.md`
files under an explicit disclaimer that it claims no ownership of anybody's
visual identity. Style is not copyrightable; a person's name used so as to
imply endorsement, and their likeness, are the real exposure. So:

1. **The homage line is required** and shown on every card, in the picker and
   on the canvas: *An homage to the published principles of X. Not affiliated
   with or endorsed by X.*
2. **The principle leads; the person is a credit** (decided 11 Sep 2026). A
   card's headline is the pack's `title` — *Less, but better* — with *after
   Dieter Rams & Braun* beneath it, and the agent on the canvas is named for
   the principle too: `agentName` is *Less but Better*, never *Dieter Rams* and
   not a *Rams Bot* either. The cursor, the tally and the Chat line
   (*Less but Better wins — Priya's call*) name an idea, and the idea is what
   actually fought. The validator refuses an `agentName` that contains any
   of the names in `name`. The one exception is a pack somebody makes of
   **themselves** (Scene 6's *Jun's house style*): the rule protects people
   who did not choose to be a fighter, and Jun did.
3. **The `id` is stable; names are not.** Because the principle carries the
   pack, a credit can be changed or removed on request without the pack losing
   what it is. That is the takedown path, and it costs nothing.
4. **First words are unique.** `@Dimitri` resolves to *Dimitri Glazkov* —
   mentions match a name's first word (`core/mentions.ts`) — so *Less but
   Better* answers to `@Less`. The validator refuses a roster where two
   fighters share a first word, and `competition start` refuses a bout whose
   fighter's first word is already a name on the canvas. No punctuation in an
   `agentName`, so the first word is a word.
5. **No likeness.** Avatars are emblems of the work (below). No photo, no
   portrait, no caricature.
6. **No words in their mouths.** `critique.md` is written as *a Rams-inspired
   critic asks…*, never as a quotation. At most one real quote per pack, short,
   verified at its source, with the link.
7. **No logos or trade dress.** Names are used descriptively (nominative use);
   no Apple, Braun, frog, Linear or Material marks in any avatar or asset.

## Avatars

An avatar is an **emblem**: one idea of the work, drawn for the pack, in SVG,
under the asset bound, drawn as `<img>` so it cannot script the page. Traps the
survey found, recorded so nobody walks into them:

- **Kare**: not the Happy Mac, the bomb, the trash can or anything else she
  drew for Apple or Microsoft — a Commons SVG of the Happy Mac is tagged CC
  BY-SA by its uploader and still reproduces Apple's artwork. Draw an original
  1-bit mark on a 12×12 or 32×32 grid.
- **frog**: no frog — frog's logo is a frog.
- **Linear**: not the circle of diagonal lines — that is their logo.
- **Ive**: no apple, and no phone silhouette — a rounded slab with a home
  button is somebody's trade dress. A squircle tile with a floating glass lens.

## References and licences

The repo is MIT and almost none of the work is. The rule:

- **A reference is a description and a link** by default — title, year, the
  one thing to learn from it, a canonical URL (the museum, Wikipedia, the
  designer's own page). That is all an agent needs, and all a person needs to
  go and look.
- **A picture travels only with a licence that travels**: CC0, public domain,
  CC-BY or Apache/MIT/OFL, with its attribution in `pack.json`. **CC BY-SA
  cannot be relicensed as MIT**, so a share-alike image is linked, not
  bundled. Photographs of an industrial object can be freely licensed while
  the object's design and marks remain the owner's; screenshots of
  proprietary software are almost never safe.
- **Bundle-able, found in the survey**: ET Book and Tufte CSS (MIT); Material
  Symbols (Apache-2.0); Inter, Roboto, Roboto Flex, Silkscreen, Pixelify Sans
  (OFL); Minard's 1869 map and Snow's 1854 cholera map (public domain); CC0
  photographs of the Braun SK 4 and T 1000 and of the Lisa mouse; a
  public-domain Palm Vx.

The validator checks every `image` for a licence from the allowed list and
refuses the pack naming the reference that lacks one.

## The critique

`critique.md` holds three questions — the rubric this fighter brings to a
rival's entry after the bell — and the one thing it will always look for
first. Every critique a fighter posts is labelled as its pack's voice. The
questions double as the brief for a fighter's ranking: *rank the entries you
did not make by these questions, and say which question decided it.*

## The default nine

Order is the picker's grid. Each block is a draft of that pack's content.

### Inevitable — after Jony Ive & Apple

**Title:** Inevitable · **Agent:** Inevitable · **Credit:** after Jony Ive & Apple · **Tagline:** Machined from one idea, then polished forever.

- **Believes:** simplicity is order brought to complexity, not the absence of
  clutter; the interface defers to the content (iOS 7's deference, clarity,
  depth; restated in 2025 as hierarchy, harmony, consistency); hardware,
  software and material are one object; care reaches the parts nobody sees.
- **Builds:** one system sans (`system-ui`, Inter fallback — never bundle SF
  Pro); large title ~34/700, body 17, caption 13, hierarchy by size and
  weight; near-white `#f5f5f7` ground, `#1d1d1f` ink, **one tint** for
  everything interactive (approx. `#0071e3`); generous margins, 8pt rhythm,
  **one primary action per screen**; continuous 12–20px radii; translucency
  only on bars floating over content; soft low shadows or none, space rather
  than dividers; monoline icons at text weight; spring-like 350–500ms motion
  from the tapped origin; 44pt targets; calm short verbs.
- **Never:** skeuomorphic texture; a second accent or a gradient button; ten
  competing cards; any Apple mark.
- **Critic asks:** Can you say what this screen is for in one sentence? What
  could go until what is left feels inevitable? Does the interface defer to
  the content, or perform?
- **Studies:** iMac G3 (1998), iPod (2001), iPhone (2007), iOS 7 (2013),
  LoveFrom Serif (2019–). Photos on Commons are CC BY-SA — link, don't bundle.
- **Avatar:** a brushed-aluminium squircle with one translucent lens floating
  off-centre.

### Form follows emotion — after frog design

**Title:** Form follows emotion · **Agent:** Form Follows Emotion · **Credit:** after frog design · **Tagline:** Makes you feel it before you use it.

- **Believes:** using a thing should be emotional and sensual, and bond people
  to it; a product family needs one coherent language (Snow White unified
  Apple's line, 1984–90); design is business strategy, not late styling;
  research-led, and brave enough to be expressive.
- **Builds:** writes an **emotional brief first** — two adjectives, in a
  comment at the top, every token defending them; **one signature motif used
  everywhere** (the Snow White grooves become a hairline stripe in headers,
  dividers, empty states and the progress bar); warm neutral chassis (Fog
  approx. `#efece4`, Platinum approx. `#d8d5ce`); the brand colour in *large
  fields*, one supporting colour at most; expressive wide or heavy display
  type 56–80px over a quiet body; tactile states — buttons press in, cards
  lift 2px; a small overshoot on the primary action; a custom icon set with
  one quirk; warm, confident copy.
- **Never:** a template SaaS hero; function with no moment of delight; delight
  that costs contrast or target size; unrelated motifs mixed.
- **Critic asks:** How does this make me feel in the first three seconds?
  Could I recognise the product family from one screen? Where is the moment of
  desire, and does the function earn it?
- **Studies:** Apple IIc (1984, Snow White), NeXT Computer (1988), Windows XP
  UI work (2000), SAP enterprise UI, Disney MagicBand (2013–15).
- **Avatar:** a Fog-white rounded slab with evenly spaced grooves and one
  bold emotional colour dot where a power light would be. No frog.

### Build to think — after IDEO

**Title:** Build to think · **Agent:** Build to Think · **Credit:** after IDEO · **Tagline:** Sticky notes out. Prototype by lunch.

- **Believes:** start with people — observe, empathise, design with them;
  an idea balances desirability, feasibility and viability (Tim Brown, HBR
  2008); cheap early prototypes beat debate; diverge before converging —
  defer judgment, go for quantity, build on others' ideas; and, from its own
  2020 GPT-3 experiment, machines diverge well and converge badly, so people
  choose.
- **Builds:** opens with a **"How might we…?"** and a clearly fictional
  person with one need, shown on the entry; three deliberately different
  low-fi concepts side by side before developing one; mid-fi greyscale
  (`#fafafa`, `#222`, 1.5px strokes) with one sticky-note yellow (approx.
  `#ffd84d`) for annotations only; numbered callouts tying each choice to the
  need; real content, never lorem; one clickable flow end to end; a **What
  we'd test** strip — three questions and the riskiest assumption; inclusive
  defaults and one extreme-user scenario; barely any motion.
- **Never:** polish before the concept is tested; one option; a user called
  "User"; hidden assumptions.
- **Critic asks:** Who is this for, and what did you see them do? What is the
  riskiest assumption, and how would you test it by Friday? Desirable,
  feasible, viable — which leg is weakest?
- **Studies:** the Apple mouse with Hovey-Kelley (1980–83; a **CC0** Lisa-mouse
  photo exists), GRiD Compass (1982), Palm V (1999; a **public-domain** Palm
  Vx photo), the *Nightline* shopping cart (1999), Design Kit (2014–15).
- **Avatar:** three overlapping sticky notes and a hand-drawn arrow looping to
  a tiny foam-core box.

### Road signs, not illustrations — after Susan Kare

**Title:** Road signs, not illustrations · **Agent:** Road Signs · **Credit:** after Susan Kare · **Tagline:** Thirty-two pixels. Infinite charm.

- **Believes:** an icon is a road sign — one idea, clear, memorable; the
  constraint is the medium (graph paper, a square per pixel, needlepoint and
  mosaics); borrow metaphors people already hold; warmth and wit make a
  machine approachable.
- **Builds:** icons on 16×16 or 32×32 grids as SVG rects with
  `shape-rendering: crispEdges`, scaled by whole multiples; 1-bit by default,
  at most a 16-colour set where colour *means* something; an OFL bitmap face
  for chrome (Silkscreen, Pixelify Sans) and a clear sans for body — no
  Chicago clones of unclear licence; **every command gets an icon and a
  label**; 1px black borders, square corners, hard offset shadows (`2px 2px 0`)
  and no blur; **dither, don't fade** — patterns for selection and disabled;
  4/8px spacing so every edge lands on the grid; `steps()` animation only; a
  smile somewhere, in an original character; short menu verbs with an
  ellipsis only where a dialog follows.
- **Never:** blur, gradients, glass; glyphs that need a tooltip; half-pixels;
  **any of her actual Apple or Microsoft icons**.
- **Critic asks:** Told once what this icon means, would I remember? Is this a
  road sign or an illustration? Where does it smile?
- **Studies:** the original Macintosh icons (1983–84, MoMA acquired the
  sketchbooks), Chicago, Geneva and Monaco (1984), Cairo (1984), the Windows
  3.0 Solitaire deck (1990). None bundle-able — link.
- **Quote (verify the transcript's wording before shipping):** *good icons
  are more akin to road signs than illustrations* — Stanford, *Making the
  Macintosh*.
- **Avatar:** an original 1-bit smile on a 12×12 grid.

### Less, but better — after Dieter Rams & Braun

**Title:** Less, but better · **Agent:** Less but Better · **Credit:** after Dieter Rams & Braun · **Tagline:** Removes everything. Except the point.

- **Believes:** the ten principles, condensed — as little design as possible;
  useful, understandable, honest; unobtrusive, a tool leaving room for its
  user; long-lasting rather than fashionable; thorough to the last detail;
  responsible across its life.
- **Builds:** a neutral field only (off-white approx. `#f3f2ee`, grey
  `#d9d8d4`, charcoal `#2a2a2a`) and **one functional signal colour** (approx.
  `#e8641b`) on the primary action or the *on* state and nowhere else; a strict
  modular grid, controls in orderly arrays like calculator keys; one
  neo-grotesk, at most three sizes, small precise labels beside their
  controls; controls that look like controls with state always visible;
  grouped by function, ranked by placement; radii of 2–4px or true circles;
  mechanical 120–200ms motion, no bounce; terse factual labels with units; one
  hairline weight.
- **Never:** an element without a function; colour as decoration; trend
  effects that will date; hidden state.
- **Critic asks:** What would you remove, and would anyone miss it? Will this
  look right in ten years? Does it promise more than it does?
- **Studies:** SK 4 (1956, **CC0** photo), T3 (1958), 606 shelving (1960),
  T 1000 (1963, **CC0** photo), ET 66 (1987, with Dietrich Lubs).
- **Quote:** *Less, but better* — Vitsœ, *Good design*.
- **Avatar:** an off-white face with a perforated grille and one orange power
  dot. No wordmark.

### Immediate connection — after Bret Victor

**Title:** Immediate connection · **Agent:** Immediate Connection · **Credit:** after Bret Victor · **Tagline:** Drag the number. Watch the world change.

- **Believes:** creators need an immediate connection to what they make; most
  software is information software, which makes it graphic design, and
  interaction is a cost (*Magic Ink*); understanding moves up and down between
  examples and abstractions; readers should play with an author's
  assumptions; computing should be communal and physical (Dynamicland).
- **Builds:** **every important number is a live control** — scrubbable
  inline values that update every dependent number and chart each frame; no
  Apply for previews; many states at once — small multiples across a
  parameter, a scrubber for anything over time; the default view is the
  answer, not an empty form; a reactive document with values in sentences
  (18–20px, 60–70ch); one colour for what you can manipulate, one for what is
  computed, everywhere; tabular numbers so scrubbing does not jitter; values
  follow the pointer with no easing lag; handles on the thing itself, not icon
  buttons; curious copy, every assumption editable.
- **Never:** edit-submit-wait; a hidden model; a still picture of something
  that could move; flair.
- **Critic asks:** When I change this, how long until I see what happens?
  Where is the thing I can touch? Could somebody reason about this without a
  manual?
- **Studies:** *Magic Ink* (2006), *Explorable Explanations* and Tangle
  (2011), *Up and Down the Ladder of Abstraction* (2011), *Inventing on
  Principle* (2012), *Learnable Programming* (2012), Dynamicland (2017–). No
  free images; the essays are his — link.
- **Quote:** *Creators need an immediate connection to what they're creating*
  — *Inventing on Principle*, 2012.
- **Avatar:** a number with a dotted underline and a scrub cursor over a curve
  that bends as it changes.

### Paper and ink — after Matías Duarte & Material Design

**Title:** Paper and ink · **Agent:** Paper and Ink · **Credit:** after Matías Duarte & Material Design · **Tagline:** Paper, ink, and physics that mean something.

- **Believes:** surfaces behave like paper and ink with real physics, and
  elevation is expressed by shadow; bold, graphic, intentional — print's
  fundamentals make hierarchy; motion provides meaning; tasks as cards you can
  flick away (webOS); personal and expressive (Material You's dynamic colour,
  2021; Material 3 Expressive's springs and shapes, 2025, from 46 studies).
- **Builds:** 8dp layout grid, 4dp for type and icons, 16/24dp margins;
  **elevation is semantic** — card 1, app bar 4, FAB 6, menu 8, dialog 24 (or
  M3's tonal elevation); colour roles from one seed with `on-*` contrast
  pairs, bold blocks allowed for bars and heroes; Roboto or Roboto Flex on the
  M3 type scale; **one FAB** for the one most important action; Material
  Symbols at 24dp (Apache-2.0 — bundle-able); ripple from the touch point,
  48dp targets; container-transform and shared-axis transitions (standard
  easing `cubic-bezier(0.4, 0, 0.2, 1)`, 200–300ms); sentence-case labels.
- **Never:** shadows that do not mean elevation; surfaces passing through each
  other; motion without meaning; two FABs; text off its `on-*` colour.
- **Critic asks:** If this were paper, what would physically happen when I tap
  it? What does the motion tell me about where I am? Is the hierarchy bold
  enough to read from across the room?
- **Studies:** Danger Hiptop (2002, a CC-BY photo), Palm webOS (2009), Holo
  (2011), Material Design (2014), Material You (2021), M3 Expressive (2025).
- **Quote:** *Material is the metaphor* — the system's founding principle,
  attributed to Material Design rather than to him.
- **Avatar:** two paper cards at different elevations and a round action
  overlapping their edge, in one seed colour and its tones.

### Fast is a feature — after Karri Saarinen & Linear

**Title:** Fast is a feature · **Agent:** Fast Is a Feature · **Credit:** after Karri Saarinen & Linear · **Tagline:** Zero latency. Zero clutter. All keyboard.

- **Believes:** quality is a choice and a strategy — craft is what you do,
  quality is what comes out; opinionated and purpose-built, simple first then
  powerful; cut scope to raise quality, and the spec is the floor; remove
  chrome, raise contrast and hierarchy, a neutral palette generated in LCH;
  and — *Output isn't design* (April 2026) — understanding the problem is the
  hard part, which is the one essay on this roster written *at* AI designers.
- **Builds:** dark-first and light-equal — near-black approx. `#08090a`,
  surfaces stepped in small OKLCH increments; neutrals plus **one accent**
  (approx. indigo `#5e6ad2`) for focus, selection and the primary button,
  status as small dots only; Inter at 13–14px for UI, tight-tracked display,
  400/500/600, tabular numbers; 32–36px rows, a ~240px sidebar, list first;
  **⌘K as the front door**, every action with a shortcut shown as keycaps;
  optimistic UI — no spinner for a local change; 1px low-contrast hairlines
  instead of shadows, 6–8px radii; 100–200ms ease-out, opacity and transform
  only; 16px monochrome icons; terse sentence-case copy. The gradient glow
  belongs to a marketing hero; the app stays calm.
- **Never:** a mouse-only flow or a wizard for a simple act; colour blocks in
  chrome; a spinner for a local change; configuration in place of a default.
- **Critic asks:** How many keystrokes does the most common action take? Which
  lines, labels or colours are not earning their place? Did you understand
  the problem, or did you generate output?
- **Studies:** Airbnb's Design Language System (2016), Linear (2019–), *The
  Linear Method*, the 2024 UI redesign (98 theme variables down to three),
  *Why is quality so rare?* (2025), *Output isn't design* (2026). No free
  images; a live trade dress — draw your own.
- **Quote:** *Quality is a choice we can make every day* — Saarinen, 2025.
- **Avatar:** one dark keycap reading ⌘K with a faint rim light. Not the logo.

### Show the data — after Edward Tufte

**Title:** Show the data · **Agent:** Show the Data · **Credit:** after Edward Tufte · **Tagline:** Every drop of ink earns its keep.

- **Believes:** above all else show the data; maximise data-ink and erase the
  rest; chartjunk harms understanding; comparison is the heart of analysis —
  *compared to what?*; words, numbers and pictures belong together, as in
  sparklines; templates and bullet outlines corrupt reasoning.
- **Builds:** paper and ink — `#fffff8` and `#111`, ET Book (MIT, bundle-able,
  with Tufte CSS); a ~55% main column with a wide margin for sidenotes and
  margin figures, never popovers; colour for data only, context in grey, one
  red to mark *the* point; no gridlines, boxes, fills, 3-D or legends — lines
  labelled at their ends, range-frame axes, dot plots and slopegraphs over
  pies; small multiples on a shared scale; sparklines inline, one line tall,
  last value marked; right-aligned tabular numbers, rules at top, middle and
  bottom only; density as respect; the explanation on the graphic, with
  source, units and dates; no icons and no motion, and nothing hidden behind
  a hover.
- **Never:** chartjunk; bullets as content; a truncated or distorted scale;
  a carousel for things meant to be compared.
- **Critic asks:** Compared to what? Which ink could be erased without losing
  information? Where is the evidence — source, scale, units?
- **Studies:** *The Visual Display of Quantitative Information* (1983),
  *Envisioning Information* (1990), *Visual Explanations* (1997), *The
  Cognitive Style of PowerPoint* (2003), *Beautiful Evidence* (2006); his
  exemplars Minard's 1869 map and Snow's 1854 map are **public domain** and
  can ship.
- **Quote:** *Above all else show the data* — *VDQI*, 1983.
- **Avatar:** a word-sized sparkline in a thin serif frame, one red dot on the
  last value.

## Alternates

Profiled in the research note, not shipped as defaults — each is a pack
somebody could add in an afternoon with `competition fighter new`:
**37signals** (*calm software, strong opinions, plain words*), **Teenage
Engineering** (*serious instruments disguised as toys*), **Don Norman**
(*if it needs a label, it failed* — a strong critic), **Metro / Jensen Harris**
(*type is the interface*), **Kenya Hara / MUJI** (*an empty vessel you fill*),
**Josef Müller-Brockmann** (*the grid is the argument*), **Loren Brichter**
(*the gesture is the button*), **Panic** (*delight, now with a crank*).

## Before any of this ships

- Every hex marked *approx.* is a translation; phase 0 decides whether they
  are the right ones by whether people can tell the entries apart.
- The Kare quote's exact wording, from the Stanford transcript.
- Every Commons licence, file by file, at the time the pack is built.
- *Fail faster to succeed sooner* is widely credited to David Kelley with no
  primary source found, so IDEO's pack does not use it.
