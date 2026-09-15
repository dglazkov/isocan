import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { parseDesign, serializeDesign } from "@isocan/core";
import { auditScreen } from "@isocan/core/design-audit";
import { readDesignDirection } from "@isocan/core/design-direction";
import { prepareDesignReconciliation, type DesignProjection } from "@isocan/api/design-system";
import { designRecipes, readDesignRecipe } from "@isocan/api/design-recipes";
import { designSystemDraftText, newDesignSystemDraft, readDesignSystemDraft, switchDesignSystemDraft } from "../src/lib/design-system-draft.ts";
const projection = (text: string): DesignProjection => {
  const hash = createHash("sha256").update(text).digest("hex");
  return { schemaVersion: 1, kind: "design-projection", source: { home: "http://localhost:1234", canvasId: "prj_acme", itemId: "item_design", versionId: "ver_original", blobHash: hash }, destination: { canvasId: "prj_acme", home: "http://localhost:1234", target: { kind: "canvas" } }, expectedMetadata: { title: "Acme design", properties: { role: "design-system" } }, filename: "DESIGN.md", mimeType: "text/markdown", baseText: text, baseHash: hash, exempt: false };
};
describe("working system documents", () => {
  it("preserves incomplete drafts, rejects nested corruption and authenticates original bytes", async () => {
    const draft = newDesignSystemDraft(projection((await readDesignRecipe("receiving")).design), "direction");
    draft.direction.rationale = "";
    expect(await readDesignSystemDraft(JSON.stringify(draft))).toEqual(draft);
    await expect(readDesignSystemDraft(JSON.stringify({ ...draft, direction: { ...draft.direction, treatments: [null] } }))).rejects.toThrow();
    await expect(readDesignSystemDraft(JSON.stringify({ ...draft, projection: { ...draft.projection, baseText: "changed" } }))).rejects.toThrow(/hash/);
    expect(() => designSystemDraftText(draft)).toThrow();
  });
  it("roundtrips edited direction, native tokens and prose across both editors and export", async () => {
    let draft = newDesignSystemDraft(projection((await readDesignRecipe("receiving")).design), "document");
    const native = parseDesign(draft.text); native.tokens.colors!.accent = "#123456";
    draft.text = serializeDesign(native.tokens, `${native.body}\n\nPreserve this authored rationale.`);
    draft = switchDesignSystemDraft(draft); draft.direction.stage = "accepted"; draft.direction.rationale = "Reuse the proven compact counting controls.";
    const exported = designSystemDraftText(draft), parsed = parseDesign(exported);
    expect(parsed.tokens.colors!.accent).toBe("#123456"); expect(parsed.body).toContain("Preserve this authored rationale.");
    expect(readDesignDirection(parsed)).toMatchObject({ status: "valid", direction: { stage: "accepted", rationale: draft.direction.rationale } });
    expect(switchDesignSystemDraft(draft).text).toBe(exported);
  });
  it("keeps an exact uncertain intent and refuses editor switches or known invalid preparation", async () => {
    const draft = newDesignSystemDraft(projection((await readDesignRecipe("receiving")).design), "document");
    draft.pending = { opId: "op_acme_retry", versionId: "ver_exact", mode: "document", refused: false };
    expect((await readDesignSystemDraft(JSON.stringify(draft))).pending).toEqual(draft.pending);
    expect(() => switchDesignSystemDraft(draft)).toThrow(/pending/);
    await expect(prepareDesignReconciliation({ projection: draft.projection, opId: "op_new_edit", versionId: "ver_next", text: "---\ninvalid: [\n---\n" })).rejects.toThrow();
  });
});
describe("native reference source contracts", () => {
  it.each(designRecipes())("$id declares its actual supported scale and contract", async ({ id }) => {
    const recipe = await readDesignRecipe(id), doc = parseDesign(recipe.design), audit = auditScreen(recipe.html, doc.tokens);
    expect(doc.problems).toEqual([]); expect(readDesignDirection(doc).status).toBe("valid"); expect(audit.diagnostics).toEqual([]);
    // Responsive cascade and dynamic state are deliberately not promoted into a source-only proof.
    expect(audit.coverage.unexamined.length).toBeGreaterThan(0);
  });
});

it("a saved reference add authenticates nested version bytes and actor scope before upload", async () => {
  const { readPendingDesignReference } = await import("../src/lib/design-reference-draft.ts");
  const text = "<h1>Acme reference</h1>", hash = createHash("sha256").update(text).digest("hex");
  const draft = { canvasId: "prj_acme", actorId: "person_acme", opId: "op_acme_reference", originGroupMode: "groups", text, refused: false, operation: { type: "item.add", itemId: "item_reference", title: "Acme reference", width: 600, height: 400, containerId: null, groupPlacement: "auto", placement: { x: 80, y: 80 }, version: { id: "ver_reference", filename: "reference.html", mimeType: "text/html", blobHash: hash, size: Buffer.byteLength(text) } } };
  expect(await readPendingDesignReference(JSON.stringify(draft), draft.canvasId, draft.actorId)).toEqual(draft);
  for (const value of [{ ...draft, text: "different" }, { ...draft, actorId: "person_other" }, { ...draft, operation: { ...draft.operation, version: null } }, { ...draft, operation: { ...draft.operation, placement: null } }]) await expect(readPendingDesignReference(JSON.stringify(value), draft.canvasId, draft.actorId)).rejects.toThrow();
});
