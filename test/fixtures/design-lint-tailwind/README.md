# Pinned Tailwind repository proof

This synthetic npm workspace exercises the optional source-checkout runner
against actual ESLint configuration, a custom Tailwind theme and components in
`packages/design/controls`. The app imports Button through a workspace alias
and a barrel. The fixture pins `@shadcn/lint` 0.1.0, ESLint 10.9.1,
`@typescript-eslint/parser` 8.68.0 and Tailwind 4.3.3. It was measured on Node
24.13.0. Nothing here adds dependencies to the isocan application.

From an isocan source checkout with its development dependencies installed,
choose a scratch path that does not exist:

```sh
node scripts/probe-tailwind-lint.mjs --prefix /tmp/acme-tailwind-proof --install --output /tmp/acme-tailwind-results.json
```

The probe copies this fixture, materializes `eslint.config.mjs.fixture` as the
scratch project's real `eslint.config.mjs`, and runs `npm ci --ignore-scripts --no-audit
--no-fund` in the scratch directory using the committed lockfile. It temporarily
changes only that marked scratch fixture and restores each input. Replay an
existing prepared fixture by omitting `--install`; use a new scratch path after
changing the committed fixture. The JSON output retains the actual tool versions,
findings, source identities, named configuration hashes, warnings and runtime.
The configuration template stays inert in the isocan checkout so root ESLint
discovery does not load optional fixture dependencies.

To audit explicit source files in a project that already has the measured
dependencies and its own ESLint configuration:

```sh
node scripts/design-lint-repo.mjs --repo /tmp/acme-tailwind-proof --json -- apps/web/src/bad.tsx apps/web/src/good.tsx
```

Select the repository/workspace root containing its dependencies. The runner
loads that project's configuration with fixes and cache disabled, preserves rule
severities, settings and overrides, and uses a fresh process for each invocation.
It installs nothing and writes no configuration or source changes. Omitting
`--json` prints a readable report. Positions are one-based lines and UTF-16
columns, with zero-based UTF-16 offsets and exclusive ends; the input hash covers
the exact UTF-8 bytes passed to ESLint.

The report distinguishes `audited`, `ignored`, `unsupported` and `unavailable`
files. `coverage.executed` means all six configured rules completed without an
observed unmet precondition. It does not mean every file invoked the Tailwind
compiler. `coverage.complete` remains false because the public plugin cannot
enumerate all styling paths. Named file hashes are not a transitive fingerprint
of arbitrary JavaScript configuration imports, theme imports or environment
inputs. Findings retain the project's severity and any upstream suggestions.

Normal invocation exits 0 when it produces a report, including reports with
findings or unavailable analysis. Invalid arguments and worker failures exit 1.
The optional `--fail` exits 2 for findings or incomplete coverage; because this
adapter always declares incomplete source coverage, even the clean control exits
2. It is an advisory experiment, not a strict design gate.

The executable assertions cover 16 baseline files and eight scenarios: known
findings and a clean control; actual component variants and repository settings;
multiline Unicode and UTF-8 BOM ranges across all ECMAScript line separators;
disabled, ignored and suppressed checks; malformed JSX;
unsupported HTML/CSS; missing dependencies/config/theme; a readable theme whose
import produces a real compiler fallback warning; and fresh config/theme changes.
`blind-spot.tsx` deliberately has unknown props and dynamic plain-element classes
with zero upstream findings. That result is incomplete, never a clean design
claim. See the pinned upstream [analysis limits](https://github.com/shadcn-ui/lint/blob/53de86f0e7dcc341a9cb45c383a9f2c454d1e958/docs/how-it-works.md#what-it-cannot-see).

Finally, Tailwind's public compiler accepts `p-3.25` as arithmetic spacing. With
`--spacing: 0.25rem` and a 16px root size it means 13px; the independent native
audit rejects 13px against a discrete 16px design scale. Passing this repository
check therefore cannot establish compliance with a DESIGN.md contract.
