import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { auditRepository, MEASURED_TOOLS, normalizeDiagnostic, parseRepositoryArgs, repositoryAuditFails } from "../scripts/design-lint-repo.mjs";

const scratch: string[] = [];
afterEach(() => { for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });
const emptyRepository = () => {
  const dir = mkdtempSync(path.join(tmpdir(), "isocan-repository-preflight-")); scratch.push(dir);
  writeFileSync(path.join(dir, "package.json"), '{"name":"acme-missing-linters","private":true}');
  writeFileSync(path.join(dir, "acme.tsx"), '<p>Acme</p>');
  return dir;
};

describe("standalone repository lint preflight", () => {
  it("parses explicit files while preserving project-relative arguments", () => {
    expect(parseRepositoryArgs(["--repo", "/tmp/acme", "--json", "--fail", "--", "src/acme.tsx", "src/second.jsx"])).toEqual({ repo: "/tmp/acme", json: true, fail: true, files: ["src/acme.tsx", "src/second.jsx"] });
  });
  it.each([[], ["--repo"], ["--repo", "/tmp/acme"], ["--repo", "/tmp/acme", "--fix", "acme.tsx"]])("rejects missing arguments or mutation flags: %j", args => {
    expect(() => parseRepositoryArgs(args)).toThrow();
  });
  it("reports absent real tooling without substituting mock plugins or installing anything", async () => {
    const repo = emptyRepository();
    const report = await auditRepository({ repo, files: ["acme.tsx"] });
    expect(report.files[0]).toMatchObject({ status: "unavailable", diagnostics: [], coverage: { complete: false, executed: false, unexamined: [{ code: "dependencies-unavailable" }] } });
    expect(report.coverage.complete).toBe(false);
    expect(repositoryAuditFails(report)).toBe(true);
    expect(readFileSync(path.join(repo, "package.json"), "utf8")).toBe('{"name":"acme-missing-linters","private":true}');
  });
  it("rejects source paths outside the selected repository before running configuration", async () => {
    await expect(auditRepository({ repo: emptyRepository(), files: ["../another-project.tsx"] })).rejects.toThrow("inside --repo");
  });
  it("does not call zero findings complete when source coverage remains unknown", () => {
    expect(repositoryAuditFails({ coverage: { complete: false, executed: true }, files: [{ status: "audited", diagnostics: [] }] })).toBe(true);
  });
});

describe("diagnostics retain actual source bytes and source coordinates", () => {
  it.each(["\r", "\n", "\r\n", "\u2028", "\u2029"])("maps ECMAScript line separator %j while retaining BOM and Unicode offsets", separator => {
    const first = '\uFEFFconst compass = "🧭";', second = '<Button className="p-[13px]" />';
    const source = first + separator + second, actual = '"p-[13px]"';
    const column = second.indexOf(actual) + 1, start = source.indexOf(actual);
    const finding = normalizeDiagnostic({ ruleId: "shadcn/no-arbitrary-values", severity: 2, message: "Use a scale", line: 2, column, endLine: 2, endColumn: column + actual.length, suggestions: [{ desc: "Use a token", fix: { range: [start - 1, start - 1 + actual.length], text: '"p-4"' } }] }, source, "line-terminators.tsx");
    expect(finding.actual).toBe(actual);
    expect(finding.range).toEqual({ start: { offset: start, line: 2, column }, end: { offset: start + actual.length, line: 2, column: column + actual.length } });
    expect(finding.suggestions[0].edit).toEqual({ range: [start, start + actual.length], text: '"p-4"' });
  });
  it("maps UTF-16 offsets over Unicode and CRLF without treating bytes as columns", () => {
    const source = 'const compass = "🧭";\r\n<Button className="p-[13px]" />';
    const actual = '"p-[13px]"', start = source.indexOf(actual), lineStart = source.indexOf("\n") + 1;
    const finding = normalizeDiagnostic({ ruleId: "shadcn/no-arbitrary-values", severity: 2, message: "Use a scale", line: 2, column: start - lineStart + 1, endLine: 2, endColumn: start - lineStart + actual.length + 1 }, source, "apps/web/src/acme.tsx");
    expect(finding).toMatchObject({ path: "apps/web/src/acme.tsx", actual, severity: "error", range: { start: { offset: start, line: 2 }, end: { offset: start + actual.length } } });
  });
  it("normalizes explanatory paths without modifying source or suggestion text containing the same path", () => {
    const repo = "/tmp/acme", source = '"/tmp/acme/source"';
    const finding = normalizeDiagnostic({ ruleId: "acme/rule", severity: 1, message: "See /tmp/acme/controls.tsx", line: 1, column: 1, endLine: 1, endColumn: source.length + 1, suggestions: [{ desc: "Use another value", fix: { range: [0, source.length], text: '"/tmp/acme/updated"' } }] }, source, "source.tsx", repo);
    expect(finding.actual).toBe(source);
    expect(finding.suggestions[0].edit.text).toBe('"/tmp/acme/updated"');
    expect(finding.explanation).toBe("See ./controls.tsx");
    expect(finding.severity).toBe("warning");
  });
  it("keeps a point when ESLint did not supply an end range", () => {
    const finding = normalizeDiagnostic({ fatal: true, severity: 2, message: "Unexpected token", line: 1, column: 3 }, "Acme", "acme.tsx");
    expect(finding.range.start.offset).toBe(2);
    expect(finding.range.end.offset).toBe(2);
    expect(finding.actual).toBe("");
    expect(finding.code).toBe("eslint/parser-error");
  });
  it.each([1, 2])("maps BOM-stripped ESLint positions and suggestions back to original line %i", line => {
    const source = '\uFEFF<Button className="p-[13px]" />\r\n<Button className="p-[13px]" />';
    const actual = '"p-[13px]"', start = line === 1 ? source.indexOf(actual) : source.lastIndexOf(actual);
    const stripped = source.slice(1), lintStart = start - 1;
    const lineStart = line === 1 ? 0 : stripped.indexOf("\n") + 1;
    const finding = normalizeDiagnostic({ ruleId: "shadcn/no-arbitrary-values", severity: 2, message: "Use a scale", line, column: lintStart - lineStart + 1, endLine: line, endColumn: lintStart - lineStart + actual.length + 1, suggestions: [{ desc: "Use a token", fix: { range: [lintStart, lintStart + actual.length], text: '"p-4"' } }] }, source, "bom.tsx");
    expect(finding.actual).toBe(actual);
    expect(finding.range).toEqual({ start: { offset: start, line, column: start - (line === 1 ? 0 : source.indexOf("\n") + 1) + 1 }, end: { offset: start + actual.length, line, column: start - (line === 1 ? 0 : source.indexOf("\n") + 1) + actual.length + 1 } });
    expect(finding.suggestions[0].edit).toEqual({ range: [start, start + actual.length], text: '"p-4"' });
    const [from, to] = finding.suggestions[0].edit.range;
    expect(source.slice(0, from) + finding.suggestions[0].edit.text + source.slice(to)).toBe(source.slice(0, start) + '"p-4"' + source.slice(start + actual.length));
  });
});

it("the optional fixture pins measured packages in a portable lockfile", () => {
  const manifest = JSON.parse(readFileSync(new URL("./fixtures/design-lint-tailwind/package.json", import.meta.url), "utf8"));
  const lock = JSON.parse(readFileSync(new URL("./fixtures/design-lint-tailwind/package-lock.json", import.meta.url), "utf8"));
  expect(manifest.devDependencies).toMatchObject(MEASURED_TOOLS);
  expect(Object.keys(lock.packages).every(key => !key.startsWith("/") && !key.split("/").includes(".."))).toBe(true);
  for (const [name, version] of Object.entries(MEASURED_TOOLS)) expect(lock.packages[`node_modules/${name}`].version).toBe(version);
});
