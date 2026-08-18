import { useState } from "react";
import { Link } from "react-router-dom";
import type { Actor } from "@isocan/core";
import { sendOp } from "../lib/api.ts";
import { useDismissOnOutside } from "../lib/dismiss.ts";
import { useMentionRoster } from "../lib/mentions.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { Presence } from "./Presence.tsx";
import { ProjectEditor } from "./ProjectEditor.tsx";
import { IdentityMenu } from "./IdentityMenu.tsx";
import { CreateActions } from "./CreateActions.tsx";

/**
 * The top bar: where you are (canvas name, whether you're live, who's here) and
 * what you bring onto the canvas (File, Site, Main). Interaction tools live on
 * the right rail; navigation (zoom/undo) bottom-right. The canvas's own name is
 * renamed where you read it.
 */
export function Toolbar({
  actor,
  onIdentity,
}: {
  actor: Actor;
  onIdentity: (actor: Actor | null) => void;
}) {
  const project = useCanvasStore((s) => s.project);
  const connection = useCanvasStore((s) => s.connection);
  const trashOpen = useUiStore((s) => s.trashOpen);
  const identityOpen = useUiStore((s) => s.identityOpen);
  const trashCount = useCanvasStore((s) => s.canvas?.trash.length ?? 0);
  const [editing, setEditing] = useState(false);
  // The names already spoken for on this canvas — a rename into one of them
  // is allowed but worth a word, since @-mentions key on names (the same
  // warning `isocan identity --name` gives in the terminal).
  const otherNames = useMentionRoster(actor.id).peers.map((peer) => peer.name);
  const nameRef = useDismissOnOutside<HTMLDivElement>(editing, () => setEditing(false));
  const identityRef = useDismissOnOutside<HTMLDivElement>(identityOpen, () =>
    useUiStore.getState().setIdentityOpen(false),
  );

  return (
    <div className="toolbar">
      <Link className="home" to="/" title="All projects">
        ⌂
      </Link>
      <div className="project-name" ref={nameRef}>
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
      {project && <CreateActions projectId={project.id} actor={actor} />}
      <span className="spacer" />
      <span className={`conn ${connection}`}>{connection}</span>
      <button
        className={`btn${trashOpen ? " active" : ""}`}
        onClick={() => useUiStore.getState().setTrashOpen(!trashOpen)}
      >
        🗑{trashCount > 0 ? ` ${trashCount}` : ""}
      </button>
      {/* The pile is where you see everyone else; your own face in it is the
          handle for being someone else. */}
      <div className="identity-anchor" ref={identityRef}>
        <Presence actor={actor} />
        {identityOpen && (
          <div className="identity-popover">
            <IdentityMenu
              actor={actor}
              takenNames={otherNames}
              onIdentity={onIdentity}
              onClose={() => useUiStore.getState().setIdentityOpen(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
