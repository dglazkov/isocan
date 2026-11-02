#!/usr/bin/env node
/**
 * Pinned compatibility experiments, not an application linter or a clean bill
 * of accessibility. The fixture is synthetic; source and configuration are
 * never modified. Dependencies are loaded only from an explicit scratch prefix.
 *
 * Copy test/fixtures/design-lint-web/package.json and package-lock.json to a
 * scratch directory, then run npm ci --prefix <scratch> --ignore-scripts
 * --no-audit --no-fund. This script never installs anything.
 *
 * node scripts/probe-web-linters.mjs <scratch> [output.json] [--browser /path]
 * Omit --browser to use installed Chrome, or Playwright's installed Chromium.
 * Exit 0: every positive/negative control behaved as asserted. Exit 1: a proof
 * assertion failed. Exit 2: dependencies or the browser needed for proof were
 * unavailable. Expected unavailable controls are included in a passing proof.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const argv = process.argv.slice(2);
if (argv.includes('--help') || !argv[0]) {
  console.log('Usage: node scripts/probe-web-linters.mjs <scratch-tools> [output.json] [--browser /executable]\nNo dependency installation or source modification is performed.');
  process.exitCode = argv.includes('--help') ? 0 : 2;
} else await main();

async function main() {
  const started = performance.now();
  const fixture = fileURLToPath(new URL('../test/fixtures/design-lint-web/', import.meta.url));
  const prefix = path.resolve(argv[0]);
  const output = argv[1] && !argv[1].startsWith('--') ? path.resolve(argv[1]) : null;
  const browserAt = argv.indexOf('--browser');
  const browserArg = browserAt < 0 ? null : argv[browserAt + 1];
  if (browserAt >= 0 && !browserArg) throw new Error('--browser requires an executable path');
  const pins = JSON.parse(readFileSync(path.join(fixture, 'package.json'), 'utf8')).dependencies;
  const requireTool = createRequire(path.join(prefix, 'package.json'));
  const hash = text => createHash('sha256').update(text).digest('hex');
  const read = name => readFileSync(path.join(fixture, name), 'utf8');
  const originalFiles = new Map();
  const identity = name => {
    const sha256 = hash(read(name));
    if (!originalFiles.has(name)) originalFiles.set(name, sha256);
    return { path: `test/fixtures/design-lint-web/${name}`, sha256 };
  };
  const config = name => JSON.parse(read(name));
  const records = [];
  const checks = [];
  const tools = {};
  const unavailable = {};
  const report = {
    schemaVersion: 1, kind: 'optional-web-linter-compatibility-probe', node: process.version,
    generatedAt: new Date().toISOString(), toolsPrefix: prefix, tools: {},
    fixtureLock: identity('package-lock.json'),
    configIdentityBoundary: 'Hashes cover the named fixture configs and dependency lock only; no transitive project-config fingerprint is claimed.',
    limits: [
      'Synthetic fixture compatibility is not an installed isocan adapter or a production repository audit.',
      'Stylelint checks the configured CSS rules; it does not establish DESIGN.md token membership or computed browser values.',
      'HTML-validate checks HTML source; it does not execute scripts, validate CSS declarations, or establish the final browser DOM.',
      'axe checks the currently rendered state at one viewport. Manual accessibility assessment, keyboard usability, task intent and unvisited states remain outside this probe.',
    ], records, checks,
  };
  const installedLock = path.join(prefix, 'package-lock.json');
  report.installedLock = existsSync(installedLock) ? { sha256: hash(readFileSync(installedLock)), matchesFixture: hash(readFileSync(installedLock)) === report.fixtureLock.sha256 } : null;
  if (!report.installedLock?.matchesFixture) unavailable.lock = 'The scratch package-lock.json is missing or differs from the pinned fixture lock.';
  for (const [name, version] of Object.entries(pins)) {
    try {
      const metadataPath = path.join(prefix, 'node_modules', name, 'package.json');
      const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
      if (metadata.version !== version) throw new Error(`Expected pinned ${name}@${version}; found ${metadata.version}`);
      tools[name] = await import(pathToFileURL(requireTool.resolve(name)).href);
      report.tools[name] = { version: metadata.version, engines: metadata.engines ?? null };
    } catch (error) {
      unavailable[name] = error.message;
      report.tools[name] = { version: null, expectedVersion: version, status: 'unavailable', reason: error.message };
    }
  }
  const record = async (id, tool, input, configuration, scope, run) => {
    const began = performance.now();
    const entry = { id, tool, input: input ? identity(input) : null, config: configuration ? identity(configuration) : null, coverage: { scope, unexamined: [] } };
    try { Object.assign(entry, await run(entry)); }
    catch (error) { Object.assign(entry, { status: 'unavailable', reason: error.message, diagnostics: [] }); }
    entry.elapsedMs = Math.round((performance.now() - began) * 100) / 100;
    records.push(entry);
    return entry;
  };
  const check = (name, passed) => checks.push({ name, passed: !!passed });
  const cssScope = 'Source CSS declarations under the named fixture configuration; no autofix or cache.';
  if (tools.stylelint) {
    const stylelint = tools.stylelint.default;
    const lint = (filename, configFile = 'config/stylelint.json') => record(`stylelint:${filename}:${path.basename(configFile)}`, 'stylelint', filename, configFile, cssScope, async entry => {
      const result = await stylelint.lint({ files: path.join(fixture, filename), configFile: path.join(fixture, configFile), fix: false, cache: false, allowEmptyInput: true });
      const raw = result.results.map(({ source, warnings, parseErrors, invalidOptionWarnings, deprecations, ignored }) => ({ source, warnings, parseErrors, invalidOptionWarnings, deprecations, ignored }));
      const diagnostics = raw.flatMap(file => (file.warnings ?? []).map(warning => ({ path: entry.input.path, code: warning.rule, severity: warning.severity, message: warning.text, range: { line: warning.line, column: warning.column, endLine: warning.endLine, endColumn: warning.endColumn } })));
      const syntaxError = diagnostics.some(diagnostic => diagnostic.code === 'CssSyntaxError') || raw.some(file => file.parseErrors?.length);
      const ignored = raw.length === 0 || raw.some(file => file.ignored);
      const invalidConfig = raw.some(file => file.invalidOptionWarnings?.length);
      if (ignored) entry.coverage.unexamined.push('The configured file was ignored or no result was produced.');
      if (syntaxError) entry.coverage.unexamined.push('CSS parsing failed; declaration coverage is incomplete.');
      if (invalidConfig) entry.coverage.unexamined.push('The tool reported invalid rule options.');
      if (result.errored && !diagnostics.length) entry.coverage.unexamined.push('The tool reported an error without a source diagnostic.');
      entry.coverage.unexamined.push('Token-policy compliance and actual custom-property resolution are not checked by these rules.');
      return { status: syntaxError || ignored || invalidConfig ? 'unsupported' : result.errored && !diagnostics.length ? 'unavailable' : diagnostics.length ? 'findings' : 'checked', errored: result.errored, diagnostics, raw };
    });
    const bad = await lint('css/bad.css');
    check('Stylelint catches an unknown property, invalid value and duplicate declaration', ['property-no-unknown', 'declaration-property-value-no-unknown', 'declaration-block-no-duplicate-properties'].every(code => bad.diagnostics.some(d => d.code === code)));
    const clean = await lint('css/clean.css');
    check('Stylelint clean control has no configured-rule diagnostics', clean.status === 'checked' && clean.diagnostics.length === 0);
    const boundary = await lint('css/token-boundary.css');
    boundary.status = boundary.status === 'checked' ? 'partial' : boundary.status;
    check('Stylelint does not claim missing-var or discrete spacing coverage', boundary.status === 'partial' && boundary.diagnostics.length === 0);
    const disabled = await lint('css/bad.css', 'config/stylelint-disabled.json');
    disabled.coverage.unexamined.push('The three fault-detection rules are explicitly disabled in this configuration.');
    if (disabled.status === 'checked') disabled.status = 'partial';
    check('Disabled Stylelint rules leave the same bad source unexamined', disabled.status === 'partial' && disabled.diagnostics.length === 0);
    const ignored = await lint('css/bad.css', 'config/stylelint-ignored.json');
    check('Ignored CSS has explicit unsupported coverage', ignored.status === 'unsupported' && ignored.diagnostics.length === 0);
    const malformed = await lint('css/parse-error.css');
    check('A real CSS parse error cannot become zero-diagnostic clean coverage', malformed.status === 'unsupported' && malformed.diagnostics.some(d => d.code === 'CssSyntaxError'));
    const html = await lint('html/clean.html');
    check('Plain Stylelint CSS parser rejects HTML instead of giving clean coverage', html.status === 'unsupported');
    const missing = await record('stylelint:missing-config', 'stylelint', 'css/clean.css', null, cssScope, async () => {
      await stylelint.lint({ files: path.join(fixture, 'css/clean.css'), configFile: path.join(fixture, 'config/does-not-exist.json'), fix: false, cache: false });
      return { status: 'checked', diagnostics: [] };
    });
    check('Missing Stylelint config is unavailable', missing.status === 'unavailable' && missing.reason?.includes('does-not-exist.json'));
  } else records.push({ id: 'stylelint:dependency', tool: 'stylelint', status: 'unavailable', reason: unavailable.stylelint });

  if (tools['html-validate']) {
    const { HtmlValidate } = tools['html-validate'];
    const validate = (filename, configFile = 'config/htmlvalidate.json') => record(`html-validate:${filename}:${path.basename(configFile)}`, 'html-validate', filename, configFile, 'HTML source under the named static fixture config; scripts and CSS are not executed.', async entry => {
      const validator = new HtmlValidate(config(configFile));
      const result = await validator.validateFile(path.join(fixture, filename));
      const diagnostics = result.results.flatMap(file => file.messages.map(message => ({ path: entry.input.path, code: message.ruleId, severity: message.severity, message: message.message, selector: message.selector, range: { line: message.line, column: message.column, offset: message.offset, size: message.size } })));
      entry.coverage.unexamined.push('Rendered CSS, computed contrast and dynamically created or revealed UI remain unexamined.');
      return { status: !diagnostics.length && (!result.valid || result.errorCount > 0) ? 'unavailable' : diagnostics.some(d => !d.code || d.code === 'parser-error') ? 'unsupported' : diagnostics.length ? 'findings' : 'checked', valid: result.valid, diagnostics, raw: result };
    });
    const bad = await validate('html/bad.html');
    check('HTML-validate catches malformed nesting and empty button text', ['text-content', 'no-implicit-close', 'close-order'].every(code => bad.diagnostics.some(d => d.code === code)));
    const clean = await validate('html/clean.html');
    check('HTML-validate clean control is valid', clean.status === 'checked' && clean.valid);
    const boundary = await validate('html/css-boundary.html');
    if (boundary.status === 'checked') boundary.status = 'partial';
    check('HTML-validate does not claim to validate embedded CSS', boundary.status === 'partial' && boundary.valid);
    const disabled = await validate('html/bad.html', 'config/htmlvalidate-disabled.json');
    disabled.coverage.unexamined.push('The fixture disables validation rules; zero source findings provide no validation coverage.');
    if (disabled.status === 'checked') disabled.status = 'partial';
    check('Disabled HTML rules cannot produce a clean coverage claim', disabled.status === 'partial' && disabled.valid);
    const invalid = await validate('html/clean.html', 'config/htmlvalidate-invalid.json');
    check('HTML validator configuration failure cannot appear as clean source', invalid.status === 'unavailable' && invalid.reason?.includes('does-not-exist'));
  } else records.push({ id: 'html-validate:dependency', tool: 'html-validate', status: 'unavailable', reason: unavailable['html-validate'] });

  if (tools.playwright && tools['@axe-core/playwright']) {
    const { chromium } = tools.playwright.default ?? tools.playwright;
    const AxeBuilder = tools['@axe-core/playwright'].AxeBuilder;
    const options = config('config/axe.json');
    const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const executablePath = browserArg ?? (existsSync(chrome) ? chrome : undefined);
    let browser;
    try {
      browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
      report.browser = { version: browser.version(), executable: executablePath ?? chromium.executablePath(), viewport: options.viewport };
      const context = await browser.newContext({ viewport: options.viewport });
      // The fixtures are self-contained. Unintended resource access is blocked
      // and recorded, rather than fetching an external dependency for a pass.
      const blockedRequests = [];
      await context.route(/^https?:/, route => { blockedRequests.push(route.request().url()); return route.abort(); });
      const page = await context.newPage();
      const scan = (filename, suffix = 'initial', prepare = async () => {}, disabledRules = [], navigate = true) => record(`axe:${filename}:${suffix}`, '@axe-core/playwright', filename, 'config/axe.json', 'Rendered current state in the measured browser, viewport and WCAG tag set.', async entry => {
        if (navigate) await page.goto(pathToFileURL(path.join(fixture, filename)).href, { waitUntil: 'load' });
        await prepare();
        let builder = new AxeBuilder({ page }).withTags(options.tags);
        if (disabledRules.length) builder = builder.disableRules(disabledRules);
        const result = await builder.analyze();
        report.tools['axe-core'] = result.testEngine;
        const diagnostics = result.violations.map(violation => ({ path: entry.input.path, code: violation.id, severity: violation.impact, message: violation.help, helpUrl: violation.helpUrl, nodes: violation.nodes.map(node => ({ target: node.target, html: node.html, failureSummary: node.failureSummary })) }));
        entry.coverage.unexamined.push('Manual accessibility, keyboard task completion, other viewport sizes and unvisited states remain unexamined.');
        if (result.incomplete.length) entry.coverage.unexamined.push(...result.incomplete.map(rule => `axe needs review: ${rule.id}`));
        if (disabledRules.length) entry.coverage.unexamined.push(`Disabled rules: ${disabledRules.join(', ')}`);
        return { status: diagnostics.length ? 'findings' : result.incomplete.length || disabledRules.length ? 'partial' : 'checked', renderedState: { htmlSha256: hash(await page.content()), url: page.url() }, diagnostics, counts: { violations: result.violations.length, incomplete: result.incomplete.length, passes: result.passes.length, inapplicable: result.inapplicable.length }, disabledRules, raw: result };
      });
      const bad = await scan('html/bad.html');
      check('axe catches rendered unlabelled button and field', ['button-name', 'label'].every(code => bad.diagnostics.some(d => d.code === code)));
      const clean = await scan('html/clean.html');
      check('axe clean control has no violations or incomplete checks', clean.status === 'checked' && clean.counts.violations === 0 && clean.counts.incomplete === 0);
      const contrast = await scan('html/contrast-bad.html');
      check('axe measures the rendered contrast fault', contrast.diagnostics.some(d => d.code === 'color-contrast'));
      const incomplete = await scan('html/contrast-incomplete.html');
      check('axe exposes contrast needing review as incomplete', incomplete.counts?.incomplete > 0 && incomplete.raw.incomplete.some(rule => rule.id === 'color-contrast'));
      const disabled = await scan('html/contrast-bad.html', 'contrast-disabled', async () => {}, ['color-contrast']);
      check('Disabled axe contrast rule is partial, not a clean accessibility claim', disabled.status === 'partial' && disabled.counts.violations === 0);
      const hidden = await scan('html/revealed-state.html');
      hidden.coverage.unexamined.push('The details field is hidden and unexamined until the user opens it.');
      if (hidden.status === 'checked') hidden.status = 'partial';
      check('Initial scan does not cover the hidden faulty field', hidden.status === 'partial' && hidden.counts.violations === 0);
      const revealed = await scan('html/revealed-state.html', 'after-click', async () => {
        await page.getByRole('button', { name: 'Show details' }).click();
        await page.locator('#late-field').waitFor({ state: 'visible' });
      }, [], false);
      check('A real Playwright click reveals a newly detected label fault', revealed.diagnostics.some(d => d.code === 'label'));
      report.blockedRequests = blockedRequests;
      check('Rendered controls required no external resources', blockedRequests.length === 0);
      await context.close();
    } catch (error) {
      records.push({ id: 'axe:browser', tool: '@axe-core/playwright', status: 'unavailable', reason: error.message });
      unavailable.browser = error.message;
    } finally { await browser?.close(); }
    const missingBrowser = await record('axe:missing-browser', '@axe-core/playwright', null, null, 'Actual browser launch precondition.', async () => {
      const absent = await chromium.launch({ executablePath: path.join(fixture, 'does-not-exist-chromium'), headless: true });
      await absent.close();
      return { status: 'checked', diagnostics: [] };
    });
    check('Missing browser executable is unavailable', missingBrowser.status === 'unavailable' && missingBrowser.reason?.includes('does-not-exist-chromium'));
  } else records.push({ id: 'axe:dependency', tool: '@axe-core/playwright', status: 'unavailable', reason: unavailable.playwright ?? unavailable['@axe-core/playwright'] });

  if (unavailable.lock) records.push({ id: 'dependencies:lock', status: 'unavailable', reason: unavailable.lock });
  report.fixtureUnchanged = [...originalFiles].every(([name, sha256]) => hash(read(name)) === sha256);
  check('Fixture source and named configurations remain byte-identical', report.fixtureUnchanged);
  const failed = checks.filter(result => !result.passed);
  report.elapsedMs = Math.round((performance.now() - started) * 100) / 100;
  report.proof = { status: Object.keys(unavailable).length ? 'unavailable' : failed.length ? 'failed' : 'passed', passed: checks.length - failed.length, failed: failed.length };
  const text = `${JSON.stringify(report, null, 2)}\n`;
  if (output) writeFileSync(output, text);
  console.log(JSON.stringify({ ...report.proof, records: records.length, elapsedMs: report.elapsedMs, output, failedChecks: failed }, null, 2));
  if (!output) console.log(text);
  process.exitCode = report.proof.status === 'unavailable' ? 2 : report.proof.status === 'failed' ? 1 : 0;
}
