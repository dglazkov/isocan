#!/usr/bin/env node
/** Reproduce the pinned optional adapter on synthetic files, never on application dependencies. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditRepository, MEASURED_TOOLS, repositoryAuditFails } from "./design-lint-repo.mjs";

const argv = process.argv.slice(2), get = name => { const at = argv.indexOf(name); return at < 0 ? null : argv[at + 1]; };
const requested = get("--prefix"), output = get("--output");
if (!requested) throw new Error("Usage: node scripts/probe-tailwind-lint.mjs --prefix <scratch-fixture> [--install] [--output <results.json>]. --install requires a new path; omit it to replay an already prepared fixture.");
const prefix = path.resolve(requested), marker = path.join(prefix, ".isocan-design-lint-fixture.json");
const template = fileURLToPath(new URL("../test/fixtures/design-lint-tailwind", import.meta.url));
if (argv.includes("--install")) {
  if (existsSync(prefix)) throw new Error("--install refuses an existing path; choose a new scratch fixture directory.");
  cpSync(template, prefix, { recursive: true });
  renameSync(path.join(prefix, "eslint.config.mjs.fixture"), path.join(prefix, "eslint.config.mjs"));
  writeFileSync(marker, JSON.stringify({ fixture: "isocan-tailwind-lint-v1", created: new Date().toISOString() }));
  execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: prefix, stdio: ["ignore", "ignore", "inherit"] });
}
if (!existsSync(marker) || JSON.parse(readFileSync(marker, "utf8")).fixture !== "isocan-tailwind-lint-v1") throw new Error("The prefix is not a fixture prepared by this probe; no project files will be modified.");
const started = performance.now(), results = [];
const files = names => names.map(name => `apps/web/src/${name}`);
async function run(name, selected, verify, repo = prefix) {
  const report = await auditRepository({ repo, files: selected });
  verify(report);
  results.push({ name, report });
  return report;
}
const row = (report, name) => report.files.find(file => file.path.endsWith(`/${name}`));
const issue = (file, code) => file.coverage.unexamined.some(item => item.code === code);
const names = ["bad.tsx", "good.tsx", "fractional.tsx", "unicode.tsx", "bom.tsx", "line-terminators.tsx", "inline.tsx", "dynamic.tsx", "blind-spot.tsx", "disabled.tsx", "suppressed.tsx", "ignored.tsx", "malformed.tsx", "screen.html", "screen.css", "theme-change.tsx"];
const baseline = await run("repository config, custom components, monorepo barrel and controls", files(names), report => {
  const bad = row(report, "bad.tsx"), good = row(report, "good.tsx");
  assert.equal(bad.status, "audited"); assert.equal(bad.diagnostics.length, 5);
  assert.equal(bad.config.settings.shadcn.note, "Acme uses the existing component variants.");
  assert(bad.diagnostics.every(message => message.explanation.includes("Acme uses the existing component variants.")));
  assert(bad.diagnostics.some(message => message.code === "shadcn/no-restyle" && message.explanation.includes("sm, lg") && message.explanation.includes("packages/design/controls/button.tsx")));
  assert.equal(bad.project.componentsDir, "packages/design/controls");
  assert(bad.project.components[0].variants.some(value => value.source === "factory" && value.axes.size.join(",") === "sm,lg"));
  assert.equal(good.diagnostics.length, 0); assert.equal(good.coverage.executed, true); assert.equal(good.coverage.complete, false);
  assert.equal(row(report, "fractional.tsx").diagnostics.length, 0);
  const unicode = row(report, "unicode.tsx"), source = readFileSync(path.join(prefix, unicode.path), "utf8");
  assert(unicode.diagnostics.length > 0);
  assert.equal(unicode.input.sha256, createHash("sha256").update(source).digest("hex"));
  assert.equal(unicode.input.size, Buffer.byteLength(source));
  for (const diagnostic of unicode.diagnostics) { assert.equal(source.slice(diagnostic.range.start.offset, diagnostic.range.end.offset), diagnostic.actual); assert.equal(diagnostic.range.start.line, 4); assert(diagnostic.actual.includes("p-[13px]")); }
  const bom = row(report, "bom.tsx"), bomSource = readFileSync(path.join(prefix, bom.path), "utf8");
  assert.equal(bomSource.charCodeAt(0), 0xfeff);
  assert.equal(bom.input.sha256, createHash("sha256").update(bomSource).digest("hex"));
  assert.equal(bom.diagnostics.length, 2);
  assert.deepEqual(bom.diagnostics.map(diagnostic => diagnostic.range.start.line), [1, 3]);
  for (const diagnostic of bom.diagnostics) { assert.equal(diagnostic.actual, '"p-[13px]"'); assert.equal(bomSource.slice(diagnostic.range.start.offset, diagnostic.range.end.offset), diagnostic.actual); }
  const terminators = row(report, "line-terminators.tsx"), terminatorSource = readFileSync(path.join(prefix, terminators.path), "utf8");
  assert(terminatorSource.includes("\r") && terminatorSource.includes("\r\n") && terminatorSource.includes("\n") && terminatorSource.includes("\u2028") && terminatorSource.includes("\u2029"));
  assert.equal(terminators.input.sha256, createHash("sha256").update(terminatorSource).digest("hex"));
  assert.equal(terminators.diagnostics.length, 5);
  assert.deepEqual(terminators.diagnostics.map(diagnostic => diagnostic.range.start.line), [2, 3, 4, 5, 6]);
  for (const diagnostic of terminators.diagnostics) { assert.equal(diagnostic.actual, '"p-[13px]"'); assert.equal(terminatorSource.slice(diagnostic.range.start.offset, diagnostic.range.end.offset), diagnostic.actual); }
  assert(row(report, "inline.tsx").diagnostics.some(diagnostic => diagnostic.code === "shadcn/no-inline-styles" && diagnostic.severity === "warning"));
  assert(issue(row(report, "dynamic.tsx"), "dynamic-classes"));
  assert.equal(row(report, "blind-spot.tsx").diagnostics.length, 0); assert.equal(row(report, "blind-spot.tsx").coverage.complete, false); assert.equal(row(report, "blind-spot.tsx").coverage.executed, true);
  assert(issue(row(report, "disabled.tsx"), "disabled-rules")); assert.equal(row(report, "disabled.tsx").config.effectiveRules["shadcn/no-arbitrary-values"][0], 0);
  assert(issue(row(report, "suppressed.tsx"), "suppressed-findings")); assert(row(report, "suppressed.tsx").suppressedDiagnostics.length > 0);
  assert.equal(row(report, "ignored.tsx").status, "ignored");
  assert.equal(row(report, "malformed.tsx").status, "unavailable"); assert(issue(row(report, "malformed.tsx"), "parser-failure"));
  for (const name of ["screen.html", "screen.css"]) assert.equal(row(report, name).status, "unsupported");
  assert.equal(report.configFingerprint.transitive, false); assert.equal(report.warnings.length, 0);
});
const theme = path.join(prefix, "apps/web/src/theme.css"), originalTheme = readFileSync(theme, "utf8");
renameSync(theme, `${theme}.held`);
try { await run("absent theme is not compiler coverage", files(["good.tsx"]), report => { assert(issue(report.files[0], "theme-unavailable")); assert.equal(report.files[0].coverage.executed, false); }); }
finally { renameSync(`${theme}.held`, theme); }
writeFileSync(theme, '@import "acme-missing-theme";\n' + originalTheme);
try { await run("readable theme with broken import exposes real compiler fallback", files(["good.tsx"]), report => { assert(report.files[0].project.theme); assert(report.warnings.some(warning => /fallback|tailwind|cannot|resolve/i.test(warning))); assert(issue(report.files[0], "upstream-warning")); assert.equal(report.files[0].coverage.executed, false); }); }
finally { writeFileSync(theme, originalTheme); }
writeFileSync(theme, originalTheme + '\n@theme { --color-acme-new: #99aabb; }\n');
try { await run("fresh invocation observes a changed theme", files(["theme-change.tsx"]), report => { assert(row(baseline, "theme-change.tsx").diagnostics.length > 0); assert.equal(report.files[0].diagnostics.length, 0); const before = row(baseline, "theme-change.tsx").config.namedFiles.find(file => file.path.endsWith("/theme.css")); const after = report.files[0].config.namedFiles.find(file => file.path.endsWith("/theme.css")); assert.notEqual(before.sha256, after.sha256); }); }
finally { writeFileSync(theme, originalTheme); }
const config = path.join(prefix, "eslint.config.mjs"), originalConfig = readFileSync(config, "utf8");
renameSync(config, `${config}.held`);
try { await run("missing config cannot become clean", files(["good.tsx"]), report => { assert.equal(report.files[0].status, "unavailable"); assert.equal(report.files[0].coverage.executed, false); assert(report.files[0].coverage.unexamined.some(item => /config/i.test(item.explanation))); }); }
finally { renameSync(`${config}.held`, config); }
writeFileSync(config, originalConfig.replace('"shadcn/no-inline-styles": "warn"', '"shadcn/no-inline-styles": "off"'));
try { await run("fresh invocation preserves a changed project rule override", files(["inline.tsx"]), report => { assert.equal(report.files[0].config.effectiveRules["shadcn/no-inline-styles"][0], 0); assert(!report.files[0].diagnostics.some(diagnostic => diagnostic.code === "shadcn/no-inline-styles")); assert(issue(report.files[0], "disabled-rules")); }); }
finally { writeFileSync(config, originalConfig); }
const tailwind = path.join(prefix, "node_modules/tailwindcss"); renameSync(tailwind, `${tailwind}.held`);
try { await run("missing Tailwind dependency is unavailable", files(["good.tsx"]), report => { assert(issue(report.files[0], "dependencies-unavailable")); assert.equal(report.files[0].status, "unavailable"); }); }
finally { renameSync(`${tailwind}.held`, tailwind); }
const noDeps = `${prefix}-missing-dependencies`;
if (existsSync(noDeps)) throw new Error("Missing-dependency proof requires its own unused sibling path.");
mkdirSync(noDeps); writeFileSync(path.join(noDeps, "package.json"), '{"private":true}'); writeFileSync(path.join(noDeps, "acme.tsx"), '<p>Acme</p>');
try { await run("no installed tooling is unavailable", ["acme.tsx"], report => { assert(issue(report.files[0], "dependencies-unavailable")); assert.equal(report.files[0].status, "unavailable"); }, noDeps); }
finally { rmSync(noDeps, { recursive: true }); }
const requireFixture = createRequire(path.join(prefix, "package.json"));
const tailwindApi = requireFixture("tailwindcss");
const compiled = await tailwindApi.compile('@theme { --spacing: 0.25rem; }\n@tailwind utilities;');
const generated = compiled.build(["p-3.25"]);
assert(generated.includes("3.25") && generated.includes("--spacing"));
const own = createRequire(new URL("../package.json", import.meta.url)); own("tsx/esm/api").register();
const { auditScreen } = await import("../packages/core/src/designaudit.ts");
const discrete = auditScreen('<p style="padding:13px">Acme</p>', { spacing: { md: "16px" } });
assert(discrete.diagnostics.some(diagnostic => diagnostic.code === "design/off-scale-spacing"));
assert(repositoryAuditFails(baseline));
const summary = { fixtureVersion: 1, measuredTools: MEASURED_TOOLS, elapsedMs: performance.now() - started, results,
  scaleBoundary: { tailwindFindings: row(baseline, "fractional.tsx").diagnostics.length, generatedCss: generated, rootFontSizeAssumptionPx: 16, computedPaddingPx: 0.25 * 16 * 3.25, independentDiscreteAudit: discrete },
  verdict: { advisory: "go for the pinned JSX fixture using its own config", strictDesignGate: "no-go: the public plugin cannot enumerate all styling paths", knownUnreadableZero: "apps/web/src/blind-spot.tsx", reference: "https://github.com/shadcn-ui/lint/blob/53de86f0e7dcc341a9cb45c383a9f2c454d1e958/docs/how-it-works.md#what-it-cannot-see" },
};
if (output) writeFileSync(path.resolve(output), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ output: output ? path.resolve(output) : null, cases: results.length, baselineFiles: baseline.files.length, allAssertionsPassed: true, elapsedMs: summary.elapsedMs, verdict: summary.verdict }, null, 2));
