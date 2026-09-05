import { useEffect, useRef, useState } from "react";
import type { Actor, Item } from "@isocan/core";
import { readBlobText } from "../lib/api.ts";
import { addVersionFromFile } from "../lib/upload.ts";
import { applyEdits, foldEdit, isAttrEdit, type AttrEdit, type InPlaceEdit } from "../lib/textPatch.ts";

/**
 * Edit-in-place: the frozen frame — WYSIWYG's V0 and its second stage
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
 * back. **Click an element and its properties open in the bar** — the
 * class, and the handful of inline styles a person reaches for — editing
 * the frame live and recording an attribute edit. Save applies every
 * pending edit by source position (`textPatch.ts`) and lands as an ordinary
 * `item.addVersion` — so even a wrong edit was never destructive; it is one
 * S-fan from restored, and an agent parked on the item wakes on it like on
 * any other version.
 */

/** The inline styles the panel offers. Enough to change what a screen looks
 *  like without becoming an inspector; anything else is the editor's. */
const STYLE_PROPS: { prop: string; label: string }[] = [
  { prop: "color", label: "Color" },
  { prop: "background-color", label: "Background" },
  { prop: "font-size", label: "Size" },
  { prop: "font-weight", label: "Weight" },
  { prop: "padding", label: "Padding" },
  { prop: "margin", label: "Margin" },
  { prop: "border-radius", label: "Radius" },
];

/** What the panel shows for the selected element. */
interface Selected {
  ordinal: number;
  tag: string;
  el: HTMLElement;
  /** The attribute values the element had when selected — the `from`s. */
  classFrom: string | null;
  styleFrom: string | null;
}

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
  /** The read failed. Kept apart from `source`, because the empty string this
   *  used to fall back to renders as a frozen frame of NOTHING for a document
   *  that is still there — and a page with no text nodes offers no way to
   *  find out otherwise. */
  const [unreadable, setUnreadable] = useState<string | null>(null);
  const [pending, setPending] = useState<InPlaceEdit[]>([]);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Selected | null>(null);
  /** The panel's field values, mirrored so typing repaints; the frame's
   *  element is the source of truth and is written on every change. */
  const [fields, setFields] = useState<Record<string, string>>({});
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const text = await readBlobText(canvasId, current.blobHash);
        if (live) setSource(text);
      } catch {
        // Never the file's own bytes, so never an editing surface: a refusal
        // read as the source would put its json in the frame, and a save
        // would land THAT as the item's next version.
        if (live) setUnreadable("Could not read this file to edit it.");
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

      // The selection outline, drawn by the frame's own stylesheet so it
      // scales with the page and takes no pointer. Ours, on an attribute the
      // page cannot have written.
      const marker = theDoc.createElement("style");
      marker.textContent = "[data-isocan-selected]{outline:2px solid #1f3fd0 !important;outline-offset:1px}";
      theDoc.head?.appendChild(marker);

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

      /** Which element, by the same rule over elements — and never our own
       *  marker `<style>`, which is not in the file. */
      function elementOrdinalOf(target: Element): number {
        const walker = theDoc.createTreeWalker(theDoc, NodeFilter.SHOW_ELEMENT);
        let seen = 0;
        while (walker.nextNode()) {
          if (walker.currentNode === marker) continue;
          if (walker.currentNode === target) return seen;
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

      /**
       * **Click selects an element** (stage 2). One click, no modifier — the
       * page's own handlers are dead, so a click here means nothing else.
       * The panel reads the element's inline style and class; the `from`s
       * are what the attributes said at selection, so a later save can
       * check the file still says them.
       */
      function onClick(e: MouseEvent) {
        const target = e.target as HTMLElement | null;
        if (!target || target === theDoc.documentElement || target.hasAttribute("contenteditable")) return;
        e.preventDefault();
        for (const old of theDoc.querySelectorAll("[data-isocan-selected]")) old.removeAttribute("data-isocan-selected");
        target.setAttribute("data-isocan-selected", "");
        const ordinal = elementOrdinalOf(target);
        if (ordinal < 0) return;
        const values: Record<string, string> = { class: target.getAttribute("class") ?? "" };
        for (const { prop } of STYLE_PROPS) values[prop] = target.style.getPropertyValue(prop);
        setFields(values);
        setSelected({
          ordinal,
          tag: target.tagName.toLowerCase(),
          el: target,
          classFrom: target.getAttribute("class"),
          styleFrom: target.getAttribute("style"),
        });
      }

      function onKeyDown(e: KeyboardEvent) {
        if (e.key === "Escape" && !(e.target as HTMLElement | null)?.hasAttribute("contenteditable")) {
          for (const old of theDoc.querySelectorAll("[data-isocan-selected]")) old.removeAttribute("data-isocan-selected");
          setSelected(null);
        }
      }

      theDoc.addEventListener("dblclick", onDblClick);
      theDoc.addEventListener("click", onClick);
      theDoc.addEventListener("keydown", onKeyDown);
      detach = () => {
        theDoc.removeEventListener("dblclick", onDblClick);
        theDoc.removeEventListener("click", onClick);
        theDoc.removeEventListener("keydown", onKeyDown);
      };
    };
    el.addEventListener("load", wire);
    return () => {
      el.removeEventListener("load", wire);
      detach();
    };
  }, [source]);

  /**
   * A field change writes the frame live and records the attribute edit.
   * The whole `style` attribute is the unit — the parser locates the
   * attribute, not a declaration inside it — so the edit's `to` is whatever
   * the element's style reads after the change, and `from` is what it read
   * at selection. Empty means removed, on the way in and on the way back.
   */
  function change(name: "class" | string, value: string) {
    if (!selected) return;
    const { el, ordinal, tag, classFrom, styleFrom } = selected;
    setFields((f) => ({ ...f, [name]: value }));
    if (name === "class") {
      if (value.trim() === "") el.removeAttribute("class");
      else el.setAttribute("class", value);
      record({ kind: "attr", ordinal, tag, name: "class", from: classFrom, to: el.getAttribute("class") });
      return;
    }
    el.style.setProperty(name, value);
    if (value.trim() === "") el.style.removeProperty(name);
    if (el.getAttribute("style") === "") el.removeAttribute("style");
    record({ kind: "attr", ordinal, tag, name: "style", from: styleFrom, to: el.getAttribute("style") });
  }

  function record(edit: AttrEdit) {
    // Our selection mark never reaches the file: it is an attribute, not a
    // style, and the splice writes only the attribute named.
    setRefusal(null);
    setPending((p) => foldEdit(p, edit));
  }

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

  const attrEdits = pending.filter(isAttrEdit).length;
  const textEdits = pending.length - attrEdits;
  const count =
    pending.length === 0
      ? null
      : [textEdits > 0 ? `${textEdits} text` : null, attrEdits > 0 ? `${attrEdits} ${attrEdits === 1 ? "property" : "properties"}` : null]
          .filter(Boolean)
          .join(", ");

  return (
    <div className="text-edit-frame">
      <div className="stage-pane-bar">
        <span className="stage-pane-name">
          Edit text<i> — double-click text to change it; click an element for its properties; Esc puts it back</i>
        </span>
        <span className="spacer" />
        {refusal && <span className="text-edit-refusal">{refusal}</span>}
        {count && !refusal && <span className="stage-editor-dirty">{count}</span>}
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
      {selected && (
        /* The properties of the selected element: the class, and the inline
           styles a person reaches for. Each field writes the frame live;
           the bar above counts the edits; Save splices them by position. */
        <div className="props-panel" role="group" aria-label={`Properties of <${selected.tag}>`}>
          <span className="props-tag">&lt;{selected.tag}&gt;</span>
          <label className="props-field props-class">
            <span>class</span>
            <input value={fields.class ?? ""} onChange={(e) => change("class", e.target.value)} spellCheck={false} />
          </label>
          {STYLE_PROPS.map(({ prop, label }) => (
            <label key={prop} className="props-field">
              <span>{label}</span>
              <input
                value={fields[prop] ?? ""}
                placeholder={selected.el.ownerDocument.defaultView?.getComputedStyle(selected.el).getPropertyValue(prop) ?? ""}
                onChange={(e) => change(prop, e.target.value)}
                spellCheck={false}
              />
            </label>
          ))}
          <button
            className="stage-editor-btn"
            onClick={() => {
              selected.el.removeAttribute("data-isocan-selected");
              setSelected(null);
            }}
            title="Deselect (Esc)"
          >
            ✕
          </button>
        </div>
      )}
      {unreadable ? (
        <div className="page-note">{unreadable}</div>
      ) : source === null ? (
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
