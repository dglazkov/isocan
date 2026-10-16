import { useEffect, useMemo, useRef, useState } from "react";
import type { Actor, LogEntry } from "@isocan/core";
import {
  STUCK_AXES,
  stuckAll,
  stuckAnswerBody,
  stuckAnswered,
  stuckQuestionOf,
  stuckSections,
  type StuckAnswer,
} from "@isocan/core/stuck";
import { getOplog } from "../lib/api.ts";
import { canEditNow } from "../lib/capability.ts";
import { flashNotice, useCanvasStore } from "../stores/canvasStore.ts";
import "./stuck.css";

/**
 * **Stuck** (proactive-agent phase 7, design §10): the card a person sees
 * when their last tries at one item have all missed and they have asked
 * again. Core's `stuckOn` reads it from the recent log — this client fetches
 * the tail once and then only what is new — and `stuckSections` says it, as
 * `isocan stuck` prints it.
 *
 * Before the lead's question comes it says what the behaviour shows and that
 * a question is on its way, or why it waits (with nothing to answer, the
 * detection still shows). Once it comes, the four now-and-instead pairs, the
 * lead's guess highlighted and chosen by default, and the two ways out. An
 * answer is an ordinary Chat message to the lead (`stuckAnswerBody`), which
 * summons it and starts the count again. Nothing else is written.
 *
 * Loaded lazily, and only once the person has said something recently.
 */
const LOOKBACK = 2000;

export default function StuckCard({ canvasId, actor }: { canvasId: string; actor: Actor }) {
  const canvas = useCanvasStore((s) => s.canvas);
  const lastSeq = useCanvasStore((s) => s.lastSeq);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const fetched = useRef<number | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [picks, setPicks] = useState<Record<string, "now" | "instead">>({});
  const [product, setProduct] = useState<string | null>(null);
  const [lead, setLead] = useState<{ name: string | null; cannot: string | null } | null>(null);
  const [busy, setBusy] = useState(false);

  // The log's recent tail, then only what is new: the tries fall within fifteen minutes.
  useEffect(() => {
    if (fetched.current !== null && lastSeq <= fetched.current) return;
    const ctl = new AbortController();
    const t = setTimeout(() => {
      const since = fetched.current ?? Math.max(0, lastSeq - LOOKBACK);
      void getOplog(canvasId, since, ctl.signal)
        .then((more) => {
          fetched.current = Math.max(since, ...more.map((e) => e.seq));
          setEntries((was) => {
            const seen = new Set(was.map((e) => e.seq));
            return [...was, ...more.filter((e) => !seen.has(e.seq))].slice(-LOOKBACK);
          });
        })
        .catch(() => undefined);
    }, 250);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [canvasId, lastSeq]);

  const stuck = useMemo(() => stuckAll(entries, Date.now()).find((s) => s.person.id === actor.id && s.pending) ?? null, [entries, actor.id]);
  const question = stuck && canvas ? stuckQuestionOf(canvas, stuck.at) : null;
  const answered = stuck && canvas ? stuckAnswered(canvas, stuck.at) : false;

  // Who would ask, and why the question waits — read once a reading appears.
  const at = stuck?.at ?? null;
  useEffect(() => {
    if (!at) return;
    let live = true;
    void import("../lib/goodnight.ts")
      .then(({ goodnightLead }) => goodnightLead(canvasId, actor.id))
      .then((found) => live && setLead({ name: found.lead?.name ?? null, cannot: found.cannot }))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [at, canvasId, actor.id]);

  if (!stuck || !canvas || answered || dismissed === stuck.at) return null;
  const title = canvas.items[stuck.itemId]?.title || "Untitled";
  const sections = stuckSections(stuck, title, question, question?.by.name ?? lead?.name ?? null, question ? null : lead?.cannot ?? null);
  const side = (axis: string) => picks[axis] ?? question?.tiles.find((t) => t.axis === axis)?.guess ?? "now";

  const send = async (answer: StuckAnswer) => {
    if (!canEditNow() || busy) return;
    const to = question?.by ?? null;
    if (!to) return;
    setBusy(true);
    try {
      const { postToMain } = await import("../lib/mainthread.ts");
      const sent = await postToMain(canvasId, actor, stuckAnswerBody(to, stuck.at, question, answer), [stuck.itemId]);
      if (sent.status === "refused") flashNotice(sent.message ?? "the Chat refused the answer");
    } finally {
      setBusy(false);
    }
  };

  return <section className="stuck-card" data-stuck-card={stuck.itemId} data-stuck-at={stuck.at} aria-label={`Stuck on “${title}”`}>
    <button type="button" className="stuck-close" aria-label="Close" onClick={() => setDismissed(stuck.at)}>×</button>
    {sections.map((s) => {
      if (s.key === "tiles") {
        return <div key={s.key} data-stuck-section={s.key}>
          <h4>{s.heading}</h4>
          <div className="stuck-tiles">
            {STUCK_AXES.map((a) => {
              const t = question!.tiles.find((x) => x.axis === a.id);
              if (!t) return null;
              return <div key={a.id} className="stuck-tile" data-stuck-tile={a.id} role="radiogroup" aria-label={a.name}>
                <div className="stuck-axis">{a.name}</div>
                <div className="stuck-sides">
                  {(["now", "instead"] as const).map((k) => <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={side(a.id) === k}
                    className={`stuck-side${t.guess === k ? " guess" : ""}${side(a.id) === k ? " picked" : ""}`}
                    data-stuck-side={k}
                    data-guess={t.guess === k ? "" : undefined}
                    onClick={() => setPicks((p) => ({ ...p, [a.id]: k }))}
                  >
                    <span className="stuck-side-label">{k === "now" ? "Now" : "Instead"}{t.guess === k && <em className="stuck-guess"> · my guess</em>}</span>
                    <span>{k === "now" ? t.now : t.instead}</span>
                  </button>)}
                </div>
              </div>;
            })}
          </div>
        </div>;
      }
      if (s.key === "ways") {
        return <div key={s.key} className="stuck-acts" data-stuck-section={s.key}>
          <button type="button" className="btn primary" disabled={busy} data-stuck-answer onClick={() => void send({ kind: "tiles", picks: STUCK_AXES.map((a) => ({ axis: a.id, side: side(a.id) })) })}>Answer</button>
          <button type="button" className="btn secondary" disabled={busy} data-stuck-extremes onClick={() => void send({ kind: "extremes" })}>Show me extremes</button>
          {product === null
            ? <button type="button" className="btn secondary" disabled={busy} data-stuck-product onClick={() => setProduct("")}>Name a product that gets it right</button>
            : <form className="stuck-product" onSubmit={(e) => { e.preventDefault(); if (product.trim()) void send({ kind: "product", name: product }); }}>
                <input autoFocus aria-label="A product that gets it right" placeholder="A product that gets it right" value={product} onChange={(e) => setProduct(e.target.value)} />
                <button type="submit" className="btn secondary" disabled={busy || !product.trim()}>Send</button>
              </form>}
        </div>;
      }
      return <div key={s.key} data-stuck-section={s.key}>
        {s.key === "guessing" ? <h3>{s.heading}</h3> : <h4>{s.heading}</h4>}
        <ul className={s.key === "waits" ? "stuck-list stuck-quiet" : "stuck-list"}>{s.lines.map((l) => <li key={l.text}>{l.text}</li>)}</ul>
      </div>;
    })}
  </section>;
}
