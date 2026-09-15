/** Shape or association refusal; authentication remains the writer’s separate responsibility. */
export class DesignPartnerContractError extends Error {
  constructor(readonly code: "invalid" | "association" | "actor" | "stale" | "conflict", message: string) {
    super(message); this.name = "DesignPartnerContractError";
  }
}
/** Raises a schema error without implying custody or inspection. */
export const bad = (message: string): never => { throw new DesignPartnerContractError("invalid", message); };
/** Rejects unknown semantic fields before projecting a persisted record. */
export const object = (v: unknown, fields?: readonly string[]): Record<string, unknown> => {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return bad("Expected an object.");
  if (fields && Object.keys(v).some((key) => !fields.includes(key))) bad("Unknown field in design-partner record.");
  return v as Record<string, unknown>;
};
/** Common version and request keys used by each strict record parser. */
export const recordFields = ["schemaVersion", "requestId", "epoch", "kind"];
/** Requires bounded nonempty text for persisted identities and prose. */
export const text = (v: unknown): string => typeof v === "string" && v.trim().length > 0 && v.length <= 32000 ? v : bad("Expected nonempty bounded text.");
/** Rejects coercion of persisted booleans. */
export const bool = (v: unknown): boolean => typeof v === "boolean" ? v : bad("Expected a boolean.");
/** Requires a safe integral protocol value at the stated lower bound. */
export const integer = (v: unknown, min = 0): number => Number.isSafeInteger(v) && (v as number) >= min ? v as number : bad("Expected an integer in range.");
/** Accepts only explicitly supported semantic enum values. */
export const choice = <T extends string>(v: unknown, values: readonly T[]): T => values.includes(v as T) ? v as T : bad(`Expected one of ${values.join(", ")}.`);
/** Bounds persisted arrays and validates each entry. */
export const list = <T>(v: unknown, parse: (entry: unknown) => T, max = 1000): T[] => Array.isArray(v) && v.length <= max ? v.map(parse) : bad("Expected a bounded array.");
/** Requires at least one explicit entry for an answer or comparison. */
export const nonempty = <T>(items: T[]): T[] => items.length ? items : bad("Expected at least one entry.");
/** Rejects repeated identities within one persisted collection. */
export const unique = <T>(items: T[], key: (item: T) => string): T[] => new Set(items.map(key)).size === items.length ? items : bad("Repeated identity.");
/** Validates a bounded unique collection of textual identities. */
export const ids = (v: unknown): string[] => unique(list(v, text), (x) => x);
/** Preserves an explicit absent fact while validating provided text. */
export const nullableText = (v: unknown): string | null => v === null ? null : text(v);
/** Checks absolute HTTP(S) reference locations without fetching them. */
export const url = (v: unknown): string => {
  const value = text(v);
  let parsed: URL; try { parsed = new URL(value); } catch { return bad("Expected an absolute HTTP(S) URL."); }
  if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) bad("Expected an HTTP(S) URL without credentials.");
  return value;
};
/** Keeps presentation fidelity independent of request progress. */
export const fidelity = (v: unknown): "wireframe" | "designed" | "implementation" => choice(v, ["wireframe", "designed", "implementation"]);
/** Requires a lowercase SHA-256 content identity. */
export const hash = (v: unknown): string => typeof v === "string" && /^[a-f0-9]{64}$/.test(v) ? v : bad("Expected a lowercase SHA-256 blob identity.");
/** Validates common schema version, request identity and epoch. */
export function base(v: Record<string, unknown>): { schemaVersion: 1; requestId: string; epoch: number } {
  if (v.schemaVersion !== 1) bad("Unsupported design-partner schema version.");
  return { schemaVersion: 1, requestId: text(v.requestId), epoch: integer(v.epoch, 1) };
}
