# Optional web-check compatibility fixture

Synthetic inputs for `scripts/probe-web-linters.mjs`. These files configure
this experiment only. No project formatter, lint configuration, application
dependency or canvas is changed.

From the repository root, prepare an isolated prefix:

```sh
mkdir -p /tmp/isocan-web-tools
cp test/fixtures/design-lint-web/package.json /tmp/isocan-web-tools/package.json
cp test/fixtures/design-lint-web/package-lock.json /tmp/isocan-web-tools/package-lock.json
npm ci --prefix /tmp/isocan-web-tools --ignore-scripts --no-audit --no-fund
node scripts/probe-web-linters.mjs /tmp/isocan-web-tools /tmp/isocan-web-results.json
```

The probe uses installed Chrome on macOS, otherwise Playwright's installed
Chromium. Pass `--browser /absolute/path/to/browser` to select an existing
executable. It never downloads a browser or installs a package. A missing
browser or mismatched/missing dependency lock is reported as unavailable.
The committed lock pins transitive packages as well as direct tool versions.

The JSON retains real tool output, source and named configuration hashes,
versions, durations, normalized diagnostics and the assertions it checked.
Exit 0 means the experiment's positive and negative controls passed; exit 1
means an assertion failed; exit 2 means required tooling was unavailable.
A successful experiment includes expected findings, unsupported inputs and
unavailable controls. It is not a clean bill for the deliberately broken files.

- Stylelint catches invalid values, unknown properties and duplicates. The
  selected rules leave missing custom properties and discrete spacing policy
  unexamined; disabled rules and HTML input have explicit limits.
- HTML-validate catches malformed source and validates the clean HTML control.
  It does not evaluate embedded CSS or the browser's resulting DOM.
- axe checks real rendered controls through Playwright, including contrast,
  incomplete gradient contrast, explicitly disabled rules and a hidden input
  revealed by a real button click. Its findings identify rendered selectors,
  not invented source ranges. Manual review and unvisited UI states remain.

Only this fixture's compatibility is measured. General repository adapters,
application integration and comprehensive accessibility certification are not
provided by this probe.
