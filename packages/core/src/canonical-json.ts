/**
 * **One serialization for "the same value", whatever order its keys arrived in.**
 *
 * Arrays keep their order; object keys are sorted by UTF-16 code unit
 * (`Array.prototype.sort`'s default — no locale, so the bytes are the same on
 * every machine); everything else is `JSON.stringify` of the leaf. Two values
 * that differ only in key order serialize to the same string.
 *
 * It was written seven times — the design request, repair and decision intent
 * hashes, the partner plan's retry check, and the API's craft packet, review
 * and repair readers — before it lived here (cleanup DU-6). Some of those
 * strings are HASHED into ids that are already on disk (`designIntentHash`,
 * `designRepairIntentHash`, `designDecisionIntentHash`, a craft packet's
 * `packetId`), so the output is frozen, quirks included, and
 * `packages/core/test/canonical-json.test.ts` pins it byte for byte:
 *
 * - **`undefined` is not dropped.** A key whose value is `undefined` is written
 *   as the bare word `undefined`, and an `undefined` array element as nothing
 *   at all (`[,null]`) — neither is JSON, and both are what the hashes were
 *   computed over. A top-level `undefined` returns `undefined`, despite the
 *   signature, exactly as `JSON.stringify` does. Plain `JSON.stringify` would
 *   drop the key (or write `null`), so this is NOT a
 *   drop-in for a `JSON.stringify`-with-sorted-keys helper; the two helpers
 *   that have those semantics (`canvas-groups.ts`, the wireframe module's
 *   `sameStyle`) keep their own on purpose.
 * - **Any non-array object is walked by its own keys**, so `toJSON` is never
 *   consulted (a `Date` is `{}`); only plain data should go through it.
 */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return "{" + Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`).join(",") + "}";
  }
  return JSON.stringify(value);
}
