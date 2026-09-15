import { type DesignQuestionSet } from "./design-partner.js";
import { type LegacyQuestionnaire } from "./questionnaire.js";
/** Converts an explicitly selected legacy source using supplied request and respondent identities. */
export declare function legacyQuestionSet(payload: LegacyQuestionnaire, identity: Pick<DesignQuestionSet, "requestId" | "epoch" | "brief" | "respondentActorId" | "id" | "revision">): DesignQuestionSet;
