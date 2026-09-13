import { createHash } from "node:crypto";
import type { Actor, CanvasContents, CanvasSnapshotResponse, GroupAction, GroupAnchor, GroupBox, GroupCell, GroupCreation, GroupLayout, GroupPlacementPolicy, Item, Operation, PostOpResponse } from "@isocan/core";
import { atLeast, captureGroupExpectations, GROUP_DEFAULT_SIZE, groupArrangeAction, groupChildren, groupContentBox, groupDescendants, groupFitAction, groupRemoveAction, groupResizeBox, groupSelectionRoots, groupWrapAction, isGroupItem, newItemId, newOpId, newVersionId, PLACEMENT_GAP, resolveGroupOperation } from "@isocan/core";
import type { DaemonRoutes } from "./routes.ts";

type PublicAction = Exclude<GroupAction, { kind: "apply" }>;
type GroupClient = Pick<DaemonRoutes, "snapshot" | "uploadBlob" | "changeGroup">;

/** Membership inspection exposes the relation and both boxes, rather than counting overlap. */
export interface CanvasGroupView {
  id: string;
  title: string;
  description: string;
  parentId: string | null;
  directMemberIds: string[];
  directCount: number;
  descendantCount: number;
  outerBox: GroupBox;
  contentBox: GroupBox;
  layout: Item["groupLayout"];
  members: Array<{ id: string; title: string; parentId: string | null; kind: string | null }>;
}

/** Dry runs and receipts share the actual resolver's effects; no guessed placement summary. */
export interface CanvasGroupResult {
  dryRun: boolean;
  intent: PublicAction["kind"];
  itemId?: string;
  affectedRoots: string[];
  changes: Array<{ itemId: string; parentBefore: string | null; parentAfter: string | null; boxBefore: GroupBox | null; boxAfter: GroupBox | null; state: "live" | "trash" }>;
  constraints: { valid: true; adjustedFrameIds: string[] };
  seq?: number;
}

/** Creation accepts bytes as text; preview hashes them locally and never uploads a blob. */
export interface CanvasGroupCreateOptions {
  at?: { x: number; y: number };
  size?: { width: number; height: number };
  note?: string;
  properties?: Record<string, string>;
  dryRun?: boolean;
}

function box(item: Item | undefined): GroupBox | null {
  return item ? { x: item.x, y: item.y, width: item.width, height: item.height } : null;
}

/** Exact IDs win; every other title/ID prefix must identify one item, with candidates on refusal. */
export function resolveCanvasGroupRef(canvas: CanvasContents, ref: string, groupOnly = false): Item {
  const all = Object.values(canvas.items).filter((item) => !groupOnly || isGroupItem(item));
  const exact = all.find((item) => item.id === ref);
  if (exact) return exact;
  const needle = ref.trim().toLowerCase();
  const matches = needle ? all.filter((item) => item.id.toLowerCase().startsWith(needle) || item.title.toLowerCase().startsWith(needle)) : [];
  if (matches.length === 1) return matches[0]!;
  const noun = groupOnly ? "canvas group" : "item";
  if (matches.length === 0) throw new Error(`no ${noun} called ${JSON.stringify(ref)} — isocan canvas group ls lists groups`);
  throw new Error(`ambiguous ${noun} ${JSON.stringify(ref)}; use an ID:\n${matches.map((item) => `  ${item.id}  ${item.title}`).join("\n")}`);
}

function view(canvas: CanvasContents, item: Item, recursive: boolean): CanvasGroupView {
  const direct = groupChildren(canvas, item.id);
  const descendants = groupDescendants(canvas, item.id);
  return { id: item.id, title: item.title, description: item.description, parentId: item.containerId ?? null, directMemberIds: direct.map((child) => child.id), directCount: direct.length, descendantCount: descendants.length, outerBox: box(item)!, contentBox: groupContentBox(item), layout: item.groupLayout ?? {}, members: (recursive ? descendants : direct).map((child) => ({ id: child.id, title: child.title, parentId: child.containerId ?? null, kind: child.properties.kind ?? null })) };
}

/** The canonical canvas-group family, shared by `connect()` and the CLI without argv or UI state. */
export class CanvasGroups {
  constructor(private client: GroupClient, readonly canvasId: string, private identity: Actor | (() => Actor)) {}

  private async read(edit = false): Promise<CanvasSnapshotResponse> {
    const state = await this.client.snapshot(this.canvasId);
    if (state.project.groupMode !== "groups") throw new Error("canvas groups are not enabled on this canvas; existing areas remain available through isocan area. Group conversion is not available in this build.");
    if (edit && state.capability && !atLeast(state.capability, "edit")) throw new Error("editing this canvas requires edit access; groups can still be listed and inspected");
    return state;
  }

  /** Listing reads explicit group identities, including valid empty groups. */
  async list(): Promise<CanvasGroupView[]> {
    const state = await this.read();
    return Object.values(state.canvas.items).filter(isGroupItem).sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id)).map((item) => view(state.canvas, item, false));
  }

  /** Recursive inspection expands descendants without changing anybody's selection. */
  async show(ref: string, recursive = false): Promise<CanvasGroupView> {
    const state = await this.read();
    return view(state.canvas, resolveCanvasGroupRef(state.canvas, ref, true), recursive);
  }

  /** An empty named frame is one creation; its card bytes are uploaded only after validation. */
  async new(title: string, options: CanvasGroupCreateOptions = {}): Promise<CanvasGroupResult> {
    return this.create(title, [], options);
  }

  /** Wrapping preserves positions and lets the shared writer assign the lowest common parent. */
  async wrap(refs: string[], title: string, options: Pick<CanvasGroupCreateOptions, "note" | "dryRun"> = {}): Promise<CanvasGroupResult> {
    if (!refs.length) throw new Error("wrap needs at least one item");
    return this.create(title, refs, options);
  }

  private async create(title: string, refs: string[], options: CanvasGroupCreateOptions): Promise<CanvasGroupResult> {
    const state = await this.read(true);
    if (!title.trim()) throw new Error("a canvas group needs a title");
    const content = Buffer.from(options.note?.trim() ? options.note : "\n", "utf8");
    const all = Object.values(state.canvas.items);
    const at = options.at ?? { x: all.length ? Math.max(...all.map((item) => item.x + item.width)) + PLACEMENT_GAP : 0, y: all.length ? Math.min(...all.map((item) => item.y)) : 0 };
    const creation: GroupCreation = { id: newItemId(), title: title.trim(), description: options.note ?? "", version: { id: newVersionId(), blobHash: createHash("sha256").update(content).digest("hex"), mimeType: "text/markdown", filename: "group.md", size: content.length }, box: { ...at, ...GROUP_DEFAULT_SIZE, ...options.size }, layout: { briefHeight: options.note?.trim() ? 120 : 0 }, ...(options.properties ? { properties: options.properties } : {}) };
    const ids = refs.map((ref) => resolveCanvasGroupRef(state.canvas, ref).id);
    const action = ids.length ? groupWrapAction(state.canvas, creation, ids) : { kind: "create" as const, group: creation };
    return this.perform(state, action, !!options.dryRun, content);
  }

  /** Add and move-between-groups are one reparent intent, optionally placing the new members. */
  async add(group: string, refs: string[], options: { place?: boolean; dryRun?: boolean; cell?: GroupCell; groupPlacement?: GroupPlacementPolicy } = {}): Promise<CanvasGroupResult> {
    const state = await this.read(true);
    const parent = resolveCanvasGroupRef(state.canvas, group, true);
    return this.perform(state, { kind: "reparent", containerId: parent.id, itemIds: refs.map((ref) => resolveCanvasGroupRef(state.canvas, ref).id), place: !!options.place, ...(options.cell ? { cell: options.cell } : {}), ...(options.groupPlacement ? { groupPlacement: options.groupPlacement } : {}) }, !!options.dryRun);
  }

  /** Move one root and its placement unit, with the dependency capture made before the write. */
  async move(ref: string, destination: { at: { x: number; y: number } } | { by: { x: number; y: number } }, options: { dryRun?: boolean } = {}): Promise<CanvasGroupResult> {
    const state = await this.read(true);
    const item = resolveCanvasGroupRef(state.canvas, ref);
    const by = "by" in destination ? destination.by : { x: destination.at.x - item.x, y: destination.at.y - item.y };
    return this.perform(state, { kind: "transform", itemIds: [item.id], by, expected: captureGroupExpectations(state, [item.id]) }, !!options.dryRun);
  }

  /** Scale the group's native frames and attached marks, keeping the named corner fixed. */
  async resize(ref: string, size: { width: number; height: number }, options: { anchor?: GroupAnchor; dryRun?: boolean } = {}): Promise<CanvasGroupResult> {
    const state = await this.read(true);
    const item = resolveCanvasGroupRef(state.canvas, ref);
    return this.perform(state, { kind: "transform", itemId: item.id, box: groupResizeBox(item, size, options.anchor), ...(options.anchor ? { anchor: options.anchor } : {}), expected: captureGroupExpectations(state, [item.id]) }, !!options.dryRun);
  }

  /** Frame edits never scale children. Fitting several groups still produces one record. */
  async frame(refs: string | string[], options: { fit?: boolean; at?: { x: number; y: number }; size?: { width: number; height: number }; dryRun?: boolean } = {}): Promise<CanvasGroupResult> {
    const state = await this.read(true);
    const items = (typeof refs === "string" ? [refs] : refs).map((ref) => resolveCanvasGroupRef(state.canvas, ref, true));
    if (!items.length) throw new Error("frame needs at least one group");
    if (options.fit && (options.at || options.size)) throw new Error("fit and an explicit frame are separate choices");
    if (options.fit) return this.perform(state, { kind: "frame", itemIds: items.map((item) => item.id), fit: true }, !!options.dryRun);
    if (items.length !== 1 || (!options.at && !options.size)) throw new Error("an explicit frame needs one group and --at or --size");
    return this.perform(state, { kind: "frame", itemId: items[0]!.id, box: { ...box(items[0])!, ...options.at, ...options.size }, expected: captureGroupExpectations(state, [items[0]!.id]) }, !!options.dryRun);
  }

  async layout(ref: string, layout: GroupLayout, options: { tidy?: boolean; dryRun?: boolean } = {}): Promise<CanvasGroupResult> {
    const state = await this.read(true);
    const item = resolveCanvasGroupRef(state.canvas, ref, true);
    return this.perform(state, { kind: "layout", itemId: item.id, layout: { ...item.groupLayout, ...layout }, ...(options.tidy ? { tidy: true } : {}) }, !!options.dryRun);
  }

  /** Grid counts and optional names use the same saved layout as the browser. */
  async grid(ref: string, counts: { rows: number; columns: number }, options: { rows?: string[]; columns?: string[]; tidy?: boolean; dryRun?: boolean } = {}): Promise<CanvasGroupResult> {
    return this.layout(ref, { rowCount: counts.rows, columnCount: counts.columns, ...(options.rows ? { rows: options.rows } : {}), ...(options.columns ? { columns: options.columns } : {}) }, options);
  }

  async arrange(refs: string[], arrangement: Parameters<typeof groupArrangeAction>[2], options: { dryRun?: boolean } = {}): Promise<CanvasGroupResult> {
    const state = await this.read(true);
    const ids = refs.map((ref) => resolveCanvasGroupRef(state.canvas, ref).id);
    return this.perform(state, groupArrangeAction(state, ids, arrangement), !!options.dryRun);
  }

  /** Sized content updates reserve headers and transform geometry in the same accepted record. */
  async update(ref: string, update: Omit<Extract<Operation, { type: "item.update" }>, "type" | "itemId">, options: { dryRun?: boolean } = {}): Promise<CanvasGroupResult> {
    const state = await this.read(true);
    const item = resolveCanvasGroupRef(state.canvas, ref);
    return this.perform(state, { kind: "content", operation: { type: "item.update", itemId: item.id, ...update } }, !!options.dryRun);
  }

  /** Native leaf fitting and frame-only group fitting share one bounded writer act. */
  async fit(targets: Array<{ itemId: string; width?: number; height?: number }>, options: { dryRun?: boolean } = {}): Promise<CanvasGroupResult> {
    const state = await this.read(true);
    return this.perform(state, groupFitAction(state, targets.map((target) => ({ ...target, itemId: resolveCanvasGroupRef(state.canvas, target.itemId).id }))), !!options.dryRun);
  }

  /** Remove promotes each root one level; mixed-parent selections still use one undoable act. */
  async remove(refs: string[], options: { toRoot?: boolean; dryRun?: boolean } = {}): Promise<CanvasGroupResult> {
    const state = await this.read(true);
    return this.perform(state, groupRemoveAction(state.canvas, refs.map((ref) => resolveCanvasGroupRef(state.canvas, ref).id), !!options.toRoot), !!options.dryRun);
  }

  /** Dissolve frames while preserving their children; frame-attached marks follow the frame to trash. */
  async ungroup(refs: string[], options: { dryRun?: boolean } = {}): Promise<CanvasGroupResult> {
    const state = await this.read(true);
    return this.perform(state, { kind: "ungroup", itemIds: refs.map((ref) => resolveCanvasGroupRef(state.canvas, ref, true).id) }, !!options.dryRun);
  }

  private async perform(state: CanvasSnapshotResponse, action: PublicAction, dryRun: boolean, content?: Buffer): Promise<CanvasGroupResult> {
    const actor = typeof this.identity === "function" ? this.identity() : this.identity;
    const opId = newOpId();
    const stamp = { actor, ts: new Date().toISOString(), opId };
    const resolved = resolveGroupOperation(state, { type: "group.change", action }, stamp);
    if (resolved.action.kind !== "apply") throw new Error("group request did not resolve");
    let change = resolved.action.change;
    let response: PostOpResponse | undefined;
    if (!dryRun) {
      if (action.kind === "create" && content) {
        const uploaded = await this.client.uploadBlob(this.canvasId, content, action.group.version.mimeType, action.group.version.filename);
        if (uploaded.blobHash !== action.group.version.blobHash) throw new Error("group card upload hash disagreed with its bytes");
      }
      response = await this.client.changeGroup(this.canvasId, actor, action, opId);
      const written = response.envelope.op;
      if (written.type !== "group.change" || written.action.kind !== "apply") throw new Error("writer did not return the resolved group change");
      change = written.action.change;
    }
    // A committed receipt may have resolved against a newer canvas than our
    // read. Its own expected facts are the before-state; reapplying it against
    // the stale read would turn a successful write into a false client error.
    const facts = new Map(change.expected.map((row) => [row.itemId, row.facts]));
    const relation = { ...state.canvas, items: { ...state.canvas.items } };
    for (const row of change.expected) if (row.location === "live" && row.facts) {
      const before = row.facts;
      // Only the relation is read by selection normalization. The canonical
      // dependency record includes newly encountered ancestors absent at read time.
      relation.items[row.itemId] = { ...state.canvas.items[row.itemId], id: row.itemId, ...before, properties: { ...(before.kind ? { kind: before.kind } : {}), ...(before.annotates ? { annotates: before.annotates } : {}) } } as unknown as Item;
    }
    const inputIds = "itemIds" in action ? action.itemIds ?? [] : "itemId" in action ? [action.itemId] : "moves" in action ? action.moves.map((move) => move.itemId) : "targets" in action ? action.targets.map((target) => target.itemId) : action.kind === "content" ? [action.operation.itemId] : [];
    const changes = change.writes.map((write) => {
      const id = write.kind === "create" ? write.item.id : write.itemId;
      const before = facts.get(id);
      const next = write.kind === "create" ? write.item : write.kind === "trash" ? undefined : { ...before!, ...(write.kind === "patch" ? write.fields : { containerId: write.containerId }) };
      const coordinates = (value: typeof before | typeof next): GroupBox | null => value ? { x: value.x, y: value.y, width: value.width, height: value.height } : null;
      return { itemId: id, parentBefore: before?.containerId ?? null, parentAfter: next?.containerId ?? null, boxBefore: coordinates(before), boxAfter: coordinates(next), state: next ? "live" as const : "trash" as const };
    });
    return { dryRun, intent: action.kind, ...(action.kind === "create" ? { itemId: action.group.id } : {}), affectedRoots: groupSelectionRoots(relation, inputIds), changes, constraints: { valid: true, adjustedFrameIds: changes.filter((row) => facts.get(row.itemId)?.kind === "group" && JSON.stringify(row.boxBefore) !== JSON.stringify(row.boxAfter)).map((row) => row.itemId) }, ...(response ? { seq: response.seq } : {}) };
  }
}
