import { describe, expect, it } from "vitest";
import { canonicalJson } from "../src/index.ts";
import { designIntentHash, type DesignRecordOperation } from "../src/design-request.ts";

/**
 * **The seven private copies, frozen verbatim as they were before cleanup DU-6.**
 *
 * `canonicalJson` replaced every one of them. Several fed SHA-256 ids that are
 * already on disk (the design intent hashes, a craft packet's `packetId`), so
 * "the same algorithm" has to mean the same BYTES, and the only honest proof
 * of that is the old code run side by side with the new on the same values.
 */
type Serializer = (value: unknown) => string;
const former: Record<string, Serializer> = {
  "core/design-request-parse": function canonical(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
    if (value !== null && typeof value === "object") return "{" + Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",") + "}";
    return JSON.stringify(value);
  },
  "core/design-repair-parse": function canonical(value: unknown): string { return Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : value !== null && typeof value === "object" ? "{" + Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(",") + "}" : JSON.stringify(value); },
  "core/design-decision-parse": function canonical(value: unknown): string { if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`; if (value !== null && typeof value === "object") return "{" + Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",") + "}"; return JSON.stringify(value); },
  "api/design-review-reader": function designReviewSemantic(value: unknown): string { return Array.isArray(value) ? `[${value.map(designReviewSemantic).join(",")}]` : value && typeof value === "object" ? "{" + Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${designReviewSemantic((value as Record<string, unknown>)[k])}`).join(",") + "}" : JSON.stringify(value); },
  "api/design-craft-packet": function craftSemantic(value: unknown): string {
    if (Array.isArray(value)) return "[" + value.map(craftSemantic).join(",") + "]";
    if (value && typeof value === "object") return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + craftSemantic((value as Record<string, unknown>)[key])).join(",") + "}";
    return JSON.stringify(value);
  },
  "api/design-repair-reader": (a: unknown): string => {
    const stable = (v: unknown): string => Array.isArray(v) ? `[${v.map(stable).join(",")}]` : v && typeof v === "object" ? "{" + Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(",") + "}" : JSON.stringify(v);
    return stable(a);
  },
};
/** The one copy that sorted with `localeCompare`; it only ever fed an equality check. */
function formerPartnerPlan(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(formerPartnerPlan).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${formerPartnerPlan(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

const values: unknown[] = [
  null, true, false, 0, -1.5, 1e21, NaN, "", "héllo \"quoted\"\n ", undefined,
  [], {}, [1, "two", null, undefined, [3]],
  { b: 1, a: [{ d: undefined, c: "x" }], "10": "ten", "2": "two", Z: true, é: 1, "": 0 },
  { operation: { type: "design.request", action: { kind: "start", fields: { constraints: [], audience: null } } }, actorId: "usr_acme" },
  { nested: { deeper: { deepest: [{ z: 1, y: [2, { x: 3 }] }] } } },
];

describe("canonicalJson", () => {
  it("pins its bytes, quirks included", () => {
    expect(canonicalJson({ b: 1, a: [{ d: undefined, c: "x" }, null], "10": "ten", "2": 2, Z: true }))
      .toBe('{"10":"ten","2":2,"Z":true,"a":[{"c":"x","d":undefined},null],"b":1}');
    expect(canonicalJson([undefined, NaN])).toBe("[,null]");
    expect(canonicalJson(undefined)).toBe(undefined);
    expect(canonicalJson(new Date(0))).toBe("{}");
  });

  it("gives every former hash-bearing caller byte-identical output", () => {
    for (const [name, old] of Object.entries(former)) {
      for (const value of values) expect(canonicalJson(value), `${name} on ${String(JSON.stringify(value))}`).toBe(old(value));
    }
  });

  it("keeps a design intent hash that is already on disk", async () => {
    /* Computed with the private copy before it was removed. If this moves,
       every recorded design request marker stops matching its own intent. */
    const intent: DesignRecordOperation = { type: "design.request", action: { kind: "start", requestId: "req_acme", itemId: "itm_brief", versionId: "ver_brief", source: { entrance: "external-agent", externalRequestId: "native_acme" }, admission: "explicit", fields: { intent: "create", fidelity: "designed", delivery: "html-node", targetItemId: null, groupId: null, audience: null, primaryTask: "Receive inventory", constraints: [], facts: [], references: [], outstandingDecisionIds: [], outputIds: [] } } };
    expect(await designIntentHash(intent, "usr_acme")).toBe("5038410ee18cfa21f1d53098a7a189982f3793eb32667f2cf2382b57c2cb44a5");
  });

  it("gives the partner plan's retry check the same verdicts it gave", () => {
    /* The partner plan's copy sorted keys with localeCompare, so its BYTES
       differ for mixed-case keys ("Z" after "a"). It was only ever compared
       with itself, though — an identical retry against the stored response —
       and over the same key set any total order gives the same verdict. */
    const reordered = (value: unknown): unknown => Array.isArray(value) ? value.map(reordered) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).reverse().map(([k, v]) => [k, reordered(v)])) : value;
    for (const a of values) {
      for (const b of [...values, ...values.map(reordered)]) {
        expect(canonicalJson(a) === canonicalJson(b)).toBe(formerPartnerPlan(a) === formerPartnerPlan(b));
      }
    }
  });
});
