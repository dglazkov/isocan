import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import type { Actor, PostOpResponse } from "@isocan/core";
import type { QuestionUploadDraft } from "../src/lib/questionnairedraft.ts";
const mocks = vi.hoisted(() => ({ snapshot: vi.fn(), post: vi.fn(), blob: vi.fn(), text: vi.fn(), upload: vi.fn(), home: vi.fn() }));
vi.mock("../src/lib/api.ts", () => ({ getSnapshot: mocks.snapshot, postOp: mocks.post, readBlob: mocks.blob, readBlobText: mocks.text, uploadBlob: mocks.upload }));
vi.mock("../src/lib/personal.ts", () => ({ authoritativeHome: mocks.home }));
vi.mock("../src/lib/groupplacement.ts", () => ({ creationDestination: () => ({ originGroupMode: "groups", containerId: "area" }) }));
vi.mock("../src/stores/canvasStore.ts", () => ({ useCanvasStore: { getState: () => ({ canvasId: "canvas", past: false }) } }));
vi.mock("../src/lib/capability.ts", () => ({ canEditNow: () => true }));
import { browserDesignBriefs, questionnaireIO, uploadQuestionReference } from "../src/lib/questionnaire.ts";
const bytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><text>Acme sketch</text></svg>');
const hash = createHash("sha256").update(bytes).digest("hex");
const actor: Actor = { id: "human", name: "Acme person" };
const attempt: QuestionUploadDraft = { id: "ref", fileKey: "bytes", name: "sketch.svg", mimeType: "image/svg+xml", size: bytes.byteLength, itemId: "item", versionId: "version", opId: "op", state: "waiting", destination: { originGroupMode: "groups", containerId: "area" } };
function accepted(op: unknown = { type: "group.change", action: { kind: "apply" } }): PostOpResponse {
  return { seq: 10, envelope: { id: "op", actor, canvasId: "canvas", op } } as PostOpResponse;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.home.mockResolvedValue("http://localhost:3000");
  mocks.upload.mockResolvedValue({ blobHash: hash, size: bytes.byteLength });
  mocks.blob.mockResolvedValue(new Blob([bytes]));
  mocks.post.mockResolvedValue(accepted());
  mocks.snapshot.mockResolvedValue({ canvas: { items: { item: { versions: [{ id: "version", blobHash: hash, size: bytes.byteLength, filename: "sketch.svg", mimeType: "image/svg+xml" }] } } } });
});
describe("questionnaire upload acceptance", () => {
  it("accepts group-normalized writes only after reading the exact resulting version and bytes", async () => {
    const checkpoint = vi.fn();
    const result = await uploadQuestionReference("canvas", actor, attempt, new Blob([bytes]), checkpoint);
    expect(result).toMatchObject({ id: "ref", state: "fetched", artifact: { itemId: "item", versionId: "version", blobHash: hash } });
    expect(checkpoint).toHaveBeenCalledWith({ blobHash: hash });
    expect(mocks.post).toHaveBeenCalledWith("canvas", actor, expect.objectContaining({ type: "item.add", containerId: "area", groupPlacement: "auto", itemId: "item", version: expect.objectContaining({ id: "version", blobHash: hash }) }), "op", undefined, "groups");
  });
  it("retries the same upload identities without uploading already acknowledged blob bytes twice", async () => {
    const retried = { ...attempt, blobHash: hash };
    await uploadQuestionReference("canvas", actor, retried, null, vi.fn());
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.post.mock.calls[0]![3]).toBe("op");
  });
  it("does not call a missing or different resulting item complete", async () => {
    mocks.snapshot.mockResolvedValue({ canvas: { items: {} } });
    await expect(uploadQuestionReference("canvas", actor, attempt, new Blob([bytes]), vi.fn())).rejects.toThrow("exact upload");
    expect(mocks.blob).not.toHaveBeenCalled();
  });
  it("rejects mismatched receipts and actual bytes", async () => {
    mocks.post.mockResolvedValue({ ...accepted(), envelope: { ...accepted().envelope, id: "other-op" } });
    await expect(uploadQuestionReference("canvas", actor, attempt, new Blob([bytes]), vi.fn())).rejects.toThrow("acknowledge");
    mocks.post.mockResolvedValue(accepted()); mocks.blob.mockResolvedValue(new Blob(["different"]));
    await expect(uploadQuestionReference("canvas", actor, attempt, new Blob([bytes]), vi.fn())).rejects.toThrow("did not match");
  });
  it.each([408, 500, 502, 503])("keeps HTTP %s uncertain rather than inventing refusal", async (status) => {
    mocks.post.mockRejectedValue(Object.assign(new Error("Synthetic lost receipt"), { status }));
    const result = await questionnaireIO(actor).send("canvas", { type: "questionnaire.answer" } as never, { opId: "same-op" });
    expect(result.status).toBe("pending");
  });
  it("reports a definitive writer conflict as refused", async () => {
    mocks.post.mockRejectedValue(Object.assign(new Error("Stale question"), { status: 409 }));
    expect((await questionnaireIO(actor).send("canvas", { type: "questionnaire.answer" } as never, { opId: "op" })).status).toBe("refused");
  });
});

describe("browser design brief discovery", () => {
  const jsonSnapshot = { canvas: { items: { data: { id: "data", title: "Acme data", currentVersionId: "data-v1", versions: [{ id: "data-v1", blobHash: "a".repeat(64), mimeType: "application/json" }] } } } };
  it("skips successfully read ordinary JSON without reporting a read failure", async () => {
    mocks.snapshot.mockResolvedValue(jsonSnapshot); mocks.text.mockResolvedValue('{"inventory": []}');
    await expect(browserDesignBriefs("canvas")).resolves.toEqual([]);
  });
  it("reports an actual blob-read failure rather than an empty brief catalogue", async () => {
    mocks.snapshot.mockResolvedValue(jsonSnapshot); mocks.text.mockRejectedValue(new Error("Synthetic unavailable blob"));
    await expect(browserDesignBriefs("canvas")).rejects.toThrow("Could not read Acme data");
  });
});
