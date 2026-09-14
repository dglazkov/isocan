import type { CanvasContents, Item } from "@isocan/core";
import { checkpointsOn, currentVersion, nodesOn, originId, outgoing, PROP, hasMime, PROJECT_MIME, NODE_MIME, CHECKPOINT_MIME } from "./manifest.ts";
import { checkpointSchema, nodeBodySchema, nodeSchema, projectBodySchema, validateGraph, type AnatomyProject } from "./schema.ts";

/** An exploration error belongs to a native file, which remains repairable. */
export interface AnatomyDiagnostic {
  itemId: string;
  title: string;
  section: "overview" | "concept" | "relationships" | "checkpoint";
  message: string;
}
export interface AnatomyInspection {
  project: AnatomyProject | null;
  diagnostics: AnatomyDiagnostic[];
  items: Record<string, string>;
}
/** Read a display-only subset. Never pass this subset to a whole-graph write. */
export async function inspectProject(canvas: CanvasContents, item: Item, read: (hash: string) => Promise<string>): Promise<AnatomyInspection> {
  const diagnostics: AnatomyDiagnostic[] = [];
  const report = (file: Item, section: AnatomyDiagnostic["section"], error: unknown) => {
    diagnostics.push({ itemId: file.id, title: file.title, section, message: error instanceof Error ? error.message : String(error) });
  };
  let body;
  try {
    if (!hasMime(item, PROJECT_MIME)) throw new Error("Overview changed file type; restore its Anatomy version.");
    if (!item.title) throw new Error("The analysis needs a title.");
    body = projectBodySchema.parse(JSON.parse(await read(currentVersion(item).blobHash)));
    if (new Set(body.sources.map(s => s.id)).size !== body.sources.length) throw new Error("Duplicate source id in overview.");
  }
  catch (error) { report(item, "overview", error); return { project: null, diagnostics, items: {} }; }
  const files = nodesOn(canvas, item.id);
  const counts = new Map<string, number>();
  for (const file of files) counts.set(originId(file), (counts.get(originId(file)) ?? 0) + 1);
  const reads = await Promise.all(files.map(async file => {
    try {
      if (!hasMime(file, NODE_MIME)) throw new Error("Concept changed file type; restore its Anatomy version.");
      if (counts.get(originId(file)) !== 1) throw new Error(`Duplicate concept id: ${originId(file)}`);
      const details = nodeBodySchema.parse(JSON.parse(await read(currentVersion(file).blobHash)));
      return { file, node: nodeSchema.parse({ ...details, id: originId(file), title: file.title }) };
    } catch (error) { return { file, error }; }
  }));
  const healthy = reads.flatMap(result => {
    if (!result.node) { report(result.file, "concept", result.error); return []; }
    return [{ file: result.file, node: result.node }];
  });
  const byNative = new Map(healthy.map(({ file, node }) => [file.id, node]));
  const byId = new Map(healthy.map(({ node }) => [node.id, node]));
  for (const { file, node } of healthy) {
    const parentId = file.properties[PROP.parent];
    const parent = byNative.get(parentId ?? "");
    if (parent) {
      node.parentId = parent.id;
      if (file.properties[PROP.relation]) node.parentRelation = file.properties[PROP.relation];
    } else if (parentId) report(file, "relationships", "Parent is unavailable; displayed without a parent.");
  }
  for (const { file, node } of healthy) {
    const seen = new Set([node.id]);
    let parent = node.parentId;
    while (parent) {
      if (seen.has(parent)) {
        report(file, "relationships", "Parent cycle; displayed without this parent connection.");
        delete node.parentId; delete node.parentRelation; break;
      }
      seen.add(parent); parent = byId.get(parent)?.parentId;
    }
  }
  const edges: AnatomyProject["edges"] = [];
  const edgeIds = new Set<string>();
  for (const { file, node } of healthy) {
    try {
      for (const edge of outgoing(file)) {
        const to = byNative.get(edge.to);
        if (!to || !edge.id || edgeIds.has(edge.id)) {
          report(file, "relationships", `Relationship ${edge.id || "(unnamed)"} has an unavailable endpoint or duplicate id; omitted from this view.`);
          continue;
        }
        edgeIds.add(edge.id); edges.push({ ...edge, from: node.id, to: to.id });
      }
    } catch (error) { report(file, "relationships", error); }
  }
  const checkpoints: AnatomyProject["checkpoints"] = [];
  for (const file of checkpointsOn(canvas, item.id)) {
    try {
      if (!hasMime(file, CHECKPOINT_MIME)) throw new Error("Checkpoint changed file type; restore its Anatomy version.");
      const checkpoint = checkpointSchema.parse(JSON.parse(await read(currentVersion(file).blobHash)));
      validateGraph(checkpoint.nodes, checkpoint.edges);
      if (checkpoints.some(c => c.id === checkpoint.id)) throw new Error(`Duplicate checkpoint id: ${checkpoint.id}`);
      checkpoints.push({ ...checkpoint, title: file.title });
    } catch (error) { report(file, "checkpoint", error); }
  }
  return {
    project: { ...body, id: originId(item), projectName: item.title, nodes: healthy.map(x => x.node), edges, checkpoints },
    diagnostics,
    items: Object.fromEntries(healthy.map(({ file, node }) => [node.id, file.id])),
  };
}
