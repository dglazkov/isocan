import { Link } from "react-router-dom";
import type { Actor } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { Presence } from "./Presence.tsx";

/**
 * Identity only: where you are, whether you're live, who's here. Everything
 * that ACTS on the canvas lives on the Shelf at the bottom.
 */
export function Toolbar({ actor }: { actor: Actor }) {
  const project = useCanvasStore((s) => s.project);
  const connection = useCanvasStore((s) => s.connection);
  const trashOpen = useUiStore((s) => s.trashOpen);
  const trashCount = useCanvasStore((s) => s.canvas?.trash.length ?? 0);

  return (
    <div className="toolbar">
      <Link className="home" to="/" title="All projects">
        ⌂
      </Link>
      <span className="title">{project?.title ?? "…"}</span>
      <span className="spacer" />
      <span className={`conn ${connection}`}>{connection}</span>
      <button
        className={`btn${trashOpen ? " active" : ""}`}
        onClick={() => useUiStore.getState().setTrashOpen(!trashOpen)}
      >
        🗑{trashCount > 0 ? ` ${trashCount}` : ""}
      </button>
      <Presence actor={actor} />
    </div>
  );
}
