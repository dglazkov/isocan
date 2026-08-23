# Two days on the canvas: 19–20 August

**21 August 2026** · [full write-up](https://claude.ai/code/artifact/f39676eb-ffa2-429d-8df2-b80bff5aaa6d)

A record of what shipped on 19 and 20 August, written to be shared with the
team. 22 changes, 86 files, +6,667 lines. Kept here because the *reasoning* is
the part worth finding again.

## Wednesday — agents get hands

- **Everything shipped web-only got a CLI verb.** `set --title` renames the file
  too — that was an isomorphism *bug*, not a missing feature: renaming in the web
  app moved the filename and the CLI did not. Also `align`, `distribute`,
  `mv --by`, `add --drawing`, `ls --kind/--filter`. Align geometry and item-kind
  detection moved into core so the surfaces cannot disagree.
- **A house rule with teeth.** AGENTS.md gained "Done means done on both
  surfaces"; `packages/cli/test/surface.test.ts` reads the commands the CLI
  registers and fails the build when one is missing from the guide agents read.
  It found two undocumented commands on its first run.
- **`isocan wait` learned filters** (`--item`, `--op`) so a watcher can sleep
  through everything except the change it waits for. A summons always gets
  through any filter; your own ops never wake you.
- **Working notes** — `comment.update`, so an agent can say "on it" and keep that
  one message current. Comments carry `editedAt`, so the canvas renders
  "edited · 4m" from *its* clock, not an agent's estimate.
- **Chrome that behaves** — item chrome holds its size at any zoom and yields the
  top-right corner to a comment pin; one home for the version badge; edge
  beacons finally appear off the top and left walls (they were under the
  toolbar); fan-out moved off a key that had stopped existing.

## Thursday — pointing at things

- **Annotation: ink that is about something.** Scribble an X over a screen and it
  is *about* that screen — paints above it, travels with it in the web app's drag
  and in `isocan mv`. The region is stored as *fractions of the target*, so an
  agent can act on "the right-hand block of the upper half" without parsing
  strokes, and it survives a resize. Clearing is asymmetric on purpose: ink about
  an item asked for something; ink on bare canvas is not the agent's to tidy.
- **The selection comes with the message** — chips over the composer, ids on the
  comment. The chips *are* the selection: removing one deselects it.
- **Favourites** — a star as a property on the item, not a note in one browser,
  so agents can read which screens are in play (`ls --starred`).
- **⌘⏎ sends**; plain Enter still completes an @-mention because Enter with a
  modifier is never "pick this name".
- **Previews instead of initials** — thumbnails render the item's own content
  everywhere a peek happens.
- **Renaming finally looks like renaming** — the field measures itself from its
  own text; the stubborn white box was the input painting its native field
  behind our transparent background.

## The through-line

All of it went in inside the existing op vocabulary — properties and
`item.update` — so undo, versions, GC and older clients keep working without
knowing any of the new words. Only `comment.update` was a new op.
