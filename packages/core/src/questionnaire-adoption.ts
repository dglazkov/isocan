import { OpValidationError } from "./errors.ts";
import { parseDesignQuestionSet, type DesignQuestionSet } from "./design-partner.ts";
import { parseLegacyQuestionnaire, type LegacyQuestionnaire } from "./questionnaire.ts";

/** Converts an explicitly selected legacy source using supplied request and respondent identities. */
export function legacyQuestionSet(payload: LegacyQuestionnaire, identity: Pick<DesignQuestionSet, "requestId" | "epoch" | "brief" | "respondentActorId" | "id" | "revision">): DesignQuestionSet {
  const valid = parseLegacyQuestionnaire(`/ask ${JSON.stringify(payload)}`);
  if (!valid) throw new OpValidationError("bad-op", "legacy questionnaire is malformed and cannot be adopted");
  return parseDesignQuestionSet({ schemaVersion: 1, kind: "questions", ...identity, headline: valid.headline ?? "Design questions", inferredAnswers: (valid.inferredAnswers ?? []).map((a) => ({ questionId: a.questionId, value: a.displayValue, sources: [] })), supersedes: null,
    questions: valid.questions.map((q) => ({ id: q.id, title: q.title, consequence: q.description ?? "No design consequence was recorded in this legacy question.", renderer: q.renderer === "visual-cards" ? "choice-list" : q.renderer, multiple: q.multiSelect ?? false, skippable: q.skippable ?? true, delegatable: true, options: (q.options ?? []).map((o) => ({ id: o.id, title: o.title, consequence: o.description ?? o.body ?? "No tradeoff was recorded." })) })),
  });
}
