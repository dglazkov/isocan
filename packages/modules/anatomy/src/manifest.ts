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
  analysis: "anatomy.analysis",
  repository: "anatomy.repository",
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
/** The focal concept, its parent/children and both ends of explicit connections.
 * This is a local view of the graph, never a change to its saved layout. */
export function projectNeighborhood(
  project: Pick<AnatomyProject, "nodes" | "edges">,
  nodeId: string,
) {
  const byId = new Map(project.nodes.map((node) => [node.id, node]));
  const focus = byId.get(nodeId);
  if (!focus) throw new Error(`Unknown concept: ${nodeId}`);
  const ids = new Set([nodeId]);
  if (focus.parentId && byId.has(focus.parentId)) ids.add(focus.parentId);
  for (const node of project.nodes)
    if (node.parentId === nodeId) ids.add(node.id);
  for (const edge of project.edges) {
    if (edge.from === nodeId && byId.has(edge.to)) ids.add(edge.to);
    if (edge.to === nodeId && byId.has(edge.from)) ids.add(edge.from);
  }
  const ancestors: AnatomyNode[] = [];
  const seen = new Set([nodeId]);
  let parent = byId.get(focus.parentId ?? "");
  while (parent && !seen.has(parent.id)) {
    ancestors.unshift(parent);
    seen.add(parent.id);
    parent = byId.get(parent.parentId ?? "");
  }
  return {
    focus,
    ancestors,
    nodes: project.nodes.filter((node) => ids.has(node.id)),
    edges: project.edges.filter(
      (edge) => ids.has(edge.from) && ids.has(edge.to),
    ),
  };
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
  commands: [
    {
      name: "anatomy",
      usage: "[repository path or URL]",
      source: "module",
      description:
        "Analyze this project's repository as concepts, decisions and evidence",
      body: `Read the requested repository using your existing access. If no repository is supplied, read the canvas's anatomy.repository property with isocan canvas show. Do not claim an analysis is running unless you are doing it.

Read the repository's instructions, README, architecture, relevant implementations and tests. Infer its goal from those sources. Model cross-functional goals, workflows, data/state boundaries and rules, not a directory inventory or implementation tickets. Distinguish implemented behavior from proposals. Give every concept a summary; give every risk/conflict/missing concept a clear reason, conflictAxis and source citations. Consider product, experience, engineering and security; leave unreviewed lenses unassessed. Never invent evidence or runtime checks.

Use isocan anatomy ls/show to find an existing analysis (the anatomy.analysis canvas property names the attached project item). Update that project's concepts with anatomy node and relationships with anatomy edge; use anatomy sample for the JSON shape. For a first analysis, build a validated portable Anatomy JSON file and anatomy import it onto this canvas. Import attaches the new analysis to the canvas. Record repoPath and the reviewed revision in the overview. Keep original concept IDs stable on subsequent runs, preserve comments and unrelated canvas content, and save an anatomy checkpoint baseline after the read. Publish a concise receipt with findings and limitations in Chat. Analysis is work you carry out through the ordinary CLI, comments, presence and operations.`,
    },
  ],
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
