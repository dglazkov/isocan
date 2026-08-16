import { useState } from "react";
import { Link } from "react-router-dom";
import type { Actor } from "@isocan/core";
import { sendOp } from "../lib/api.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { Presence } from "./Presence.tsx";
import { ProjectEditor } from "./ProjectEditor.tsx";

/**
 * Identity only: where you are, whether you're live, who's here. Everything
 * that ACTS on the canvas lives on the Shelf at the bottom. The one exception
 * is the canvas's own name — you rename it where you read it.
 */
export function Toolbar({ actor }: { actor: Actor }) {
  const project = useCanvasStore((s) => s.project);
  const connection = useCanvasStore((s) => s.connection);
  const trashOpen = useUiStore((s) => s.trashOpen);
  const trashCount = useCanvasStore((s) => s.canvas?.trash.length ?? 0);
  const [editing, setEditing] = useState(false);

  return (
    <div className="toolbar">
      <Link className="home" to="/" title="All projects">
        ⌂
      </Link>
      <div className="project-name">
        <button
          className="title"
          disabled={!project}
          title={
            project
              ? `${project.description ? `${project.description}\n\n` : ""}Rename this canvas`
              : undefined
          }
          onClick={() => setEditing(!editing)}
        >
          {project?.title ?? "…"}
        </button>
        {editing && project && (
          <div className="project-popover">
            <ProjectEditor
              title={project.title}
              description={project.description}
              onSave={async (patch) => {
                await sendOp(project.id, actor, { type: "project.update", patch });
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
            />
          </div>
        )}
      </div>
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
