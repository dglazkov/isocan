import { sessionLocus } from "./presence.ts";
import type { CanvasContents, Item, WorkspacePresentation, PresenceSession } from "@isocan/core";

/** Bounds plus the amount of content a native item should show in this view. */
export type PresentedItem = WorkspacePresentation["items"][string];
/** One animation frame and the saved origins from which explicit drags are measured. */
export interface PresentationFrame {
  isolate?: boolean | undefined;
  items: Record<string, PresentedItem>;
  origins: Record<string, { x: number; y: number }>;
}

/** Exact critically damped spring, independent of display refresh rate. */
export function spring(position: number, velocity: number, target: number, dt: number) {
  const omega = 14, offset = position - target;
  const decay = Math.exp(-omega * dt), change = velocity + omega * offset;
  const next = target + (offset + change * dt) * decay;
  const speed = (velocity - omega * change * dt) * decay;
  return Math.abs(next - target) < 0.05 && Math.abs(speed) < 0.1
    ? { position: target, velocity: 0 } : { position: next, velocity: speed };
}

/** Resolve a native item without replacing its identity, versions or metadata. */
export function presentedItem(item: Item, frame: PresentationFrame | null): Item {
  const view = frame?.items[item.id], origin = frame?.origins[item.id];
  return view && origin ? { ...item, x: view.x + item.x - origin.x,
    y: view.y + item.y - origin.y, width: view.width, height: view.height } : item;
}

/** Give geometry consumers a disposable view of the same canvas. */
export function presentedCanvas(canvas: CanvasContents, frame: PresentationFrame | null): CanvasContents {
  if (!frame) return canvas;
  return { ...canvas, items: Object.fromEntries(Object.values(canvas.items).filter(item => !frame.isolate || frame.items[item.id]).map(item => [item.id, presentedItem(item, frame)])) };
}

/** Comment offsets belong to saved geometry; convert only their display. */
export function presentedOffset(item: Item, frame: PresentationFrame | null, point: { x: number; y: number }, reverse = false) {
  const view = presentedItem(item, frame);
  return reverse ? { x: (point.x - view.x) * item.width / view.width, y: (point.y - view.y) * item.height / view.height }
    : { x: view.x + point.x * view.width / item.width, y: view.y + point.y * view.height / item.height };
}

/** A workspace can follow declared item work or selection, never reinterpret a
 * collaborator's unscoped pointer as a position in a different layout. */
export function presentedLocus(session: PresenceSession, canvas: CanvasContents, frame: PresentationFrame | null) {
  if (!frame) return sessionLocus(session, canvas);
  const activity = session.activity;
  if (activity && "threadId" in activity) {
    const thread = canvas.threads[activity.threadId];
    const anchor = thread?.anchorItemId ? canvas.items[thread.anchorItemId] : undefined;
    if (thread && anchor && frame.items[anchor.id]) return presentedOffset(anchor, frame, thread);
  }
  const id = activity && "itemId" in activity ? activity.itemId : session.selection.find(id => frame.items[id]);
  const item = id ? canvas.items[id] : undefined;
  if (!item || !frame.items[item.id]) return null;
  const bounds = presentedItem(item, frame);
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}
