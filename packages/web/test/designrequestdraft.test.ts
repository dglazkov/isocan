import { describe, expect, it } from "vitest";
import { emptyCanvas, type Item } from "@isocan/core";
import type { DesignReceiptDraft } from "../src/lib/design-receipt-draft.ts";
import { readDesignReceiptDraft, receiptDraftChangedItems, receiptFromDraft } from "../src/lib/design-receipt-draft.ts";
import { readDesignFieldDraft, readPendingDesignIntent } from "../src/lib/design-request-draft.ts";
const ref = { home: "http://localhost:1234", canvasId: "prj_acme", itemId: "item_output", versionId: "ver_original", blobHash: "a".repeat(64) };
const draft: DesignReceiptDraft = { schemaVersion: 2, brief: { ...ref, itemId: "item_brief" }, epoch: 1, fidelity: "designed", delivery: "html-node", output: ref, context: [{ ...ref, itemId: "item_context" }], governing: { atItemId: ref.itemId, artifact: null, explicitNone: false }, repository: "", revision: "", buildId: "", runtimeUrl: "", status: "draft", limits: "Browser unavailable", critical: false, checks: [{ id: "check_browser", kind: "browser-task", result: "unavailable", coverage: "Not inspected", state: "Not inspected", tool: "None", toolVersion: "unavailable", width: "", height: "", evidence: [{ ...ref, itemId: "item_evidence" }] }] };
describe("conditional design drafts", () => {
  it("does not promote corrupt or ID-only evidence into a current-version report", () => {
    expect(readDesignReceiptDraft(JSON.stringify({ ...draft, checks: [null] }))).toBeNull();
    expect(readDesignReceiptDraft(JSON.stringify({ ...draft, checks: [{ ...draft.checks[0], evidence: [null] }] }))).toBeNull();
    expect(readDesignReceiptDraft(JSON.stringify({ ...draft, governing: { atItemId: null, artifact: {}, explicitNone: false } }))).toBeNull();
    expect(readDesignReceiptDraft(JSON.stringify({ outputId: ref.itemId, checks: [{ evidenceIds: ["item_evidence"] }] }))).toBeNull();
    expect(readDesignReceiptDraft(JSON.stringify(draft))).toEqual(draft);
  });
  it("serializes the captured output and evidence after a concurrent item edit", () => {
    const saved = readDesignReceiptDraft(JSON.stringify(draft))!;
    const canvas = emptyCanvas();
    expect(receiptDraftChangedItems(saved, canvas, ref.canvasId)).toEqual(["item_output", "item_evidence"]);
    const receipt = receiptFromDraft(saved, "request_acme", "receipt_acme");
    expect(receipt.output).toEqual({ kind: "canvas", artifact: ref });
    expect(receipt.checks[0]!.evidence).toEqual(draft.checks[0]!.evidence);
    expect(receipt.context).toEqual(draft.context);
    expect(receipt.governing).toEqual(draft.governing);
    expect(receipt.brief.versionId).toBe("ver_original");
  });
  it("keeps readable historical evidence after a newer evidence edit", () => {
    const canvas = emptyCanvas();
    const evidence = draft.checks[0]!.evidence[0]!;
    const stub = (id: string, currentVersionId: string) => ({ id, currentVersionId, versions: [{ id: ref.versionId, blobHash: ref.blobHash }] }) as Item;
    canvas.items[ref.itemId] = stub(ref.itemId, ref.versionId);
    canvas.items[evidence.itemId] = stub(evidence.itemId, "ver_new_evidence");
    expect(receiptDraftChangedItems(draft, canvas, ref.canvasId)).toEqual([]);
    expect(receiptFromDraft(draft, "request_acme", "receipt_acme").checks[0]!.evidence[0]!.versionId).toBe(ref.versionId);
    canvas.items[evidence.itemId]!.versions = [];
    expect(receiptDraftChangedItems(draft, canvas, ref.canvasId)).toEqual([evidence.itemId]);
  });
  it("requires real captured target governing and preserves field correction bases", () => {
    expect(() => receiptFromDraft({ ...draft, governing: null }, "request_acme", "receipt_acme")).toThrow(/output/);
    const field = { mode: "audience", text: "Acme receivers", factId: "", base: ref, epoch: 1, outputIds: [] };
    expect(readDesignFieldDraft(JSON.stringify(field))).toEqual(field);
    expect(readDesignFieldDraft(JSON.stringify({ ...field, base: {} }))).toBeNull();
    expect(readPendingDesignIntent(JSON.stringify({ opId: "op_acme", operation: { type: "design.request", action: { kind: "cancel", brief: ref, epoch: 1, versionId: "ver_cancel" } } }))?.operation.type).toBe("design.request");
    expect(readPendingDesignIntent(JSON.stringify({ opId: "op_acme", operation: { type: "design.receipt", receipt: { status: "ready" } } }))).toBeNull();
  });
});
