import { describe, expect, it } from "vitest";
import { parseDesign, serializeDesign } from "../src/designmd.ts";
import { toDtcg } from "../src/tokens.ts";
import { importDesign } from "../src/designimport.ts";
import { parseDesignDirection, readDesignDirection, withDesignDirection, type DesignDirection } from "../src/design-direction.ts";

const direction: DesignDirection = { version: 1, stage: "provisional", requestId: "request_acme", rationale: "Prioritize correcting stock while standing in the stockroom.", taskHierarchy: ["Receive stock", "Review the receipt", "Correct a quantity"], layout: "List beside a focused receipt form; stack on phones.", density: "Compact rows with deliberate touch controls.", typography: "Task heading, table labels and tabular quantities have distinct roles.", palettePurpose: "Green marks the save action; red marks invalid quantities.", treatments: [{ name: "Quantity control", guidance: "Use the existing labelled numeric field.", states: ["empty", "invalid", "edited", "saved"] }] };

describe("authored native direction", () => {
  it("preserves vendor data, lint contracts and prose through direction edits and native/DTCG roundtrips", () => {
    const vendor = { lint: { version: 1, literals: "allow", recipes: { Button: { owns: { padding: "{spacing.md}" } } } }, otherVendor: { enabled: true, nested: [null, "Acme #1", { untouched: false }] } };
    const original = parseDesign(serializeDesign({ name: "Acme inventory", spacing: { md: "12px" }, isocan: vendor }, "## Overview\n\nKeep the existing components.\n"));
    const revised = withDesignDirection(original, direction), saved = parseDesign(serializeDesign(revised.tokens, revised.body));
    expect(saved.body).toBe(original.body); expect(readDesignDirection(saved)).toEqual({ status: "valid", direction });
    expect(saved.tokens.isocan).toEqual({ ...vendor, direction }); expect(original.tokens.isocan).toEqual(vendor);
    const imported = importDesign(JSON.stringify(toDtcg(saved.tokens)));
    expect(imported.tokens.isocan).toEqual(saved.tokens.isocan);
    const accepted = withDesignDirection(saved, { ...direction, stage: "accepted" });
    expect(readDesignDirection(accepted)).toMatchObject({ status: "valid", direction: { stage: "accepted" } });
    expect(accepted.tokens.isocan).toEqual({ ...vendor, direction: { ...direction, stage: "accepted" } });
  });
  it("reports missing and malformed directions without inventing authenticated acceptance", () => {
    expect(readDesignDirection(parseDesign("# Acme"))).toEqual({ status: "absent" });
    const malformed = parseDesign(serializeDesign({ isocan: { direction: { ...direction, version: 2 } } }, ""));
    expect(readDesignDirection(malformed)).toMatchObject({ status: "malformed" });
    expect(() => withDesignDirection(malformed, direction)).toThrow(/repair the existing direction/);
    expect(() => parseDesignDirection({ ...direction, acceptedBy: "usr_person" })).toThrow(/unsupported fields/);
    expect(() => parseDesignDirection({ ...direction, treatments: [] })).toThrow(/between 1 and 32/);
  });
  it("refuses to replace an opaque scalar extension or write through an unparseable document", () => {
    const opaque = parseDesign(serializeDesign({ isocan: [true, null] }, ""));
    expect(() => withDesignDirection(opaque, direction)).toThrow(/preserving its data/);
    const broken = { ...parseDesign("# Acme"), problems: ["Unknown document construct"] };
    expect(() => withDesignDirection(broken, direction)).toThrow(/repair the existing document/);
  });
});
