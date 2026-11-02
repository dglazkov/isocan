/**
 * **What the page and the judge's Worker say to each other** (local-judge
 * phase 0). Types only — nothing here is code either side runs — so the
 * client and the Worker cannot disagree about a message's shape.
 *
 * The Worker speaks MediaPipe's shapes (`@isocan/core/local-judge`'s
 * `DecisionQuestion` / `DecisionResult`); the client turns a `JevRequest`
 * into them and their results back into `Answered`, in core, so the mapping
 * is tested where it is pure.
 */
import type { DecisionQuestion, DecisionResult } from "@isocan/core/local-judge";

export type Backend = "gpu" | "cpu";

export type ToWorker =
  /** `file`: the model from a file a person chose, when no daemon serves it. `fetchGuard: false` turns the Worker's own refusal off so the lab can show the browser's policy holds alone. */
  | { type: "init"; id: number; backend: Backend; model: string; maxNumTokens?: number; file?: File; fetchGuard?: boolean }
  | { type: "prewarm"; id: number; questions: Record<string, DecisionQuestion> }
  /** `countTokens` also asks MediaPipe how many tokens the text and questions come to — after the evaluation is timed, never inside it. */
  | { type: "evaluate"; id: number; text: string; questions: Record<string, DecisionQuestion>; countTokens?: boolean }
  | { type: "close"; id: number };

export interface InitTimings {
  backend: Backend;
  /** Where the model came from: this origin's daemon (then Cache Storage), or a file a person chose. */
  download: { bytes: number; ms: number; cached: boolean; source: "daemon" | "file" };
  loadMs: number;
  compileMs: number;
  /** What the model was built for — MediaPipe's `contextWindow`. */
  contextWindow: number;
  /** Whether the worker wrapped MediaPipe's evaluate functions so a synchronous (CPU) result is still a Promise — see `thenable` in worker.ts. */
  thenablePatch: boolean;
  /** Whether MediaPipe held a WebGPU device after init — false means a GPU delegate had nothing to run on. */
  webgpuDevice: boolean;
  /** Whether the Worker's fetch guard was refusing; off only for the policy check. */
  fetchGuard: boolean;
}

/** A request the Worker's own fetch guard refused because it was not for this origin — by URL origin only, never a body. */
export interface RefusedRequest {
  origin: string;
  at: number;
  /** "guard" when the Worker refused it; "attempted" when the guard was off and it went on to the browser. */
  refusedBy: "guard" | "attempted";
}

/** A request the browser's Content-Security-Policy blocked in the Worker, by origin. */
export interface CspViolation {
  blocked: string;
  directive: string;
  disposition: string;
}

export type FromWorker =
  | { type: "ok"; id: number; init?: InitTimings; prewarmMs?: number; results?: Record<string, DecisionResult>; ms?: number; tokens?: number; refused?: RefusedRequest[]; violations?: CspViolation[] }
  | { type: "error"; id: number; message: string; refused?: RefusedRequest[]; violations?: CspViolation[] };
