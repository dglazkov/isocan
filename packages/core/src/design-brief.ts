import { validateContextManifest, type ContextManifest } from "./canvas-group-context.ts";
import { parseDesignArtifactRef, parseDesignReference, type DesignBrief } from "./design-partner.ts";
import { bad, object, recordFields, text, choice, list, unique, ids, nullableText, fidelity, base } from "./design-partner-values.ts";

/** Reuses the retained-context validator and preserves known facts separately from stated assumptions. */
export function parseDesignBrief(value: unknown): DesignBrief {
  const v = object(value, [...recordFields, "requestingActorId", "source", "progress", "intent", "fidelity", "delivery", "targetItemId", "groupId", "audience", "primaryTask", "constraints", "facts", "context", "references", "outstandingDecisionIds", "outputIds"]); if (v.kind !== "brief") bad("Expected a brief.");
  const rawSource = object(v.source);
  const entrance = choice(rawSource.entrance, ["canvas-chat", "external-agent"]);
  object(rawSource, entrance === "canvas-chat" ? ["entrance", "threadId", "commentId"] : ["entrance", "externalRequestId"]);
  const source: DesignBrief["source"] = entrance === "canvas-chat" ? { entrance, threadId: text(rawSource.threadId), commentId: text(rawSource.commentId) } : { entrance, externalRequestId: text(rawSource.externalRequestId) };
  const rawContext = object(v.context);
  validateContextManifest(rawContext as unknown as ContextManifest, text(rawContext.canvasId));
  return { ...base(v), kind: "brief", requestingActorId: text(v.requestingActorId), source,
    progress: choice(v.progress, ["active", "cancelled", "completed"]), intent: choice(v.intent, ["create", "extend", "refine"]), fidelity: fidelity(v.fidelity), delivery: choice(v.delivery, ["html-node", "connected-app", "wireframe", "exploration"]), targetItemId: nullableText(v.targetItemId), groupId: nullableText(v.groupId), audience: nullableText(v.audience), primaryTask: nullableText(v.primaryTask), constraints: list(v.constraints, text),
    facts: unique(list(v.facts, (entry) => { const f = object(entry, ["id", "name", "value", "origin", "sources"]); return { id: text(f.id), name: text(f.name), value: text(f.value), origin: choice(f.origin, ["supplied", "context", "assumed"]), sources: list(f.sources, parseDesignArtifactRef) }; }), (f) => f.id),
    context: structuredClone(rawContext) as unknown as ContextManifest, references: unique(list(v.references, parseDesignReference), (r) => r.id), outstandingDecisionIds: ids(v.outstandingDecisionIds), outputIds: ids(v.outputIds),
  };
}
