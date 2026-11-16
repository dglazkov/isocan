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

import { useRef, useState } from "react";
import type { OverlayFacts } from "@isocan/core";
import { EXACT_INDEX_MIME, EXACT_PROPS, appIdOf } from "./core.ts";
import { useSelection } from "./inspector.tsx";
import { exactBridge } from "./live.tsx";
import { dragOf, dragged, leafCss, parseApplyAnswer, parseApplyAsk, parseMaps, parseSystem, stylesNote, type ApplyAsk, type SystemRecord, type SystemToken } from "./system.ts";

/**
 * **A design system of no app, on the canvas** (exact phase 9; design §13,
 * journey Scene 8). Select it, and each token is a chip: an oklch colour's
 * hue or a length's px drags sideways (phase 6's gesture). Let go, and the
 * system item takes the value (`exact.system`, a person's edit, named); while
 * the drag lasts, an app this system was applied to whose `isocan exact live`
 * is paired here scrubs the mapped token on every live build, as phase 6's
 * chips do, and cancels on release — nothing reaches an app's files.
 *
 * **Apply** names an app on the canvas and writes the ask (`exact.apply`);
 * that app's `isocan exact live` posts the mapping card, then hands the mapped
 * tokens to its served design as Exact's held import, so they arrive as phase
 * 6's proposal item. Keep writes the files; this panel writes none.
 */
export function SystemPanel({ canvas, host }: OverlayFacts) {
  const ids = useSelection();
  const item = ids.length === 1 ? canvas.items[ids[0]!] : undefined;
  const system = parseSystem(item?.properties?.[EXACT_PROPS.system]);
  const lastAsk = parseApplyAsk(item?.properties?.[EXACT_PROPS.apply]);
  const answer = parseApplyAnswer(item?.properties?.[EXACT_PROPS.applied]);
  const apps = Object.values(canvas.items)
    .filter((i) => (i.versions.find((v) => v.id === i.currentVersionId) ?? i.versions.at(-1))?.mimeType === EXACT_INDEX_MIME && appIdOf(i) && appIdOf(i) !== system?.from.id)
    .map((i) => ({ id: appIdOf(i)!, title: i.title }));
  const [target, setTarget] = useState("");
  const [maps, setMaps] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  if (!item || !system) return null;
  const edits = Object.keys(system.edited ?? {}).length;
  const mapText = maps ?? Object.entries(lastAsk?.map ?? {}).map(([k, v]) => `${k}=${v}`).join(", ");
  // The mapping the last apply used, per app: what a drag scrubs live.
  const mapped = new Map<string, Map<string, string>>();
  for (const i of Object.values(canvas.items)) {
    try {
      const m = JSON.parse(i.properties?.[EXACT_PROPS.mapping] ?? "null") as { system?: string; app?: string; rows?: Array<{ from: string; to: string | null }> } | null;
      if (m?.system === item.id && m.app) mapped.set(m.app, new Map((m.rows ?? []).filter((r) => r.to).map((r) => [r.from, r.to!])));
    } catch { /* not a card */ }
  }

  const apply = () => {
    const appId = target || apps[0]?.id;
    if (!appId) { setSaid("open another Exact app on this canvas first (`isocan exact open <app>`): Apply needs its tokens"); return; }
    let map: Record<string, string>;
    try { map = parseMaps(mapText.split(",").map((s) => s.trim()).filter(Boolean)); } catch (err) { setSaid(err instanceof Error ? err.message : String(err)); return; }
    const ask: ApplyAsk = { seq: Date.now(), by: host.viewer?.name ?? null, app: appId, map };
    host.send([{ type: "item.update", itemId: item.id, patch: { properties: { [EXACT_PROPS.apply]: JSON.stringify(ask) } } }])
      .then(() => setSaid(`asked: \`isocan exact live\` on ${apps.find((a) => a.id === appId)?.title ?? appId} posts the mapping card, then holds Exact's import and pictures it`), (err: unknown) => setSaid(err instanceof Error ? err.message : String(err)));
  };

  return (
    <div className="exact-panel exact-system" data-exact-system={system.from.id} data-exact-edits={edits} onPointerDown={(e) => e.stopPropagation()}>
      <div className="exact-panel-head"><strong>{item.title}</strong></div>
      <p className="exact-note">From {system.from.name} (<code>{system.from.id}</code>), design digest <code>{system.digest}</code>; it belongs to no app.{edits ? ` ${edits} token${edits === 1 ? "" : "s"} edited here.` : ""}</p>
      <div className="exact-system-tokens">
        {system.tokens.map((t) => <SystemChip key={t.name} token={t} system={system} itemId={item.id} host={host} mapped={mapped} />)}
      </div>
      {system.styles.length > 0 && (
        <div className="exact-system-styles">
          {system.styles.map((s) => <p key={s.name} className="exact-note"><strong>{s.name}</strong> — {s.rows.map((r) => `${r.row}=${r.value}`).join(", ")}</p>)}
          <p className="exact-note">{stylesNote(system.styles)}</p>
        </div>
      )}
      <div className="exact-panel-actions">
        <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="apply to which app">
          {apps.length === 0 && <option value="">no other Exact app on this canvas</option>}
          {apps.map((a) => <option key={a.id} value={a.id}>to {a.title}</option>)}
        </select>
        <input className="exact-system-map" value={mapText} onChange={(e) => setMaps(e.target.value)} placeholder="brand.primary=brand.ink, …" aria-label="name a target token for a source token (src=dst, comma-separated)" />
        <button type="button" className="exact-chip" data-exact-apply onClick={apply} disabled={apps.length === 0}>Apply</button>
      </div>
      <p className="exact-note">Apply shows the token mapping as a card first, then holds the mapped tokens on the app's design as Exact's own import: they arrive as a proposal. A token of the same name and kind matches; name the rest. Nothing is written until a person keeps it.</p>
      {answer && (
        <p className={answer.ok ? "exact-note" : "exact-problem"} role="status" data-exact-applied={answer.ok ? "ok" : "failed"}>
          {answer.ok ? `Applied to ${apps.find((a) => a.id === answer.app)?.title ?? answer.app}: ${answer.mapped} mapped, ${answer.unmatched.length} without a match; held as ${answer.proposal}, pictured ${answer.previews} ways.` : `Not applied: ${answer.error}`}
        </p>
      )}
      {said && <p className="exact-note" role="status">{said}</p>}
    </div>
  );
}

function SystemChip({ token, system, itemId, host, mapped }: { token: SystemToken; system: SystemRecord; itemId: string; host: OverlayFacts["host"]; mapped: Map<string, Map<string, string>> }) {
  const d = dragOf(token);
  const [at, setAt] = useState<number | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const drag = useRef<{ x: number; live: Array<{ door: NonNullable<ReturnType<NonNullable<OverlayFacts["host"]["localTool"]>>>; port: number; name: string }> } | null>(null);
  const shown = at !== null && d ? dragged(token, at) : token;
  const swatch = token.kind === "color" ? leafCss(shown.light) : null;

  const down = async (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!d) return;
    e.stopPropagation();
    const el = e.currentTarget, pointer = e.pointerId, x = e.clientX;
    try { el.setPointerCapture(pointer); } catch { /* released already */ }
    drag.current = { x, live: [] };
    setAt(d.at);
    // An app this system was applied to, paired here: its live builds follow the drag, as phase 6's chips do.
    const door = host.localTool?.("exact") ?? null;
    if (door && !door.shut) {
      for (const [appId, rows] of mapped) {
        const name = rows.get(token.name);
        if (!name) continue;
        const bridge = await exactBridge(door, appId);
        if (bridge && drag.current) drag.current.live.push({ door, port: bridge.port, name });
      }
    }
  };
  const move = (e: React.PointerEvent<HTMLButtonElement>) => {
    const g = drag.current;
    if (!g || !d) return;
    const step = d.what === "hue" ? 1 : 0.25;
    const v = Math.max(0, Math.round(d.at + (e.clientX - g.x) * step));
    if (v === at) return;
    setAt(v);
    const value = token.kind === "color" ? dragged(token, v).source : `${v}px`;
    for (const l of g.live) void l.door.fetch(l.port, "/scrub", { method: "POST", body: JSON.stringify({ ops: [{ op: "set-token", name: l.name, value }] }) }).catch(() => {});
  };
  const up = () => {
    const g = drag.current;
    if (!g || !d || at === null) return;
    drag.current = null;
    for (const l of g.live) void l.door.fetch(l.port, "/scrub-cancel", { method: "POST" }).catch(() => {});
    if (at === d.at) { setAt(null); return; }
    const next = dragged(token, at);
    const record: SystemRecord = {
      ...system,
      tokens: system.tokens.map((t) => (t.name === token.name ? next : t)),
      edited: { ...system.edited, [token.name]: { by: host.viewer?.name ?? "someone", was: system.edited?.[token.name]?.was ?? token.source } },
    };
    host.send([{ type: "item.update", itemId, patch: { properties: { [EXACT_PROPS.system]: JSON.stringify(record) } } }])
      .then(() => { setAt(null); setSaid(`${token.name} is ${next.source} on this system${g.live.length ? "; the live builds are back on their files" : ""} — Apply sends it`); }, (err: unknown) => setSaid(err instanceof Error ? err.message : String(err)));
  };

  return (
    <div className="exact-token" data-exact-token={token.name} data-exact-value={at ?? d?.at ?? ""}>
      <button type="button" className={`exact-chip${d ? " exact-token-chip" : ""}${at !== null ? " exact-chip-on" : ""}`} title={d ? `Drag sideways: ${d.what === "hue" ? "turn its hue" : "change its length"}` : `${token.kind}: shown, not dragged`}
        onPointerDown={(e) => void down(e)} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        {swatch && <span className="exact-swatch" style={{ background: swatch }} />}
        <code>{token.name}</code> <span>{token.kind === "color" ? leafCss(shown.light) : leafCss(shown.light) || token.source}</span>
      </button>
      {said && <p className="exact-note" role="status">{said}</p>}
    </div>
  );
}
