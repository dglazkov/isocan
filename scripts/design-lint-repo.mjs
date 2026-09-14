#!/usr/bin/env node
/** Optional repository-only adapter. Each invocation loads the project's real config in a fresh process. */
import { fork } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const MEASURED_TOOLS = { "@shadcn/lint": "0.1.0", eslint: "10.9.1", tailwindcss: "4.3.3", "@typescript-eslint/parser": "8.68.0" };
export const DESIGN_RULES = ["no-restyle", "no-raw-colors", "no-arbitrary-values", "no-inline-styles", "no-unknown-classes", "require-static-classes"];
const script = fileURLToPath(import.meta.url);
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const relative = (repo, file) => path.relative(repo, file).split(path.sep).join("/");
const inside = (repo, file) => { const rel = path.relative(repo, file); return rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel); };
const reason = (code, explanation) => ({ code, explanation });
const boundary = "The public plugin cannot enumerate every styling path: parent selectors, unreadable props spreads, imported dynamic values and plain CSS remain outside its ownership analysis. Zero findings is not complete design coverage.";

/** Keep ESLint's one-based UTF-16 source positions and exclusive end, without inventing an unknown span. */
export function normalizeDiagnostic(message, source, file, repo) {
  // ESLint removes a leading BOM before reporting positions and suggestion ranges.
  const bomLength = source.charCodeAt(0) === 0xfeff ? 1 : 0;
  const starts = [bomLength];
  for (let i = 0; i < source.length; i++) {
    const code = source.charCodeAt(i);
    if (code === 13) { if (source.charCodeAt(i + 1) === 10) i++; starts.push(i + 1); }
    else if (code === 10 || code === 0x2028 || code === 0x2029) starts.push(i + 1);
  }
  const point = (line, column) => { const l = Math.max(1, Math.min(starts.length, line || 1)); return { offset: Math.max(starts[l - 1], Math.min(source.length, starts[l - 1] + Math.max(0, (column || 1) - 1))), line: l, column: Math.max(1, column || 1) + (l === 1 ? bomLength : 0) }; };
  const start = message.line ? point(message.line, message.column) : null;
  const end = start ? message.endLine && message.endColumn ? point(message.endLine, message.endColumn) : start : null;
  return { code: message.ruleId ?? (message.fatal ? "eslint/parser-error" : "eslint/message"), ruleId: message.ruleId ?? null, severity: message.severity === 2 ? "error" : "warning", path: file,
    range: start ? { start, end } : null, actual: start && end ? source.slice(start.offset, end.offset) : "", explanation: repo ? message.message.replaceAll(repo, ".") : message.message,
    suggestions: (message.suggestions ?? []).map(suggestion => ({ description: suggestion.desc ?? suggestion.messageId ?? "Suggested edit", ...(suggestion.fix ? { edit: { range: suggestion.fix.range.map(offset => offset + bomLength), text: suggestion.fix.text } } : {}) })),
  };
}

/** Determine opt-in failure from evidence, never just the count of reported errors. */
export function repositoryAuditFails(report) { return !report.coverage.complete || report.files.some(file => file.status !== "audited" || file.diagnostics.length > 0); }

/** Pure argument parsing does not import project configuration or install packages. */
export function parseRepositoryArgs(argv) {
  const result = { repo: null, files: [], json: false, fail: false };
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    if (value === "--") { result.files.push(...argv.slice(i + 1)); break; }
    if (value === "--repo") { if (!argv[i + 1] || argv[i + 1].startsWith("--")) throw new Error("--repo needs a repository path."); result.repo = argv[++i]; }
    else if (value === "--json") result.json = true;
    else if (value === "--fail") result.fail = true;
    else if (value.startsWith("--")) throw new Error(`Unknown option ${value}.`);
    else result.files.push(value);
  }
  if (!result.repo || !result.files.length) throw new Error("Usage: node scripts/design-lint-repo.mjs --repo <project> [--json] [--fail] -- <file.tsx> ...");
  return result;
}

function packageInfo(local, name) {
  let file;
  try { file = local.resolve(`${name}/package.json`); }
  catch {
    let current = path.dirname(local.resolve(name));
    for (;;) {
      const candidate = path.join(current, "package.json");
      if (existsSync(candidate) && JSON.parse(readFileSync(candidate, "utf8")).name === name) { file = candidate; break; }
      const parent = path.dirname(current); if (parent === current) throw new Error(`Cannot identify ${name}.`); current = parent;
    }
  }
  return { version: JSON.parse(readFileSync(file, "utf8")).version, file };
}
function identity(repo, file) {
  const absolute = realpathSync(file);
  const bytes = readFileSync(absolute);
  return { path: relative(repo, absolute), sha256: sha(bytes), size: bytes.byteLength };
}

async function inspectRepository({ repo, files }) {
  const started = performance.now();
  const report = { adapter: "isocan-tailwind-repository", version: 1, repo, node: process.version, tools: {}, files: [], warnings: [], elapsedMs: 0,
    coverage: { complete: false, executed: false, executionMeaning: "All six configured rules completed without an observed unmet precondition. This does not assert a compiler invocation for every file or complete source/design coverage.", boundary, unexamined: [] }, configFingerprint: { transitive: false, explanation: "Hashes identify only the named files read for this report; arbitrary config imports, theme imports and environment inputs are not a transitive fingerprint." } };
  const rows = files.map(file => ({ path: relative(repo, path.resolve(repo, file)), status: "unavailable", input: null, diagnostics: [], config: { namedFiles: [], effectiveRules: {} }, project: null, coverage: { complete: false, executed: false, enabledRules: [], unexamined: [] } }));
  report.files = rows;
  const problemAll = (code, explanation) => { for (const row of rows) row.coverage.unexamined.push(reason(code, explanation)); };
  const local = createRequire(path.join(repo, "package.json"));
  let ESLint, pluginModule;
  try {
    for (const [name, measured] of Object.entries(MEASURED_TOOLS)) {
      try { const info = packageInfo(local, name); if (!inside(repo, realpathSync(info.file))) throw new Error("Dependency resolves outside --repo; select the repository/workspace root containing its installation."); report.tools[name] = { ...info, file: relative(repo, info.file), measured, matchesMeasured: info.version === measured }; }
      catch (error) { throw new Error(`Missing repository dependency ${name}: ${error.message}`); }
    }
    if (report.tools["@shadcn/lint"].version !== MEASURED_TOOLS["@shadcn/lint"] || !report.tools.tailwindcss.version.startsWith("4.")) throw new Error("This adapter requires the pinned @shadcn/lint 0.1.0 public API and Tailwind v4.");
    ({ ESLint } = local("eslint"));
    pluginModule = await import(pathToFileURL(local.resolve("@shadcn/lint")));
  } catch (error) { problemAll("dependencies-unavailable", error.message); report.elapsedMs = performance.now() - started; return report; }
  const eslint = new ESLint({ cwd: repo, fix: false, cache: false });
  const plugin = pluginModule.default;
  for (const row of rows) {
    const file = path.resolve(repo, row.path);
    try {
      if (!inside(repo, realpathSync(file))) throw new Error("A requested file resolves outside this repository.");
      if (!statSync(file).isFile()) throw new Error("Expected an explicit source file.");
      const bytes = readFileSync(file);
      const source = bytes.toString("utf8");
      if (!Buffer.from(source, "utf8").equals(bytes)) throw new Error("Source is not valid UTF-8; exact lint input identity cannot be established.");
      row.input = { path: row.path, sha256: sha(bytes), size: bytes.byteLength };
      if (!/\.(?:[cm]?[jt]sx?)$/i.test(file)) { row.status = "unsupported"; row.coverage.unexamined.push(reason("unsupported-input", "This measured adapter accepts JavaScript/TypeScript source. HTML and CSS require their own analyzers.")); continue; }
      const configFile = await eslint.findConfigFile(file);
      if (!configFile) { row.coverage.unexamined.push(reason("config-unavailable", "No repository ESLint configuration was found.")); continue; }
      row.config.namedFiles.push(identity(repo, configFile));
      if (await eslint.isPathIgnored(file)) { row.status = "ignored"; row.coverage.unexamined.push(reason("ignored-input", "The repository's ESLint configuration ignores this file; no rules were evaluated.")); continue; }
      const config = await eslint.calculateConfigForFile(file);
      if (!config) { row.status = "ignored"; row.coverage.unexamined.push(reason("unconfigured-input", "No repository ESLint configuration applies to this file.")); continue; }
      const namespaces = Object.entries(config.plugins ?? {}).filter(([, value]) => value === plugin || value?.meta?.name === "@shadcn/lint").map(([name]) => name);
      row.config.effectiveRules = config.rules ?? {};
      row.config.settings = JSON.parse(JSON.stringify(config.settings ?? {}, (_key, value) => typeof value === "function" ? "<function: not fingerprinted>" : value instanceof RegExp ? String(value) : value));
      row.config.parser = config.languageOptions?.parser?.meta ?? null;
      row.coverage.enabledRules = DESIGN_RULES.filter(rule => namespaces.some(prefix => { const setting = config.rules?.[`${prefix}/${rule}`]; const severity = Array.isArray(setting) ? setting[0] : setting; return severity === 1 || severity === 2 || severity === "warn" || severity === "error"; }));
      const missing = DESIGN_RULES.filter(rule => !row.coverage.enabledRules.includes(rule));
      if (missing.length) row.coverage.unexamined.push(reason("disabled-rules", `Required measured rules are not enabled: ${missing.join(", ")}. Existing project settings were preserved.`));
      if (Object.entries(report.tools).some(([, value]) => !value.matchesMeasured)) row.coverage.unexamined.push(reason("unmeasured-tool-version", "One or more installed tool versions differ from the measured fixture; results are experimental."));
      const metadata = pluginModule.project.projectFor(file);
      const theme = pluginModule.project.themeFileFor(file);
      const components = pluginModule.project.componentsFor(file);
      row.project = { api: "experimental @shadcn/lint 0.1.0 project API", root: metadata?.root ? relative(repo, metadata.root) : null, theme: theme ? relative(repo, theme) : null, componentsDir: components?.dir ? relative(repo, components.dir) : null, components: [] };
      const named = new Set([configFile, metadata?.file, theme].filter(Boolean));
      for (const name of ["package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock"]) if (existsSync(path.join(repo, name))) named.add(path.join(repo, name));
      const nearest = path.dirname(file);
      for (let dir = nearest; inside(repo, dir); dir = path.dirname(dir)) {
        for (const name of ["tsconfig.json", "jsconfig.json", "package.json"]) if (existsSync(path.join(dir, name))) named.add(path.join(dir, name));
        if (dir === repo) break;
      }
      for (const [name, component] of components?.files ?? []) {
        named.add(component);
        row.project.components.push({ name, path: relative(repo, component), variants: pluginModule.project.variantDefinitionsOf(component) });
      }
      row.config.namedFiles = [...named].map(name => identity(repo, name));
      if (!theme || !existsSync(theme)) row.coverage.unexamined.push(reason("theme-unavailable", "A readable project theme was not discovered; Tailwind fallback cannot establish theme coverage."));
      if (!components?.dir || !existsSync(components.dir)) row.coverage.unexamined.push(reason("components-unavailable", "The configured component directory could not be resolved; component ownership is unexamined."));
      const results = await eslint.lintText(source, { filePath: file });
      const result = results.find(one => realpathSync(one.filePath) === realpathSync(file));
      if (!result) throw new Error("ESLint returned no result for the requested file.");
      row.diagnostics = result.messages.map(message => normalizeDiagnostic(message, source, row.path, repo));
      if (result.fatalErrorCount) { row.status = "unavailable"; row.coverage.unexamined.push(reason("parser-failure", "ESLint could not parse this source; findings are not a completed design audit.")); }
      else row.status = "audited";
      if (result.suppressedMessages?.length) row.coverage.unexamined.push(reason("suppressed-findings", `${result.suppressedMessages.length} findings were suppressed by repository directives.`));
      row.suppressedDiagnostics = (result.suppressedMessages ?? []).map(message => normalizeDiagnostic(message, source, row.path, repo));
      if (source.includes("eslint-disable")) row.coverage.unexamined.push(reason("inline-rule-directive", "This source contains an ESLint disable directive; configured rule coverage may be narrower."));
      if (row.diagnostics.some(message => message.code.endsWith("/require-static-classes"))) row.coverage.unexamined.push(reason("dynamic-classes", "The upstream rule identified class values it cannot evaluate statically."));
      if (row.config.namedFiles.some(before => { try { return identity(repo, path.resolve(repo, before.path)).sha256 !== before.sha256; } catch { return true; } })) row.coverage.unexamined.push(reason("config-changed-during-audit", "A named config/theme/component input changed during analysis; capture a fresh report."));
      row.coverage.executed = row.status === "audited" && row.coverage.unexamined.length === 0;
      row.coverage.unexamined.push(reason("upstream-analysis-boundary", boundary));
    } catch (error) { row.status = "unavailable"; row.coverage.unexamined.push(reason("analysis-unavailable", error.message)); }
  }
  report.coverage.executed = rows.length > 0 && rows.every(row => row.coverage.executed);
  report.elapsedMs = performance.now() - started;
  return report;
}

/** A fresh child avoids the plugin's process-local theme/config caches after project edits. */
export async function auditRepository(options) {
  const repo = realpathSync(path.resolve(options.repo));
  if (!statSync(repo).isDirectory()) throw new Error("--repo must name a directory.");
  for (const file of options.files) if (!inside(repo, path.resolve(repo, file))) throw new Error("Source paths must stay inside --repo.");
  return new Promise((resolve, reject) => {
    const child = fork(script, ["--worker"], { cwd: repo, stdio: ["ignore", "pipe", "pipe", "ipc"], execArgv: [] });
    let output = "", payload;
    const capture = bytes => { output += bytes.toString(); if (output.length > 1_000_000) { child.kill(); reject(new Error("Project linter output exceeded the adapter limit.")); } };
    child.stdout.on("data", capture); child.stderr.on("data", capture);
    const timer = setTimeout(() => { child.kill(); reject(new Error("Project linter exceeded the 60-second adapter deadline.")); }, 60_000);
    child.on("message", message => { payload = message; });
    child.on("error", error => { clearTimeout(timer); reject(error); });
    child.on("exit", code => {
      clearTimeout(timer);
      if (code !== 0 || !payload) { reject(new Error(payload?.error ?? `Project linter exited ${code}: ${output.trim()}`)); return; }
      if (output.trim()) {
        payload.warnings.push(output.trim().replaceAll(repo, "."));
        payload.coverage.executed = false;
        for (const row of payload.files) { row.coverage.executed = false; row.coverage.unexamined.push(reason("upstream-warning", "The project config/plugin emitted output; inspect report.warnings for compiler fallback or discovery warnings.")); }
      }
      resolve(payload);
    });
    child.send({ repo, files: options.files });
  });
}

async function main() {
  if (process.argv[2] === "--worker" && process.send) {
    process.once("message", async options => { try { const report = await inspectRepository(options); process.send(report, () => process.exit(0)); } catch (error) { process.send({ error: error.message }, () => process.exit(1)); } });
    return;
  }
  try {
    const options = parseRepositoryArgs(process.argv.slice(2));
    const report = await auditRepository(options);
    if (options.json) console.log(JSON.stringify(report, null, 2));
    else {
      for (const file of report.files) { console.log(`${file.path}: ${file.status}, ${file.diagnostics.length} findings, ${file.coverage.executed ? "configured rules executed" : "execution incomplete"}`); for (const finding of file.diagnostics) console.log(`  ${finding.range?.start.line ?? "?"}:${finding.range?.start.column ?? "?"} ${finding.severity} ${finding.code}: ${finding.explanation}`); for (const item of file.coverage.unexamined) console.log(`  ${item.code}: ${item.explanation}`); }
      for (const warning of report.warnings) console.log(`Upstream output: ${warning}`);
    }
    if (options.fail && repositoryAuditFails(report)) process.exitCode = 2;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
if (process.argv[1] && path.resolve(process.argv[1]) === script) await main();
