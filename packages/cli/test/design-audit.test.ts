import { expect, it } from "vitest";
import { auditDesignSource, readCanvasDesignAudit, type DesignAuditReadPort } from "@isocan/api/design-audit";
import { designRepairCapture, printDesignAudit } from "../src/design-audit.ts";
import { auditContractDesign, auditDesign, auditFixture, auditHome } from "../../api/test/design-audit-fixture.ts";

it("human and JSON reports expose governing contract, active grants and unsupported rules", async () => {
  const html = '<button data-isocan-recipe="Button" data-isocan-treatment="compact" data-isocan-exception="hero-spacing" style="padding:16px;border-radius:8px">Acme</button>';
  const report = await auditDesignSource(html, auditContractDesign(), { label: "Acme.html", designLabel: "Acme DESIGN.md" });
  const lines: string[] = [];
  printDesignAudit(report, line => lines.push(line));
  expect(lines.join("\n")).toContain("Effective policy: allow (v1, supported)");
  expect(lines.join("\n")).toContain("Recipe Button: owns padding: {spacing.md}");
  expect(lines.join("\n")).toContain("Applied treatment compact (Button)");
  expect(lines.join("\n")).toContain('Acme #1 needs room for its "two-line" label.');
  expect(report).toMatchObject({ policy: { appliedExceptions: [{ name: "hero-spacing", reason: 'Acme #1 needs room for its "two-line" label.' }], appliedTreatments: [{ name: "compact" }] } });
  const unknown = await auditDesignSource(html, auditContractDesign("allow", { lint: { version: 99, future: null } }), { label: "Acme.html", designLabel: "Future DESIGN.md" });
  printDesignAudit(unknown, line => lines.push(line));
  expect(lines.join("\n")).toContain("unsupported; rules unexamined");
  expect(lines.join("\n")).toContain("Unsupported");
  expect(lines.join("\n")).toContain('"future":null');
});

it("the human report exposes candidate prerequisites, source gaps and empty coverage", async () => {
  const lines: string[] = [];
  const report = await auditDesignSource('<p style="padding:13px">Acme</p><link rel="stylesheet" href="https://acme.invalid/a.css">', auditDesign(), { label: "Acme.html", designLabel: "DESIGN.md" });
  printDesignAudit(report, line => lines.push(line));
  expect(lines.join("\n")).toContain("consider var(--space-md)");
  expect(lines.join("\n")).toContain("Include the governing CSS export");
  expect(lines.join("\n")).toContain("external-style  line 1:");
  const empty = await auditDesignSource("<p>Acme</p>", "# Acme", { label: "Acme.html", designLabel: "DESIGN.md" });
  printDesignAudit(empty, line => lines.push(line));
  expect(lines.join("\n")).toContain("No values were checked");
  expect(lines.join("\n")).toContain("Not governed: no tokens for");
});

it("repair captures bind the canvas, item, governing source, base and rule version", async () => {
  const { canvas, blobs } = auditFixture();
  const io: DesignAuditReadPort = { classifySource: async () => ({ kind: "ordinary" }), sourceSnapshot: async () => { throw new Error("No inherited read needed"); }, blobText: async (_id, hash) => blobs[hash]!, sourceBlobText: async () => { throw new Error("No inherited read needed"); } };
  const report = await readCanvasDesignAudit(io, { canvasId: "prj_dest", home: auditHome, canvas, itemIds: ["nested"] });
  expect(designRepairCapture(report, "prj_dest", "nested")).toMatchObject({ expectedVersionId: "ver_nested", expectedGoverning: { itemId: "design", versionId: "ver_design" }, expectedRuleVersion: report.ruleVersion });
  expect(() => designRepairCapture(report, "prj_other", "nested")).toThrow("supported completed audit");
  expect(() => designRepairCapture(report, "prj_dest", "outside")).toThrow("supported completed audit");
  expect(() => designRepairCapture({ ...report, items: report.items.map(item => ({ ...item, input: null })) }, "prj_dest", "nested")).toThrow("supported completed audit");
  const draft = await readCanvasDesignAudit(io, { canvasId: "prj_dest", home: auditHome, canvas, draft: { itemId: "nested", baseVersionId: "ver_opened", text: "<p>Acme draft</p>" } });
  expect(() => designRepairCapture(draft, "prj_dest", "nested")).toThrow("original target metadata/scope capture");
  expect(() => designRepairCapture({ ...draft, items: draft.items.map(item => ({ ...item, versionId: "ver_someone_else" })) }, "prj_dest", "nested")).toThrow("actual base version");
});
