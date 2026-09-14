import { parseProject } from "../src/schema.ts";

export const sampleProject = () =>
  parseProject({
    id: "project_acme",
    projectName: "Acme Workshop",
    repoPath: "/example/acme",
    goalStatement: "Help a small team turn requests into reliable deliveries.",
    brief:
      "## From request to delivery\n\nA customer submits a request. The team agrees a delivery window and records progress.\n\n## Decisions to make\n\nThe team still needs a recovery path when a delivery is delayed.",
    nodes: [
      {
        id: "goal",
        title: "Reliable delivery",
        category: "goal",
        status: "settled",
        summary: "Customers can understand what will arrive and when.",
        evidence: [
          {
            sourceId: "spec",
            sourceTitle: "Service specification",
            citation: "lines 1-3",
            snippet: "Every request has an agreed delivery window.",
          },
        ],
        lenses: {
          product: {
            status: "settled",
            summary: "Provides a clear customer commitment.",
          },
        },
      },
      {
        id: "workflow",
        title: "Request workflow",
        category: "structure",
        parentId: "goal",
        parentRelation: "delivers",
        status: "conflict",
        summary: "A request moves from intake to an agreed delivery.",
        reason: "Customers cannot recover when the agreed delivery is delayed.",
        conflictAxis: "goal",
        evidence: [
          {
            sourceId: "flow",
            sourceTitle: "Request workflow",
            snippet: "intake → accepted → delivered",
          },
        ],
        resolutionOptions: [
          {
            id: "recover",
            label: "Add a recovery step",
            description: "Let the customer revise the delivery window.",
            resultingSummary:
              "A request supports intake, delivery and explicit recovery.",
          },
        ],
        lenses: {
          ux: {
            status: "conflict",
            summary: "Recovery needs an explicit action.",
          },
          engineering: {
            status: "risk",
            summary: "Retries need stable request identity.",
          },
        },
        marginalia: [
          {
            id: "historic_1",
            author: "Alex",
            authorRole: "human",
            timestamp: "2026-09-01T12:00:00.000Z",
            text: "Keep the customer informed.",
          },
        ],
      },
      {
        id: "state",
        title: "Request record",
        category: "data",
        parentId: "workflow",
        status: "settled",
        summary: "The request stores its delivery window and current state.",
      },
      {
        id: "policy",
        title: "Access boundary",
        category: "rules",
        parentId: "goal",
        status: "missing",
        summary: "Only the owning team may change a request.",
        reason: "The ownership check is not specified yet.",
        conflictAxis: "data",
      },
    ],
    edges: [
      {
        id: "workflow_state",
        from: "workflow",
        to: "state",
        label: "updates",
        coupling: "contract",
      },
    ],
    sources: [
      {
        id: "spec",
        title: "Service specification",
        kind: "document",
        pathOrUri: "docs/spec.md",
        addedAt: "2026-09-01T12:00:00.000Z",
      },
      {
        id: "flow",
        title: "Request workflow",
        kind: "code",
        pathOrUri: "src/workflow.ts",
        addedAt: "2026-09-01T12:00:00.000Z",
      },
    ],
    checkpoints: [],
    activeCheckpointId: null,
    lastUpdated: "2026-09-01T12:00:00.000Z",
  });
