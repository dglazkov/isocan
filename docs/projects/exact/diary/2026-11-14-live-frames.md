# 2026-11-14 — live frames and pointing at lines (isocan exact phase 2)

A canvas (isocan) frames Acme Market's dev page through a bridge on loopback,
Alt-clicks a node to Tamber `inspect`, and pins comments to the line.

## Rough
- The dev loop's `frame-ancestors` names one tool port; isocan's page is another
  origin, so the bridge proxies the page and rewrites the header and the page's
  `Origin` (the dev gate answers 421 to anything else).
- Three frames of the dev page in one tab were one build until each frame was
  named `exact-copy-<n>` — documented only inside the build channel section.
- `selection` gives file/line/col and component, but no digest of the file; we
  hash it ourselves when relaying, which can race a save.
- `agent check` findings carry a testId and a box, not a source place; joined
  through `contract symbols`' testId definitions.

## Lean in
- `inspect` + `selection` is exactly what a canvas needs: Alt-click to
  `app.contract:118:5 · PriceTag · class:Price` in under a second.
- The dev loop live-reloads three framed builds ~0.7–0.9 s after a save.
- `contract build --json` and `contract symbols` both answer on a broken file,
  so a typo can be pinned to the screen whose route draws it.
- Running the dev loop and `web-build`/`agent web` captures side by side worked
  with no lock trouble.

## Needed
- an ancestor list for `frame-ancestors` (by hand: proxy)
- the file digest on a `selection`'s source (by hand)
- a source place on `agent check` findings (by hand, via symbols)
- outlines that stay without inspect mode on (missing: outlines draw only in
  inspect mode, so the canvas keeps inspect on while a selection is shown)

## Checkpoints
- edit reached three live frames (phone, tablet, desktop) in 0.66–0.91 s
- Alt-click: ShippingNote (own rows) and PriceTag (class:Price) named right
- typo → comment on the places screen; gone on the next save after the fix
