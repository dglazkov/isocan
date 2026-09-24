## Wireframes

A wireframe screen is **a spec drawn from a catalog**: an archetype's recipe
(`sign-in`, `home`, `list`, `detail`… — 18 of them) names its slots, and each
slot holds one block chosen from two to four options (`stacked-list |
card-grid | data-table`). A slot nobody has chosen draws as a **blue
blueprint box** with its name; a chosen one draws in **grey**. The screen
lands as an ordinary HTML item with its spec embedded in it, so comments,
versions, undo and `isocan get` all work on it, and it still renders on a
home without this module. The file is **the screen alone** — no name strip
above it and no device outline inside it: the item's own title names it and
the item's own frame is the device. The screen's own chrome (status bar, app
bar, tab bar) stays.

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
  `/wire <request>` (and `/wire prototype`, `/wire style`, `/wire flesh`,
  `/wire rerender`): the browser runs this same composer against the home's
  judge, as that person, and when it finishes it leaves one **record in the
  Chat** in the Wire builder's words — what was made and the numbers — in
  the act's own op group, so the undo that takes the flow back takes its
  record too. The CLI prints those lines to you instead and posts nothing:
  post your ONE comment saying what landed. The last line says who answered, the latency
  per round, calls, input tokens and cost. `--save <dir>` keeps every
  round's request and response; `--at x,y` starts the row somewhere.
- **Round 1 over-includes; keep prunes.** An archetype the answerer gives
  P(yes) ≥ 0.5 is a screen of the flow; one from 0.3 up to 0.5 is drawn
  too, in its running place in the row, but marked **maybe**: the item
  carries `wireMaybe=<p>` (set by the op that adds it), its spec `"maybe":
  true`, and its title reads `(maybe)` in the lines and the Chat record.
  The canvas draws a dashed blue outline round it and a *maybe* tag above
  its top edge — outside the screen, never over it — **while it is not
  kept**: keeping it is the answer, so the mark goes; unkeep and it
  returns. A maybe gets no variations until someone keeps it (`wire vary`
  draws them).
  Under 0.3 it is declined. Jev ranks screens well and is overconfident
  about them (phase 6), so a maybe is often wanted: look at each one and
  **keep (📐) what belongs** — an unkept maybe is only a screen on the
  canvas, never in `wire links`, the arrows or the prototype. Every
  composed screen's spec carries `need`, round 1's P(yes) for it, and
  `by` — who drew it: `{ actor: {id, name}, answerer: "jev" | "stub" |
  "agent", via?: "home", model? }` — so a later reader (or a keep that
  labels a decision) knows whether Jev chose it or the stub threw dice. A
  variation carries its screen's answerer and the actor who asked for it.
- **Variations come at the end of every flow**, in the same op group:
  under each screen, up to two siblings titled `<Screen> · <what flipped>`
  (`List · data table instead of stacked list`, `Detail · without button
  group`, `Home · with stats row`). Each flips ONE decision to its runner-up,
  where the answerer was least certain — the decision whose runner-up held
  the most probability first — and nothing whose runner-up is under 0.10.
  Nothing is asked again: the probabilities are the ones the screen already
  carries. A screen whose answerer was sure everywhere gets no sibling and
  says **one way to draw this** (the screen's tooltip, `data-varied="none"`
  on its body, and the CLI's line). A variation's spec has
  `variantOf` (its screen's item id) and `flip` (`{slot, from, to}`; `omit`
  is a section left out). The header and nav are never varied — the flow
  fixed them once for every screen.
- `isocan wire vary <screen> [--count n]` adds more, the next least certain
  flips a sibling does not already show, under the lowest sibling, in an op
  group of their own, inside the screen's canvas group when it has one;
  `--count` is how many variations the screen should
  have in all (default 2), so running it twice adds nothing. It refuses a
  variation (vary its screen) and a hand-drawn screen (no distribution).
- **Keepers**: `isocan wire keep <items...>` marks screens 📐 — the property
  `wireKeep=yes` through `item.update`, as a slide is marked, so anyone can
  take it off with `isocan wire unkeep <items...>`; unmarked siblings stay on
  the canvas. `isocan wire kept` lists the kept screens in reading order
  (rows top to bottom, each left to right). A variation can be kept. People
  do the same from the item menu (📐 Keep / Unkeep) or ⇧K. `isocan wire
  kept --prototype <item>` lists only the screens that prototype plays, in
  its order — its flow's kept screens and any guest kept in another flow;
  it is what a person sees when they select the prototype on the canvas
  (its screens pulse, then stay outlined, and everything else dims — their
  view only, nothing is written).
- **Links are computed, never stored.** `isocan wire links [screen]` prints
  where every hotspot on the kept screens goes, worked out each time from
  intents, archetypes and reading order: an intent with a target goes to the
  first kept screen of that archetype (`sign-in` → the first home, list or
  feed; `next`/`continue`/`save` → the next kept screen); `back` and an app
  bar's chevron go back; a list, grid, table or feed row opens the first kept
  `detail` after it; a nav item can say it IS one of the flow's screens —
  `open-list`, `open-feed`, `open-gallery` go to the first kept list, feed
  or gallery (and a fleshed one reads in the pack's words, "Deliveries") —
  so when you answer round 3, give the tab that shows the list `open-list`
  rather than a jump whose screen does not exist; tab *i* whose intent found
  nothing takes the *i*-th top-level screen (one that draws the nav) no other
  tab reaches. Anything else that navigates and found nothing is **dashed**
  and says what it needs (`- - needs Settings`) — the list of screens still
  to make. A hotspot's key is `<slot>#<element>` (`main.3#row`,
  `header#leading`, `nav#tab-2`); `--json` has every link with its `rule`.
- `isocan wire link <screen> <element> <target>` overrides one hotspot —
  `<element>` is the key or its part after `#` when that is unique —
  `--none` switches it off, `--back` sends it back, `--clear` gives it back
  to the rules. Each hotspot's override is its own property on the source
  screen, `wireLink:<slot>#<element>`, through `item.update` — so two `wire
  link` calls on one screen at once (or a person retargeting an arrow while
  you relink) both survive; a screen still carrying the older `wireLinks`
  JSON is folded into per-hotspot properties by the first write. It reads
  only the source screen's file and exits when the write lands; one `isocan
  undo` takes it back. A target may be a screen **kept in another flow**:
  the link resolves, and that screen joins this flow's prototype so the
  link plays.
- **The canvas draws one arrow per hotspot**, flow by flow — so the rows of
  `wire links` that go to a screen and the arrows correspond one to one (tabs
  show only while a person points at their screen; back never). A person
  can click an arrow to change where it goes, remove it or reset it: each is
  exactly the `wire link` above, and `/wire links` in the dialog is the same
  table with a picker per hotspot. `isocan wire play <screen> [element]`
  prints the address that opens the flow's prototype full screen AT that
  screen, the hotspot pointed out — what an arrow's *Play from here* opens;
  it writes nothing.
- `isocan wire prototype` assembles the kept screens of a flow (`--flow <id>`
  when more than one flow is kept) as **one self-contained HTML item**
  centred **above** them, clear of the arrows' lanes and of anything already
  there (higher still if it must be) — inside the canvas group the kept
  screens share, when they share one: every screen, a router with a history
  stack, the links as click targets, a push / pop / fade / slide-up by link
  kind, a Restart. Run it again after a kept screen changes and the same
  item **gains a version** (found by its `wirePrototype` property); with
  nothing changed it writes nothing. A rebuild (this, `wire style`, `wire
  flesh`, `wire render --all`) also moves it back above its flow, in the
  same op group — unless it was moved by hand: `wirePrototypeAt` records
  where it was placed, and a prototype standing anywhere else stays put.
  `isocan open <item>` plays it full screen.
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
  again with nothing changed asks nothing and writes nothing — and a new
  system version that maps every role to the same values as before writes
  nothing either (the wire looks the same; its spec keeps naming the version
  that drew it). Words drawn in the primary's voice on the ground — text
  links, secondary and tertiary button labels, the current tab — use the
  primary only where it reads at 4.5:1 on the ground, else the ink. A kept flow's
  prototype is rebuilt in the same group. Without `TYPESAFE_API_KEY` the
  home's judge maps it; when the home has no key either, the stub answers,
  and its flat distributions keep every asked role at the default. The spec records it as `style` (`{ "source": "design-system",
  "itemId", "versionId", "roles" }`).
- `isocan wire "<request>"` starts in the governing system: the mapping is
  asked while round 1 is, and the screens arrive in it. `--in <group>`
  composes the flow inside a group — under everything the group already
  holds, so a second flow never lands across the first's variations — and in
  that group's own system, when it has one. Moving a `DESIGN.md` into or out
  of a group changes what it governs, and `isocan mv --in` / `canvas group
  add|remove` say so in a `note:` line.
- **Fleshed out: sample content instead of bars.** `isocan wire flesh
  [screens…|--flow <id>] [--pack <id>]` fills every wire with believable
  content for *this* app — list rows with titles, second lines and
  statuses ("Parcel 4471 · 3 items · Out for delivery"), stats with values
  and deltas, table cells under domain column names, first names with
  initials in avatars, greyscale pictograms in image slots, and a heading
  from the domain ("Deliveries" instead of "List"). The screen is **named**
  in the pack's words too — a list "Deliveries", a detail "Delivery", a
  form "New delivery", a search "Search deliveries" (a home or a sign-in
  keeps its name) — and so is its item, in the same op group, unless
  somebody renamed the item: a name a person or an agent gave is never
  overwritten. `--bars` names them back. A block's lone bare verb says what
  it acts on ("Edit delivery", "Edit profile"; `actions.<element>` in `wire
  copy`). The words come from one
  of 24 synthetic **content packs** (`wire flesh --packs` lists them), never
  written by a model: Jev chooses the pack per flow from its request — one
  choice question, its p printed and recorded on each screen as `content`
  (`{ "source": "pack", "pack", "p", "by", "title" }`); under 0.4 the
  generic pack fills and the line says so; `--pack <id>` overrides a wrong
  guess without asking. Each slot's words are stored as `fill` in the spec,
  seeded by the screen's item id and the slot (a variation's by its
  screen's), so a re-render, `wire style`, `wire vary` and `wire prototype`
  all show the same content. One op group, a version per wire whose content
  changed; running it again asks nothing and writes nothing; `--bars` goes
  back to bars. Blueprints stay blue and unfilled. A kept flow's prototype
  is rebuilt in the same group. People do the same with `/wire flesh` in
  the Chat.
- **A composed flow arrives fleshed.** `isocan wire "<request>"` (and
  `/wire <request>`) asks for the pack beside round 1 — one call more — so
  the screens land blue, then grey (round 2), then filled (round 3), all in
  the flow's one op group: one `isocan undo` takes the flow back, content
  and all. Its variations, and later `wire vary`'s, take the same pack.
  `--pack <id>` picks the pack without asking; `isocan wire --basic
  "<request>"` (`/wire basic <request>` in the Chat) composes plain grey
  wires with no content, and `wire flesh --bars` takes content off
  afterwards. A pack that cannot be chosen leaves the flow in bars and says
  so. The agent path (`--answerer agent`) fills nothing: once your rounds
  are answered, `isocan wire flesh --flow <id>` does.
- `isocan wire copy <screen>` prints a fleshed screen's words as JSON —
  per slot, each word by path (`items.0.title`, `stats.1.value`,
  `labels.2`). Edit the words, then `isocan wire copy <screen> --apply
  <file>` writes them as one version, with `content.source` `"copy"` and
  `--by <name>` recorded; a path the slot does not hold is refused, so copy
  changes words, never the screen's shape. `"title"` sets the heading.
  `wire flesh` leaves a copied screen alone unless `--pack` or `--bars`.
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
- `isocan wire render --all [--flow <id>]` **re-renders every wire already
  on the canvas** from the spec it carries — how a change to the renderer
  reaches screens drawn before it (a flesh or a restyle writes only where
  the spec changed). A version only where the bytes differ, the item resized
  where the screen's size moved, kept flows' prototypes rebuilt, all one op
  group; it says how many changed, and a rerun writes nothing. `/wire
  rerender` in the Chat does the same.
- **Finding prototypes**: a prototype item carries `wirePrototype=<flow>`
  and is titled `Prototype · <request>`, so `isocan ls --filter Prototype` finds
  them (`--json` shows the property). In the web app ⌘K *Find prototypes* (or
  `/wire prototypes`) lists them and selects them, and while a pointer is on
  the minimap every prototype is lit and everything else steps back.

**Words are typed, never free.** A button's label is its **intent**'s label
(`sign-in` → "Sign in", `back` → "Back"), chosen from a fixed vocabulary of
52; each actionable element names which intents it can take, and `wire
render` refuses a spec that gives one it cannot. Headings come from the
spec's `title`; body copy is grey bars, never lorem ipsum — until `wire
flesh` fills it from a content pack. If you want real copy on a screen,
that is a separate, honest act — `wire copy <screen> --apply <file>` —
not a label smuggled into an intent.

To draw a screen by hand: `isocan wire spec detail --resolved > detail.json`,
change a slot's `block` to another of its options with `"props": {}` and no
`intents` (the new block's defaults fill in), or set it to `null` to leave it
blue, and `isocan wire render detail.json`. Leaving an optional slot out of
`slots` altogether means "not on this screen".
