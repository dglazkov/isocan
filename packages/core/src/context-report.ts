import { ago } from "./elapsed.ts";
import { formatRecapHead } from "./recap-head.ts";
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
    if (piece.stale) lines.push(`  ${" ".repeat(width)}${piece.stale}`);
    if (piece.fix && (piece.stale || !piece.present)) {
      lines.push(`  ${" ".repeat(width)}→ ${piece.fix}`);
    }
  }
  return lines.join("\n");
}
