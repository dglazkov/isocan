import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { embeddedNow } from "./panels.ts";
import {
  glideToBox,
  glideToPoint,
  revealItem,
  zoomBy,
  zoomTo100,
  zoomToFit,
  zoomToItem,
  zoomToSelection,
} from "./zoomactions.ts";

/** What a framing host is told about one selected item. */
interface BridgedItem {
  id: string;
  title: string;
  groupId: string | null;
}

/**
 * **The host bridge** (`docs/projects/jetski/design.md`): a canvas framed by
 * an agent manager's pane tells the pane what is selected, so the
 * conversation beside it can be about those items, and lets the pane (and the
 * CLI behind it) drive the framed view — pointing at or zooming to items,
 * fitting or centering the camera, selecting items, following an agent's
 * session, or opening a comment thread.
 *
 * The handshake order is the security. The canvas says `isocan:ready` to its
 * parent carrying nothing a framer did not already put in the address; the
 * parent answers `isocan:hello`, and **the origin that hello came from is the
 * only origin selections are ever posted to**. Until a hello arrives nothing
 * is posted at all — a titles-bearing `postMessage` to `"*"` would hand them
 * to whoever framed the page. Inbound commands (`isocan:focus-item`,
 * `isocan:camera`, `isocan:select`, `isocan:follow`, `isocan:open-thread`) are
 * honoured only from that same parent and origin, and only for items/threads
 * on this canvas.
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
    const msg = data as Record<string, unknown>;
    if (msg.type === "isocan:hello") {
      // A parent that will not say where it lives is not told what is
      // selected: "null" is not an origin a message can be addressed to.
      if (!e.origin || e.origin === "null") return;
      host = e.origin;
      post();
      return;
    }
    if (e.origin !== host) return;
    const live = useCanvasStore.getState().canvas;
    const ui = useUiStore.getState();

    switch (msg.type) {
      case "isocan:focus-item": {
        if (typeof msg.itemId !== "string" || !live?.items[msg.itemId]) return;
        ui.select(msg.itemId);
        if (msg.zoom === true) zoomToItem(msg.itemId);
        else revealItem(msg.itemId);
        return;
      }
      case "isocan:camera": {
        const factor =
          typeof msg.factor === "number" && Number.isFinite(msg.factor) && msg.factor > 0
            ? msg.factor
            : undefined;
        switch (msg.action) {
          case "fit":
            zoomToFit();
            return;
          case "100":
            zoomTo100();
            return;
          case "selection":
            zoomToSelection();
            return;
          case "in":
            zoomBy(factor ?? 1.5);
            return;
          case "out":
            zoomBy(factor ?? 1 / 1.5);
            return;
          case "item":
            if (typeof msg.itemId === "string" && live?.items[msg.itemId]) zoomToItem(msg.itemId);
            return;
          case "point":
            if (
              typeof msg.x === "number" &&
              Number.isFinite(msg.x) &&
              typeof msg.y === "number" &&
              Number.isFinite(msg.y)
            ) {
              glideToPoint(msg.x, msg.y);
            }
            return;
          case "box": {
            const b = msg.box as Record<string, unknown> | undefined;
            if (
              b &&
              typeof b.minX === "number" &&
              Number.isFinite(b.minX) &&
              typeof b.minY === "number" &&
              Number.isFinite(b.minY) &&
              typeof b.maxX === "number" &&
              Number.isFinite(b.maxX) &&
              typeof b.maxY === "number" &&
              Number.isFinite(b.maxY)
            ) {
              glideToBox({ minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY });
            }
            return;
          }
        }
        return;
      }
      case "isocan:select": {
        if (!Array.isArray(msg.itemIds)) return;
        const valid = msg.itemIds.filter(
          (id): id is string => typeof id === "string" && Boolean(live?.items[id]),
        );
        ui.setSelection(valid);
        if (msg.zoom === true && valid.length > 0) zoomToSelection();
        return;
      }
      case "isocan:follow": {
        if (typeof msg.sessionId === "string" || msg.sessionId === null) ui.setFollow(msg.sessionId);
        if (typeof msg.actorId === "string" || msg.actorId === null) ui.setFollowingActor(msg.actorId);
        return;
      }
      case "isocan:open-thread": {
        if (msg.threadId === null) {
          ui.setOpenThread(null);
          return;
        }
        if (typeof msg.threadId !== "string") return;
        const thread = live?.threads?.[msg.threadId];
        if (!thread) return;
        ui.setOpenThread(thread.id);
        if (thread.anchorItemId && live?.items[thread.anchorItemId]) {
          if (msg.zoom === true) zoomToItem(thread.anchorItemId);
          else revealItem(thread.anchorItemId);
        } else if (
          typeof thread.x === "number" &&
          Number.isFinite(thread.x) &&
          typeof thread.y === "number" &&
          Number.isFinite(thread.y)
        ) {
          glideToPoint(thread.x, thread.y);
        }
        return;
      }
    }
  };

  win.addEventListener("message", onMessage);
  win.parent.postMessage({ type: "isocan:ready", canvasId }, "*");
  return () => {
    unsubscribe();
    win.removeEventListener("message", onMessage);
  };
}
