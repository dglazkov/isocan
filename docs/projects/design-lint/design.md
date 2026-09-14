# Diagnostics must identify both the edit and the rule that asked for it

The debt is measured in [the research](../../research/2026-09-14-design-lint.md):
whole-source regexes credit missing variables and flag prose. The implementation
keeps native HTML and the existing operation vocabulary.

## Native analysis and reports

Choose browser-compatible HTML and CSS parsers by a measured source-location,
malformed-input and bundle probe before adding dependencies. Reuse an existing
parser where appropriate. Node tooling such as Stylelint, HTML-validate and
ESLint is an optional repository runner, not an assumed browser dependency.

`auditScreen` remains the shared core entry point. Preserve `offSystem` and
`onSystem` as documented compatibility aggregates and add versioned diagnostics
and coverage. Every finding has a stable code, severity, source range, actual
value, explanation and candidate repairs. Candidates come from `toCss`'s naming
rules. Nearest choices require a person's or agent's decision; the checker
never adds tokens or grants exceptions.

**14 September implementation correction:** The runtime plugin loader retains
the entire core namespace. Keeping the new analyzer on that barrel raised the
measured initial app chunk by 72,119 gzip bytes. Move its runtime exports to
`@isocan/core/design-audit` and migrate callers; keep type exports on core.
The dedicated import is deliberate compatibility migration for these private
workspace helpers, keeping parsers out of ordinary initial app loading.

The governing document supplies the expected palette and token names; it does
not inject CSS into a self-contained artifact. A `var(--color-ink)` reference
therefore needs an actual declaration in the artifact's statically knowable
scope to earn resolved-value credit. When only DESIGN.md knows that name,
report the missing CSS declaration and explain how to include its exported
CSS. Do not seed the artifact's runtime variable environment with hypothetical
exported declarations. Local declarations, including shadows of exported names,
are checked by their resolved values. Candidate token replacements must say
when their CSS declaration must be included; literals are still allowed by the
default policy. Unknown external or dynamic scope remains unexamined.

Inspect style elements, attributes and SVG presentation attributes. Parse CSS
values, resolve known token references and local aliases, check relevant color,
font-size, radius and declared spacing properties, and explicitly classify
cycles, missing variables, nested fallbacks and malformed source. Track external
styles, runtime styling, unsupported expressions and ambiguous cascade as
unexamined; never fetch or execute content during static analysis. A matching
literal remains conforming by default. Geometry is not automatically spacing.

Use the existing `governingDesign` and ContextReader abstraction for per-item
scope and linked inheritance. A browser-compatible shared orchestration module
accepts snapshot/blob readers; the Node API and browser supply I/O adapters.
Report item/version/blob, governing item/version/source canvas and rule version.
Reads do not create operations. Recompute when any input changes; no durable
report or comment log is needed.

## Repair and presentation

Extend `design audit` with item/file selection and opt-in failing exits while
retaining ordinary report behavior. Arrival checks return structured advisory
evidence even for JSON; audit failure after storage does not reverse or mislabel
the write. The browser displays an item report and opens source selections.

An explicit repair is a caller-authored replacement, or accepted unambiguous
candidate, audited against captured inputs. Commit one `item.edit` with
`expectedVersionId`; conflicts require a fresh read. Use the existing undo
mechanism. Report the before/after readings and remaining findings. Bounded
agent correction is at most two rounds by default. There is no automatic model
call, no implicit policy edit and no new operation type.

Draft and file reports identify their actual input; they must not reuse the
stored screen's blob identity for different bytes. Source selection is valid
only while the editor still holds the checked text. Refresh governing context
before accepting a repair, retain the captured screen-version precondition,
and recheck after save. A design change on another canvas cannot be locked by
the screen's edit operation; provenance records what was checked and a changed
governing version invalidates the result. Ordinary editor saves keep their
existing version-stack behavior; the explicit repair action carries the fence.

The write receipt distinguishes accepted, refused and pending/unconfirmed.
A queued operation can still land, and a lost response can follow acceptance;
neither is a refusal. Only an accepted receipt may report a saved repair and
clear its unchanged draft. Pending results retain the proposed version identity
and the draft while the client waits for confirmation or reads fresh evidence.
An authoritative conflict is a refusal. Read failures after an accepted write
remain unavailable audit evidence, never a failed content save. Captures include
the rule version as well as content and governing provenance. A draft's opened
base version stays distinct from a newer current version discovered by a check.

## Contract schema, version 1

DESIGN.md stores a namespaced `isocan` extension with a versioned `lint` object.
The exact serialized shape and parser preservation path must be verified and
recorded before phase 3 implementation. Version 1 is declarative data:
`version: 1`, a literal/reference policy, recipe identities, owned properties,
allowed caller properties, named treatments and scoped exceptions with reasons.
An explicit `data-isocan-recipe` marker selects identity; a separate treatment
marker selects an approved declaration set. Generic class names confer no
ownership. Unsupported selector/cascade cases are unexamined, not inferred.

Policies follow the selected governing document wholesale; there is no hidden
global style and no merging across competing lanes. Unknown fields/rules are
preserved in the native document and reported unsupported; a conversion that
cannot preserve them must report the loss rather than silently discard data.
The extension is isocan-specific, not a claimed DESIGN.md/DTCG standard field.
Existing document edit/version/property operations expose it to both surfaces.

## Optional project tooling

Phase 4 is a bounded local adapter spike: use the documented, pinned
`@shadcn/lint` plugin API in a scratch/optional runner with repository-local
configuration and dependencies. Normalize diagnostics and coverage; identify
tool/config versions; keep Node workers out of core. Prove aliases/barrels,
monorepo paths, custom component directories, unsupported files and missing
theme/dependencies. Tailwind's arithmetic spacing and DESIGN.md's discrete
scale remain distinct, explicitly reported policies.

Also record optional technology checks, prioritizing Stylelint, HTML-validate
and axe with Playwright. Detection recommends a tool; it does not silently
install it or rewrite a project's established configuration. Only measured
adapters are advertised as usable. Do not migrate isocan's app to Tailwind.

## Evaluation

Use the existing lift/evals conventions for equal starting drafts, model,
correction budgets and report fields. Freeze synthetic tasks and go/no-go
criteria before paid runs. A dry-run harness and rendered fixture review can
be completed locally. Actual model spend requires a separately stated budget
and approval; human intent ratings require a person. Record both as open
until performed rather than fabricating a favorable lift measurement.
