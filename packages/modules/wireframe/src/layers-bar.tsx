import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { CanvasContents, Item, UnderlayFacts } from "@isocan/core";
import { isWire, specKey } from "./behind.ts";
import { wiresOn } from "./flow.ts";
import {
  applyLayersOnCanvas,
  LAYER_LABELS,
  resolveItemLayers,
  TIER_LABELS,
} from "./layers.ts";
import { flowScreens } from "./presets.ts";
import { readWire } from "./render.ts";
import { cachedSpec, specs } from "./spec-cache.ts";
import { WIRE_LAYER_IDS, type WireLayerId } from "./spec.ts";
import type { WirePort } from "./port.ts";

/** The flow a wire belongs to, from its spec: the flow's name, or the item itself when it stands alone. */
function flowOf(item: Item): string {
  const spec = cachedSpec(specKey(item) ?? "");
  return spec?.flow || item.id;
}

/** The words on the flow row: how many screens the act reaches, and the flow's name when it has one. */
export function applyToFlowLabel(count: number, flowName: string | null): string {
  const screens = `${count} screen${count === 1 ? "" : "s"}`;
  return flowName ? `Apply to all ${screens} in “${flowName}”` : `Apply to all ${screens}`;
}

/**
 * **The screen's under-frame tier pill** (`layers.ts`): when a wireframe
 * screen is hovered or selected, one small pill — `◧ High-Fi ▾`, the size of
 * the size pill beside it — sits centered just under its bottom border in the
 * `.item-under` lane. It is small on purpose: the lane is counter-scaled, so
 * anything wide outgrows the screen when zoomed out. Clicking the pill
 * selects the screen and opens a popover with the four layer checkboxes
 * (`System`, `Copy`, `Low-Fi`, `High-Fi`) and one row that says exactly what
 * it does — *Apply to all N screens in “flow”* — which sets every screen in
 * the flow to this one's layers and rebuilds the prototype. The popover stays
 * open while toggling, so several toggles are one click each. With several
 * screens selected and their tiers disagreeing, the pill reads `Mixed`.
 */
export function WireLayersBar({
  canvas,
  selection,
  readText,
  host,
  canEdit,
  past,
}: Pick<UnderlayFacts, "canvas" | "selection" | "readText" | "host" | "canEdit" | "past">) {
  const [, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [pointedId, setPointedId] = useState<string | null>(null);
  const [barHoverId, setBarHoverId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const origin = useRef<SVGSVGElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<CanvasContents>(canvas);
  canvasRef.current = canvas;

  const allWires: Item[] = Object.values(canvas.items).filter(isWire);
  const wiresKey = allWires.map((w) => w.id).join(",");

  // Hit-test wireframe screens (plus the 42px under-bar strip) on pointermove so hovering a screen reveals its pill underneath.
  useEffect(() => {
    if (past || !host || !wiresKey) return;
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
        const scale = Math.abs(ctm.a) || 1;
        setScale(scale);
        const underPad = 42 / scale;
        const items = canvasRef.current.items;
        const hit =
          wiresKey.split(",").find((id) => {
            const it = items[id];
            return (
              it !== undefined &&
              p.x >= it.x &&
              p.x <= it.x + it.width &&
              p.y >= it.y &&
              p.y <= it.y + it.height + underPad
            );
          }) ?? null;
        setPointedId(hit);
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [past, host, wiresKey]);

  // The popover closes on a click outside it or Escape.
  useEffect(() => {
    if (!openId) return;
    const onDown = (e: PointerEvent) => {
      if (barRef.current && e.target instanceof Node && barRef.current.contains(e.target)) return;
      setOpenId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [openId]);

  const selectedWires: Item[] = (selection ?? [])
    .map((id) => canvas.items[id])
    .filter((i): i is Item => i !== undefined && isWire(i));

  // An open popover belongs to the screen it was opened on; it does not follow the pointer.
  const openWire = openId ? canvas.items[openId] : undefined;
  const open = openWire !== undefined && isWire(openWire);
  const hoveredId = barHoverId ?? pointedId;
  const hoveredWire = hoveredId ? canvas.items[hoveredId] : undefined;
  const activeWires: Item[] = open
    ? selectedWires.some((w) => w.id === openWire.id)
      ? selectedWires
      : [openWire]
    : hoveredWire && isWire(hoveredWire)
      ? selectedWires.some((w) => w.id === hoveredWire.id)
        ? selectedWires
        : [hoveredWire]
      : selectedWires;

  // The screens shown need their specs for the tier; an open popover needs every wire's, to count the flow.
  const wanted = (open ? allWires : activeWires)
    .map(specKey)
    .filter((h): h is string => h !== null && !specs.has(h))
    .join(",");

  useEffect(() => {
    if (!readText || !wanted) return;
    let live = true;
    void Promise.all(
      wanted.split(",").map(async (hash) => {
        try {
          specs.set(hash, readWire(await readText(hash)));
        } catch {
          specs.set(hash, null);
        }
      }),
    ).then(() => {
      if (live) setTick((n) => n + 1);
    });
    return () => {
      live = false;
    };
  }, [wanted, readText]);

  if (activeWires.length === 0) {
    return <svg ref={origin} className="wire-origin" aria-hidden />;
  }

  // Anchor underneath the open screen, else the hovered one, else the primary selected screen.
  const anchor = open
    ? openWire
    : hoveredWire && isWire(hoveredWire)
      ? hoveredWire
      : [...activeWires].sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x - b.x))[0]!;
  const primarySpec = cachedSpec(specKey(anchor) ?? "");
  const resolved = resolveItemLayers(anchor, primarySpec);
  const editable = !past && canEdit !== false && Boolean(host) && Boolean(readText);

  // The lane under a screen also holds the reaction button and the size pill; when the screen is
  // narrower on-screen than the three need, the pill would sit on top of one of them — so it waits
  // for a zoom that has room, unless it is already open.
  const LANE_MIN_PX = 300;
  if (!open && anchor.width * scale < LANE_MIN_PX) {
    return <svg ref={origin} className="wire-origin" aria-hidden />;
  }

  const tiers = new Set(activeWires.map((w) => resolveItemLayers(w, cachedSpec(specKey(w) ?? "")).tier));
  const mixed = tiers.size > 1;
  const tierInfo = TIER_LABELS[resolved.tier];

  const anchorSpec = primarySpec;
  const flowKey = anchorSpec?.flow || "";
  const flowName = flowKey ? canvas.items[flowKey]?.title ?? (flowKey.startsWith("grp_") ? null : flowKey) : null;
  const flow = flowOf(anchor);
  const flowCount = allWires.filter((w) => w.id === anchor.id || flowOf(w) === flow).length;

  const ensureSelected = () => {
    if (!host?.select) return;
    const currentSel = selection ?? [];
    if (!currentSel.includes(anchor.id)) {
      host.select([anchor.id]);
    }
  };

  const targetIdsForAction = (): string[] => {
    const currentSel = selection ?? [];
    if (currentSel.includes(anchor.id) && selectedWires.length > 0) {
      return selectedWires.map((w) => w.id);
    }
    return [anchor.id];
  };

  const portFor = (): WirePort => ({
    canvasId: "canvas",
    actor: host!.viewer ? { id: host!.viewer.id, name: host!.viewer.name } : undefined,
    canvas: async () => canvasRef.current,
    readText: (hash) => readText!(hash),
    put: (text, mimeType, filename) => host!.putBlob(new Blob([text], { type: mimeType }), filename),
    send: async (op, group) => {
      await host!.send([op], group);
    },
  });

  const run = async (directive: string, wholeFlow: boolean) => {
    if (!editable || !host || !readText || busy) return;
    ensureSelected();
    const targetIds = targetIdsForAction();
    setBusy(true);
    try {
      const port = portFor();
      const currentCanvas = canvasRef.current;
      const all = await wiresOn(port, currentCanvas);
      const targets = wholeFlow ? flowScreens(all, targetIds) : all.filter((s) => targetIds.includes(s.item));
      if (targets.length === 0) return;
      await applyLayersOnCanvas(port, currentCanvas, all, targets, directive);
    } finally {
      setBusy(false);
    }
  };

  const toggleLayer = (id: WireLayerId) => void run(`toggle:${id}`, false);

  return (
    <>
      <svg ref={origin} className="wire-origin" aria-hidden />
      <div
        ref={barRef}
        className={`wire-layer-bar${open ? " open" : ""}`}
        data-wire-layers={anchor.id}
        data-wire-tier={mixed ? "mixed" : resolved.tier}
        style={{ left: anchor.x + anchor.width / 2, top: anchor.y + anchor.height } as CSSProperties}
        onPointerEnter={() => setBarHoverId(anchor.id)}
        onPointerLeave={() => setBarHoverId((prev) => (prev === anchor.id ? null : prev))}
        onPointerDown={(e) => {
          e.stopPropagation();
          ensureSelected();
        }}
      >
        <button
          type="button"
          className="wire-tier-pill"
          aria-haspopup="dialog"
          aria-expanded={open}
          title={mixed ? "Selected screens are at different fidelity tiers" : `${tierInfo.title} — ${tierInfo.summary}`}
          onClick={() => {
            ensureSelected();
            setOpenId((prev) => (prev === anchor.id ? null : anchor.id));
          }}
        >
          <span className="wire-tier-glyph" aria-hidden>
            ◧
          </span>
          <span>{mixed ? "Mixed" : tierInfo.badge}</span>
          <span className="wire-tier-caret" aria-hidden>
            ▾
          </span>
        </button>
        {open && (
          <div className="wire-layer-pop" role="dialog" aria-label="Screen fidelity layers">
            <div className="wire-layer-checks">
              {WIRE_LAYER_IDS.map((id) => {
                const checked = resolved[id];
                const info = LAYER_LABELS[id];
                return (
                  <button
                    key={id}
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    disabled={!editable || busy}
                    className={`wire-layer-check${checked ? " on" : ""}`}
                    title={`${info.label}: ${info.hint}`}
                    onClick={() => toggleLayer(id)}
                  >
                    <span className="wire-layer-box" aria-hidden>
                      {checked ? "✓" : ""}
                    </span>
                    <span>{info.short}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className="wire-layer-flow"
              disabled={!editable || busy || flowCount < 2}
              title={
                flowCount < 2
                  ? "This screen is not part of a flow"
                  : "Set every screen in this flow to these layers and rebuild its clickable prototype"
              }
              onClick={() => void run(resolved.tier, true)}
            >
              <span>{applyToFlowLabel(flowCount, flowName)}</span>
              <span aria-hidden>→</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
