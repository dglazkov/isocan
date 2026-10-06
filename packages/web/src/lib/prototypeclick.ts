import type { Actor, PrototypeClick } from "@isocan/core";
import { clickOp, coalescedClick } from "@isocan/core";
import { sendEchoed, useCanvasStore } from "../stores/canvasStore.ts";

/**
 * Deliver a click a prototype frame posted. Coalesced here against the
 * optimistic canvas so a double-click never leaves the tab; the home refuses
 * a repeat and an agent's click again (`/api/ops`), for clients that skip this.
 */
export function sendPrototypeClick(canvasId: string, actor: Actor, click: PrototypeClick): void {
  const { canvas } = useCanvasStore.getState();
  if (!canvas || coalescedClick(canvas, click, actor.id, Date.now())) return;
  void sendEchoed(canvasId, actor, clickOp(canvas, click, actor.id));
}
