import { describe, expect, it } from "vitest";
import { applyOperation, emptyCanvas, type Actor, type CanvasState, type ItemVersion, type OpEnvelope } from "../src/index.ts";
import { designIntentHash, parseDesignRequestOperation, type DesignRecordOperation } from "../src/design-request.ts";
import { validateDesignRecordEffect, validateDesignRecordVersion, type DesignRecordMarker } from "../src/design-record.ts";

const actor: Actor = { id: "usr_acme", name: "Acme builder" }, ts = "2026-01-01T00:00:00.000Z", hash = "a".repeat(64);
const intent = (): DesignRecordOperation => ({ type: "design.request", action: { kind: "start", requestId: "req_acme", itemId: "itm_brief", versionId: "ver_brief", source: { entrance: "external-agent", externalRequestId: "native_acme" }, admission: "explicit", fields: { intent: "create", fidelity: "designed", delivery: "html-node", targetItemId: null, groupId: null, audience: null, primaryTask: "Receive inventory", constraints: [], facts: [], references: [], outstandingDecisionIds: [], outputIds: [] } } });
const marker = (): DesignRecordMarker => ({ schemaVersion: 1, kind: "brief", requestId: "req_acme", epoch: 1, opId: "op_acme", intentHash: hash, retainedReferences: [] });
const version = (): ItemVersion => ({ id: "ver_brief", blobHash: hash, mimeType: "application/json", filename: "brief.json", size: 2, createdAt: ts, createdBy: actor, designRecord: marker() });
const state = (): CanvasState => ({ project: { id: "prj_acme", title: "Acme", description: "", properties: {}, createdAt: ts, createdBy: actor, updatedAt: ts, updatedBy: actor }, canvas: emptyCanvas() });
const envelope = (): OpEnvelope => ({ id: "op_acme", canvasId: "prj_acme", actor, ts, op: { ...intent(), effect: { type: "item.add", itemId: "itm_brief", title: "Design task", width: 200, height: 200, placement: { x: 0, y: 0 }, version: version() } } });

describe("design request wire and replay boundaries", () => {
  it("refuses unknown semantic fields and public canonical effects before accepting an intent", () => {
    expect(parseDesignRequestOperation(intent())).toEqual(intent());
    const op = intent();
    expect(() => parseDesignRequestOperation({ ...op, effect: {} })).toThrow(/Unknown field/);
    expect(() => parseDesignRequestOperation({ ...op, action: { ...op.type === "design.request" ? op.action : {}, futurePermission: true } })).toThrow(/Unknown field/);
    if (op.type === "design.request" && op.action.kind === "start") { const action = op.action; expect(() => parseDesignRequestOperation({ ...op, action: { ...action, fields: { ...action.fields, silentApproval: true } } })).toThrow(/Unknown field/); }
  });
  it("hashes exact validated semantic intent independently of property order but binds the original author", async () => {
    const op = intent();
    // Reverse every object, including keys in nested field/source records.
    const reverse = (value: unknown): unknown => Array.isArray(value) ? value.map(reverse) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reverse(item)])) : value;
    expect(await designIntentHash(reverse(op) as DesignRecordOperation, actor.id)).toBe(await designIntentHash(op, actor.id));
    expect(await designIntentHash(op, "usr_other")).not.toBe(await designIntentHash(op, actor.id));
    await expect(designIntentHash({ ...op, future: true } as unknown as DesignRecordOperation, actor.id)).rejects.toThrow(/Unknown field/);
  });
  it("accepts only its declared record effect and refuses a hidden unrelated content act", () => {
    const current = state(), valid = envelope();
    expect(applyOperation(current, valid)?.canvas.items.itm_brief?.versions[0]?.designRecord).toEqual(marker());
    const wrong = envelope(); if (wrong.op.type === "design.request" && wrong.op.effect?.type === "item.add") wrong.op.effect.itemId = "itm_other";
    expect(() => validateDesignRecordEffect(current, wrong)).toThrow(/disagrees/);
    const extra = envelope(); if (extra.op.type === "design.request" && extra.op.effect?.type === "item.add") extra.op.effect.version.designRecord!.epoch = 2;
    expect(() => applyOperation(current, extra)).toThrow(/disagrees/);
    const raw = envelope(); if (raw.op.type === "design.request" && raw.op.effect) raw.op = raw.op.effect;
    expect(() => applyOperation(current, raw)).toThrow(/canonical design operation/);
  });
  it("rejects recursive admission and malformed exact retention while preserving ordinary historical versions", () => {
    const retained = version(); delete retained.designRecord;
    const admitted = version(); admitted.designRecord!.retainedReferences = [{ artifact: { home: "https://example.test", canvasId: "prj_acme", itemId: "itm_reference", versionId: retained.id, blobHash: hash }, version: retained }];
    expect(() => validateDesignRecordVersion(admitted, "prj_acme")).not.toThrow();
    const nested = structuredClone(admitted); Object.assign(nested.designRecord!.retainedReferences[0]!.version, { designRecord: marker() });
    expect(() => validateDesignRecordVersion(nested, "prj_acme")).toThrow(/invalid canonical/);
    const wrong = structuredClone(admitted); wrong.designRecord!.retainedReferences[0]!.artifact.blobHash = "b".repeat(64);
    expect(() => validateDesignRecordVersion(wrong, "prj_acme")).toThrow(/invalid canonical/);
    const unknown = structuredClone(admitted); Object.assign(unknown.designRecord!.retainedReferences[0]!.artifact, { futurePermission: true });
    expect(() => validateDesignRecordVersion(unknown, "prj_acme")).toThrow(/invalid canonical/);
  });
});
