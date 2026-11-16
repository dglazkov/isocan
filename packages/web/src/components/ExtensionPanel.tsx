/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useCallback, useRef } from "react";
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
  const detachBridge = useRef<(() => void) | null>(null);
  const frame = active.panel
    ? panelFrame(origin, canvasId, active.panel.bytes.blobHash)
    : null;
  const unavailable = active.problem
    ? panelUnavailableSentence(active)
    : !frame
      ? `${active.title} is unavailable — the content origin is not standing.`
      : null;

  const originBase = origin?.base ?? null;
  // Remount instead of navigating a reused WindowProxy when its authority or
  // bytes change. The ref callback retires the old bridge in the same commit.
  const frameKey = JSON.stringify([canvasId, active.itemId, frame?.src]);
  const bindFrame = useCallback((element: HTMLIFrameElement | null) => {
    detachBridge.current?.();
    detachBridge.current = null;
    frameRef.current = element;
    if (!element || unavailable || !originBase) return;
    detachBridge.current = bridgePanelFrame({
      canvasId,
      itemId: active.itemId,
      frameWindow: () => frameRef.current === element ? element.contentWindow : null,
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
            key={frameKey}
            ref={bindFrame}
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
