import { useEffect, useRef } from "react";
import { panelActorId } from "@isocan/core";
import { useUiStore } from "../stores/uiStore.ts";
import { extensionPanelKey, openPanel } from "../lib/panels.ts";
import { bridgePanelFrame } from "../lib/panelBridge.ts";
import {
  extensionColor,
  panelUnavailableSentence,
  useCanvasPanels,
  type CanvasPanel,
} from "../lib/panelExtensions.ts";
import { panelFrame, type ContentOrigin } from "../lib/frame.ts";
import { useContentOrigin } from "../lib/contentBase.ts";
import { PanelHead } from "./PanelHead.tsx";
import { PanelResizer } from "./PanelResizer.tsx";

/**
 * **A canvas-carried panel in the left dock** (`docs/projects/extensions/phases.md`,
 * phase 4).
 *
 * Renders in the shared `.dock-panel` slot as a sandboxed `<iframe>` whose
 * `src` is built by `panelFrame` on `contentBase()` — never the app origin,
 * and there is no "trusted" panel that skips the frame.
 *
 * Wears its own validated title and an extension colour from `EXTENSION_COLORS`
 * (never a person's `IDENTITY_COLORS`), and when its manifest or page blob is
 * missing, states that the panel is unavailable rather than dropping the slot.
 */
export function ExtensionPanelSurface({
  canvasId,
  active,
  panels,
  origin,
  onClose,
}: {
  canvasId: string;
  active: CanvasPanel;
  panels: CanvasPanel[];
  origin: ContentOrigin | null;
  onClose: () => void;
}) {
  const panelWidth = useUiStore((s) => s.panelWidth);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const frame = active.panel
    ? panelFrame(origin, canvasId, active.panel.bytes.blobHash)
    : null;
  const unavailable = active.problem
    ? panelUnavailableSentence(active)
    : !frame
      ? `${active.title} is unavailable — the content origin is not standing.`
      : null;

  const originBase = origin?.base ?? null;
  useEffect(() => {
    if (unavailable || !originBase) return;
    return bridgePanelFrame({
      canvasId,
      itemId: active.itemId,
      contentOrigin: originBase,
      frameWindow: () => frameRef.current?.contentWindow ?? null,
    });
  }, [canvasId, active.itemId, unavailable, originBase]);

  return (
    <aside
      className="dock-panel floats extension-panel"
      style={{ width: panelWidth }}
      aria-label={active.title}
      data-extension-color={active.color}
      data-extension-actor={panelActorId(active.itemId)}
    >
      <PanelResizer />
      <PanelHead
        glyph={
          <span
            className="extension-panel-mark"
            style={{
              display: "inline-block",
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: active.color,
            }}
            title="Canvas panel extension"
            aria-hidden
          />
        }
        name={active.title}
        hint={active.panel ? `canvas panel · ${active.panel.src}` : "canvas panel"}
        closeLabel={`Close ${active.title} panel`}
        onClose={onClose}
      />
      {panels.length > 1 && (
        <div className="panel-head-tabs" role="tablist" aria-label="Canvas panels">
          {panels.map((p) => (
            <button
              key={p.itemId}
              role="tab"
              aria-selected={p.itemId === active.itemId}
              className={`panel-head-tab${p.itemId === active.itemId ? " active" : ""}`}
              onClick={() => openPanel(canvasId, extensionPanelKey(p.itemId))}
            >
              {p.title}
            </button>
          ))}
        </div>
      )}
      <div className="extension-panel-body" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {unavailable ? (
          <div className="panel-empty extension-panel-unavailable" role="status">
            {unavailable}
          </div>
        ) : (
          <iframe
            ref={frameRef}
            className="extension-panel-frame"
            title={active.title}
            src={frame!.src}
            sandbox={frame!.sandbox}
            style={{ flex: 1, width: "100%", border: 0 }}
          />
        )}
      </div>
    </aside>
  );
}

/** The left-dock container that mounts the active canvas-carried panel extension. */
export function ExtensionPanel({ canvasId }: { canvasId: string }) {
  const open = useUiStore((s) => s.extensionPanelOpen);
  const activeId = useUiStore((s) => s.extensionPanelId);
  const panels = useCanvasPanels(canvasId);
  const hashes = panels.flatMap((p) => (p.panel ? [p.panel.bytes.blobHash] : []));
  const origin = useContentOrigin(canvasId, hashes);

  if (!open || !activeId) return null;
  const active =
    panels.find((p) => p.itemId === activeId) ??
    panels[0] ?? {
      itemId: activeId,
      title: activeId,
      color: extensionColor(activeId),
      problem: "this panel is no longer on the canvas",
    };

  return (
    <ExtensionPanelSurface
      canvasId={canvasId}
      active={active}
      panels={panels}
      origin={origin}
      onClose={() => openPanel(canvasId, null)}
    />
  );
}
