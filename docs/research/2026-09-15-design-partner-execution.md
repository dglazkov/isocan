---
status: built
since: 2026-09-15
note: Retrospective complete and conductor guidance updated; automated preflight and shared proof infrastructure remain recommendations. Design-quality evaluation remains open in the design-partner project.
---

# Design-partner execution retrospective

Measured 15 September 2026 from the original session event timestamps, phase commits and exact GitHub release run. This is elapsed session time, not billed compute or summed agent-hours. Analysis itself is excluded.

## Total

- Research: 15m29s.
- Execution planning: 18m28s.
- Implementation request to successful final release: 14h13m07s, from 14 September 18:21:15 to 15 September 08:34:22 America/Denver.
- Combined research, planning and execution windows: about 14h47m.
- First research request to successful release: 18h36m, including about 3h49m between user requests.
- Final implementation commit: `472524844927dfa34d9e351ab01d4a3016eb6bc6`, 08:24:52 MDT. Exact release CI completed successfully 9m30s later: https://github.com/dglazkov/isocan/actions/runs/34981470350.

Phases 0–6 are closed. Phase 7 preparation is implemented; actual model-generated quality comparisons, independent human ratings, participant sessions and authenticated hosted acceptance remain open. These times do not represent completion of that evidence or approval to enable the workflow broadly. The original implementation turn reached an account usage limit at 08:34:01 MDT, after the push and 21 seconds before final CI completed. The subsequent gap was not continued implementation work.

## Delivery windows

These are consecutive, non-overlapping windows ending at each phase's landing commit. They include implementation, independent proof, corrections, documentation and integration. They are not estimates of coding time alone. Agents sometimes worked concurrently, so these differ from individual builder durations recorded in commit prose.

| Window | Elapsed |
| --- | ---: |
| 0: baseline and contracts | 39m43s |
| 1: trustworthy questions and references, including phase 0 CI correction | 2h27m26s |
| 2: shared request and brief workflow | 1h41m35s |
| 3: defaults, systems and working references | 2h07m41s |
| 4: wireframes, alternatives and decisions | 1h28m54s |
| 5: review and bounded repair | 1h43m57s |
| 6: optional adapted Impeccable guidance | 1h13m19s |
| 7: evaluation and study preparation | 2h06m12s |
| Landing: reproduce and fix identity persistence race | 34m50s |
| Final release CI | 9m30s |

## Measured overhead and limits

The primary conductor recorded 2,195 completed shell-command items, 321 progress messages, 88 image inspections and 24 context compactions during implementation. Command counts describe orchestration volume, not independent defects or useful deliverables.

The 24 context compactions span 89m14s. They could overlap ongoing tools or builder work; this is not 89 minutes of guaranteed removable critical-path delay. The long session repeatedly carried historical evidence and state into subsequent phases.

38 long broad-verification command groups consumed 186m33s of cumulative subprocess time, covering 175m26s of elapsed time after overlapping intervals are merged. Fifteen returned nonzero. These are actual conductor commands lasting over 60 seconds that launched the full fast suite and/or strict wrapper; a command can include typecheck and more than one suite. This excludes builder tests, most focused proofs and GitHub execution. It must not be added to compaction time as if the categories were disjoint. Failure does not imply wasted checking: several runs exposed real correctness defects.

The final fast suite alone took 164.63 seconds; strict Firestore/deep/bundle testing took 448.83 seconds. One successful pair is therefore about ten minutes before typecheck, documentation or CI. Eight such phase gates represent roughly 80 minutes of expected local work at final-suite speed; excess runs included necessary fixes, upstream integration and avoidable late guard discovery. This comparison is a planning baseline, not an exact savings calculation.

Notable causes documented in the phase records:

- Phase 0 ran git-index-based guards before staging new sources; CI discovered exports that the local guard did not see.
- Phase 1 and 2 exceeded bundle/package/export boundaries, requiring lazy loading and consumer/packaging corrections.
- Phase 2 browser-cleanup instrumentation itself needed correction; its first regression depended on real process scheduling under load.
- Phase 3 encountered an unrelated incoming export issue and a brittle refusal-text assertion.
- Phase 5's initial fast and strict suites failed the same two checks: a downstream evaluation consumer omitted required evidence, and a browser fault helper duplicated an operation route.
- Phase 6 ran the fast suite, strict suite and browsers concurrently. An unchanged grid test timed out; the serialized rerun passed without raising its timeout.
- Phase 7's study tooling initially had actual native input/key and concurrent file-capture defects. Independent proofs caught them. Its last 35 minutes fixed an existing cross-process identity lost-update race encountered while integrating main.

The strongest inefficiency was feedback arriving late, combined with an increasingly large conductor context. Broad validation was useful; expensive runs should not have been the first place cheap structural failures were discovered.

## Lessons applied and work still proposed

The conductor now calls for early structural checks, one heavy local verification at a time, compact handoffs and integration before the final source freeze. These are workflow instructions, not a new automated scheduler or preflight command. The remaining automation and reusable harness work below is proposed, not shipped. Existing full-suite, typecheck and independent journey requirements remain in force.

1. **Automate a staged-tree preflight.** Before a broad gate, stage only intended files and run export/operation/surface/documentation/dependency/deep-list guards, affected typechecks and bundle checks. Run affected downstream consumer tests when shared contracts change. Emit one concise failure summary. Do not weaken guard ceilings.
2. **Give heavy validation one local execution slot.** Serialize full fast, strict emulator and heavy browser runs. Keep builders and lightweight reads parallel when they do not alter the frozen tree. Fix known fast failures before starting strict. Preserve the required complete suite, typecheck and named browser/CLI proof for each phase; rerun broader gates when source or integration changes justify it.
3. **Bound the conductor context by phase.** Persist current commit, frozen-source identity, contract decisions, outstanding defects and exact evidence paths in a compact handoff. Load historical reports on demand. Return summaries and log paths from tools rather than whole logs; batch independent reads. Retain independent conductor verification without reconstructing the same harness in each phase.
4. **Reuse browser and release-proof infrastructure.** Standardize owned runtime creation, input/keyboard helpers, teardown, source manifests, screenshot capture and machine-readable exit results. The study and product both paid for infrastructure edge cases that deserve shared reusable controls.
5. **Integrate main before the final freeze.** Inspect incoming changes and CI once at the phase boundary, integrate, then run affected checks and the full gate on that exact tree. Run required CI asynchronously while useful preparation proceeds. Still reverify when main changes; do not conceal unrelated failures.
6. **Obtain outcome evidence earlier.** Put a small representative design comparison after the first end-to-end slice, then use its results to guide defaults and craft integration. Prepare the concrete paid/auth/reviewer requirements early enough for the user to decide while engineering proceeds; never assume approval. Expand the evaluation runner when the pilot demonstrates which additional capabilities are needed.
7. **Instrument the next run.** Record build-ready, first proof, first gate, retry cause, commit and CI completion for each phase. Track first-pass gate rate, heavy-job contention, context-maintenance time and time to the first independently rated design. Optimize those rather than raw command count.

A reasonable experiment is to target 25–35% less elapsed time for a comparable project (roughly 9–11 hours versus 14h13m). This is a hypothesis, not a measured speedup or promise. Preserve the real browser/CLI journeys and independent checks: they caught consequential defects. The larger product improvement is reaching trustworthy design-quality feedback earlier, rather than finishing a long infrastructure run with quality still unmeasured.

## Evidence and method

The [timing summary](design-partner/execution-timing-2026-09-15.json) preserves the session boundaries, phase commit identities, aggregate counts and final CI timestamps. Raw local conversation logs and scratch command output are not checked in. The summary is an aggregate of those logs, not a replacement from which every tool interval can be recomputed.

Phase windows use the request start and successive landing commit author timestamps; rebase timestamps would distort them. The final endpoint is the exact release job's completion. Verification groups are unique completed conductor command items lasting over sixty seconds and launching the full fast suite or strict wrapper. Durations include other commands bundled into the same invocation. Overlapping intervals are merged only for the elapsed-coverage figure. Context compaction is measured from its start/end events; neither category estimates billed usage or sums parallel agent effort.

- [Project phases](../projects/design-partner/phases.md), with links to each independent proof record.
- [Phase 0's staging gap](../projects/design-partner/verification/phase-0.md), [phase 2's packaging and cleanup corrections](../projects/design-partner/verification/phase-2.md), [phase 5's consumer failures](../projects/design-partner/verification/phase-5.md), [phase 6's resource contention](../projects/design-partner/verification/phase-6.md), and [phase 7's evaluation and identity correction](../projects/design-partner/verification/phase-7.md).
- [Final release CI](https://github.com/dglazkov/isocan/actions/runs/34981470350): all four strict shards, checks and publication passed for `472524844927dfa34d9e351ab01d4a3016eb6bc6`.
- [Conductor workflow](../../.claude/skills/conduct/SKILL.md) and [lessons 87–88](../reviews/lessons.md) carry the reusable guidance.
