## Design

Generate design system sticker sheets, run fresh-context critiques, and create
direction mockups linked to a design system.

- `isocan design-system system <prompt> [--title <t>] [--json]` — generate a
  `DesignSystemSpec` sticker sheet and compiled `DESIGN.md`.
- `isocan design-system critique <item> [--system <id>] [--json]` — fresh-context
  design review landing as a derived Markdown item with `parent` provenance.
- `isocan design-system mockups <systemItem> [--count 2..4] [--prompt <p>] [--json]`
  — generate 2–4 HTML direction mockups linked to `<systemItem>`.
