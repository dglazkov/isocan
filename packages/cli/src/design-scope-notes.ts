import { canvasScopes, isDesignSystem, scopedDesignSystems, selectDesignSystem, type CanvasContents, type Item } from "@isocan/core";

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
    let line = `“${item.title}” is a design system: it governed ${was}, and now governs ${governs(now)}.`;
    if (!change.parentBefore && now) line += restOfCanvas(canvas, " Nothing governs the rest of the canvas now — moving it back out of the group restores that.");
    out.push(line);
  }
  return out;
}

/**
 * **The same sentence for a system that was written or chosen rather than
 * moved** — `design set`, `design import` and `design use`. Writing a
 * DESIGN.md into a group takes nothing from the canvas, but the person who
 * typed `--in` should still read that it governs that group ALONE; writing
 * one at the root should say which groups keep their own; and a scope with
 * two systems should say which one wins.
 */
export function designGovernsNotes(canvas: CanvasContents, itemId: string): string[] {
  const item = canvas.items[itemId];
  if (!item || !isDesignSystem(item)) return [];
  const now = canvasScopes(canvas, item)[0];
  let line = `“${item.title}” is a design system: it governs ${governs(now)}.`;
  if (now) line += restOfCanvas(canvas, " Nothing governs the rest of the canvas.");
  else {
    const kept = scopedDesignSystems(canvas).map((s) => `“${s.area.title}”`);
    if (kept.length) line += ` ${kept.length === 1 ? "The group" : "The groups"} ${kept.join(", ")} keep${kept.length === 1 ? "s its" : " their"} own.`;
  }
  const rivals = Object.values(canvas.items).filter((other) => isDesignSystem(other) && (canvasScopes(canvas, other)[0]?.id ?? null) === (now?.id ?? null));
  if (rivals.length > 1) line += ` ${rivals.length} systems sit at this level; the newest wins, which is “${newest(rivals).title}”.`;
  return [line];
}

/** What a system that stopped governing leaves behind in the scope it had. */
export function designReleasedNotes(canvas: CanvasContents, itemId: string, scopeId: string | null): string[] {
  const item = canvas.items[itemId];
  if (!item) return [];
  const scope = scopeId ? canvas.items[scopeId] : undefined;
  const heir = selectDesignSystem(canvas, { groupId: scopeId }).item;
  return [
    `“${item.title}” no longer governs ${governs(scope)}. ` +
      (heir ? `${scope ? `“${scope.title}”` : "The canvas"} is governed by “${heir.title}” now.` : `Nothing governs ${scope ? `“${scope.title}”` : "the canvas"} now — \`isocan design use ${item.id}\` puts it back.`),
  ];
}

function governs(scope: Item | undefined): string {
  return scope ? `only the group “${scope.title}”` : "the whole canvas";
}

function restOfCanvas(canvas: CanvasContents, none: string): string {
  const rest = selectDesignSystem(canvas);
  return rest.item ? ` The rest of the canvas is governed by “${rest.item.title}”.` : none;
}

function newest(items: Item[]): Item {
  return [...items].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0))[0]!;
}
