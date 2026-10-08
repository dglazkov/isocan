import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { areaTint, GROUP_STACK, groupDropPolicy, groupDropTarget, groupStackMembers, itemKind, kindFamily, paperOf, reachHeld, stackFan, stackPile, type Actor, type Item } from "@isocan/core";
import { publishDrag, useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { useCanEdit } from "../lib/capability.ts";
import { groupsEnabled } from "../lib/canvasgroups.ts";
import { beginGroupGesture } from "../lib/groupgestures.ts";
import { stackGroup } from "../lib/groupstack.ts";
import { screenToWorld } from "../lib/viewport.ts";
import { ItemThumb } from "./ItemThumb.tsx";
import { follow } from "./ItemView.tsx";
import "./GroupStack.css";

/**
 * **A group shown as a stack** (groups-by-hand phase 4): a pile of cards in
 * the group's own frame, at its own origin, one card's size
 * (`GROUP_STACK`, `groupStackBox`).
 *
 * The top member sits upright in the middle; up to six more sit behind it,
 * each turned and nudged by a hash of its own id (core `stackPile`) and
 * tinted with its own colour. Every card in the pile shows its own picture
 * (8 Oct 2026, Dion: "it should be showing all of the images, not grey
 * blocks") — the pile is at most seven cards, so a 40-item stack still costs
 * seven thumbnails, not forty. Pointing fans it into a hand. The first click
 * selects the stack like any group, so ⇧S and the menu act on it; a click on
 * a stack that is already selected opens it into a grid in front of the canvas. Fanned and opened are this viewer's
 * and this moment's, so they are React state here and never stored: a reload
 * or a close always comes back to the stack, which is the stored part.
 *
 * Loaded lazily by `ItemView` for a stacked group only, so a canvas without a
 * stack never downloads any of it.
 */
/**
 * **Which card is in front**, per stack, for this viewer only — like fanned
 * and opened, never stored: a reload comes back to the stack's own first
 * card. Kept outside the component so a re-render or a remount mid-session
 * keeps the card you flipped to.
 */
const fronts = new Map<string, number>();

/** The event ← and → on a selected stack send (CanvasPage spells it, so the first paint carries none of this). */
const STACK_FLIP = "isocan:stack-flip";

export default function GroupStack({ item, canvasId, actor, lifted }: { item: Item; canvasId: string; actor: Actor; lifted: boolean }) {
  const canvas = useCanvasStore((s) => s.past?.canvas ?? s.canvas);
  const all = useMemo(() => (canvas?.items[item.id] ? groupStackMembers(canvas, item.id) : []), [canvas, item.id]);
  // ← and → flip which card is in front (8 Oct 2026): the members rotate,
  // every card's own turn and nudge travel with it (they are hashed from its
  // id), so the CSS transition carries each to its new place; the card that
  // leaves the front (→) or arrives from the back (←) gets a keyframe that
  // carries it over the pile, which is what makes it read as a flip.
  const [front, setFront] = useState(() => fronts.get(item.id) ?? 0);
  const [flipping, setFlipping] = useState<{ id: string; way: "leave-right" | "arrive-left" } | null>(null);
  const members = useMemo(() => {
    if (all.length === 0) return all;
    const at = ((front % all.length) + all.length) % all.length;
    return [...all.slice(at), ...all.slice(0, at)];
  }, [all, front]);
  const pile = useMemo(() => stackPile(members.map((one) => one.id)), [members]);
  useEffect(() => {
    const flip = (e: Event) => {
      const { groupId, step } = (e as CustomEvent<{ groupId: string; step: number }>).detail;
      if (groupId !== item.id || all.length < 2) return;
      setFanned(false);
      const was = fronts.get(item.id) ?? 0;
      const next = was + step;
      fronts.set(item.id, next);
      const at = (n: number) => all[((n % all.length) + all.length) % all.length]!.id;
      setFlipping(step > 0 ? { id: at(was), way: "leave-right" } : { id: at(next), way: "arrive-left" });
      setFront(next);
    };
    window.addEventListener(STACK_FLIP, flip);
    return () => window.removeEventListener(STACK_FLIP, flip);
  }, [item.id, all]);
  const canEdit = useCanEdit();
  const [fanned, setFanned] = useState(false);
  const [hot, setHot] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const fan = fanned && !lifted;

  /*
   * A click on a SELECTED pile opens it. The press itself is `ItemView`'s —
   * it selects the group and drags it like any group — and it captures the
   * pointer on the frame, which retargets the click there; so the click is
   * heard on the frame, and only when the pointer did not travel. Whether the
   * stack was selected is read in the capture phase, before `ItemView`'s own
   * handler selects it: the first click selects, the next one opens. A
   * double-click would enter the group, and a stack has no floor to stand on.
   */
  useEffect(() => {
    const frame = ref.current?.closest<HTMLElement>(".item");
    if (!frame) return;
    const off = new AbortController();
    const { signal } = off;
    let down: { x: number; y: number } | null = null;
    frame.addEventListener("pointerdown", (e) => {
      const ui = useUiStore.getState();
      const selected = ui.selectedItemIds.length === 1 && ui.selectedItemIds[0] === item.id;
      down = selected && e.button === 0 && !e.shiftKey && !e.altKey && !reachHeld(e) && ui.activeTool === "select" && !ui.commentMode ? { x: e.clientX, y: e.clientY } : null;
    }, { signal, capture: true });
    frame.addEventListener("click", (e) => {
      const from = down;
      down = null;
      if (!from || e.detail > 1 || (e.target as Element).closest("button") || Math.hypot(e.clientX - from.x, e.clientY - from.y) > 4) return;
      setFanned(false);
      setOpen(true);
    }, { signal });
    frame.addEventListener("dblclick", (e) => e.stopPropagation(), { signal });
    return () => off.abort();
  }, [item.id]);

  const s = GROUP_STACK;
  const rest = (one: { x: number; y: number; rotate: number }) => `translate(${one.x}px, ${one.y}px) rotate(${one.rotate}deg)`;
  return (
    <div ref={ref} className="group-stack">
      <div className="stack-band" style={{ height: s.title }}>
        <span className="stack-title">{item.title}</span>
        <small className="group-member-count">{members.length} {members.length === 1 ? "item" : "items"}</small>
        {canEdit && <button type="button" className="group-stack-toggle" onPointerDown={(e) => e.stopPropagation()} onClick={() => stackGroup(canvasId, actor, item, false)}>Spread</button>}
      </div>
      <div
        className={`stack-pile${fan ? " fanned" : ""}`}
        style={{ left: s.pad, top: s.title + s.pad, width: s.width, height: s.height }}
        onPointerEnter={(e) => { if (e.buttons === 0) setFanned(true); }}
        onPointerLeave={() => { setFanned(false); setHot(null); }}
      >
        {pile.slice().reverse().map((card) => {
          const member = members[card.depth]!;
          const side = card.depth === 0 ? "" : card.depth % 2 ? " left" : " right";
          return (
            <div
              key={card.id}
              className={`stack-card${card.depth === 0 ? " top" : ""}${side}${fan && hot === card.id ? " lifted" : ""}${flipping?.id === card.id ? ` ${flipping.way}` : ""}`}
              onAnimationEnd={() => { if (flipping?.id === card.id) setFlipping(null); }}
              data-depth={card.depth}
              data-member-id={card.id}
              style={{ transform: rest(fan ? stackFan(card.depth) : card), ...({ "--tint": tintOf(member) } as React.CSSProperties) }}
              onPointerEnter={() => setHot(card.id)}
            >
              <span className="stack-card-title">{member.title}</span>
              <span className="stack-card-face"><ItemThumb canvasId={canvasId} itemId={member.id} item={member} width={s.width} height={s.height - 36} /></span>
            </div>
          );
        })}
        {members.length === 0 && <div className="stack-card top empty"><span className="stack-card-title">Empty</span></div>}
      </div>
      {open && <StackOpen group={item} members={members} canvasId={canvasId} actor={actor} canEdit={canEdit} onClose={() => setOpen(false)} />}
    </div>
  );
}

/** A member's own colour where the app gives it one — its paper or tint — else the minimap's colour for its kind. Tokens, both themes. */
function tintOf(member: Item): string {
  const paper = paperOf(member) ?? areaTint(member);
  return paper ? `var(--paper-${paper})` : `var(--kind-${kindFamily(itemKind(member))})`;
}

/**
 * **The stack opened** — the Dock's grid: every member as a card in front of
 * the canvas, behind a scrim that a click or Esc closes. Nothing on the canvas
 * moves while it is open. A plain click selects a card; ⌘-dragging one takes
 * it out of the group, through the same group gesture and live drag every
 * other drag uses (`beginGroupGesture`, `publishDrag`).
 *
 * In a portal, so it is not scaled with the world — but React still bubbles
 * a portal's events to the group's `ItemView`, so they stop here.
 */
function StackOpen({ group, members, canvasId, actor, canEdit, onClose }: { group: Item; members: Item[]; canvasId: string; actor: Actor; canEdit: boolean; onClose: () => void }) {
  const selected = useUiStore((s) => s.selectedItemIds);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); onClose(); } };
    window.addEventListener("keydown", key, { capture: true });
    return () => window.removeEventListener("keydown", key, { capture: true });
  }, [onClose]);

  function takeOut(e: React.PointerEvent, member: Item) {
    const host = document.querySelector<HTMLElement>(".canvas-viewport");
    const semantic = host ? beginGroupGesture([member.id]) : null;
    if (!host || !semantic) return;
    e.preventDefault();
    // Held where it was held: the same point of the card stays under the pointer.
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width;
    const fy = (e.clientY - rect.top) / rect.height;
    const from = member.containerId ?? null;
    host.setPointerCapture(e.pointerId);
    onClose();
    semantic.lift();
    useUiStore.getState().setSelection([member.id]);
    let destination: string | null | undefined;
    const move = (ev: { clientX: number; clientY: number }) => {
      const point = screenToWorld(useUiStore.getState().viewport, ev.clientX, ev.clientY);
      const dx = point.x - fx * member.width - member.x;
      const dy = point.y - fy * member.height - member.y;
      const target = groupDropTarget(semantic.start.canvas, point, semantic.roots);
      const to = target?.id ?? null;
      // Back onto its own stack is no move at all: the card goes back in the pile.
      destination = to !== from ? to : undefined;
      useUiStore.getState().setGroupDropTarget(destination ?? null, destination === null ? from : null);
      semantic.move(dx, dy, destination, destination && target ? groupDropPolicy(target, point) : undefined);
      publishDrag(semantic.roots, dx, dy, destination);
    };
    move(e);
    follow(host, move, (ev) => {
      publishDrag();
      if (ev.type === "pointercancel" || destination === undefined) semantic.cancel();
      else void semantic.commit(canvasId, actor);
    });
  }

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return createPortal(
    <div className="stack-open" role="dialog" aria-label={`${group.title}, opened`} onPointerDown={stop} onPointerMove={stop} onClick={stop} onDoubleClick={stop} onContextMenu={stop} onWheel={stop}>
      <div className="stack-open-scrim" onClick={(e) => { if (e.detail <= 1) onClose(); }} />
      <div className="stack-open-panel">
        <div className="stack-open-head">
          <strong>{group.title}</strong>
          <small>{members.length} {members.length === 1 ? "item" : "items"}{canEdit ? " · ⌘-drag a card out to take it out" : ""}</small>
          <button type="button" onClick={onClose}>Close</button>
        </div>
        <div className="stack-open-grid">
          {members.map((member) => (
            <button
              type="button"
              key={member.id}
              className={`stack-open-card${selected.includes(member.id) ? " selected" : ""}`}
              data-member-id={member.id}
              style={{ "--tint": tintOf(member) } as React.CSSProperties}
              onPointerDown={(e) => { if (e.button === 0 && canEdit && groupsEnabled() && reachHeld(e)) takeOut(e, member); }}
              onClick={(e) => { if (!reachHeld(e)) useUiStore.getState().select(member.id); }}
            >
              <ItemThumb canvasId={canvasId} itemId={member.id} item={member} width={200} height={130} />
              <span className="stack-open-title">{member.title}</span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
