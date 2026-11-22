## Memory

Project reflections, private personal observations ("About you"), pointer items
(`kind: pointer`), and cross-canvas search within strict context budgets.

- `isocan memory reflect [--focus <text>] [--json]` — create or update the
  canvas's `role: reflection` document item citing `#item` and `comment:`
  threads, preserving `"Your project guidance"` and stamping `_Updated: <ISO>_`.
- `isocan memory learn "<text>" [--personal] [--facet <facet>] [--personal-canvas <id>] [--json]` —
  append explicit guidance to the project reflection or record a faceted
  observation on your private `"About you"` canvas.
- `isocan memory search "<query>" [--limit <n>] [--json]` — 3-way RRF (`k=60`)
  search across admitted canvases, packed within `CONTEXT_BUDGETS.history`.
- `isocan memory place <ref> [--label <text>] [--facet <facet>] [--json]` —
  place a `pointer` item on the canvas containing only `{ ref, ownerId, facet?, label? }`
  with zero private observation text.
- `isocan memory forget <itemId> [--reason <text>] [--json]` — delete an
  observation or memory item and record a durable exclusion tombstone so
  reflection, search, and pointer hydration permanently exclude it (`410 Gone`).
- `isocan memory graph [--json]` — print Tier-0/Tier-1 memory context for this
  canvas packed within `CONTEXT_BUDGETS`.

MCP agents receive `memory_reflect`, `memory_learn`, `memory_search`,
`memory_place`, and `memory_forget`.
