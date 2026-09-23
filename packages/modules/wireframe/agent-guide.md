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
  is set) asks Jev; `--answerer stub` (the default without a key) draws a
  random but valid flow, deterministic under `--seed`; `--answerer agent`
  leaves the rounds to you. The last line says who answered, the latency
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
