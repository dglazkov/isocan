import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  currentDesignScope,
  sameActor
} from "./chunk-B7JOBMSP.mjs";

// packages/core/src/design-decision.ts
var designDecisionsRoute = (canvasId) => `/api/projects/${encodeURIComponent(canvasId)}/design/decisions`;
function designDecisionScope(canvas, item) {
  const current = canvas.items[item.id];
  if (!current) throw new Error("The adoption target is unavailable.");
  return currentDesignScope(canvas, current);
}
function designComparisonActions(state, actor, joined) {
  if (state.status === "stale" || state.status === "superseded" || state.adoptedDecisionId !== null) return { respond: false, authorities: [] };
  const a = state.comparison.audience, outcome = state.effectiveResponse?.response.outcome;
  const human = a.kind === "human" && actor.kind === "human" && sameActor(joined, a.respondentActorId, actor.id);
  const native = a.kind === "external-agent" && actor.kind === "agent" && state.currentReporterActorId !== null && sameActor(joined, state.currentReporterActorId, actor.id);
  const delegated = actor.kind === "agent" && state.effectiveResponse?.response.authority.kind === "human" && outcome?.kind === "delegate" && sameActor(joined, outcome.agentActorId, actor.id);
  const revision = outcome?.kind === "more" || outcome?.kind === "combine";
  return { respond: human || native, authorities: revision ? [] : human ? ["human-choice"] : native ? ["external-report"] : delegated ? ["canvas-delegation"] : [] };
}
function effectiveOutstandingDecisionIds(brief, briefItemId, decisions) {
  const settled = new Set(decisions.filter((row) => row.standing === "effective" && row.decision.input.requestId === brief.requestId && row.decision.input.basis.brief.itemId === briefItemId && row.decision.input.basis.epoch === brief.epoch).map((row) => row.decision.input.decisionKey));
  return brief.outstandingDecisionIds.filter((id) => !settled.has(id));
}

export {
  designDecisionsRoute,
  designDecisionScope,
  designComparisonActions,
  effectiveOutstandingDecisionIds
};
