import type {
  CanvasContents,
  CoreModule,
  Item,
  ModuleEdge,
} from "@isocan/core";
import type { AnatomyProject, AnatomyNode, AnatomyEdge } from "./schema.ts";

export const PROJECT_MIME = "application/vnd.isocan.anatomy-project+json";
export const NODE_MIME = "application/vnd.isocan.anatomy-node+json";
export const CHECKPOINT_MIME = "application/vnd.isocan.anatomy-checkpoint+json";
export const PROP = {
  project: "anatomy.project",
  origin: "anatomy.origin",
  parent: "anatomy.parent",
  relation: "anatomy.parentRelation",
  edges: "anatomy.edges",
  source: "anatomy.source",
} as const;
export const NODE_SIZE = { width: 320, height: 210 };
export const currentVersion = (item: Item) =>
  item.versions.find((v) => v.id === item.currentVersionId)!;
export const hasMime = (item: Item, mime: string) =>
  currentVersion(item)?.mimeType === mime;
export const projectsOn = (canvas: CanvasContents) =>
  Object.values(canvas.items).filter((i) => hasMime(i, PROJECT_MIME));
export const nodesOn = (canvas: CanvasContents, projectId: string) =>
  Object.values(canvas.items).filter(
    (i) => i.properties[PROP.project] === projectId && hasMime(i, NODE_MIME),
  );
export const checkpointsOn = (canvas: CanvasContents, projectId: string) =>
  Object.values(canvas.items).filter(
    (i) =>
      i.properties[PROP.project] === projectId && hasMime(i, CHECKPOINT_MIME),
  );
export const originId = (item: Item) => item.properties[PROP.origin] ?? item.id;
export function outgoing(item: Item): AnatomyEdge[] {
  const value: unknown = JSON.parse(item.properties[PROP.edges] ?? "[]");
  if (!Array.isArray(value))
    throw new Error(`Invalid relationships on ${item.title}`);
  return value.map((entry: unknown) => {
    if (
      !entry ||
      typeof entry !== "object" ||
      !("id" in entry) ||
      typeof entry.id !== "string" ||
      !("from" in entry) ||
      typeof entry.from !== "string" ||
      !("to" in entry) ||
      typeof entry.to !== "string"
    )
      throw new Error(`Invalid relationship on ${item.title}`);
    const label = "label" in entry ? entry.label : undefined;
    const coupling = "coupling" in entry ? entry.coupling : undefined;
    if (label !== undefined && typeof label !== "string")
      throw new Error("Invalid edge label");
    if (
      coupling !== undefined &&
      coupling !== "tight" &&
      coupling !== "contract" &&
      coupling !== "loose"
    )
      throw new Error("Invalid edge coupling");
    return {
      id: entry.id,
      from: entry.from,
      to: entry.to,
      ...(label !== undefined ? { label } : {}),
      ...(coupling !== undefined ? { coupling } : {}),
    };
  });
}

export function projectEdges(
  canvas: CanvasContents,
  projectId: string,
): Array<ModuleEdge & { label: string; coupling?: string }> {
  const nodes = nodesOn(canvas, projectId);
  const allowed = new Set(nodes.map((i) => i.id));
  const out: Array<ModuleEdge & { label: string; coupling?: string }> = [];
  for (const to of nodes) {
    const from = canvas.items[to.properties[PROP.parent] ?? ""];
    if (from && allowed.has(from.id))
      out.push({ from, to, label: to.properties[PROP.relation] ?? "supports" });
    // A malformed manually edited property must not crash the host underlay.
    try {
      for (const edge of outgoing(to)) {
        const target = canvas.items[edge.to];
        if (target && allowed.has(target.id))
          out.push({
            from: to,
            to: target,
            label: edge.label ?? "",
            ...(edge.coupling ? { coupling: edge.coupling } : {}),
          });
      }
    } catch {
      /* The project reader reports the invalid property. */
    }
  }
  return out;
}

export function convergence(nodes: readonly AnatomyNode[]): number {
  return nodes.length
    ? Math.round(
        (nodes.filter((n) => n.status === "settled").length * 100) /
          nodes.length,
      )
    : 0;
}
export function decisions(project: AnatomyProject): AnatomyNode[] {
  const order = { conflict: 0, risk: 1, missing: 2, settled: 3 };
  return project.nodes
    .filter((n) => n.status !== "settled")
    .sort(
      (a, b) =>
        order[a.status] - order[b.status] || a.title.localeCompare(b.title),
    );
}
/** Each depth gets a column; siblings keep source order. Cycles remain visible. */
export function layoutProject(canvas: CanvasContents, projectId: string) {
  const root = canvas.items[projectId];
  if (!root) return [];
  const nodes = nodesOn(canvas, projectId);
  const byId = new Map(nodes.map((i) => [i.id, i]));
  const counts = new Map<number, number>();
  const width = Math.max(NODE_SIZE.width, ...nodes.map((i) => i.width));
  const height = Math.max(NODE_SIZE.height, ...nodes.map((i) => i.height));
  return nodes.map((item) => {
    const seen = new Set([item.id]);
    let parent = item.properties[PROP.parent],
      depth = 0;
    while (parent && byId.has(parent) && !seen.has(parent)) {
      seen.add(parent);
      depth++;
      parent = byId.get(parent)!.properties[PROP.parent];
    }
    const row = counts.get(depth) ?? 0;
    counts.set(depth, row + 1);
    return {
      itemId: item.id,
      x: root.x + root.width + 100 + depth * (width + 100),
      y: root.y + row * (height + 90),
    };
  });
}

export const anatomyModule: CoreModule = {
  name: "@isocan/anatomy",
  propertyKeys: Object.values(PROP),
  kinds: [
    {
      id: "anatomy-project",
      mimes: [PROJECT_MIME],
      label: "Anatomy projects",
      noun: "Anatomy project",
      icon: "file",
    },
    {
      id: "anatomy-node",
      mimes: [NODE_MIME],
      label: "Concepts",
      noun: "concept",
      icon: "file",
    },
    {
      id: "anatomy-checkpoint",
      mimes: [CHECKPOINT_MIME],
      label: "Checkpoints",
      noun: "checkpoint",
      icon: "file",
    },
  ],
  edges: (canvas) =>
    projectsOn(canvas).flatMap((p) => projectEdges(canvas, p.id)),
  contextPieces: (canvas) =>
    projectsOn(canvas).map((p) => ({
      name: p.title,
      source: "canvas",
      present: true,
      size: `${nodesOn(canvas, p.id).length} Anatomy concepts`,
    })),
};
export default anatomyModule;
