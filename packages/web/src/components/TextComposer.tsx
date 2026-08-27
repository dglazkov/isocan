import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Actor } from "@isocan/core";
import { TEXT_SIZE, TEXT_WIDTH } from "@isocan/core";
import { useUiStore } from "../stores/uiStore.ts";
import { setNotice } from "../stores/canvasStore.ts";
import { addTextNode, reviseTextNode, textCommit } from "../lib/text.ts";

/**
 * The Text tool's one moment: a textarea sitting in world space exactly where
 * the words will be, at exactly the size they will be.
 *
 * It lives INSIDE `.world` rather than floating over the canvas as a dialog,
 * and that is the whole feel of the tool — you are typing onto the canvas,
 * not into a box that will later put something on the canvas. The type size,
 * the width and the line height are the same constants the committed node
 * renders with (`core/textnode.ts`), so nothing jumps when it lands.
 *
 * Committing is blur or ⌘/Ctrl+Enter; Escape abandons. Enter is a newline,
 * because this is prose: a tool for typing a paragraph onto a canvas cannot
 * spend its Return key on submission.
 */
export function TextComposer({ canvasId, actor }: { canvasId: string; actor: Actor }) {
  const pending = useUiStore((s) => s.pendingText);
  const setPendingText = useUiStore((s) => s.setPendingText);
  const [body, setBody] = useState(pending?.body ?? "");
  const area = useRef<HTMLTextAreaElement | null>(null);
  // Committing is reachable from two paths that can both fire for one act —
  // ⌘Enter moves focus, which is also a blur. Without this the same words
  // land twice, as two items.
  const done = useRef(false);
  // The click-outside listener is installed once per composer, but it must
  // commit the LATEST words — so it calls through a ref rather than closing
  // over the body it saw when it subscribed.
  const commitRef = useRef<() => Promise<void>>(async () => {});

  // A composer opened at a new spot is a NEW composer: reset, don't inherit
  // the last one's words. Keyed on the identity of what is being typed.
  const key = pending ? `${pending.itemId ?? "new"}:${pending.x},${pending.y}` : null;
  useEffect(() => {
    setBody(pending?.body ?? "");
    done.current = false;
  }, [key]);

  useLayoutEffect(() => {
    if (!pending) return;
    const el = area.current;
    if (!el) return;
    el.focus();
    // An edit opens with the caret at the END of what is already there, which
    // is where somebody who wants to add a sentence is going. Select-all would
    // put one keystroke between them and losing the lot.
    el.setSelectionRange(el.value.length, el.value.length);
  }, [key]);

  // Grow with the words: the box the person types in is the box that commits.
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [body, key]);

  /**
   * Clicking away commits — and it has to be a POINTER listener, not `blur`.
   * The canvas calls `preventDefault` on its own presses (that is what stops
   * a marquee drag selecting text), which also means pressing on the canvas
   * never moves focus, so the textarea never blurs. Waiting for a blur that
   * cannot arrive is a composer you can only close with the keyboard.
   *
   * `blur` stays as well, for the ways focus leaves that a canvas press is
   * not: another window, another tab, the address bar. `done` makes the two
   * paths idempotent, since one gesture can be both.
   */
  useEffect(() => {
    if (!pending) return;
    function onDown(e: PointerEvent) {
      const el = area.current;
      if (el && e.target instanceof Node && el.contains(e.target)) return;
      void commitRef.current();
    }
    // Capture, because the canvas stops these on the way down.
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [key]);

  if (!pending) return null;

  const width = pending.width ?? TEXT_WIDTH;

  async function commit() {
    if (done.current) return;
    const at = pending!;
    done.current = true;
    setPendingText(null);
    // The rules for what a close means live in `lib/text.ts`, where they are
    // named and tested — this only carries them out.
    const decision = textCommit(body, at.body, at.itemId !== null);
    if (decision.do === "nothing") return;
    const words = decision.body;
    const measured = {
      width,
      height: Math.max(TEXT_SIZE * 2, Math.round(area.current?.scrollHeight ?? TEXT_SIZE * 2)),
    };
    try {
      if (at.itemId) {
        const grew = measured.height > (at.height ?? 0);
        await reviseTextNode(canvasId, actor, at.itemId, words, measured, grew);
      } else {
        await addTextNode(canvasId, actor, words, { x: at.x, y: at.y }, measured);
      }
    } catch (err) {
      // The words are gone from the screen by now, so say what they were:
      // a failed daemon must not silently eat a sentence somebody wrote.
      setNotice(`Could not place that text: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  commitRef.current = commit;

  return (
    <div className="text-composer" style={{ left: pending.x, top: pending.y, width }}>
      <textarea
        ref={area}
        value={body}
        placeholder="Type…"
        spellCheck
        onChange={(e) => setBody(e.target.value)}
        onBlur={() => void commit()}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation(); // canvas shortcuts are not spelling
          if (e.key === "Escape") {
            done.current = true;
            setPendingText(null);
          } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void commit();
          }
        }}
      />
    </div>
  );
}
