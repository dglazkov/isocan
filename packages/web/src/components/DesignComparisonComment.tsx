import type { Actor, Comment } from "@isocan/core";
import { DesignComparisonButton } from "./DesignComparisonButton.tsx";

/** Canonical comparison prose displays its real authorship; an agent report never becomes human preference. */
export function DesignComparisonComment({ comment, canvasId, actor, threadId }: { comment: Comment; canvasId: string; actor: Actor; threadId: string }) {
  const record = comment.designDecision?.record;
  if (!record) return <p>{comment.body}</p>;
  if (record.kind === "comparison") return <div className="design-comparison-comment" data-design-comparison-comment={record.id}>
    <strong>{record.uncertainty === "structure" ? "Choose the workflow" : "Choose the visual direction"}</strong><p>{record.scenario}</p>
    <p>{record.fidelity === "wireframe" ? "Working wireframes" : record.fidelity === "designed" ? "Designed alternatives" : "Implementation proposals"} · {record.alternatives.length} {record.alternatives.length === 1 ? "proposal" : "options"}</p>
    <p><strong>Recommended by {comment.author.name}: {record.alternatives.find((option) => option.id === record.recommendedAlternativeId)?.title}</strong><br />{record.recommendation}</p>
    <DesignComparisonButton canvasId={canvasId} actor={actor} filter={{ requestId: record.requestId, decisionKey: record.decisionKey }} source={{ threadId, commentId: comment.id, payloadId: record.id, revision: record.revision }} />
  </div>;
  if (record.kind === "comparison-response") return <div className="design-comparison-comment" data-design-comparison-response={record.id}>
    <strong>{record.authority.kind === "external-report" ? `Native request reported by ${comment.author.name}` : `${comment.author.name} responded`}</strong>
    <p>{record.outcome.kind === "delegate" ? "Delegated this decision to a named designer." : record.outcome.kind === "more" ? `Requested ${record.outcome.count ?? "more"} directions.${record.outcome.instruction ? ` ${record.outcome.instruction}` : ""}` : record.outcome.kind === "combine" ? `Requested a combination: ${record.outcome.instruction}` : record.outcome.kind === "skip" ? "Skipped this decision; no preference supplied." : "Dismissed this comparison; no preference supplied."}</p>
    <DesignComparisonButton canvasId={canvasId} actor={actor} filter={{ requestId: record.requestId }} source={record.comparison}>View comparison and history</DesignComparisonButton>
  </div>;
  const input = record.input, option = record.comparison.alternatives.find((one) => one.id === input.chosenAlternativeId), authority = input.authority;
  return <div className="design-comparison-comment" data-design-adoption-comment={input.id}>
    <strong>{option?.title ?? "Selected option"} adopted</strong><p>{authority.kind === "human-choice" ? `Chosen by ${comment.author.name}` : authority.kind === "external-report" ? `Native ${authority.reportedOutcome} reported by ${comment.author.name}` : authority.kind === "canvas-delegation" ? `Decided by ${comment.author.name} under a recorded delegation` : `Designer judgment by ${comment.author.name}`}</p>
    {authority.kind === "human-choice" ? authority.reason && <p>{authority.reason}</p> : <p>{authority.rationale}</p>}
    <DesignComparisonButton canvasId={canvasId} actor={actor} filter={{ requestId: input.requestId, decisionKey: input.decisionKey }} source={input.source.kind === "comparison" ? input.source.source : undefined}>View comparison and history</DesignComparisonButton>
  </div>;
}
