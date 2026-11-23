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

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

/** Dock positions supported by the Stitch prompt composer (OS1 ADR 0214). */
export type PromptDock = "bottom" | "left" | "right";

/** Horizontal anchor edge for the AgentDock (OS1 ADR 0256). */
export type DockSide = "left" | "right";

/** LocalStorage key persisting the user's preferred PromptPill dock edge. */
export const PROMPT_DOCK_STORAGE_KEY = "isocan.shell.promptDock.v1";

/** Check whether an unknown value is a valid `PromptDock`. */
export function isPromptDock(value: unknown): value is PromptDock {
  return value === "bottom" || value === "left" || value === "right";
}

/**
 * Compute which top corner `AgentDock` anchors to so it always stays clear
 * of a side-docked prompt bar (OS1 ADR 0256):
 * - prompt on right -> AgentDock anchors top-left
 * - prompt on left or bottom -> AgentDock anchors top-right
 */
export function agentDockSideFor(promptDock: PromptDock): DockSide {
  return promptDock === "right" ? "left" : "right";
}

const dockListeners = new Set<(dock: PromptDock) => void>();

/** Read persisted PromptPill dock preference from localStorage. */
export function readPromptDock(): PromptDock {
  try {
    const raw = localStorage.getItem(PROMPT_DOCK_STORAGE_KEY);
    return isPromptDock(raw) ? raw : "bottom";
  } catch {
    return "bottom";
  }
}

/** Persist PromptPill dock preference and notify subscribed shell panels. */
export function writePromptDock(dock: PromptDock): void {
  try {
    localStorage.setItem(PROMPT_DOCK_STORAGE_KEY, dock);
  } catch {
    // Storage unavailable (private mode); broadcast in-memory only.
  }
  for (const listener of dockListeners) listener(dock);
}

/** Subscribe to live PromptPill dock changes within the current tab. */
export function usePromptDockPreference(initial?: PromptDock): [PromptDock, (next: PromptDock) => void] {
  const [dock, setDockState] = useState<PromptDock>(() => initial ?? readPromptDock());

  useEffect(() => {
    const onChange = (next: PromptDock) => setDockState(next);
    dockListeners.add(onChange);
    return () => {
      dockListeners.delete(onChange);
    };
  }, []);

  const setDock = useCallback((next: PromptDock) => {
    setDockState(next);
    writePromptDock(next);
  }, []);

  return useMemo(() => [dock, setDock] as [PromptDock, (next: PromptDock) => void], [dock, setDock]);
}

/** Persisted floating panel rectangle in screen pixels. */
export interface PanelGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Bounds used to clamp floating panel geometry inside the viewport. */
export interface PanelGeometryBounds {
  minWidth?: number | undefined;
  maxWidth?: number | undefined;
  minHeight?: number | undefined;
  maxHeight?: number | undefined;
  margin?: number | undefined;
  viewportWidth?: number | undefined;
  viewportHeight?: number | undefined;
}

/** Clamp a floating panel rect inside the viewport and min/max size bounds. */
export function clampPanelGeometry(rect: PanelGeometry, bounds: PanelGeometryBounds = {}): PanelGeometry {
  const minW = bounds.minWidth ?? 220;
  const maxW = bounds.maxWidth ?? 560;
  const minH = bounds.minHeight ?? 120;
  const maxH = bounds.maxHeight ?? 760;
  const margin = bounds.margin ?? 12;
  const vw = bounds.viewportWidth ?? (typeof window !== "undefined" ? window.innerWidth : 1280);
  const vh = bounds.viewportHeight ?? (typeof window !== "undefined" ? window.innerHeight : 800);

  const width = Math.min(Math.max(minW, Math.round(rect.width)), Math.min(maxW, Math.max(minW, vw - margin * 2)));
  const height = Math.min(Math.max(minH, Math.round(rect.height)), Math.min(maxH, Math.max(minH, vh - margin * 2)));
  const maxX = Math.max(margin, vw - width - margin);
  const maxY = Math.max(margin, vh - height - margin);
  const x = Math.min(Math.max(margin, Math.round(rect.x)), maxX);
  const y = Math.min(Math.max(margin, Math.round(rect.y)), maxY);
  return { x, y, width, height };
}

/** Read a stored `PanelGeometry` if present and valid. */
export function readPanelGeometry(storageKey: string): PanelGeometry | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PanelGeometry>;
    if (
      typeof parsed.x === "number" &&
      typeof parsed.y === "number" &&
      typeof parsed.width === "number" &&
      typeof parsed.height === "number" &&
      Number.isFinite(parsed.x) &&
      Number.isFinite(parsed.y) &&
      Number.isFinite(parsed.width) &&
      Number.isFinite(parsed.height)
    ) {
      return { x: parsed.x, y: parsed.y, width: parsed.width, height: parsed.height };
    }
    return null;
  } catch {
    return null;
  }
}

/** Save a `PanelGeometry` to localStorage, ignoring storage quota/privacy failures. */
export function writePanelGeometry(storageKey: string, rect: PanelGeometry | null): void {
  try {
    if (rect === null) localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, JSON.stringify(rect));
  } catch {
    // Storage unavailable; keep geometry in memory.
  }
}

export interface UsePanelGeometryOptions extends PanelGeometryBounds {
  storageKey: string;
  defaults: PanelGeometry;
}

export interface PanelGeometryHandle {
  geometry: PanelGeometry;
  customized: boolean;
  dragging: boolean;
  resizing: boolean;
  onDragPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onResizePointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  reset: () => void;
}

/**
 * Plain pointer-capture drag & resize geometry helper for floating shell
 * panels (`AgentDock`, etc.) with localStorage persistence and viewport clamping.
 */
export function usePanelGeometry(opts: UsePanelGeometryOptions): PanelGeometryHandle {
  const { storageKey, defaults, minWidth, maxWidth, minHeight, maxHeight, margin } = opts;
  const [stored, setStored] = useState<PanelGeometry | null>(() => {
    const saved = readPanelGeometry(storageKey);
    return saved ? clampPanelGeometry(saved, { minWidth, maxWidth, minHeight, maxHeight, margin }) : null;
  });
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);

  const geometry = stored ?? clampPanelGeometry(defaults, { minWidth, maxWidth, minHeight, maxHeight, margin });
  const latestRef = useRef<PanelGeometry>(geometry);
  latestRef.current = geometry;

  const startCapture = useCallback(
    (
      e: ReactPointerEvent<HTMLElement>,
      mode: "drag" | "resize",
    ) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const target = e.currentTarget;
      const pointerId = e.pointerId;
      try {
        target.setPointerCapture?.(pointerId);
      } catch {
        // Synthetic events in jsdom may not register an active pointer id.
      }

      const startX = e.clientX;
      const startY = e.clientY;
      const origin = { ...latestRef.current };
      if (mode === "drag") setDragging(true);
      else setResizing(true);

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const raw: PanelGeometry =
          mode === "drag"
            ? { ...origin, x: origin.x + dx, y: origin.y + dy }
            : { ...origin, width: origin.width + dx, height: origin.height + dy };
        const clamped = clampPanelGeometry(raw, { minWidth, maxWidth, minHeight, maxHeight, margin });
        latestRef.current = clamped;
        setStored(clamped);
      };

      const onEnd = () => {
        try {
          target.releasePointerCapture?.(pointerId);
        } catch {
          // Ignore if capture was already released.
        }
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onEnd);
        window.removeEventListener("pointercancel", onEnd);
        if (mode === "drag") setDragging(false);
        else setResizing(false);
        writePanelGeometry(storageKey, latestRef.current);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onEnd);
      window.addEventListener("pointercancel", onEnd);
    },
    [storageKey, minWidth, maxWidth, minHeight, maxHeight, margin],
  );

  const reset = useCallback(() => {
    setStored(null);
    writePanelGeometry(storageKey, null);
  }, [storageKey]);

  const onDragPointerDown = useCallback((e: ReactPointerEvent<HTMLElement>) => startCapture(e, "drag"), [startCapture]);
  const onResizePointerDown = useCallback((e: ReactPointerEvent<HTMLElement>) => startCapture(e, "resize"), [startCapture]);
  const customized = stored !== null;

  return useMemo(
    () => ({
      geometry,
      customized,
      dragging,
      resizing,
      onDragPointerDown,
      onResizePointerDown,
      reset,
    }),
    [geometry, customized, dragging, resizing, onDragPointerDown, onResizePointerDown, reset],
  );
}
