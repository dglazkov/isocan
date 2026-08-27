import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { Actor } from "@isocan/core";
import type { Backing } from "@isocan/core";
import { backingOf, editableText, isDesignSystem } from "@isocan/core";
import { loadBacking, useCanvasStore } from "../stores/canvasStore.ts";
import { VersionContent } from "./ItemView.tsx";
import { TextEditFrame } from "./TextEditFrame.tsx";
import { PanelResizer } from "./PanelResizer.tsx";

/** The editor is its own chunk inside the cover's chunk: CodeMirror is the
 * heaviest thing the workbench owns, and a folded editor must not pay for
 * it. */
const StageEditor = lazy(() =>
  import("./StageEditor.tsx").then((m) => ({ default: m.StageEditor })),
);

/**
 * One artifact, rendered big and live — the stage both covers share.
 *
 * Full screen (`/i/:itemId`) and the workbench (`/w/:itemId`) are two frames
 * around the same question: show me this item. The rendering lives here so
 * the two addresses can never answer differently (workbench design doc,
 * "the stage").
 *
 * **Two panes, one header each, no third bar.** This grew chrome twice and
 * shed it twice: Preview/Edit/Split tabs became two toggles, and the toggle
 * ROW itself lasted a day — a strip of buttons above two panes that each
 * already had a header was three layers of chrome before any content. Now
 * each pane's own header carries its controls AND its fold, and a folded
 * pane leaves a slim rail on its edge whose whole face reopens it — the way
 * back stands exactly where the way out was.
 *
 * The stage never shows nothing: the sole open pane simply has no fold
 * control, so the empty state is unreachable rather than refused.
 *
 * What the preview shows follows the editor: the live DRAFT (rendered as
 * you type, for HTML) while the buffer is open, the saved current version
 * otherwise — and its header says which, because a preview that might be
 * either is a preview you cannot trust.
 *
 * The fold choice is remembered once per browser (`isocan.stage.panes`),
 * not per item — folding the preview is a statement about how you work, on
 * the minimap's ethic — and a fresh browser starts with both.
 */

type Panes = { preview: boolean; edit: boolean };

/**
 * **Which cover this stage is under — and it decides what opens.**
 *
 * The two addresses ask different questions. Full screen (Enter) is *look at
 * this thing big*: the preview alone, with the editor a rail away. The
 * workbench (W) is *work on this thing*: both panes, because that is the
 * room you flipped to in order to change something.
 *
 * One shared preference could not say that — it made Enter and W open the
 * same way, so whichever you used last decided what the other did. Two keys,
 * two defaults, and each cover remembers its own folding.
 */
export type Surface = "fullscreen" | "workbench";

const PANES_KEY: Record<Surface, string> = {
  fullscreen: "isocan.stage.panes.fullscreen",
  workbench: "isocan.stage.panes.workbench",
};

const DEFAULT_PANES: Record<Surface, Panes> = {
  fullscreen: { preview: true, edit: false },
  workbench: { preview: true, edit: true },
};

/**
 * **How wide the editor is when both panes are open**, as a FRACTION of the
 * stage rather than a pixel width.
 *
 * Pixels would be one answer to a question that keeps changing: the left
 * panel is draggable, the window resizes, and a width chosen at 1600px is
 * most of the stage at 900. A fraction survives all of it — the same reason
 * the viewport stores a scale rather than a zoom in pixels.
 *
 * One key for both covers, unlike the panes: which panes OPEN is about what
 * you came to do, and Enter and W genuinely differ there. How wide you like
 * your editor is not — it is a preference about proportion, and having to
 * set it twice would be the annoyance, not the feature.
 */
const SPLIT_KEY = "isocan.stage.split";

/** Neither pane may be squeezed below this, in screen pixels. */
const PANE_MIN = 200;

function readSplit(): number | null {
  try {
    const raw = Number(localStorage.getItem(SPLIT_KEY));
    // A stored 0 or 1 would be a folded pane wearing a split's clothes, and
    // folding has its own control; anything unparseable is "never dragged".
    if (Number.isFinite(raw) && raw > 0.05 && raw < 0.95) return raw;
  } catch {
    // Storage denied: the default stands.
  }
  return null;
}

function writeSplit(fraction: number | null): void {
  try {
    if (fraction === null) localStorage.removeItem(SPLIT_KEY);
    else localStorage.setItem(SPLIT_KEY, String(fraction));
  } catch {
    // The choice holds for this session and no longer.
  }
}

function readPanes(surface: Surface): Panes {
  try {
    const raw = localStorage.getItem(PANES_KEY[surface]);
    if (raw === "preview") return { preview: true, edit: false };
    if (raw === "edit") return { preview: false, edit: true };
    if (raw === "both") return { preview: true, edit: true };
  } catch {
    // Storage denied: the default stands.
  }
  return DEFAULT_PANES[surface];
}

function writePanes(surface: Surface, panes: Panes): void {
  try {
    localStorage.setItem(
      PANES_KEY[surface],
      panes.preview && panes.edit ? "both" : panes.preview ? "preview" : "edit",
    );
  } catch {
    // The choice holds for this session and no longer.
  }
}

export function ArtifactStage({
  canvasId,
  itemId,
  actor,
  surface,
}: {
  canvasId: string;
  itemId: string;
  actor: Actor;
  /** Which cover is up — it decides what opens and where the fold is
   *  remembered. See `Surface`. */
  surface: Surface;
}) {
  const item = useCanvasStore((s) => s.canvas?.items[itemId] ?? null);
  const loaded = useCanvasStore((s) => s.canvas !== null);
  const [panes, setPanes] = useState<Panes>(() => readPanes(surface));
  const [split, setSplit] = useState<number | null>(readSplit);
  /**
   * The width the split is a fraction OF, tracked rather than peeked at.
   *
   * A ref read during render was the first attempt and it is null on the
   * first one, so the resizer opened believing the stage was 0 wide and the
   * first drag slammed the editor to its floor. Observing it also keeps the
   * handle honest as the left panel is dragged and the window resized, which
   * a value captured once could not.
   */
  const body = useRef<HTMLDivElement>(null);
  const [bodyWidth, setBodyWidth] = useState(0);
  useEffect(() => {
    const el = body.current;
    if (!el) return;
    const measure = () => setBodyWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [panes.edit, panes.preview]);
  // The open buffer, lifted from the editor so the preview pane can render
  // it. Null while the editor is folded or the type has no draft renderer.
  const [draft, setDraft] = useState<string | null>(null);
  // Edit-text-in-place (the WYSIWYG V0). Per item, reset on item change —
  // and only offered on the SAVED preview: with the editor open, the buffer
  // is the source of truth and two pens on one file is a conflict machine.
  const [textEditing, setTextEditing] = useState(false);
  /**
   * **Every hook above the early returns**, and this one taught the rule the
   * hard way: it sat beside the `showDraft` it feeds, which is below `if
   * (!item)`. That is fine on every render where the canvas is already
   * loaded — which is every render you get by clicking around inside the app
   * — and breaks the moment somebody opens a full-screen item URL COLD: the
   * first render has no item, returns early with fewer hooks, the snapshot
   * lands, and React counts a different number. A blank page and error #310.
   */
  const disk = useCanvasStore((s) => s.backing);

  if (!item) {
    return (
      <div className="page-note">
        {loaded
          ? "That item is not on this canvas any more — it may have been deleted."
          : "Finding that item…"}
      </div>
    );
  }

  const current = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0]!;
  const editable = editableText(current.mimeType);
  // Not a hook — a derivation, so it may live where it is used.
  const backing = backingOf(item, disk.bound, (path) => disk.onDisk[path] ?? null);

  const fold = (which: keyof Panes) => {
    const next = { ...panes, [which]: !panes[which] };
    if (!next.preview && !next.edit) return; // unreachable: the sole pane has no fold control
    setPanes(next);
    writePanes(surface, next);
  };

  const saved = (
    <VersionContent
      canvasId={canvasId}
      blobHash={current.blobHash}
      mimeType={current.mimeType}
      filename={current.filename}
      entered={true}
      designSystem={isDesignSystem(item)}
      reloadToken={0}
    />
  );

  // Not editable: one pane, no headers, no folds — a png has no editor to
  // put away, so it gets the whole stage without ceremony.
  if (!editable) return <div className="artifact-stage">{saved}</div>;

  const showDraft = panes.edit && draft !== null && current.mimeType === "text/html";
  /**
   * **Offered whenever the preview is showing the SAVED file** — editor pane
   * open or folded.
   *
   * It used to require the editor to be FOLDED, on a rule that was right and
   * a precondition that was invisible: two pens on one file is a conflict
   * machine, so the affordance was withheld beside an open buffer. But both
   * panes are open by DEFAULT, so the default layout hid the feature
   * completely — the way to discover editing was to fold the editor first,
   * which nobody does looking for a way to edit.
   *
   * The rule is kept and moved into the GESTURE instead: entering in-place
   * mode takes the whole stage for the duration (below), so there is still
   * exactly one pen — the editor is not beside you, it is behind you, and it
   * comes back untouched when you are done. And when the buffer IS dirty the
   * preview is showing that draft rather than the saved file, so this is
   * false and nothing is offered: you already have a pen in your hand.
   */
  const offerTextEdit = current.mimeType === "text/html" && !showDraft;

  /**
   * In-place editing takes the whole stage rather than half of it, and
   * deliberately does NOT fold the editor pane: folding writes the layout
   * preference (`writePanes`), and a temporary mode must not rewrite how
   * somebody has decided to work. The panes come back exactly as they were.
   */
  if (textEditing && offerTextEdit) {
    return (
      <div className="artifact-stage">
        <TextEditFrame
          key={item.id}
          canvasId={canvasId}
          item={item}
          actor={actor}
          onDone={() => setTextEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="artifact-stage">
      <div className="artifact-stage-body" ref={body}>
        {panes.edit ? (
          /**
           * A slot around the editor, so the seam between the panes can be a
           * HANDLE. `PanelResizer` is the docked panel's own edge, reused
           * whole — it was generalized the day the workbench grew a draggable
           * edge, and this is the third caller. It hangs off this slot's right
           * edge, straddling the border the preview pane draws, so the strip
           * you point at is the line you are about to move.
           *
           * Only when there are two panes to divide: a folded pane leaves a
           * rail, and a rail is not a seam.
           */
          <div
            className="stage-editor-slot"
            style={split !== null && panes.preview ? { flex: "none", width: `${split * 100}%` } : undefined}
          >
            <Suspense fallback={<div className="page-note">Opening the editor…</div>}>
              <StageEditor
                key={item.id}
                canvasId={canvasId}
                item={item}
                actor={actor}
                onDraft={setDraft}
                onFold={panes.preview ? () => fold("edit") : undefined}
              />
            </Suspense>
            {panes.preview && (
              <PanelResizer
                label="Resize the editor and preview"
                value={Math.round((split ?? 0.5) * bodyWidth)}
                min={PANE_MIN}
                max={Math.max(PANE_MIN, bodyWidth - PANE_MIN)}
                // Home and a double-click go back to an even split, which is
                // where the stage started and what somebody who dragged too
                // far is trying to find again.
                resetTo={Math.round(bodyWidth / 2)}
                onChange={(px) => {
                  const width = bodyWidth;
                  if (width <= PANE_MIN * 2) return; // nothing to divide
                  // The owner clamps; the resizer only reports. Neither pane
                  // may be squeezed to nothing, whatever the pointer does.
                  const clamped = Math.min(Math.max(px, PANE_MIN), width - PANE_MIN);
                  const next = clamped / width;
                  setSplit(next);
                  writeSplit(next);
                }}
              />
            )}
          </div>
        ) : (
          /* The folded editor's rail: its whole face is the way back, on the
             edge the pane folded to. */
          <button className="stage-rail left" onClick={() => fold("edit")} title="Open the editor">
            <span>Edit</span>
            <b aria-hidden>»</b>
          </button>
        )}
        {panes.preview ? (
          <div className="stage-preview-pane">
            {
              <>
                <div className="stage-pane-bar">
                  <span className="stage-pane-name">
                    {showDraft ? "Draft" : "Saved"}
                    <i>
                      {showDraft
                        ? " — renders as you type; ⌘S makes it a version"
                        : ` — v${item.versions.length}`}
                    </i>
                  </span>
                  <span className="spacer" />
                  {/**
                   * **Write this item out to the directory bound here** — the
                   * other direction from `＋`
                   * (`docs/projects/workbench/files-on-disk.md`).
                   *
                   * Offered only for an item that HAS a place on disk and a
                   * machine that has the directory: an untracked item has
                   * nowhere to go, and a hosted canvas has no disk. The
                   * daemon owns every refusal (the jail, and drift); this
                   * only asks, and repeats what it is told.
                   */}
                  {backing && backing.state !== "unbound" && (
                    <SaveToDisk canvasId={canvasId} itemId={item.id} backing={backing} />
                  )}
                  {offerTextEdit && (
                    <button
                      className="stage-editor-btn"
                      onClick={() => setTextEditing(true)}
                      title="Change the words in place — double-click any text; simple edits save as a version, anything ambiguous is refused toward the editor"
                    >
                      Edit text
                    </button>
                  )}
                  {panes.edit && (
                    <button
                      className="stage-pane-fold"
                      onClick={() => fold("preview")}
                      title="Fold the preview away — the rail brings it back"
                      aria-label="Collapse the preview"
                    >
                      »
                    </button>
                  )}
                </div>
                <div className="stage-pane-body">
                  {showDraft ? (
                    /* The DRAFT, live: srcdoc under the same lone allow-scripts
                       every item frame gets — an opaque origin, no cookie, no
                       API. Local by construction; nothing leaves the tab until
                       Save. */
                    <iframe
                      className="html-view"
                      sandbox="allow-scripts"
                      srcDoc={draft ?? ""}
                      title={`draft of ${current.filename}`}
                    />
                  ) : (
                    saved
                  )}
                </div>
              </>
            }
          </div>
        ) : (
          <button
            className="stage-rail right"
            onClick={() => fold("preview")}
            title="Open the preview"
          >
            <span>Preview</span>
            <b aria-hidden>«</b>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * The button, and the two sentences it needs.
 *
 * `absent` is an ordinary write. `drifted` means the file changed outside the
 * canvas since anything this item has ever held — so the first press is
 * refused by the daemon and the second, which says `force`, is a person
 * deciding to overwrite somebody's work. Making that two presses rather than
 * a confirm dialog keeps the decision in the same place as the gesture.
 */
function SaveToDisk({
  canvasId,
  itemId,
  backing,
}: {
  canvasId: string;
  itemId: string;
  backing: Backing;
}) {
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);

  async function save(force: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${canvasId}/write`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, force }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setRefused(res.ok ? null : (body?.error ?? "that could not be written"));
      // The disk just changed; ask it again so every mark on the canvas
      // stops saying what used to be true.
      await loadBacking(canvasId);
    } catch {
      setRefused("the daemon did not answer");
    } finally {
      setBusy(false);
    }
  }

  const drifted = backing.state === "drifted";
  return (
    <>
      {refused && <span className="text-edit-refusal">{refused}</span>}
      <button
        className={`stage-editor-btn${drifted ? " warn" : ""}`}
        disabled={busy || backing.state === "written"}
        title={
          backing.state === "written"
            ? `${backing.path} is up to date`
            : drifted
              ? `${backing.path} changed on disk outside the canvas — this overwrites it`
              : `Write this item to ${backing.path}`
        }
        onClick={() => void save(drifted)}
      >
        {busy ? "…" : backing.state === "written" ? "Saved to disk" : drifted ? "Overwrite file" : "Save to disk"}
      </button>
    </>
  );
}
