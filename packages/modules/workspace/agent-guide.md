## Workspace

Import and sync Google Docs, Sheets, and Slides onto the canvas as versioned
items stamped with `workspace.*` provenance.

- `isocan workspace import <url> [--title <t>] [--json]` — fetch a Google Doc,
  Sheet, or Slide and add it to the canvas.
- `isocan workspace sync <item> [--json]` — re-fetch `<item>`'s source and stack
  a fresh version via `item.addVersion`.
