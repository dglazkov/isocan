import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Actor } from "@isocan/core";
import {
  TEXT_FACES,
  TEXT_FACE_STACK,
  TEXT_COLUMN,
  TEXT_FACE_SCALE,
  TEXT_SIZE,
  TEXT_STYLES,
  TEXT_STYLE_SIZE,
  TEXT_WIDTH,
  type TextFace,
  type TextStyle,
} from "@isocan/core";
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
  // The WHOLE composer, toolbar included — see the click-outside effect.
  const box = useRef<HTMLDivElement | null>(null);
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

  /**
   * **Measure the words, do not guess at them.**
   *
   * The box has to fit two things that both change: the step (a title is four
   * times the type) and the face (Caveat is not the width of a UI sans). The
   * first version grew the textarea's height from its own `scrollHeight` and
   * watched only `[body, key]` — so switching from body to title left the box
   * at the old height and clipped the words, which is what was reported.
   *
   * A hidden mirror carrying the SAME typography answers both questions at
   * once. `width: max-content` up to the column gives a three-word title a
   * three-word box instead of the full column, and its height is the exact
   * height those words wrap to. What is measured is what commits, so nothing
   * moves at the moment it lands.
   */
  // Read above the early return, because the measuring effect below is a
  // hook and hooks cannot sit under one (React #310, learned the hard way in
  // ArtifactStage). The defaults are only ever used on the render where
  // there is no composer, and that render draws nothing.
  const style = pending?.style ?? "body";
  const face = pending?.face ?? "sans";
  const mirror = useRef<HTMLDivElement | null>(null);
  const [fit, setFit] = useState({ width: TEXT_WIDTH, height: TEXT_SIZE * 2 });
  useLayoutEffect(() => {
    const el = mirror.current;
    if (!el) return;
    // A floor, so an empty composer is still a thing you can see and click.
    const width = Math.max(TEXT_STYLE_SIZE[style] * 6, Math.ceil(el.offsetWidth));
    setFit({ width: Math.min(TEXT_COLUMN[style], width), height: Math.ceil(el.offsetHeight) });
  }, [body, key, style, face]);

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
      // Outside the COMPOSER, not outside the textarea. The step and face
      // buttons sit in the same box and are not "away" — testing only the
      // textarea made choosing a size commit and close, so the one control
      // that changes how the words look could never be used on them.
      const el = box.current;
      if (el && e.target instanceof Node && el.contains(e.target)) return;
      void commitRef.current();
    }
    // Capture, because the canvas stops these on the way down.
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [key]);

  if (!pending) return null;

  // `hand` is drawn larger to hold the ladder's promise — see TEXT_FACE_SCALE.
  const size = Math.round(TEXT_STYLE_SIZE[style] * TEXT_FACE_SCALE[face]);
  const width = fit.width;

  /** Change the step or face mid-sentence, without losing the sentence. */
  function restyle(next: { style?: TextStyle; face?: TextFace }) {
    const ui = useUiStore.getState();
    const at = ui.pendingText;
    if (!at) return;
    const style2 = next.style ?? at.style;
    const face2 = next.face ?? at.face;
    ui.setPendingText({
      ...at,
      style: style2,
      face: face2,
      body,
      // A NEW node's column follows its step; an existing one keeps its box.
      ...(at.itemId ? {} : { width: TEXT_COLUMN[style2] }),
    });
    ui.setLastText(style2, face2);
    area.current?.focus();
  }

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
    // What was measured IS what commits — the mirror rendered these words at
    // this step and this face, so the node lands the shape it looked.
    const measured = { width: fit.width, height: fit.height };
    try {
      if (at.itemId) {
        const grew = measured.height > (at.height ?? 0);
        await reviseTextNode(canvasId, actor, at.itemId, words, measured, grew, at.style, at.face);
      } else {
        await addTextNode(
          canvasId,
          actor,
          words,
          { x: at.x, y: at.y },
          measured,
          at.style,
          at.face,
        );
      }
    } catch (err) {
      // The words are gone from the screen by now, so say what they were:
      // a failed daemon must not silently eat a sentence somebody wrote.
      setNotice(`Could not place that text: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  commitRef.current = commit;

  return (
    <div
      className="text-composer"
      ref={box}
      style={{ left: pending.x, top: pending.y, width }}
    >
      {/* The controls sit WITH the words, not on the selection, because size
          and face are things you decide while writing — and because the
          composer already renders at the size it will commit at, so the
          choice is previewed by the thing you are typing into. */}
      <div className="text-style-bar" onPointerDown={(e) => e.preventDefault()}>
        {TEXT_STYLES.map((s) => (
          <button
            key={s}
            className={`text-style-btn text-style-step${s === style ? " on" : ""}`}
            title={`${s} — readable down to ${Math.ceil((8 / TEXT_STYLE_SIZE[s]) * 100)}% zoom`}
            onClick={() => restyle({ style: s })}
          >
            {s[0]!.toUpperCase()}
          </button>
        ))}
        <span className="text-style-gap" />
        {TEXT_FACES.map((f) => (
          <button
            key={f}
            className={`text-style-btn text-style-face${f === face ? " on" : ""}`}
            style={{ fontFamily: TEXT_FACE_STACK[f] }}
            title={f}
            onClick={() => restyle({ face: f })}
          >
            Aa
          </button>
        ))}
      </div>
      {/* The mirror: same type, same wrapping, no ink. `aria-hidden` because
          it is the words a second time and a reader does not need them. */}
      <div
        ref={mirror}
        className="text-composer-mirror"
        aria-hidden
        style={{
          fontSize: size,
          fontFamily: TEXT_FACE_STACK[face],
          maxWidth: TEXT_COLUMN[style],
        }}
      >
        {body === "" ? "Type…" : body}
      </div>
      <textarea
        ref={area}
        style={{ fontSize: size, fontFamily: TEXT_FACE_STACK[face], height: fit.height }}
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
