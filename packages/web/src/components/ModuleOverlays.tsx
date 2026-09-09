import type { Actor, Placement } from "@isocan/core";
import { MODULES } from "../modules.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";

/**
 * **Module overlays: screen-space widgets mounted above the canvas.**
 *
 * The twin of ModuleUnderlays, mounted outside `.world` in screen space so
 * modules can contribute trays, docks or tool overlays.
 */
export function ModuleOverlays({
  canvasId,
  actor,
  dropFile,
}: {
  canvasId: string;
  actor: Actor;
  dropFile?: (file: File, placement?: Placement) => Promise<string[]>;
}) {
  const canvas = useCanvasStore((s) => s.canvas);
  useUiStore((s) => s.modulesGeneration);
  if (!canvas) return null;
  const facts = { canvasId, actor, ...(dropFile ? { dropFile } : {}) };
  return (
    <>
      {MODULES.flatMap((m) =>
        (m.overlays ?? []).map((Overlay, i) => (
          <Overlay key={`${m.core.name}:overlay:${i}`} {...facts} />
        )),
      )}
    </>
  );
}

