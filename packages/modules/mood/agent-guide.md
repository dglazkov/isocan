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
- The words are a feeling, not a screen: the home wraps them in a template
  that rules out interfaces, text overlays, logos, brands, real people and
  living artists' styles, and refuses a request naming one before anything
  is spent. A picture the model will not draw is reported in its own words.
- Only the key's owner spends it (or anyone, when they turned sharing on in
  Model keys); a collaborator is refused with the owner's name.
- Never present a candidate as chosen: keeping is a person's taste.
