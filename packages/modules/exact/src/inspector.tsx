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

import { useEffect, useState, useSyncExternalStore } from "react";
import type { OverlayFacts, UnderlayFacts } from "@isocan/core";
import { EXACT_PROPS, appIdOf } from "./core.ts";
import { axRows, parseInspectAnswer, type ScreenFacts } from "./film.ts";
import { exactBridge, screenStart } from "./live.tsx";

/**
 * **The inspector panel** (exact phase 4; design §8): for the one Exact
 * screen selected, what the driver says about it — `tree --ax`, `layout`,
 * `perf` and `logs` — read-only, fresh from a cold driver at the screen's
 * shots (Exact holds no resident session a tool can keep, phase 3). Never the
 * capture's stored `exact.points`: a fact the CLI can print is a panel the
 * web can show, and this one is printed on asking.
 *
 * Two doors, as Drive mode has. With the shell's local-tool door open and a
 * bridge paired, the bridge's `/facts` answers. Otherwise — *Live frames*
 * off, a home that is not this machine, no bridge — the browser writes
 * `exact.inspect` on the screen and `isocan exact live` answers with
 * `exact.inspected`, the facts a JSON blob of the canvas, read back here.
 * Nothing reaches the person's machine from the browser on that path.
 *
 * Selection is the shell's: overlays are not handed it, underlays are — so a
 * one-line underlay keeps this viewer's selection (and the canvas's blob
 * reader) for the panel. Transient, written nowhere.
 */

const seen = { selection: [] as readonly string[], readText: null as ((hash: string) => Promise<string>) | null, version: 0 };
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** This viewer's selection, re-rendering when it moves (the token panel, exact phase 6, reads it too). */
export function useSelection(): readonly string[] {
  useSyncExternalStore(subscribe, () => seen.version);
  return seen.selection;
}

/** Read one of the canvas's files by its hash, through the reader the underlay was handed; null when this view has none. */
export function readBlob(hash: string): Promise<string> | null {
  return seen.readText ? seen.readText(hash) : null;
}

/** The underlay that hands the panel this viewer's selection. Draws nothing. */
export function SelectionWatch({ selection, readText }: UnderlayFacts) {
  const ids = selection ?? [];
  useEffect(() => {
    if (readText) seen.readText = readText;
    if (ids.length === seen.selection.length && ids.every((id, i) => id === seen.selection[i])) return;
    seen.selection = [...ids];
    seen.version++;
    for (const l of listeners) l();
  });
  return null;
}

type Tab = "tree" | "layout" | "perf" | "logs";

interface Reading { itemId: string; status: "asking" | "done" | "failed"; via: "bridge" | "canvas"; facts?: ScreenFacts; error?: string; seq?: number }

const DOOR_PROP = EXACT_PROPS.inspect;

export function InspectorPanel({ canvas, host }: OverlayFacts) {
  useSyncExternalStore(subscribe, () => seen.version);
  const [reading, setReading] = useState<Reading | null>(null);
  const [tab, setTab] = useState<Tab>("tree");
  const ids = seen.selection;
  const item = ids.length === 1 ? canvas.items[ids[0]!] : undefined;
  const isScreen = !!item && item.properties?.[EXACT_PROPS.route] !== undefined && !!appIdOf(item);
  const mine = reading && item && reading.itemId === item.id ? reading : null;

  // The canvas door's answer arrives on the screen, a cold driver later.
  const answer = item ? parseInspectAnswer(item.properties?.[EXACT_PROPS.inspected]) : null;
  useEffect(() => {
    if (!mine || mine.via !== "canvas" || mine.status !== "asking" || !answer || answer.seq !== mine.seq) return;
    if (!answer.ok || !answer.blobHash) { setReading({ ...mine, status: "failed", error: answer.error ?? "the inspection did not finish" }); return; }
    const read = seen.readText;
    if (!read) { setReading({ ...mine, status: "failed", error: "this view cannot read the canvas's files" }); return; }
    read(answer.blobHash).then(
      (text) => setReading({ ...mine, status: "done", facts: JSON.parse(text) as ScreenFacts }),
      (err: unknown) => setReading({ ...mine, status: "failed", error: `the answer's file is gone (${err instanceof Error ? err.message : String(err)}) — inspect again` }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer?.seq, mine?.seq, mine?.status]);

  if (!isScreen || !item) return null;
  const start = screenStart(item);
  const appId = appIdOf(item)!;

  const ask = async () => {
    const door = host.localTool?.("exact") ?? null;
    const bridge = door && !door.shut ? await exactBridge(door, appId) : null;
    if (door && bridge && bridge.hello.drive?.hosts.includes(start.host)) {
      setReading({ itemId: item.id, status: "asking", via: "bridge" });
      try {
        const r = await door.fetch(bridge.port, "/facts", { method: "POST", body: JSON.stringify(start) });
        const facts = (await r.json()) as ScreenFacts;
        setReading(facts.ok ? { itemId: item.id, status: "done", via: "bridge", facts } : { itemId: item.id, status: "failed", via: "bridge", error: facts.error ?? `the bridge answered ${r.status}` });
      } catch (err) {
        setReading({ itemId: item.id, status: "failed", via: "bridge", error: err instanceof Error ? err.message : String(err) });
      }
      return;
    }
    // Off is a whole answer (design §5): ask on the canvas; `isocan exact live` answers.
    const seq = Date.now();
    setReading({ itemId: item.id, status: "asking", via: "canvas", seq });
    try {
      await host.send([{ type: "item.update", itemId: item.id, patch: { properties: { [DOOR_PROP]: JSON.stringify({ seq, by: host.viewer?.name ?? null, ...start }) } } }]);
    } catch (err) {
      setReading({ itemId: item.id, status: "failed", via: "canvas", seq, error: err instanceof Error ? err.message : String(err) });
    }
  };

  const facts = mine?.facts;
  const elements = facts?.ax?.ax?.elements ?? [];
  return (
    <div className="exact-panel exact-inspector" role="region" aria-label="Exact — inspector" data-exact-inspector={item.id} data-exact-inspected={mine?.status ?? "idle"} data-exact-via={mine?.via ?? ""}>
      <div className="exact-panel-head">
        <strong>Inspector</strong>
        <button type="button" className="exact-chip" disabled={mine?.status === "asking"} onClick={() => void ask()}>{facts ? "Inspect again" : "Inspect"}</button>
      </div>
      <p className="exact-note">{item.title} · {start.host} · <code>{start.shots.split("\n").join("; ")}</code></p>
      {mine?.status === "asking" && <p className="exact-note" role="status">{mine.via === "bridge" ? `a cold driver on ${start.host}, on your machine…` : `asked on the canvas — waiting for \`isocan exact live\` to inspect ${start.host}…`}</p>}
      {mine?.status === "failed" && <p className="exact-problem" role="status">{mine.error}</p>}
      {!mine && <p className="exact-note">What the driver says about this screen, from a cold driver at its shots: the accessibility tree, layout, perf and logs.</p>}
      {facts && (
        <>
          <div className="exact-tabs" role="tablist">
            {(["tree", "layout", "perf", "logs"] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} className={`exact-chip${tab === t ? " exact-chip-on" : ""}`} onClick={() => setTab(t)}>{t === "tree" ? "tree --ax" : t}</button>
            ))}
          </div>
          <div className="exact-inspector-body">
            {tab === "tree" && (
              // The tree as the driver printed it, kept whole on the element for a reader or a walk to compare.
              <ol className="exact-ax" data-exact-ax={JSON.stringify(facts.ax)} data-exact-ax-count={elements.length}>
                {axRows(elements).map((r) => (
                  <li key={r.i} style={{ paddingLeft: `${Math.min(r.depth, 12) * 8}px` }} className={r.interactive ? "exact-ax-press" : ""}>
                    <span>{r.role}</span>{r.name ? <> “{r.name}”</> : null}{r.testId ? <code> {r.testId}</code> : null}
                  </li>
                ))}
              </ol>
            )}
            {tab === "layout" && (
              <ol className="exact-rows" data-exact-layout-count={facts.layout?.nodes?.length ?? 0}>
                {(facts.layout?.nodes ?? []).map((n) => (
                  <li key={n.id}><span>{n.type}{n.testId ? ` ${n.testId}` : ""}</span> <code>{Math.round(n.x)},{Math.round(n.y)} {Math.round(n.w)}×{Math.round(n.h)}</code>{n.sourceMap?.line ? <em> :{n.sourceMap.line}</em> : null}</li>
                ))}
              </ol>
            )}
            {tab === "perf" && (
              <div className="exact-rows">
                <p className="exact-note">{facts.perf?.walked ?? "?"} nodes walked · {(facts.perf?.sites ?? []).length} plan sites</p>
                <ul className="exact-rows">{(facts.perf?.resources ?? []).map((x) => <li key={x.name}><span>{x.name}</span> <code>asked {x.asked}</code></li>)}</ul>
              </div>
            )}
            {tab === "logs" && (
              <ol className="exact-rows">{(facts.logs?.lines ?? []).map((l, i) => <li key={i}><code>{l}</code></li>)}</ol>
            )}
          </div>
          <p className="exact-note">{facts.ms} ms · the same tree: <code>bun exact.mjs {facts.command.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(" ")}</code></p>
        </>
      )}
    </div>
  );
}
