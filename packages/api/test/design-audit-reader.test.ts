import { describe, expect, it, vi } from "vitest";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import type { CanvasSnapshotResponse } from "@isocan/core";
import { auditDesignSource, designAuditFails, readCanvasDesignAudit, readDesignAuditAdvisory, readDesignSourceAudit, type DesignAuditReadPort } from "../src/design-audit-reader.ts";
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

  it("draft identity names checked bytes and the editor's older base rather than the current version", async () => {
    const { run, canvas, io } = fixture();
    const text = '<p style="padding:16px">Acme draft</p>';
    canvas.items.nested!.versions.push({ ...canvas.items.nested!.versions[0]!, id: "ver_newer", blobHash: "hash_newer" });
    canvas.items.nested!.currentVersionId = "ver_newer";
    const report = await run({ draft: { itemId: "nested", baseVersionId: "ver_nested", text, label: "buffer.html" } });
    expect(report.items[0]).toMatchObject({ status: "audited", versionId: "ver_nested", blobHash: null, input: { kind: "draft", baseVersionId: "ver_nested", label: "buffer.html", size: new TextEncoder().encode(text).byteLength }, offSystem: [], onSystem: 1 });
    expect(report.items[0]!.input?.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(io.blobText.mock.calls.map(([, hash]) => hash)).not.toContain("hash_newer");
    const changed = await run({ draft: { itemId: "nested", baseVersionId: "ver_nested", text: text + "x" } });
    expect(changed.items[0]!.input?.sha256).not.toBe(report.items[0]!.input?.sha256);
  });

  it("local and inherited-context file reports carry file identities without invented stored items", async () => {
    const { io, canvas } = fixture();
    const source = '<p style="padding:13px">Acme file</p>';
    const local = await auditDesignSource(source, auditDesign(), { label: "screen.html", designLabel: "DESIGN.md" });
    expect(local).toMatchObject({ status: "audited", input: { kind: "file" }, governing: { kind: "file", input: { kind: "file" } }, offSystem: [{ value: "13px" }] });
    expect(local).not.toHaveProperty("itemId");
    expect(local).not.toHaveProperty("blobHash");
    const inherited = await readDesignSourceAudit(io, { canvasId: "prj_dest", canvas, home: auditHome, text: source, label: "screen.html", atId: "outside" });
    expect(inherited).toMatchObject({ status: "audited", input: local.input, governing: { canvasId: "prj_library", itemId: "inherited" }, offSystem: [], onSystem: 1 });
  });

  it("opt-in failing exits include no checked values, omitted categories and unsupported styling", async () => {
    const check = (text: string, design = auditDesign()) => auditDesignSource(text, design, { label: "Acme.html", designLabel: "DESIGN.md" });
    expect(designAuditFails(await check('<p style="padding:16px">Acme</p>'))).toBe(false);
    expect(designAuditFails(await check('<p style="padding:13px">Acme</p>'))).toBe(true);
    expect(designAuditFails(await check('<p>Acme</p>'))).toBe(true);
    expect(designAuditFails(await check('<p style="padding:16px">Acme</p><link rel="stylesheet" href="https://acme.invalid/a.css">'))).toBe(true);
    expect(designAuditFails(await check('<p style="color:#112233">Acme</p>', '---\ncolors:\n  ink: "#112233"\n---'))).toBe(true);
    expect(await readDesignAuditAdvisory(async () => { throw new Error("synthetic read failure after save"); })).toEqual({ status: "unavailable", reason: "synthetic read failure after save" });
  });
});
