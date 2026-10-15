import { useEffect, useMemo, useRef, useState } from "react";
import type { Actor } from "@isocan/core";
import { readBackOf, rippleAsk, rippleAsked, rippleAt, ripplePulse, rippleRead, rippleRuns, rippleVersions, type PulseTick, type RippleRead } from "@isocan/core/ripple";
import { canEditNow } from "../lib/capability.ts";
import { readRippleTexts, rippleText } from "../lib/rippletexts.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import "./ripple.css";

/**
 * **The project pulse** (proactive-agent phase 6, design §8): a row of ticks
 * in the top bar, one per screen — current, behind, in conflict — the quiet
 * proof that nothing was left behind when one screen moved. Derived on every
 * read from core's `ripplePulse`, like the wireframe module's *behind*, and
 * never stored; loaded lazily, and only on a canvas where some screen has
 * more than one version, so a first visit pays a selector and an import.
 *
 * It is also where a run **settles**: a person's own run of edits, quiet for
 * `RIPPLE_QUIET_MS`, is asked about once — the ordinary summons to the
 * canvas's lead (`rippleAsk`), from this person's client, as the brief card's
 * re-read is. With nobody to answer, nothing is posted; the strip and the
 * panel still show the deterministic half and say the read-back waits.
 *
 * Clicking it opens the ripple panel for the run the strip is about.
 */
export default function RipplePulse({ canvasId, actor }: { canvasId: string; actor: Actor }) {
  const canvas = useCanvasStore((s) => s.canvas);
  const [now, setNow] = useState(() => Date.now());
  const [, setRead] = useState(0);
  const asked = useRef(new Set<string>());

  const runs = useMemo(() => (canvas ? rippleRuns(canvas, now) : []), [canvas, now]);
  const settled = runs.filter((r) => r.settled);

  // Wake when the next run settles: never over a run of edits, and no sooner.
  const next = Math.min(...runs.filter((r) => !r.settled).map((r) => r.settlesAt));
  useEffect(() => {
    if (!Number.isFinite(next)) return;
    const t = setTimeout(() => setNow(Date.now()), Math.max(0, next - Date.now()) + 250);
    return () => clearTimeout(t);
  }, [next]);

  // The words the settled runs need, read once.
  const needed = canvas ? rippleVersions(canvas, settled) : [];
  const key = needed.map((v) => v.blobHash).join(",");
  useEffect(() => {
    if (!canvas || !key) return;
    let live = true;
    void readRippleTexts(canvasId, needed).then((any) => live && any && setRead((n) => n + 1));
    return () => { live = false; };
    // `key` names exactly the versions; the array itself is rebuilt each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasId, key]);

  const reads: RippleRead[] = canvas
    ? settled.flatMap((run) => {
        const r = rippleRead(canvas, run, rippleText, readBackOf(canvas, rippleAt(run))?.exceptions ?? []);
        return r ? [r] : [];
      })
    : [];
  const ticks: PulseTick[] = canvas ? ripplePulse(canvas, reads) : [];

  // The settle: this person's own run, with something to carry across, asked once.
  const due = reads.find((r) => r.run.by.id === actor.id && !r.off && r.changes.length && r.screens.length && canvas && !rippleAsked(canvas, r.at) && !asked.current.has(r.at));
  useEffect(() => {
    if (!due || !canEditNow()) return;
    asked.current.add(due.at);
    void (async () => {
      const { goodnightLead } = await import("../lib/goodnight.ts");
      const found = await goodnightLead(canvasId, actor.id).catch(() => null);
      if (!found?.lead || found.cannot) return;
      const fresh = useCanvasStore.getState().canvas;
      if (!fresh || rippleAsked(fresh, due.at)) return;
      const { postToMain } = await import("../lib/mainthread.ts");
      await postToMain(canvasId, actor, rippleAsk(found.lead, due), [due.source.itemId]).catch(() => undefined);
    })();
  }, [due, canvasId, actor]);

  if (!reads.length && !ticks.some((t) => t.state !== "current")) return null;
  const count = (s: PulseTick["state"]) => ticks.filter((t) => t.state === s).length;
  const about = reads[0];
  const open = (itemId: string | undefined) => {
    if (!itemId) return;
    void import("./RipplePanel.tsx").then((m) => m.openRipple({ canvasId, actor, itemId }));
  };
  const sourceOf = (t: PulseTick) => reads.find((r) => r.source.itemId === t.itemId || r.screens.some((s) => s.itemId === t.itemId))?.source.itemId;
  const words = `${count("current")} current · ${count("behind")} behind · ${count("conflict")} in conflict`;
  return <div className="ripple-pulse" data-ripple-pulse role="group" aria-label={`Canvas pulse: ${words}`}>
    <button className="ripple-pulse-label" data-ripple-pulse-open onClick={() => open(about?.source.itemId)} title={about ? `Ripple from “${about.source.title}”` : "Ripple"}>Pulse</button>
    {ticks.map((t) => <button
      key={t.itemId}
      className={`ripple-tick ${t.state}`}
      data-ripple-tick={t.itemId}
      data-state={t.state}
      aria-label={`${t.title}: ${t.state === "conflict" ? "in conflict" : t.state}${t.why ? ` — ${t.why}` : ""}`}
      title={`${t.title}: ${t.state === "conflict" ? "in conflict" : t.state}${t.why ? ` — ${t.why}` : ""}`}
      onClick={() => open(sourceOf(t) ?? about?.source.itemId)}
    />)}
    <span className="ripple-pulse-words">{words}</span>
  </div>;
}
