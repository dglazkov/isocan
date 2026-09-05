import { MODULES } from "../modules.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";

/**
 * **The first module slot: under the items, in world units.**
 *
 * Mounted inside `.world` before the items, so whatever a module draws here
 * passes UNDER the nodes it joins — a map node is chromeless text, and a line
 * over it strikes through the words. The shell reads the stores once, here,
 * and hands every module the same facts as props: the canvas, and the live
 * drag so a line can ride the gesture before the replica moves. A module
 * never sees a store, which is what keeps the dependency pointing one way.
 */
export function ModuleUnderlays() {
  const canvas = useCanvasStore((s) => s.canvas);
  const drag = useUiStore((s) => s.drag);
  // A runtime module that arrived after first paint is a new underlay.
  useUiStore((s) => s.modulesGeneration);
  if (!canvas) return null;
  const facts = { canvas, drag: drag ? { itemIds: drag.itemIds, dx: drag.dx, dy: drag.dy } : null };
  return (
    <>
      {MODULES.flatMap((m) =>
        (m.underlays ?? []).map((Underlay, i) => <Underlay key={`${m.core.name}:${i}`} {...facts} />),
      )}
    </>
  );
}
