---
status: designed
since: 2026-10-23
note: "Plates phase 113: bounded install diagnostics and exact-input retry planning; implementation and verification pending."
---

# Validation efficiency

**Where we are: validation-efficiency phase 113 is next.** This project is the
isocan slice of Plates's 22 October validation-efficiency spec. It does not
reorder the unrelated practice project's work. Delivery is an isolated draft
PR; no merge, deployment, schedule or validation-policy change is authorized.

## Phase 113 — A stalled install leaves bounded evidence

**Status: NOT STARTED, 23 October 2026.** Contract and dependency inventory established.

**Done when:** A stalled shared suite installation fails within its configured
bound, leaves redacted lifecycle evidence, and any proposed targeted retry
requires matching immutable inputs and preserves attempt history.

**Scope:** Wrap the existing shared PR/release suite-setup install, preserving
`npm ci` and its lifecycle scripts. Use a provisional generous five-minute
deadline, heartbeat, pre-TERM diagnostics, TERM grace and process-group KILL.
The audit observed successful installs of 46–67 seconds and one 1,203-second
stall, not a cold/warm p95 or p99. Retain installer exit/signal and distinguish
watchdog timeout. Do not print environment values or arbitrary process arguments.
No added shards, changed cache policy, worker limits or removed tests.

**Retry strategy:** Explicit operator decision, never an automatic loop. A
read-only planner may propose at most one retry of a proven setup-only failure
when head, lock, actual runtime, setup flags and workflow/stage manifest match.
Missing evidence, product/harness failure, a changed setup, or a second retry
must refuse. Keep original successful sibling identities/timestamps and retry
parentage; this is not a complete-gate attestation or permission to reuse local
tests. The operator must retain the plan and original receipts with the run.

**Proof:** First `node --test scripts/install-watchdog.test.mjs`, with real
non-exiting children, TERM-resistant descendants, exit-status and redaction
controls, then focused workflow/convention tests. The conductor independently
runs `npm run test:deep`, `npm run typecheck`, and `node --test tests/loop.test.mjs`
on the integrated candidate; PR CI preserves the complete four-shard `test:ci`
union and checks. Run roadmap and lint, plus release graders/metrics as applicable.
The upstream phase's `npm run check` is a Plates source command, not an isocan
script; it cannot substitute for isocan's configured gate or its pre-push deep lane.
No heavy gate starts before coordination with the parent on this shared Mac.

**Trajectory:**

- **2026-10-23** — The canonical checkout contains unrelated motion work. This
  PR starts from fetched `origin/main` e59d061a02ae44bf02a45a02a3e47095ab2688f7
  in a separate worktree. The setup action is shared by both workflows; its
  unchanged lifecycle includes the web build.

**Deliberately open:** Cold/warm p95/p99 and comparable hosted speed savings
remain unknown. Complete gate evidence/reuse belongs to Plates phase 114.
Broader adoption waits on parent review of the exact-head evidence.
