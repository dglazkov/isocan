import { useEffect, useRef, useState } from "react";
import type { Actor, Item } from "@isocan/core";
import { blobUrl } from "../lib/api.ts";
import { addVersionFromFile } from "../lib/upload.ts";
import { applyEdits, foldEdit, type TextEdit } from "../lib/textPatch.ts";

/**
 * Edit-text-in-place: the frozen frame — WYSIWYG's V0
 * (docs/research/2026-08-26-wysiwyg.md, "the native path").
 *
 * The artifact renders in the ONE frame mode the research measured as both
 * reachable and safe: `sandbox="allow-same-origin"` with NO allow-scripts.
 * The page's own scripts are dead — nothing executes, so nothing can read a
 * cookie or call an API, which is what makes same-origin acceptable before
 * the content origin lands — and a frozen page is the right editing
 * surface: nothing fights the caret. The source arrives as fetched text via
 * srcdoc, never the blob URL, because the blob route's response-header CSP
 * forces its own sandbox over anything the iframe attribute says.
 *
 * Double-click a text node and that ONE node becomes plaintext-editable;
 * Enter or clicking away commits it to the pending list, Escape puts it
 * back. Save applies every pending edit under the unique-match rule
 * (`textPatch.ts`) and lands as an ordinary `item.addVersion` — so even a
 * wrong edit was never destructive; it is one S-fan from restored, and an
 * agent parked on the item wakes on it like on any other version.
 */
export function TextEditFrame({
  canvasId,
  item,
  actor,
  onDone,
}: {
  canvasId: string;
  item: Item;
  actor: Actor;
  /** Leave edit-text mode — after a save, or by the Done button. */
  onDone: () => void;
}) {
  const current = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0]!;
  const frame = useRef<HTMLIFrameElement>(null);
  const [source, setSource] = useState<string | null>(null);
  const [pending, setPending] = useState<TextEdit[]>([]);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const text = await (await fetch(blobUrl(canvasId, current.blobHash))).text();
        if (live) setSource(text);
      } catch {
        if (live) setSource("");
      }
    })();
    return () => {
      live = false;
    };
  }, [canvasId, current.blobHash]);

  // Wire the frame's document once it exists. The frame is same-origin (see
  // the header comment), so this is an ordinary DOM — the whole point.
  useEffect(() => {
    const el = frame.current;
    if (!el || source === null) return;
    let detach = () => {};
    const wire = () => {
      const doc = el.contentDocument;
      if (!doc) return;
      const theDoc = doc; // narrowed for the closures below

      /**
       * Which text node this is, counted in document order over the whole
       * document — the one number this frame and parse5 can both compute,
       * and what lets a save splice by POSITION instead of searching for a
       * string (`lib/textPatch.ts` carries the argument).
       *
       * A plain walk, not an index cached at mount: `plaintext-only` editing
       * can split a node, and the count has to be of the tree as it is when
       * the edit is committed.
       */
      function ordinalOf(node: Text): number {
        const walker = theDoc.createTreeWalker(theDoc, NodeFilter.SHOW_TEXT);
        let seen = 0;
        while (walker.nextNode()) {
          if (walker.currentNode === node) return seen;
          seen++;
        }
        return -1;
      }

      /**
       * The text node this edit ended up in.
       *
       * Engines usually mutate the node in place under `plaintext-only`, and
       * sometimes REPLACE it — select-all-then-type does, which is how this
       * was found: the original node detaches and a fresh one takes its
       * place. The element is the stable thing (we are the ones who made it
       * editable), so when the node we started with is gone, its parent's
       * first text child is the node the person actually edited.
       */
      function landedIn(node: Text, parent: HTMLElement): Text | null {
        if (node.isConnected) return node;
        const walker = theDoc.createTreeWalker(parent, NodeFilter.SHOW_TEXT);
        return (walker.nextNode() as Text | null) ?? null;
      }

      function commit(node: Text, parent: HTMLElement, original: string) {
        parent.removeAttribute("contenteditable");
        const live = landedIn(node, parent);
        const next = live ? (live.data ?? "") : (parent.textContent ?? "");
        if (next === original) return;
        const ordinal = live ? ordinalOf(live) : -1;
        if (ordinal < 0) {
          // Nothing left to point at: the element was emptied entirely, so
          // there is no node whose place in the file we could name.
          setRefusal("that edit could not be placed in the file — try it again");
          return;
        }
        setRefusal(null);
        setPending((p) => foldEdit(p, { ordinal, from: original, to: next }));
      }

      function onDblClick(e: MouseEvent) {
        const caret =
          (
            theDoc as Document & {
              caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node } | null;
            }
          ).caretPositionFromPoint?.(e.clientX, e.clientY) ??
          (theDoc.caretRangeFromPoint?.(e.clientX, e.clientY) as
            | { startContainer: Node }
            | null
            | undefined);
        const node =
          caret && "offsetNode" in caret
            ? caret.offsetNode
            : caret && "startContainer" in caret
              ? caret.startContainer
              : null;
        if (!node || node.nodeType !== Node.TEXT_NODE) return;
        const text = node as Text;
        const parent = text.parentElement;
        if (!parent) return;
        e.preventDefault();
        const original = text.data;
        parent.setAttribute("contenteditable", "plaintext-only");
        parent.focus();
        const range = theDoc.createRange();
        range.selectNodeContents(text);
        theDoc.getSelection()?.removeAllRanges();
        theDoc.getSelection()?.addRange(range);

        const done = () => {
          parent.removeEventListener("blur", done);
          parent.removeEventListener("keydown", onKey);
          commit(text, parent, original);
        };
        const onKey = (ke: KeyboardEvent) => {
          if (ke.key === "Enter") {
            ke.preventDefault();
            parent.blur(); // blur commits
          } else if (ke.key === "Escape") {
            ke.preventDefault();
            ke.stopPropagation(); // the cover's ladder waits its turn
            text.data = original;
            parent.blur();
          }
        };
        parent.addEventListener("blur", done);
        parent.addEventListener("keydown", onKey);
      }

      theDoc.addEventListener("dblclick", onDblClick);
      detach = () => theDoc.removeEventListener("dblclick", onDblClick);
    };
    el.addEventListener("load", wire);
    return () => {
      el.removeEventListener("load", wire);
      detach();
    };
  }, [source]);

  async function save() {
    if (source === null || saving) return;
    setSaving(true);
    try {
      const outcome = await applyEdits(source, pendingRef.current);
      if (!outcome.ok) {
        setRefusal(outcome.reason);
        return;
      }
      await addVersionFromFile(
        canvasId,
        actor,
        item.id,
        new File([outcome.source], current.filename, { type: current.mimeType }),
      );
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="text-edit-frame">
      <div className="stage-pane-bar">
        <span className="stage-pane-name">
          Edit text<i> — double-click any text; Enter keeps it, Esc puts it back</i>
        </span>
        <span className="spacer" />
        {refusal && <span className="text-edit-refusal">{refusal}</span>}
        {pending.length > 0 && !refusal && (
          <span className="stage-editor-dirty">
            {pending.length} {pending.length === 1 ? "edit" : "edits"}
          </span>
        )}
        <button className="stage-editor-btn" onClick={onDone} title="Back to the live preview">
          {pending.length > 0 ? "Discard" : "Done"}
        </button>
        {pending.length > 0 && (
          <button
            className="stage-editor-btn primary"
            onClick={() => void save()}
            disabled={saving}
            title="Save as a new version — it stacks; S fans the history"
          >
            {saving ? "Saving…" : "Save version"}
          </button>
        )}
      </div>
      {source === null ? (
        <div className="page-note">Opening…</div>
      ) : (
        /* Same-origin, NO scripts — the measured pair. Both halves are
           load-bearing: same-origin is what lets our chrome reach the DOM,
           and dead scripts are what make same-origin safe (and the page
           still). `workbench.test.ts` pins the exact string. */
        <iframe
          ref={frame}
          className="html-view"
          sandbox="allow-same-origin"
          srcDoc={source}
          title={`edit text of ${current.filename}`}
        />
      )}
    </div>
  );
}
