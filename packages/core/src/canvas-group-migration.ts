import type { GroupAction, GroupBox, GroupChange, GroupFields, GroupLayout, GroupMigrationBoundary, GroupOperation, GroupStamp, GroupWrite } from "./canvas-group-types.ts";
import type { CanvasState, Item } from "./model.ts";
import { AREA_CARD_HEIGHT, AREA_INSET, AREA_TITLE_HEIGHT, areaGrid, areaInner, inArea, isArea } from "./area.ts";
import { annotationTarget } from "./annotation.ts";
import { applyGroupChange, captureGroupExpectations, groupContentBox, groupFitBox, groupFrameMinimum, validateGroupForest } from "./canvas-groups.ts";
import { GroupConflictError, OpValidationError } from "./errors.ts";

/** Every existing record is shown, including unchanged root items and legacy trash. */
interface MigrationItemRow {
  itemId: string;
  title: string;
  kindBefore: string | null;
  kindAfter: string | null;
  parentBefore: string | null;
  parentAfter: string | null;
  boxBefore: GroupBox;
  boxAfter: GroupBox;
  /** Only legacy trash gets this policy; no historical subtree is invented. */
  restorePolicy?: "frame-only" | "root";
}

/** One authoritative read describes the complete conversion before anyone confirms it. */
export interface CanvasGroupMigrationPreview {
  canvasId: string;
  revision: number;
  migrationVersion: 1;
  status: "ready" | "already-groups";
  fromMode: "legacy" | "groups";
  toMode: "groups";
  boundary: GroupMigrationBoundary | null;
  live: MigrationItemRow[];
  trash: MigrationItemRow[];
  ambiguities: Array<{ itemId: string; candidateIds: string[]; chosenId: string }>;
  danglingAnnotations: string[];
  repairs: Array<{ itemId: string; location: "live" | "trash"; boxBefore: GroupBox; boxAfter: GroupBox; reasons: string[] }>;
  history: { undoBoundarySeq: number | null; explanation: string };
}

const box = (item: GroupBox): GroupBox => ({ x: item.x, y: item.y, width: item.width, height: item.height });
const equal = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const rounded = (rect: GroupBox): GroupBox => Object.fromEntries(Object.entries(rect).map(([key, value]) => [key, Math.round(value * 1e6) / 1e6])) as unknown as GroupBox;
const row = (before: Item, after: Item): MigrationItemRow => ({ itemId: before.id, title: before.title, kindBefore: before.properties.kind ?? null, kindAfter: after.properties.kind ?? null, parentBefore: before.containerId ?? null, parentAfter: after.containerId ?? null, boxBefore: box(before), boxAfter: box(after) });

function groupFromArea(item: Item): Item {
  const grid = areaGrid(item);
  const layout: GroupLayout = { titleHeight: AREA_TITLE_HEIGHT, briefHeight: AREA_CARD_HEIGHT, inset: AREA_INSET, ...(grid ? { rowCount: grid.rows, columnCount: grid.cols, ...(grid.rowNames.length ? { rows: grid.rowNames } : {}), ...(grid.colNames.length ? { columns: grid.colNames } : {}) } : {}) };
  const next = { ...item, properties: { ...item.properties, kind: "group" }, groupLayout: layout };
  delete next.containerId;
  const legacy = areaInner(item), content = groupContentBox(next);
  const dx = legacy.x - content.x, dy = legacy.y - content.y;
  const minimum = groupFrameMinimum(next);
  return { ...next, ...rounded({ x: item.x + dx, y: item.y + dy, width: Math.max(item.width - dx, minimum.width), height: Math.max(item.height - dy, minimum.height) }) };
}

function plan(state: CanvasState, revision: number): { preview: CanvasGroupMigrationPreview; after: CanvasState } {
  if (!Number.isSafeInteger(revision) || revision < 0) throw new OpValidationError("bad-op", "migration needs an authoritative revision");
  validateGroupForest(state);
  const already = state.project.groupMode === "groups";
  const original = Object.values(state.canvas.items).sort((a, b) => a.id.localeCompare(b.id));
  const preview: CanvasGroupMigrationPreview = {
    canvasId: state.project.id, revision, migrationVersion: 1, status: already ? "already-groups" : "ready", fromMode: already ? "groups" : "legacy", toMode: "groups", boundary: state.project.groupMigration ?? null,
    live: [], trash: [], ambiguities: [], danglingAnnotations: [], repairs: [],
    history: { undoBoundarySeq: already ? state.project.groupMigration?.seq ?? null : revision + 1, explanation: already ? "This canvas already uses groups; no conversion will be written." : "Conversion is one undo boundary for every actor. Earlier Undo and Redo are refused without consuming history. Rollback requires the converted fields to be unchanged and no later group-dependent live, trash, Undo or Redo state." },
  };
  if (already) {
    preview.live = original.map((item) => row(item, item));
    preview.trash = state.canvas.trash.map(({ item, legacyGroupRestore }) => ({ ...row(item, item), ...(legacyGroupRestore ? { restorePolicy: legacyGroupRestore } : {}) }));
    return { preview, after: state };
  }
  const items = Object.fromEntries(original.map((item) => [item.id, isArea(item) ? groupFromArea(item) : { ...item }]));
  const areas = original.filter(isArea).sort((a, b) => a.width * a.height - b.width * b.height || a.id.localeCompare(b.id));
  for (const item of original) {
    if (isArea(item) || annotationTarget(item)) continue;
    const candidates = areas.filter((area) => inArea(area, item));
    if (candidates[0]) items[item.id]!.containerId = candidates[0].id;
    if (candidates.length > 1) preview.ambiguities.push({ itemId: item.id, candidateIds: candidates.map((area) => area.id), chosenId: candidates[0]!.id });
  }
  for (const item of original) {
    const targetId = annotationTarget(item); if (!targetId) continue;
    const target = items[targetId];
    if (target?.containerId) items[item.id]!.containerId = target.containerId;
    else delete items[item.id]!.containerId;
    if (!target) preview.danglingAnnotations.push(item.id);
  }
  const canvas = { ...state.canvas, items };
  for (const area of areas) items[area.id] = { ...items[area.id]!, ...rounded(groupFitBox(canvas, area.id, true)) };
  for (const item of original) {
    const converted = items[item.id]!;
    preview.live.push(row(item, converted));
    if (!equal(box(item), box(converted))) preview.repairs.push({ itemId: item.id, location: "live", boxBefore: box(item), boxAfter: box(converted), reasons: [...(areaGrid(item)?.rowNames.length || areaGrid(item)?.colNames.length ? ["Reserve named row and column label gutters"] : []), "Reserve header, item labels and attached-ink footprints"] });
  }
  const trash = state.canvas.trash.map((entry) => {
    const item = isArea(entry.item) ? groupFromArea(entry.item) : { ...entry.item };
    delete item.containerId;
    const restorePolicy = isArea(entry.item) ? "frame-only" as const : "root" as const;
    preview.trash.push({ ...row(entry.item, item), restorePolicy });
    if (annotationTarget(item) && !items[annotationTarget(item)!]) preview.danglingAnnotations.push(item.id);
    if (!equal(box(entry.item), box(item))) preview.repairs.push({ itemId: item.id, location: "trash", boxBefore: box(entry.item), boxAfter: box(item), reasons: ["Reserve header and named label gutters on this frame-only restore"] });
    return { ...entry, item, legacyGroupRestore: restorePolicy };
  });
  const after: CanvasState = { project: { ...state.project, groupMode: "groups" }, canvas: { ...canvas, trash } };
  validateGroupForest(after);
  return { preview, after };
}

/** The writer and both clients inspect the same complete deterministic conversion. */
export function canvasGroupMigrationPreview(state: CanvasState, revision: number): CanvasGroupMigrationPreview { return plan(state, revision).preview; }

/** Only a fresh authoritative revision can produce the bounded conversion record. */
export function resolveCanvasGroupMigration(state: CanvasState, revision: number, action: Extract<GroupAction, { kind: "migrate" }>, stamp: GroupStamp): GroupOperation {
  if (!action || typeof action !== "object" || Object.keys(action).some((key) => !["kind", "expectedRevision"].includes(key)) || action.kind !== "migrate" || !Number.isSafeInteger(action.expectedRevision) || action.expectedRevision < 0) throw new OpValidationError("bad-op", "migration needs only its expectedRevision");
  if (action.expectedRevision !== revision) throw new GroupConflictError("canvas changed since migration preview; preview the conversion again");
  const { preview, after } = plan(state, revision);
  if (preview.status !== "ready") throw new GroupConflictError("this canvas already uses groups; no conversion is needed");
  const ids = [...Object.keys(state.canvas.items), ...state.canvas.trash.map((entry) => entry.item.id)];
  const expected = captureGroupExpectations(state, ids);
  const writes: GroupWrite[] = [];
  for (const original of [...Object.values(state.canvas.items), ...state.canvas.trash.map((entry) => entry.item)]) {
    const live = !!state.canvas.items[original.id];
    const next = live ? after.canvas.items[original.id]! : after.canvas.trash.find((entry) => entry.item.id === original.id)!.item;
    const fields: GroupFields = {};
    for (const key of ["x", "y", "width", "height", "containerId", "groupLayout"] as const) if (!equal(original[key] ?? null, next[key] ?? null)) (fields as Record<string, unknown>)[key] = next[key] ?? null;
    const content = original.properties.kind !== next.properties.kind ? { properties: { kind: next.properties.kind! } } : undefined;
    if (content) expected.find((entry) => entry.itemId === original.id)!.content = { properties: { kind: original.properties.kind ?? null } };
    if (live && !Object.keys(fields).length && !content) continue;
    const patch = { itemId: original.id, fields, ...(content ? { content } : {}) };
    writes.push(live ? { kind: "patch", ...patch } : { kind: "patchTrash", ...patch, legacyGroupRestore: isArea(original) ? "frame-only" : "root" });
  }
  const change: GroupChange = { canvasId: state.project.id, intent: "migrate", schemaVersion: 4, expected, writes, migration: { expectedMode: "legacy", expectedBoundary: null, mode: "groups", boundary: { version: 1, opId: stamp.opId, seq: revision + 1 } } };
  applyGroupChange(state, change, stamp.actor, stamp.ts);
  return { type: "group.change", action: { kind: "apply", change } };
}
