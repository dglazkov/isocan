import {
  Component,
  Suspense,
  useLayoutEffect,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  canvasPath,
  itemPath,
  type Actor,
  type WorkspaceHost,
} from "@isocan/core";
import { moduleWorkspace } from "../modules.ts";
import { publishCursor, useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { webHostFor } from "../lib/modulehost.ts";
import { fetchBlobText } from "../lib/blobtext.ts";
import { useCanEdit } from "../lib/capability.ts";
import { stopGlide, shiftCamera, glideToBox } from "../lib/zoomactions.ts";
import { undo, redo } from "../lib/api.ts";
import { openPanel } from "../lib/panels.ts";
import { crossesCover, isTyping } from "../lib/keys.ts";
import { CanvasActivation } from "../lib/canvasActivation.ts";
import { CanvasPresentation, activatePresentation } from "../lib/canvasPresentation.ts";
import { PresentationStore } from "../lib/presentationStore.ts";
import { presentedItem } from "../lib/presentation.ts";

function displayedCanvas() {
  const state = useCanvasStore.getState();
  return state.past?.canvas ?? state.canvas;
}

// Local navigation memory lives beyond this route, but never in shared state.
const rememberedViews = new Map<string, { search: string; cameras: Map<string, ReturnType<typeof useUiStore.getState>["viewport"]> }>();

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
    let previous: DOMRect | null = null;
    const measure = () => {
      const r = element.getBoundingClientRect();
      if (previous && (r.width !== previous.width || r.height !== previous.height || r.x !== previous.x || r.y !== previous.y)) {
        shiftCamera(r.x + r.width / 2 - previous.x - previous.width / 2, r.y + r.height / 2 - previous.y - previous.height / 2, r);
      }
      previous = r;
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
  const location = useLocation();
  const routeKey = `${canvasId}:${segment}`;
  const memory = useMemo(() => {
    const stored = rememberedViews.get(routeKey) ?? { search: "", cameras: new Map() };
    rememberedViews.set(routeKey, stored);
    return stored;
  }, [routeKey]);
  const locationRef = useRef(location);
  locationRef.current = location;
  // Each route owns its animation subscriptions, even if React reuses this shell.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const presentation = useMemo(() => new PresentationStore(), [canvasId, segment]);
  useEffect(() => {
    if (!locationRef.current.search && memory.search) navigate({ pathname: locationRef.current.pathname, search: memory.search }, { replace: true });
  }, [memory, navigate]);
  useLayoutEffect(() => {
    if (location.search) memory.search = location.search;
    const key = `${location.search}:${innerWidth}:${innerHeight}`;
    return () => { if (presentation.snapshot()) memory.cameras.set(key, useUiStore.getState().viewport); };
  }, [location.search, memory, presentation]);
  useLayoutEffect(() => {
    const ordinary = useUiStore.getState().viewport;
    const deactivate = activatePresentation(presentation);
    return () => {
      stopGlide();
      presentation.dispose();
      deactivate();
      useUiStore.getState().setViewport(ordinary);
    };
  }, [presentation]);
  // Clear stale free-space presence on entry; selections and item work remain live.
  useEffect(() => { publishCursor(null); }, []);
  const [historyError, setHistoryError] = useState("");
  const [historyBusy, setHistoryBusy] = useState(false);
  const canvas = useCanvasStore((s) => s.past?.canvas ?? s.canvas);
  const project = useCanvasStore((s) => s.project);
  const selection = useUiStore((s) => s.selectedItemIds);
  const canEdit = useCanEdit();
  const chatOpen = useUiStore((s) => s.mainPanelOpen);
  const agentsOpen = useUiStore((s) => s.agentsPanelOpen);
  const inPast = useCanvasStore((s) => s.past !== null);
  useUiStore((s) => s.modulesGeneration);
  const workspace = moduleWorkspace(segment);
  const activation = useMemo(() => {
    const handlers = new Set<(itemId: string) => boolean>();
    return {
      subscribe(handler: (itemId: string) => boolean) {
        handlers.add(handler);
        return () => {
          handlers.delete(handler);
        };
      },
      activate(itemId: string) {
        for (const handler of handlers) if (handler(itemId)) return true;
        return false;
      },
    };
    // A route change must dispose the previous workspace's subscriptions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasId, segment]);
  const host = useMemo<WorkspaceHost>(
    () => ({
      ...webHostFor(canvasId, actor),
      navigateView: (patch, replace = false) => {
        const at = locationRef.current;
        const query = new URLSearchParams(at.search);
        for (const [key, value] of Object.entries(patch)) {
          if (value === null) query.delete(key); else query.set(key, value);
        }
        const search = query.toString();
        if (search !== at.search.replace(/^\?/, "")) navigate({ pathname: at.pathname, search }, { replace });
      },
      present: (view) => {
        const current = displayedCanvas();
        if (!current) return;
        if (view) for (const [id, bounds] of Object.entries(view.items)) {
          if (!current.items[id] || ![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite) || bounds.width <= 0 || bounds.height <= 0)
            throw new Error("Invalid workspace presentation bounds");
        }
        presentation.set(view, current);
        const boxes = view?.focusIds?.flatMap(id => view.items[id] ? [view.items[id]!] : []) ?? [];
        if (boxes.length && memory.cameras.has(`${locationRef.current.search}:${innerWidth}:${innerHeight}`)) {
          stopGlide();
          useUiStore.getState().setViewport(memory.cameras.get(`${locationRef.current.search}:${innerWidth}:${innerHeight}`)!);
        } else if (boxes.length) glideToBox({ minX: Math.min(...boxes.map(i => i.x)), minY: Math.min(...boxes.map(i => i.y)), maxX: Math.max(...boxes.map(i => i.x + i.width)), maxY: Math.max(...boxes.map(i => i.y + i.height)) }, view?.maxScale);
      },
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
              Boolean(displayedCanvas()?.items[id]),
            ),
          ),
      focus: (ids) => {
        const items = ids
          .map((id) => displayedCanvas()?.items[id])
          .filter((i) => i !== undefined)
          .map(i => presentedItem(i, presentation.snapshot()));
        if (!items.length) return;
        glideToBox({
          minX: Math.min(...items.map((i) => i.x)),
          minY: Math.min(...items.map((i) => i.y)),
          maxX: Math.max(...items.map((i) => i.x + i.width)),
          maxY: Math.max(...items.map((i) => i.y + i.height)),
        }, presentation.snapshot() ? 0.9 : undefined);
      },
      openItem: (id) => navigate(itemPath(canvasId, id)),
      onActivateItem: activation.subscribe,
      openChat: () => openPanel(canvasId, "main", false),
    }),
    [canvasId, actor, navigate, activation, presentation, memory],
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
    <CanvasPresentation.Provider value={presentation}>
    <CanvasActivation.Provider value={activation.activate}>
      <div
        className="module-workspace"
        onKeyDown={(event) => {
          const inStage = (event.target as Element).closest(
            "[data-module-stage]",
          );
          if (
            !inStage &&
            (event.metaKey || event.ctrlKey) &&
            event.key.toLowerCase() === "z" &&
            !isTyping(event.target)
          ) {
            event.preventDefault();
            event.stopPropagation();
            void history(event.shiftKey ? redo : undo);
            return;
          }
          if (inStage && event.key === "Enter" && !isTyping(event.target) && selection.length === 1 && activation.activate(selection[0]!)) {
            event.preventDefault(); event.stopPropagation(); return;
          }
          // The module owns its chrome's keys. A button or input must not operate
          // on selected cards behind a report; the global launcher still crosses.
          if (!inStage && !crossesCover(event)) event.stopPropagation();
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
              onClick={() =>
                openPanel(canvasId, chatOpen ? null : "main", false)
              }
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
          </span>
          {!canEdit && <span>Read only</span>}
        </div>
        {historyError && <p role="alert">{historyError}</p>}
        <WorkspaceBoundary key={`${canvasId}:${segment}`}>
          <Suspense
            fallback={<p className="module-page-missing">Opening workspace…</p>}
          >
            {Body && canvas && project && (
              <Body
                viewState={Object.fromEntries(new URLSearchParams(location.search))}
                canvasId={canvasId}
                canvas={canvas}
                project={project}
                host={host}
                selection={selection}
                canEdit={canEdit && !inPast}
                canvasView={<NativeCanvasSlot>{canvasView}</NativeCanvasSlot>}
              />
            )}
          </Suspense>
        </WorkspaceBoundary>
      </div>
    </CanvasActivation.Provider>
    </CanvasPresentation.Provider>
  );
}
