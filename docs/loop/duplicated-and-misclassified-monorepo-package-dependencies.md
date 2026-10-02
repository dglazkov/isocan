---
title: "Duplicated and misclassified monorepo package dependencies"
loop: e7d98d1b-6c1f-430a-a3f9-7f695544b104
loop_rank: P2
loop_state: DISMISSED
loop_goal: "Dependencies healthy"
decision: declined
rank: never
project: auto-upgrade
since: 2026-09-29
note: "By design: root duplication lets a git install of the release branch resolve the CLI dependencies, which is the install story. The tsx and types misclassification is real and harmless. Reopen if the install story changes."
---

# Duplicated and misclassified monorepo package dependencies

> **Loop says** (P2): Root `package.json` duplicates 10 dependency declarations defined within subpackage manifests. Root `package.json` classifies TypeScript type definitions `@types/node` and `@types/css-tree` as runtime dependencies, while subpackages place type packages under `devDependencies. Also, root and two subpackages classify TypeScript execution tool `tsx` as a runtime dependency, while the server package declares `tsx` as a development dependency.

- `package.json#L48-L59`
- `packages/api/package.json#L30`
- `packages/server/package.json#L23`
- `packages/cli/package.json#L22`
- `packages/voice-agent/package.json#L29`

## Our read

Root package.json has a comment key explaining that runtime deps the CLI needs are declared at root as well as in packages/cli so github install resolves them, and that @types/node rides along because connect() names Buffer. So the duplication is by design. tsx is in dependencies in cli and voice-agent but devDependencies in server (packages/*/package.json:22-29), a genuine inconsistency. @types/css-tree is a devDependency in core, not a runtime one; the root does not list it in the lines I read.
