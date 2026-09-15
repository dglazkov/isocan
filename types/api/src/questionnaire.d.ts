import type { Ctx } from "./ctx.js";
import { type QuestionnairePort, type QuestionnaireReferencePort } from "./questionnaire-reader.js";
/** The existing authority-bearing client remains the only Node transport. */
export declare function questionnairePort(ctx: Ctx): QuestionnairePort & QuestionnaireReferencePort;
