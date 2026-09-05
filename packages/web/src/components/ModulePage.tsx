import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { canvasPath } from "@isocan/core";
import { modulePage } from "../modules.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";

/**
 * **A module's page, as a cover** (`docs/projects/modules/design.md`, phase 4).
 *
 * A whole section of the app a module owns — the Documents page is the
 * first — at `x/<segment>` under the canvas's path: a cover route like the workbench and
 * the deck view, mounted inside `CanvasPage` so the replica underneath stays
 * open and Esc is Back. The shell owns the bar (where you are, the way
 * back); the module owns everything under it and is handed the canvas as a
 * fact, never a store. A segment nobody owns says so rather than showing a
 * blank cover: a link from a home that had the module still lands
 * somewhere legible on one that does not.
 */
export function ModulePage({ canvasId, segment }: { canvasId: string; segment: string }) {
  const navigate = useNavigate();
  const canvas = useCanvasStore((s) => s.canvas);
  // A runtime module's page may arrive after first paint.
  useUiStore((s) => s.modulesGeneration);
  const page = modulePage(segment);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        navigate(canvasPath(canvasId));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, canvasId]);

  const Body = page?.component ?? null;
  return (
    <div className="module-page" data-segment={segment}>
      <div className="module-page-bar">
        <button type="button" className="deck-back" onClick={() => navigate(canvasPath(canvasId))} title="Back to the canvas (Esc)">
          ← Canvas
        </button>
        <b className="module-page-title">{page?.label ?? segment}</b>
        {page?.hint && <span className="module-page-hint">{page.hint}</span>}
      </div>
      <div className="module-page-body">
        {Body && canvas ? (
          <Body canvasId={canvasId} canvas={canvas} />
        ) : (
          <p className="module-page-missing">
            {page ? "Loading the canvas…" : `No page called “${segment}” on this home — the module that adds it is not loaded here.`}
          </p>
        )}
      </div>
    </div>
  );
}
