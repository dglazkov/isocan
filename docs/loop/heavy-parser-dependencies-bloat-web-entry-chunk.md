---
title: Heavy parser dependencies bloat web entry chunk
loop:
  - 3ae25c04-e537-43f4-b3e4-b1672de10d50
loop_rank: P2
loop_state: DISMISSED
loop_goal: Dependencies healthy
decision: done
rank: next
project: design-partner
since: 2026-09-30
note: "done 2026-09-29: leaf design-partner validators extracted to design-partner-values.ts, eliminating all 3 Rollup circular-chunk warnings in @isocan/web build"
---

# Heavy parser dependencies bloat web entry chunk

> **Loop says** (P2): Package manifests in core declare heavy parser packages as direct runtime dependencies. Web client builds generate minified entry chunks exceeding 700 kB because web components load heavy parser dependencies synchronously. Circular module imports between core design modules create Rollup chunking warnings and potential execution ordering risks during client bundling.

- `packages/core/package.json`
- `packages/web/vite.config.ts`
- `packages/core/src/design-partner.ts`

## Our read

**Verified and fixed against the code (2026-09-29):**

- `parse5`, `@codemirror/*`, and `react-markdown` were already behind dynamic `import()` / `React.lazy` boundaries (`packages/web/test/bundle.test.ts`).
- Extracted the shared leaf types and validators (`DesignArtifactRef`, `DesignReference`, `parseDesignArtifactRef`, `parseDesignReference`, `parseDesignEntranceSource`, `parseDesignQuestionSource`, `parseDesignAcceptedResponses`, `parseDesignContinuation`, `parseDesignDiscovery`, `parseDesignGoverning`) into `packages/core/src/design-partner-values.ts` so `design-brief.ts`, `design-request-parse.ts`, and `design-partner.ts` form a clean DAG. `npm run build -w @isocan/web` now emits zero circular-chunk warnings.
