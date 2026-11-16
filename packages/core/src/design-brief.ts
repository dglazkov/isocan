/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { validateContextManifest, type ContextManifest } from "./canvas-group-context.ts";
import type { DesignBrief } from "./design-partner.ts";
import { bad, object, recordFields, text, choice, list, unique, ids, nullableText, fidelity, base, parseDesignArtifactRef, parseDesignReference, parseDesignContinuation } from "./design-partner-values.ts";

/** Reuses the retained-context validator and preserves known facts separately from stated assumptions. */
export function parseDesignBrief(value: unknown): DesignBrief {
  const v = object(value, [...recordFields, "requestingActorId", "source", "progress", "intent", "fidelity", "delivery", "targetItemId", "groupId", "audience", "primaryTask", "constraints", "facts", "context", "references", "outstandingDecisionIds", "outputIds", "continuation"]); if (v.kind !== "brief") bad("Expected a brief.");
  const rawSource = object(v.source);
  const entrance = choice(rawSource.entrance, ["canvas-chat", "external-agent"]);
  object(rawSource, entrance === "canvas-chat" ? ["entrance", "threadId", "commentId"] : ["entrance", "externalRequestId"]);
  const source: DesignBrief["source"] = entrance === "canvas-chat" ? { entrance, threadId: text(rawSource.threadId), commentId: text(rawSource.commentId) } : { entrance, externalRequestId: text(rawSource.externalRequestId) };
  const rawContext = object(v.context);
  validateContextManifest(rawContext as unknown as ContextManifest, text(rawContext.canvasId));
  return { ...base(v), kind: "brief", requestingActorId: text(v.requestingActorId), source, ...(v.continuation === undefined ? {} : { continuation: parseDesignContinuation(v.continuation) }),
    progress: choice(v.progress, ["active", "cancelled", "completed"]), intent: choice(v.intent, ["create", "extend", "refine"]), fidelity: fidelity(v.fidelity), delivery: choice(v.delivery, ["html-node", "connected-app", "wireframe", "exploration"]), targetItemId: nullableText(v.targetItemId), groupId: nullableText(v.groupId), audience: nullableText(v.audience), primaryTask: nullableText(v.primaryTask), constraints: list(v.constraints, text),
    facts: unique(list(v.facts, (entry) => { const f = object(entry, ["id", "name", "value", "origin", "sources"]); return { id: text(f.id), name: text(f.name), value: text(f.value), origin: choice(f.origin, ["supplied", "context", "assumed"]), sources: list(f.sources, parseDesignArtifactRef) }; }), (f) => f.id),
    context: structuredClone(rawContext) as unknown as ContextManifest, references: unique(list(v.references, parseDesignReference), (r) => r.id), outstandingDecisionIds: ids(v.outstandingDecisionIds), outputIds: ids(v.outputIds),
  };
}
