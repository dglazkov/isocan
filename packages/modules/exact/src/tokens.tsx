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

import { useEffect, useRef, useState } from "react";
import type { OverlayFacts } from "@isocan/core";
import { EXACT_PROPS, appIdOf } from "./core.ts";
import { readBlob, useSelection } from "./inspector.tsx";
import { exactBridge, exactCanvas } from "./live.tsx";
import { tokensOf, type DesignToken, type ProposeAsk } from "./proposal.ts";

/**
 * **Token scrubbing on the design-system item** (exact phase 6; design §10,
 * journey Scene 6). Select the app's design system (`app.tamber`), and each
 * length token is a chip: drag it sideways and the value moves, sent to the
 * paired bridge as a Tamber scrub — every build on the dev loop's live table
 * shows it at once with no reload, the live frames and an iOS app joined to
 * the loop alike — until you let go, when the bridge cancels the scrub and
 * every build is back on what is written. Nothing is written by a drag: the
 * value you let go at can be *proposed*, and only a person's Keep of that
 * proposal reaches the file.
 *
 * Live is the point here, so it needs the open local-tool door and a paired
 * bridge; with *Live frames* off the panel says so and does nothing.
 */

/** A length a chip can drag: whole or decimal px. */
const PX = /^(\d+(?:\.\d+)?)px$/;

export function TokenPanel({ canvas, host }: OverlayFacts) {
  const ids = useSelection();
  const item = ids.length === 1 ? canvas.items[ids[0]!] : undefined;
  const isDesign = !!item && item.properties?.[EXACT_PROPS.tamber] !== undefined && !!appIdOf(item);
  const [tokens, setTokens] = useState<{ hash: string; list: DesignToken[] } | null>(null);
  const version = item ? (item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions.at(-1)) : undefined;
  useEffect(() => {
    if (!isDesign || !version) return;
    if (tokens?.hash === version.blobHash) return;
    const read = readBlob(version.blobHash);
    if (!read) return;
    let live = true;
    read.then((text) => { if (live) setTokens({ hash: version.blobHash, list: tokensOf(text) }); }, () => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesign, version?.blobHash]);
  if (!isDesign || !item) return null;
  const appId = appIdOf(item)!;
  const draggable = (tokens?.list ?? []).filter((t) => (t.kind === "length" || t.kind === "number") && PX.test(t.light));
  return (
    <div className="exact-panel exact-tokens" data-exact-tokens={draggable.length} onPointerDown={(e) => e.stopPropagation()}>
      <div className="exact-panel-head"><strong>{item.title}</strong></div>
      <p className="exact-note">Drag a token sideways: every live build of the app follows — web frames and iOS together — until you let go. Nothing is written.</p>
      {draggable.length === 0 && <p className="exact-note">No length tokens to drag in this design.</p>}
      {draggable.map((t) => <TokenChip key={t.name} token={t} appId={appId} host={host} canvas={canvas} />)}
    </div>
  );
}

function TokenChip({ token, appId, host, canvas }: { token: DesignToken; appId: string; host: OverlayFacts["host"]; canvas: OverlayFacts["canvas"] }) {
  const base = Number(PX.exec(token.light)![1]);
  const [value, setValue] = useState<number | null>(null);
  const [state, setState] = useState<"idle" | "scrubbing" | "let-go" | "failed" | "asked">("idle");
  const [said, setSaid] = useState<string | null>(null);
  const [last, setLast] = useState<number | null>(null);
  const screens = Object.values(canvas.items).filter((i) => appIdOf(i) === appId && i.properties?.[EXACT_PROPS.route] && (i.properties?.[EXACT_PROPS.host] ?? "web") === "web" && (i.properties?.[EXACT_PROPS.device] ?? "phone") === "phone" && (i.properties?.[EXACT_PROPS.scheme] ?? "light") === "light");
  const [under, setUnder] = useState<string>("");
  const drag = useRef<{ x: number; door: NonNullable<ReturnType<NonNullable<OverlayFacts["host"]["localTool"]>>>; port: number; inFlight: boolean; pending: number | null; value: number; keep: ReturnType<typeof setInterval> } | null>(null);

  const send = (v: number) => {
    const d = drag.current;
    if (!d) return;
    if (d.inFlight) { d.pending = v; return; }
    d.inFlight = true;
    d.door.fetch(d.port, "/scrub", { method: "POST", body: JSON.stringify({ ops: [{ op: "set-token", name: token.name, value: `${v}px` }] }) })
      .then(async (r) => {
        const body = (await r.json().catch(() => null)) as { ok?: { scrub?: string }; error?: { message?: string } | string; builds?: unknown[] } | null;
        if (!r.ok) { setState("failed"); setSaid(typeof body?.error === "string" ? body.error : body?.error?.message ?? `the bridge answered ${r.status}`); }
        else setSaid(`on ${body?.builds?.length ?? "every"} build${body?.builds?.length === 1 ? "" : "s"} of the loop`);
      })
      .catch((err: unknown) => { setState("failed"); setSaid(err instanceof Error ? err.message : String(err)); })
      .finally(() => {
        const dd = drag.current;
        if (!dd) return;
        dd.inFlight = false;
        if (dd.pending !== null) { const p = dd.pending; dd.pending = null; send(p); }
      });
  };

  const down = async (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const el = e.currentTarget;
    const pointer = e.pointerId;
    const x = e.clientX;
    const door = host.localTool?.("exact") ?? null;
    if (!door || door.shut) { setState("failed"); setSaid(door?.shut ?? "token scrubbing runs on your machine: it needs live frames on and `isocan exact live` paired"); return; }
    const bridge = await exactBridge(door, appId);
    if (!bridge) { setState("failed"); setSaid("pair a screen's Live with `isocan exact live` first — the scrub runs on its dev loop"); return; }
    try { el.setPointerCapture(pointer); } catch { /* released already */ }
    drag.current = { x, door, port: bridge.port, inFlight: false, pending: null, value: base, keep: setInterval(() => { const d = drag.current; if (d) send(d.value); }, 10_000) };
    setState("scrubbing");
    setValue(base);
  };
  const move = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    const v = Math.max(0, Math.round(base + (e.clientX - d.x) / 4));
    if (v === value) return;
    d.value = v;
    setValue(v);
    send(v);
  };
  const up = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    clearInterval(d.keep);
    const at = value;
    setLast(at);
    setState("let-go");
    d.door.fetch(d.port, "/scrub-cancel", { method: "POST" }).then(() => setSaid(`let go at ${at}px — every build back on ${token.light}, nothing written`), () => {});
  };

  /** The value let go at, as a proposal under a screen the person picks: a person's ask, at write scope, still kept only by a Keep. */
  const propose = () => {
    const c = exactCanvas();
    if (!c || last === null) return;
    const screen = screens.find((i) => i.id === under) ?? screens[0];
    if (!screen) { setSaid("no web phone screen of this app on the canvas to hang the proposal under"); return; }
    const ask: ProposeAsk = { seq: Date.now(), by: c.viewer, ops: [{ op: "set-token", name: token.name, value: `${last}px` }], why: `${token.name} at ${last}px, tried by dragging it on the design system.`, cites: [], in: null };
    c.send([{ type: "item.update", itemId: screen.id, patch: { properties: { [EXACT_PROPS.propose]: JSON.stringify(ask) } } }]).then(() => { setState("asked"); setSaid(`proposed ${token.name} = ${last}px under ${screen.title}; Keep it there to write it`); }, (err: unknown) => setSaid(err instanceof Error ? err.message : String(err)));
  };

  return (
    <div className="exact-token" data-exact-token={token.name} data-exact-scrub={state} data-exact-value={value ?? base}>
      <button type="button" className={`exact-chip exact-token-chip${state === "scrubbing" ? " exact-chip-on" : ""}`} title={`Drag sideways to scrub ${token.name} on every live build`} onPointerDown={(e) => void down(e)} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <code>{token.name}</code> <span>{state === "scrubbing" && value !== null ? `${value}px` : token.light}</span>
      </button>
      {state === "let-go" && last !== null && last !== base && (
        <span className="exact-token-propose">
          <button type="button" className="exact-chip" onClick={propose}>Propose {last}px</button>
          <select value={under} onChange={(e) => setUnder(e.target.value)} aria-label="under which screen">
            {screens.map((sc) => <option key={sc.id} value={sc.id}>under {sc.properties?.[EXACT_PROPS.route]}</option>)}
          </select>
        </span>
      )}
      {said && <p className={state === "failed" ? "exact-problem" : "exact-note"} role="status">{said}</p>}
    </div>
  );
}

