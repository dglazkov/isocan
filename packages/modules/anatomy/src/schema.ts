import { z } from "zod";

export const AXES = ["goal", "structure", "data", "rules"] as const;
export const STATUSES = ["settled", "conflict", "risk", "missing"] as const;
export const DISCIPLINES = [
  "product",
  "ux",
  "engineering",
  "security",
] as const;
export const AXIS_LABELS = {
  goal: "Goal & Intent",
  structure: "Structure & Flow",
  data: "Data & States",
  rules: "Rules & Guardrails",
};
export const DISCIPLINE_LABELS = {
  product: "Product",
  ux: "UX & Design",
  engineering: "Engineering",
  security: "Security",
};
const axis = z.enum(AXES);
const status = z.enum(STATUSES);
const id = z.string().min(1);
const priority = z.enum(["P0", "P1", "P2", "P3"]);
const reversibility = z.enum(["R0", "R1", "R2", "R3"]);
export const evidenceSchema = z
  .object({
    id: id.optional(),
    sourceId: id,
    sourceTitle: z.string().optional(),
    uri: z.string().optional(),
    snippet: z.string().optional(),
    citation: z.string().optional(),
    claimValue: z.string().optional(),
  })
  .strict();
const commentSchema = z
  .object({
    id,
    author: z.string(),
    authorRole: z.enum(["human", "agent"]),
    timestamp: z.string(),
    text: z.string(),
  })
  .strict();
const mockSchema = z
  .object({
    title: z.string(),
    htmlContent: z.string(),
    proposedConstraints: z.array(z.string()),
    status: z.enum(["draft", "promoted"]),
    updatedAt: z.string(),
  })
  .strict();
const evaluationSchema = z
  .object({
    status,
    priority: priority.optional(),
    reversibility: reversibility.optional(),
    summary: z.string(),
    reason: z.string().optional(),
  })
  .strict();
export const nodeSchema = z
  .object({
    id,
    title: z.string().min(1),
    category: axis,
    status,
    summary: z.string(),
    priority: priority.optional(),
    reversibility: reversibility.optional(),
    parentId: id.optional(),
    parentRelation: z.string().optional(),
    reason: z.string().optional(),
    knockOnReason: z.string().optional(),
    conflictAxis: axis.optional(),
    evidence: z.array(evidenceSchema).default([]),
    resolutionOptions: z
      .array(
        z
          .object({
            id,
            label: z.string(),
            description: z.string(),
            resultingSummary: z.string(),
          })
          .strict(),
      )
      .default([]),
    marginalia: z.array(commentSchema).default([]),
    proposedMock: mockSchema.optional(),
    lenses: z
      .object({
        product: evaluationSchema.optional(),
        ux: evaluationSchema.optional(),
        engineering: evaluationSchema.optional(),
        security: evaluationSchema.optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export const nodeBodySchema = nodeSchema.omit({
  id: true,
  title: true,
  parentId: true,
  parentRelation: true,
});
export const edgeSchema = z
  .object({
    id,
    from: id,
    to: id,
    label: z.string().optional(),
    coupling: z.enum(["tight", "contract", "loose"]).optional(),
  })
  .strict();
export const sourceSchema = z
  .object({
    id,
    title: z.string(),
    kind: z.enum(["code", "document", "mock", "voice", "rule"]),
    pathOrUri: z.string(),
    addedAt: z.string(),
  })
  .strict();
export const checkpointSchema = z
  .object({
    id,
    stepIndex: z.number().int().nonnegative(),
    title: z.string(),
    timestamp: z.string(),
    triggerAxis: z.enum([...AXES, "bootstrap"]),
    triggerDescription: z.string(),
    convergenceScore: z.number().min(0).max(100),
    nodes: z.array(nodeSchema),
    edges: z.array(edgeSchema),
  })
  .strict();
export const projectSchema = z
  .object({
    id,
    projectName: z.string().min(1),
    repoPath: z.string().default(""),
    goalStatement: z.string().default(""),
    analysisStrategy: z.enum(["split", "integrated"]).default("split"),
    critiqueIterations: z.number().int().nonnegative().default(1),
    agentActivity: z.string().default("Idle"),
    activityLog: z
      .array(
        z
          .object({
            id,
            timestamp: z.string(),
            actor: z.enum(["human", "agent", "system"]),
            text: z.string(),
          })
          .strict(),
      )
      .optional(),
    brief: z.string().optional(),
    sources: z.array(sourceSchema).default([]),
    nodes: z.array(nodeSchema),
    edges: z.array(edgeSchema).default([]),
    checkpoints: z.array(checkpointSchema).default([]),
    activeCheckpointId: z.string().nullable().default(null),
    lastUpdated: z.string(),
  })
  .strict();
export const projectBodySchema = projectSchema.omit({
  id: true,
  projectName: true,
  nodes: true,
  edges: true,
  checkpoints: true,
});
export type AnatomyNode = z.infer<typeof nodeSchema>;
export type AnatomyProject = z.infer<typeof projectSchema>;
export type ProjectBody = z.infer<typeof projectBodySchema>;
export type Checkpoint = z.infer<typeof checkpointSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type AnatomyEdge = z.infer<typeof edgeSchema>;

function unique(values: string[], label: string): void {
  if (new Set(values).size !== values.length)
    throw new Error(`Duplicate ${label} id`);
}
export function validateGraph(
  nodes: AnatomyNode[],
  edges: AnatomyEdge[],
): void {
  unique(
    nodes.map((n) => n.id),
    "concept",
  );
  unique(
    edges.map((e) => e.id),
    "edge",
  );
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const node of nodes) {
    const seen = new Set([node.id]);
    let parent = node.parentId;
    while (parent) {
      if (!byId.has(parent))
        throw new Error(`Missing parent ${parent} for ${node.id}`);
      if (seen.has(parent)) throw new Error(`Parent cycle at ${node.id}`);
      seen.add(parent);
      parent = byId.get(parent)!.parentId;
    }
  }
  for (const edge of edges) {
    if (!byId.has(edge.from) || !byId.has(edge.to))
      throw new Error(`Missing endpoint for edge ${edge.id}`);
  }
}
export function parseProject(value: unknown): AnatomyProject {
  const project = projectSchema.parse(value);
  validateGraph(project.nodes, project.edges);
  unique(
    project.sources.map((s) => s.id),
    "source",
  );
  unique(
    project.checkpoints.map((c) => c.id),
    "checkpoint",
  );
  for (const checkpoint of project.checkpoints)
    validateGraph(checkpoint.nodes, checkpoint.edges);
  return project;
}
