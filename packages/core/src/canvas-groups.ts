import type { Actor, CanvasContents, CanvasState, Item, TrashEntry } from "./model.ts";
import type { GroupAction, GroupAnchor, GroupBox, GroupChange, GroupExpectation, GroupFacts, GroupFields, GroupLayout, GroupOperation, GroupStamp, GroupWrite } from "./canvas-group-types.ts";
import { annotationTarget, annotationsOf } from "./annotation.ts";
import { isDrawingItem } from "./drawing.ts";
import { GroupConflictError, OpValidationError } from "./errors.ts";
import { PLACEMENT_GAP } from "./placement.ts";
import type { Operation } from "./ops.ts";

const GROUP_KIND = "group";
const GROUP_LIMIT = 10000;
const GROUP_MIN_SIZE = { width: 160, height: 160 };
/** Empty frames have one shared initial size on the CLI and browser shelf. */
export const GROUP_DEFAULT_SIZE = { width: 1600, height: 1000 };
const GROUP_LABEL_HEIGHT = 24;
const fields = ["x", "y", "width", "height", "containerId", "groupLayout"] as const;
const own = (value: object, key: PropertyKey): boolean => Object.prototype.hasOwnProperty.call(value, key);
const sorted = (ids: Iterable<string>): string[] => [...new Set(ids)].sort();
const round = (n: number): number => Math.round(n * 1e6) / 1e6;
function fail(message: string): never { throw new OpValidationError("bad-op", `canvas group: ${message}`); }
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const equal = (a: unknown, b: unknown): boolean => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (record(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}
function idList(ids: unknown, allowEmpty = false): asserts ids is string[] {
  if (!Array.isArray(ids) || ids.length > GROUP_LIMIT || (!allowEmpty && ids.length === 0) || ids.some((id) => typeof id !== "string" || !id) || new Set(ids).size !== ids.length) fail("expected unique item IDs within the operation limit");
}
function exactKeys(value: unknown, keys: readonly string[], label: string): asserts value is Record<string, unknown> {
  if (!record(value) || Object.keys(value).some((key) => !keys.includes(key))) fail(`invalid ${label} fields`);
}
function boxOf(item: GroupBox): GroupBox { return { x: item.x, y: item.y, width: item.width, height: item.height }; }
function validBox(box: unknown): asserts box is GroupBox {
  if (!record(box) || ["x", "y", "width", "height"].some((key) => typeof box[key] !== "number" || !Number.isFinite(box[key])) || Number(box.width) <= 0 || Number(box.height) <= 0) fail("a box needs finite coordinates and positive dimensions");
}
function requestBox(box: unknown): asserts box is GroupBox { exactKeys(box, ["x", "y", "width", "height"], "box"); validBox(box); }
function validProperties(value: unknown): void {
  if (!record(value) || Object.values(value).some((property) => typeof property !== "string")) fail("properties must be a string-valued object");
}
function validVisual(value: unknown): void {
  exactKeys(value, ["blobHash", "mimeType", "filename", "size"], "visual face");
  if (typeof value.blobHash !== "string" || !value.blobHash || typeof value.mimeType !== "string" || !value.mimeType) fail("visual face needs a content hash and MIME type");
  if (own(value, "filename") && typeof value.filename !== "string") fail("invalid visual filename");
  if (own(value, "size") && (typeof value.size !== "number" || !Number.isFinite(value.size) || value.size < 0)) fail("invalid visual size");
}
function validLayout(layout: unknown): asserts layout is GroupLayout {
  exactKeys(layout, ["titleHeight", "briefHeight", "inset", "rowGutter", "columnGutter", "rows", "columns"], "layout");
  for (const [key, value] of Object.entries(layout)) {
    if (key === "rows" || key === "columns") {
      if (!Array.isArray(value) || value.length > 100 || value.some((label) => typeof label !== "string" || label.length > 1000)) fail("invalid grid labels");
    } else if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 10000) fail("invalid layout reservation");
  }
  if (Number(layout.titleHeight ?? 56) < 24 || Number(layout.inset ?? 24) < 0) fail("invalid title or inset reservation");
}
function itemIn(canvas: CanvasContents, id: string): Item {
  const item = canvas.items[id];
  if (!item) throw new OpValidationError("unknown-item", `unknown item: ${id}`);
  return item;
}
function groupIn(canvas: CanvasContents, id: string): Item {
  const item = itemIn(canvas, id);
  if (!isGroupItem(item)) fail(`${id} is not a canvas group`);
  return item;
}
/** Kind is explicit: visual overlap never turns an ordinary card into a container. */
export function isGroupItem(item: Item): boolean { return item.properties.kind === GROUP_KIND; }
/** Missing mode preserves historical area replay until a canvas opts into groups. */
function hasCanvasGroups(state: CanvasState): boolean { return state.project.groupMode === "groups"; }

/** A revision-scoped index. Callers can retain it alongside their immutable canvas. */
function groupIndex(canvas: CanvasContents): Map<string | null, Item[]> {
  const index = new Map<string | null, Item[]>();
  for (const item of Object.values(canvas.items)) {
    const key = item.containerId ?? null;
    const children = index.get(key) ?? [];
    children.push(item);
    index.set(key, children);
  }
  for (const children of index.values()) children.sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
  return index;
}
/** Direct membership, with null addressing the canvas root instead of an enclosing frame. */
export function groupChildren(canvas: CanvasContents, groupId: string | null): Item[] { return groupIndex(canvas).get(groupId) ?? []; }
/** Breadcrumb order starts at the immediate parent and ends at the canvas root. */
export function groupAncestors(canvas: CanvasContents, itemId: string): Item[] {
  return ancestors(canvas, itemIn(canvas, itemId)).map((id) => itemIn(canvas, id));
}
/** Root-scope clicks reach the outermost group; inside a group they reach direct children. */
export function groupScopedRoot(canvas: CanvasContents, itemId: string, activeGroupId: string | null): string | null {
  if (!canvas.items[itemId] || itemId === activeGroupId) return null;
  const chain = [itemIn(canvas, itemId), ...groupAncestors(canvas, itemId)];
  return chain.find((item) => (item.containerId ?? null) === activeGroupId)?.id ?? null;
}
/** The same direct-child boundary drives marquee selection and the group navigator. */
export function groupScopeRoots(canvas: CanvasContents, activeGroupId: string | null): Item[] {
  return groupChildren(canvas, activeGroupId);
}
/** Wrapping normalizes selected roots; the writer assigns their lowest common parent. */
export function groupWrapAction(canvas: CanvasContents, creation: import("./canvas-group-types.ts").GroupCreation, itemIds: readonly string[]): Extract<GroupAction, { kind: "create" }> {
  idList(itemIds);
  return { kind: "create", group: creation, itemIds: groupSelectionRoots(canvas, itemIds) };
}
/** Each selected root leaves one level, even when roots start under different parents. */
export function groupRemoveAction(canvas: CanvasContents, itemIds: readonly string[], toRoot = false): Extract<GroupAction, { kind: "remove" }> {
  idList(itemIds);
  return { kind: "remove", itemIds: groupSelectionRoots(canvas, itemIds), toRoot };
}
/** Deterministic subtree order gives clients the same recursive selection and context. */
export function groupDescendants(canvas: CanvasContents, groupId: string): Item[] {
  const index = groupIndex(canvas);
  const found: Item[] = [];
  const seen = new Set([groupId]);
  const visit = (id: string): void => {
    for (const child of index.get(id) ?? []) {
      if (seen.has(child.id)) fail("membership cycle");
      seen.add(child.id); found.push(child); visit(child.id);
    }
  };
  visit(groupId);
  return found;
}
function ancestors(canvas: CanvasContents, item: Item): string[] {
  const found: string[] = [];
  const seen = new Set([item.id]);
  let parent = item.containerId;
  while (parent) {
    if (seen.has(parent)) fail("membership cycle");
    seen.add(parent); found.push(parent); parent = itemIn(canvas, parent).containerId;
  }
  return found;
}

/** Membership roots and target-owned marks form placement units. */
export function groupSelectionRoots(canvas: CanvasContents, ids: readonly string[]): string[] {
  const wanted = new Set(ids);
  return sorted(ids).filter((id) => {
    const item = itemIn(canvas, id);
    if (ancestors(canvas, item).some((parent) => wanted.has(parent))) return false;
    const target = annotationTarget(item);
    return !(target && canvas.items[target] && (wanted.has(target) || ancestors(canvas, itemIn(canvas, target)).some((parent) => wanted.has(parent))));
  });
}
/** Include descendants and target-owned ink once, even when both are explicitly selected. */
export function groupTransformClosure(canvas: CanvasContents, ids: readonly string[]): string[] {
  const found = new Set<string>();
  for (const id of groupSelectionRoots(canvas, ids)) {
    found.add(id);
    for (const child of groupDescendants(canvas, id)) found.add(child.id);
  }
  for (const id of [...found]) for (const mark of annotationsOf(canvas, id)) found.add(mark.id);
  if (found.size > GROUP_LIMIT) fail("too many affected items");
  return sorted(found);
}

/** Pure model validation, including generic writes and replica snapshot adoption. */
export function validateGroupForest(state: CanvasState): void {
  const { canvas } = state;
  if (!hasCanvasGroups(state)) {
    if (Object.values(canvas.items).some((item) => item.containerId !== undefined || item.groupLayout !== undefined || isGroupItem(item))) fail("canvas groups require group mode");
    return;
  }
  for (const item of Object.values(canvas.items)) {
    validBox(item);
    if (item.properties.kind === "area") fail("legacy areas cannot be written in group mode");
    if (item.containerId !== undefined) {
      if (typeof item.containerId !== "string" || !item.containerId) fail("invalid container ID");
      groupIn(canvas, item.containerId);
    }
    ancestors(canvas, item);
    if (item.groupLayout !== undefined) {
      if (!isGroupItem(item)) fail("layout belongs to groups only");
      validLayout(item.groupLayout);
    }
    if (isGroupItem(item)) {
      validBox(groupContentBox(item));
      if (item.width < GROUP_MIN_SIZE.width || item.height < GROUP_MIN_SIZE.height) fail("group frame is below its minimum size");
    }
    const targetId = annotationTarget(item);
    const target = targetId ? canvas.items[targetId] : undefined;
    if (target) {
      if (isDrawingItem(target)) fail("ink-to-ink attachment is unsupported");
      if ((target.containerId ?? null) !== (item.containerId ?? null)) fail("an annotation and its target must share a group");
    }
  }
}

/** Layout and resize share saved header/inset reservations, independent of browser fonts. */
export function groupContentBox(item: Item): GroupBox {
  const layout = item.groupLayout ?? {};
  const inset = layout.inset ?? 24;
  const left = inset + (layout.rows?.length ? layout.rowGutter ?? 120 : 0);
  const top = (layout.titleHeight ?? 56) + (layout.briefHeight ?? 0) + inset + (layout.columns?.length ? layout.columnGutter ?? 32 : 0);
  return { x: item.x + left, y: item.y + top, width: item.width - left - inset, height: item.height - top - inset };
}
function labelHeight(item: Item): number {
  return isGroupItem(item) || annotationTarget(item) || ["text", "drawing"].includes(item.properties.kind ?? "") ? 0 : GROUP_LABEL_HEIGHT;
}
function groupFootprint(item: Item, canvas?: CanvasContents): GroupBox {
  const ownBox = { ...boxOf(item), height: item.height + labelHeight(item) };
  const marks = canvas ? annotationsOf(canvas, item.id).map(boxOf) : [];
  return enclosing([ownBox, ...marks]);
}
function enclosing(boxes: GroupBox[]): GroupBox {
  const x = Math.min(...boxes.map((box) => box.x));
  const y = Math.min(...boxes.map((box) => box.y));
  return { x, y, width: Math.max(...boxes.map((box) => box.x + box.width)) - x, height: Math.max(...boxes.map((box) => box.y + box.height)) - y };
}
function reservations(item: Item): { left: number; top: number; right: number; bottom: number } {
  const content = groupContentBox(item);
  return { left: content.x - item.x, top: content.y - item.y, right: item.x + item.width - content.x - content.width, bottom: item.y + item.height - content.y - content.height };
}
/** Fit includes labels and attached-ink overhang; growth preserves room already reserved. */
export function groupFitBox(canvas: CanvasContents, groupId: string, growOnly = false): GroupBox {
  const group = groupIn(canvas, groupId);
  const units = groupSelectionRoots(canvas, groupChildren(canvas, groupId).map((item) => item.id));
  if (units.length === 0) return boxOf(group);
  const bounds = enclosing(units.map((id) => groupFootprint(itemIn(canvas, id), canvas)));
  const band = reservations(group);
  let box = { x: bounds.x - band.left, y: bounds.y - band.top, width: Math.max(GROUP_MIN_SIZE.width, bounds.width + band.left + band.right), height: Math.max(GROUP_MIN_SIZE.height, bounds.height + band.top + band.bottom) };
  if (growOnly) box = enclosing([box, boxOf(group)]);
  return box;
}

/** Corner denotes the FIXED corner, shared by CLI, pointer handles and tests. */
export function groupResizeBox(item: GroupBox, size: { width: number; height: number }, anchor: GroupAnchor = "nw"): GroupBox {
  return { x: anchor.endsWith("e") ? item.x + item.width - size.width : item.x, y: anchor.startsWith("s") ? item.y + item.height - size.height : item.y, ...size };
}
function minimumSize(canvas: CanvasContents, item: Item): { width: number; height: number } {
  if (!isGroupItem(item)) return { width: Math.min(item.width, 80), height: Math.min(item.height, 60) };
  const content = groupContentBox(item);
  validBox(content);
  let sx = 0; let sy = 0;
  for (const child of groupChildren(canvas, item.id)) {
    if (annotationTarget(child) && canvas.items[annotationTarget(child)!]) continue;
    const minimum = minimumSize(canvas, child);
    sx = Math.max(sx, minimum.width / child.width);
    const label = labelHeight(child);
    sy = Math.max(sy, (minimum.height + label) / (child.height + label));
    const bottomRoom = content.y + content.height - child.y - child.height;
    if (child.x < content.x - 1e-5 || child.y < content.y - 1e-5 || child.x + child.width > content.x + content.width + 1e-5 || bottomRoom < label - 1e-5) fail(`fit ${item.id} before resizing: member intrudes into reserved space`);
  }
  const band = reservations(item);
  return { width: Math.max(GROUP_MIN_SIZE.width, band.left + band.right + Math.max(1, content.width * sx)), height: Math.max(GROUP_MIN_SIZE.height, band.top + band.bottom + Math.max(1, content.height * sy)) };
}
function mapBox(box: GroupBox, before: GroupBox, after: GroupBox): GroupBox {
  validBox(before); validBox(after);
  const sx = after.width / before.width; const sy = after.height / before.height;
  return { x: round(after.x + (box.x - before.x) * sx), y: round(after.y + (box.y - before.y) * sy), width: round(box.width * sx), height: round(box.height * sy) };
}

/** Immutable geometry only. Final constraints and arithmetic are preview arithmetic. */
export function groupTransform(canvas: CanvasContents, action: Extract<GroupAction, { kind: "transform" }>): Map<string, GroupBox> {
  const boxes = new Map<string, GroupBox>();
  if ("moves" in action) {
    const wanted = new Map(action.moves.map((move) => [move.itemId, move]));
    for (const id of groupSelectionRoots(canvas, [...wanted.keys()])) {
      const item = itemIn(canvas, id); const move = wanted.get(id)!;
      for (const childId of groupTransformClosure(canvas, [id])) {
        const child = itemIn(canvas, childId);
        boxes.set(childId, { ...boxOf(child), x: round(child.x + move.x - item.x), y: round(child.y + move.y - item.y) });
      }
    }
    return boxes;
  }
  if ("by" in action) {
    if (!record(action.by) || !Number.isFinite(action.by.x) || !Number.isFinite(action.by.y)) fail("invalid move delta");
    for (const id of groupTransformClosure(canvas, action.itemIds)) {
      const item = itemIn(canvas, id);
      boxes.set(id, { ...boxOf(item), x: round(item.x + action.by.x), y: round(item.y + action.by.y) });
    }
    return boxes;
  }
  const root = itemIn(canvas, action.itemId);
  validBox(action.box);
  const minimum = minimumSize(canvas, root);
  const destination = groupResizeBox(action.box, { width: Math.max(action.box.width, minimum.width), height: Math.max(action.box.height, minimum.height) }, action.anchor);
  const walk = (item: Item, box: GroupBox): void => {
    boxes.set(item.id, box);
    if (!isGroupItem(item)) return;
    const before = groupContentBox(item);
    const after = groupContentBox({ ...item, ...box });
    validBox(before); validBox(after);
    for (const child of groupChildren(canvas, item.id)) {
      if (annotationTarget(child) && canvas.items[annotationTarget(child)!]) continue;
      const label = labelHeight(child);
      const scaled = mapBox({ ...boxOf(child), height: child.height + label }, before, after);
      walk(child, { ...scaled, height: round(scaled.height - label) });
    }
  };
  walk(root, destination);
  for (const [id, box] of [...boxes]) for (const mark of annotationsOf(canvas, id)) boxes.set(mark.id, mapBox(mark, itemIn(canvas, id), box));
  return boxes;
}

function facts(item: Item): GroupFacts {
  const current = item.versions.find((version) => version.id === item.currentVersionId);
  return { ...boxOf(item), containerId: item.containerId ?? null, groupLayout: item.groupLayout ?? null, kind: item.properties.kind ?? null, annotates: annotationTarget(item), mimeType: current?.mimeType ?? null };
}
function expectation(state: CanvasState, itemId: string): GroupExpectation {
  const live = state.canvas.items[itemId];
  const trash = state.canvas.trash.find((entry) => entry.item.id === itemId);
  if (!live && !trash) return { itemId, location: "absent" };
  const item = live ?? trash!.item;
  return { itemId, location: live ? "live" : "trash", facts: facts(item), children: sorted(Object.values(state.canvas.items).filter((child) => child.containerId === itemId).map((child) => child.id)), annotations: sorted(annotationsOf(state.canvas, itemId).map((mark) => mark.id)), ...(trash ? { cohortId: trash.cohort?.id ?? null } : {}) };
}
/** Capture structural dependencies before sending intent, so stale retries cannot move twice. */
export function captureGroupExpectations(state: CanvasState, itemIds: readonly string[]): GroupExpectation[] {
  const wanted = new Set<string>(itemIds);
  const live = itemIds.filter((id) => state.canvas.items[id]);
  for (const id of groupTransformClosure(state.canvas, live)) {
    wanted.add(id);
    for (const ancestor of ancestors(state.canvas, itemIn(state.canvas, id))) wanted.add(ancestor);
  }
  // Ancestor fitting depends on siblings' complete footprints, including
  // their attached overhang. Their fields must guard the inverse too.
  for (const id of groupTransformClosure(state.canvas, [...wanted].filter((id) => state.canvas.items[id]))) wanted.add(id);
  return sorted(wanted).map((id) => expectation(state, id));
}
function checkExpectations(state: CanvasState, expected: GroupExpectation[]): void {
  if (!Array.isArray(expected) || expected.length > GROUP_LIMIT) fail("invalid expected state");
  for (const row of expected) {
    exactKeys(row, ["itemId", "location", "facts", "children", "annotations", "cohortId"], "expectation");
    if (typeof row.itemId !== "string" || !["live", "trash", "absent"].includes(String(row.location))) fail("invalid expected item");
  }
  idList(expected.map((row) => row.itemId), true);
  for (const row of expected) if (!equal(row, expectation(state, row.itemId))) throw new GroupConflictError(`canvas group changed since planning: ${row.itemId}`);
}

/** Strict public request validation. Never accept a client-supplied canonical patch. */
function validateGroupRequest(action: GroupAction): void {
  if (!record(action) || typeof action.kind !== "string") fail("invalid action");
  const allowed: Record<string, string[]> = {
    create: ["kind", "group", "itemIds", "containerId"], reparent: ["kind", "itemIds", "containerId", "place"], remove: ["kind", "itemIds", "toRoot"], ungroup: ["kind", "itemIds"], transform: "by" in action ? ["kind", "itemIds", "by", "expected"] : "moves" in action ? ["kind", "moves", "expected"] : ["kind", "itemId", "box", "anchor", "expected"], frame: ["kind", "itemId", "box", "fit"], layout: ["kind", "itemId", "layout", "tidy"], delete: ["kind", "itemIds"], restore: ["kind", "itemIds"],
  };
  if (!own(allowed, action.kind)) fail("resolved group changes are writer-only");
  exactKeys(action, allowed[action.kind]!, "action");
  for (const flag of ["place", "fit", "tidy", "toRoot"] as const) if (own(action, flag) && typeof (action as unknown as Record<string, unknown>)[flag] !== "boolean") fail(`${flag} must be a boolean`);
  if (["reparent", "remove", "ungroup", "delete", "restore"].includes(action.kind)) idList((action as { itemIds?: unknown }).itemIds);
  if (["frame", "layout"].includes(action.kind) && typeof (action as { itemId?: unknown }).itemId !== "string") fail("item ID required");
  if (action.kind === "reparent" && !own(action, "containerId")) fail("destination group required");
  if ("itemIds" in action) idList(action.itemIds, action.kind === "create");
  if ("itemId" in action && (typeof action.itemId !== "string" || !action.itemId)) fail("item ID required");
  if ("containerId" in action && action.containerId !== null && (typeof action.containerId !== "string" || !action.containerId)) fail("invalid destination group");
  if (action.kind === "create") {
    exactKeys(action.group, ["id", "title", "version", "description", "properties", "box", "layout"], "creation");
    if (typeof action.group.id !== "string" || !action.group.id || typeof action.group.title !== "string") fail("group identity and title required");
    if (own(action.group, "description") && typeof action.group.description !== "string") fail("description must be text");
    if (own(action.group, "properties")) validProperties(action.group.properties);
    exactKeys(action.group.version, ["id", "blobHash", "mimeType", "filename", "size", "visual"], "version");
    if (typeof action.group.version.id !== "string" || typeof action.group.version.blobHash !== "string" || typeof action.group.version.mimeType !== "string" || typeof action.group.version.filename !== "string" || !Number.isFinite(action.group.version.size) || action.group.version.size < 0) fail("group content version required");
    if (own(action.group.version, "visual")) validVisual(action.group.version.visual);
    if (own(action.group, "box")) requestBox(action.group.box);
    if (own(action.group, "layout")) validLayout(action.group.layout);
  }
  if (action.kind === "transform") {
    if (!Array.isArray(action.expected) || action.expected.length === 0) fail("a transform requires captured expected geometry");
    if ("by" in action) { idList(action.itemIds); exactKeys(action.by, ["x", "y"], "delta"); if (!Number.isFinite(action.by.x) || !Number.isFinite(action.by.y)) fail("invalid delta"); }
    else if ("moves" in action) {
      if (!Array.isArray(action.moves)) fail("move list required");
      for (const move of action.moves) { exactKeys(move, ["itemId", "x", "y"], "move"); if (!Number.isFinite(move.x) || !Number.isFinite(move.y)) fail("invalid move position"); }
      idList(action.moves.map((move) => move.itemId));
    }
    else { if (typeof action.itemId !== "string") fail("resize item ID required"); requestBox(action.box); if (action.anchor !== undefined && !["nw", "ne", "sw", "se"].includes(action.anchor)) fail("invalid anchor"); }
  }
  if (action.kind === "frame" && own(action, "box")) requestBox(action.box);
  if (action.kind === "layout") validLayout(action.layout);
}

function patchItem(item: Item, patch: GroupFields): Item {
  const next = { ...item, ...patch } as Item;
  if (patch.containerId === null) delete next.containerId;
  if (patch.groupLayout === null) delete next.groupLayout;
  return next;
}
function validateCreatedItem(item: Item): void {
  if (!record(item) || typeof item.id !== "string" || !item.id || !record(item.properties) || typeof item.title !== "string" || typeof item.description !== "string" || !Array.isArray(item.versions) || item.versions.length === 0 || item.versions.length > GROUP_LIMIT) fail("invalid created item");
  validProperties(item.properties);
  validBox(item);
  const ids = new Set<string>();
  for (const version of item.versions) {
    if (!record(version) || typeof version.id !== "string" || ids.has(version.id) || typeof version.blobHash !== "string" || typeof version.mimeType !== "string" || typeof version.filename !== "string" || !Number.isFinite(version.size) || version.size < 0 || !record(version.createdBy) || typeof version.createdAt !== "string") fail("invalid created version");
    if (own(version, "visual")) validVisual(version.visual);
    ids.add(version.id);
  }
  if (!ids.has(item.currentVersionId)) fail("current version is absent");
}

/** Validates all writes before publishing a new state. No dynamic placement on replay. */
export function applyGroupChange(state: CanvasState, change: GroupChange, actor: Actor, ts: string): CanvasState {
  if (!hasCanvasGroups(state)) fail("canvas groups require group mode");
  exactKeys(change, ["canvasId", "intent", "expected", "writes", "cohorts", "skippedIds"], "resolved change");
  if (change.canvasId !== state.project.id) fail("change belongs to another canvas");
  if (!["create", "reparent", "ungroup", "transform", "frame", "layout", "delete", "restore"].includes(change.intent)) fail("unknown semantic intent");
  if (!Array.isArray(change.writes) || change.writes.length > GROUP_LIMIT) fail("invalid write set");
  for (const write of change.writes) if (!record(write) || !["patch", "create", "trash", "restore"].includes(String(write.kind)) || (write.kind === "create" && !record(write.item))) fail("invalid structural write");
  checkExpectations(state, change.expected);
  const writeIds = change.writes.map((write) => write.kind === "create" ? write.item.id : write.itemId);
  idList(writeIds, true);
  const guarded = new Set(change.expected.map((row) => row.itemId));
  if (writeIds.some((id) => !guarded.has(id))) fail("every write needs a precondition");
  const items = { ...state.canvas.items };
  const trash = new Map(state.canvas.trash.map((entry) => [entry.item.id, entry]));
  for (const write of change.writes) {
    if (write.kind === "create") {
      exactKeys(write, ["kind", "item"], "create write");
      validateCreatedItem(write.item);
      if (items[write.item.id] || trash.has(write.item.id)) fail("duplicate item ID");
      items[write.item.id] = structuredClone(write.item);
    } else if (write.kind === "patch") {
      exactKeys(write, ["kind", "itemId", "fields"], "patch write");
      exactKeys(write.fields, fields, "structural patch");
      const item = items[write.itemId]; if (!item) fail("patch target is not live");
      items[write.itemId] = { ...patchItem(item, write.fields), updatedBy: actor, updatedAt: ts };
    } else if (write.kind === "trash") {
      exactKeys(write, ["kind", "itemId", "deletedAt", "deletedBy", "cohort"], "trash write");
      const item = items[write.itemId]; if (!item) fail("delete target is not live");
      if (typeof write.deletedAt !== "string" || !record(write.deletedBy) || typeof write.deletedBy.id !== "string") fail("invalid deletion stamp");
      if (write.cohort) { exactKeys(write.cohort, ["id", "rootIds"], "deletion cohort"); idList(write.cohort.rootIds); if (typeof write.cohort.id !== "string") fail("invalid cohort ID"); }
      trash.set(write.itemId, { item, deletedAt: write.deletedAt, deletedBy: write.deletedBy, ...(write.cohort ? { cohort: write.cohort } : {}) });
      delete items[write.itemId];
    } else if (write.kind === "restore") {
      exactKeys(write, ["kind", "itemId", "containerId"], "restore write");
      const entry = trash.get(write.itemId); if (!entry || items[write.itemId]) fail("restore target is not in trash");
      items[write.itemId] = { ...patchItem(entry.item, { containerId: write.containerId }), updatedBy: actor, updatedAt: ts };
      trash.delete(write.itemId);
    } else fail("unknown structural write");
  }
  const cohorts = { ...state.canvas.groupCohorts };
  if (change.cohorts !== undefined) {
    if (!record(change.cohorts) || Object.keys(change.cohorts).length > GROUP_LIMIT) fail("invalid cohort records");
    for (const [id, cohort] of Object.entries(change.cohorts)) {
      exactKeys(cohort, ["rootIds", "members"], "cohort record"); idList(cohort.rootIds);
      if (!Array.isArray(cohort.members)) fail("cohort members required");
      for (const member of cohort.members) exactKeys(member, ["itemId", "containerId", "annotates"], "cohort member");
      idList(cohort.members.map((member) => member.itemId));
      if (own(cohorts, id) && !equal(cohorts[id], cohort)) throw new GroupConflictError(`deletion cohort changed: ${id}`);
      Object.defineProperty(cohorts, id, { value: structuredClone(cohort), enumerable: true, configurable: true, writable: true });
    }
  }
  const next: CanvasState = { project: { ...state.project, updatedBy: actor, updatedAt: ts, lastOp: "group.change" }, canvas: { ...state.canvas, items, trash: [...trash.values()], ...(Object.keys(cohorts).length ? { groupCohorts: cohorts } : {}) } };
  validateGroupForest(next);
  return next;
}

/** Captured field inverses preserve unrelated content/metadata and trash authorship. */
export function invertGroupChange(state: CanvasState, change: GroupChange): GroupChange {
  const synthetic = { id: "inverse", name: "inverse" };
  const after = applyGroupChange(state, change, synthetic, "inverse");
  const writes: GroupWrite[] = change.writes.map((write) => {
    if (write.kind === "create") return { kind: "trash", itemId: write.item.id, deletedAt: write.item.createdAt, deletedBy: write.item.createdBy, cohort: { id: `undo-create:${write.item.id}`, rootIds: [write.item.id] } };
    if (write.kind === "patch") {
      const item = itemIn(state.canvas, write.itemId);
      const previous: GroupFields = {};
      for (const key of fields) if (own(write.fields, key)) (previous as Record<string, unknown>)[key] = item[key] ?? null;
      return { kind: "patch", itemId: write.itemId, fields: previous };
    }
    if (write.kind === "trash") return { kind: "restore", itemId: write.itemId, containerId: itemIn(state.canvas, write.itemId).containerId ?? null };
    const entry = state.canvas.trash.find((row) => row.item.id === write.itemId)!;
    return { kind: "trash", itemId: write.itemId, deletedAt: entry.deletedAt, deletedBy: entry.deletedBy, ...(entry.cohort ? { cohort: entry.cohort } : {}) };
  });
  const cohorts: NonNullable<GroupChange["cohorts"]> = {};
  for (const write of writes) if (write.kind === "trash" && write.cohort && !state.canvas.groupCohorts?.[write.cohort.id]) {
    cohorts[write.cohort.id] = { rootIds: write.cohort.rootIds, members: writes.filter((row): row is Extract<GroupWrite, { kind: "trash" }> => row.kind === "trash" && row.cohort?.id === write.cohort!.id).map((row) => ({ itemId: row.itemId, containerId: after.canvas.items[row.itemId]?.containerId ?? null, annotates: after.canvas.items[row.itemId] ? annotationTarget(after.canvas.items[row.itemId]!) : null })) };
  }
  return { canvasId: change.canvasId, intent: change.intent, expected: change.expected.map((row) => expectation(after, row.itemId)), writes, ...(Object.keys(cohorts).length ? { cohorts } : {}) };
}

/** Authoritative intent resolution. Requests never contain replacement canvas snapshots. */
export function resolveGroupOperation(state: CanvasState, op: GroupOperation, stamp: GroupStamp): GroupOperation {
  validateGroupRequest(op.action);
  if (!hasCanvasGroups(state)) fail("canvas groups require group mode");
  validateGroupForest(state);
  const action = op.action;
  if (action.kind === "apply") fail("resolved action cannot be submitted");
  const original = state.canvas;
  let canvas: CanvasContents = { ...original, items: { ...original.items }, trash: [...original.trash] };
  const creates = new Map<string, Item>();
  const deletions = new Set<string>();
  const restores = new Map<string, string | null>();
  const dependencies = new Set<string>();
  const skipped = new Set<string>();
  const want = (ids: readonly string[]): void => { for (const row of captureGroupExpectations(state, ids)) dependencies.add(row.itemId); };
  const put = (id: string, patch: GroupFields): void => { canvas.items[id] = patchItem(itemIn(canvas, id), patch); dependencies.add(id); };
  const adjustFrame = (id: string, box: GroupBox): void => {
    const before = itemIn(canvas, id); put(id, box);
    for (const mark of annotationsOf(canvas, id)) put(mark.id, mapBox(mark, before, box));
  };
  const fitAncestors = (ids: readonly string[]): void => {
    const parents = new Set<string>();
    for (const id of ids) if (canvas.items[id]) for (const parent of ancestors(canvas, itemIn(canvas, id))) parents.add(parent);
    const bottomFirst = [...parents].sort((a, b) => ancestors(canvas, itemIn(canvas, b)).length - ancestors(canvas, itemIn(canvas, a)).length);
    for (const parent of bottomFirst) adjustFrame(parent, groupFitBox(canvas, parent, true));
  };
  const reparent = (ids: readonly string[], parent: string | null): void => {
    if (parent !== null) groupIn(canvas, parent);
    for (const id of ids) {
      const item = itemIn(canvas, id);
      const target = annotationTarget(item);
      if (target && canvas.items[target] && !ids.includes(target) && (canvas.items[target]!.containerId ?? null) !== parent) fail("detach the annotation before changing its group");
      put(id, { containerId: parent });
      for (const mark of annotationsOf(canvas, id)) put(mark.id, { containerId: parent });
    }
    validateGroupForest({ ...state, canvas });
  };
  const placeUnits = (ids: readonly string[], parent: string): void => {
    const inner = groupContentBox(groupIn(canvas, parent));
    const moving = new Set(groupTransformClosure(canvas, ids));
    const others = groupChildren(canvas, parent).filter((item) => !moving.has(item.id));
    let y = Math.max(inner.y, ...others.map((item) => { const box = groupFootprint(item, canvas); return box.y + box.height + PLACEMENT_GAP; }));
    for (const id of groupSelectionRoots(canvas, ids)) {
      const item = itemIn(canvas, id); const footprint = groupFootprint(item, canvas);
      const dx = inner.x - footprint.x; const dy = y - footprint.y;
      for (const childId of groupTransformClosure(canvas, [id])) { const child = itemIn(canvas, childId); put(childId, { x: child.x + dx, y: child.y + dy }); }
      y += footprint.height + PLACEMENT_GAP;
    }
  };
  const trashIds = (ids: readonly string[]): void => { for (const id of ids) { dependencies.add(id); deletions.add(id); delete canvas.items[id]; } };
  let roots: string[] = [];
  if (action.kind === "create") {
    const ids = action.itemIds ?? [];
    want(ids); roots = groupSelectionRoots(original, ids);
    let parent = action.containerId;
    if (parent === undefined) {
      const chains = roots.map((id) => ancestors(original, itemIn(original, id)));
      parent = chains[0]?.find((id) => chains.every((chain) => chain.includes(id))) ?? null;
    }
    if (parent) { want([parent]); groupIn(original, parent); }
    const creation = action.group;
    if (original.items[creation.id] || original.trash.some((entry) => entry.item.id === creation.id)) fail("group ID already exists");
    const box = creation.box ?? { x: 0, y: 0, ...GROUP_DEFAULT_SIZE };
    const group: Item = { id: creation.id, ...box, title: creation.title, description: creation.description ?? "", properties: { ...creation.properties, kind: GROUP_KIND }, ...(parent ? { containerId: parent } : {}), groupLayout: { ...creation.layout }, versions: [{ ...creation.version, createdAt: stamp.ts, createdBy: stamp.actor }], currentVersionId: creation.version.id, createdAt: stamp.ts, createdBy: stamp.actor, updatedAt: stamp.ts, updatedBy: stamp.actor };
    validateCreatedItem(group); canvas.items[group.id] = group; dependencies.add(group.id); creates.set(group.id, group);
    reparent(roots, parent = group.id);
    if (roots.length) adjustFrame(group.id, groupFitBox(canvas, group.id));
    fitAncestors([group.id]); roots = [group.id];
  } else if (action.kind === "restore") {
    roots = action.itemIds; want(roots);
    const selected = new Set<string>();
    for (const id of roots) {
      const entry = original.trash.find((row) => row.item.id === id);
      if (!entry) fail(`not in trash: ${id}`);
      selected.add(id);
      const capture = entry.cohort ? original.groupCohorts?.[entry.cohort.id] : undefined;
      if (isGroupItem(entry.item) && entry.cohort && capture) {
        const walk = (parent: string): void => {
          for (const member of capture.members) if (member.containerId === parent || member.annotates === parent) {
            const child = original.trash.find((row) => row.item.id === member.itemId);
            if (!child || child.cohort?.id !== entry.cohort!.id) { skipped.add(member.itemId); continue; }
            if (selected.has(member.itemId)) continue;
            selected.add(member.itemId); walk(member.itemId);
          }
        };
        walk(id);
      }
      for (const mark of original.trash) if (annotationTarget(mark.item) === id && mark.cohort?.id === entry.cohort?.id) selected.add(mark.item.id);
    }
    for (const id of selected) {
      const entry = original.trash.find((row) => row.item.id === id)!;
      let parent = entry.item.containerId ?? null;
      const seen = new Set([id]);
      while (parent && !original.items[parent] && !selected.has(parent)) {
        if (seen.has(parent)) fail("trashed membership cycle"); seen.add(parent);
        parent = original.trash.find((row) => row.item.id === parent)?.item.containerId ?? null;
      }
      dependencies.add(id); if (parent && original.items[parent]) want([parent]);
      canvas.items[id] = patchItem(entry.item, { containerId: parent }); restores.set(id, parent);
    }
    canvas.trash = canvas.trash.filter((entry) => !selected.has(entry.item.id));
    for (const item of Object.values(canvas.items)) { const target = annotationTarget(item); if (target && canvas.items[target] && (selected.has(item.id) || selected.has(target))) { put(item.id, { containerId: canvas.items[target]!.containerId ?? null }); if (restores.has(item.id)) restores.set(item.id, canvas.items[target]!.containerId ?? null); } }
    fitAncestors([...selected]);
  } else {
    const ids = "itemIds" in action ? action.itemIds : "moves" in action ? action.moves.map((move) => move.itemId) : [action.itemId];
    want(ids); roots = groupSelectionRoots(original, ids);
    if (action.kind === "reparent") {
      if (action.containerId) want([action.containerId]);
      reparent(roots, action.containerId);
      if (action.containerId) {
        if (action.place) placeUnits(roots, action.containerId);
        adjustFrame(action.containerId, groupFitBox(canvas, action.containerId));
        fitAncestors([action.containerId]);
      }
    } else if (action.kind === "remove") {
      // Resolve every destination against the starting relation. Earlier
      // roots in the same act must not change where a later root is promoted.
      const destinations = roots.map((id) => {
        const parent = itemIn(original, id).containerId;
        if (!parent) fail(`${id} is already at the canvas root`);
        return { id, parent: action.toRoot ? null : itemIn(original, parent).containerId ?? null };
      });
      for (const destination of destinations) reparent([destination.id], destination.parent);
      fitAncestors(roots);
    } else if (action.kind === "ungroup") {
      for (const id of roots) {
        const group = groupIn(canvas, id);
        reparent(groupChildren(canvas, id).map((child) => child.id), group.containerId ?? null);
        trashIds([id, ...annotationsOf(canvas, id).map((mark) => mark.id)]);
      }
    } else if (action.kind === "delete") {
      trashIds(groupTransformClosure(original, roots));
    } else if (action.kind === "transform") {
      checkExpectations(state, action.expected);
      const captured = new Set(action.expected.map((row) => row.itemId));
      if ([...dependencies].some((id) => !captured.has(id))) fail("transform expectations omit affected items or ancestors");
      for (const [id, box] of groupTransform(original, action)) put(id, box);
      fitAncestors(roots);
    } else if (action.kind === "frame") {
      groupIn(canvas, action.itemId);
      if (!action.fit && !action.box) fail("frame needs a box or fit");
      adjustFrame(action.itemId, action.fit ? groupFitBox(canvas, action.itemId) : action.box!);
      if (!action.fit && !equal(groupFitBox(canvas, action.itemId, true), action.box)) fail("frame would exclude members or cover reserved labels; fit it or choose a larger box");
      fitAncestors([action.itemId]);
    } else if (action.kind === "layout") {
      const group = groupIn(canvas, action.itemId);
      const oldContent = groupContentBox(group);
      put(group.id, { groupLayout: { ...group.groupLayout, ...action.layout } });
      const content = groupContentBox(itemIn(canvas, group.id));
      const dx = oldContent.x - content.x; const dy = oldContent.y - content.y;
      adjustFrame(group.id, { x: group.x + dx, y: group.y + dy, width: group.width - dx, height: group.height - dy });
      if (action.tidy) placeUnits(groupChildren(canvas, group.id).map((child) => child.id), group.id);
      adjustFrame(group.id, groupFitBox(canvas, group.id, !action.tidy));
      fitAncestors([group.id]);
    }
  }
  const writes: GroupWrite[] = [];
  for (const id of sorted(dependencies)) {
    if (deletions.has(id)) { writes.push({ kind: "trash", itemId: id, deletedAt: stamp.ts, deletedBy: stamp.actor, cohort: { id: stamp.opId, rootIds: roots } }); continue; }
    if (creates.has(id)) { writes.push({ kind: "create", item: canvas.items[id]! }); continue; }
    if (restores.has(id)) { writes.push({ kind: "restore", itemId: id, containerId: restores.get(id)! }); continue; }
    const before = original.items[id]; const after = canvas.items[id];
    if (!before || !after) continue;
    const patch: GroupFields = {};
    for (const key of fields) if (!equal(before[key] ?? null, after[key] ?? null)) (patch as Record<string, unknown>)[key] = after[key] ?? null;
    if (Object.keys(patch).length) writes.push({ kind: "patch", itemId: id, fields: patch });
  }
  const cohorts = deletions.size ? { [stamp.opId]: { rootIds: roots, members: sorted(deletions).map((id) => ({ itemId: id, containerId: original.items[id]!.containerId ?? null, annotates: annotationTarget(original.items[id]!) })) } } : undefined;
  // Remove is derived reparenting, so its canonical form remains readable
  // by the first canvas-groups-v1 reducer as well as this richer request API.
  const change: GroupChange = { canvasId: state.project.id, intent: action.kind === "remove" ? "reparent" : action.kind, expected: sorted(dependencies).map((id) => expectation(state, id)), writes, ...(cohorts ? { cohorts } : {}), ...(skipped.size ? { skippedIds: sorted(skipped) } : {}) };
  applyGroupChange(state, change, stamp.actor, stamp.ts);
  return { type: "group.change", action: { kind: "apply", change } };
}

/** History and presence use actual writes, including fitted ancestors and attached marks. */
export function groupChangeItemIds(op: GroupOperation): string[] {
  if (op.action.kind === "apply") return op.action.change.writes.map((write) => write.kind === "create" ? write.item.id : write.itemId);
  if (op.action.kind === "create") return [op.action.group.id, ...(op.action.itemIds ?? [])];
  return "itemIds" in op.action ? op.action.itemIds : "moves" in op.action ? op.action.moves.map((move) => move.itemId) : [op.action.itemId];
}

/** New raw requests share group semantics; historical logged operations do not. */
export function resolveCanvasGroupRequest(state: CanvasState, op: Operation, stamp: GroupStamp): Operation {
  if (op.type === "group.change") return resolveGroupOperation(state, op, stamp);
  if (!hasCanvasGroups(state)) return op;
  const groupRelated = (id: string): boolean => {
    const item = state.canvas.items[id];
    return !!item && (isGroupItem(item) || !!item.containerId || annotationsOf(state.canvas, id).length > 0 || !!annotationTarget(item));
  };
  let action: GroupAction | undefined;
  if (op.type === "item.move" && groupRelated(op.itemId)) {
    action = { kind: "transform", moves: [{ itemId: op.itemId, x: op.x, y: op.y }], expected: captureGroupExpectations(state, [op.itemId]) };
  } else if (op.type === "items.move" && op.moves.some((move) => groupRelated(move.itemId))) {
    action = { kind: "transform", moves: op.moves, expected: captureGroupExpectations(state, op.moves.map((move) => move.itemId)) };
  } else if (op.type === "item.resize" && groupRelated(op.itemId)) {
    const item = itemIn(state.canvas, op.itemId);
    action = { kind: "transform", itemId: item.id, box: { x: item.x, y: item.y, width: op.width, height: op.height }, expected: captureGroupExpectations(state, [item.id]) };
  } else if (op.type === "item.delete" && groupRelated(op.itemId)) action = { kind: "delete", itemIds: [op.itemId] };
  else if (op.type === "items.delete" && op.itemIds.some(groupRelated)) action = { kind: "delete", itemIds: op.itemIds };
  else if (op.type === "item.restore" && state.canvas.trash.some((entry) => entry.item.id === op.itemId && (entry.cohort || isGroupItem(entry.item) || entry.item.containerId))) action = { kind: "restore", itemIds: [op.itemId] };
  else if (op.type === "items.restore" && state.canvas.trash.some((entry) => op.itemIds.includes(entry.item.id) && (entry.cohort || isGroupItem(entry.item) || entry.item.containerId))) action = { kind: "restore", itemIds: op.itemIds };
  return action ? resolveGroupOperation(state, { type: "group.change", action }, stamp) : op;
}
