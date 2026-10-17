## Mood board

A **mood board** explores how a thing should *feel* with generated pictures
before anybody draws a screen. Each picture is an ordinary image item marked
`mood: candidate`, with its provenance in properties: `moodPrompt` (the
exact prompt sent), `moodAxis` (what it reached for — light, material,
texture, colour field, era, density, place, lettering), `moodModel`,
`moodRun` (the spread it came from) and `moodParent` (the picture it varies).

- `isocan mood explore "<words>"` — one spread: nine pictures by default
  (`--n`, at most 12), drawn by the home that holds the canvas with **that
  home's Gemini key**, laid out as a tray beside the canvas's content, all one
  undo. It prints *n images ≈ $x* first. Without `--yes` it asks at a
  terminal and refuses everywhere else, with the cost — so an agent passes
  `--yes` only when the person said to spend it. `--from <item>` sends an
  image on the canvas beside the words (More like this).
- `isocan mood keep <items...>` — moves kept candidate tile(s) into the
  **Mood** board (an area or canvas group marked `moodBoard=true`, created on
  first Keep and reused after), marks them `mood=kept`, and writes
  `moodSwatches` (JSON: up to six `{hex, share}` swatches from `sharp`, or
  `estimated: true` from a picture-capable text model when `sharp` is absent),
  all in one undo. Keeping is a person's taste: `mood keep` refuses an agent
  harness or an agent actor, so leave candidate tiles for the person to choose
  from.
- `isocan mood drop [items...] [--run <run>]` — moves named candidate tiles to
  the trash, or with `--run <run>` drops every remaining `mood=candidate` tile
  from that spread run in one undo (closing the tray while leaving `mood=kept`
  tiles untouched).
- `isocan mood more <item> [--push <dial>] [--n <count>] [--words "<words>"] [--yes]`
  — draws four variations by default (`--n`, at most 12) from a kept or
  reference image on the canvas, recording `moodParent=<item>`. With `--push`
  (`warmer`, `cooler`, `quieter`, `louder`, `older`, `newer`, `rougher`,
  `finer`), pushes the look along that dial and records `moodAxis` as
  `push: <dial> · <axis>`; without `--push`, records `more: <axis>`. Prints the
  dollar cost first and requires `--yes` when nobody can be asked at a TTY.
- `isocan mood board [--json]` — reads every `kept` and `reference` tile on the
  Mood board in reading order, with `itemId`, `title`, `mood`, `axis`,
  `prompt`, `words`, and `swatches` (`{hex, share}`), plus the distinct subject
  `words` across kept tiles. `/design-system` uses this to derive `DESIGN.md`
  from the board and cite each palette token and direction field in
  `tokens.isocan.sources`.
- The words are a feeling, not a screen: the home wraps them in a template
  that rules out interfaces, text overlays, logos, brands, real people and
  living artists' styles, and refuses a request naming one before anything
  is spent. A picture the model will not draw is reported in its own words.
- Only the key's owner spends it (or anyone, when they turned sharing on in
  Model keys); a collaborator is refused with the owner's name.
- Never present a candidate as chosen: keeping is a person's taste.
