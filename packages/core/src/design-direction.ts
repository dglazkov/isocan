import { assertJsonCompatible, type DesignDoc } from "./designmd.ts";

/** Authored direction documents reusable decisions; its declared stage does not authenticate a human preference. */
export interface DesignDirection {
  version: 1;
  stage: "provisional" | "accepted";
  requestId?: string;
  rationale: string;
  taskHierarchy: string[];
  layout: string;
  density: string;
  typography: string;
  palettePurpose: string;
  treatments: Array<{ name: string; guidance: string; states: string[] }>;
}
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const fail = (message: string): never => { throw new Error(`Design direction: ${message}`); };
const text = (value: unknown, field: string): string => typeof value === "string" && value.trim().length > 0 && value.length <= 8000 ? value : fail(`${field} needs bounded nonempty text.`);
function strings(value: unknown, field: string, limit: number): string[] {
  if (!Array.isArray(value) || !value.length || value.length > limit) fail(`${field} needs between 1 and ${limit} entries.`);
  return (value as unknown[]).map((entry) => text(entry, field));
}
function fields(value: unknown, names: string[], label: string): Record<string, unknown> {
  if (!object(value) || Object.keys(value).some((key) => !names.includes(key))) fail(`${label} contains unsupported fields or is not an object.`);
  return value as Record<string, unknown>;
}
/** Unknown direction versions or fields are refused instead of being mistaken for supported design guidance. */
export function parseDesignDirection(value: unknown): DesignDirection {
  assertJsonCompatible(value, "isocan.direction");
  const v = fields(value, ["version", "stage", "requestId", "rationale", "taskHierarchy", "layout", "density", "typography", "palettePurpose", "treatments"], "record");
  if (v.version !== 1 || !["provisional", "accepted"].includes(v.stage as string)) fail("unsupported version or stage.");
  if (!Array.isArray(v.treatments) || !v.treatments.length || v.treatments.length > 32) fail("treatments needs between 1 and 32 entries.");
  const treatments = (v.treatments as unknown[]).map((entry) => {
    const t = fields(entry, ["name", "guidance", "states"], "treatment");
    return { name: text(t.name, "treatment name"), guidance: text(t.guidance, "treatment guidance"), states: strings(t.states, "treatment states", 32) };
  });
  if (new Set(treatments.map((t) => t.name)).size !== treatments.length) fail("treatment names must be distinct.");
  return { version: 1, stage: v.stage as DesignDirection["stage"], ...(v.requestId === undefined ? {} : { requestId: text(v.requestId, "requestId") }), rationale: text(v.rationale, "rationale"), taskHierarchy: strings(v.taskHierarchy, "taskHierarchy", 32), layout: text(v.layout, "layout"), density: text(v.density, "density"), typography: text(v.typography, "typography"), palettePurpose: text(v.palettePurpose, "palettePurpose"), treatments };
}
/** Reading never upgrades a malformed or agent-authored declaration into an accepted human decision. */
export function readDesignDirection(doc: DesignDoc): { status: "absent" } | { status: "valid"; direction: DesignDirection } | { status: "malformed"; problems: string[] } {
  if (doc.problems.length) return { status: "malformed", problems: [...doc.problems] };
  const vendor = doc.tokens.isocan;
  if (vendor === undefined) return { status: "absent" };
  if (!object(vendor)) return { status: "malformed", problems: ["The isocan extension is not an object."] };
  if (vendor.direction === undefined) return { status: "absent" };
  try { return { status: "valid", direction: parseDesignDirection(vendor.direction) }; }
  catch (error) { return { status: "malformed", problems: [error instanceof Error ? error.message : String(error)] }; }
}
/** Updates only the native direction extension; lint contracts, opaque sibling data and document prose survive. */
export function withDesignDirection(doc: DesignDoc, direction: DesignDirection): DesignDoc {
  if (doc.problems.length) fail(`repair the existing document before editing: ${doc.problems.join("; ")}`);
  const vendor = doc.tokens.isocan;
  if (vendor !== undefined && !object(vendor)) fail("cannot replace a non-object isocan extension while preserving its data.");
  const prior = readDesignDirection(doc);
  if (prior.status === "malformed") fail(`repair the existing direction before editing: ${prior.problems.join("; ")}`);
  if (vendor !== undefined) assertJsonCompatible(vendor);
  return { ...doc, tokens: { ...doc.tokens, isocan: { ...vendor as Record<string, unknown> | undefined, direction: parseDesignDirection(direction) } } };
}
