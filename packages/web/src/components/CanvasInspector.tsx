import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { Actor } from "@isocan/core";
import { itemKind } from "@isocan/core";
import { moduleInspectorsFor } from "../modules.ts";
import { readBlobText } from "../lib/api.ts";
import { worldToScreen } from "../lib/viewport.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";

const TOOLBAR_H = 48;
const GUTTER = 16;

/**
 * Positions floating chrome against an anchor on the screen, clamped to the window.
 */
function usePopoverPlacement(anchor: { x: number; y: number }, dx: number, dy: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 220, height: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ width: el.offsetWidth, height: el.offsetHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const top = TOOLBAR_H + GUTTER;
  const maxHeight = Math.max(120, window.innerHeight - top - GUTTER);
  const rightLimit = window.innerWidth - GUTTER - size.width;
  const flipped = anchor.x + dx > rightLimit;

  return {
    ref,
    style: {
      left: Math.max(GUTTER, Math.min(flipped ? anchor.x - dx - size.width : anchor.x + dx, rightLimit)),
      top: Math.max(top, Math.min(anchor.y + dy, window.innerHeight - GUTTER - size.height)),
      maxHeight,
      pointerEvents: "auto",
    } satisfies CSSProperties,
  };
}

/**
 * **Canvas Inspector: A floating window for selected item module inspectors.**
 *
 * When an item with a registered `ModuleInspector` is selected, mounts the inspector
 * as a floating window beside the item in screen coordinates.
 */
export function CanvasInspector({ canvasId, actor }: { canvasId: string; actor: Actor }) {
  const selectedItemIds = useUiStore((s) => s.selectedItemIds);
  const canvas = useCanvasStore((s) => s.canvas);
  const viewport = useUiStore((s) => s.viewport);
  useUiStore((s) => s.modulesGeneration);

  const item = selectedItemIds.length === 1 && canvas ? canvas.items[selectedItemIds[0]!] ?? null : null;
  const inspectors = item ? moduleInspectorsFor(itemKind(item)) : [];

  const openHash = item ? (item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0])?.blobHash ?? null : null;
  const readText = useCallback(() => (openHash ? readBlobText(canvasId, openHash) : Promise.resolve("")), [canvasId, openHash]);

  const addVersion = useCallback(
    async (file: File) => {
      if (!item) return;
      const { addVersionFromFile } = await import("../lib/upload.ts");
      await addVersionFromFile(canvasId, actor, item.id, file);
    },
    [canvasId, actor, item],
  );

  const screen = item ? worldToScreen(viewport, item.x + item.width, item.y) : { x: 0, y: 0 };
  const { ref, style } = usePopoverPlacement(screen, 16, 0);

  if (!item || inspectors.length === 0) return null;

  return (
    <div
      ref={ref}
      className="canvas-inspector floats"
      style={{
        position: "absolute",
        zIndex: "var(--z-float)" as any,
        width: 220,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {inspectors.map((inspector) => {
        const Body = inspector.component;
        return (
          <section key={inspector.label} className="canvas-inspector-section" style={{ padding: "10px 12px" }}>
            <header
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "var(--ink-soft)",
                }}
              >
                {inspector.label}
              </h3>
            </header>
            <Body canvasId={canvasId} item={item} readText={readText} actor={actor} addVersion={addVersion} />
          </section>
        );
      })}
    </div>
  );
}

