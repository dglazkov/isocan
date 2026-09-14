import type { ContextPiece } from "./context.js";
/** Terminal formatting lives apart from eager piece assembly so browser previews
 * do not acquire the whole recap computation through the runtime core namespace. */
export declare function contextReport(pieces: ContextPiece[], nowMs?: number): string;
