import { useState } from "react";
import type { Actor } from "@isocan/core";

import { useDismissOnOutside } from "../lib/dismiss.ts";
import { sendEchoed, useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { Presence } from "./Presence.tsx";
import { CanvasEditor } from "./CanvasEditor.tsx";
import { IdentityMenu } from "./IdentityMenu.tsx";
import { ShareDialog } from "./ShareDialog.tsx";
import { ShareGlyph } from "./Glyphs.tsx";

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
              await sendEchoed(canvas.id, actor, { type: "project.update", patch });
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
 * **Whether you are live, and who is here.** Nothing else.
 *
 * Share used to live in here, on the argument that who is in the room and who
 * may come in are one subject. True, and beside the point: this group is
 * things you LOOK AT and Share is a thing you PRESS, so putting it here left
 * a green status dot between two buttons and a row that read as broken. It is
 * `ShareButton` now, and it sits with the workbench in the pill of things
 * that do something.
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
  const identityRef = useDismissOnOutside<HTMLDivElement>(identityOpen, () =>
    useUiStore.getState().setIdentityOpen(false),
  );

  return (
    <>
      <span className={`conn ${connection}`}>{connection}</span>
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

/**
 * **Share, on its own**, so it can stand with the other control rather than
 * inside the group of things you only read. Exported because three surfaces
 * carry it — the canvas bar, full screen and the workbench — and a button
 * that lives in three places is one button or it is three that drift.
 */
export function ShareButton({ actor }: { actor: Actor }) {
  const canvas = useCanvasStore((s) => s.project);
  const shareOpen = useUiStore((s) => s.shareOpen);
  const shareRef = useDismissOnOutside<HTMLDivElement>(shareOpen, () =>
    useUiStore.getState().setShareOpen(false),
  );
  return (
    <div className="identity-anchor" ref={shareRef}>
      <button
        className={`btn${shareOpen ? " active" : ""}`}
        title="Who may enter this canvas"
        disabled={!canvas}
        onClick={() => useUiStore.getState().setShareOpen(!shareOpen)}
      >
        <ShareGlyph />
        Share
      </button>
      {shareOpen && canvas && (
        <div className="identity-popover share-popover">
          <ShareDialog actor={actor} onClose={() => useUiStore.getState().setShareOpen(false)} />
        </div>
      )}
    </div>
  );
}
