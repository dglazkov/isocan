import type { Item, UnderlayFacts } from "@isocan/core";
import { kept } from "./keep.ts";
import { prototypeScreens } from "./kept-flows.ts";
import { currentVersionOf } from "./port.ts";
import { PROTOTYPE_PROP } from "./prototype.ts";
import type { WireSpec } from "./spec.ts";

/**
 * **A selected prototype lights the screens it plays** (24 Sep 2026, Dion).
 *
 * While ONE prototype is this viewer's selection, every kept screen it plays
 * — its flow's own and any guest from another flow — gets a brief pulse and
 * then a steady outline, and everything else on the canvas steps back under
 * a veil with a hole for each of them and for the prototype. The model is
 * the minimap's prototype spotlight and the arrows' hover dim (phase 8).
 *
 * It is one person's view, so it writes nothing: it reads the selection the
 * shell hands every underlay and paints in the underlay's above-the-items
 * layer, untouchable (`pointer-events: none`), gone the moment the selection
 * changes. Specs come from the arrows' own cache (`specOf`), which has read
 * every kept screen by the time anybody selects anything.
 */
export function PrototypeLight({ canvas, selection, drag, specOf }: Pick<UnderlayFacts, "canvas" | "selection" | "drag"> & { specOf: (hash: string) => WireSpec | null | undefined }) {
  const id = selection?.length === 1 ? selection[0]! : null;
  const prototype = id ? canvas.items[id] : undefined;
  if (!prototype || prototype.properties?.[PROTOTYPE_PROP] === undefined) return null;
  const wires: Array<{ item: string; spec: WireSpec }> = [];
  for (const item of kept(canvas)) {
    const v = currentVersionOf(item);
    const spec = v && v.mimeType === "text/html" ? specOf(v.blobHash) : null;
    if (spec) wires.push({ item: item.id, spec });
  }
  const members = prototypeScreens(canvas, prototype, wires);
  if (members.length === 0) return null;
  const box = (i: Item) => {
    const on = drag?.itemIds.includes(i.id) ? drag : null;
    return { id: i.id, x: i.x + (on?.dx ?? 0), y: i.y + (on?.dy ?? 0), w: i.width, h: i.height };
  };
  const all = Object.values(canvas.items).map(box);
  // The veil reaches well past everything on the canvas, so panning never finds its edge.
  const pad = 20000;
  const minX = Math.min(...all.map((b) => b.x)) - pad;
  const minY = Math.min(...all.map((b) => b.y)) - pad;
  const width = Math.max(...all.map((b) => b.x + b.w)) + pad - minX;
  const height = Math.max(...all.map((b) => b.y + b.h)) + pad - minY;
  const lit = [...members.map(box), box(prototype)];
  const hole = (b: { x: number; y: number; w: number; h: number }) => `M ${b.x} ${b.y} h ${b.w} v ${b.h} h ${-b.w} z`;
  const veil = `M ${minX} ${minY} h ${width} v ${height} h ${-width} z ${lit.map(hole).join(" ")}`;
  return (
    // Keyed by the prototype, so selecting another one pulses again.
    <svg key={prototype.id} className="wire-light" style={{ left: minX, top: minY, width, height }} viewBox={`${minX} ${minY} ${width} ${height}`} data-wire-light={prototype.id} aria-hidden>
      <path className="wire-light-veil" d={veil} fillRule="evenodd" />
      {members.map(box).map((b) => (
        <rect key={b.id} className="wire-light-ring" data-member={b.id} x={b.x - 6} y={b.y - 6} width={b.w + 12} height={b.h + 12} rx={12} />
      ))}
    </svg>
  );
}
