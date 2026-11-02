---
status: built
since: 2026-09-14
issue: 303
see: design-lint
note: Optional checks follow the project's actual technology and configuration. Independent Tailwind, CSS, HTML and rendered-accessibility fixtures pass. Tailwind is advisory because upstream coverage is incomplete; broader tools remain recommendations.
---
# Optional checks should follow the project's technology and existing configuration

Use the existing native HTML audit for canvas artifacts. Offer the standalone
Tailwind runner to source repositories that already use the measured stack;
its result is advisory. Stylelint, HTML-validate and axe/Playwright have executable
compatibility fixtures below, while the wider shortlist remains conditional
recommendations. Nothing here migrates isocan to Tailwind or installs a preset
into another project.

## What actually ran

The conductor installed each committed fixture lock into a fresh scratch
repository and independently replayed the real tools on Node 24.13.0. The
Tailwind proof passed eight scenarios over sixteen baseline files in
2,708.00 ms. The web proof passed 23 assertions across 21 results in 2,268.51 ms.
These are local fixture timings, including their stated setup boundaries, not
production-project performance estimates. Package installation is outside both
probe timers; Tailwind starts fresh worker processes, while the web timer
includes tool imports and browser launch. The pinned HTML-validate package
requires Node `^22.22.0 || >=24.8.0`; Stylelint requires `>=20.19.0` and
Playwright `>=20`. Node 24.13.0 satisfies this measured combined toolchain.
Browser availability is a separate prerequisite; the probe uses an existing
executable and does not download one.

| Measured tool | Positive and negative evidence | Adoption boundary |
| --- | --- | --- |
| `@shadcn/lint` 0.1.0, ESLint 10.9.1, TypeScript parser 8.68.0, Tailwind 4.3.3 | Five findings on the bad Button; zero on its variant-based control. Custom theme, workspace alias/barrel, custom UI directory, Unicode/BOM and line-ending spans, warning severity, disabled/suppressed rules and changed theme/config all exercised. Missing tooling/config, missing theme, broken theme import, ignored source and HTML/CSS remain explicit. | **Go for optional advisory JSX checks; no-go as a complete design gate.** Oxlint is not measured. Only the pinned plugin API and its labelled experimental project metadata API are used. |
| Stylelint 17.15.0 | Actual unknown property, invalid value and duplicate declaration findings; valid CSS control; ignored/malformed CSS, HTML input, missing config and disabled rules. | Useful configured CSS checks. The selected rules do not resolve actual custom-property values or enforce a DESIGN.md spacing scale. |
| HTML-validate 11.15.0 | Actual malformed nesting and empty button findings; valid HTML control; invalid config, disabled rules and embedded-CSS boundary. | Useful HTML source validation. CSS and browser-created or revealed content need other evidence. |
| `@axe-core/playwright` / axe-core 4.13.0, Playwright 1.63.0 | Chrome 152.0.7977.84 catches missing labels and low contrast, retains gradient contrast as incomplete, and finds a hidden field's label fault after an actual button click. Clean control, disabled contrast and missing browser are measured. | Useful rendered-state evidence at 1024×768. Other states/viewports and manual accessibility remain outside this fixture. |

The real Tailwind adapter emits normalized source spans, exact checked-input
hashes, tool versions, selected rules/settings, named config/theme/component
hashes, runtime and coverage. Its `coverage.executed` means all six configured
rules completed without an observed unmet precondition. It does not assert that
every file invoked the compiler. `coverage.complete` remains false: an unknown
Button props spread and a dynamic class on a plain element yield zero upstream
findings in the retained negative control. The upstream rule explicitly limits
itself to recognized components and leaves opaque whole-props spreads alone.
[Rule boundary](https://github.com/shadcn-ui/lint/blob/53de86f0e7dcc341a9cb45c383a9f2c454d1e958/docs/rules/require-static-classes.md).

A fresh process avoids reusing prior in-process configuration caches. Hashes
identify the named files, not the transitive closure of executable config
imports or environment inputs. Compiler/config output is retained as warnings
and prevents a completed-execution claim; the broken-import control proves
this separately from an absent theme. This follows the upstream documented
cache and compiler-fallback limitations.
[Troubleshooting](https://github.com/shadcn-ui/lint/blob/53de86f0e7dcc341a9cb45c383a9f2c454d1e958/docs/troubleshooting.md).

The fractional-spacing control still passes `p-3.25`. Actual Tailwind compilation
emits a multiplier of the 0.25rem spacing unit: 13px at a 16px root size. The
native audit independently reports 13px against a 16px discrete token. An
automatic syntax rewrite would preserve the discrepancy. No DESIGN.md-to-theme
exporter or automatic policy widening was added.

## Run and interpret it

From an isocan source checkout, audit explicit files in an existing configured
repository:

```sh
node scripts/design-lint-repo.mjs --repo /path/to/project --json -- src/example.tsx
```

The adapter does not install packages, rewrite configuration or apply fixes.
It loads the repository's executable ESLint configuration in a fresh Node
process, as running its linter normally would. Select the workspace root that
contains its dependencies. The measured versions are above; another host/parser
version is explicitly unmeasured, and the adapter requires `@shadcn/lint` 0.1.0
and Tailwind v4. The default advisory exit is 0 when a report is produced, even
for findings or unavailable checks. Command failures exit 1. The opt-in `--fail`
returns 2 for findings or incomplete coverage; because this spike cannot claim
complete coverage, it also returns 2 on the zero-finding control. It is not
recommended as a strict CI gate.

Reproduce the pinned Tailwind experiment in an unused directory:

```sh
node scripts/probe-tailwind-lint.mjs --prefix /tmp/acme-tailwind-proof --install --output /tmp/acme-tailwind-results.json
```

The fixture configuration is stored as inert `eslint.config.mjs.fixture` data;
only the scratch copy becomes a discoverable ESLint configuration. This keeps
the optional toolchain out of isocan's ordinary lint walk.

Only the probe's explicit `--install` prepares scratch dependencies with
`npm ci --ignore-scripts`; the repository adapter never installs anything.
Replay the same prepared fixture by omitting `--install`. The probe temporarily
changes only its marked synthetic fixture, restores its files, and asserts both
faults and expected exclusions. Exit 0 means those expectations held, not that
the deliberately broken input is clean. Both fixture locks pin transitive
packages and were verified by installation into a second fresh directory.

The [web fixture instructions](../../test/fixtures/design-lint-web/README.md)
reproduce Stylelint, HTML-validate and axe using isolated dependencies and an
existing browser. Missing dependencies or a browser give unavailable evidence,
not skipped success. These three experiments are compatibility probes, not
general repository adapters or installed isocan integrations.

[Actual Tailwind reports](shadcn-lint/results-2026-09-14-phase4-tailwind.json) and
[actual web-tool reports](shadcn-lint/results-2026-09-14-phase4-web.json) retain
versions, hashes, source locations and upstream results. The fixture sources
and exact repro commands are committed beside the runner. The independent
standalone CLI also produced valid JSON with exit 0 and returned 2 for
`--fail` on the zero-finding incomplete control.

## Further tools to offer conditionally

**Research checked 14 September 2026 against primary sources.** Every tool in the matrix below is a recommendation, not a newly measured isocan adapter. isocan uses React 18, Vite and CSS, without Tailwind. It already enables `react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps` as targeted errors for web/module TSX in `eslint.config.js`; that source inspection does not establish compatibility for the wider plugin preset. The Tailwind runner and CSS/HTML/rendered-accessibility experiments have separate executable evidence.

| Technology / trigger | Optional tool | Why it earns a place | Limits and adoption choice | Primary source |
| --- | --- | --- | --- | --- |
| React components and hooks | `eslint-plugin-react-hooks` | Detect invalid hook ordering and stale effect dependencies; current recommended rules also expose React Compiler findings. | Retain the project's enabled rules and custom-effect configuration. Review additional compiler/purity rules incrementally; do not replace isocan's existing guard with an unmeasured preset. | [React rule reference](https://react.dev/reference/eslint-plugin-react-hooks), [custom effect hooks](https://react.dev/reference/eslint-plugin-react-hooks/lints/rules-of-hooks) |
| Next.js dependency and application | `eslint-config-next` / `@next/eslint-plugin-next` | Framework-specific correctness/performance checks complement generic React rules. | Follow the installed Next version and existing config. The full config already brings overlapping React/hooks/accessibility rules; use the plugin directly where composition conflicts. Next 16 removed `next lint`, and `next build` no longer performs linting: run ESLint explicitly. | [Next ESLint configuration](https://nextjs.org/docs/app/api-reference/config/eslint), [Next 16 migration](https://nextjs.org/docs/app/guides/upgrading/version-16) |
| TanStack Query dependency | `@tanstack/eslint-plugin-query` | Query-key dependencies, stable QueryClient lifetime and unstable hook dependencies address library-specific mistakes. | Select the documentation/rules matching the project's Query major. Start with its recommended configuration; the stricter preset is additionally opinionated. This does not validate network behavior or cache policy at runtime. | [Query plugin and rule list](https://tanstack.com/query/latest/docs/eslint/eslint-plugin-query) |
| TypeScript with project configuration | typescript-eslint typed rules | `no-floating-promises` and `no-misused-promises` catch asynchronous mistakes that syntax-only lint misses. | Keep `tsc`. Enable rules in the real TS project context; `projectService` supports project references, but typed linting adds type-checking work. Measure a package before enabling a broad strict preset or expanding out-of-project files. | [Typed setup](https://typescript-eslint.io/getting-started/typed-linting/), [Project Service](https://typescript-eslint.io/blog/project-service/), [promise rule](https://typescript-eslint.io/rules/no-floating-promises/) |
| Python sources | Ruff | Fast feedback for unused imports and selected correctness, upgrade and convention rules; can consolidate overlapping Flake8/isort rules. | Respect `pyproject.toml`/`ruff.toml` and target Python version. It complements a type checker. Lint and formatting are independent: retaining Black is valid. Keep fixes off for an audit and review unsafe fixes separately. | [Ruff linting](https://docs.astral.sh/ruff/linter/), [configuration](https://docs.astral.sh/ruff/configuration/), [overlap and type-checking limits](https://docs.astral.sh/ruff/faq/) |
| PostgreSQL SQL migrations | Squawk | Flags migration patterns involving locking, index creation, constraints and destructive schema changes before execution. | Configure PostgreSQL version and whether the migration framework wraps transactions. A clean SQL lint does not establish operational migration safety; runtime lock/statement timeouts and a realistic migration test remain necessary. Other SQL dialects need another checker. | [Squawk CLI/configuration](https://squawkhq.com/docs/cli/), [migration limits](https://squawkhq.com/docs/safe_migrations/) |
| OpenAPI/AsyncAPI descriptions or an established API ruleset | Spectral | Applies API design conventions and organization rules to JSON/YAML contracts. | Load the project's ruleset and its chosen specification version. Without the ruleset, there is no agreed style contract. Static document checks do not demonstrate that the service implements the API or that authorization works. | [Spectral scope and ruleset requirement](https://github.com/stoplightio/spectral) |
| GitHub Actions workflow files | actionlint | Checks workflow structure, expressions, action/reusable-workflow interfaces and common script-injection patterns. | Record whether optional ShellCheck/Pyflakes checks were available. Static validation does not establish action execution, permissions, secrets, runner availability or service behavior; keep real CI tests. | [actionlint capabilities](https://github.com/rhysd/actionlint), [checks](https://github.com/rhysd/actionlint/blob/main/docs/checks.md) |
| JS/TS workspace accumulating unused files/exports/dependencies | Knip | Repository-wide reachability and dependency hygiene complement per-file unused-variable rules. | Establish entry points, workspaces and generated files first. Dynamic imports, framework discovery and public exports can look unused when the model is incomplete. Begin report-only; do not automatically delete findings or replace existing export guards. | [Knip getting started](https://knip.dev/overview/getting-started), [false positives and entry configuration](https://knip.dev/guides/handling-issues) |
| JS/TS architecture with explicit package/layer boundaries | dependency-cruiser | Tests permitted dependency edges, cycles and unwanted production-to-test/dev dependencies; provides a graph for reviewing architecture. | Encode the project's actual boundaries and resolution settings, including TS aliases. Excluded or depth-limited paths reduce coverage. It overlaps Knip on orphans/dependencies, but its main purpose is allowed edges rather than unused exports. | [Rules and graph scope](https://github.com/sverweij/dependency-cruiser), [resolution and coverage options](https://github.com/sverweij/dependency-cruiser/blob/main/doc/options-reference.md) |

**Suggested order, not an installation preset:** preserve the current React checks; consider a small typed-linting pilot and actionlint where those gaps exist. Offer Next/Query/Ruff/Squawk/Spectral when their corresponding technology is present. Offer Knip when unused-code maintenance is costly and dependency-cruiser when enforceable architectural boundaries exist. Installing both hygiene tools by default creates overlapping noise without establishing either one's project model.

For JSX accessibility, `eslint-plugin-jsx-a11y` is a useful source check when the framework config does not already include it; custom components need appropriate mappings. It cannot inspect the rendered DOM. Pair source checks with the measured axe/browser path and human keyboard/assistive-technology review, rather than interpreting either static JSX or a clean axe result as full accessibility approval. [Maintainer guidance](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y)

An existing formatter should continue to own formatting. Adding a linter is not a reason to migrate Prettier/Biome/Black or duplicate conflicting style rules. Ruff explicitly supports independent lint/format adoption and documents formatter-rule conflicts. [Ruff formatter compatibility](https://docs.astral.sh/ruff/formatter/)

Before advertising any additional adapter, pin its host/tool versions in an isolated fixture, run the project's actual config without fixes, and prove a known fault, clean control, ignored/unsupported input, missing dependency/config and meaningful source mapping. Record selected rules, exclusions, config provenance and elapsed time. Detection recommends a tool; it does not authorize installation or configuration changes. An audit must not rewrite tokens, migration policy or lint exceptions to remove findings.


The completed spike passed the final full fast suite (5,341 tests), typecheck,
build and strict suite (5,898 tests across 579 files, three opt-in skips).
Before the final upstream refresh, the initial browser entry remained exactly
762,562 raw / 258,847 gzip bytes, with the same SHA-256 as phase 3.
Upstream identity-menu change `d25c478b` subsequently moved the combined entry
to 762,574 raw / 258,864 gzip bytes; this phase adds no browser code. [Independent combined evidence](shadcn-lint/results-2026-09-14-phase4.json)
records these gates and the corrected intermediate failures. Broader adapters
and model-lift claims remain outside this completed compatibility spike.

After incorporating upstream identity-menu change `d25c478b`, the combined
tree passed all 5,346 fast tests, typecheck and build. The strict result above
was measured before that upstream UI-only change.
