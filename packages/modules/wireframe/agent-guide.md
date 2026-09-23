## Wireframes

A wireframe screen is **a spec drawn from a catalog**: an archetype's recipe
(`sign-in`, `home`, `list`, `detail`… — 18 of them) names its slots, and each
slot holds one block chosen from two to four options (`stacked-list |
card-grid | data-table`). A slot nobody has chosen draws as a **blue
blueprint box** with its name; a chosen one draws in **grey**. The screen
lands as an ordinary HTML item with its spec embedded in it, so comments,
versions, undo and `isocan get` all work on it, and it still renders on a
home without this module.

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
