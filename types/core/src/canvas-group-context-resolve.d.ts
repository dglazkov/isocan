import type { CanvasState } from "./model.js";
import type { Operation } from "./ops.js";
import { type ContextContentPage, type ContextManifest, type ContextRequest } from "./canvas-group-context.js";
/** A preview and a writer use the same complete expansion and exclusion rules. */
export declare function contextManifest(state: CanvasState, revision: number, request: ContextRequest): ContextManifest;
/** Ambient pins remain decisions on their roots; descendants are expanded only when read. */
export declare function ambientContextManifest(state: CanvasState, revision: number): ContextManifest;
/** Canonical-only metadata is refused before forwarding and idempotency lookup. */
export declare function rejectPublicContext(op: Operation): void;
/** The home resolves selection once; ordinary body edits preserve the old request's scope. */
export declare function resolveContextOperation(state: CanvasState, revision: number, op: Operation): Operation;
/** Produce reference pages without opening bytes or returning excluded content. */
export declare function contextContentPage(manifest: ContextManifest, options?: {
    offset?: number;
    limit?: number;
    face?: "source" | "visual";
}): ContextContentPage;
