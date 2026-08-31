import type { Actor } from "@isocan/core";
import { itemUrl } from "@isocan/core";
import { sendEchoed, useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";

/**
 * **What you can do to an item, in one place, so two doors cannot disagree.**
 *
 * These were inline in the keyboard handler, which was fine while the keys
 * were the only way to reach them. A context menu is a second door to the
 * same acts, and two implementations of "delete the selection" is how a menu
 * quietly stops matching the key printed beside it in that menu.
 *
 * So the menu and the keys call these, and `SHORTCUTS` in core stays the one
 * place that says which key. Nothing here knows about a menu.
 */

/**
 * Move a selection to the trash — one undo for the whole selection.
 *
 * **`sendEchoed`, so the thing goes when you press the key.** This posted with
 * `sendOp`, which has no local echo: the item stayed on screen until the
 * home's broadcast came back down the socket. On a fast connection that is
 * invisible, which is exactly why it survived — and reported as "I selected a
 * screen, hit delete, nothing happened, I did it again, then I reloaded and it
 * was gone". Reproduced by stalling the POST: the item sits there for three
 * seconds while the server takes the delete.
 *
 * Pressing it twice is the other half of the cost. The second delete is a
 * second op on an item already in the trash — the home refuses it, and a
 * person who saw nothing happen has no way to know the first one worked.
 */
export async function deleteItems(
  canvasId: string,
  actor: Actor,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  await sendEchoed(
    canvasId,
    actor,
    ids.length === 1
      ? { type: "item.delete", itemId: ids[0]! }
      : { type: "items.delete", itemIds: ids },
  );
  useUiStore.getState().select(null);
}

/**
 * Cut: the clipboard takes it, then the canvas loses it.
 *
 * One gesture, so one ⌘Z puts it back — which is only true because the copy
 * half writes nothing and the delete half is already a single op for a whole
 * selection. If cut ever grows a step that writes, it needs a group id like
 * every other multi-op act.
 */
export async function cutItems(canvasId: string, actor: Actor, ids: string[]): Promise<void> {
  const canvas = useCanvasStore.getState().canvas;
  if (!canvas || ids.length === 0) return;
  const picked = ids
    .map((id) => canvas.items[id])
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  if (picked.length === 0) return;
  useUiStore.getState().setClipboard({ canvasId, items: picked });
  await deleteItems(canvasId, actor, ids);
}

/**
 * The address of one item — the link somebody sends when they mean "look at
 * this", which is the same URL full screen puts in the address bar.
 */
export function itemAddress(canvasId: string, itemId: string): string {
  return itemUrl(location.origin, canvasId, itemId);
}

/**
 * **Save an item's bytes to disk.**
 *
 * The canvas has never had this from the browser — `isocan get` is the only
 * way bytes have come out — and it is the one thing on a context menu that a
 * person expects to be there and would not think to ask for.
 *
 * The blob is fetched and handed over as an object URL rather than linking
 * the API route directly: the route is badged and answers with headers that
 * make a browser display rather than save, and a `download` attribute on a
 * cross-route link is not honoured in every browser. Fetch-then-save is the
 * version that behaves the same everywhere.
 */
export async function downloadItem(
  url: string,
  filename: string,
  doc: Document = document,
): Promise<void> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`could not read ${filename}`);
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const link = doc.createElement("a");
  link.href = href;
  link.download = filename;
  doc.body.appendChild(link);
  link.click();
  link.remove();
  // Freed on the next tick: revoking synchronously races the click on some
  // browsers and produces a download of nothing.
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

/** Paste, as the menu's door to it — the same act ⌘V performs. */
export { pasteInto } from "./clipboard.ts";
