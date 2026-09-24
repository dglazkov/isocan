import { canvasScopes, isDesignSystem, selectDesignSystem, type CanvasContents } from "@isocan/core";

/**
 * **Moving a design system changes what it governs — said, never silent**
 * (wireframes phase 8, from building Porchlight).
 *
 * A DESIGN.md governs by where it sits: at the canvas root it is the canvas's
 * system, inside a group it is that group's and nobody else's. Tidying the
 * canvas's system into a "Brand" group therefore took it away from every
 * screen outside that group — forty-eight wires "governed by no system" —
 * and the move said nothing. These are the sentences a move prints: what
 * each moved system governed, what it governs now, and what is left governing
 * the rest of the canvas. Pure, over the canvas AFTER the move. It lives in
 * the CLI because only the CLI says it: in core it put ~640 bytes into the
 * web entry chunk for a sentence no page prints.
 */
export function designScopeNotes(
  canvas: CanvasContents,
  changes: ReadonlyArray<{ itemId: string; parentBefore: string | null; parentAfter: string | null }>,
): string[] {
  const out: string[] = [];
  for (const change of changes) {
    if (change.parentBefore === change.parentAfter) continue;
    const item = canvas.items[change.itemId];
    if (!item || !isDesignSystem(item)) continue;
    const title = (id: string) => `“${canvas.items[id]?.title ?? id}”`;
    const now = canvasScopes(canvas, item)[0];
    const was = change.parentBefore ? `only the group ${title(change.parentBefore)}` : "the whole canvas";
    const is = now ? `only the group “${now.title}”` : "the whole canvas";
    let line = `“${item.title}” is a design system: it governed ${was}, and now governs ${is}.`;
    if (!change.parentBefore && now) {
      const rest = selectDesignSystem(canvas);
      line += rest.item
        ? ` The rest of the canvas is governed by “${rest.item.title}”.`
        : ` Nothing governs the rest of the canvas now — moving it back out of the group restores that.`;
    }
    out.push(line);
  }
  return out;
}
