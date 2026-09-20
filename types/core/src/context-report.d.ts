import type { ContextSource } from "./context-source.js";
/** One sentence naming a copy's origin, for the terminal and the MCP summary —
 *  here rather than beside the record itself for the reason this whole module
 *  exists: local Context assembles a copied piece on every canvas, and a
 *  formatter only a reader in a terminal wants has no business in first paint. */
export declare function formatContextSource(source: ContextSource): string;
import type { ContextPiece } from "./context.js";
/** Terminal formatting lives apart from eager piece assembly so browser previews
 * do not acquire the whole recap computation through the runtime core namespace. */
export declare function contextReport(pieces: ContextPiece[], nowMs?: number): string;
