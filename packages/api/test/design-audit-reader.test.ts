import { describe, expect, it, vi } from "vitest";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import type { CanvasSnapshotResponse } from "@isocan/core";
import { readCanvasDesignAudit, type DesignAuditReadPort } from "../src/design-audit-reader.ts";
import { auditDesign, auditFixture, auditHome, auditItem } from "./design-audit-fixture.ts";

function fixture() {
  const data = auditFixture();
  const io = {
    classifySource: vi.fn<DesignAuditReadPort["classifySource"]>(async () => ({ kind: "ordinary" })),
    sourceSnapshot: vi.fn<DesignAuditReadPort["sourceSnapshot"]>(async () => ({ canvas: data.library, project: { id: "prj_library", title: "Acme Library" } }) as CanvasSnapshotResponse),
    blobText: vi.fn<DesignAuditReadPort["blobText"]>(async (_id, hash) => data.blobs[hash]!),
    sourceBlobText: vi.fn<DesignAuditReadPort["sourceBlobText"]>(async (_source, hash) => data.blobs[hash]!),
  };
  const run = (options = {}) => readCanvasDesignAudit(io, { canvasId: "prj_dest", home: auditHome, canvas: data.canvas, ...options });
  return { ...data, io, run };
}

describe("shared design audit reads", () => {
  it("audits nested group members and inherited outside screens against their actual systems", async () => {
    const { io, run } = fixture();
    const report = await run();
    expect(report).toMatchObject({ system: "Multiple design systems", screens: 2, audited: 2, unavailable: 0, offSystem: 1 });
    expect(report.items[0]).toMatchObject({ status: "audited", itemId: "nested", versionId: "ver_nested", blobHash: "hash_nested", governing: { itemId: "design", versionId: "ver_design", blobHash: "hash_design", canvasId: "prj_dest", inherited: false } });
    expect(report.items[1]).toMatchObject({ status: "audited", governing: { name: "Acme library", canvasId: "prj_library", itemId: "inherited", inherited: true }, offSystem: [], onSystem: 1 });
    const first = report.items[0]!;
    if (first.status !== "audited") throw new Error(first.reason);
    expect(first.diagnostics.map(one => one.code)).toEqual(["design/missing-variable", "design/off-scale-spacing"]);
    expect(io.sourceBlobText).toHaveBeenCalledWith({ canvasId: "prj_library", expectedHome: auditHome }, "hash_inherited", undefined);
    expect(io.blobText.mock.calls.map(([id]) => id)).not.toContain("prj_library");
  });

  it("scoped-only canvases need no global system or inherited read", async () => {
    const { canvas, io, run } = fixture();
    delete canvas.items.outside;
    expect(await run({ scopeId: "outer" })).toMatchObject({ system: "Acme lane", screens: 1, offSystem: 1 });
    expect(io.classifySource).not.toHaveBeenCalled();
    expect(io.sourceSnapshot).not.toHaveBeenCalled();
  });

  it("a nearer system replaces its ancestor rather than merging their allowed values", async () => {
    const { canvas, blobs, run } = fixture();
    const override = auditItem("override", "text/markdown", { role: "design-system" }, "inner");
    canvas.items.override = override;
    blobs.hash_override = auditDesign("Acme inner", "13px");
    const report = await run({ itemIds: ["nested"] });
    expect(report.items[0]).toMatchObject({ governing: { itemId: "override" }, offSystem: [], onSystem: 1 });
    blobs.hash_override = auditDesign("Acme inner", "24px");
    expect((await run({ itemIds: ["nested"] })).offSystem).toBe(1);
  });

  it("private or unavailable inherited sources never contribute bytes or a clean screen", async () => {
    const { io, run } = fixture();
    io.classifySource.mockResolvedValue({ kind: "personal" });
    const report = await run();
    expect(report).toMatchObject({ audited: 1, unavailable: 1, refusedSources: [{ canvasId: "prj_library", reason: expect.stringContaining("Personal") }] });
    expect(report.items[1]).toMatchObject({ status: "unavailable", governing: null, reason: expect.stringContaining("No readable design system") });
    expect(report.items[1]).not.toHaveProperty("onSystem");
    expect(io.sourceSnapshot).not.toHaveBeenCalled();
    expect(io.sourceBlobText).not.toHaveBeenCalled();
  });

  it("malformed governing documents, missing current versions and read failures remain unavailable", async () => {
    const { canvas, blobs, io, run } = fixture();
    blobs.hash_design = '---\nname: Acme\n\tcolors: bad\n---\n';
    expect((await run({ itemIds: ["nested"] })).items[0]).toMatchObject({ status: "unavailable", reason: expect.stringContaining("could not be parsed") });
    blobs.hash_design = auditDesign();
    canvas.items.nested!.currentVersionId = "ver_missing";
    expect((await run({ itemIds: ["nested"] })).items[0]).toMatchObject({ status: "unavailable", blobHash: null, versionId: "ver_missing" });
    io.sourceBlobText.mockRejectedValue(new Error("source policy changed"));
    expect((await run({ itemIds: ["outside"] })).items[0]).toMatchObject({ status: "unavailable", reason: "source policy changed", governing: { canvasId: "prj_library" } });
  });

  it("never audits a non-HTML source just because its visual face is HTML", async () => {
    const { canvas, run } = fixture();
    const dual = auditItem("dual", "text/javascript");
    dual.versions[0]!.visual = { blobHash: "hash_visual_html", mimeType: "text/html" };
    canvas.items.dual = dual;
    await expect(run({ itemIds: ["dual"] })).rejects.toThrow("not an HTML screen");
    expect((await run()).screens).toBe(2);
  });

  it("does not mistake cancellation for unavailable content or continue reading another item", async () => {
    const { io, run } = fixture();
    const control = new AbortController();
    io.sourceBlobText.mockImplementation(async () => { control.abort(new Error("selection changed")); return auditDesign(); });
    await expect(run({ itemIds: ["outside", "nested"], signal: control.signal })).rejects.toThrow("selection changed");
    expect(io.blobText).not.toHaveBeenCalled();
  });

  it("keeps parser and Node dependencies out of the shared entry's initial browser module", async () => {
    const entry = fileURLToPath(new URL("../src/design-audit-reader.ts", import.meta.url));
    const result = await build({ entryPoints: [entry], outdir: "/tmp/isocan-audit-bundle-test", bundle: true, platform: "browser", format: "esm", splitting: true, write: false, metafile: true });
    const first = Object.values(result.metafile!.outputs).find(output => output.entryPoint === "packages/api/src/design-audit-reader.ts")!;
    expect(first).toBeDefined();
    expect(Object.keys(first.inputs).some(input => /css-tree|parse5|designaudit\.ts/.test(input))).toBe(false);
    expect(Object.values(result.metafile!.outputs).some(output => Object.keys(output.inputs).some(input => /css-tree/.test(input)))).toBe(true);
  });
});
