import type { CanvasContents, WorkspacePresentation } from "@isocan/core";
import { spring, type PresentationFrame, type PresentedItem } from "./presentation.ts";

/** A frame subscription is scoped to one mounted workspace, never the replica. */
export class PresentationStore {
  private frame: PresentationFrame | null = null;
  private listeners = new Set<() => void>();
  private raf = 0;
  private targets: WorkspacePresentation | null = null;
  private speeds = new Map<string, number>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  snapshot = () => this.frame;
  private emit() { for (const listener of this.listeners) listener(); }

  set(view: WorkspacePresentation | null, canvas: CanvasContents) {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.targets = view;
    if (!view) {
      this.frame = null;
      this.speeds.clear();
      this.emit();
      return;
    }
    const previous = this.frame;
    const origins: PresentationFrame["origins"] = {};
    for (const id of Object.keys(view.items)) {
      const item = canvas.items[id];
      if (!item) continue;
      // Live body updates preserve native drag deltas. Only a new navigation
      // re-bases those deltas onto the newly requested semantic arrangement.
      origins[id] = !view.focusIds && previous?.origins[id]
        ? previous.origins[id]! : { x: item.x, y: item.y };
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const items: Record<string, PresentedItem> = {};
    for (const [id, target] of Object.entries(view.items)) {
      const old = previous?.items[id], oldOrigin = previous?.origins[id];
      const origin = origins[id];
      items[id] = old && oldOrigin && origin && !reduced
        ? { ...target, x: old.x + origin.x - oldOrigin.x,
          y: old.y + origin.y - oldOrigin.y, width: old.width, height: old.height }
        : { ...target };
    }
    this.frame = { origins, isolate: view.isolate, items };
    this.emit();
    if (!previous || reduced) { this.speeds.clear(); return; }

    let last = performance.now();
    const step = (now: number) => {
      if (!this.frame || !this.targets) return;
      const dt = Math.min(0.064, Math.max(0.001, (now - last) / 1000));
      last = now;
      let moving = false;
      const items: Record<string, PresentedItem> = {};
      for (const [id, target] of Object.entries(this.targets.items)) {
        const current = this.frame.items[id] ?? target;
        const next = { ...target };
        for (const axis of ["x", "y", "width", "height"] as const) {
          const key = `${id}:${axis}`;
          const value = spring(current[axis], this.speeds.get(key) ?? 0, target[axis], dt);
          next[axis] = value.position;
          this.speeds.set(key, value.velocity);
          moving ||= value.velocity !== 0 || value.position !== target[axis];
        }
        items[id] = next;
      }
      this.frame = { ...this.frame, items };
      this.emit();
      this.raf = moving ? requestAnimationFrame(step) : 0;
    };
    this.raf = requestAnimationFrame(step);
  }

  freeze() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.targets = null;
    this.speeds.clear();
  }
  dispose() { this.freeze(); this.frame = null; this.listeners.clear(); }
}
