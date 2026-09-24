import type { Actor, WebHost } from "@isocan/core";
import { itemPath } from "@isocan/core";
import { usePresentation } from "../lib/canvasPresentation.ts";
import { presentedCanvas } from "../lib/presentation.ts";
import { modules } from "../modules.ts";
import { useCallback, useContext, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CanvasActivation } from "../lib/canvasActivation.ts";
import { useCanEdit } from "../lib/capability.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { fetchBlobText } from "../lib/blobtext.ts";

/**
 * **The first module slot: under the items, in world units.**
 *
 * Mounted inside `.world` before the items, so whatever a module draws here
 * passes UNDER the nodes it joins — a map node is chromeless text, and a line
 * over it strikes through the words. The shell reads the stores once, here,
 * and hands every module the same facts as props: the canvas, and the live
 * drag so a line can ride the gesture before the replica moves. A module
 * never sees a store, which is what keeps the dependency pointing one way.
 *
 * Since wireframes phase 8 an underlay can also WRITE — the same `WebHost`
 * overlays get, with `canEdit` beside it — and open an item full screen at an
 * anchor: an arrow between kept screens is something you click, retarget and
 * play from (`core/modules.ts`, `WebHost`, "Who gets it").
 */
export function ModuleUnderlays({ canvasId, actor }: { canvasId: string; actor: Actor }) {
  const presentation = usePresentation();
  const activateItem = useContext(CanvasActivation);
  const canvas = useCanvasStore((s) => s.past?.canvas ?? s.canvas);
  const past = useCanvasStore((s) => s.past !== null && s.past !== undefined);
  const drag = useUiStore((s) => s.drag);
  const selection = useUiStore((s) => s.selectedItemIds);
  const canEdit = useCanEdit();
  const host = useMemo(() => lazyHost(canvasId, actor, canEdit), [canvasId, actor, canEdit]);
  const navigate = useNavigate();
  const openItem = useCallback((itemId: string, anchor?: string) => navigate(`${itemPath(canvasId, itemId)}${anchor ? `?at=${encodeURIComponent(anchor.replace(/^#/, ""))}` : ""}`), [canvasId, navigate]);
  // A runtime module that arrived after first paint is a new underlay.
  useUiStore((s) => s.modulesGeneration);
  if (!canvas) return null;
  const facts = {
    canvas: presentedCanvas(canvas, presentation),
    presentation: presentation?.items,
    activateItem,
    drag: drag ? { itemIds: drag.itemIds, dx: drag.dx, dy: drag.dy } : null,
    selection,
    readText: (hash: string) => fetchBlobText(canvasId, hash),
    host,
    canEdit: canEdit && !past,
    past,
    openItem,
  };
  return (
    <>
      {modules().flatMap((m) =>
        (m.underlays ?? []).map((Underlay, i) => <Underlay key={`${m.core.name}:${i}`} {...facts} />),
      )}
    </>
  );
}

/**
 * **The underlays' host, fetched on first use.** `modulehost.ts` stays out of
 * the entry chunk (every other slot imports it lazily too — the canvas's own
 * drop handler does), so an underlay is handed an object whose methods load
 * it when one is called: nothing is paid until somebody retargets an arrow.
 * The door test is the real host's — `send` refuses a reader there.
 */
function lazyHost(canvasId: string, actor: Actor, canEdit: boolean): WebHost {
  type Call = (...args: unknown[]) => unknown;
  const later = (name: "send" | "putBlob" | "enrol" | "reveal" | "select") => (...args: unknown[]) =>
    import("../lib/modulehost.ts").then((m) => (m.webHostFor(canvasId, actor, undefined, canEdit)[name] as Call)(...args));
  return { send: later("send"), putBlob: later("putBlob"), enrol: later("enrol"), reveal: later("reveal"), select: later("select"), viewer: { id: actor.id, name: actor.name } } as unknown as WebHost;
}
