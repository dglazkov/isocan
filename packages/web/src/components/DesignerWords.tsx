import { useEffect, useMemo, useState } from "react";
import { designWordSpans, glossaryTerms, tasteNote, type Actor } from "@isocan/core";
import { designerSentence, offerVague, vagueWords, vocabulary } from "@isocan/core/vague-words";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { fetchBlobText } from "../lib/blobtext.ts";
import "./proposal-marks.css";

/**
 * **Say it like a designer** (proactive-agent phase 10, design §12): the
 * Chat composer's other half, loaded on the first keystroke so the list of
 * vague words and their readings never ride the first paint.
 *
 * While the person types, only the words an agent could read more than one
 * way are underlined (the field's backdrop draws them, from `marks`), and
 * this card shows each one's three readings and the sentence a designer
 * would say. **Nothing here ever holds the send**: Tab takes the designer's
 * sentence, Enter sends the person's own words untouched, and a reading they
 * picked rides with the message as data (`Comment.readings`). The readings
 * are words, not drawings: drawing three takes on the person's own screen is
 * the lead's work through an ordinary ask, and it waits (Dion to confirm).
 */

/** What the Chat needs back: what to underline, what Tab takes, and what Enter carries. */
type SayState = { marks: { start: number; end: number }[]; sentence: string | null; readings: { word: string; reading: string }[] };

/** *When I am vague*, per viewer (the chat-place rule: a viewer's preference, not a fact about the canvas). */
const WHEN_KEY = "isocan.vague";
/** Whether this viewer opted in to the count of asks that needed no translation. Off unless they say. */
const COUNT_KEY = "isocan.vague.count";

function stored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function store(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // A private window: the choice lasts as long as the page.
  }
}
const whenNow = (): "fading" | "always" | "never" => {
  const v = stored(WHEN_KEY);
  return v === "always" || v === "never" ? v : "fading";
};

export default function DesignerWords({
  draft,
  actor,
  onState,
  onVocabulary,
}: {
  draft: string;
  actor: Actor;
  onState: (state: SayState | null) => void;
  onVocabulary: () => void;
}) {
  const canvas = useCanvasStore((s) => s.canvas);
  const threads = canvas?.threads;
  const [picks, setPicks] = useState<Record<string, string>>({});
  const when = whenNow();
  // The asks only change when a comment lands, not on every keystroke.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const offer = useMemo(() => (canvas ? offerVague(when, canvas, actor.id) : false), [threads, when, actor.id]);
  const spans = useMemo(() => (offer ? vagueWords(draft) : []), [draft, offer]);
  const sentence = useMemo(() => (spans.length ? designerSentence(draft, picks) : null), [spans, draft, picks]);
  const words = spans.filter((s, i) => spans.findIndex((o) => o.word === s.word) === i);
  const key = JSON.stringify([spans.map((s) => [s.start, s.end]), sentence, picks]);

  useEffect(() => {
    if (spans.length === 0) return onState(null);
    onState({
      marks: spans.map(({ start, end }) => ({ start, end })),
      sentence,
      readings: words.filter((w) => picks[w.word]).map((w) => ({ word: w.word, reading: picks[w.word]! })),
    });
    // `key` is the whole of what this says.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => () => onState(null), [onState]);

  if (spans.length === 0) return null;
  return (
    <div className="designer-words" role="group" aria-label="Words that read more than one way">
      {words.map((span) => {
        const picked = span.readings.find((r) => r.name === picks[span.word]);
        return (
          <div className="designer-word" key={span.word} data-vague-word={span.word}>
            <span className="designer-said">{span.said}</span>
            <span className="designer-readings" role="radiogroup" aria-label={`“${span.said}” reads three ways`}>
              {span.readings.map((r) => (
                <button
                  type="button"
                  role="radio"
                  key={r.name}
                  aria-checked={picked?.name === r.name}
                  data-reading={r.name}
                  title={r.means}
                  // Keep the caret in the field: a pick is a glance, not a detour.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setPicks((p) => (p[span.word] === r.name ? omit(p, span.word) : { ...p, [span.word]: r.name }))}
                >
                  {r.name}
                </button>
              ))}
            </span>
            {picked && <span className="designer-means">{picked.means}</span>}
          </div>
        );
      })}
      {sentence && (
        <p className="designer-say" data-designer-sentence>
          <kbd>Tab</kbd> A designer would say “{sentence}”
        </p>
      )}
      <p className="designer-foot">
        Enter sends your words as they are.{" "}
        <button type="button" className="designer-link" onMouseDown={(e) => e.preventDefault()} onClick={onVocabulary}>
          Your vocabulary
        </button>
      </p>
    </div>
  );
}

function omit(p: Record<string, string>, word: string): Record<string, string> {
  const { [word]: _gone, ...rest } = p;
  return rest;
}

/**
 * **Your design vocabulary** (design §12): the design words you now use, the
 * ones you have seen here and not used, and your own words the agent has
 * learned — the taste note's quoted lines. Lists, never a score; the count
 * of asks that needed no translation shows only to somebody who asks for it.
 * And the one setting: *when I am vague*.
 */
export function Vocabulary({ canvasId, actor, onClose }: { canvasId: string; actor: Actor; onClose: () => void }) {
  const canvas = useCanvasStore((s) => s.canvas);
  const note = canvas ? tasteNote(canvas) : null;
  const hash = note?.versions.find((v) => v.id === note.currentVersionId)?.blobHash ?? null;
  const [taste, setTaste] = useState<string | null>(null);
  const [when, setWhen] = useState(whenNow);
  const [count, setCount] = useState(() => stored(COUNT_KEY) === "1");
  useEffect(() => {
    if (!hash) return setTaste(null);
    let live = true;
    void fetchBlobText(canvasId, hash).then((t) => live && setTaste(t), () => live && setTaste(null));
    return () => {
      live = false;
    };
  }, [canvasId, hash]);
  const v = useMemo(() => (canvas ? vocabulary(canvas, actor.id, taste, glossaryTerms()) : null), [canvas, actor.id, taste]);
  if (!v) return null;
  const define = (term: string) => designWordSpans(term).find((s) => s.word)?.word?.means;
  const choose = (next: "fading" | "always" | "never") => {
    setWhen(next);
    store(WHEN_KEY, next === "fading" ? null : next);
  };
  return (
    <section className="vocabulary" aria-label="Your design vocabulary" data-vocabulary>
      <header>
        <b>Your design vocabulary</b>
        <button type="button" className="designer-link" aria-label="Close your vocabulary" onClick={onClose}>
          ✕
        </button>
      </header>
      <h4>Words you now use</h4>
      <p data-vocabulary-use>{v.use.length ? v.use.map((t) => <span key={t} title={define(t)}>{t}</span>) : <i>None yet — they arrive as you use them.</i>}</p>
      <h4>Seen here, not yet yours</h4>
      <p data-vocabulary-seen>{v.seen.length ? v.seen.map((t) => <span key={t} title={define(t)}>{t}</span>) : <i>Nothing new on this canvas.</i>}</p>
      <h4>Your words the agent learned</h4>
      {v.learned.length ? (
        <ul data-vocabulary-learned>
          {v.learned.map((w) => (
            <li key={w.said}>
              <b>“{w.said}”</b> {w.means}
            </li>
          ))}
        </ul>
      ) : (
        <p data-vocabulary-learned>
          <i>None yet. When you name something your way, the agent notes it in “What your deletes taught”.</i>
        </p>
      )}
      <fieldset>
        <legend>When I am vague</legend>
        {(
          [
            ["fading", "Offer readings until my asks are sharp"],
            ["always", "Always offer readings"],
            ["never", "Never — leave my words alone"],
          ] as const
        ).map(([value, label]) => (
          <label key={value}>
            <input type="radio" name="vague-when" checked={when === value} onChange={() => choose(value)} /> {label}
          </label>
        ))}
        <label>
          <input
            type="checkbox"
            checked={count}
            onChange={(e) => {
              setCount(e.target.checked);
              store(COUNT_KEY, e.target.checked ? "1" : null);
            }}
          />{" "}
          Show how many of my asks needed no translation
        </label>
      </fieldset>
      {count && (
        <p data-vocabulary-count>
          {v.sharp.plain} of your last {v.sharp.asks} asks here needed no translation.
        </p>
      )}
      <p className="designer-foot">Nothing here is a grade. Keeping your own words is always fine.</p>
    </section>
  );
}
