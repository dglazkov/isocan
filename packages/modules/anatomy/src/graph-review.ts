import { z } from "zod";
import { guardItem, newItemId, validateItemChanges, MAX_ITEM_CHANGES,
  type CanvasContents, type Item, type ItemChange, type ItemGuard } from "@isocan/core";
import { NODE_MIME, NODE_SIZE, PROP, currentVersion, nodesOn, originId, readProject } from "./core.ts";
import { nodeSchema, edgeSchema, validateGraph, type AnatomyProject } from "./schema.ts";
import { nodeBody, nodeProps, edgeProps, version, readEditableProject, type AnatomyIO } from "./operations.ts";

const graphSchema = z.object({ nodes: z.array(nodeSchema), edges: z.array(edgeSchema) }).strict();
const guardSchema = z.discriminatedUnion("location", [
  z.object({ itemId: z.string(), location: z.literal("absent") }).strict(),
  ...(["live", "trash"] as const).map(location => z.object({ itemId: z.string(), location: z.literal(location),
    versionId: z.string(), title: z.string(), properties: z.record(z.string(), z.string()) }).strict()),
]);
const reviewSchema = z.object({
  format: z.literal("anatomy-graph-review-v1"), canvasId: z.string(), projectId: z.string(),
  before: graphSchema, after: graphSchema,
  bindings: z.array(z.object({ conceptId: z.string(), itemId: z.string() }).strict()),
  guards: z.array(guardSchema),
}).strict();
export type GraphReview = z.infer<typeof reviewSchema>;
export type GraphDifference = { kind: "add" | "restore" | "change" | "remove"; id: string; title: string; fields: string[]; before?: unknown; after?: unknown };

/** Key order does not constitute a content change; array order is retained. */
function stable(value: unknown): string {
  return JSON.stringify(value, (_key, v) => v && typeof v === "object" && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map(key => [key, v[key]])) : v);
}
function graph(input: unknown) {
  const value = input as { nodes?: unknown; edges?: unknown } | null;
  const parsed = graphSchema.parse({ nodes: value?.nodes, edges: value?.edges });
  validateGraph(parsed.nodes, parsed.edges);
  return { nodes: parsed.nodes.sort((a, b) => a.id.localeCompare(b.id)), edges: parsed.edges.sort((a, b) => a.id.localeCompare(b.id)) };
}

/** A review contains no blob uploads or operations. It can be saved and inspected. */
export function prepareGraphReview(canvas: CanvasContents, projectItem: Item, project: AnatomyProject, input: unknown, canvasId: string, newIds?: Map<string, string>): GraphReview {
  const before = graph(project), after = graph(input);
  const live = nodesOn(canvas, projectItem.id);
  const guards: ItemGuard[] = [guardItem(projectItem), ...live.map(item => guardItem(item))];
  const bindings = after.nodes.map(node => {
    const existing = live.find(item => originId(item) === node.id);
    if (existing) return { conceptId: node.id, itemId: existing.id };
    const trash = canvas.trash.map(entry => entry.item).filter(item => item.properties[PROP.project] === projectItem.id &&
      originId(item) === node.id && item.versions.some(v => v.mimeType === NODE_MIME));
    if (trash.length > 1) throw new Error(`Multiple trashed items match ${node.id}; resolve the duplicate before reviewing`);
    const item = trash[0];
    const itemId = item?.id ?? newIds?.get(node.id) ?? newItemId();
    guards.push(item ? guardItem(item, "trash") : { itemId, location: "absent" });
    return { conceptId: node.id, itemId };
  });
  if (new Set(bindings.map(binding => binding.itemId)).size !== bindings.length) throw new Error("Duplicate native item IDs in graph review");
  return { format: "anatomy-graph-review-v1", canvasId, projectId: projectItem.id, before, after, bindings,
    guards: guards.sort((a, b) => a.itemId.localeCompare(b.itemId)) };
}

export function graphDifferences(plan: GraphReview): { concepts: GraphDifference[]; relationships: GraphDifference[] } {
  const diff = (before: Array<{ id: string }>, after: Array<{ id: string }>, concepts: boolean): GraphDifference[] => {
    const a = new Map(before.map(value => [value.id, value])), b = new Map(after.map(value => [value.id, value]));
    return [...new Set([...a.keys(), ...b.keys()])].sort().flatMap(id => {
      const old = a.get(id), next = b.get(id);
      if (stable(old) === stable(next)) return [];
      const row = (next ?? old)! as Record<string, unknown>;
      const restored = concepts && !old && plan.guards.some(guard => guard.location === "trash" && guard.itemId === plan.bindings.find(binding => binding.conceptId === id)?.itemId);
      return [{ kind: !next ? "remove" : old ? "change" : restored ? "restore" : "add", id,
        title: String(row.title ?? row.label ?? `${row.from} → ${row.to}`),
        fields: old && next ? [...new Set([...Object.keys(old), ...Object.keys(next)])].filter(key => stable((old as Record<string, unknown>)[key]) !== stable((next as Record<string, unknown>)[key])) : [],
        ...(old ? { before: old } : {}), ...(next ? { after: next } : {}),
      } as GraphDifference];
    });
  };
  return { concepts: diff(plan.before.nodes, plan.after.nodes, true), relationships: diff(plan.before.edges, plan.after.edges, false) };
}

/** Refuse a stale plan both before uploads and authoritatively inside the daemon. */
export async function applyGraphReview(io: AnatomyIO, input: unknown) {
  const plan = reviewSchema.parse(input && typeof input === "object" && "review" in input ? input.review : input);
  const record = await io.record();
  if (record.id !== plan.canvasId) throw new Error("This graph review belongs to another canvas");
  const canvas = await io.snapshot();
  const projectItem = canvas.items[plan.projectId];
  if (!projectItem) throw new Error("The reviewed Anatomy project is no longer on the canvas");
  const scope = { property: PROP.project, value: projectItem.id, mimeTypes: [NODE_MIME],
    itemIds: plan.guards.filter(guard => guard.location === "live" && guard.itemId !== projectItem.id).map(guard => guard.itemId) };
  validateItemChanges(canvas, { type: "items.change", guards: plan.guards, scope,
    changes: [{ type: "item.update", itemId: projectItem.id, patch: {} }] });
  const project = await readEditableProject(canvas, projectItem, io.read);
  const fresh = prepareGraphReview(canvas, projectItem, project, plan.after, record.id, new Map(plan.bindings.map(binding => [binding.conceptId, binding.itemId])));
  if (stable(fresh) !== stable(plan)) throw new Error("Graph review no longer matches its base; review again");
  const ids = new Map(plan.bindings.map(binding => [binding.conceptId, binding.itemId]));
  const before = new Map(plan.before.nodes.map(node => [node.id, node]));
  const changes: ItemChange[] = [];
  for (const [index, node] of plan.after.nodes.entries()) {
    const itemId = ids.get(node.id)!;
    const live = canvas.items[itemId];
    const item = live ?? canvas.trash.find(entry => entry.item.id === itemId)?.item;
    const previous = before.get(node.id);
    const props = { ...nodeProps(node, projectItem.id, ids), [PROP.edges]: edgeProps(plan.after, node.id, ids) };
    const bodyChanged = !previous || stable(nodeBody(previous)) !== stable(nodeBody(node));
    const metaChanged = !item || !previous || item.title !== node.title || previous.parentId !== node.parentId || previous.parentRelation !== node.parentRelation ||
      stable(plan.before.edges.filter(edge => edge.from === node.id)) !== stable(plan.after.edges.filter(edge => edge.from === node.id));
    if (!bodyChanged && !metaChanged) continue;
    if (item && !live) changes.push({ type: "item.restore", itemId });
    if (bodyChanged) {
      const next = await version(io, nodeBody(node), NODE_MIME, item ? currentVersion(item).filename : "concept.anatomy.json");
      changes.push(item ? { type: "item.edit", itemId, version: next, expectedVersionId: item.currentVersionId, patch: { title: node.title, properties: props } } :
        { type: "item.add", itemId, title: node.title, version: next, ...NODE_SIZE, properties: props,
          placement: { x: projectItem.x + 460, y: projectItem.y + index * 300 } });
    } else changes.push({ type: "item.update", itemId, patch: { title: node.title, properties: props } });
  }
  const wanted = new Set(ids.values());
  for (const item of nodesOn(canvas, projectItem.id)) if (!wanted.has(item.id)) changes.push({ type: "item.delete", itemId: item.id });
  if (changes.length > MAX_ITEM_CHANGES) throw new Error(`Review exceeds ${MAX_ITEM_CHANGES} native changes; split the proposal into smaller reviewed updates`);
  if (changes.length) await io.send([{ type: "items.change", changes, guards: plan.guards, scope }]);
  return { projectId: projectItem.id, status: changes.length ? "applied" : "unchanged", ...graphDifferences(plan), bindings: plan.bindings };
}
