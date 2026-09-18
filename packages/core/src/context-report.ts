import { ago } from "./elapsed.ts";
import { formatRecapHead } from "./recap-head.ts";
import type { ContextSource } from "./context-source.ts";

/** One sentence naming a copy's origin, for the terminal and the MCP summary —
 *  here rather than beside the record itself for the reason this whole module
 *  exists: local Context assembles a copied piece on every canvas, and a
 *  formatter only a reader in a terminal wants has no business in first paint. */
export function formatContextSource(source: ContextSource): string {
  return `copied from “${source.itemTitle}” on ${source.canvasTitle} (${source.canvasId}) at ${source.home}`;
}
import type { ContextPiece } from "./context.ts";

/** Terminal formatting lives apart from eager piece assembly so browser previews
 * do not acquire the whole recap computation through the runtime core namespace. */
export function contextReport(pieces: ContextPiece[], nowMs: number = Date.now()): string {
  const lines: string[] = [];
  const width = Math.max(...pieces.map((p) => p.name.length)) + 2;
  for (const piece of pieces) {
    const mark = piece.present ? (piece.stale ? "!" : " ") : "·";
    const when = piece.updatedAt ? ` · ${ago(piece.updatedAt, nowMs)}` : "";
    const size = piece.present ? (piece.size ?? "yes") : "not here";
    const beaten = piece.overridden ? ` (${piece.overridden})` : "";
    lines.push(`${mark} ${piece.name.padEnd(width)}${size}${when}${beaten}`);
    if (piece.recap) lines.push(formatRecapHead(piece.recap.head).replace(/^/gm, `  ${" ".repeat(width)}`));
    // A copy's origin gets its own line rather than a longer size column: the
    // whole point of `contextSource` is that an agent reading this can say
    // where these bytes came from without opening anything.
    for (const one of piece.copied ?? []) lines.push(`  ${" ".repeat(width)}“${one.title}” — ${formatContextSource(one.source)}`);
    if (piece.stale) lines.push(`  ${" ".repeat(width)}${piece.stale}`);
    if (piece.fix && (piece.stale || !piece.present)) {
      lines.push(`  ${" ".repeat(width)}→ ${piece.fix}`);
    }
  }
  return lines.join("\n");
}
