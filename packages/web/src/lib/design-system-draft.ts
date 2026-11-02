import { isOpId, parseDesign, serializeDesign } from "@isocan/core";
import { parseDesignProjection, type DesignProjection } from "@isocan/api/design-system";
import { readDesignDirection, parseDesignDirection, withDesignDirection, type DesignDirection } from "@isocan/core/design-direction";

/** Editable fields permit incomplete prose; publication uses the stricter shared direction validator. */
export interface DirectionFields {
  stage: "provisional" | "accepted"; requestId: string; rationale: string; taskHierarchy: string;
  layout: string; density: string; typography: string; palettePurpose: string;
  treatments: Array<{ name: string; guidance: string; states: string }>;
}
/** A working document retains the original canvas source and any uncertain write identity across refresh. */
export interface DesignSystemDraft {
  schemaVersion: 1; projection: DesignProjection; text: string; direction: DirectionFields;
  mode: "document" | "direction";
  pending: { opId: string; versionId: string; mode: "document" | "direction"; refused: boolean } | null;
}

/** Lines remain authored text until an explicit direction save converts them to the canonical record. */
export function directionFields(direction?: DesignDirection): DirectionFields {
  return { stage: direction?.stage ?? "provisional", requestId: direction?.requestId ?? "", rationale: direction?.rationale ?? "", taskHierarchy: direction?.taskHierarchy.join("\n") ?? "", layout: direction?.layout ?? "", density: direction?.density ?? "", typography: direction?.typography ?? "", palettePurpose: direction?.palettePurpose ?? "", treatments: direction?.treatments.map((one) => ({ ...one, states: one.states.join(", ") })) ?? [{ name: "", guidance: "", states: "" }] };
}
/** Publication keeps stage, rationale and treatments together without inventing preference authorship. */
export function directionValue(fields: DirectionFields): DesignDirection {
  const lines = (text: string, separator = "\n") => text.split(separator).map((line) => line.trim()).filter(Boolean);
  const { requestId, ...rest } = fields;
  return parseDesignDirection({ ...rest, version: 1, ...(requestId.trim() ? { requestId: requestId.trim() } : {}), taskHierarchy: lines(fields.taskHierarchy), treatments: fields.treatments.map((one) => ({ ...one, states: lines(one.states, ",") })) });
}
/** Capture a document once; later current reads never silently replace this base. */
export function newDesignSystemDraft(projection: DesignProjection, mode: DesignSystemDraft["mode"]): DesignSystemDraft {
  const read = readDesignDirection(parseDesign(projection.baseText));
  return { schemaVersion: 1, projection, text: projection.baseText, mode, direction: directionFields(read.status === "valid" ? read.direction : undefined), pending: null };
}
/** Validate nested storage before rendering; callers preserve a corrupt original until explicit recovery. */
export async function readDesignSystemDraft(raw: string): Promise<DesignSystemDraft> {
  const value = JSON.parse(raw) as DesignSystemDraft, object = (v: unknown) => v !== null && typeof v === "object" && !Array.isArray(v);
  const string = (v: unknown) => typeof v === "string" && v.length <= 1024 * 1024;
  if (!object(value) || value.schemaVersion !== 1 || !string(value.text) || !["document", "direction"].includes(value.mode)) throw new Error("The saved working document is malformed.");
  const fields = value.direction;
  if (!object(fields) || !["provisional", "accepted"].includes(fields.stage) || ![fields.requestId, fields.rationale, fields.taskHierarchy, fields.layout, fields.density, fields.typography, fields.palettePurpose].every(string) || !Array.isArray(fields.treatments) || fields.treatments.length > 32 || fields.treatments.some((one) => !object(one) || ![one.name, one.guidance, one.states].every(string))) throw new Error("The saved direction fields are malformed.");
  const pending = value.pending;
  if (pending !== null && (!object(pending) || !isOpId(pending.opId) || typeof pending.versionId !== "string" || !pending.versionId || !["document", "direction"].includes(pending.mode) || typeof pending.refused !== "boolean" || pending.mode !== value.mode)) throw new Error("The saved retry identity is malformed.");
  return { ...value, projection: await parseDesignProjection(value.projection) };
}

/** Serialize the edited native document and drafted direction together, preserving unrelated prose and tokens. */
export function designSystemDraftText(draft: DesignSystemDraft): string {
  if (draft.mode === "document") return draft.text;
  const document = withDesignDirection(parseDesign(draft.text), directionValue(draft.direction));
  return serializeDesign(document.tokens, document.body);
}
/** Switching editors is explicit and validates the departing representation before replacing its fields. */
export function switchDesignSystemDraft(draft: DesignSystemDraft): DesignSystemDraft {
  if (draft.pending) throw new Error("Confirm or resolve the pending save before switching editors.");
  if (draft.mode === "direction") return { ...draft, mode: "document", text: designSystemDraftText(draft) };
  const doc = parseDesign(draft.text);
  if (doc.problems.length) throw new Error(`The working document cannot be read: ${doc.problems.join("; ")}`);
  const read = readDesignDirection(doc);
  if (read.status === "malformed") throw new Error(read.problems.join("; "));
  return { ...draft, mode: "direction", direction: directionFields(read.status === "valid" ? read.direction : undefined) };
}
