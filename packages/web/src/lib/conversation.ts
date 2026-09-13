import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { centerOn, threadWorldPos } from "./viewport.ts";
import { openMainPanel } from "../components/MainThreadPanel.tsx";

/** A notification and an inbox address arrive at the same conversation. */
export function openConversation(canvasId: string, threadId: string): void {
  const state = useCanvasStore.getState();
  if (state.canvasId !== canvasId) return;
  const target = state.canvas?.threads[threadId];
  if (target?.main) openMainPanel(canvasId, true);
  else if (target && state.canvas) {
    const world = threadWorldPos(state.canvas, target);
    const ui = useUiStore.getState();
    ui.setViewport(centerOn(ui.viewport, world.x, world.y, window.innerWidth, window.innerHeight));
    ui.setOpenThread(target.id);
  }
}
