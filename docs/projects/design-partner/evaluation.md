# Proving the design partnership

The debt is that correct tooling can still produce an undistinguished or
unusable design. This protocol separates engineering reliability, output
quality and the person's experience of collaborating. It operationalizes the
[research](../../research/2026-09-14-design-partner.md#how-to-know-whether-the-results-are-amazing)
and extends the existing [eval plan](../evals/plan.md).

These are proposed release criteria and a study plan. No generations,
participant sessions or preference measurements have been run for this project.
Phase 0 fixes the protocol and cost ceilings before paid comparisons; changes
after results are visible must be recorded as a new experiment.

## Three questions, three kinds of evidence

| Question | Evidence | What does not answer it |
| --- | --- | --- |
| Does the workflow preserve intent and state? | Deterministic protocol tests and actual CLI/browser journeys | A compelling model-generated screenshot |
| Are the delivered designs better for their brief? | Matched generation trials, task checks and blinded human design review | Lint counts, an agent grading itself, or style-name recognition |
| Does isocan feel like a useful design partner? | Real people answering, steering, choosing and continuing work | A simulated user with a scripted answer bank |

Design competition's distinctiveness experiment remains useful for that
project. Recognizing a persona is not this project's definition of success.

## The initial corpus

Use synthetic products, copy, images and repositories with known permissions.
Keep realistic content and edge states; do not copy names or data from live
canvases. Each fixture has a brief, fact/answer bank, references with availability
states, initial canvas/repository snapshot, expected primary task, intended
delivery type, target widths, and known forbidden regressions.

| Case | Decision or failure it exposes |
| --- | --- |
| Sparse inventory app | Useful discovery, operational hierarchy and a complete receiving task |
| Complex appointment workflow | Whether structural alternatives resolve sequencing before polish |
| Dense analytics dashboard | Density, comparison, useful data and interpretation |
| Constrained brand extension | Existing components/tokens preserved; a second screen remains coherent |
| Marketing page with supplied proof | Persuasive sequence and brand specificity without invented claims |
| Imagery-dependent page | Asset use and honest fallback when image tooling is absent |
| Reading surface | Typography, measure, long content and navigation |
| Mobile field task | Touch targets, narrow layout and a complete task on the actual renderer |
| Accessibility-heavy form | Labels, keyboard/focus, validation and recoverable errors |
| Small edit | Fast path; no unnecessary questions, variations or identity replacement |
| Misleading/inaccessible reference | Authority, provenance and distinction between supplied and inspected |
| Follow-up after a recorded preference | Continuity across sessions, scopes and entrances |

Run each from canvas chat and an external coding agent with equivalent context.
Hold the underlying model and harness capabilities equal where possible. Where
an environment differs, report a separate stratum; do not attribute a browser
capability advantage or a different model to the workflow itself.

## Conditions and cost

**A: current default.** Preserve its runnable procedure and source revision
before modifying it. Give it the same available facts, tools and resource
ceiling. Do not omit existing capabilities to weaken the baseline.

**B: adaptive isocan workflow.** The implementation from phases 1–5, including
the question budget, contextual defaults, purposeful exploration and review.

**C: B plus the supported pinned Impeccable adapter.** Optional and explicitly
separate. State whether native package execution or adapted guidance is being
tested; do not pool those into an undefined “with Impeccable” condition.

Use the same model/version, assets, task facts, tool access, token/time ceiling
and maximum repair rounds for matched conditions. Record actual spend even
when a ceiling is not reached. The answer bank supplies a fact when the agent
asks the corresponding question; it does not give B secret information. Keep
different question paths in the record. Score discovery burden separately.

Start with an **offline matrix validation**, then a **16-generation smoke
study**: four diverse cases × two entrances × A/B. Stop on broken routing,
lost context, unusable artifacts or unaffordable runs before buying the full
comparison. These are setup findings, not a quality conclusion.

The initial full comparison is **96 generations**: 12 briefs × two repeats ×
two entrances × A/B. A fully matched C condition adds 48, making 144. Reuse
the preserved A/B artifacts for C comparison if the protocol and capabilities
have not changed; otherwise rerun the changed cells and say why. Freeze
condition B while measuring C. Separate repeats expose variance but do not
turn 12 briefs into 48 independent product categories.

Budget the smoke study as additional work unless its unchanged cells are
explicitly reused: 112 generations for smoke plus A/B, or 160 including C.
Reviewer effort, browser work and any pilot reruns also belong in the estimate.

Before execution, estimate cost from the chosen model and pilot, name the
maximum total spend and per-run ceilings, and obtain any missing authorization.
Failed, timed-out and abandoned runs stay in the dataset and cost totals.
Stopping at a spend ceiling produces an incomplete result, not a passing study.
No automatic model upgrades, image spending or extra review agents.

## What gets recorded and judged

Each run records request and fixture IDs, entrance, condition, repetition,
source/prompt/model/package revisions, capability matrix, answer transcript,
artifact and context identities, start/end times, time to first useful visual,
tokens and tool costs, repair rounds, unresolved failures and check evidence.
Record repository build/runtime identity for connected apps.

Task assessment uses the fixture's primary task and actual runtime. Capture
failure states as well as happy paths. “Not ready” is honest behavior, but the
failed generation still counts when measuring task success.

Three independent human reviewers who did not produce the artifacts compare
matched outputs with the brief and the
same available task evidence, hiding condition, model and agent identity.
Randomize left/right order. Reviewers score hierarchy, typography, composition,
content, interaction/state design, responsiveness, product specificity and
brief adherence, then choose A, B, tie, or neither is usable, with a short reason.
Use a calibrated five-point rubric: 1 unusable, 2 substantial redesign needed,
3 adequate, 4 strong and specific with minor polish remaining, 5 excellent for
the intended task. Keep concrete examples for calibration. More decoration
does not automatically earn a higher score.

Report pair-level results and reviewer disagreement. Show wins, losses, ties,
both-unusable outcomes and task failures separately. Estimate uncertainty by
resampling briefs, keeping their repeats and entrances together; three votes
on one artifact are not three independent generations. Report both entrances
and task types, including failures that an aggregate average conceals.

## The partnership study

Recruit an initial six intended users with a mix of coding and non-coding
backgrounds appropriate to the product. This is a diagnostic pilot, not a
population estimate. Participants perform counterbalanced matched tasks using
the current and candidate flows; vary task/order to reduce learning effects.
Include a returning task through the other entrance where the participant
can realistically use it. Do not force a non-coder to operate a CLI to make
a balanced-looking table.

Observe comprehension of questions, avoidable repeated questions, usefulness
of alternatives, understanding of the recommendation, successful steering,
time/effort to an acceptable result, and whether the follow-up preserves intent.
Let people reject all alternatives. Ask why they chose or stopped, not only
whether they liked the assistant. Separate facilitator help from unaided success.

Use recordings or notes only with appropriate participant consent. Keep raw
personal observations out of committed synthetic fixtures; store the permitted
anonymized findings and traceable study method. Paid recruitment and participant
time are named at the provision step, not silently assumed available.

## Go/no-go before broad enablement

The following are the proposed thresholds to preregister in phase 0. If early
baseline calibration makes a threshold inappropriate, change it before the
comparison and record the reason. Never tune it to turn a known failure green.

1. **Reliability is a hard gate.** No lost reference bytes, cross-agent
   question dismissal, unauthorized answer, silent brand replacement, stale
   overwrite or claimed browser verification without evidence in the acceptance
   suite. All six core journey scenes pass from both entrances. Disabled
   orchestration preserves existing work.
2. **Usability is a hard gate.** Every candidate artifact labeled ready passes
   its declared primary task and has no known critical accessibility or
   interaction defect. Overall task-success rate includes drafts and failures
   and must not regress against A; every corpus case must have a successful
   candidate run on each entrance. Report uncertainty; a small observed tie
   does not prove population-level non-inferiority.
3. **Quality needs evidence of an advantage.** B wins more blind comparisons
   than it loses, with a brief-clustered uncertainty interval for the win-minus-
   loss advantage above zero for broad default enablement. Report ties and
   neither-usable results, and inspect every major task/entrance regression.
   If the 12-brief pilot is inconclusive, retain opt-in and gather a broader
   prespecified set rather than declaring a tiny lift.
   Relative improvement alone is insufficient: at least 80% of candidate
   outputs must earn a majority-reviewer overall craft rating of 4 or 5, and
   every task category must contain a strong candidate. Count failed outputs
   below that bar. This is the proposed absolute craft threshold; calibrate
   its examples before scoring rather than rewarding “better than a bad baseline.”
4. **The partnership must help.** At least five of the initial six participants
   can reach and knowingly choose/delegate a direction without facilitator
   rescue; the candidate has no observed repeated loss of settled context.
   Participant reasons must support the claimed usefulness of questions and
   choices. A recurring breakdown blocks broad rollout even if visual votes win.
5. **Cost must fit the default.** Initial proposed limits are no more than
   1.5× A's median time to an acceptable result and 2× its median model/tool
   spend, within the agreed absolute cap. Report tails and human attention too.
   If the quality gain costs more, keep the expensive behavior explicit and
   optional, or rerun a narrowed default. These ratios are product budgets,
   not measured facts or universal design rules.
6. **C earns its own inclusion.** It must improve on B under the same method
   without violating the usability, partnership or cost gates. Compatibility
   alone is insufficient; absent or negative evidence leaves B as the candidate.

When A seldom produces an acceptable result, accepted-only timing ratios can
be misleading or undefined. Show success-conditioned latency alongside capped
time-to-task-success for every attempted run; do not discard A's failures.
Use a preregistered absolute latency budget in that case, with the ratio marked
unavailable. Keep image-heavy and fast-edit workloads visible separately.

## Rollout and continued learning

Phase 7 first enables an opt-in cohort using one shared policy across entrances.
Record the dev and production build identifiers actually walked, including
supported hosted harnesses. Verify refresh/resume, capability failures, receipt
staleness and rollback. Broader enablement follows the recorded product decision
against these results; an inconclusive study stays opt-in.

Monitor permitted aggregate failure/repair signals, cost, abandonment and
sampled human reasons during rollout. An observed lost answer, stale overwrite
or false verification claim disables automatic enrollment until fixed. Increased
cost or repeated task/partnership failures pause expansion and add a corpus case.
Version adoption and undo are clues, not self-interpreting votes for good or bad
design. A successful rollout closes this project; new failure patterns feed the
existing eval/review process rather than an unbounded permanent phase.
