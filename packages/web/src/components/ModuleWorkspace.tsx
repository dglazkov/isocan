import {
  Component,
  Suspense,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  canvasPath,
  itemPath,
  type Actor,
  type WorkspaceHost,
} from "@isocan/core";
import { moduleWorkspace } from "../modules.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { webHostFor } from "../lib/modulehost.ts";
import { fetchBlobText } from "../lib/blobtext.ts";
import { useCanEdit } from "../lib/capability.ts";
import { glideToBox } from "../lib/zoomactions.ts";
import { undo, redo } from "../lib/api.ts";
import { openPanel } from "../lib/panels.ts";
import { crossesCover } from "../lib/keys.ts";

class WorkspaceBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? (
      <p role="alert" className="module-page-missing">
        This workspace could not open: {this.state.error}. Your canvas files are
        still available through Back.
      </p>
    ) : (
      this.props.children
    );
  }
}

/** Keep the viewport's origin in screen coordinates; clip it to its layout slot.
 * Pointer math throughout the native canvas uses clientX/clientY. Translating
 * the world by a sidebar offset here would make every drag land off target. */
function NativeCanvasSlot({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = ref.current!;
    const measure = () => {
      const r = element.getBoundingClientRect();
      element.style.setProperty(
        "--module-clip",
        `inset(${r.top}px ${Math.max(0, innerWidth - r.right)}px ${Math.max(0, innerHeight - r.bottom)}px ${r.left}px)`,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  return (
    <div
      ref={ref}
      className="module-canvas-slot"
      data-module-stage
      tabIndex={0}
      role="region"
      aria-label="Canvas"
      onPointerDownCapture={(event) => {
        // A tree button keeps focus after selection. Return keyboard focus
        // to the stage on a canvas gesture so its native shortcuts work.
        if (
          !(event.target as Element).closest(
            "input, textarea, select, button, [contenteditable]",
          )
        )
          ref.current?.focus({ preventScroll: true });
      }}
    >
      {children}
    </div>
  );
}

export function ModuleWorkspaceView({
  canvasId,
  segment,
  actor,
  canvasView,
}: {
  canvasId: string;
  segment: string;
  actor: Actor;
  canvasView: ReactNode;
}) {
  const navigate = useNavigate();
  const [historyError, setHistoryError] = useState("");
  const [historyBusy, setHistoryBusy] = useState(false);
  const canvas = useCanvasStore((s) => s.past?.canvas ?? s.canvas);
  const selection = useUiStore((s) => s.selectedItemIds);
  const canEdit = useCanEdit();
  const chatOpen = useUiStore((s) => s.mainPanelOpen);
  const agentsOpen = useUiStore((s) => s.agentsPanelOpen);
  const inPast = useCanvasStore((s) => s.past !== null);
  useUiStore((s) => s.modulesGeneration);
  const workspace = moduleWorkspace(segment);
  const host = useMemo<WorkspaceHost>(
    () => ({
      ...webHostFor(canvasId, actor),
      readText: (hash) => fetchBlobText(canvasId, hash),
      getCanvas: () => {
        const state = useCanvasStore.getState();
        if (!state.canvas || state.project?.id !== canvasId)
          throw new Error("This canvas is no longer open");
        return state.past?.canvas ?? state.canvas;
      },
      select: (ids) =>
        useUiStore
          .getState()
          .setSelection(
            [...ids].filter((id) =>
              Boolean(useCanvasStore.getState().canvas?.items[id]),
            ),
          ),
      focus: (ids) => {
        const items = ids
          .map((id) => useCanvasStore.getState().canvas?.items[id])
          .filter((i) => i !== undefined);
        if (!items.length) return;
        glideToBox({
          minX: Math.min(...items.map((i) => i.x)),
          minY: Math.min(...items.map((i) => i.y)),
          maxX: Math.max(...items.map((i) => i.x + i.width)),
          maxY: Math.max(...items.map((i) => i.y + i.height)),
        });
      },
      openItem: (id) => navigate(itemPath(canvasId, id)),
    }),
    [canvasId, actor, navigate],
  );
  const Body = workspace?.component;
  async function history(action: typeof undo) {
    if (!canEdit || inPast || historyBusy) return;
    setHistoryBusy(true);
    setHistoryError("");
    try {
      await action(canvasId, actor);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : String(err));
    } finally {
      setHistoryBusy(false);
    }
  }
  return (
    <div
      className="module-workspace"
      onKeyDown={(event) => {
        // The module owns its chrome's keys. A button or input must not operate
        // on selected cards behind a report; the global launcher still crosses.
        if (
          !(event.target as Element).closest("[data-module-stage]") &&
          !crossesCover(event)
        )
          event.stopPropagation();
      }}
    >
      <div className="module-page-bar">
        <button
          className="deck-back"
          onClick={() => navigate(canvasPath(canvasId))}
        >
          ← Canvas
        </button>
        <b>{workspace?.label ?? segment}</b>
        <span className="module-page-hint">{workspace?.hint}</span>
        <span className="module-workspace-history">
          <button
            aria-pressed={chatOpen}
            onClick={() => openPanel(canvasId, chatOpen ? null : "main", false)}
          >
            Chat
          </button>
          <button
            aria-pressed={agentsOpen}
            onClick={() =>
              openPanel(canvasId, agentsOpen ? null : "agents", false)
            }
          >
            Agents
          </button>
          {canEdit && !inPast && (
            <>
              <button disabled={historyBusy} onClick={() => void history(undo)}>
                Undo
              </button>
              <button disabled={historyBusy} onClick={() => void history(redo)}>
                Redo
              </button>
            </>
          )}
        </span>
        {!canEdit && <span>Read only</span>}
      </div>
      {historyError && <p role="alert">{historyError}</p>}
      <WorkspaceBoundary key={`${canvasId}:${segment}`}>
        <Suspense
          fallback={<p className="module-page-missing">Opening workspace…</p>}
        >
          {Body && canvas && (
            <Body
              canvasId={canvasId}
              canvas={canvas}
              host={host}
              selection={selection}
              canEdit={canEdit && !inPast}
              canvasView={<NativeCanvasSlot>{canvasView}</NativeCanvasSlot>}
            />
          )}
        </Suspense>
      </WorkspaceBoundary>
    </div>
  );
}
