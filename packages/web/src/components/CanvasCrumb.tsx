import { useState } from "react";
import type { Actor } from "@isocan/core";
import { sendOp } from "../lib/api.ts";
import { useDismissOnOutside } from "../lib/dismiss.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { Presence } from "./Presence.tsx";
import { CanvasEditor } from "./CanvasEditor.tsx";
import { IdentityMenu } from "./IdentityMenu.tsx";
import { ShareDialog } from "./ShareDialog.tsx";

/**
 * **What is true wherever you are on a canvas.**
 *
 * The canvas, the workbench and a full-screen item are three views of ONE
 * canvas, not three places. Until now only the first said so: stepping into
 * the workbench replaced the whole bar with `← Canvas | Copy link`, and with
 * it went the canvas's name, whether you were live, everyone else's faces,
 * and Share. That is the drill-down pattern — right for descending into a
 * child object, wrong for switching between peers — and it is the reason
 * `W` felt like folklore: the bar changed identity on the way in, so the
 * return trip had nowhere to live but a back arrow.
 *
 * These two pieces are the answer, and they are two rather than one on
 * purpose: the canvas's bar puts the name at the far left and presence at the
 * far right, and a single component would have collapsed them together and
 * moved the name. Same content, same relative places, three views.
 *
 * What is NOT here is anything view-local: the `Chat | Files` dock switch
 * only means something where there is a dock, and carrying it into the
 * workbench — where both are permanently in the sidebar — would be a control
 * that lies. Different views legitimately differ; what must not differ is
 * which canvas you are in and who is in it with you.
 */
export function CanvasTitle({ actor }: { actor: Actor }) {
  const canvas = useCanvasStore((s) => s.project);
  const [editing, setEditing] = useState(false);
  const nameRef = useDismissOnOutside<HTMLDivElement>(editing, () => setEditing(false));

  return (
    <div className="canvas-name" ref={nameRef}>
      <button
        className="title"
        disabled={!canvas}
        title={
          canvas
            ? `${canvas.description ? `${canvas.description}\n\n` : ""}Rename this canvas`
            : undefined
        }
        onClick={() => setEditing(!editing)}
      >
        {canvas?.title ?? "…"}
      </button>
      {editing && canvas && (
        <div className="canvas-popover">
          <CanvasEditor
            title={canvas.title}
            description={canvas.description}
            onSave={async (patch) => {
              await sendOp(canvas.id, actor, { type: "project.update", patch });
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Whether you are live, who may be here, and who is. Share sits beside the
 * pile because they are the same subject from two sides — who is in the room
 * and who may come in.
 */
export function CanvasPresence({
  actor,
  onIdentity,
}: {
  actor: Actor;
  onIdentity: (actor: Actor | null) => void;
}) {
  const canvas = useCanvasStore((s) => s.project);
  const connection = useCanvasStore((s) => s.connection);
  const identityOpen = useUiStore((s) => s.identityOpen);
  const shareOpen = useUiStore((s) => s.shareOpen);
  const identityRef = useDismissOnOutside<HTMLDivElement>(identityOpen, () =>
    useUiStore.getState().setIdentityOpen(false),
  );
  const shareRef = useDismissOnOutside<HTMLDivElement>(shareOpen, () =>
    useUiStore.getState().setShareOpen(false),
  );

  return (
    <>
      <span className={`conn ${connection}`}>{connection}</span>
      <div className="identity-anchor" ref={shareRef}>
        <button
          className={`btn${shareOpen ? " active" : ""}`}
          title="Who may enter this canvas"
          disabled={!canvas}
          onClick={() => useUiStore.getState().setShareOpen(!shareOpen)}
        >
          Share
        </button>
        {shareOpen && canvas && (
          <div className="identity-popover share-popover">
            <ShareDialog actor={actor} onClose={() => useUiStore.getState().setShareOpen(false)} />
          </div>
        )}
      </div>
      {/* The pile is where you see everyone else; your own face in it is the
          handle for being someone else. */}
      <div className="identity-anchor" ref={identityRef}>
        <Presence actor={actor} />
        {identityOpen && (
          <div className="identity-popover">
            <IdentityMenu
              actor={actor}
              canvasId={canvas?.id ?? null}
              onIdentity={onIdentity}
              onClose={() => useUiStore.getState().setIdentityOpen(false)}
            />
          </div>
        )}
      </div>
    </>
  );
}
