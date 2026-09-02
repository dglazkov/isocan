import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
  Paper, Actor } from "@isocan/core";
import {
  TEXT_FACES,
  TEXT_FACE_STACK,
  TEXT_COLUMN,
  TEXT_COLUMN_MAX,
  TEXT_FACE_SCALE,
  TEXT_SIZE,
  TEXT_STYLES,
  TEXT_STYLE_SIZE,
  TEXT_WIDTH,
  type TextFace,
  type TextStyle,
  PAPERS,
  PAPER_SIZE,
} from "@isocan/core";
import { useUiStore } from "../stores/uiStore.ts";
import { setNotice } from "../stores/canvasStore.ts";
import { addTextNode, restyleTextNode, reviseTextNode, textCommit } from "../lib/text.ts";

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
  // Set when a composer opens, cleared once its words are in the field and
  // the caret has been placed — see the focus effect for why that is not
  // the same render.
  const placeCaret = useRef(false);
  useEffect(() => {
    setBody(pending?.body ?? "");
    done.current = false;
    placeCaret.current = true;
    // `key` is the dependency ON PURPOSE and `pending.body` must NOT be one:
    // the body is what the person is typing, and re-running this on it would
    // reset the field back to the opening text under their hands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  /**
   * Focus, and place the caret — once per composer, and only once the words
   * are actually IN the field.
   *
   * The component stays mounted between composers, so on open the field
   * still holds the last draft for one render while the effect above swaps
   * the words in. Keyed on `key` alone this ran during that render: it
   * selected the stale value, the real words then landed, and the browser
   * put the caret at their end — a select-all that never showed. So it
   * watches `body` too, and acts only on the render where the field holds
   * the words it opened on; `placeCaret` is what keeps it from running
   * again per keystroke and dragging the caret about mid-sentence.
   *
   * Re-opening a node selects its words, the way the rename field selects
   * the name: the common edit is to say it differently, and a selection is
   * one keystroke from that. The first version put the caret at the end to
   * protect against typing over the lot; it was asked for the other way,
   * and the textarea's own ⌘Z brings the words back if a keystroke does
   * land on them. A NEW composer is empty, so there is nothing to select.
   */
  useLayoutEffect(() => {
    if (!pending || !placeCaret.current) return;
    const el = area.current;
    if (!el || el.value !== (pending.body ?? "")) return;
    placeCaret.current = false;
    el.focus();
    if (pending.itemId) el.select();
    else el.setSelectionRange(el.value.length, el.value.length);
  }, [key, body, pending]);

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
  const paper = pending?.paper ?? null;
  const mirror = useRef<HTMLDivElement | null>(null);
  const [fit, setFit] = useState({ width: TEXT_WIDTH, height: TEXT_SIZE * 2 });
  useLayoutEffect(() => {
    const el = mirror.current;
    if (!el) return;
    // A floor, so an empty composer is still a thing you can see and click.
    const width = Math.max(TEXT_STYLE_SIZE[style] * 6, Math.ceil(el.offsetWidth));
    // `TEXT_COLUMN_MAX`, not `TEXT_COLUMN`: the box grows to the right as the
    // words need it and only wraps at the hard limit. The column is still
    // what prose settles at, because that is where the mirror wraps.
    setFit({ width: Math.min(TEXT_COLUMN_MAX[style], width), height: Math.ceil(el.offsetHeight) });
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
    // Installed once per composer by design — the freshness this needs comes
    // through `commitRef`, which exists precisely so the listener commits the
    // LATEST words instead of the ones it saw when it subscribed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!pending) return null;

  // `hand` is drawn larger to hold the ladder's promise — see TEXT_FACE_SCALE.
  const size = Math.round(TEXT_STYLE_SIZE[style] * TEXT_FACE_SCALE[face]);
  /**
   * **On paper, the composer IS the note.**
   *
   * The bar above already previews the step and the face, on the stated
   * principle that "the composer renders at the size it will commit at, so
   * the choice is previewed by the thing you are typing into". Paper changes
   * the size and the colour, so it has to be previewed by the same thing or
   * the principle only half holds — you would pick yellow and go on typing
   * into a white rectangle that becomes a square note on commit.
   *
   * A NEW note is the `PAPER_SIZE` square, which is exactly what `addTextNode`
   * commits, so what is under the caret is the note. A new caption is the
   * measured words.
   *
   * An EXISTING node — paper or not — is edited on its OWN box, edge for
   * edge, the way renaming sits on the name. The first version put the
   * measured words' box over an existing caption (a short white field inside
   * the selected item) and the default square over a note somebody had made
   * taller; both read as a form over the thing rather than the thing. A
   * caption's box may still GROW downward while you type, because words that
   * wrap past the bottom would be clipped otherwise; a post-it never grows,
   * by decision (`core/textnode.ts`).
   */
  const editing = pending.itemId !== null;
  const width = paper
    ? editing ? (pending.width ?? PAPER_SIZE) : PAPER_SIZE
    : editing ? (pending.width ?? fit.width) : fit.width;
  const height = paper
    ? editing ? (pending.height ?? PAPER_SIZE) : PAPER_SIZE
    : editing ? Math.max(pending.height ?? 0, fit.height) : fit.height;

  /**
   * Change the step, face or paper mid-sentence, without losing the sentence.
   *
   * **This must not write the draft into `pending.body`.** `pending.body` is
   * the words the node HAD when the composer opened — the baseline that
   * `textCommit` compares the draft against to decide whether anything was
   * said. The first version copied the draft in here, so typing and THEN
   * picking yellow made the baseline equal the draft, the commit read
   * "unchanged", and the words were dropped on the floor — a new note lost
   * entirely, an existing one never recoloured. Reported as both. The draft
   * lives in this component's state and survives a restyle on its own,
   * because the composer's key (which node, where) does not change.
   *
   * For a node that exists, the look lands NOW as its own op — see
   * `restyleTextNode` for why a colour is not a version. For one that does
   * not exist yet there is nothing to update; the look is held in `pending`
   * and travels with the words when they commit.
   */
  function restyle(next: { style?: TextStyle; face?: TextFace; paper?: Paper | null }) {
    const ui = useUiStore.getState();
    const at = ui.pendingText;
    if (!at) return;
    const style2 = next.style ?? at.style;
    const face2 = next.face ?? at.face;
    // `undefined` is "unchanged" and `null` is "no paper", which are different
    // answers — so this asks whether the key was given, not whether it is set.
    const paper2 = "paper" in next ? (next.paper ?? null) : (at.paper ?? null);
    // A caption putting paper ON takes the square, unless it is already
    // bigger: a 320×40 post-it is a caption with a background. Taking paper
    // OFF keeps the box; ⇧F re-fits whenever somebody wants that.
    const grows =
      at.itemId && paper2 !== null && (at.paper ?? null) === null
        ? { width: Math.max(at.width ?? 0, PAPER_SIZE), height: Math.max(at.height ?? 0, PAPER_SIZE) }
        : null;
    ui.setPendingText({
      ...at,
      style: style2,
      face: face2,
      paper: paper2,
      // A NEW node's column follows its step; an existing one keeps its box,
      // except for the one restyle that changes its shape.
      ...(at.itemId ? (grows ?? {}) : { width: TEXT_COLUMN[style2] }),
    });
    ui.setLastText(style2, face2, paper2);
    area.current?.focus();
    if (at.itemId) {
      void restyleTextNode(canvasId, actor, at.itemId, style2, face2, paper2, grows).catch((err: unknown) => {
        setNotice(`Could not restyle that text: ${err instanceof Error ? err.message : String(err)}`);
      });
    }
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
    // The box under the caret IS what commits, whichever rule sized it above:
    // a new caption's measured words, a post-it's square, an existing node's
    // own box (grown downward if the words needed it). The mirror rendered
    // these words at this step and this face, so nothing moves when it lands.
    const measured = { width, height };
    try {
      if (at.itemId) {
        const grew = measured.height > (at.height ?? 0);
        await reviseTextNode(
          canvasId,
          actor,
          at.itemId,
          words,
          measured,
          grew,
          at.style,
          at.face,
          at.paper ?? null,
        );
      } else {
        await addTextNode(
          canvasId,
          actor,
          words,
          { x: at.x, y: at.y },
          measured,
          at.style,
          at.face,
          at.paper ?? null,
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
      className={`text-composer${paper ? ` on-paper paper-${paper}` : ""}`}
      ref={box}
      style={{ left: pending.x, top: pending.y, width, ...(paper ? { height } : {}) }}
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
        <span className="text-style-gap" />
        {/* Paper. The first swatch is NO paper, which is today's plain text
            node and stays the default — a caption is still the common case,
            and a picker whose first option is a colour would quietly make
            every note a sticky one. The rest mean nothing: they are paper,
            not a taxonomy (`core/textnode.ts`). */}
        {([null, ...PAPERS] as const).map((one) => (
          <button
            key={one ?? "none"}
            className={`text-style-btn text-paper${one === null ? " text-paper-none" : ` paper-${one}`}${one === paper ? " on" : ""}`}
            title={one === null ? "No paper — words on the canvas" : `${one} paper`}
            aria-label={one === null ? "No paper" : `${one} paper`}
            onClick={() => restyle({ paper: one })}
          />
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
          // An existing node's words wrap at ITS width — measuring them
          // against the column would answer a height for a box they are not
          // in. A new composer wraps at the hard limit, as before.
          maxWidth: editing && pending.width ? pending.width : TEXT_COLUMN_MAX[style],
        }}
      >
        {body === "" ? "Type…" : body}
      </div>
      <textarea
        ref={area}
        style={{ fontSize: size, fontFamily: TEXT_FACE_STACK[face], height }}
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
