import type { Comment, DesignArtifactRef, DesignReference } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { LocalExactReferenceCard } from "./ExactReferenceCard.tsx";

function sameReference(a: DesignArtifactRef, b: DesignArtifactRef): boolean {
  return a.home === b.home && a.canvasId === b.canvasId && a.itemId === b.itemId && a.versionId === b.versionId && a.blobHash === b.blobHash;
}

/** Canonical questionnaire history renders named outcomes and retained references; the typed record remains authoritative. */
export function DesignComment({ comment }: { comment: Comment }) {
  const canvas = useCanvasStore((state) => state.canvas);
  const canvasId = useCanvasStore((state) => state.canvasId);
  const names = useCanvasStore((state) => state.actorNames);
  const design = comment.design;
  if (!design) return <p>{comment.body}</p>;
  const reference = (artifact: DesignArtifactRef, name?: string) => {
    const retained = comment.designReferences?.find((entry) => sameReference(entry.artifact, artifact));
    return <LocalExactReferenceCard localCanvasId={canvasId ?? ""} key={JSON.stringify(artifact)} artifact={artifact} version={retained?.version} name={name ?? retained?.version.filename} />;
  };
  const supplied = (ref: DesignReference) => ref.artifact ? reference(ref.artifact) : <p key={ref.id}>{ref.url && <a href={ref.url} target="_blank" rel="noopener noreferrer">{ref.url}</a>}<small> · {ref.state === "supplied" ? "Supplied, not inspected" : ref.state}{ref.reason ? `: ${ref.reason}` : ""}</small></p>;
  if (design.kind === "questions") return <div className="design-comment" data-design-question-comment={design.id}>
    <strong>{design.headline}</strong>
    {design.inferredAnswers.length > 0 && <details><summary>Using what is already known</summary>{design.inferredAnswers.map((answer) => <p key={answer.questionId}>{answer.value}</p>)}</details>}
    {design.questions.map((question) => <section key={question.id}><p><strong>{question.title}</strong><br />{question.consequence}</p>{question.options.length > 0 && <ul>{question.options.map((option) => <li key={option.id}><strong>{option.title}</strong>{question.recommendedOptionId === option.id && " · Recommended"}<br />{option.consequence}{option.preview && reference(option.preview, option.title)}</li>)}</ul>}</section>)}
  </div>;
  const source = canvas?.threads[design.question.threadId]?.comments.find((one) => one.id === design.question.commentId)?.design;
  const questions = source?.kind === "questions" && source.id === design.question.payloadId && source.revision === design.question.revision ? source.questions : [];
  return <div className="design-comment" data-design-answer-comment={design.id}>
    <strong>Design answers</strong>
    {design.resolutions.map((resolution) => {
      const question = questions.find((one) => one.id === resolution.questionId);
      return <section key={resolution.questionId}><p><strong>{question?.title ?? "Earlier question"}</strong></p>
        {resolution.state === "answered" ? resolution.value.kind === "text" ? <p>{resolution.value.text}</p> : resolution.value.kind === "references" ? resolution.value.references.map(supplied) : <ul>{resolution.value.optionIds.map((id) => <li key={id}>{question?.options.find((option) => option.id === id)?.title ?? "Earlier selection"}</li>)}</ul>
          : <p>{resolution.state === "skipped" ? "Skipped; no answer supplied." : resolution.state === "dismissed" ? "Dismissed." : resolution.state === "delegated" ? `Delegated to ${names[resolution.agentActorId] ?? "an agent"}.` : "No answer supplied."}</p>}
      </section>;
    })}
    <details><summary>Answer details</summary><p>Answer {design.id}</p><p>Source {design.question.threadId} / {design.question.commentId}</p>{design.resolutions.map((resolution) => <p key={resolution.questionId}>Question {resolution.questionId}{resolution.state === "answered" && resolution.value.kind === "options" ? ` · options ${resolution.value.optionIds.join(", ")}` : ` · ${resolution.state}`}</p>)}</details>
  </div>;
}
