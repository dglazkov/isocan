---
title: "Heavy parser dependencies bloat web entry chunk"
loop: 3ae25c04-e537-43f4-b3e4-b1672de10d50
loop_rank: P2
loop_state: DISMISSED
loop_goal: "Dependencies healthy"
decision: stale
rank: never
project: design-lint
since: 2026-09-29
note: "Stale: the markdown parser is lazy (App.tsx preloadMarkdown) and the design-audit analyzer moved to a lazy core subpath on 14 Sep. The entry budget has its own ceiling test. Reopen if a parser lands in the entry chunk."
---

# Heavy parser dependencies bloat web entry chunk

> **Loop says** (P2): Package manifests in core declare heavy parser packages as direct runtime dependencies. Web client builds generate minified entry chunks exceeding 700 kB because web components load heavy parser dependencies synchronously. Circular module imports between core design modules create Rollup chunking warnings and potential execution ordering risks during client bundling.

- `packages/core/package.json`
- `packages/web/vite.config.ts`
- `packages/core/src/design-partner.ts`

## Our read

core/package.json lists remark, css-tree and parse5 as runtime dependencies, which is correct since core code uses them. design-lint/phases.md line 40 records moving the analyzer into a lazy @isocan/core/design-audit entry, cutting 72 KB gzip from the initial chunk; App.tsx line 91 notes Markdown is lazy to avoid a 175 KB parser. Bundle-ceiling.mjs records dropping a namespace import that pinned core. I did not find or test the circular-import warning at design-partner.ts.
