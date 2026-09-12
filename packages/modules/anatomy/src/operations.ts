import {
  newGroupId,
  newItemId,
  newVersionId,
  newId,
  newCommentId,
  newThreadId,
  anchorOffset,
  type CanvasContents,
  type Item,
  type NewVersion,
  type Operation,
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
}
const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
async function version(
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
function nodeBody(node: AnatomyNode) {
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
function nodeProps(
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
function edgeProps(
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
      { type: "item.addVersion", itemId: item.id, version: next },
      {
        type: "item.update",
        itemId: item.id,
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
  await assertFresh(io, [projectItem, ...items]);
  const props = nodeProps(node, projectItem.id, ids);
  const ops: Operation[] = existing
    ? [
        { type: "item.addVersion", itemId: nativeId, version: next },
        {
          type: "item.update",
          itemId: nativeId,
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
  await io.send(ops, newGroupId());
  return nativeId;
}

export async function saveEdge(
  io: AnatomyIO,
  canvas: CanvasContents,
  projectItem: Item,
  project: AnatomyProject,
  input: unknown,
): Promise<void> {
  const edge = edgeSchema.parse(input);
  const next = {
    ...project,
    edges: [...project.edges.filter((e) => e.id !== edge.id), edge],
  };
  validateGraph(next.nodes, next.edges);
  const items = nodesOn(canvas, projectItem.id);
  const ids = new Map(items.map((i) => [originId(i), i.id]));
  const affected = items.filter(
    (i) =>
      originId(i) === edge.from ||
      project.edges.some((e) => e.id === edge.id && e.from === originId(i)),
  );
  await assertFresh(io, affected);
  await io.send(
    affected.map((item): Operation => ({
      type: "item.update",
      itemId: item.id,
      patch: {
        properties: { [PROP.edges]: edgeProps(next, originId(item), ids) },
      },
    })),
    newGroupId(),
  );
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

/** Restore concepts only; the project goal, attached sources and other work stay put. */
export async function restoreCheckpoint(
  io: AnatomyIO,
  canvas: CanvasContents,
  projectItem: Item,
  input: unknown,
): Promise<void> {
  const checkpoint = checkpointSchema.parse(input);
  validateGraph(checkpoint.nodes, checkpoint.edges);
  const items = nodesOn(canvas, projectItem.id);
  const byOrigin = new Map(items.map((i) => [originId(i), i]));
  const ids = new Map(
    checkpoint.nodes.map((n) => [n.id, byOrigin.get(n.id)?.id ?? newItemId()]),
  );
  const wanted = new Set(checkpoint.nodes.map((n) => n.id));
  const ops: Operation[] = [];
  const edgeProject = { edges: checkpoint.edges };
  for (const [index, node] of checkpoint.nodes.entries()) {
    const existing = byOrigin.get(node.id);
    const next = await version(
      io,
      nodeBody(node),
      NODE_MIME,
      "concept.anatomy.json",
    );
    const props = {
      ...nodeProps(node, projectItem.id, ids),
      [PROP.edges]: edgeProps(edgeProject, node.id, ids),
    };
    if (existing)
      ops.push(
        { type: "item.addVersion", itemId: existing.id, version: next },
        {
          type: "item.update",
          itemId: existing.id,
          patch: { title: node.title, properties: props },
        },
      );
    else
      ops.push({
        type: "item.add",
        itemId: ids.get(node.id)!,
        title: node.title,
        ...NODE_SIZE,
        version: next,
        properties: props,
        placement: { x: projectItem.x + 460, y: projectItem.y + index * 300 },
      });
  }
  const removed = items
    .filter((i) => !wanted.has(originId(i)))
    .map((i) => i.id);
  if (removed.length) ops.push({ type: "items.delete", itemIds: removed });
  await assertFresh(io, [projectItem, ...items]);
  await io.send(ops, newGroupId());
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
  await io.send(
    [
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
        type: "item.addVersion",
        itemId: projectItem.id,
        version: projectVersion,
      },
      { type: "item.addVersion", itemId: item.id, version: nodeVersion },
    ],
    newGroupId(),
  );
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

export async function loadProject(io: AnatomyIO, ref: string) {
  const canvas = await io.snapshot();
  const candidates = Object.values(canvas.items).filter(
    (i) =>
      hasMime(i, PROJECT_MIME) &&
      (i.id === ref || i.title.toLowerCase() === ref.toLowerCase()),
  );
  if (candidates.length !== 1)
    throw new Error(
      `Choose one Anatomy project by its item id (found ${candidates.length})`,
    );
  const item = candidates[0]!;
  return { canvas, item, project: await readProject(canvas, item, io.read) };
}

export { layoutProject, checkpointsOn };
