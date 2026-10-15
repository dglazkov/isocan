import { useEffect, useMemo, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Actor } from "@isocan/core";
import {
  DEFAULT_WALKERS,
  WALKERS,
  WALKERS_MAX,
  WALK_NOTICE,
  WALK_PARAMETERS,
  lowVisionFilter,
  phoneSized,
  thumbArcs,
  walkAskBody,
  walkAsks,
  walkFindings,
  walkFixHtml,
  walkFlow,
  walkLanes,
  walkRecordOf,
  walkScreen,
  walkShared,
  walkStumbles,
  walkerOf,
  type WalkAsk,
  type WalkFinding,
  type WalkLane,
  type WalkScreen,
  type WalkStumble,
  type Walker,
} from "@isocan/core/walk";
import { readBlobText } from "../lib/api.ts";
import { canEditNow } from "../lib/capability.ts";
import { postToMain } from "../lib/mainthread.ts";
import { revealItem } from "../lib/zoomactions.ts";
import { flashNotice, setNotice, useCanvasStore } from "../stores/canvasStore.ts";
import "./walk.css";

/**
 * **Walk it as someone else** (proactive-agent phase 9, design §11) — a panel
 * beside the canvas, opened from an item's menu (a group of screens, a
 * prototype, or one screen) and ⌘K, and loaded on that click.
 *
 * A lane per walker draws the flow's screens as that person meets them, and
 * every drawing is core's arithmetic (`@isocan/core/walk`): the thumb's zones
 * over each phone screen for one-handed use; the screen blurred and washed
 * out for low vision — the failing words shown as they see them beside the
 * same words with the fix, "see it, not the number"; the reading order for a
 * screen reader. What the screens' code says each meets is listed under the
 * screen; the lead's stumbles are pins on it; each lane ends with its outcome.
 *
 * **Walk** asks the canvas's lead in the Chat (the ordinary summons) and
 * writes nothing else; with nothing to answer, the lanes still draw and say
 * the walk waits. The notice that these are simulations is the first thing
 * in the panel, and stays.
 */
interface WalkRequest {
  canvasId: string;
  actor: Actor;
  itemId: string;
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

/** Open the panel for one item — the menu's and the palette's door. */
export function openWalk(request: WalkRequest): void {
  if (!host) {
    host = document.createElement("div");
    host.dataset.walkHost = "";
    document.body.appendChild(host);
    root = createRoot(host);
  }
  root!.render(<WalkPanel key={request.itemId} {...request} onClose={closeWalk} />);
}

function closeWalk(): void {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
}

/** The thumbnail's width; every screen is drawn at its own size and scaled to it. */
const THUMB = 132;
const OUTCOME_LABEL: Record<string, string> = { "made it": "Made it", stumbled: "Stumbled", "gave up": "Gave up" };

function WalkPanel({ canvasId, actor, itemId, onClose }: WalkRequest & { onClose: () => void }) {
  const canvas = useCanvasStore((s) => s.canvas);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [task, setTask] = useState("");
  const [picked, setPicked] = useState<string[]>([...DEFAULT_WALKERS]);
  const [described, setDescribed] = useState("");
  const [walked, setWalked] = useState(false);
  const [lead, setLead] = useState<{ lead: Actor | null; cannot: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const item = canvas?.items[itemId];
  const current = item?.versions.find((v) => v.id === item.currentVersionId);

  // The bytes a walk reads, fetched once per version.
  const need = (hash: string | undefined) => {
    if (!hash || texts[hash] !== undefined) return;
    void readBlobText(canvasId, hash).then((t) => setTexts((was) => ({ ...was, [hash]: t }))).catch(() => setTexts((was) => ({ ...was, [hash]: "" })));
  };
  const own = current?.mimeType === "text/html" ? current.blobHash : undefined;
  useEffect(() => need(own), [own]); // eslint-disable-line react-hooks/exhaustive-deps

  const flow = useMemo(() => {
    if (!canvas || !item) return null;
    if (own && texts[own] === undefined) return null;
    return walkFlow(canvas, itemId, own ? texts[own]! : null);
  }, [canvas, item, itemId, own, texts]);
  const screenIds = flow && !("refused" in flow) ? flow.screens : [];

  // A walk already asked over exactly these screens: shown, with its pins and record.
  const ask: WalkAsk | null = useMemo(() => {
    if (!canvas || !screenIds.length) return null;
    const want = [...screenIds].sort().join(",");
    return walkAsks(canvas).filter((a) => a.screens.map((s) => s.itemId).sort().join(",") === want).at(-1) ?? null;
  }, [canvas, screenIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const versions = useMemo(() => {
    if (!canvas) return [];
    return ask
      ? ask.screens.flatMap((s) => {
          const it = canvas.items[s.itemId];
          const v = it?.versions.find((x) => x.id === s.versionId);
          return it && v ? [{ item: it, v }] : [];
        })
      : screenIds.flatMap((id) => {
          const it = canvas.items[id];
          const v = it?.versions.find((x) => x.id === it.currentVersionId);
          return it && v ? [{ item: it, v }] : [];
        });
  }, [canvas, ask, screenIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => versions.forEach(({ v }) => need(v.blobHash)), [versions]); // eslint-disable-line react-hooks/exhaustive-deps
  const screens: WalkScreen[] | null = versions.every(({ v }) => texts[v.blobHash] !== undefined)
    ? versions.map(({ item: it, v }) => walkScreen(it, v.id, texts[v.blobHash]!))
    : null;

  const walkers: Walker[] = useMemo(() => {
    if (ask) return ask.walkers;
    const out = picked.flatMap((id) => WALKERS.filter((w) => w.id === id));
    const d = described.trim() ? walkerOf(described) : null;
    if (d && !("refused" in d)) out.push(d);
    return out.slice(0, WALKERS_MAX);
  }, [ask, picked, described]);
  const describedRefused = described.trim() ? (() => {
    const d = walkerOf(described);
    return "refused" in d ? d.refused : null;
  })() : null;

  // Who would walk it, read once: the night watch's own reading of the lead.
  useEffect(() => {
    let live = true;
    void import("../lib/goodnight.ts")
      .then((m) => m.goodnightLead(canvasId, actor.id))
      .then((found) => live && setLead({ lead: found.lead, cannot: found.cannot?.replace(" to work overnight", "") ?? null }))
      .catch(() => live && setLead({ lead: null, cannot: "the canvas's agents could not be read" }));
    return () => { live = false; };
  }, [canvasId, actor.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector(".palette, .context-menu, [aria-modal=true]")) return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const stumbles: WalkStumble[] = canvas && ask ? walkStumbles(canvas, ask.id) : [];
  const record = canvas && ask ? walkRecordOf(canvas, ask.id) : null;
  const lanes: WalkLane[] = screens ? walkLanes(walkers, screens, stumbles, record) : [];
  const shared = record?.shared ?? null;
  const both = walkShared(stumbles);
  const showing = Boolean(ask) || walked;
  const htmlOf = (screen: WalkScreen) => {
    const v = versions.find((x) => x.item.id === screen.itemId)?.v;
    return v ? texts[v.blobHash] ?? "" : "";
  };
  const title = (id: string) => canvas?.items[id]?.title || "Untitled";

  const walk = async () => {
    if (!screens || !walkers.length || busy) return;
    setWalked(true);
    const words = task.replace(/\s+/g, " ").trim();
    if (!words || !lead?.lead || lead.cannot || !canEditNow()) return;
    setBusy(true);
    const findings = walkers.flatMap((w) => walkFindings(w, screens));
    const sent = await postToMain(canvasId, actor, walkAskBody(lead.lead, words, screens, walkers, findings), screens.map((s) => s.itemId)).catch((e: Error) => ({ status: "refused" as const, message: e.message }));
    setBusy(false);
    if (sent.status === "refused") setNotice(sent.message ?? "the Chat refused the message");
    else flashNotice(`Asked ${lead.lead.name} to walk it`);
  };

  // One filter at the words' own size (the swatches), and one per thumbnail scale.
  const scales = [...new Set([1, ...(screens ?? []).map((sc) => THUMB / sc.read.viewport.width)])];
  return <aside className="walk-panel" data-walk-panel={itemId} aria-label="Walk it as someone else">
    <svg className="walk-defs" aria-hidden="true" focusable="false">
      {scales.map((k) => <LowVision key={k} scale={k} />)}
    </svg>
    <button className="walk-close" aria-label="Close" onClick={onClose}>✕</button>
    <h3>Walk it as someone else{ask ? ` — “${ask.task}”` : ""}</h3>
    <p className="walk-notice" data-walk-notice role="note">{WALK_NOTICE}</p>
    {flow && "refused" in flow && <p className="walk-quiet">{flow.refused}</p>}
    {flow && !("refused" in flow) && <p className="walk-quiet" data-walk-flow={flow.via}>
      {flow.screens.length} {flow.screens.length === 1 ? "screen" : "screens"}{flow.via === "prototype" ? ", the prototype's path" : flow.via === "group" ? ", in reading order" : ""}: {flow.screens.map(title).join(" → ")}
      {flow.unreached.length > 0 && ` · no link reaches ${flow.unreached.map(title).join(", ")}`}
    </p>}

    {!ask && flow && !("refused" in flow) && <form className="walk-setup" onSubmit={(e) => { e.preventDefault(); void walk(); }}>
      <label className="walk-task">The task<input data-walk-task value={task} placeholder="order a loaf for Saturday" onChange={(e) => setTask(e.target.value)} /></label>
      <fieldset className="walk-walkers">
        <legend>Who walks it</legend>
        {WALKERS.map((w) => <label key={w.id} title={`${w.situation}; ${w.constraint}`}>
          <input type="checkbox" data-walk-walker={w.id} checked={picked.includes(w.id)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, w.id] : p.filter((x) => x !== w.id)))} />
          {w.name}
        </label>)}
        <input className="walk-describe" aria-label="Describe a walker" placeholder="Or describe one: commuter: one hand on a strap, on a moving bus" value={described} onChange={(e) => setDescribed(e.target.value)} />
        {describedRefused && <span className="walk-quiet">{describedRefused}</span>}
      </fieldset>
      <button type="submit" className="btn primary" data-walk-go disabled={busy || !screens || !walkers.length}>Walk</button>
    </form>}

    {showing && !record && <p className="walk-waits" data-walk-waits>
      {ask
        ? lead?.cannot || !lead?.lead ? `The walk waits: ${lead?.cannot ?? "nothing leads here"}.` : `Asked ${lead.lead.name} — the stumbles and outcomes have not come yet.`
        : !task.trim() ? "Measured only — say the task to ask the lead to walk it." : lead?.cannot || !lead?.lead ? `The walk waits: ${lead?.cannot ?? "nothing leads here"}. The lanes are measured; nobody has walked them.` : "Asking…"}
    </p>}

    {showing && screens && lanes.map((lane) => <Lane key={lane.walker.id} lane={lane} screens={screens} htmlOf={htmlOf} />)}
    {showing && !screens && <p className="walk-quiet">Reading the screens…</p>}

    {showing && (shared || both.length > 0) && <section className="walk-shared" data-walk-shared={shared?.itemId ?? both[0]!.itemId}>
      <h4>Several walkers stumbled here</h4>
      {shared
        ? <p>“{title(shared.itemId)}”: {shared.sentence}{record?.fix && <> <button className="walk-link" data-walk-fix={record.fix} onClick={() => revealItem(record.fix!)}>Show the fix</button></>}</p>
        : <p>{both.map((b) => `“${title(b.itemId)}” (${b.walkers.join(", ")})`).join("; ")}</p>}
    </section>}

    <details className="walk-sources">
      <summary>Where the numbers come from</summary>
      <ul>{Object.entries(WALK_PARAMETERS).map(([k, p]) => <li key={k}>{p.source}.</li>)}</ul>
    </details>
  </aside>;
}

/** The id of the low-vision filter drawn at a scale: the swatches at 1, a thumbnail at its own. */
const lensId = (scale: number) => (scale === 1 ? "walk-low-vision" : `walk-low-vision-${Math.round(scale * 1000)}`);

/** The low-vision render (core's numbers): a Gaussian blur at this scale, then the veil in linear light. */
function LowVision({ scale }: { scale: number }) {
  const f = lowVisionFilter();
  return <filter id={lensId(scale)} colorInterpolationFilters="linearRGB">
    <feGaussianBlur stdDeviation={f.blurPx * scale} />
    <feComponentTransfer>
      <feFuncR type="linear" slope={f.slope} intercept={f.intercept} />
      <feFuncG type="linear" slope={f.slope} intercept={f.intercept} />
      <feFuncB type="linear" slope={f.slope} intercept={f.intercept} />
    </feComponentTransfer>
  </filter>;
}

/** One walker's lane: their screens in order, as they meet them, and how it ended. */
function Lane({ lane, screens, htmlOf }: { lane: WalkLane; screens: readonly WalkScreen[]; htmlOf: (screen: WalkScreen) => string }) {
  const w = lane.walker;
  return <section className="walk-lane" data-walk-lane={w.id}>
    <header className="walk-lane-head">
      <strong>{w.name}</strong>
      <span className="walk-quiet"> — {w.situation}{w.described ? "" : `; ${w.constraint}`}</span>
      {lane.outcome && <span className={`walk-outcome walk-outcome-${lane.outcome.outcome.replace(" ", "-")}`} data-walk-outcome={lane.outcome.outcome}>{OUTCOME_LABEL[lane.outcome.outcome]}: {lane.outcome.line}</span>}
    </header>
    <ol className="walk-screens">
      {lane.screens.map((sc, i) => {
        const screen = screens.find((s) => s.itemId === sc.itemId)!;
        const html = htmlOf(screen);
        const contrast = sc.findings.filter((f) => f.kind === "contrast" && f.contrast?.fix);
        return <li key={sc.itemId} className="walk-screen" data-walk-screen={sc.itemId}>
          <div className="walk-step">{i + 1}. {sc.title}</div>
          <div className="walk-pair">
            <Shot screen={screen} html={html} walker={w} findings={sc.findings} stumbles={sc.stumbles} caption={contrast.length ? "As they see it" : null} />
            {w.checks.includes("contrast") && contrast.length > 0 && <Shot screen={screen} html={walkFixHtml(html, contrast.map((f) => ({ path: f.path, colour: f.contrast!.fix! })))} walker={w} findings={[]} stumbles={[]} caption="With the fix" fixed />}
          </div>
          {w.checks.includes("contrast") && contrast.map((f) => <Seen key={f.id} f={f} />)}
          {w.checks.includes("names") && <ol className="walk-order" data-walk-order aria-label="What a screen reader says, in order">
            {screen.read.order.slice(0, 8).map((s, k) => <li key={k}>{s.role}{s.name ? `, ${s.name}` : ", no name"}</li>)}
          </ol>}
          <ul className="walk-found">
            {sc.findings.map((f) => <li key={f.id} data-walk-finding={f.id}><b>{f.id}</b> {f.text}</li>)}
            {sc.stumbles.map((st, k) => <li key={`s${k}`} className="walk-stumble" data-walk-stumble={st.finding}>✗ {st.what}{st.finding === "judged" ? " (judged, not measured)" : ` (${st.finding})`}</li>)}
            {sc.notes.map((n) => <li key={n} className="walk-quiet">{n}</li>)}
            {!sc.findings.length && !sc.stumbles.length && w.checks.length > 0 && <li className="walk-quiet">Nothing measured in the way.</li>}
          </ul>
        </li>;
      })}
    </ol>
  </section>;
}

/** One screen at a walker's eye: the thumb's zones, or the low-vision render, with the findings outlined and the lead's pins. */
function Shot({ screen, html, walker, findings, stumbles, caption, fixed }: { screen: WalkScreen; html: string; walker: Walker; findings: WalkFinding[]; stumbles: WalkStumble[]; caption: string | null; fixed?: boolean }) {
  const vp = screen.read.viewport;
  const scale = THUMB / vp.width;
  const reach = walker.checks.includes("reach") && phoneSized(vp);
  const blurred = walker.checks.includes("contrast");
  const arcs = thumbArcs(vp);
  const circle = (r: number) => `M ${arcs.pivot.x - r} ${arcs.pivot.y} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`;
  return <figure className={`walk-shot${walker.checks.includes("names") ? " walk-shot-sr" : ""}`} data-walk-render={reach ? "thumb" : blurred ? "low-vision" : walker.checks.includes("names") ? "reading-order" : "plain"} data-walk-fixed={fixed ? "" : undefined}>
    <div className="walk-frame" style={{ width: THUMB, height: Math.round(vp.height * scale) }}>
      {/* A screen assumes a white page, as `.html-view` does; scripts never run here. */}
      {/* The low-vision render, at the thumbnail's scale so the blur is the screen's own. The frame keeps the
          page's origin (`allow-same-origin`) so it is drawn in this process, where an SVG filter reaches it; with
          no `allow-scripts` nothing in it runs, and nothing in it can be pressed (pointer-events: none). */}
      <div className="walk-lens" style={{ filter: blurred ? `url(#${lensId(scale)})` : undefined }}>
        <iframe title={screen.title} sandbox="allow-same-origin" tabIndex={-1} srcDoc={html} style={{ width: vp.width, height: vp.height, transform: `scale(${scale})` }} className="html-view" />
      </div>
      <svg className="walk-overlay" viewBox={`0 0 ${vp.width} ${vp.height}`} aria-hidden="true">
        {reach && <>
          <path className="walk-zone-hard" fillRule="evenodd" d={`M 0 0 H ${vp.width} V ${vp.height} H 0 Z ${circle(arcs.stretch)}`} />
          <path className="walk-zone-hard" d={circle(arcs.inner)} />
          <path className="walk-zone-stretch" fillRule="evenodd" d={`${circle(arcs.stretch)} ${circle(arcs.easy)}`} />
          <path className="walk-zone-edge" d={circle(arcs.easy)} />
        </>}
        {findings.flatMap((f) => (f.at ? [<rect key={f.id} className="walk-hit" x={f.at.x - 3} y={f.at.y - 3} width={f.at.width + 6} height={f.at.height + 6} />] : []))}
        {stumbles.map((st, k) => {
          const f = findings.find((x) => x.id === st.finding);
          const x = f?.at ? f.at.x + f.at.width / 2 : (st.at?.x ?? 0.94) * vp.width;
          const y = f?.at ? f.at.y + f.at.height / 2 : (st.at?.y ?? 0.1) * vp.height;
          return <g key={k} className="walk-pin" data-walk-pin={st.walker}><circle cx={x} cy={y} r={14 / scale / 2} /><text x={x} y={y} dy="0.35em" textAnchor="middle" fontSize={14 / scale / 2}>{k + 1}</text></g>;
        })}
      </svg>
    </div>
    {caption && <figcaption className="walk-quiet">{caption}</figcaption>}
  </figure>;
}

/** "See it, not the number": the failing words as low vision sees them, beside the same words with the fix. */
function Seen({ f }: { f: WalkFinding }) {
  const c = f.contrast!;
  return <div className="walk-seen" data-walk-seen={f.id}>
    {/* At the words' own size, on their own ground: the frame is the panel's, the inside is how they see it. */}
    <span className="walk-swatch-frame"><span className="walk-swatch" data-walk-swatch="seen" style={{ color: c.fg, background: c.bg, fontSize: c.fontPx, fontWeight: c.bold ? 700 : 400, filter: `url(#${lensId(1)})` }}>{f.label}</span></span>
    <span className="walk-swatch-frame"><span className="walk-swatch" data-walk-swatch="fix" style={{ color: c.fix!, background: c.bg, fontSize: c.fontPx, fontWeight: c.bold ? 700 : 400, filter: `url(#${lensId(1)})` }}>{f.label}</span></span>
    <span className="walk-quiet">As they see it, then with the fix: {c.ratio}:1, seen as about {c.seen}:1 · with {c.fix}, {c.fixRatio}:1</span>
  </div>;
}

