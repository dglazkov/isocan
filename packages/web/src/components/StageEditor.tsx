import { useEffect, useRef, useState } from "react";
import type { Actor, Item } from "@isocan/core";
import { newVersionId } from "@isocan/core";
import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { applyLocalEcho } from "../stores/canvasStore.ts";
import { blobUrl, sendOp, uploadBlob } from "../lib/api.ts";

/**
 * The stage's Edit mode: the artifact's text, and ⌘S lands a VERSION.
 *
 * The whole design is that saving is `item.addVersion` — the identical op
 * `isocan edit` sends — so a web save stacks on the item like any other
 * version: it S-fans, it promotes, it undoes per-actor, and an agent parked
 * on `wait --item <this> --op item.addVersion` wakes on it exactly as it
 * wakes on a CLI edit. The editor is a second hand on the same pen, not a
 * second pen.
 *
 * **Drafts persist and restore silently** (the sketch precedent: ink is
 * never quietly lost, and never asked about). The buffer mirrors to
 * localStorage keyed by item + the version it was opened against; leaving
 * and returning restores it; saving or an explicit revert clears it. Esc is
 * never trapped — saving is an op and leaving is a route, and the two must
 * not hold each other hostage.
 *
 * **A version landing under you is a note, not a conflict dialog.** Versions
 * stack — your save lands ON TOP of whatever arrived, both kept, the fan
 * shows the history. The bar says somebody else's version landed so you are
 * not surprised, and that is all it needs to do.
 */

/** The draft's one home. Keyed by the version the buffer STARTED from, so a
 * draft never silently re-attaches to content it was not edits of. */
const draftKey = (canvasId: string, itemId: string, versionId: string) =>
  `isocan.draft.${canvasId}.${itemId}.${versionId}`;

function languageFor(mimeType: string, filename: string) {
  if (mimeType === "text/html") return html();
  if (mimeType === "text/css") return css();
  if (mimeType === "application/json") return json();
  if (mimeType === "text/markdown" || filename.endsWith(".md")) return markdown();
  if (/\.(js|jsx|ts|tsx|mjs)$/.test(filename)) return javascript();
  if (mimeType === "image/svg+xml") return html();
  return [];
}

export function StageEditor({
  canvasId,
  item,
  actor,
  split,
}: {
  canvasId: string;
  item: Item;
  actor: Actor;
  /** Side-by-side with a live preview of the DRAFT (text/html only). */
  split: boolean;
}) {
  const current = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0]!;
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  // The version the OPEN BUFFER is edits of — deliberately not live state:
  // a version landing while you type must not re-key your draft.
  const baseVersion = useRef(current.id);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftPreview, setDraftPreview] = useState<string | null>(null);

  // Somebody else's version landed while the buffer is open. Rendered as a
  // quiet note — the stack keeps both; there is nothing to resolve.
  const landedUnder = current.id !== baseVersion.current;

  useEffect(() => {
    let live = true;
    const key = draftKey(canvasId, item.id, baseVersion.current);
    void (async () => {
      let text: string;
      try {
        text = await (await fetch(blobUrl(canvasId, current.blobHash))).text();
      } catch {
        text = "";
      }
      let restored: string | null = null;
      try {
        restored = localStorage.getItem(key);
      } catch {
        // Storage denied is not a reason to refuse to edit.
      }
      if (!live || !host.current) return;
      const opening = restored ?? text;
      view.current = new EditorView({
        parent: host.current,
        state: EditorState.create({
          doc: opening,
          extensions: [
            basicSetup,
            languageFor(current.mimeType, current.filename),
            EditorView.lineWrapping,
            keymap.of([
              {
                key: "Mod-s",
                preventDefault: true,
                run: () => {
                  void save();
                  return true;
                },
              },
            ]),
            EditorView.updateListener.of((update) => {
              if (!update.docChanged) return;
              const doc = update.state.doc.toString();
              setDirty(true);
              setDraftPreview((prev) => (prev === null ? prev : doc));
              try {
                localStorage.setItem(key, doc);
              } catch {
                // A full store loses persistence, not the buffer.
              }
            }),
          ],
        }),
      });
      setDirty(restored !== null);
      setLoaded(true);
      if (split) setDraftPreview(opening);
    })();
    return () => {
      live = false;
      view.current?.destroy();
      view.current = null;
    };
    // Remount per item; the buffer belongs to the item it opened for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasId, item.id]);

  useEffect(() => {
    if (split && view.current) setDraftPreview(view.current.state.doc.toString());
    if (!split) setDraftPreview(null);
  }, [split]);

  async function save() {
    const doc = view.current?.state.doc.toString();
    if (doc === undefined || saving) return;
    setSaving(true);
    try {
      const upload = await uploadBlob(
        canvasId,
        new Blob([doc], { type: current.mimeType }),
        current.filename,
      );
      const version = {
        id: newVersionId(),
        blobHash: upload.blobHash,
        mimeType: current.mimeType,
        filename: current.filename,
        size: upload.size,
      };
      const op = { type: "item.addVersion", itemId: item.id, version } as const;
      applyLocalEcho(op, actor);
      await sendOp(canvasId, actor, op);
      try {
        localStorage.removeItem(draftKey(canvasId, item.id, baseVersion.current));
      } catch {
        /* the save landed; a stranded draft key is cosmetic */
      }
      // The buffer is now edits of the version it just made.
      baseVersion.current = version.id;
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  function revert() {
    // Explicit, so it also clears the persisted draft — the one deliberate
    // way to throw the buffer away.
    try {
      localStorage.removeItem(draftKey(canvasId, item.id, baseVersion.current));
    } catch {
      /* nothing to clear is fine */
    }
    void (async () => {
      const text = await (await fetch(blobUrl(canvasId, current.blobHash))).text();
      view.current?.dispatch({
        changes: { from: 0, to: view.current.state.doc.length, insert: text },
      });
      baseVersion.current = current.id;
      setDirty(false);
    })();
  }

  return (
    <div className={`stage-editor${split ? " split" : ""}`}>
      <div className="stage-editor-bar">
        <span className="stage-editor-file">{current.filename}</span>
        {landedUnder && (
          <span className="stage-editor-note">
            v{item.versions.length} landed while you edited — your save stacks on top
          </span>
        )}
        <span className="spacer" />
        {dirty && <span className="stage-editor-dirty">draft</span>}
        <button className="stage-editor-btn" onClick={revert} title="Back to the saved version — clears the draft">
          Revert
        </button>
        <button
          className="stage-editor-btn primary"
          onClick={() => void save()}
          disabled={saving || !loaded}
          title="Save as a new version (⌘S) — it stacks; S fans the history"
        >
          {saving ? "Saving…" : "Save version"}
        </button>
      </div>
      <div className="stage-editor-body">
        <div ref={host} className="stage-editor-cm" />
        {split && draftPreview !== null && current.mimeType === "text/html" && (
          /* The DRAFT, live: srcdoc under the same lone allow-scripts the
             item view uses — an opaque origin, no cookie, no API. Local by
             construction; nothing leaves the tab until Save. */
          <iframe
            className="html-view stage-editor-preview"
            sandbox="allow-scripts"
            srcDoc={draftPreview}
            title={`draft of ${current.filename}`}
          />
        )}
      </div>
    </div>
  );
}
