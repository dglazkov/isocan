import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { newGroupId, type CanvasContents, type Item, type UnderlayFacts } from "@isocan/core";
import { kept } from "./keep.ts";
import { keptFlowsOf } from "./kept-flows.ts";
import { linkChanges, linkPatch, overrideValue, type ArrowWrite } from "./link-override.ts";
import { hotspots, inferLinks, screenEdges, type WireLink, type WireScreen } from "./links.ts";
import { currentVersionOf } from "./port.ts";
import { PROTOTYPE_PROP, playAnchor } from "./prototype.ts";
import { readWire, renderWire } from "./render.ts";
import { arrowId, estimatedHot, labelShown, roundedPath, routeFlow, type FlowArrow, type HotRect, type NeedsMark, type RouteBox } from "./route.ts";
import type { WireSpec } from "./spec.ts";

/**
 * **The arrows between kept screens** (design §7; phase 8, research *Flow
 * arrows*).
 *
 * Links are computed and never stored, so the arrows are too: each kept
 * screen's spec is read out of its own file (`readText`, cached per version
 * here and per hash by the shell), `inferLinks` says where every hotspot
 * goes — **per kept flow**, with the same grouping `wire links` and the
 * prototype use (`keptFlowsOf`), so the canvas never draws a link the
 * prototype does not play — and `routeFlow` lays **one arrow per hotspot**,
 * leaving from where the hotspot is on its screen. Where it is, is measured:
 * the renderer draws the screen's spec in one hidden frame (never the
 * fetched bytes — nothing foreign renders same-origin) and the `[data-hot]`
 * rects are read and cached per version.
 *
 * At rest the flow is drawn; tabs and loose ends wait until you point at
 * their screen; back is never drawn. An arrow is a thing you can use: hover
 * it and its hotspot lights on the source and the target gets a halo; click
 * it for *Play from here*, *Go to*, *Change target…* (or drag its head onto
 * another screen), *Remove* and *Reset* — every write the `item.update`
 * that `isocan wire link` sends (`link-override.ts`), one group, one undo.
 *
 * Mounted only on a canvas with two or more kept screens (`activation.ts`),
 * under the items, in world units, like the mind map's lines.
 */

const specs = new Map<string, WireSpec | null>();
/** A kept screen's spec by its version's hash, as the arrows have read it — null: not a wire; undefined: not read yet. */
export const cachedSpec = (hash: string): WireSpec | null | undefined => specs.get(hash);
/**
 * The name strip files rendered before phase 8 drew above the device frame,
 * in px. Today's renderer draws none (`CAPTION_HEIGHT` is 0), but screens
 * already on a canvas keep their file until `wire render --all`, so a
 * hotspot on one of those still sits this far down its item.
 */
const LEGACY_CAPTION = 32;
/** Per version: whether its file draws that caption (renders before phase 8 do). */
const capped = new Map<string, boolean>();
/** Per version: each hotspot's rect, relative to the device frame, as the renderer lays it out. */
const measured = new Map<string, Record<string, HotRect> | null>();
const measuring = new Set<string>();

function keyOf(item: Item): string | null {
  const v = currentVersionOf(item);
  return v && v.mimeType === "text/html" ? v.blobHash : null;
}

export interface FlowLinks {
  flow: string;
  screens: WireScreen[];
  items: Item[];
  links: WireLink[];
}

/**
 * **Each kept flow's links** — from each screen's spec, read out of its
 * current file, never from anything stored, and grouped by flow exactly as
 * `wire links` and `wire prototype` group them. `specOf` answers per version
 * hash (null: not a wire; undefined: not read yet).
 */
export function flowLinks(canvas: CanvasContents, specOf: (hash: string) => WireSpec | null | undefined): FlowLinks[] {
  const wires: Array<{ item: string; spec: WireSpec }> = [];
  for (const item of kept(canvas)) {
    if (item.properties?.[PROTOTYPE_PROP] !== undefined) continue;
    const spec = specOf(keyOf(item) ?? "");
    if (spec) wires.push({ item: item.id, spec });
  }
  return keptFlowsOf(canvas, wires)
    .filter((f) => f.screens.length > 1)
    // A guest (a screen kept in another flow that a person linked to) is drawn TO here and FROM in its own flow.
    .map((f) => ({ flow: f.flow, screens: f.screens, items: f.items, links: inferLinks(f.screens).filter((l) => !f.guests.includes(l.from)) }));
}

/**
 * **Which kept screens link to which**, once per pair — what the arrows join,
 * flow by flow. Exported for the test that holds the arrows to the specs.
 */
export function keptArrows(canvas: UnderlayFacts["canvas"], specOf: (hash: string) => WireSpec | null | undefined): Array<{ from: string; to: string }> {
  return flowLinks(canvas, specOf).flatMap((f) => screenEdges(f.links));
}

/**
 * **Measure a screen's hotspots** in one hidden, script-less frame: the
 * renderer's own drawing of the spec, laid out at its size, `[data-hot]`
 * read relative to the device frame. The harness measured 30–150 ms a frame
 * to load and under 1 ms to read.
 */
function measure(hash: string, spec: WireSpec, done: () => void) {
  if (measuring.has(hash) || measured.has(hash) || typeof document === "undefined") return;
  measuring.add(hash);
  const frame = document.createElement("iframe");
  frame.setAttribute("sandbox", "allow-same-origin");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  Object.assign(frame.style, { position: "fixed", left: "-10000px", top: "0", width: "1600px", height: "2400px", border: "0", visibility: "hidden", pointerEvents: "none" });
  const finish = (rects: Record<string, HotRect> | null) => {
    measured.set(hash, rects);
    measuring.delete(hash);
    frame.remove();
    done();
  };
  frame.onload = () => {
    try {
      const doc = frame.contentDocument!;
      const device = doc.querySelector(".frame");
      const origin = device?.getBoundingClientRect() ?? { left: 0, top: 0 };
      const rects: Record<string, HotRect> = {};
      for (const el of Array.from(doc.querySelectorAll("[data-hot]"))) {
        const r = el.getBoundingClientRect();
        const key = el.getAttribute("data-hot")!;
        if ((r.width === 0 && r.height === 0) || rects[key]) continue;
        rects[key] = { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height };
      }
      finish(rects);
    } catch {
      finish(null);
    }
  };
  try {
    frame.srcdoc = renderWire(spec);
    document.body.appendChild(frame);
  } catch {
    finish(null);
  }
}

/** A hotspot on an item, in the item's own world units: measured when it has been, estimated until then. */
function hotOn(item: Item, spec: WireSpec | undefined, key: string): HotRect {
  const hash = keyOf(item);
  const rects = hash ? measured.get(hash) : undefined;
  const r = rects?.[key];
  if (r) {
    const top = hash && capped.get(hash) ? LEGACY_CAPTION : 0;
    return { x: r.x, y: r.y + top, w: r.w, h: r.h };
  }
  const navCount = spec ? hotspots(spec).filter((h) => h.tab).length : 0;
  return estimatedHot(key, { w: item.width, h: item.height }, navCount || 4);
}

interface Drawn {
  flow: FlowLinks;
  arrows: FlowArrow[];
  needs: NeedsMark[];
  boxes: Map<string, RouteBox>;
}

interface Retarget {
  id: string;
  x: number;
  y: number;
  over: string | null;
}

export function WireArrows({ canvas, drag, readText, host, canEdit, past, openItem }: UnderlayFacts) {
  const keepers = kept(canvas).filter((i) => i.properties?.[PROTOTYPE_PROP] === undefined);
  const hashes = keepers.map(keyOf).filter((h): h is string => h !== null);
  const [, setRead] = useState(0);
  const bump = () => setRead((n) => n + 1);
  const missing = hashes.filter((h) => !specs.has(h));
  const wanted = missing.join(",");
  const [pointed, setPointed] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [retarget, setRetarget] = useState<Retarget | null>(null);
  const origin = useRef<SVGSVGElement | null>(null);
  const interactive = !past && host !== undefined;

  useEffect(() => {
    if (!readText || wanted === "") return;
    let live = true;
    void Promise.all(wanted.split(",").map(async (hash) => {
      try {
        const text = await readText(hash);
        specs.set(hash, readWire(text));
        capped.set(hash, /<div class="cap[ "]/.test(text));
      } catch {
        specs.set(hash, null);
      }
    })).then(() => {
      if (live) bump();
    });
    return () => {
      live = false;
    };
  }, [wanted, readText]);

  // Measure what has been read and not yet laid out.
  useEffect(() => {
    let live = true;
    for (const h of hashes) {
      const spec = specs.get(h);
      if (spec && !measured.has(h)) measure(h, spec, () => live && bump());
    }
    return () => {
      live = false;
    };
  });

  const flows = flowLinks(canvas, (hash) => specs.get(hash));
  const screenIds = new Set(flows.flatMap((f) => f.screens.map((s) => s.id)));

  // Point at a screen to see its tabs and loose ends: hit-test kept screens in world units, a frame at a time.
  const screensKey = [...screenIds].join(",");
  useEffect(() => {
    if (!interactive || screensKey === "") return;
    let frame = 0;
    let last: PointerEvent | null = null;
    const onMove = (e: PointerEvent) => {
      last = e;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const svg = origin.current;
        const ctm = svg?.getScreenCTM();
        if (!svg || !ctm || !last) return;
        const p = new DOMPoint(last.clientX, last.clientY).matrixTransform(ctm.inverse());
        const items = canvasRef.current.items;
        const hit = screensKey.split(",").find((id) => {
          const it = items[id];
          return it && p.x >= it.x && p.x <= it.x + it.width && p.y >= it.y && p.y <= it.y + it.height;
        }) ?? null;
        // Leaving a screen for one of its own arrows keeps the screen pointed at, or its tabs would vanish under the pointer.
        setPointed((was) => (hit === null && was !== null && holdRef.current === was ? was : hit));
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [interactive, screensKey]);
  const holdRef = useRef<string | null>(null);
  holdRef.current = (hover ?? selected)?.split("|")[0] ?? null;
  const canvasRef = useRef(canvas);
  canvasRef.current = canvas;

  // A press anywhere but an arrow, its handle or its toolbar lets the arrow go; so does Escape.
  useEffect(() => {
    if (!selected) return;
    const onDown = (e: PointerEvent) => {
      if ((e.target as Element | null)?.closest?.("[data-wire-arrow-ui]")) return;
      setSelected(null);
      setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (retargetRef.current) setRetarget(null);
      else {
        setSelected(null);
        setMenu(false);
      }
      e.stopPropagation();
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [selected]);
  const retargetRef = useRef(retarget);
  retargetRef.current = retarget;

  if (flows.length === 0) return <svg ref={origin} className="wire-origin" aria-hidden />;

  const box = (item: Item): RouteBox => {
    const on = drag?.itemIds.includes(item.id) ? drag : null;
    return { id: item.id, x: item.x + (on?.dx ?? 0), y: item.y + (on?.dy ?? 0), w: item.width, h: item.height };
  };
  const all = Object.values(canvas.items);
  const drawn: Drawn[] = flows.map((flow) => {
    const boxes = new Map(flow.items.map((i) => [i.id, box(i)]));
    const mine = [...boxes.values()];
    // Everything else a lane has to clear — but not a frame that holds the screens.
    const obstacles = all
      .filter((i) => !boxes.has(i.id) && i.properties?.kind !== "group")
      .map(box)
      .filter((o) => !mine.some((s) => o.x <= s.x && o.y <= s.y && o.x + o.w >= s.x + s.w && o.y + o.h >= s.y + s.h));
    const specById = new Map(flow.screens.map((s) => [s.id, s.spec]));
    const { arrows, needs } = routeFlow({
      screens: mine,
      obstacles,
      links: flow.links,
      hot: (id, key) => {
        const item = canvas.items[id];
        return item ? hotOn(item, specById.get(id), key) : null;
      },
      // While a head is in hand the screen under the pointer is a drop target, not a screen to explain.
      pointed: interactive && !retarget ? pointed ?? holdRef.current : null,
    });
    return { flow, arrows, needs, boxes };
  });

  const scale = origin.current?.getScreenCTM()?.a ?? 1;
  const every = drawn.flatMap((d) => d.arrows.map((a) => ({ a, d })));
  const sel = every.find((x) => x.a.id === selected) ?? null;
  const focus = retarget ? retarget.id : hover ?? selected;
  const focused = every.find((x) => x.a.id === focus) ?? null;
  const title = (id: string) => canvas.items[id]?.title ?? id;

  // Every write is one `wire link`: the op it sends, as the viewer, one group, one undo.
  const act = (a: FlowArrow, w: ArrowWrite) => {
    setMenu(false);
    if (w.kind !== "retarget") setSelected(null);
    else setSelected(arrowId({ from: a.link.from, key: a.link.key }));
    const item = canvasRef.current.items[a.link.from];
    if (!host || !item) return;
    const value = overrideValue(w);
    if (!linkChanges(item, a.link.key, value)) return;
    host.send([{ type: "item.update", itemId: item.id, patch: linkPatch(item, a.link.key, value) }], newGroupId()).catch(() => undefined);
  };
  const choose = (id: string) => {
    setSelected(id);
    setMenu(false);
    host?.select([]);
  };

  const toWorld = (e: { clientX: number; clientY: number }) => {
    const ctm = origin.current?.getScreenCTM();
    if (!ctm) return null;
    return new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
  };
  const screenAt = (d: Drawn, x: number, y: number) => [...d.boxes.values()].find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)?.id ?? null;

  const startRetarget = (e: ReactPointerEvent, a: FlowArrow, d: Drawn) => {
    if (!canEdit) return;
    e.stopPropagation();
    e.preventDefault();
    const el = e.currentTarget as Element;
    el.setPointerCapture?.(e.pointerId);
    const p = toWorld(e);
    if (!p) return;
    setRetarget({ id: a.id, x: p.x, y: p.y, over: null });
    const move = (ev: PointerEvent) => {
      const q = toWorld(ev);
      if (!q) return;
      const over = screenAt(d, q.x, q.y);
      setRetarget({ id: a.id, x: q.x, y: q.y, over: over === a.link.from ? null : over });
    };
    const up = (ev: PointerEvent) => {
      el.removeEventListener("pointermove", move as EventListener);
      el.removeEventListener("pointerup", up as EventListener);
      el.removeEventListener("pointercancel", cancel as EventListener);
      const q = toWorld(ev);
      const over = q ? screenAt(d, q.x, q.y) : null;
      const still = retargetRef.current !== null;
      setRetarget(null);
      // A drop on nothing, on the source itself, or after Escape changes nothing.
      if (still && over && over !== a.link.from && over !== a.link.to) act(a, { kind: "retarget", to: over });
    };
    const cancel = () => {
      el.removeEventListener("pointermove", move as EventListener);
      el.removeEventListener("pointerup", up as EventListener);
      setRetarget(null);
    };
    el.addEventListener("pointermove", move as EventListener);
    el.addEventListener("pointerup", up as EventListener);
    el.addEventListener("pointercancel", cancel as EventListener);
  };

  // The drawing's extent: every route point, every halo, and the screens themselves.
  const PAD = 40;
  const xs: number[] = [];
  const ys: number[] = [];
  for (const d of drawn) {
    for (const a of d.arrows) for (const [x, y] of a.pts) xs.push(x), ys.push(y);
    for (const b of d.boxes.values()) xs.push(b.x, b.x + b.w), ys.push(b.y, b.y + b.h);
  }
  if (retarget) xs.push(retarget.x), ys.push(retarget.y);
  const minX = Math.min(...xs) - PAD;
  const minY = Math.min(...ys) - PAD;
  const width = Math.max(...xs) - minX + PAD;
  const height = Math.max(...ys) - minY + PAD;
  const frame = { left: minX, top: minY, width, height };
  const viewBox = `${minX} ${minY} ${width} ${height}`;

  const halo = (b: RouteBox | undefined, soft = false) =>
    b ? <rect className={`wire-halo${soft ? " soft" : ""}`} x={b.x} y={b.y} width={b.w} height={b.h} rx={10} /> : null;
  const focusBoxes = focused ? focused.d.boxes : null;
  const haloOn = retarget ? retarget.over : focused?.a.link.to ?? null;
  const pointedBox = pointed && !retarget ? drawn.find((d) => d.boxes.has(pointed))?.boxes.get(pointed) : undefined;
  const prototypeOf = (flow: string) => all.find((i) => i.properties?.[PROTOTYPE_PROP] === flow) ?? null;

  const marker = (a: FlowArrow, on: boolean) => `url(#wire-head-${a.kind === "nav" ? "grey" : "accent"}${on ? "-on" : ""})`;

  return (
    <>
      <svg ref={origin} className="wire-origin" aria-hidden />
      <svg className="wire-arrows" style={frame} viewBox={viewBox} data-wire-arrow-ui role="group" aria-label="Flow arrows">
        <defs>
          {(["accent", "grey"] as const).flatMap((c) => [
            // 9 × 8 screen px at every zoom: sized in stroke widths of a stroke that counter-scales.
            <marker key={c} id={`wire-head-${c}`} viewBox="0 0 9 8" refX="9" refY="4" markerWidth="6" markerHeight={16 / 3} orient="auto" markerUnits="strokeWidth">
              <path className={`wire-head ${c}`} d="M 0 0 L 9 4 L 0 8 L 2.25 4 z" />
            </marker>,
            <marker key={`${c}-on`} id={`wire-head-${c}-on`} viewBox="0 0 9 8" refX="9" refY="4" markerWidth="3.6" markerHeight="3.2" orient="auto" markerUnits="strokeWidth">
              <path className={`wire-head ${c}`} d="M 0 0 L 9 4 L 0 8 L 2.25 4 z" />
            </marker>,
          ])}
        </defs>
        {pointedBox && !focused && halo(pointedBox, true)}
        {haloOn && halo(focusBoxes?.get(haloOn) ?? drawn.find((d) => d.boxes.has(haloOn))?.boxes.get(haloOn))}
        {every
          // The one in hand paints last, so it wins where hit paths meet near a shared target.
          .sort((p, q) => Number(p.a.id === focus) - Number(q.a.id === focus))
          .map(({ a }) => {
            const on = a.id === focus;
            const dim = focus !== null && !on;
            const d = roundedPath(a.pts);
            const words = `${a.link.label}, from ${title(a.link.from)} to ${title(a.link.to)}`;
            return (
              <g
                key={a.id}
                className={`wire-flow-arrow ${a.kind}${on ? " on" : ""}${dim ? " dim" : ""}${a.crowded ? " crowded" : ""}${a.id === selected ? " selected" : ""}${retarget?.id === a.id ? " moving" : ""}`}
                data-arrow={a.id}
                data-link={`${a.link.from}>${a.link.to}`}
                {...(interactive
                  ? {
                      role: "button",
                      tabIndex: 0,
                      "aria-label": words,
                      "aria-pressed": a.id === selected,
                      onPointerEnter: () => setHover(a.id),
                      onPointerLeave: () => setHover((h) => (h === a.id ? null : h)),
                      onPointerDown: (e: ReactPointerEvent) => {
                        // The canvas starts no marquee under an arrow.
                        e.stopPropagation();
                        if (e.button === 0) choose(a.id);
                      },
                      onFocus: () => setHover(a.id),
                      onBlur: () => setHover((h) => (h === a.id ? null : h)),
                      onKeyDown: (e: ReactKeyboardEvent) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          choose(a.id);
                        } else if ((e.key === "Delete" || e.key === "Backspace") && canEdit) {
                          e.preventDefault();
                          e.stopPropagation();
                          act(a, { kind: "remove" });
                        } else if (e.key === "Escape") {
                          e.stopPropagation();
                          setSelected(null);
                        }
                      },
                    }
                  : {})}
              >
                <path className="wire-flow-line" d={d} markerEnd={marker(a, on)} />
                <circle className="wire-port" cx={a.pts[0]![0]} cy={a.pts[0]![1]} />
                {interactive && <path className="wire-flow-hit" d={d} />}
              </g>
            );
          })}
      </svg>
      {every.map(({ a }) => {
        const on = a.id === focus;
        const dim = focus !== null && !on;
        // Not drawn at rest at this zoom (a short run, or a neighbour's label in the way): on hover it shows, lifted clear of the line.
        const lifted = on && !labelShown(a, scale);
        // `--show` is the zoom it is drawn at rest from (route.ts, `placeLabels`); a label that never fits waits for hover.
        const show = Number.isFinite(a.label.show) ? Math.round(a.label.show * 1e4) / 1e4 : 1e6;
        return (
          <div
            key={a.id}
            className={`wire-arrow-label ${a.kind}${on ? " on" : ""}${dim ? " dim" : ""}${lifted ? " lifted" : ""}`}
            data-arrow-label={a.id}
            style={{ left: a.label.x, top: a.label.y, "--run": a.label.run, "--show": show } as CSSProperties}
            aria-hidden
          >
            {a.link.label}
          </div>
        );
      })}
      {/* Above the items, transient and untouchable (core/modules.ts, "What an underlay may paint ABOVE"). */}
      <svg className="wire-arrows-over" style={frame} viewBox={viewBox} aria-hidden>
        {focused && (() => {
          const src = focused.d.boxes.get(focused.a.link.from)!;
          const item = canvas.items[focused.a.link.from];
          const r = item ? hotOn(item, undefined, focused.a.link.key) : null;
          return r ? <rect className="wire-hot" x={src.x + r.x - 3} y={src.y + r.y - 3} width={r.w + 6} height={r.h + 6} rx={6} /> : null;
        })()}
        {drawn.flatMap((d) => d.needs).map((n) => (
          <rect key={n.id} className="wire-needs" x={n.rect.x - 3} y={n.rect.y - 3} width={n.rect.w + 6} height={n.rect.h + 6} rx={6} />
        ))}
        {retarget && sel && (() => {
          const pts = sel.a.pts;
          const [px, py] = pts[pts.length - 2]!;
          return <path className="wire-band" d={`M ${px} ${py} L ${retarget.x} ${retarget.y}`} />;
        })()}
      </svg>
      {drawn.flatMap((d) => d.needs).map((n) => (
        <div key={n.id} className="wire-needs-label" style={{ left: n.rect.x + n.rect.w / 2, top: n.rect.y }} aria-hidden>
          needs {n.link.needs}
        </div>
      ))}
      {sel && interactive && (() => {
        const { a, d } = sel;
        const tip = a.pts[a.pts.length - 1]!;
        const proto = prototypeOf(d.flow.flow);
        const byHand = a.link.rule === "override";
        const targets = d.flow.screens.filter((s) => s.id !== a.link.from);
        return (
          <>
            {canEdit && (
              <svg className="wire-arrows-handle" style={frame} viewBox={viewBox} data-wire-arrow-ui>
                <circle
                  className="wire-handle"
                  cx={tip[0]}
                  cy={tip[1]}
                  role="button"
                  aria-label={`Drag to change where ${a.link.label} goes`}
                  onPointerDown={(e) => startRetarget(e, a, d)}
                />
              </svg>
            )}
            {!retarget && <div className="wire-arrow-bar" style={{ left: a.label.x, top: a.label.y }} data-wire-arrow-ui onPointerDown={(e) => e.stopPropagation()} role="toolbar" aria-label={`${a.link.label} — ${title(a.link.from)} to ${title(a.link.to)}`}>
              {proto ? (
                <button type="button" className="primary" onClick={() => openItem?.(proto.id, playAnchor(a.link.from, a.link.key))}>
                  ▶ Play from here
                </button>
              ) : (
                <span className="wire-bar-note" title="Make one with /wire prototype, or isocan wire prototype">No prototype yet — /wire prototype</span>
              )}
              <button type="button" onClick={() => host?.reveal([a.link.to])}>Go to {title(a.link.to)}</button>
              {canEdit && (
                <>
                  <span className="sep" />
                  <button type="button" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>Change target…</button>
                  {byHand && <button type="button" onClick={() => act(a, { kind: "reset" })} title="Give this hotspot back to the rules (wire link --clear)">Reset</button>}
                  <button type="button" onClick={() => act(a, { kind: "remove" })} title="This hotspot goes nowhere (wire link --none) — Delete does this too">Remove</button>
                </>
              )}
              <span className="wire-bar-note">{a.link.transition}{byHand ? " · set by hand" : " · inferred"}</span>
              {menu && canEdit && (
                <div className="wire-arrow-menu" role="menu" aria-label={`Where ${a.link.label} goes`}>
                  {targets.map((s) => (
                    <button key={s.id} type="button" role="menuitemradio" aria-checked={s.id === a.link.to} onClick={() => act(a, { kind: "retarget", to: s.id })}>
                      {s.title}
                    </button>
                  ))}
                  <button type="button" role="menuitemradio" aria-checked={false} onClick={() => act(a, { kind: "back" })}>Back</button>
                  <button type="button" role="menuitemradio" aria-checked={false} onClick={() => act(a, { kind: "remove" })}>Nowhere</button>
                </div>
              )}
            </div>}
          </>
        );
      })()}
    </>
  );
}
