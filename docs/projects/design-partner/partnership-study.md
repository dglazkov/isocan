# Observing whether the partnership helps

The debt is that a successful generated artifact does not show whether a person
understood the questions, could steer the work or knowingly chose a direction.
This protocol implements [evaluation.md](evaluation.md)'s six-person diagnostic
pilot. It creates no participants or ratings. Recruitment, model usage and any
participant payment require the separate provision decision.

## People, tasks and time

Recruit six intended users spanning the coding experience of the intended product.
Use study IDs P01–P06. Record relevant experience and realistic entrance access;
keep contact details and raw recordings outside this repository. A participant
who would not use a coding agent uses canvas chat. Coding participants can return
through the other entrance; that return is optional and reported separately.

Allow 60–75 minutes per participant, including orientation and debrief: 6–7.5
participant-hours and the same facilitator time, plus preparation and synthesis.
Each person does two matched tasks, one per condition. Use three synthetic task
pairs, balancing condition order within each pair. The pair must exercise the
same complexity and primary action with different content, so the second task
is not simply repeating remembered answers. Pilot task-equivalence before the
first scored session; freeze both prompts and reference hashes with the roster.
Do not secretly adjust a prompt after seeing a condition fail.
[study-tasks.json](study-tasks.json) freezes the six task cards, source hashes and
assignment order. They use different existing data from fresh copies of three
frozen fixtures, without changing the fixture corpus. Participants receive the
role context; the agent initially receives only the stated initial request.
Content variant 1 always comes first, so residual content/order effects remain
visible in this small diagnostic study.

| Assignment | First task | Second task | Purpose |
| --- | --- | --- | --- |
| P01 / P02 | Pair 1, A / B respectively | Pair 1 counterpart, B / A | Sparse operational work: receiving and correcting an entry |
| P03 / P04 | Pair 2, B / A respectively | Pair 2 counterpart, A / B | A workflow with a meaningful sequencing choice |
| P05 / P06 | Pair 3, A / B respectively | Pair 3 counterpart, B / A | A constrained second screen that must preserve a system |

Assign participants to this order before their outputs exist; do not place a
particularly experienced participant in a condition to improve its result.
Keep model, allowed tools, reference availability and time/cost allowances equal.
Use the actual baseline and candidate runtimes in the execution manifest. The
participant task prompt contains their purpose and available product facts,
without mentioning a preferred interface structure or expected assistant behavior.

## Session script

1. **Orient, 5–10 minutes.** Explain that the interface is being evaluated, not
   the participant. Show basic canvas navigation or the coding-agent entry they
   normally use. Use an unrelated synthetic practice task. Obtain permission
   for the particular notes/recording being collected; recording is optional.
2. **Task one, up to 15 minutes.** Read the frozen task goal. Ask the person to
   work as they normally would and explain decisions when comfortable. Let them
   answer, skip, delegate, reject every option or stop. Do not hint that the
   assistant should ask questions or offer variations.
3. **Task debrief, 5 minutes.** Ask what they were trying to accomplish, what
   they understood the recommendation to mean, why they chose or stopped, and
   which interaction changed the result. Ask what they would do next.
4. **Task two and debrief, same allowances.** Reset to its own matched initial
   state. Retain order and learning effects in the observations.
5. **Return, up to 10 minutes where realistic.** Ask for a frozen follow-up that
   depends on the earlier accepted choice or constraint. Let the person use the
   other entrance only if it is a plausible part of their work. Record whether
   they find and preserve the intent without being told where it was stored.
6. **Comparison, 5–10 minutes.** Ask which experience they would choose for a
   similar task, why, and what they would want the partner to do differently.
   Preference is distinct from success, output quality and facilitator help.

A facilitator answers questions about the study and helps with access failures.
They do not supply design decisions or coach the participant through the intended
workflow. If help is required, give it so the session remains useful, but record
the exact intervention and classify that portion as assisted. A rescued result
cannot become an unaided success by omitting the intervention from the report.

## Record events before interpreting them

Use one append-only event record per session with elapsed time, condition, task,
entrance, artifact/request identity and a neutral description. At minimum capture:

- Initial prompt; first useful visual; each question and the participant's answer,
  skip or delegation; repeated requests for already supplied information.
- Alternatives actually offered; what the participant tried; their understanding
  of the recommendation; selection, rejection and supplied reason.
- Corrections and steering, whether those changes appear in the next output, and
  any lost reference, constraint or preference during return or refresh.
- Attempts at the primary task, actual result at the final artifact version,
  error recovery, known unfinished work and time to an acceptable result.
- Assistance, interruption, stopping and abandonment, with reasons. Model waiting
  time, participant attention and facilitator time remain separate measurements.

Retain participant words as attributed observations, not rewritten endorsements.
Record unavailable observations as unavailable. Notes such as “looked confused”
are observer interpretation; prefer the action and the participant's explanation.
Any raw personal material stays in the consented study store. Commit only allowed
anonymized findings and source references sufficient to audit the method.

## Analysis and decision

Report all six assigned participants, including withdrawals, unfinished sessions
and inaccessible entrances. The primary partnership gate is that at least five
can reach and knowingly choose or delegate a direction without facilitator rescue,
with no repeated loss of settled context in the candidate. Show task completion,
direction understanding and delegation separately so a lucky click cannot stand
in for comprehension. Include contrary reasons and recurring failure patterns.

The six-person result is diagnostic, not a population preference percentage.
Counterbalancing reduces order bias; it does not remove it. Separate canvas chat,
external-agent and realistic return observations. A participant without a realistic
external entrance is not a failed CLI participant or evidence that the CLI passed.

A recurring steering, context or recommendation breakdown blocks broad rollout
and sends a concrete issue to the responsible phase. An incomplete pilot remains
incomplete. The artifact reviewers' blinded scores and this participant study
answer different questions; neither substitutes for the other.

## Reviewable provision

The initial request will separately name:

- Six participant sessions, the above effort, access needs and any compensation.
- Three independent artifact reviewers who did not produce the designs. Smoke
  calibration/review is about 60–90 minutes each; the full 48-pair A/B review is
  roughly 4–7 hours each, based on 5–8 minutes per pair plus calibration. Optional
  C adds a separately budgeted matched review. These are planning estimates.
- Up to 12 primary interactive task runs plus six optional returns, under their
  own frozen model/time/cost manifest. These are additional to the 16 smoke and
  96 full A/B generations; the controlled-generation grant does not cover them.
- The facilitator, approved observation store, permitted recording, and who will
  make the product rollout decision. No participant contact is sent by this doc.
