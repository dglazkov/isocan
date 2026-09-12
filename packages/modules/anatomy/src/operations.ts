import { inspectProject } from "./diagnostics.ts";
import {
  guardItem,
  newGroupId,
  newItemId,
  newVersionId,
  newId,
  newCommentId,
  newThreadId,
  anchorOffset,
  type Canvas,
  type CanvasContents,
  type Item,
  type NewVersion,
  type Operation,
  type ItemChange,
} from "@isocan/core";
import {
  CHECKPOINT_MIME,
  NODE_MIME,
  NODE_SIZE,
  PROJECT_MIME,
  PROP,
  checkpointsOn,
  convergence,
  currentVersion,
  hasMime,
  layoutProject,
  nodesOn,
  projectsOn,
  originId,
  readProject,
  type ReadText,
} from "./core.ts";
import {
  checkpointSchema,
  edgeSchema,
  nodeBodySchema,
  nodeSchema,
  parseProject,
  projectBodySchema,
  validateGraph,
  type AnatomyNode,
  type AnatomyProject,
  type Checkpoint,
} from "./schema.ts";

/** Both clients adapt their ordinary host to this content/operation boundary. */
export interface AnatomyIO {
  read: ReadText;
  put: (
    text: string,
    mime: string,
    filename: string,
  ) => Promise<{ blobHash: string; size: number }>;
  send: (ops: readonly Operation[], group?: string) => Promise<void>;
  snapshot: () => Promise<CanvasContents>;
  record: () => Promise<Canvas>;
}
const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
export async function version(
  io: AnatomyIO,
  value: unknown,
  mime: string,
  filename: string,
): Promise<NewVersion> {
  return {
    ...(await io.put(json(value), mime, filename)),
    id: newVersionId(),
    mimeType: mime,
    filename,
  };
}
export function nodeBody(node: AnatomyNode) {
  const {
    id: _id,
    title: _title,
    parentId: _parent,
    parentRelation: _relation,
    ...body
  } = node;
  return nodeBodySchema.parse(body);
}
function projectBody(project: AnatomyProject) {
  const {
    id: _id,
    projectName: _title,
    nodes: _nodes,
    edges: _edges,
    checkpoints: _checkpoints,
    ...body
  } = project;
  return projectBodySchema.parse(body);
}
export function nodeProps(
  node: AnatomyNode,
  projectId: string,
  ids: Map<string, string>,
): Record<string, string> {
  return {
    [PROP.project]: projectId,
    [PROP.origin]: node.id,
    [PROP.parent]: node.parentId ? ids.get(node.parentId)! : "",
    [PROP.relation]: node.parentRelation ?? "",
  };
}
export function edgeProps(
  project: Pick<AnatomyProject, "edges">,
  nodeId: string,
  ids: Map<string, string>,
): string {
  return json(
    project.edges
      .filter((e) => e.from === nodeId)
      .map((e) => ({ ...e, from: ids.get(e.from)!, to: ids.get(e.to)! })),
  );
}
async function assertFresh(io: AnatomyIO, items: Item[]): Promise<void> {
  const current = await io.snapshot();
  for (const item of items) {
    const now = current.items[item.id];
    // Moves and redundant metadata echoes stamp updatedAt too. Compare the
    // facts an edit can replace; canvas geometry is independent of its draft.
    if (
      !now ||
      now.currentVersionId !== item.currentVersionId ||
      now.title !== item.title ||
      JSON.stringify(now.properties) !== JSON.stringify(item.properties)
    )
      throw new Error(
        `“${item.title}” changed while editing. Reload it before saving.`,
      );
  }
}
export function emptyProject(title: string): AnatomyProject {
  return parseProject({
    id: newId("anatomy"),
    projectName: title,
    nodes: [],
    lastUpdated: new Date().toISOString(),
  });
}

/** Validate everything before putting bytes or sending operations. */
export async function importProject(
  io: AnatomyIO,
  input: unknown,
): Promise<string> {
  const project = parseProject(input);
  const before = await io.snapshot();
  const record = await io.record();
  const projectId = newItemId();
  const ids = new Map(project.nodes.map((n) => [n.id, newItemId()]));
  const x = Math.max(
    0,
    ...Object.values(before.items).map((i) => i.x + i.width + 180),
  );
  const ops: Operation[] = [
    {
      type: "item.add",
      itemId: projectId,
      title: project.projectName,
      width: 360,
      height: 240,
      placement: { x, y: 0, chosen: true },
      properties: { [PROP.origin]: project.id },
      version: await version(
        io,
        projectBody(project),
        PROJECT_MIME,
        "project.anatomy.json",
      ),
    },
  ];
  const byId = new Map(project.nodes.map((n) => [n.id, n]));
  const rows = new Map<number, number>();
  for (const node of project.nodes) {
    let depth = 0,
      parent = node.parentId;
    while (parent) {
      depth++;
      parent = byId.get(parent)!.parentId;
    }
    const row = rows.get(depth) ?? 0;
    rows.set(depth, row + 1);
    ops.push({
      type: "item.add",
      itemId: ids.get(node.id)!,
      title: node.title,
      ...NODE_SIZE,
      placement: { x: x + 460 + depth * 420, y: row * 300, chosen: true },
      properties: {
        ...nodeProps(node, projectId, ids),
        [PROP.edges]: edgeProps(project, node.id, ids),
      },
      version: await version(
        io,
        nodeBody(node),
        NODE_MIME,
        "concept.anatomy.json",
      ),
    });
  }
  for (const [index, checkpoint] of project.checkpoints.entries()) {
    ops.push(
      await checkpointOp(io, projectId, checkpoint, x, -330 - index * 280),
    );
  }
  ops.push({
    type: "project.update",
    patch: {
      properties: {
        ...(!record.properties[PROP.analysis] ? { [PROP.analysis]: projectId } : {}),
        ...(!record.properties[PROP.repository] && !record.properties.repository && project.repoPath ? { [PROP.repository]: project.repoPath } : {}),
      },
    },
  });
  await io.send(ops, newGroupId());
  return projectId;
}

export async function saveProject(
  io: AnatomyIO,
  item: Item,
  project: AnatomyProject,
): Promise<void> {
  const body = projectBody(parseProject(project));
  body.lastUpdated = new Date().toISOString();
  const next = await version(
    io,
    body,
    PROJECT_MIME,
    currentVersion(item).filename,
  );
  await assertFresh(io, [item]);
  await io.send(
    [
      {
        type: "item.edit",
        itemId: item.id,
        version: next,
        expectedVersionId: item.currentVersionId,
        expectedMetadata: { title: item.title, properties: item.properties },
        patch: { title: project.projectName },
      },
    ],
    newGroupId(),
  );
}

export async function saveNode(
  io: AnatomyIO,
  canvas: CanvasContents,
  projectItem: Item,
  project: AnatomyProject,
  input: unknown,
  base?: { versionId: string; title: string; properties: Record<string, string> },
): Promise<string> {
  const node = nodeSchema.parse(input);
  validateGraph(
    [...project.nodes.filter((n) => n.id !== node.id), node],
    project.edges,
  );
  const items = nodesOn(canvas, projectItem.id);
  const existing = items.find((i) => originId(i) === node.id);
  const nativeId = existing?.id ?? newItemId();
  const ids = new Map(items.map((i) => [originId(i), i.id]));
  ids.set(node.id, nativeId);
  const next = await version(
    io,
    nodeBody(node),
    NODE_MIME,
    "concept.anatomy.json",
  );
  if (existing) await assertFresh(io, [existing]);
  const props = nodeProps(node, projectItem.id, ids);
  const ops: Operation[] = existing
    ? [
        {
          type: "item.edit",
          itemId: nativeId,
          version: next,
          expectedVersionId: base?.versionId ?? existing.currentVersionId,
          expectedMetadata: base ?? { title: existing.title, properties: existing.properties },
          patch: { title: node.title, properties: props },
        },
      ]
    : [
        {
          type: "item.add",
          itemId: nativeId,
          version: next,
          title: node.title,
          properties: props,
          ...NODE_SIZE,
          placement: {
            x: projectItem.x + 460,
            y: Math.max(
              projectItem.y,
              ...items.map((i) => i.y + i.height + 90),
            ),
            chosen: true,
          },
        },
      ];
  const previous = project.nodes.find(n => n.id === node.id);
  const hierarchyChanged = !existing || previous?.parentId !== node.parentId;
  await io.send(hierarchyChanged ? [{ type: "items.change", changes: ops as ItemChange[],
    guards: [projectItem, ...items].map(item => guardItem(item)),
    scope: { property: PROP.project, value: projectItem.id, mimeTypes: [NODE_MIME], itemIds: items.map(item => item.id) },
  }] : ops, newGroupId());
  return nativeId;
}

export async function saveEdge(
  io: AnatomyIO, canvas: CanvasContents, projectItem: Item, project: AnatomyProject, input: unknown,
) {
  const edge = edgeSchema.parse(input);
  // Both portable and native concept IDs are accepted at the boundary.
  const items = nodesOn(canvas, projectItem.id);
  const logical = (ref: string) => items.find(item => item.id === ref)?.properties[PROP.origin] ?? ref;
  edge.from = logical(edge.from); edge.to = logical(edge.to);
  await writeEdges(io, canvas, projectItem, project, [...project.edges.filter(e => e.id !== edge.id), edge]);
  return { projectId: projectItem.id, edgeId: edge.id, from: edge.from, to: edge.to };
}

export async function removeEdge(
  io: AnatomyIO, canvas: CanvasContents, projectItem: Item, project: AnatomyProject, edgeId: string,
) {
  if (!project.edges.some(edge => edge.id === edgeId)) throw new Error(`No relationship ${edgeId}`);
  await writeEdges(io, canvas, projectItem, project, project.edges.filter(edge => edge.id !== edgeId));
  return { projectId: projectItem.id, edgeId, removed: true };
}

async function writeEdges(
  io: AnatomyIO, canvas: CanvasContents, projectItem: Item, project: AnatomyProject, edges: AnatomyProject["edges"],
) {
  validateGraph(project.nodes, edges);
  const items = nodesOn(canvas, projectItem.id);
  const ids = new Map(items.map(item => [originId(item), item.id]));
  const changes = items.flatMap(item => {
    const before = edgeProps(project, originId(item), ids);
    const after = edgeProps({ edges }, originId(item), ids);
    return before === after ? [] : [{ type: "item.update" as const, itemId: item.id, patch: { properties: { [PROP.edges]: after } } }];
  });
  if (changes.length) await io.send([{ type: "items.change", changes,
    guards: [projectItem, ...items].map(item => guardItem(item)),
    scope: { property: PROP.project, value: projectItem.id, mimeTypes: [NODE_MIME], itemIds: items.map(item => item.id) },
  }]);
}

async function checkpointOp(
  io: AnatomyIO,
  projectId: string,
  input: Checkpoint,
  x: number,
  y: number,
): Promise<Operation> {
  const checkpoint = checkpointSchema.parse(input);
  validateGraph(checkpoint.nodes, checkpoint.edges);
  return {
    type: "item.add",
    itemId: newItemId(),
    title: checkpoint.title,
    width: 320,
    height: 200,
    placement: { x, y, chosen: true },
    properties: { [PROP.project]: projectId, [PROP.origin]: checkpoint.id },
    version: await version(
      io,
      checkpoint,
      CHECKPOINT_MIME,
      "checkpoint.anatomy.json",
    ),
  };
}
export async function saveCheckpoint(
  io: AnatomyIO,
  item: Item,
  project: AnatomyProject,
  title: string,
): Promise<void> {
  const checkpoint: Checkpoint = {
    id: newId("checkpoint"),
    title,
    stepIndex: project.checkpoints.length,
    timestamp: new Date().toISOString(),
    triggerAxis: "bootstrap",
    triggerDescription: "Saved checkpoint",
    convergenceScore: convergence(project.nodes),
    nodes: project.nodes,
    edges: project.edges,
  };
  await io.send([
    await checkpointOp(
      io,
      item.id,
      checkpoint,
      item.x,
      item.y - 330 - project.checkpoints.length * 280,
    ),
  ]);
}

/** Compatibility helper; interactive callers show the prepared review before applying. */
export async function restoreCheckpoint(io: AnatomyIO, canvas: CanvasContents, projectItem: Item, input: unknown) {
  const { prepareGraphReview, applyGraphReview } = await import("./graph-review.ts");
  const checkpoint = checkpointSchema.parse(input);
  const project = await readEditableProject(canvas, projectItem, io.read);
  return applyGraphReview(io, prepareGraphReview(canvas, projectItem, project, checkpoint, (await io.record()).id));
}

export async function attachSource(
  io: AnatomyIO,
  canvas: CanvasContents,
  projectItem: Item,
  project: AnatomyProject,
  sourceId: string,
  text: string,
  filename: string,
  mime = "text/plain",
): Promise<string> {
  const source = project.sources.find((s) => s.id === sourceId);
  const citation = project.nodes
    .flatMap((n) => n.evidence)
    .find((e) => e.sourceId === sourceId);
  if (!source && !citation)
    throw new Error(`No source or citation ${sourceId} in this project`);
  const existing = Object.values(canvas.items).find(
    (i) =>
      i.properties[PROP.project] === projectItem.id &&
      i.properties[PROP.source] === sourceId,
  );
  const next = {
    ...(await io.put(text, mime, filename)),
    id: newVersionId(),
    mimeType: mime,
    filename,
  };
  const itemId = existing?.id ?? newItemId();
  if (existing) await assertFresh(io, [existing]);
  await io.send(
    existing
      ? [{ type: "item.addVersion", itemId, version: next }]
      : [
          {
            type: "item.add",
            itemId,
            title: source?.title || citation?.sourceTitle || sourceId,
            width: 480,
            height: 360,
            placement: { x: projectItem.x - 600, y: projectItem.y },
            properties: {
              [PROP.project]: projectItem.id,
              [PROP.source]: sourceId,
            },
            version: next,
          },
        ],
  );
  return itemId;
}

export async function promoteMock(
  io: AnatomyIO,
  canvas: CanvasContents,
  projectItem: Item,
  project: AnatomyProject,
  node: AnatomyNode,
): Promise<void> {
  if (!node.proposedMock || node.proposedMock.status !== "draft")
    throw new Error("This concept has no draft mock");
  const item = nodesOn(canvas, projectItem.id).find(
    (i) => originId(i) === node.id,
  );
  if (!item) throw new Error("Concept is no longer on the canvas");
  const sourceId = newId("mock");
  const mock = node.proposedMock;
  const now = new Date().toISOString();
  const html = {
    ...(await io.put(mock.htmlContent, "text/html", "mock.html")),
    id: newVersionId(),
    mimeType: "text/html",
    filename: "mock.html",
  };
  const body = nodeBody({
    ...node,
    status: "settled",
    reason: `Approved mock: ${mock.title}`,
    proposedMock: { ...mock, status: "promoted", updatedAt: now },
    evidence: [
      ...node.evidence,
      {
        sourceId,
        sourceTitle: mock.title,
        snippet: mock.proposedConstraints.join("\n"),
      },
    ],
  });
  const nextProject = projectBody({
    ...project,
    sources: [
      ...project.sources,
      {
        id: sourceId,
        title: mock.title,
        kind: "mock",
        pathOrUri: "mock.html",
        addedAt: now,
      },
    ],
  });
  const nodeVersion = await version(
    io,
    body,
    NODE_MIME,
    "concept.anatomy.json",
  );
  const projectVersion = await version(
    io,
    nextProject,
    PROJECT_MIME,
    "project.anatomy.json",
  );
  await assertFresh(io, [projectItem, item]);
  await io.send([{ type: "items.change", guards: [guardItem(projectItem), guardItem(item)], changes: [
      {
        type: "item.add",
        itemId: newItemId(),
        title: mock.title,
        width: 600,
        height: 440,
        placement: { anchorItemId: item.id },
        properties: { [PROP.project]: projectItem.id, [PROP.source]: sourceId },
        version: html,
      },
      {
        type: "item.edit",
        itemId: projectItem.id,
        version: projectVersion,
        expectedVersionId: projectItem.currentVersionId, patch: {},
      },
      { type: "item.edit", itemId: item.id, version: nodeVersion, expectedVersionId: item.currentVersionId, patch: {} },
    ] }]);
}

export function commentOp(
  canvas: CanvasContents,
  item: Item,
  body: string,
): Operation {
  if (!body.trim()) throw new Error("Write a comment first");
  const thread = Object.values(canvas.threads).find(
    (t) => t.anchorItemId === item.id,
  );
  const comment = { id: newCommentId(), body: body.trim() };
  return thread
    ? { type: "thread.reply", threadId: thread.id, comment }
    : {
        type: "thread.create",
        threadId: newThreadId(),
        ...anchorOffset(item),
        anchorItemId: item.id,
        comment,
      };
}

export { requestAnalysis } from "./runs.ts";

/** Resolve a native analysis without requiring its files to be healthy. */
export async function findProject(io: AnatomyIO, ref: string) {
  const canvas = await io.snapshot();
  const candidates = projectsOn(canvas).filter(
    i => i.id === ref || i.title.toLowerCase() === ref.toLowerCase(),
  );
  if (candidates.length !== 1)
    throw new Error(
      `Choose one Anatomy project by its item id (found ${candidates.length})`,
    );
  const item = candidates[0]!;
  return { canvas, item };
}

/** Mutations must not turn a diagnostic display subset into the authoritative graph. */
export async function readEditableProject(canvas: CanvasContents, item: Item, read: ReadText): Promise<AnatomyProject> {
  const inspection = await inspectProject(canvas, item, read);
  if (!inspection.project || inspection.diagnostics.length)
    throw new Error(`Repair Anatomy files before editing: ${inspection.diagnostics.map(d => `${d.title}: ${d.message}`).join("; ")}`);
  return inspection.project;
}

export async function loadProject(io: AnatomyIO, ref: string) {
  const { canvas, item } = await findProject(io, ref);
  return { canvas, item, project: await readEditableProject(canvas, item, io.read) };
}

export { layoutProject, checkpointsOn };
