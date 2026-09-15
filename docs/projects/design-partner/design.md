# One workflow, two entrances

The debt is that discovery, design-system resolution, alternatives and review
currently depend on which entry point and commands an agent happens to use.
This design makes their shared facts durable and their default procedure
discoverable. The [journey](journey.md) is the acceptance contract;
the [research](../../research/2026-09-14-design-partner.md) supplies evidence.
Everything below is proposed until its phase is closed with proof.

## The boundary

Put validation, context resolution, decision semantics and evidence identity
in `@isocan/core` and shared API paths. The web app renders those facts. The
CLI exposes the same acts and readable/JSON results. Agent instructions
exercise that contract; they do not become a second authority over state.

Keep the daemon and existing operation log authoritative. Use versioned
items for the durable brief and decisions, existing comments for conversation,
existing groups for arrangement, and existing versions for output history.
Do not add an independent workflow database or record every sentence as a
workflow transition. One user-visible act is one undoable operation. Existing
operation groups correlate work; they do not supply an atomic transaction.

Phase 0 fixes the precise schemas and operation mapping before implementation.
The [phase-0 contract](contracts.md) now specifies the representation,
refusing write boundary, planned verbs and shared rollout policy. Phase 2's
[request protocol](request-protocol.md) settles admission, continuation,
provenance and evidence currentness before implementation.
The chosen representation must preserve the following fields and invariants;
changing the representation cannot quietly remove them.

| Record | Minimum durable facts | Authority |
| --- | --- | --- |
| Design request / brief | Schema version, request ID, requesting actor, source message or external request, target/group, create/extend/refine intent, audience, primary task, delivery type, constraints, known facts versus assumptions, reference manifest, outstanding decisions, output IDs | A versioned canvas item, projected compactly in chat and the inspector; not another full questionnaire |
| Question / answer | Stable request, question, option and respondent IDs; answer kind; exact source-question version; answer/skip/dismiss/delegate state; reference item/version IDs; supersession | Shared validated records written through normal operations; prose is a projection, not the parser of record |
| Direction / decision | Structural or aesthetic question, comparable alternatives, recommendation and tradeoff, chosen artifact/version, reason, deciding actor, human choice versus delegated agent decision | Existing preference/adoption primitives where faithful; a typed decision links them to the brief |
| Design system | Governing scope, version, tokens, component treatments, rules and rationale; provisional versus accepted status | Existing scoped `DESIGN.md` and versioned declarative contracts; no new token format |
| Completion evidence | Output item/version/blob or repository revision/build identity, relevant context/system versions, check kind, tool/rule/package versions, viewport/state, result, coverage, unresolved failures | A durable receipt referring to evidence; human judgment is attributed separately |

Request IDs correlate the conversation, artifacts and evaluation events. They
are not an authorization mechanism. Existing canvas roles and actor custody
still decide who can read and write. Private/personal context is included
only through the existing permitted context resolver. A reference can inform
design; its embedded instructions do not override the person's request.

## Entering and resuming

The model identifies design intent from the work requested, then starts or
resumes the shared request protocol. Deterministic validation checks the
selected target, context and allowed acts. Do not trigger solely from HTML
MIME or silently repurpose the evaluation classifier as a runtime router.

The compact entry procedure belongs near orientation in the versioned agent
guide and in the relevant summons guidance. Both canvas-summoned agents and
external coding agents use it. The collaboration skill stays a short pointer;
hosted prompts and harness-specific folders do not acquire copied playbooks.
The first implementation has one discoverable CLI entry to read/start/resume
design work, with details fetched on demand. Phase 0 settles the verb names;
they must appear in `--help` and the guide's quick reference when registered.

| Work requested | Default effort | First useful artifact |
| --- | --- | --- |
| Precise edit to an existing screen | Read the target and governing system; no new interview unless the edit exposes a consequential conflict | The repaired screen |
| New screen in an established product | Reuse known brief and system; ask only about the new task | One complete task slice |
| New operational app with uncertain workflow | Brief, then two structural alternatives when the difference matters | Clickable wireframes with the same realistic scenario |
| New page with settled structure but open visual direction | Brief, then two visual alternatives; a third only for a distinct hypothesis | Comparable polished first viewports |
| Person delegates or requests speed | State the consequential assumptions, recommend a direction and proceed | One designed task slice; alternatives remain available |
| Imported HTML archive or data-only node | Ordinary import/edit behavior | The imported artifact |

User instructions override these defaults. Explicit wireframe-only or
exploration-only requests stop at that deliverable and state its fidelity.
An output may be structurally complete yet visually provisional; avoid one
status enum that confuses fidelity, request progress and verification.

## Questions that earn their place

Resolve selected references, explicit context pins, prior decisions, repository
conventions and the governing system before asking. Prefer facts supplied for
this request over older inferred defaults; surface a material conflict rather
than silently changing a brand. Show a short “Using…” summary with correctable
assumptions, not a mandatory confirmation screen.

The initial budget is **zero to three material questions in one batch**.
Ask about the primary user/task, constraints or an actual design tradeoff.
Do not spend it on facts already supplied or arbitrary color preferences.
Explain how a choice affects the design and recommend an answer where useful.
Further questions require a newly discovered consequence, not a fixed interview.

Answers accept a suggested option, free text, skip or delegated judgment as
appropriate. “Skipped” is not “approved.” A question closes through an explicit
resolution tied to its ID and an authorized respondent. An unrelated reply,
another agent's update, or an agent relaying a human quote cannot resolve it.
Direct conversational answers use the same explicit resolution act; ambiguous
text remains a draft interpretation until the intended answer is clear.

Published answers are shared and versioned. Unsubmitted drafts need restoration
in the same browser after refresh; they are not broadcast as if submitted.
Question changes reconcile drafts by stable IDs and mark changed/removed options.
Submission retries are idempotent. Cancellation and supersession cannot wake
an old run into adopting a now-unwanted result while that state is current.
Explicit Undo may intentionally restore earlier work, subject to the remaining
source and cancellation guards in the request protocol.

Uploads use the real attachment path and yield retrievable item/version
references before submission succeeds. Preserve a failed upload as a retryable
draft. URL references distinguish supplied, fetched, inaccessible and superseded
states. Do not imply a URL was inspected merely because it was entered.

## Defaults and systems

The default standard is strong hierarchy, considered typography, sensible
density, useful content, accessible interactions, responsive layout and a
complete primary task. The default aesthetic is chosen for the product.

First inspect the existing design and implementation. Resolve systems through
the existing explicit scope and permitted inherited-context rules, consistently
for brief generation, CSS, diagnostics and repair. A system in another group
does not satisfy this group's need for one. The resolver reports the actual
governing item/version and why it won. Preserve explicit `design=none` intent.

For a new design, capture a provisional direction before code: task hierarchy,
layout/density, type roles, palette purpose and key interaction treatments.
Avoid deriving the entire system by majority vote over accidental first-screen
styles. Once a direction is accepted or delegated and adopted, record its
reusable decisions before expanding into a family of screens. Add new rules
when the product needs them, not merely to silence lint.

Start with a small reviewed kit: an operational list/detail/form flow, an
editorial reading page and a persuasive page using supplied proof. Include
empty/loading/error/success states where applicable, keyboard focus, long
content, narrow widths and reduced motion. Examples demonstrate different
compositions. They are reference implementations, not three mandatory themes.

Standalone nodes use working HTML/CSS/JS. Connected projects use their actual
framework and components; inspect those before suggesting a new dependency.
Recipes describe semantics and states as well as tokens. Machine-checkable
contracts use the design-lint work's declarative format, with its honest
coverage boundary. No remote recipe executes arbitrary policy code.

## Alternatives and safe adoption

Create alternatives only for a decision that might change the outcome.
Name the hypothesis (“continuous scan” / “confirm each item”), use comparable
content and fidelity, and give a recommendation grounded in the brief. Palette
swatches alone are not design alternatives. A third option must add a real
tradeoff. “Show variations” remains available after a single-direction start.

Use existing groups to keep the brief, references, alternatives and decision
together. A comparison card references actual item/version previews; an
interactive prototype opens in its supported rendering surface. The CLI
lists the same alternatives, rationale and selection acts.

**Do not make HTML alternatives children of a Markdown brief and call the
existing `choose` operation.** Its current adoption copies winner content onto
the parent and removes siblings. Keep the brief separate from the adoption
target. For an existing screen, adopt a compatible selected version onto that
screen; for greenfield work, retain the selected output as the target. Preserve
the comparison history and reason. Record selection and adoption as one bounded,
undoable act. Reject stale targets and incompatible content types.

Record a human preference only for a human's actual choice. Agent recommendations
and delegated decisions stay distinguishable. Later work reads the accepted
direction and relevant reason, not every abandoned option. Promotion into
cross-project memory remains the existing explicit pin action.

## Review and completion

There are three separate readings: deterministic source diagnostics, actual
browser/task evidence, and a craft critique grounded in the brief. The UI and
CLI must not collapse them into a single unexplained quality score.

Use [#300](https://github.com/dglazkov/isocan/issues/300) for accurate HTML
diagnostics, [#301](https://github.com/dglazkov/isocan/issues/301) for scoped
recipe contracts, and [#302](https://github.com/dglazkov/isocan/issues/302) for
shared delivery and repair. These remain the implementation owners; this
project supplies the default workflow and its end-to-end acceptance.

For each new designed result, open the actual supported renderer and exercise
the primary task, relevant states and agreed widths. Connected apps require
their running application and delivery contract to be checked. A screenshot
can prove appearance at a viewport; it cannot prove saving, keyboard use or
that the backend exists. A wireframe-only request gets fidelity-appropriate
proof, not a false production-readiness claim.

Start with one review and at most two repair passes for a task slice, within
the run's budget. Recheck the changed behavior and affected layout. If it
still fails, deliver the draft with named limits; do not call it ready. Normal
creation includes this repair work without an extra approval ritual. An
explicit audit-only request retains its requested scope.

Repairs use version-conditional edits. Evidence includes relevant input
versions, not only a timestamp. Changed outputs, governing rules or task
requirements invalidate affected proof; unrelated chat does not. A stale
repair rereads and reconciles instead of overwriting. Feedback is available
for add and edit through API, ordinary CLI, CLI JSON and web. Ordinary canvas
edits do not each launch a model review.

An unavailable browser produces an unverified draft, with an optional handoff
to an available authorized verifier. Do not silently provision a browser
service, spawn extra paid agents or substitute a source audit for inspection.
“Ready for the agreed scope” requires the named task checks and no unresolved
critical defects; it does not claim general accessibility certification or
production readiness beyond the requested delivery.

## The Impeccable adapter

The adapter resolves the same request and context, materializes compatible
working files with version provenance, discovers capabilities, and exposes a
pinned, verified package or attributed adapted guidance. It does not restart
discovery or export private context outside its existing permissions.

The research inspected upstream commit
`2149fcce39a90bb409df5f16515f316a76dc6199`. Begin compatibility testing there;
do not assume importing its `SKILL.md` also supplies references, launcher,
hooks or review roles. Preserve license and notices for redistributed material.
Exercise available package modes honestly, reconcile documenter changes back
through canvas versions, and reject stale projections.

The default workflow must work without this package. Rich image-led exploration
and additional review roles are separately budgeted options. Enable the adapter
by default only if [the evaluation](evaluation.md) supports its added cost.
An incompatibility or negative result is a recorded narrowing of this phase,
not a reason to delay reliable discovery and browser completion.

## Release boundary

Ship correctness fixes to questions independently. Put the new automatic
procedure behind one shared rollout policy, exercised by both entrances;
an agent's private preference must not produce a different rollout state.
Keep an explicit entry available for testing. Existing manual design commands
remain useful during rollout.

Disable automatic enrollment to roll back. Existing briefs, answers, decisions
and receipts must remain readable, editable and resumable, and existing screens
must still render. No migration may require the new orchestration to display
old content. The shipped README describes only the behavior actually enabled.
