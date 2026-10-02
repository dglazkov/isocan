import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { CanvasContents, Item, UnderlayFacts } from "@isocan/core";
import { isWire, specKey } from "./behind.ts";
import { wiresOn } from "./flow.ts";
import {
  applyLayersOnCanvas,
  LAYER_LABELS,
  parseLayerDirective,
  resolveItemLayers,
  TIER_LABELS,
} from "./layers.ts";
import { flowScreens } from "./presets.ts";
import { readWire } from "./render.ts";
import { cachedSpec, specs } from "./spec-cache.ts";
import { WIRE_LAYER_IDS, type WireLayerId } from "./spec.ts";
import type { WirePort } from "./port.ts";

/**
 * **The screen's under-frame Layers bar** (`layers.ts`): when a wireframe
 * screen is hovered or selected on the canvas, a counter-scaled pill bar sits
 * centered just underneath its bottom border (in the `.item-under` lane beside
 * *Full screen* and the size pill) with checkable toggles for each layer
 * (`System`, `Copy`, `Low-Fi`, `High-Fi`) and a `Sync flow` button. Clicking a
 * layer on a hovered screen selects it and toggles the layer in one click —
 * no double-clicking to interact and nothing covering the screen.
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
  const origin = useRef<SVGSVGElement | null>(null);
  const canvasRef = useRef<CanvasContents>(canvas);
  canvasRef.current = canvas;

  const allWires: Item[] = Object.values(canvas.items).filter(isWire);
  const wiresKey = allWires.map((w) => w.id).join(",");

  // Hit-test wireframe screens (plus the 42px under-bar strip) on pointermove so hovering a screen reveals its layers underneath.
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

  const selectedWires: Item[] = (selection ?? [])
    .map((id) => canvas.items[id])
    .filter((i): i is Item => i !== undefined && isWire(i));

  const hoveredId = barHoverId ?? pointedId;
  const hoveredWire = hoveredId ? canvas.items[hoveredId] : undefined;
  const activeWires: Item[] =
    hoveredWire && isWire(hoveredWire)
      ? selectedWires.some((w) => w.id === hoveredWire.id)
        ? selectedWires
        : [hoveredWire]
      : selectedWires;

  const wanted = activeWires
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

  // Anchor underneath the hovered screen (or the primary selected screen)
  const anchor =
    hoveredWire && isWire(hoveredWire)
      ? hoveredWire
      : [...activeWires].sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x - b.x))[0]!;
  const primarySpec = cachedSpec(specKey(anchor) ?? "");
  const resolved = resolveItemLayers(anchor, primarySpec);
  const editable = !past && canEdit !== false && Boolean(host) && Boolean(readText);

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

  const runDirective = async (directive: string, wholeFlow = false) => {
    if (!editable || !host || !readText || busy) return;
    ensureSelected();
    const targetIds = targetIdsForAction();
    setBusy(true);
    try {
      const port: WirePort = {
        canvasId: "canvas",
        actor: host.viewer ? { id: host.viewer.id, name: host.viewer.name } : undefined,
        canvas: async () => canvasRef.current,
        readText: (hash) => readText(hash),
        put: (text, mimeType, filename) => host.putBlob(new Blob([text], { type: mimeType }), filename),
        send: async (op, group) => {
          await host.send([op], group);
        },
      };
      const currentCanvas = canvasRef.current;
      const all = await wiresOn(port, currentCanvas);
      const targets = wholeFlow
        ? flowScreens(all, targetIds)
        : all.filter((s) => targetIds.includes(s.item));
      if (targets.length === 0) return;
      await applyLayersOnCanvas(port, currentCanvas, all, targets, directive);
    } finally {
      setBusy(false);
    }
  };

  const toggleLayer = (id: WireLayerId) => {
    const next = parseLayerDirective(`toggle:${id}`, resolved);
    if (!editable || !host || !readText || busy) return;
    ensureSelected();
    const targetIds = targetIdsForAction();
    void (async () => {
      setBusy(true);
      try {
        const port: WirePort = {
          canvasId: "canvas",
          actor: host.viewer ? { id: host.viewer.id, name: host.viewer.name } : undefined,
          canvas: async () => canvasRef.current,
          readText: (hash) => readText(hash),
          put: (text, mimeType, filename) => host.putBlob(new Blob([text], { type: mimeType }), filename),
          send: async (op, group) => {
            await host.send([op], group);
          },
        };
        const currentCanvas = canvasRef.current;
        const all = await wiresOn(port, currentCanvas);
        const targets = all.filter((s) => targetIds.includes(s.item));
        if (targets.length === 0) return;
        await applyLayersOnCanvas(port, currentCanvas, all, targets, next);
      } finally {
        setBusy(false);
      }
    })();
  };

  const tierInfo = TIER_LABELS[resolved.tier];

  return (
    <>
      <svg ref={origin} className="wire-origin" aria-hidden />
      <div
        className="wire-layer-bar"
        data-wire-layers={anchor.id}
        data-wire-tier={resolved.tier}
        role="toolbar"
        aria-label="Screen fidelity layers"
        style={{ left: anchor.x + anchor.width / 2, top: anchor.y + anchor.height } as CSSProperties}
        onPointerEnter={() => setBarHoverId(anchor.id)}
        onPointerLeave={() => setBarHoverId((prev) => (prev === anchor.id ? null : prev))}
        onPointerDown={(e) => {
          e.stopPropagation();
          ensureSelected();
        }}
      >
        <div className="wire-layer-pill">
          <span className="wire-layer-badge" title={`Active tier: ${tierInfo.title} — ${tierInfo.summary}`}>
            {tierInfo.badge}
          </span>
          <span className="sep" aria-hidden />
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
                title={`${info.label}: ${info.hint} (${checked ? "checked — click to turn off" : "unchecked — click to turn on"})`}
                onClick={() => toggleLayer(id)}
              >
                <span className="wire-layer-box" aria-hidden>
                  {checked ? "✓" : ""}
                </span>
                <span>{info.short}</span>
              </button>
            );
          })}
          <span className="sep" aria-hidden />
          <button
            type="button"
            className="wire-layer-flow"
            disabled={!editable || busy}
            title="Sync these checked layers across every screen in this flow and rebuild its clickable prototype"
            onClick={() => void runDirective(resolved.tier, true)}
          >
            Sync flow
          </button>
        </div>
      </div>
    </>
  );
}
