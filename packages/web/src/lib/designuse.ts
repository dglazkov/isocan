import type { Actor, Operation } from "@isocan/core";
import { designUnuse, designUse, type DesignUse } from "@isocan/core/design-use";
import { flashNotice, sendEchoed, setNotice, useCanvasStore } from "../stores/canvasStore.ts";

/**
 * **"Use as the design system", from the item menu** — the web's door to
 * `isocan design use`, and until it existed the only way to choose which
 * DESIGN.md governs was a terminal. The op comes from core's `designUse`,
 * the same function the CLI verb calls, so the two cannot send different
 * things (`packages/web/test/designuse.test.ts` holds them equal against a
 * real daemon). Loaded on the click, never on first paint: the menu carries
 * the label and nothing else.
 *
 * `send` is a parameter so a test can hold the op the menu WOULD send; the
 * menu passes nothing and gets `sendEchoed`, like every other entry.
 */
export async function chooseDesignSystem(
  canvasId: string,
  actor: Actor,
  itemId: string,
  on: boolean,
  send: (op: Operation) => Promise<unknown> = (op) => sendEchoed(canvasId, actor, op),
): Promise<DesignUse | null> {
  const canvas = useCanvasStore.getState().canvas;
  const item = canvas?.items[itemId];
  if (!canvas || !item) return null;
  try {
    const use = on ? designUse(canvas, item) : designUnuse(canvas, item);
    await send(use.op);
    flashNotice(designUseNotice(item.title, on, use));
    return use;
  } catch (err) {
    setNotice(err instanceof Error ? err.message : String(err));
    return null;
  }
}

/** What the menu says it did — the scope in the words the CLI's note uses. */
export function designUseNotice(title: string, on: boolean, use: DesignUse): string {
  const where = use.scope ? `only the group “${use.scope.title}”` : "the whole canvas";
  if (!on) return `“${title}” no longer governs ${where}`;
  // Two items are usually both called DESIGN.md, so the one you chose is "this one".
  if (use.into) return `“${use.into.title}” governs ${where} — it now reads ${use.into.title === title ? "this one" : `“${title}”`}, as a new version (⌘Z takes it back)`;
  return `“${title}” is the design system: it governs ${where}`;
}
