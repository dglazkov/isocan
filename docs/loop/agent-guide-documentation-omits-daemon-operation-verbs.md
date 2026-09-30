---
title: "Agent guide documentation omits daemon operation verbs"
loop: 90a12963-968d-4549-9518-7021f57836f5
loop_rank: P1
loop_state: DISMISSED
loop_goal: "Always isomorphic"
decision: stale
rank: never
project: iso-api
since: 2026-09-30
note: "Stale: operations in ops.ts are internal reducer mutations, not CLI verbs; surface.test.ts verifies 100% of non-plumbing CLI commands across main.ts and all modules are documented in agent-guide.md."
---

# Agent guide documentation omits daemon operation verbs

> **Loop says** (P1): The primary agent documentation files fail to document 40 out of 46 daemon Operation verbs defined in core. Omitting verbs from agent documentation renders core daemon capabilities inaccessible to autonomous agents.

- `packages/core/src/ops.ts`
- `packages/cli/src/agent-guide.md`

## Our read

**Verified against the code (2026-09-29):**

- `packages/core/src/ops.ts` defines the 46 reducer `Operation` types (`item.move`, `design.*`, `thread.*`, `group.change`, etc.); agents invoke CLI commands, not raw reducer operation names.
- `packages/cli/test/surface.test.ts` (`registeredCommands()`, lines 108–173) extracts every `.command("<name>")` across `main.ts`, `canvas-groups.ts`, `context-reads.ts`, `questionnaire.ts`, `design-request.ts`, `design-system.ts`, `personal-context.ts`, `bench.ts`, `operator.ts`, and every module's `src/cli.ts`, and asserts that 100% of non-plumbing verbs appear in inline code spans in `packages/cli/src/agent-guide.md` (or module `agent-guide.md` files).
