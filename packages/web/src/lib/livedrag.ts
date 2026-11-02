/**
 * **Others see the drag** (groups-by-hand phase 3): somebody else's drag in
 * progress, drawn on this screen as it happens.
 *
 * Loaded the first time a roster arrives carrying a `drag` — a person alone,
 * or a canvas where nobody drags, never downloads it — and from then on it
 * listens to the stores itself.
 *
 * **Everything is written to the DOM, never to React state.** On 26 Sep 2026
 * one collaborator dragging one item froze every viewer at two frames a
 * second, through whole-canvas subscriptions re-rendering every card
 * (docs/research/2026-09-26-frame-budget.md). A drag arrives thirty times a
 * second, which is that load again, so the offset is the CSS `translate`
 * property on each moved item — a property React never writes here, so it
 * composes with the `left`/`top` React owns instead of fighting it — and the
 * lift and the mover's edge are classes this module adds and takes away.
 */
import { annotationsOf, groupTransformClosure, isArea, itemsIn, type CanvasContents } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { actorColorIn } from "./colors.ts";
import { GhostBook, type Ghost } from "./ghostbook.ts";
import "./livedrag.css";

const book = new GhostBook();
/** Elements wearing a ghost now, by item id, so the next paint can take it
 * off whatever is no longer moving. */
let painted = new Map<string, HTMLElement>();
const boxes = new Map<string, HTMLElement>();
const closures = new Map<string, { canvas: CanvasContents; roots: string[]; ids: string[] }>();
let raf = 0;
const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/** What a drag of these roots carries, read from this screen's own copy —
 * the same closure the mover's hand moves (`ItemView` `onPointerDown`). */
function closureOf(ghost: Ghost, canvas: CanvasContents, groups: boolean): string[] {
  const held = closures.get(ghost.sessionId);
  if (held && held.canvas === canvas && held.roots === ghost.drag.roots) return held.ids;
  let ids: string[];
  try {
    ids = groups
      ? groupTransformClosure(canvas, ghost.drag.roots)
      : [...new Set(ghost.drag.roots.flatMap((id) => {
          const one = canvas.items[id];
          return [id, ...annotationsOf(canvas, id).map((m) => m.id), ...(one && isArea(one) ? itemsIn(canvas, one).map((m) => m.id) : [])];
        }))];
  } catch {
    ids = ghost.drag.roots;
  }
  closures.set(ghost.sessionId, { canvas, roots: ghost.drag.roots, ids });
  return ids;
}

function itemEl(id: string): HTMLElement | null {
  const known = painted.get(id);
  if (known?.isConnected && known.dataset.itemId === id) return known;
  return document.querySelector<HTMLElement>(`.item[data-item-id="${CSS.escape(id)}"]`);
}

function unpaint(id: string, el: HTMLElement): void {
  el.style.translate = "";
  el.style.removeProperty("--who");
  el.classList.remove("ghosted", "ghost-root", "ghost-into");
  // `.lifted` is React's too, while this screen's own hand holds the item.
  const ui = useUiStore.getState();
  if (!ui.drag?.lift?.includes(id) && !ui.groupPreview?.lift?.includes(id)) el.classList.remove("lifted");
}

function paint(): void {
  const { canvas, record, actorColors } = useCanvasStore.getState();
  const ui = useUiStore.getState();
  const next = new Map<string, HTMLElement>();
  const liveBoxes = new Set<string>();
  for (const ghost of canvas ? book.ghosts.values() : []) {
    const color = actorColorIn(actorColors, ghost.actorId);
    const translate = `${ghost.x}px ${ghost.y}px`;
    const { box, into } = ghost.drag;
    if (box) {
      // A big selection: one lifted outline, not hundreds of moving cards.
      let el = boxes.get(ghost.sessionId);
      if (!el?.isConnected) {
        el = document.createElement("div");
        el.className = "ghost-box";
        document.querySelector(".world")?.appendChild(el);
        boxes.set(ghost.sessionId, el);
      }
      Object.assign(el.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${box.width}px`, height: `${box.height}px`, translate });
      el.style.setProperty("--who", color);
      liveBoxes.add(ghost.sessionId);
    } else {
      const roots = new Set(ghost.drag.roots);
      for (const id of closureOf(ghost, canvas!, record?.groupMode === "groups")) {
        // This screen's own hand wins over somebody else's ghost.
        if (ui.drag?.itemIds.includes(id) || ui.groupPreview?.boxes.has(id)) continue;
        const el = itemEl(id);
        if (!el) continue;
        el.style.translate = translate;
        el.classList.add("ghosted");
        if (roots.has(id)) {
          el.classList.add("lifted", "ghost-root");
          el.style.setProperty("--who", color);
        }
        next.set(id, el);
      }
    }
    // The drop target the mover's pill names, outlined in their colour.
    const target = into ? itemEl(into) : null;
    if (target && !next.has(into!)) {
      target.classList.add("ghost-into");
      target.style.setProperty("--who", color);
      next.set(into!, target);
    }
  }
  for (const [id, el] of painted) if (next.get(id) !== el) unpaint(id, el);
  for (const [sessionId, el] of boxes) if (!liveBoxes.has(sessionId)) { el.remove(); boxes.delete(sessionId); }
  for (const sessionId of closures.keys()) if (!book.ghosts.has(sessionId)) closures.delete(sessionId);
  painted = next;
}

function frame(): void {
  raf = 0;
  book.step(performance.now(), reduced());
  paint();
  if (book.ghosts.size) raf = requestAnimationFrame(frame);
}

/** A roster or the canvas moved: reconcile, and paint NOW — the frame the op
 * lands in must not show the item at its new place AND still offset. */
function sync(): void {
  const { sessions, canvas } = useCanvasStore.getState();
  book.update(sessions, (id) => canvas?.items[id], performance.now());
  paint();
  if (book.ghosts.size && !raf) raf = requestAnimationFrame(frame);
}

useCanvasStore.subscribe((state, before) => {
  if (state.sessions !== before.sessions || state.canvas !== before.canvas) sync();
});
sync();
