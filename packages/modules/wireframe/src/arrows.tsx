import { useEffect, useState } from "react";
import type { Item, UnderlayFacts } from "@isocan/core";
import { kept } from "./keep.ts";
import { LINKS_PROP, inferLinks, readOverrides, screenEdges, type WireScreen } from "./links.ts";
import { currentVersionOf } from "./port.ts";
import { PROTOTYPE_PROP } from "./prototype.ts";
import { readWire } from "./render.ts";
import type { WireSpec } from "./spec.ts";

/**
 * **The arrows between kept screens** (design §7; moved here from phase 3).
 *
 * Links are computed and never stored, so the arrows are too: each kept
 * screen's spec is read out of its own file (`readText`, cached per version
 * here and per hash by the shell), `inferLinks` says where every hotspot
 * goes, and one arrow is drawn per pair of screens it joins. Keep another
 * screen, move one, edit one — the next render says something different, and
 * nothing on the canvas records an arrow that could drift from its screens.
 *
 * Mounted only on a canvas with two or more kept screens (`activation.ts`),
 * under the items, in world units, like the mind map's lines.
 */

const specs = new Map<string, WireSpec | null>();

function keyOf(item: Item): string | null {
  const v = currentVersionOf(item);
  return v && v.mimeType === "text/html" ? v.blobHash : null;
}

/**
 * **Which kept screens link to which** — from each screen's spec, read out of
 * its current file, never from anything stored. `specOf` answers per version
 * hash (null: not a wire; undefined: not read yet). Exported for the test that
 * holds the arrows to the specs.
 */
export function keptArrows(canvas: UnderlayFacts["canvas"], specOf: (hash: string) => WireSpec | null | undefined): Array<{ from: string; to: string }> {
  const screens: WireScreen[] = [];
  for (const item of kept(canvas)) {
    if (item.properties?.[PROTOTYPE_PROP] !== undefined) continue;
    const spec = specOf(keyOf(item) ?? "");
    if (spec) screens.push({ id: item.id, title: item.title, spec, overrides: readOverrides(item.properties?.[LINKS_PROP]) });
  }
  return screens.length < 2 ? [] : screenEdges(inferLinks(screens));
}

export function WireArrows({ canvas, drag, readText }: UnderlayFacts) {
  const keepers = kept(canvas).filter((i) => i.properties?.[PROTOTYPE_PROP] === undefined);
  const hashes = keepers.map(keyOf).filter((h): h is string => h !== null);
  const [, setRead] = useState(0);
  const missing = hashes.filter((h) => !specs.has(h));
  const wanted = missing.join(",");

  useEffect(() => {
    if (!readText || wanted === "") return;
    let live = true;
    void Promise.all(wanted.split(",").map(async (hash) => {
      try {
        specs.set(hash, readWire(await readText(hash)));
      } catch {
        specs.set(hash, null);
      }
    })).then(() => {
      if (live) setRead((n) => n + 1);
    });
    return () => {
      live = false;
    };
  }, [wanted, readText]);

  const edges = keptArrows(canvas, (hash) => specs.get(hash));
  if (edges.length === 0) return null;

  const box = (id: string) => {
    const item = canvas.items[id]!;
    const on = drag?.itemIds.includes(id) ? drag : null;
    return { x: item.x + (on?.dx ?? 0), y: item.y + (on?.dy ?? 0), w: item.width, h: item.height };
  };
  // Two screens that link both ways get two arrows, side by side rather than on top of each other.
  const pairs = new Set(edges.map((e) => `${e.from}>${e.to}`));
  const drawn = edges.map(({ from, to }) => {
    const a = box(from);
    const b = box(to);
    const both = pairs.has(`${to}>${from}`);
    const dx = b.x + b.w / 2 - (a.x + a.w / 2);
    const dy = b.y + b.h / 2 - (a.y + a.h / 2);
    let x1: number, y1: number, x2: number, y2: number;
    if (Math.abs(dx) >= Math.abs(dy)) {
      const right = dx >= 0;
      const shift = both ? (right ? -18 : 18) : 0;
      x1 = right ? a.x + a.w : a.x;
      x2 = right ? b.x : b.x + b.w;
      y1 = a.y + a.h / 2 + shift;
      y2 = b.y + b.h / 2 + shift;
    } else {
      const down = dy >= 0;
      const shift = both ? (down ? 18 : -18) : 0;
      y1 = down ? a.y + a.h : a.y;
      y2 = down ? b.y : b.y + b.h;
      x1 = a.x + a.w / 2 + shift;
      x2 = b.x + b.w / 2 + shift;
    }
    // A link that skips over screens in the row bows above them, so it never runs through one.
    const skip = Math.abs(dx) > (a.w + b.w) / 2 + 200 && Math.abs(dy) < Math.min(a.h, b.h);
    const lift = skip ? Math.min(240, Math.abs(dx) * 0.18) : 0;
    const mx = (x1 + x2) / 2;
    const d = skip
      ? `M ${x1} ${a.y} C ${x1} ${a.y - lift}, ${x2} ${b.y - lift}, ${x2} ${b.y}`
      : `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
    return { key: `${from}>${to}`, d, pts: skip ? [x1, a.y - lift, x2, b.y - lift] : [x1, y1, x2, y2] };
  });

  const PAD = 24;
  const xs = drawn.flatMap((d) => [d.pts[0]!, d.pts[2]!]);
  const ys = drawn.flatMap((d) => [d.pts[1]!, d.pts[3]!]).concat(keepers.flatMap((k) => [k.y, k.y + k.height]));
  const minX = Math.min(...xs) - PAD;
  const minY = Math.min(...ys) - PAD;
  const width = Math.max(...xs) - minX + PAD;
  const height = Math.max(...ys) - minY + PAD;

  return (
    <svg className="wire-arrows" aria-hidden style={{ left: minX, top: minY, width, height }} viewBox={`${minX} ${minY} ${width} ${height}`}>
      <defs>
        <marker id="wire-arrowhead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path className="wire-arrowhead" d="M 0 0 L 10 5 L 0 10 z" />
        </marker>
      </defs>
      {drawn.map((d) => (
        <path key={d.key} className="wire-arrow" d={d.d} markerEnd="url(#wire-arrowhead)" data-link={d.key} />
      ))}
    </svg>
  );
}
