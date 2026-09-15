import { type Actor, type ActorRegistry, type CanvasState, type LogEntry, type Operation } from "../../core/src/index.js";
import { type DesignRepairOperation, type DesignRepairsResponse } from "../../core/src/design-repair.js";
import type { Store } from "./store.js";
/** Narrow dispatch keeps ordinary content edits outside automatic review and task authority. */
export declare const isDesignRepairOperation: (op: Operation) => op is DesignRepairOperation;
/** Strict public parsing refuses canonical effect and retained-authority injection before retry lookup. */
export declare function rejectPublicDesignRepair(op: Operation): void;
/** Canonical identity remains reserved after Undo and archive; only exact original intent and current actor custody can observe it. */
export declare function designRepairRetry(history: readonly LogEntry[], op: DesignRepairOperation, opId: string | undefined, actorId: string, registry: ActorRegistry): Promise<LogEntry | null>;
/** One writer-serialized repair checks local scope and request facts; foreign policy remains a permission-bearing client read. */
export declare function materializeDesignRepair(store: Store, state: CanvasState, home: string, operation: DesignRepairOperation, actor: Actor, registry: ActorRegistry, history: readonly LogEntry[]): Promise<DesignRepairOperation>;
/** Read acceptance and active causes without claiming that a repair or an authored review proved task success. */
export declare function readDesignRepairs(store: Store, state: CanvasState, home: string, registry: ActorRegistry, history: readonly LogEntry[]): Promise<DesignRepairsResponse>;
