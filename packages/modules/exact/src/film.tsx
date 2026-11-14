/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { newCommentId, newThreadId, type RendererFacts } from "@isocan/core";
import { EXACT_PROPS } from "./core.ts";
import { changedKeys, clampMoment, commentAt, filmSpan, frameAt, momentOf, parseFilm, parseFrames, splitApng, type FrameState } from "./film.ts";
import { exactCanvas, useExactStore } from "./live.tsx";
import { scrubTo, useScrub } from "./scrub.ts";

/**
 * **A film, scrubbed** (exact phase 4; design §8). The strip is an ordinary
 * animated PNG — any image view plays it — and this draws it as a scrubber:
 * the APNG split into its frames once per blob (`splitApng`), a slider over
 * the film's own clock in milliseconds, the frame drawn at or before that
 * moment, and under it the component's state at that frame (`exact.frames`)
 * with what moved since the frame before. A comment made here carries the
 * moment as core's `at` (motion's shape); each such comment is a mark on the
 * slider, and opening one scrubs the strip back to it (`scrub.ts`).
 */

const strips = new Map<string, Promise<string[] | null>>();

/** The strip's frames as image URLs, split once per blob; null when it is not a strip this can split (it then plays). */
function useStrip(blobHash: string, url: string): { frames: string[] | null; ready: boolean; problem: string | null } {
  const [got, setGot] = useState<{ hash: string; frames: string[] | null; problem: string | null } | null>(null);
  useEffect(() => {
    let live = true;
    let p = strips.get(blobHash);
    if (!p) {
      p = fetch(url)
        .then((r) => { if (!r.ok) throw new Error(`the strip answered ${r.status}`); return r.arrayBuffer(); })
        .then((buf) => splitApng(new Uint8Array(buf))?.map((png) => URL.createObjectURL(new Blob([png as BlobPart], { type: "image/png" }))) ?? null);
      strips.set(blobHash, p);
      p.catch(() => strips.delete(blobHash));
    }
    p.then((frames) => { if (live) setGot({ hash: blobHash, frames, problem: null }); }, (err: unknown) => { if (live) setGot({ hash: blobHash, frames: null, problem: err instanceof Error ? err.message : String(err) }); });
    return () => { live = false; };
  }, [blobHash, url]);
  return got && got.hash === blobHash ? { frames: got.frames, ready: true, problem: got.problem } : { frames: null, ready: false, problem: null };
}

const short = (v: unknown): string => {
  const text = typeof v === "string" ? JSON.stringify(v) : JSON.stringify(v) ?? String(v);
  return text.length > 90 ? `${text.slice(0, 87)}…` : text;
};

function StateRows({ frame, before }: { frame: FrameState | undefined; before: FrameState | undefined }) {
  if (!frame) return <p className="exact-note">No state for this frame.</p>;
  const moved = new Set(changedKeys(before, frame));
  const slots = Object.entries(frame.slots ?? {});
  const derives = Object.entries(frame.derives ?? {});
  return (
    <div className="exact-film-state" aria-label="State at this frame">
      {frame.watch && (
        <p className="exact-film-watch" data-exact-watch={JSON.stringify(frame.watch.style)}>
          <code>{frame.watch.testId}</code> {Object.entries(frame.watch.style).map(([k, v]) => `${k} ${v}`).join(" · ") || "no animated values"}
          {frame.watch.box ? ` · y ${Math.round(frame.watch.box.y * 10) / 10}` : ""}
        </p>
      )}
      <ul className="exact-rows">
        {slots.map(([k, v]) => <li key={k} className={moved.has(k) ? "exact-film-moved" : ""}><span>{k}</span> <code>{short(v)}</code></li>)}
      </ul>
      {derives.length > 0 && (
        <details>
          <summary>derives{[...moved].some((m) => m.startsWith("derive ")) ? " (moved)" : ""}</summary>
          <ul className="exact-rows">
            {derives.map(([k, v]) => <li key={k} className={moved.has(`derive ${k}`) ? "exact-film-moved" : ""}><span>{k}</span> <code>{short(v)}</code></li>)}
          </ul>
        </details>
      )}
    </div>
  );
}

export function FilmStrip(facts: RendererFacts) {
  const { item, url, blobHash, filename } = facts;
  useExactStore();
  const film = useMemo(() => parseFilm(item?.properties?.[EXACT_PROPS.film]), [item?.properties?.[EXACT_PROPS.film]]);
  const frames = useMemo(() => parseFrames(item?.properties?.[EXACT_PROPS.frames]), [item?.properties?.[EXACT_PROPS.frames]]);
  const strip = useStrip(blobHash, url);
  const itemId = item?.id ?? "";
  const scrubbed = useScrub(itemId);
  const [playing, setPlaying] = useState(false);
  const [text, setText] = useState("");
  const [said, setSaid] = useState<string | null>(null);
  const raf = useRef<number | null>(null);

  const span = film ? filmSpan(film) : { min: 0, max: 0 };
  const ms = film ? clampMoment(film, scrubbed ?? span.min) : 0;
  const index = film ? frameAt(film, ms) : 0;

  // Play: the film's own clock against the wall's, from where it is scrubbed to the end.
  useEffect(() => {
    if (!playing || !film) return;
    const startWall = performance.now();
    const startMs = ms >= span.max ? span.min : ms;
    const tick = () => {
      const t = startMs + (performance.now() - startWall);
      scrubTo(itemId, clampMoment(film, t));
      if (t >= span.max) { setPlaying(false); return; }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current !== null) cancelAnimationFrame(raf.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  if (!item || !film) return <img className="img-view" src={url} alt={filename} draggable={false} />;
  const canvas = exactCanvas();
  const threads = canvas && canvas.id === facts.canvasId ? Object.values(canvas.contents.threads ?? {}).filter((t) => t.anchorItemId === item.id) : [];
  const marks = threads.flatMap((t) => t.comments.filter((c) => c.at !== undefined).slice(0, 1).map((c) => ({ thread: t.id, ms: momentOf(c.at!), body: c.body })));
  const spanMs = Math.max(1, span.max - span.min);
  const shown = strip.frames?.[index] ?? null;
  const frame = frames?.[index];
  const before = index > 0 ? frames?.[index - 1] : undefined;
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div className="exact-film" data-exact-film={item.id} data-exact-at={ms} data-exact-frame={index} data-exact-frames={strip.frames?.length ?? 0} data-exact-frame-at={film.at[index]}>
      <div className="exact-film-stage">
        {/* The frame at this moment; while the strip is being split (or cannot be), the strip itself, playing. */}
        <img className="img-view" src={shown ?? url} alt={`${filename} — ${ms} ms`} draggable={false} />
      </div>
      <div className="exact-film-foot" onPointerDown={stop}>
        <div className="exact-film-scrub">
          <button type="button" className="exact-chip" onClick={() => setPlaying(!playing)} disabled={!strip.frames}>{playing ? "Pause" : "Play"}</button>
          <div className="exact-film-track">
            <input
              type="range"
              min={span.min}
              max={span.max}
              step={1}
              value={ms}
              disabled={!strip.frames}
              aria-label="Scrub the film"
              aria-valuetext={`${ms} ms`}
              onChange={(e) => { setPlaying(false); scrubTo(item.id, Number(e.target.value)); }}
            />
            {/* A comment at a moment is a mark on the track; pressing it scrubs there. */}
            {marks.map((m) => (
              <button key={m.thread} type="button" className="exact-film-mark" style={{ left: `${((m.ms - span.min) / spanMs) * 100}%` }} title={`${m.ms} ms — ${m.body.split("\n")[0]}`} data-exact-mark={m.ms} onClick={() => { setPlaying(false); scrubTo(item.id, m.ms); }} />
            ))}
          </div>
        </div>
        <p className="exact-note exact-film-time">
          <strong>{ms} ms</strong> · frame {index + 1} of {film.steps}{film.at[index] !== ms ? `, drawn at ${film.at[index]} ms` : ""} · {film.every} ms a frame on Exact's clock
          {strip.ready && !strip.frames && <span className="exact-problem"> · {strip.problem ?? "this strip cannot be split into frames, so it plays"}</span>}
        </p>
        {frames ? <StateRows frame={frame} before={before} /> : <p className="exact-note">No state was read with this film.</p>}
        <form
          className="exact-comment"
          onSubmit={(e) => {
            e.preventDefault();
            const body = text.trim();
            if (!body || !canvas || canvas.id !== facts.canvasId) { if (!canvas) setSaid("the canvas is not ready to comment from here"); return; }
            const x = Math.round(((ms - span.min) / spanMs) * (item.width - 24)) + 12;
            void canvas.send([{ type: "thread.create", threadId: newThreadId(), x, y: Math.round(item.height - 24), anchorItemId: item.id, comment: { id: newCommentId(), body, at: commentAt(ms) } }])
              .then(() => { setText(""); setSaid(`commented at ${ms} ms`); }, (err: unknown) => setSaid(err instanceof Error ? err.message : String(err)));
          }}
        >
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={`Comment at ${ms} ms…`} aria-label="Comment at this moment" rows={1} />
          <button type="submit" className="exact-chip" disabled={!text.trim()}>Comment at {ms} ms</button>
        </form>
        {said && <p className="exact-note" role="status">{said}</p>}
      </div>
    </div>
  );
}
