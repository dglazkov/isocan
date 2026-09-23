## Wireframes

A wireframe screen is **a spec drawn from a catalog**: an archetype's recipe
(`sign-in`, `home`, `list`, `detail`… — 18 of them) names its slots, and each
slot holds one block chosen from two to four options (`stacked-list |
card-grid | data-table`). A slot nobody has chosen draws as a **blue
blueprint box** with its name; a chosen one draws in **grey**. The screen
lands as an ordinary HTML item with its spec embedded in it, so comments,
versions, undo and `isocan get` all work on it, and it still renders on a
home without this module.

- `isocan wire "<request>"` composes a **flow** from words: a blueprint
  titled with the request lands at once, then an answerer is asked in three
  rounds — the flow (which archetypes, the platform, the shared nav and
  header), each screen's structure, each screen's props and intents — and
  each round writes a new version into the same items, so the row goes blue
  then grey in place. The whole request is one op group: one `isocan undo`
  takes it all back. `--answerer jev` (the default when `TYPESAFE_API_KEY`
  is set) asks Jev; without a key the default is `--answerer home` — Jev
  through the canvas's home, with the home's key — and when the home has no
  key either it says so and the stub answers; `--answerer stub` draws a
  random but valid flow, deterministic under `--seed`; `--answerer agent`
  leaves the rounds to you. A person does the same from the Chat with
  `/wire <request>` (and `/wire prototype`, `/wire style`): the browser
  runs this same composer against the home's judge, as that person. The last line says who answered, the latency
  per round, calls, input tokens and cost. `--save <dir>` keeps every
  round's request and response; `--at x,y` starts the row somewhere.
- **Variations come at the end of every flow**, in the same op group:
  under each screen, up to two siblings titled `<Screen> · <what flipped>`
  (`List · data table instead of stacked list`, `Detail · without button
  group`, `Home · with stats row`). Each flips ONE decision to its runner-up,
  where the answerer was least certain — the decision whose runner-up held
  the most probability first — and nothing whose runner-up is under 0.10.
  Nothing is asked again: the probabilities are the ones the screen already
  carries. A screen whose answerer was sure everywhere gets no sibling and
  says **one way to draw this** under its title. A variation's spec has
  `variantOf` (its screen's item id) and `flip` (`{slot, from, to}`; `omit`
  is a section left out). The header and nav are never varied — the flow
  fixed them once for every screen.
- `isocan wire vary <screen> [--count n]` adds more, the next least certain
  flips a sibling does not already show, under the lowest sibling, in an op
  group of their own; `--count` is how many variations the screen should
  have in all (default 2), so running it twice adds nothing. It refuses a
  variation (vary its screen) and a hand-drawn screen (no distribution).
- **Keepers**: `isocan wire keep <items...>` marks screens 📐 — the property
  `wireKeep=yes` through `item.update`, as a slide is marked, so anyone can
  take it off with `isocan wire unkeep <items...>`; unmarked siblings stay on
  the canvas. `isocan wire kept` lists the kept screens in reading order
  (rows top to bottom, each left to right). A variation can be kept. People
  do the same from the item menu (📐 Keep / Unkeep) or ⇧K.
- **Links are computed, never stored.** `isocan wire links [screen]` prints
  where every hotspot on the kept screens goes, worked out each time from
  intents, archetypes and reading order: an intent with a target goes to the
  first kept screen of that archetype (`sign-in` → the first home, list or
  feed; `next`/`continue`/`save` → the next kept screen); `back` and an app
  bar's chevron go back; a list, grid, table or feed row opens the first kept
  `detail` after it; tab *i* of a tab bar or side nav whose intent found
  nothing takes the *i*-th top-level screen (one that draws the nav) no other
  tab reaches. Anything else that navigates and found nothing is **dashed**
  and says what it needs (`- - needs Settings`) — the list of screens still
  to make. A hotspot's key is `<slot>#<element>` (`main.3#row`,
  `header#leading`, `nav#tab-2`); `--json` has every link with its `rule`.
- `isocan wire link <screen> <element> <target>` overrides one hotspot —
  `<element>` is the key or its part after `#` when that is unique —
  `--none` switches it off, `--back` sends it back, `--clear` gives it back
  to the rules. It is the property `wireLinks` on the source screen, through
  `item.update`, so one `isocan undo` takes it back.
- `isocan wire prototype` assembles the kept screens of a flow (`--flow <id>`
  when more than one flow is kept) as **one self-contained HTML item** to the
  right of them: every screen, a router with a history stack, the links as
  click targets, a push / pop / fade / slide-up by link kind, a Restart. Run
  it again after a kept screen changes and the same item **gains a version**
  (found by its `wirePrototype` property); with nothing changed it writes
  nothing. `isocan open <item>` plays it full screen.
- **Wires draw in the canvas's design system.** The look is a theme over
  the same spec: eleven roles (`ground`, `surface`, `line`, `ink`,
  `ink-muted`, `bar`, `primary`, `on-primary`, `radius`, `font`, `space`),
  by default the greys. `isocan wire style` restyles every wire on the
  canvas in the `DESIGN.md` that governs where it sits (a group's own system
  first, then the canvas's — `isocan design set DESIGN.md [--in <group>]`):
  Jev maps the system's own tokens onto the roles — one choice per role over
  the token names, once per system *version* — and every wire whose theme
  changed gains a version, in one op group, so one `isocan undo` takes the
  restyle back. The output names the token chosen for each role with its
  probability; a role Jev is unsure of (under 0.5) keeps the default and says
  so, and an on-primary under 4.5:1 against primary becomes the system's ink
  or ground. Nothing is ever a colour the system does not hold. Blueprints
  stay blue in every system. `--default` restores the greys; `--flow <id>`
  restyles one flow; `--check` writes nothing and lists wires behind the
  system that governs them (a new `DESIGN.md` version does not restyle
  anything by itself — run `wire style` to bring them forward). Running it
  again with nothing changed asks nothing and writes nothing. A kept flow's
  prototype is rebuilt in the same group. Without `TYPESAFE_API_KEY` the
  home's judge maps it; when the home has no key either, the stub answers,
  and its flat distributions keep every asked role at the default. The spec records it as `style` (`{ "source": "design-system",
  "itemId", "versionId", "roles" }`).
- `isocan wire "<request>"` starts in the governing system: the mapping is
  asked while round 1 is, and the screens arrive in it. `--in <group>`
  composes the flow inside a group — and in that group's own system, when it
  has one.
- `isocan wire questions` prints the pending round of a flow (`--flow <id>`,
  default the newest waiting) as a file of calls, each a request in Jev's
  shape (`state` and named questions, of type `noul` — yes/no — `choice` or
  `score`). Fill each call's `"response"` in Jev's response shape
  (`{"answers": {"<id>": {"type": "choice", "choice": "…", "probabilities":
  {…}}}}`, `{"type": "noul", "noul": 0.8}`, `{"type": "score", "score": 2,
  "probabilities": {"0": …}}`) and `isocan wire answer <file>` applies it;
  repeat until it says the flow is drawn. An answer with an option its
  question never offered is refused, and nothing is written.
- `isocan wire catalog` lists every archetype and each slot's options;
  `--json` adds every block's props and every intent.
- `isocan wire spec <archetype>` prints a blueprint spec (every slot `null`);
  `--resolved` fills each slot with its first option at default props;
  `--platform app|web|site` sizes it (390×844, 1280×800, 1280 wide).
- `isocan wire render <spec.json>` draws a spec and adds it to the canvas —
  one `item.add`, so one `isocan undo` takes it back. `--title`, `--at x,y`,
  `--anchor`, `--in`/`--cell` place it like `isocan add`.

**Words are typed, never free.** A button's label is its **intent**'s label
(`sign-in` → "Sign in", `back` → "Back"), chosen from a fixed vocabulary of
49; each actionable element names which intents it can take, and `wire
render` refuses a spec that gives one it cannot. Headings come from the
spec's `title`; everything else is grey bars, never lorem ipsum. If you want
real copy on a screen, that is a separate, honest act — write an HTML screen
yourself — not a label smuggled into a spec.

To draw a screen by hand: `isocan wire spec detail --resolved > detail.json`,
change a slot's `block` to another of its options with `"props": {}` and no
`intents` (the new block's defaults fill in), or set it to `null` to leave it
blue, and `isocan wire render detail.json`. Leaving an optional slot out of
`slots` altogether means "not on this screen".
