---
title: "Agent guide documentation omits daemon operation verbs"
loop: 90a12963-968d-4549-9518-7021f57836f5
loop_rank: P1
loop_state: DISMISSED
loop_goal: "Always isomorphic"
decision: stale
rank: never
project: iso-api
since: 2026-09-29
note: "Stale: operations are not CLI verbs, and the enforced rule is that every registered CLI command appears in the guide, which surface.test.ts checks. Reopen if a CLI verb is found missing."
---

# Agent guide documentation omits daemon operation verbs

> **Loop says** (P1): The primary agent documentation files fail to document 40 out of 46 daemon Operation verbs defined in core. Omitting verbs from agent documentation renders core daemon capabilities inaccessible to autonomous agents.

- `packages/core/src/ops.ts`
- `packages/cli/src/agent-guide.md`

## Our read

ops.ts lists Operation types (item.move, design.*, thread.*); AGENTS.md says the CLI verb is the agent surface, and packages/cli/test/surface.test.ts reads the registered commands and fails when one is missing from the agent-guide quick reference, with PLUMBING exemptions justified in comments. Many ops (design.receipt, group.change, item.setCurrentVersion) are reached through verbs with different names, so a 40 of 46 count compares the wrong sets. Not verified verb by verb.
