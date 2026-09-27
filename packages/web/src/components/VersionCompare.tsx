import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Actor, Item, ItemVersion } from "@isocan/core";
import { parentOf } from "@isocan/core";
import { defaultVersionPair, sourcePair, versionLabel, type ChangeOp, type TextRow, type WordPart } from "@isocan/core/diff";
import { compareVersions, type CompareFace, type Compared } from "../lib/compare.ts";
import { canEditNow } from "../lib/capability.ts";
import { sendEchoed, useCanvasStore } from "../stores/canvasStore.ts";
import "./version-compare.css";

/**
 * **Compare versions** — before and after, side by side, with what changed
 * marked in both (docs/projects/version-diff/design.md).
 *
 * Opened from the item menu and from a card of the version fan, and loaded
 * on that click: it mounts its own root on `document.body`, so the entry
 * chunk pays for a menu entry and nothing else. The diff is core's (through
 * `lib/compare.ts`), the same the CLI prints.
 *
 * **It reads; it never writes** — except the two decisions a person may make
 * after reading, and those are the existing ops: "Use vN" is
 * `item.setCurrentVersion`, and on a variation compared with its source,
 * "Choose this variation" is `chooseVariation` (core's `convergeOps`).
 */
interface CompareRequest {
  canvasId: string;
  actor: Actor;
  itemId: string;
  /** Version ids on the item. Absent: the version before the one showing, against the one showing. */
  from?: string;
  to?: string;
  /** Compare a variation with the item it was made from. */
  source?: boolean;
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

/** Open the inspector, replacing one already open. */
export function openCompare(request: CompareRequest): void {
  if (!host) {
    host = document.createElement("div");
    host.dataset.versionCompare = "";
    document.body.appendChild(host);
    root = createRoot(host);
  }
  root!.render(<VersionCompare key={`${request.itemId}:${request.from ?? ""}:${request.to ?? ""}:${request.source ? 1 : 0}`} {...request} onClose={closeCompare} />);
}

function closeCompare(): void {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
}

/** The tallest a side is drawn whole; a longer page scrolls inside its frame. */
const DOC_MAX_H = 2400;

const SYMBOL: Record<ChangeOp, string> = { added: "+", removed: "−", changed: "~", moved: "↕" };

function VersionCompare({ canvasId, actor, itemId, from, to, source, onClose }: CompareRequest & { onClose: () => void }) {
  const item = useCanvasStore((s) => s.canvas?.items[itemId]);
  const items = useCanvasStore((s) => s.canvas?.items);
  const [mode, setMode] = useState<"versions" | "source">(source || (item && item.versions.length < 2 && parentOf(item)) ? "source" : "versions");

  // Which two versions, of which items.
  const initial = useMemo(() => {
    if (!item || item.versions.length === 0) return { from: "", to: "" };
    // Core's default — the one before the version showing, against it — the
    // pair a bare `isocan diff` compares; a named side overrides its half.
    const pair = defaultVersionPair(item);
    const fallback = "refused" in pair ? { from: item.versions[0]!.id, to: item.versions[0]!.id } : { from: pair.from.id, to: pair.to.id };
    const showing = item.currentVersionId;
    if (from && from !== showing) return { from, to: to ?? showing };
    return { from: from && to ? from : fallback.from, to: to ?? fallback.to };
    // Only the opening pair; later picks are the person's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);
  const [fromId, setFromId] = useState(initial.from);
  const [toId, setToId] = useState(initial.to);

  const pair = useMemo((): { before: { item: Item; version: ItemVersion }; after: { item: Item; version: ItemVersion } } | { refused: string } | null => {
    if (!item || !items) return null;
    if (mode === "source") {
      const p = sourcePair(items, item);
      if ("refused" in p) return p;
      return { before: { item: p.source, version: p.from }, after: { item, version: p.to } };
    }
    const a = item.versions.find((v) => v.id === fromId);
    const b = item.versions.find((v) => v.id === toId);
    if (!a || !b) return { refused: "that version is no longer on the stack" };
    return { before: { item, version: a }, after: { item, version: b } };
  }, [item, items, mode, fromId, toId]);

  const [compared, setCompared] = useState<Compared | null>(null);
  const [failed, setFailed] = useState("");
  const beforeHash = pair && !("refused" in pair) ? pair.before.version.id : "";
  const afterHash = pair && !("refused" in pair) ? pair.after.version.id : "";
  useEffect(() => {
    if (!pair || "refused" in pair) return;
    let live = true;
    setCompared(null);
    setFailed("");
    compareVersions(canvasId, pair.before.version, pair.after.version)
      .then((c) => live && setCompared(c))
      .catch((e: Error) => live && setFailed(e.message));
    return () => {
      live = false;
    };
    // The versions, not the objects: a store update that keeps them is no reason to re-read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasId, beforeHash, afterHash]);

  // Stepping through the changes.
  const [step, setStep] = useState(0);
  const frames = useRef<Array<HTMLIFrameElement | null>>([null, null]);
  const body = useRef<HTMLDivElement>(null);
  const count = compared?.diff.changes.length ?? 0;
  const go = useCallback((n: number) => {
    if (count === 0) return;
    const next = ((n - 1 + count) % count) + 1;
    setStep(next);
    for (const frame of frames.current) frame?.contentWindow?.postMessage({ isocanDiffStep: next }, "*");
    body.current?.querySelector(`[data-step="${next}"]`)?.scrollIntoView({ block: "center" });
  }, [count]);
  useEffect(() => setStep(0), [compared]);

  // Each frame reports the size of its own document (the one thing the
  // marked srcdoc says back), so both sides draw whole at one scale.
  const [sizes, setSizes] = useState<Array<[number, number] | null>>([null, null]);
  useEffect(() => {
    setSizes([null, null]);
    const hear = (e: MessageEvent) => {
      const size = (e.data as { isocanDiffSize?: unknown } | null)?.isocanDiffSize;
      const at = frames.current.findIndex((f) => f?.contentWindow === e.source);
      if (at < 0 || !Array.isArray(size) || size.length !== 2 || !size.every((n) => typeof n === "number" && n > 0 && n < 100_000)) return;
      const next = [Math.round(size[0] as number), Math.round(size[1] as number)] as [number, number];
      setSizes((was) => (was[at]?.[0] === next[0] && was[at]?.[1] === next[1] ? was : was.map((one, i) => (i === at ? next : one))));
    };
    window.addEventListener("message", hear);
    return () => window.removeEventListener("message", hear);
  }, [compared]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "j") { e.preventDefault(); go(step + 1); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "k") { e.preventDefault(); go(step <= 1 ? count : step - 1); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [go, step, count, onClose]);

  if (!item) {
    return <Shell title="Compare versions" onClose={onClose}><p className="vc-empty">This item is no longer on the canvas.</p></Shell>;
  }
  const canWrite = canEditNow();
  const refused = pair && "refused" in pair ? pair.refused : "";
  const ready = pair && !("refused" in pair) ? pair : null;
  const label = (side: { item: Item; version: ItemVersion }) =>
    `${mode === "source" ? `${side.item.title} · ` : ""}${versionLabel(side.item, side.version.id)}`;
  const variation = !!parentOf(item) && !!items?.[parentOf(item)!];
  // The document size both sides are drawn at: one scale for both, or
  // "bigger" means nothing. What the frames reported, else the card's box.
  // Past DOC_MAX_H a page scrolls inside its own frame rather than shrinking
  // to a strip — stepping still scrolls the change into view there.
  const reported = sizes.filter((s): s is [number, number] => s !== null);
  const docW = reported.length ? Math.max(...reported.map((s) => s[0]), 120) : Math.max(ready?.before.item.width ?? item.width, ready?.after.item.width ?? item.width, 120);
  const docH = Math.min(DOC_MAX_H, reported.length ? Math.max(...reported.map((s) => s[1]), 80) : Math.max(ready?.before.item.height ?? item.height, ready?.after.item.height ?? item.height, 80));

  return (
    <Shell title={<>Compare versions · <span className="vc-title">{item.title || item.id}</span></>} onClose={onClose}>
      <div className="vc-bar">
        {variation && (
          <div className="vc-mode" role="group" aria-label="What to compare">
            <button className={`btn${mode === "versions" ? " on" : ""}`} aria-pressed={mode === "versions"} disabled={item.versions.length < 2} onClick={() => setMode("versions")}>Its versions</button>
            <button className={`btn${mode === "source" ? " on" : ""}`} aria-pressed={mode === "source"} onClick={() => setMode("source")}>Against its source</button>
          </div>
        )}
        {mode === "versions" && item.versions.length > 1 && (
          <div className="vc-pick">
            <VersionSelect item={item} value={fromId} onChange={setFromId} label="Before" />
            <span aria-hidden>→</span>
            <VersionSelect item={item} value={toId} onChange={setToId} label="After" />
          </div>
        )}
        <span className="spacer" />
        {canWrite && ready && mode === "versions" && (
          <>
            {[ready.before, ready.after].filter((s, i, all) => s.version.id !== item.currentVersionId && all.findIndex((o) => o.version.id === s.version.id) === i).map((s) => (
              <button key={s.version.id} className="btn" title={`Bring ${label(s)} to the top of the stack (isocan version promote ${item.id} ${s.version.id})`}
                onClick={() => void sendEchoed(canvasId, actor, { type: "item.setCurrentVersion", itemId: item.id, versionId: s.version.id })}>
                Use {versionLabel(item, s.version.id)}
              </button>
            ))}
          </>
        )}
        {canWrite && ready && mode === "source" && (
          <button className="btn primary" title={`This one won: it becomes the next version of its source, and the exploration goes to the trash (isocan choose ${item.id})`}
            onClick={() => void import("../lib/choose.ts").then((m) => m.chooseVariation(canvasId, actor, item.id)).then(onClose)}>
            Choose this variation
          </button>
        )}
      </div>

      {refused && <p className="vc-empty" role="status">{refused}</p>}
      {failed && <p className="vc-empty" role="alert">Could not read a version: {failed}</p>}
      {ready && !compared && !failed && <p className="vc-empty" role="status">Comparing {label(ready.before)} with {label(ready.after)}…</p>}

      {ready && compared && (
        <div className="vc-main" ref={body}>
          <div className="vc-summary">
            <p><b>{label(ready.before)} → {label(ready.after)}:</b> {compared.diff.summary}</p>
            {compared.diff.note && <p className="vc-note">{compared.diff.note}.</p>}
          </div>
          <div className="vc-panes">
            {compared.diff.kind === "text" && compared.diff.rows ? (
              <TextPanes rows={compared.diff.rows} step={step} before={label(ready.before)} after={label(ready.after)} />
            ) : (
              <>
                <Pane caption={label(ready.before)} face={compared.before} docW={docW} docH={docH} frame={(f) => (frames.current[0] = f)} />
                <Pane caption={label(ready.after)} face={compared.after} docW={docW} docH={docH} frame={(f) => (frames.current[1] = f)} />
              </>
            )}
          </div>
          {count > 0 && (
            <div className="vc-changes">
              <div className="vc-stepper">
                <button className="btn" onClick={() => go(step <= 1 ? count : step - 1)} aria-label="Previous change" title="Previous change (←)">‹</button>
                <span>{step ? `${step} of ${count}` : `${count} change${count === 1 ? "" : "s"}`}</span>
                <button className="btn" onClick={() => go(step + 1)} aria-label="Next change" title="Next change (→)">›</button>
              </div>
              <ol>
                {compared.diff.changes.map((c) => (
                  <li key={c.step} className={`vc-change ${c.op}${c.step === step ? " at" : ""}`}>
                    <button onClick={() => go(c.step)}>
                      <span className="vc-op" aria-label={c.op}>{SYMBOL[c.op]}</span>
                      {c.what}
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </Shell>
  );
}

function Shell({ title, onClose, children }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-backdrop vc-backdrop" onPointerDown={onClose}>
      <div className="modal-card vc-card" role="dialog" aria-label="Compare versions" onPointerDown={(e) => e.stopPropagation()}>
        <header>
          <b>{title}</b>
          <span className="spacer" />
          <button className="main-close" title="Close (Esc)" onClick={onClose} aria-label="Close">✕</button>
        </header>
        {children}
      </div>
    </div>
  );
}

function VersionSelect({ item, value, onChange, label }: { item: Item; value: string; onChange: (id: string) => void; label: string }) {
  return (
    <label className="vc-select">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {item.versions.map((v, i) => (
          <option key={v.id} value={v.id}>
            v{i + 1}{v.id === item.currentVersionId ? " (showing)" : ""} · {new Date(v.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {v.createdBy.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** One side, drawn at the scale that fits BOTH panes — measured, so the two are the same size. */
function Pane({ caption, face, docW, docH, frame }: { caption: string; face: CompareFace; docW: number; docH: number; frame: (f: HTMLIFrameElement | null) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, (el.clientWidth - 2) / docW, (el.clientHeight - 2) / docH));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [docW, docH]);
  return (
    <figure className="vc-pane">
      <figcaption>{caption}</figcaption>
      <div className="vc-stage" ref={box}>
        {face.kind === "frame" && (
          <div className="vc-scaled" style={{ width: docW * scale, height: docH * scale }}>
            {/* The same lone allow-scripts every item frame gets: an opaque
                origin, no cookie, no API. The marks are in the srcdoc. */}
            <iframe ref={frame} title={caption} sandbox="allow-scripts" srcDoc={face.srcdoc} style={{ width: docW, height: docH, transform: `scale(${scale})` }} />
          </div>
        )}
        {face.kind === "image" && <img src={face.url} alt={caption} />}
        {face.kind === "file" && <p className="vc-empty">{face.filename}</p>}
      </div>
    </figure>
  );
}

function Words({ parts }: { parts: WordPart[] }) {
  return <>{parts.map((p, i) => (p.changed ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>))}</>;
}

function TextPanes({ rows, step, before, after }: { rows: TextRow[]; step: number; before: string; after: string }) {
  let lastStep = -1;
  return (
    <div className="vc-text" role="table" aria-label={`${before} and ${after}, line by line`}>
      <div className="vc-row vc-head" role="row"><span role="columnheader">{before}</span><span role="columnheader">{after}</span></div>
      {rows.map((r, i) => {
        const first = r.step !== undefined && r.step !== lastStep;
        if (r.step !== undefined) lastStep = r.step;
        return (
          <div key={i} role="row" className={`vc-row ${r.op}${r.step !== undefined && r.step === step ? " at" : ""}`} {...(first ? { "data-step": r.step } : {})}>
            <span role="cell" className="vc-l">
              {r.beforeLine !== undefined && <i>{r.beforeLine}</i>}
              {r.words ? <Words parts={r.words.before} /> : r.before}
            </span>
            <span role="cell" className="vc-r">
              {r.afterLine !== undefined && <i>{r.afterLine}</i>}
              {r.words ? <Words parts={r.words.after} /> : r.after}
            </span>
          </div>
        );
      })}
    </div>
  );
}
