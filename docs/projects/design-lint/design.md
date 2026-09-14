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

The `isocan` field is an isocan-specific extension, not a DESIGN.md or DTCG
standard field. The entire selected governing document supplies the policy;
contracts never merge across lanes. The smallest useful version is:

```yaml
isocan:
  lint:
    version: 1
    literals: require-references
    recipes:
      Button:
        owns:
          padding: "{spacing.md}"
          border-radius: "{rounded.control}"
        allow:
          - margin
          - align-self
        treatments:
          compact:
            padding: "{spacing.sm}"
      Title:
        owns:
          font-weight: "{typography.title.fontWeight}"
        allow:
          - font-size
    exceptions:
      hero-spacing:
        recipe: Button
        properties:
          - padding
        reason: "Acme #1 needs additional room for its two-line label."
```

`lint.version` is the integer 1. Missing `isocan.lint` means the existing token
policy with exact literals allowed. Within version 1, `literals` defaults to
`allow`, and recipes/exceptions default to empty maps. The other literal mode
is `require-references`. Recipe, treatment and exception names are nonempty
plain identifiers. Property names are lowercase CSS names. Values in `owns`
and treatment maps are nonempty strings of CSS values and/or DESIGN.md token
references; unresolved or non-scalar references make that rule unsupported.
Unknown fields within `lint`, versions, invalid types and unsupported property/value forms
remain visible as policy problems and incomplete coverage, not a default-pass
interpretation. No policy data is executable.

An element opts into `data-isocan-recipe="Button"`. An optional
`data-isocan-treatment="compact"` chooses one treatment of that recipe;
its declared values replace only named owned properties. A treatment cannot
silently extend ownership or exempt unrelated rules. An optional
`data-isocan-exception="hero-spacing"` selects one exception that must name
that same recipe and specific properties and carry a nonempty reason. It
relaxes ownership/reference checks only for those properties on that marked
element. Existing token-membership checks still apply, including on the exempted
properties; an exception does not silently add an off-scale token. The effective report shows
which exception and reason were used. Unknown markers are findings under a supported policy, never an
implicit grant. An unsupported policy version instead reports that its marker
meaning is unexamined. Generic class names confer no recipe identity.

Version 1 supports ownership of `padding` and its four physical longhands,
`border-radius` and its four physical corner longhands, `font-size` and
`font-weight`. Other owned properties are preserved and reported unsupported.
The `allow` list may name other caller CSS properties; their values still
follow the existing native token audit. Logical-direction ownership and other
property families wait for explicit expansion of the supported rule set.

`owns` specifies the expected effective declarations on a marked element;
those values must be present and match the recipe or selected treatment.
Equivalent supported shorthand/longhand declarations are checked together so
`padding-top` cannot bypass ownership of `padding`. Properties in `allow`
are documented caller controls; they remain subject to the governing token
policy. Other explicitly authored properties on a marked element are outside
its approved caller controls and receive a contract finding. A normal base
style should therefore put its fixed properties in `owns` and its caller
controls in `allow`. Inherited browser defaults do not count as authored
caller declarations. Missing owned styling reports only where the supported
static model can establish absence. Unresolved external, conditional,
pseudo-class or competing cascade paths remain unexamined.

Version 1 must support explicit inline declarations and direct, unambiguous
static selectors for the marked element, including simple type, class, ID and
exact attribute selectors and their compounds without combinators. A clear
inline override of one matching rule must be checked, not dismissed as wholly
unknown cascade. It does not infer a component
implementation or simulate the browser cascade. Any selector or competing
rule it cannot safely assign and order is reported as incomplete contract
coverage. The report and UI must label this boundary rather than suggesting
that a matching inline value proves external styling safe. CSS identifier
escapes retained by the parser are unexamined in this version; quoted attribute
strings already decoded by the parser remain supported.

`require-references` applies to governed color, spacing, radius and type-size
uses, and to governed owned values when a named token is available. Actual
exported custom-property definitions may contain the token literals; that is
how the browser receives the values. A local `var(--alias)` is allowed when
its static resolution actually passes through the corresponding declared
exported token and resolves to that token's expected value. A local literal
alias is not proof of token use, and an exported name shadowed with an
off-system value does not pass. Neutral CSS values retain the analyzer's
existing boundary. `allow` retains phase 1's exact-literal behavior.

The report carries the effective normalized contract, original extension,
policy problems, applied treatments/exceptions and governing provenance.
CLI human and JSON audit output and the browser's Design check expose it.
Editing the linked governing DESIGN.md uses the existing document editor or
`design set --in`, creating an ordinary version and normal undo. Saving an
HTML repair can change only that HTML item; it cannot add a token, edit the
policy or manufacture an exception in the governing document.

### Preservation before enforcement

The preimplementation round-trip probe found silent loss in the old YAML
subset: a quoted `#` truncated an exception reason, quoted quotes acquired
escapes, and unknown booleans, null and nested list maps changed type or value.
A type cast preserving the `isocan` key was therefore insufficient.

Native serialization must preserve JSON-compatible extension data recursively.
A canonical JSON flow value for the `isocan` field is valid YAML and provides
an opaque preservation path without adding a general YAML runtime to the
initial app. The parser supports that flow form and the documented block-map
version 1 form, including quoted reasons and string lists. Unknown constructs
outside its supported YAML subset must produce parse problems; subsequent
conversions refuse or expose those problems rather than emitting a silently
weakened document. Round trips compare structured values, not source formatting.
Unsupported non-JSON runtime values and unsafe or duplicate keys are rejected
with a reason instead of being coerced or lost.

DTCG export/import carries the whole native extension under
`$extensions["io.isocan"].isocan`, alongside existing component metadata.
Unknown nested JSON data survives this path. CSS export remains a derived
set of custom properties: it cannot carry recipes, reasons or unknown contract
fields. Callers present a conversion note when such data is present; CSS
import cannot claim to restore a lost policy. The native document and DTCG
extension are the supported contract round-trip formats.

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


The phase-5 mechanism is fixed in [evaluation.md](evaluation.md): the model has
an empty toolset and supplies HTML, while the host exercises the real captured
repair API on a fresh synthetic daemon. Actual DOM and interaction checks grade
stored bytes. This bounds the measured claim to correction feedback rather than
autonomous tool use. On the available Claude Max login, reported dollar cost is
API-equivalent; actual billed spend remains unavailable without billing evidence.
