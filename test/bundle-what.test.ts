import { describe, expect, it } from "vitest";
// @ts-expect-error — a plain .mjs script, imported for its one exported reader.
import { bytesBySource } from "../scripts/bundle-what.mjs";

/**
 * **The instrument reads the field it says it reads.**
 *
 * `bundle-what` attributes the entry chunk's shipped bytes to the source that
 * produced them, and for 17 days it walked `sources` by each segment's FOURTH
 * field — the original column — instead of its second. Nothing failed: it
 * printed a plausible table (core 51.5%, the canvas components under two per
 * cent), and a correct reading of the chunk was "corrected" to match it. A
 * bound nobody can look behind is a bound nobody can act on; an instrument
 * nobody checks is worse, because people act on it.
 *
 * So this builds a map by hand where the two readings disagree — every
 * segment's original column differs from its source step — and holds the
 * bytes to the sources that actually produced them.
 */
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function vlq(n: number): string {
  let v = n < 0 ? (-n << 1) | 1 : n << 1;
  let out = "";
  do {
    let digit = v & 31;
    v >>>= 5;
    if (v > 0) digit |= 32;
    out += B64[digit];
  } while (v > 0);
  return out;
}
const segment = (...fields: number[]) => fields.map(vlq).join("");

describe("bytesBySource", () => {
  it("attributes each run to the source named by the segment's SECOND field", () => {
    // One generated line: 10 bytes from acme.ts, then 30 from beta.ts, then 5 from acme.ts.
    const generated = "a".repeat(10) + "b".repeat(30) + "c".repeat(5);
    const mappings = [
      segment(0, 0, 0, 7), //  col 0 → source 0 (acme), original col 7
      segment(10, 1, 0, 13), // col 10 → source 1 (beta), original col +13
      segment(30, -1, 2, -19), // col 40 → source 0 again, original col −19
    ].join(",");
    const bytes = bytesBySource({ sources: ["src/acme.ts", "src/beta.ts"], mappings }, generated) as Map<string, number>;
    expect(Object.fromEntries(bytes)).toEqual({ "src/acme.ts": 15, "src/beta.ts": 30 });
  });

  it("carries the source index across lines, the way a map does", () => {
    const generated = "x".repeat(4) + "\n" + "y".repeat(6);
    const mappings = [segment(0, 1, 0, 0), segment(0, 0, 1, 3)].join(";");
    const bytes = bytesBySource({ sources: ["src/acme.ts", "src/beta.ts"], mappings }, generated) as Map<string, number>;
    // Line 2's segment moves the source by 0 from line 1's — still beta.
    expect(Object.fromEntries(bytes)).toEqual({ "src/beta.ts": 10 });
  });
});
