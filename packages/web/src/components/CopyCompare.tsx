import { useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Actor } from "@isocan/core";
import { compareVersions, type CompareFace } from "../lib/compare.ts";
import { canEditNow } from "../lib/capability.ts";
import { copySourceOf, mixCopy, readCopyMix, type CopyMixRead } from "../lib/copymix.ts";
import { fitMeasuredOf, fitMisses, withFitProbe, type FitMiss } from "../lib/copyfit.ts";
import { flashNotice, useCanvasStore } from "../stores/canvasStore.ts";
import { Pane, Shell } from "./VersionCompare.tsx";
import "./version-compare.css";
import "./copy-compare.css";

/**
 * **Compare the copy…** — a screen and every voice of its words, side by
 * side and live, with a choice per string (copy-edit phase 3, journey scene 2).
 *
 * Opened from the item menu of the screen or of any of its voices, and loaded
 * on that click: it mounts its own root on `document.body`, as Compare
 * versions does, and draws each screen with that inspector's `Pane` — the
 * same lone `allow-scripts` frame, with what each voice changed marked inside
 * its render (core's `markSource`). Below the screens, the copy deck as rows:
 * one per string some voice says differently, the source's words and each
 * voice's as choices, the source's by default. *Use this mix* folds the picks
 * into the source as one version and sends the voices to the trash, one undo
 * (`lib/copymix.ts`, the same core path as `isocan words mix`). *All its
 * words* on a voice picks every string it changed; *Choose this variation*
 * is still the item menu's, and Compare versions'.
 *
 * **Fit** (copy-edit phase 4, journey scene 3): each frame measures its own
 * strings where it renders (`lib/copyfit.ts`), core's `copyFit` judges them
 * against their roles, and a string that does not fit is marked in its frame
 * and in its row's cell for that voice — "two lines in a one-line button".
 * The mark is a fact, not a refusal: the string can still be picked.
 */
interface CopyCompareRequest {
  canvasId: string;
  actor: Actor;
  /** The source screen, or any of its voices. */
  itemId: string;
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

/** Open the panel, replacing one already open. */
export function openCopyCompare(request: CopyCompareRequest): void {
  if (!host) {
    host = document.createElement("div");
    host.dataset.copyCompare = "";
    document.body.appendChild(host);
    root = createRoot(host);
  }
  root!.render(<CopyCompare key={request.itemId} {...request} onClose={closeCopyCompare} />);
}

function closeCopyCompare(): void {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
}

/** The tallest a screen is drawn whole; a longer page scrolls inside its frame. */
const DOC_MAX_H = 2400;

function CopyCompare({ canvasId, actor, itemId, onClose }: CopyCompareRequest & { onClose: () => void }) {
  const items = useCanvasStore((s) => s.canvas?.items);
  // The source: this item when it has voices, else the one this voice was made from.
  const [sourceId] = useState(() => {
    const canvas = useCanvasStore.getState().canvas;
    return (canvas && copySourceOf(canvas, itemId)) ?? itemId;
  });
  // Live: a new version of any screen in the compare, or a voice coming or going, reads again.
  const key = items
    ? [sourceId, items[sourceId]?.currentVersionId, ...Object.values(items).filter((i) => i.properties.parent === sourceId && i.properties.copyStance !== undefined).map((i) => `${i.id}:${i.currentVersionId}`).sort()].join("|")
    : "";
  const [read, setRead] = useState<CopyMixRead | null>(null);
  const [faces, setFaces] = useState<CompareFace[] | null>(null);
  const [failed, setFailed] = useState("");
  useEffect(() => {
    let live = true;
    setFailed("");
    readCopyMix(canvasId, sourceId)
      .then(async (r) => {
        if (!live) return;
        setRead(r);
        // Each screen's face: the source plain, each voice with what it changed marked.
        const drawn = await Promise.all([compareVersions(canvasId, r.version, r.version).then((c) => c.after), ...r.variants.map((v) => compareVersions(canvasId, r.version, v.version).then((c) => c.after))]);
        // Each frame measures its own strings where it renders (fit, phase 4).
        const decks = [r.deck, ...r.variants.map((v) => v.deck)];
        if (live) setFaces(drawn.map((f, i) => (f.kind === "frame" ? { kind: "frame" as const, srcdoc: withFitProbe(f.srcdoc, decks[i]!) } : f)));
      })
      .catch((e: Error) => live && setFailed(e.message));
    return () => {
      live = false;
    };
  }, [canvasId, sourceId, key]);

  // The picks: address → the voice it takes (absent: the source's words).
  const [picks, setPicks] = useState<Record<string, string>>({});
  useEffect(() => {
    // A pick of a voice or string no longer here is dropped, not carried.
    if (!read) return;
    setPicks((was) => Object.fromEntries(Object.entries(was).filter(([a, v]) => read.rows.some((r) => r.address === a && r.variants.some((x) => x.itemId === v && x.text !== r.source)))));
  }, [read]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Each frame reports its document's size, so every screen is drawn at one scale.
  const frames = useRef<Array<HTMLIFrameElement | null>>([]);
  const [sizes, setSizes] = useState<Record<number, [number, number]>>({});
  // What does not fit, per column (0: the source), as each frame reports what it measured.
  const [misses, setMisses] = useState<Record<number, FitMiss[]>>({});
  const readRef = useRef<CopyMixRead | null>(null);
  readRef.current = read;
  useEffect(() => {
    const hear = (e: MessageEvent) => {
      const measured = fitMeasuredOf(e.data);
      if (measured) {
        const at = frames.current.findIndex((f) => f?.contentWindow === e.source);
        const r = readRef.current;
        if (at < 0 || !r) return;
        const deck = at === 0 ? r.deck : r.variants[at - 1]?.deck;
        if (!deck) return;
        const missed = fitMisses(deck, measured);
        (e.source as Window).postMessage({ isocanCopyFitMark: missed.map((m) => ({ a: m.address, why: m.why })) }, "*");
        setMisses((was) => (JSON.stringify(was[at]) === JSON.stringify(missed) ? was : { ...was, [at]: missed }));
        return;
      }
      const size = (e.data as { isocanDiffSize?: unknown } | null)?.isocanDiffSize;
      const at = frames.current.findIndex((f) => f?.contentWindow === e.source);
      if (at < 0 || !Array.isArray(size) || size.length !== 2 || !size.every((n) => typeof n === "number" && n > 0 && n < 100_000)) return;
      setSizes((was) => ({ ...was, [at]: [Math.round(size[0] as number), Math.round(size[1] as number)] }));
    };
    window.addEventListener("message", hear);
    return () => window.removeEventListener("message", hear);
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  const source = items?.[sourceId];
  if (!source) {
    return <Shell title="Compare the copy" label="Compare the copy" onClose={onClose}><p className="vc-empty">This screen is no longer on the canvas.</p></Shell>;
  }
  const reported = Object.values(sizes);
  const docW = reported.length ? Math.max(...reported.map((s) => s[0]), 120) : Math.max(source.width, 120);
  const docH = Math.min(DOC_MAX_H, reported.length ? Math.max(...reported.map((s) => s[1]), 80) : Math.max(source.height, 80));
  const canWrite = canEditNow();
  const picked = Object.keys(picks).length;
  const columns = read ? [{ itemId: sourceId, stance: "Source", why: "The words it says now." }, ...read.variants] : [];

  const useMix = () => {
    if (busy || !picked) return;
    setBusy(true);
    setError("");
    mixCopy(canvasId, actor, sourceId, picks)
      .then((done) => {
        onClose();
        flashNotice(`${done.changed.length} string${done.changed.length === 1 ? "" : "s"} mixed into “${source.title}”, and ${done.trashed.length} voice${done.trashed.length === 1 ? "" : "s"} went to the trash (⌘Z takes it all back)`, 6000);
      })
      .catch((e: Error) => {
        setBusy(false);
        setError(e.message);
      });
  };
  const allFrom = (variantId: string) =>
    read && setPicks(Object.fromEntries(read.rows.filter((r) => r.variants.some((v) => v.itemId === variantId && v.text !== r.source)).map((r) => [r.address, variantId])));

  return (
    <Shell title={<>Compare the copy · <span className="vc-title">{source.title || source.id}</span></>} label="Compare the copy" onClose={onClose}>
      <div className="vc-bar">
        <span>{read ? `${read.variants.length} voice${read.variants.length === 1 ? "" : "s"}, ${read.rows.length} string${read.rows.length === 1 ? "" : "s"} said differently` : ""}</span>
        <span className="spacer" />
        {canWrite && (
          <>
            <button className="btn" disabled={!picked || busy} onClick={() => setPicks({})}>Reset to source</button>
            <button className="btn primary" disabled={!picked || busy} title="These words become the next version of the screen, and the voices go to the trash (isocan words mix)" onClick={useMix}>
              {busy ? "Mixing…" : picked ? `Use this mix (${picked})` : "Use this mix"}
            </button>
          </>
        )}
      </div>
      {failed && <p className="vc-empty" role="alert">{failed}</p>}
      {error && <p className="vc-empty cc-error" role="alert">{error}</p>}
      {!failed && !read && <p className="vc-empty" role="status">Reading the voices…</p>}
      {read && (
        <div className="cc-main">
          <div className="cc-panes" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(180px, 1fr))` }}>
            {columns.map((c, i) => (
              <div key={c.itemId} className="cc-col" data-copy-column={c.itemId}>
                {faces?.[i] ? (
                  <Pane caption={misses[i]?.length ? `${c.stance} · ${misses[i]!.length} ${misses[i]!.length === 1 ? "string does" : "strings do"} not fit` : c.stance} face={faces[i]!} docW={docW} docH={docH} frame={(f) => (frames.current[i] = f)} />
                ) : (
                  <figure className="vc-pane"><figcaption>{c.stance}</figcaption><div className="vc-stage" /></figure>
                )}
                <p className="cc-why">{c.why}</p>
                {i > 0 && canWrite && (
                  <button className="btn cc-all" onClick={() => allFrom(c.itemId)} title={`Pick every string “${c.stance}” changed`}>All its words</button>
                )}
              </div>
            ))}
          </div>
          <div className="cc-rows" role="table" aria-label="Each string, and which voice's words to use">
            <div className="cc-row cc-head" role="row" style={{ gridTemplateColumns: `140px repeat(${columns.length}, minmax(180px, 1fr))` }}>
              <span role="columnheader">String</span>
              {columns.map((c) => <span key={c.itemId} role="columnheader">{c.stance}</span>)}
            </div>
            {read.rows.map((r) => (
              <div key={r.address} className="cc-row" role="row" data-copy-address={r.address} style={{ gridTemplateColumns: `140px repeat(${columns.length}, minmax(180px, 1fr))` }}>
                <span role="rowheader" className="cc-addr"><b>{r.role}</b> {r.address}</span>
                {[{ itemId: sourceId, text: r.source }, ...r.variants].map((v, i) => {
                  const same = i > 0 && v.text === r.source;
                  const on = (picks[r.address] ?? sourceId) === v.itemId;
                  const miss = same ? undefined : misses[i]?.find((m) => m.address === r.address);
                  return (
                    <label key={v.itemId} role="cell" className={`cc-choice${on ? " on" : ""}${same ? " same" : ""}${miss ? " misfit" : ""}`} {...(miss ? { "data-fit": "over" } : {})}>
                      <input
                        type="radio"
                        name={`cc-${r.address}`}
                        value={v.itemId}
                        checked={on}
                        disabled={!canWrite || busy || same}
                        onChange={() => setPicks((was) => {
                          const next = { ...was };
                          if (v.itemId === sourceId) delete next[r.address];
                          else next[r.address] = v.itemId;
                          return next;
                        })}
                      />
                      <span>
                        {same ? "(same as source)" : v.text}
                        {miss && <small className="cc-fit">Does not fit: {miss.why}</small>}
                      </span>
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </Shell>
  );
}
