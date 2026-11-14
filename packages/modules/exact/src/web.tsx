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

import "../assets/styles.css";
import { useEffect, useState, type ComponentType } from "react";
import type { OverlayFacts, RendererFacts, UnderlayFacts, WebModule } from "@isocan/core";
import { ExactScreen, PointPanel, commentRows } from "./live.tsx";
import { WallCard } from "./wall.tsx";
import { FilmStrip } from "./film.tsx";
import { InspectorPanel, SelectionWatch } from "./inspector.tsx";
import { StoryboardCard } from "./storyboard.tsx";
import { exactCanvas, useExactStore } from "./live.tsx";
import { parseVerifyAnswer, parseVerifyAsk } from "./story.ts";
import { EXACT_ANATOMY_MIME, EXACT_INDEX_MIME, EXACT_PROPS, EXACT_STORY_MIME, EXACT_WALL_MIME, appIdOf, exactModule, mapEdges, parseAnatomy, parseIndex, type AnatomyCard as AnatomyCardData, type ExactIndex, type MapEdge } from "./core.ts";

/**
 * **The web half** (exact phases 0 and 1): the index and the anatomy cards
 * drawn as what they are, and the flow map's arrows under the screens. The
 * screens are ordinary PNGs and the design system is an ordinary DESIGN.md;
 * neither needs anything of ours. This half arrives only with the `exact`
 * experiment on.
 */

/** Read a file's text once per blob — keyed on the bytes, not the closure (the shell may hand a fresh `readText` per render). */
function useParsed<T>(blobHash: string, readText: () => Promise<string>, parse: (text: string) => T): { value?: T; problem?: string } | null {
  const [state, setState] = useState<{ hash: string; value?: T; problem?: string } | null>(null);
  useEffect(() => {
    let live = true;
    readText()
      .then((text) => { if (live) setState({ hash: blobHash, value: parse(text) }); })
      .catch((err: unknown) => { if (live) setState({ hash: blobHash, problem: err instanceof Error ? err.message : String(err) }); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blobHash]);
  return state && state.hash === blobHash ? state : null;
}

/**
 * **Verify on all hosts** (exact phase 5; design §9), on the index: Exact's
 * `verify` on the web and iOS (it has no macOS leg), asked on the canvas —
 * `exact.verify`, answered by `isocan exact live` with `exact.verified` — and
 * its screenshots posted as versions of the screens they show.
 */
function VerifyRow({ itemId, appId }: { itemId: string; appId: string }) {
  useExactStore();
  const canvas = exactCanvas();
  const [seq, setSeq] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  if (!canvas) return null;
  const answer = parseVerifyAnswer(canvas.contents.items[itemId]?.properties?.[EXACT_PROPS.verified]);
  const hosts = (["web", "ios"] as const).filter((h) => Object.values(canvas.contents.items).some((i) => appIdOf(i) === appId && (i.properties?.[EXACT_PROPS.host] ?? "web") === h && i.properties?.[EXACT_PROPS.route]));
  // Read off the index, not this card's memory: a property change can mount the card afresh while verify runs.
  const asked = parseVerifyAsk(canvas.contents.items[itemId]?.properties?.[EXACT_PROPS.verify]);
  const waiting = (seq !== null && (!answer || answer.seq < seq)) || (!!asked && (!answer || answer.seq < asked.seq));
  const ask = () => {
    const s = Date.now();
    setSeq(s);
    setProblem(null);
    canvas.send([{ type: "item.update", itemId, patch: { properties: { [EXACT_PROPS.verify]: JSON.stringify({ seq: s, by: canvas.viewer, hosts }) } } }]).catch((err: unknown) => { setSeq(null); setProblem(err instanceof Error ? err.message : String(err)); });
  };
  return (
    <div className="exact-verify" data-exact-verify={waiting ? "waiting" : answer ? (answer.ok ? "done" : "failed") : "idle"} onPointerDown={(e) => e.stopPropagation()}>
      <button type="button" className="exact-chip" disabled={waiting || hosts.length === 0} onClick={ask} title="Exact's verify — tests, check light and dark at two sizes, the largest text, a relaunch — its screenshots posted as versions of the screens they show">
        Verify on all hosts{hosts.length ? ` (${hosts.join(", ")})` : ""}
      </button>
      {waiting && <p className="exact-note" role="status">asked on the canvas — waiting for `isocan exact live` to verify…</p>}
      {!waiting && answer && Object.entries(answer.hosts).map(([h, a]) => (
        <p key={h} className={a.error ? "exact-problem" : "exact-note"}>{h}: {a.error ?? `exit ${a.exit}, ${a.problems ?? "?"} problems, ${a.posted.length} screens versioned${a.unmatched.length ? `; ${a.unmatched.length} shots not placed (${a.unmatched[0]!.why})` : ""}`}</p>
      ))}
      {problem && <p className="exact-problem">{problem}</p>}
    </div>
  );
}

function IndexCard({ blobHash, readText, item }: RendererFacts) {
  const state = useParsed<ExactIndex>(blobHash, readText, parseIndex);
  if (!state) return <div className="exact-index exact-note">Reading the index…</div>;
  if (!state.value) return <div className="exact-index exact-problem">{state.problem}</div>;
  const index = state.value;
  return (
    <div className="exact-index">
      <h3>{index.app.name}</h3>
      <p className="exact-note">
        {index.app.id} · Exact {index.exact.commit?.slice(0, 8) ?? "unknown"} · {index.routes.length} routes · {index.edges.length} arrows
      </p>
      <ul className="exact-routes">
        {index.routes.map((r) => (
          <li key={r.name} className={r.tab ? "exact-tab" : "exact-pushed"}>
            <span>{r.name}</span>
            <code>{r.pattern}</code>
          </li>
        ))}
      </ul>
      <p className={index.routesJson.equal ? "exact-note" : "exact-problem"}>
        {index.routesJson.equal ? "routes.json agrees" : "routes.json disagrees with Contract"}
      </p>
      {item && <VerifyRow itemId={item.id} appId={index.app.id} />}
      {index.unplaced.length > 0 && (
        <p className="exact-note">
          Not drawn: {index.unplaced.map((u) => `${u.verb}${u.action ? ` in ${u.action}` : ""} (${u.file}:${u.line})`).join("; ")}
        </p>
      )}
    </div>
  );
}

function AnatomyCard({ blobHash, readText }: RendererFacts) {
  const state = useParsed<AnatomyCardData>(blobHash, readText, parseAnatomy);
  if (!state) return <div className="exact-index exact-note">Reading the anatomy…</div>;
  if (!state.value) return <div className="exact-index exact-problem">{state.problem}</div>;
  const { entry, grants } = state.value;
  return (
    <div className="exact-index exact-anatomy">
      <h3>{entry.file}</h3>
      {entry.routes.length > 0 && <p className="exact-note">routes {entry.routes.join(", ")}</p>}
      {entry.components.map((c) => (
        <div key={c.name} className="exact-part">
          <strong>{c.name}</strong>
          {c.props.length > 0 && <span> props {c.props.join(", ")}</span>}
          {c.state.length > 0 && <span> · state {c.state.join(", ")}</span>}
          {c.actions.length > 0 && <span> · actions {c.actions.map((a) => (a.writes.length ? `${a.name}→${a.writes.join("/")}` : a.name)).join(", ")}</span>}
          {c.uses.length > 0 && <span> · draws {c.uses.join(", ")}</span>}
        </div>
      ))}
      {entry.shapes.map((sh) => (
        <div key={sh.name} className="exact-part">
          <strong>shape {sh.name}</strong> <span>{sh.fields.join(", ")}</span>
        </div>
      ))}
      {entry.sources.length > 0 && <p className="exact-note">sources {entry.sources.join(", ")}{grants !== null ? ` · grants ${grants === "" ? "none" : grants}` : ""}</p>}
      {entry.tests.map((t) => (
        <div key={t.name} className="exact-part">
          <strong>test</strong> <span>{t.name} ({t.steps} steps)</span>
        </div>
      ))}
    </div>
  );
}

interface Box { x: number; y: number; width: number; height: number }

/**
 * **One arrow's path and where its words go.** A push leaves the bottom of
 * the screen above and enters the top of the one below; its Back runs the
 * other way a little to the side, so the two read as a pair; a tab switch
 * arcs over the row, each way at its own height; anything else runs centre
 * to centre.
 */
function arrowPath(e: MapEdge, a: Box, b: Box, i: number): { d: string; lx: number; ly: number } {
  const cx = (r: Box) => r.x + r.width / 2;
  if (e.verb === "select") {
    const lift = 70 + (cx(a) < cx(b) ? 0 : 40);
    const y = Math.min(a.y, b.y);
    return { d: `M ${cx(a)} ${a.y} C ${cx(a)} ${y - lift}, ${cx(b)} ${y - lift}, ${cx(b)} ${b.y}`, lx: (cx(a) + cx(b)) / 2, ly: y - lift * 0.75 - 4 };
  }
  if (b.y >= a.y + a.height) {
    const x1 = cx(a) - 20 + (i % 3) * 20; const x2 = cx(b) - 20 + (i % 3) * 20;
    const y1 = a.y + a.height; const y2 = b.y;
    const m = (y1 + y2) / 2;
    return { d: `M ${x1} ${y1} C ${x1} ${m}, ${x2} ${m}, ${x2} ${y2}`, lx: (x1 + x2) / 2 + 6, ly: m };
  }
  if (a.y >= b.y + b.height) {
    const x1 = cx(a) + 36; const x2 = cx(b) + 36;
    const y1 = a.y; const y2 = b.y + b.height;
    const m = (y1 + y2) / 2;
    return { d: `M ${x1} ${y1} C ${x1} ${m}, ${x2} ${m}, ${x2} ${y2}`, lx: (x1 + x2) / 2 + 6, ly: m + 14 };
  }
  const x1 = cx(a); const y1 = a.y + a.height / 2; const x2 = cx(b); const y2 = b.y + b.height / 2;
  return { d: `M ${x1} ${y1} L ${x2} ${y2}`, lx: (x1 + x2) / 2, ly: (y1 + y2) / 2 - 6 };
}

/**
 * **The flow map's arrows** (design §3), under the screens, labelled with
 * the router verb and the action that takes it. Derived from the screens'
 * properties every render, so an arrow follows a dragged screen and leaves
 * with a deleted one. Sized to its own contents: a zero-sized SVG clips its
 * own painting (the mind map found that out).
 */
function FlowArrows({ canvas }: UnderlayFacts) {
  const edges = mapEdges(canvas);
  if (edges.length === 0) return null;
  const drawn = edges.map((e, i) => ({ e, ...arrowPath(e, e.from, e.to, i) }));
  const PAD = 140;
  const boxes = edges.flatMap((e) => [e.from, e.to]);
  const minX = Math.min(...boxes.map((b) => b.x)) - PAD;
  const minY = Math.min(...boxes.map((b) => b.y)) - PAD;
  const width = Math.max(...boxes.map((b) => b.x + b.width)) - minX + PAD;
  const height = Math.max(...boxes.map((b) => b.y + b.height)) - minY + PAD;
  return (
    <svg className="exact-arrows" aria-label="Exact flow map" style={{ left: minX, top: minY, width, height }} viewBox={`${minX} ${minY} ${width} ${height}`}>
      <defs>
        <marker id="exact-arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 1 L 9 5 L 0 9 z" fill="currentColor" />
        </marker>
      </defs>
      {drawn.map(({ e, d, lx, ly }) => (
        <g key={`${e.from.id}-${e.to.id}-${e.verb}-${e.action ?? ""}`} className={`exact-arrow exact-arrow-${e.verb}`} data-from={e.from.id} data-to={e.to.id}>
          <path d={d} fill="none" stroke="currentColor" strokeWidth={2} markerEnd="url(#exact-arrowhead)" />
          <text x={lx} y={ly} fontSize={12} fill="currentColor">{e.action ? `${e.verb} · ${e.action}` : e.verb}</text>
        </g>
      ))}
    </svg>
  );
}

export const exactWeb: WebModule<ComponentType<UnderlayFacts>, ComponentType<RendererFacts>, never, never, ComponentType<OverlayFacts>> = {
  core: exactModule,
  // The arrows; and, drawing nothing, the selection the inspector panel follows (exact phase 4).
  underlays: [FlowArrows, SelectionWatch],
  renderers: [
    { mimes: [EXACT_INDEX_MIME], component: IndexCard },
    { mimes: [EXACT_ANATOMY_MIME], component: AnatomyCard },
    // One route on every host and device (exact phase 3, `wall.tsx`).
    { mimes: [EXACT_WALL_MIME], component: WallCard },
    // A test as a storyboard (exact phase 5, `storyboard.tsx`): its steps, each run's frames, Run on a host or all.
    { mimes: [EXACT_STORY_MIME], component: StoryboardCard },
    // A film is an ordinary animated PNG (exact phase 4, `film.tsx`): the ones that carry `exact.film` are drawn as a scrubber.
    { mimes: ["image/png"], property: EXACT_PROPS.film, component: FilmStrip },
    // A screen is an ordinary PNG: only the ones this module captured (they carry `exact.route`) are drawn here —
    // the capture, or the live page where this viewer asked for it (exact phase 2, `live.tsx`).
    { mimes: ["image/png"], property: EXACT_PROPS.route, component: ExactScreen },
  ],
  // The selection a pointed-at line makes, with Open in editor, Comment on this line and Open in Exact Design.
  overlays: [
    { region: "right", label: "Exact", component: PointPanel },
    // The selected screen as the driver sees it: tree --ax, layout, perf and logs (exact phase 4).
    { region: "right", label: "Exact inspector", component: InspectorPanel },
  ],
  comments: commentRows,
};

export default exactWeb;
