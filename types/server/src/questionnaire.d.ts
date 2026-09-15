import { type Actor, type ActorRegistry, type CanvasState, type DesignActorKind, type LogEntry, type Operation, type QuestionnaireActor, type QuestionnaireOperation } from "../../core/src/index.js";
import type { Store } from "./store.js";
/** Joins preserve identity while known harness records establish eligibility; absence remains unknown. */
export declare function questionnaireActorKind(registry: ActorRegistry, id: string): DesignActorKind;
/** Exposes only canvas-known actor identity and eligibility, never private session or credential data. */
export declare function questionnaireActors(state: CanvasState, registry: ActorRegistry): QuestionnaireActor[];
/** Narrows the refusing public acts before their writer-only materialization fields are added. */
export declare const isQuestionnaireOperation: (op: Operation) => op is QuestionnaireOperation;
/** Rejects invented authority or retained metadata before forwarding and idempotency lookup. */
export declare function rejectPublicQuestionnaire(op: Operation): void;
/** Called before the general op-id fast path; canonical fields alone are ignored. */
export declare function questionnaireRetry(entries: readonly LogEntry[], op: QuestionnaireOperation, opId: string | undefined, actorId: string, registry: ActorRegistry): LogEntry | null;
/** This function runs within Engine's single writer chain, after custody and ordinary canvas grants. */
export declare function resolveQuestionnaireOperation(store: Store, state: CanvasState, revision: number, op: QuestionnaireOperation, actor: Actor, registry: ActorRegistry, home: string | undefined): Promise<QuestionnaireOperation>;
