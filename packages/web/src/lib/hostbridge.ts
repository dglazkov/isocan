import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { embeddedNow } from "./panels.ts";
import { revealItem } from "./zoomactions.ts";

/** What a framing host is told about one selected item. */
interface BridgedItem {
  id: string;
  title: string;
  groupId: string | null;
}

/**
 * **The host bridge** (`docs/projects/jetski/design.md`): a canvas framed by
 * an agent manager's pane tells the pane what is selected, so the
 * conversation beside it can be about those items, and lets the pane point
 * at one.
 *
 * Three messages, and the order is the security. The canvas says
 * `isocan:ready` to its parent carrying nothing a framer did not already put
 * in the address; the parent answers `isocan:hello`, and **the origin that
 * hello came from is the only origin selections are ever posted to**. Until
 * a hello arrives nothing is posted at all — a titles-bearing `postMessage`
 * to `"*"` would hand them to whoever framed the page. `isocan:focus-item`
 * is honoured only from that same parent and origin, and only for an item
 * that is on this canvas.
 *
 * Only when the page was opened with `?embed=1` (`embeddedNow`) and really
 * is framed: an ordinary tab registers nothing and posts nothing.
 *
 * Returns the teardown, for the effect that installs it.
 */
export function bridgeToHost(
  canvasId: string,
  win: Window = window,
  embedded: boolean = embeddedNow(),
): () => void {
  if (!embedded || win.parent === win) return () => {};
  let host: string | null = null;

  const selection = (): BridgedItem[] => {
    const live = useCanvasStore.getState().canvas;
    return useUiStore
      .getState()
      .selectedItemIds.map((id) => live?.items[id])
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map((item) => ({ id: item.id, title: item.title, groupId: item.containerId ?? null }));
  };
  const post = () => {
    if (host) win.parent.postMessage({ type: "isocan:selection", canvasId, items: selection() }, host);
  };

  const unsubscribe = useUiStore.subscribe((s, prev) => {
    if (s.selectedItemIds !== prev.selectedItemIds) post();
  });
  const onMessage = (e: MessageEvent) => {
    if (e.source !== win.parent) return;
    const data: unknown = e.data;
    if (!data || typeof data !== "object") return;
    const { type, itemId } = data as { type?: unknown; itemId?: unknown };
    if (type === "isocan:hello") {
      // A parent that will not say where it lives is not told what is
      // selected: "null" is not an origin a message can be addressed to.
      if (!e.origin || e.origin === "null") return;
      host = e.origin;
      post();
      return;
    }
    if (type !== "isocan:focus-item" || e.origin !== host || typeof itemId !== "string") return;
    if (!useCanvasStore.getState().canvas?.items[itemId]) return;
    useUiStore.getState().select(itemId);
    revealItem(itemId);
  };

  win.addEventListener("message", onMessage);
  win.parent.postMessage({ type: "isocan:ready", canvasId }, "*");
  return () => {
    unsubscribe();
    win.removeEventListener("message", onMessage);
  };
}
