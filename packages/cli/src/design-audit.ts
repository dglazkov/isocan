import type { CanvasDesignAudit, DesignRepairRequest, ItemDesignAudit, SourceDesignAudit } from "@isocan/api/design-audit";

/** Human reports show the same findings, prerequisites and coverage gaps that JSON carries. */
export function printDesignAudit(report: CanvasDesignAudit | SourceDesignAudit, write: (line: string) => void = console.log): void {
  const rows: Array<ItemDesignAudit | SourceDesignAudit> = "items" in report ? report.items : [report];
  if ("items" in report) write(`${report.offSystem} off-system value${report.offSystem === 1 ? "" : "s"} across ${report.screens} screen${report.screens === 1 ? "" : "s"}, ${report.audited} audited${report.system ? ` against ${report.system}` : ""}`);
  for (const row of [...rows].sort((a, b) => (b.status === "audited" ? b.diagnostics.length : 0) - (a.status === "audited" ? a.diagnostics.length : 0))) {
    const title = "title" in row ? row.title : row.input.label;
    if (row.status === "unavailable") { write(`\n  ${title} — not audited: ${row.reason}`); continue; }
    write(`\n  ${title} — ${row.diagnostics.length} finding${row.diagnostics.length === 1 ? "" : "s"}, ${row.onSystem} on-system values`);
    const system = row.governing;
    if (system && "canvasId" in system) write(`    ${system.name}${system.inherited ? `, inherited from ${system.canvasId}` : ""} (${system.itemId}, ${system.versionId})`);
    else if (system && "input" in system) write(`    against ${system.input.label} (${system.input.sha256})`);
    for (const finding of row.diagnostics.slice(0, 8)) {
      write(`    ${finding.code}  line ${finding.range.start.line}:${finding.range.start.column}: ${finding.explanation}`);
      for (const candidate of finding.candidates.slice(0, 3)) {
        write(`      consider ${candidate.value} — ${candidate.explanation}`);
        for (const prerequisite of candidate.prerequisites) write(`        ${prerequisite}`);
      }
    }
    if (row.diagnostics.length > 8) write(`    …and ${row.diagnostics.length - 8} more`);
    if (!row.coverage.complete) {
      write(`    Coverage incomplete: ${row.coverage.unexamined.length} unexamined region${row.coverage.unexamined.length === 1 ? "" : "s"}`);
      for (const region of row.coverage.unexamined.slice(0, 4)) write(`      ${region.code}  line ${region.range.start.line}:${region.range.start.column}: ${region.explanation}`);
      if (row.coverage.unexamined.length > 4) write(`      …and ${row.coverage.unexamined.length - 4} more unexamined regions`);
    }
    if (row.coverage.omittedCategories.length) write(`    Not governed: no tokens for ${row.coverage.omittedCategories.join(", ")}`);
    if (row.coverage.checkedValues === 0) write("    No values were checked; this is not a passing conformance result.");
  }
  if ("refusedSources" in report) for (const source of report.refusedSources) write(`\n  Inheritance unavailable (${source.canvasId}): ${source.reason}`);
}

/** Require a concrete audit capture for the addressed item; unrelated or older shapes cannot authorize repair. */
export function designRepairCapture(value: unknown, canvasId: string, itemId: string): Pick<DesignRepairRequest, "expectedVersionId" | "expectedGoverning" | "expectedRuleVersion"> {
  if (!value || typeof value !== "object") throw new Error("--from-audit needs the JSON from design audit --item <item>.");
  const report = value as Partial<CanvasDesignAudit>;
  const item = Array.isArray(report.items) ? report.items.find(one => one?.itemId === itemId) : undefined;
  if (report.canvasId !== canvasId || !item || item.status !== "audited" || item.canvasId !== canvasId || !item.versionId || typeof report.ruleVersion !== "string" || item.ruleVersion !== report.ruleVersion || !item.input || !/^[a-f0-9]{64}$/.test(item.input.sha256)) throw new Error("The capture does not contain a supported completed audit of this canvas and item. Capture a fresh design audit --item report.");
  if ((item.input.kind !== "stored" && item.input.kind !== "draft") || (item.input.kind === "draft" && (item.input.baseVersionId !== item.versionId || item.blobHash !== null)) || (item.input.kind === "stored" && !item.blobHash)) throw new Error("The capture does not identify a stored screen or an editor draft's actual base version.");
  const governing = item.governing;
  if (!governing || [governing.canvasId, governing.itemId, governing.versionId, governing.blobHash].some(field => typeof field !== "string" || !field)) throw new Error("The capture has no complete governing-design identity.");
  return { expectedVersionId: item.versionId, expectedGoverning: governing, expectedRuleVersion: report.ruleVersion };
}
