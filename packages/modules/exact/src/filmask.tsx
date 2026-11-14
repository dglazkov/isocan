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

import { useEffect, useState } from "react";
import { newItemId, newVersionId, type Item, type LocalToolDoor, type Operation } from "@isocan/core";
import { EXACT_PROPS, type CapturePoints } from "./core.ts";
import { filmKeyText, landFilm, parseFilmAnswer, type FilmJob, type FilmReport } from "./film.ts";
import { exactCanvas, screenStart, useExactStore } from "./live.tsx";

/**
 * **Film the interaction, from the canvas** (exact phase 4; journey Scene 4).
 * A screen's *Film* asks for the press (Drive mode's closed list — `tap
 * <testId>`, `type <testId> "<text>"`, `back` — one a line, after the
 * screen's own shots), the clock (600 ms every 16 by default) and, if wanted,
 * a node whose motion to follow. The film itself is the same everywhere:
 *
 * - **door open, bridge paired** — the bridge's `/film` runs the capture
 *   bridge's `film` and answers the strip's bytes and state; this browser
 *   lands it beside the map with `landFilm`, the computation the CLI uses;
 * - **door shut** (*Live frames* off, a home not on this machine, no bridge)
 *   — the browser writes `exact.filmAsk` on the screen and reaches nothing on
 *   this machine; `isocan exact live` films it with the CLI's own code and
 *   answers `exact.filmed` with the strip's item.
 */

interface Bridge { port: number; hello: { drive?: { hosts: string[] } } }

const FILM_OP = /^(?:tap [A-Za-z0-9_.:-]{1,80}|type [A-Za-z0-9_.:-]{1,80} "(?:[^"\\\n\r]|\\.){0,400}"|back)$/;

async function digest(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function FilmForm({ item, appId, canvasId, door, bridge, points, onClose }: { item: Item; appId: string; canvasId: string; door: LocalToolDoor | null; bridge: Bridge | null; points: CapturePoints | null; onClose: () => void }) {
  useExactStore();
  const start = screenStart(item);
  const named = [...new Set((points?.nodes ?? []).map((n) => n.testId).filter((t): t is string => !!t))];
  const [press, setPress] = useState(named.includes("add-to-cart") ? "tap add-to-cart" : named[0] ? `tap ${named[0]}` : "");
  const [over, setOver] = useState("600");
  const [every, setEvery] = useState("16");
  const [watch, setWatch] = useState("");
  const [status, setStatus] = useState<{ state: "idle" | "filming" | "done" | "failed"; seq?: number; via?: "bridge" | "canvas"; said?: string; itemId?: string; sha256?: string }>({ state: "idle" });
  const canvas = exactCanvas();
  const answer = parseFilmAnswer(canvas?.contents.items[item.id]?.properties?.[EXACT_PROPS.filmed]);

  // The canvas door's answer arrives on the screen, a film later.
  useEffect(() => {
    if (status.state !== "filming" || status.via !== "canvas" || !answer || answer.seq !== status.seq) return;
    setStatus(answer.ok
      ? { state: "done", via: "canvas", itemId: answer.itemId ?? "", sha256: answer.sha256 ?? "", said: `filmed in ${(answer.ms / 1000).toFixed(1)} s — the strip is beside the map` }
      : { state: "failed", via: "canvas", said: answer.error ?? "the film did not finish" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer?.seq, status.seq, status.state]);

  const submit = async () => {
    const ops = press.split("\n").map((l) => l.trim()).filter(Boolean);
    const o = Number(over), e = Number(every);
    if (ops.some((op) => !FILM_OP.test(op))) { setStatus({ state: "failed", said: "the press is tap <testId>, type <testId> \"<text>\" or back, one a line" }); return; }
    if (!Number.isInteger(o) || !Number.isInteger(e) || o < 0 || e < 1 || Math.floor(o / e) + 1 > 240) { setStatus({ state: "failed", said: "over and every are whole ms, every ≥ 1, at most 240 frames" }); return; }
    const job: FilmJob = { host: start.host, size: start.size, scheme: start.scheme, shots: start.shots, ops, over: o, every: e, watch: watch.trim() || null };
    if (!canvas || canvas.id !== canvasId) { setStatus({ state: "failed", said: "the canvas is not ready to film from here" }); return; }
    if (door && bridge && bridge.hello.drive?.hosts.includes(start.host)) {
      setStatus({ state: "filming", via: "bridge" });
      try {
        const r = await door.fetch(bridge.port, "/film", { method: "POST", body: JSON.stringify(job) });
        const report = (await r.json()) as FilmReport & { apng: string | null };
        if (!report.ok || !report.apng) throw new Error(report.error ?? `the bridge answered ${r.status}`);
        const bytes = Uint8Array.from(atob(report.apng), (c) => c.charCodeAt(0));
        const route = item.properties?.[EXACT_PROPS.route] ?? "";
        const device = item.properties?.[EXACT_PROPS.device] ?? "phone";
        const key = await digest(filmKeyText({ app: appId, route, host: job.host, device, scheme: job.scheme, shots: job.shots, ops: job.ops, over: job.over, every: job.every, watch: job.watch }));
        const items = Object.values(canvas.contents.items);
        const land = landFilm(items, { app: EXACT_PROPS.app, film: EXACT_PROPS.film, frames: EXACT_PROPS.frames }, { id: appId }, item, { route, device }, job, report, key);
        const filename = `${route}-film.apng`;
        const put = await canvas.putBlob(new Blob([bytes as BlobPart], { type: "image/png" }), filename);
        const existing = land.existing ? canvas.contents.items[land.existing.id] : undefined;
        const current = existing?.versions.find((v) => v.id === existing.currentVersionId) ?? existing?.versions.at(-1);
        const version = { id: newVersionId(), blobHash: put.blobHash, mimeType: "image/png", filename, size: put.size };
        const ops: Operation[] = existing
          ? [...(current?.blobHash === put.blobHash ? [] : [{ type: "item.addVersion", itemId: existing.id, version } as Operation]), { type: "item.update", itemId: existing.id, patch: { properties: land.properties } } as Operation]
          : [{ type: "item.add", itemId: newItemId(), version, width: land.width, height: land.height, placement: { x: land.at.x, y: land.at.y, chosen: true }, title: land.title, properties: land.properties, ...(canvas.groupMode === "groups" ? { containerId: null, groupPlacement: "exact" } : {}) } as Operation];
        await canvas.send(ops);
        const itemId = existing?.id ?? (ops[0] as { itemId: string }).itemId;
        setStatus({ state: "done", via: "bridge", itemId, sha256: report.sha256, said: `filmed — the strip is beside the map${existing && current?.blobHash === put.blobHash ? " (unchanged)" : ""}` });
      } catch (err) {
        setStatus({ state: "failed", via: "bridge", said: err instanceof Error ? err.message : String(err) });
      }
      return;
    }
    // Off is a whole answer (design §5): ask on the canvas; `isocan exact live` films it.
    const seq = Date.now();
    setStatus({ state: "filming", via: "canvas", seq });
    try {
      await canvas.send([{ type: "item.update", itemId: item.id, patch: { properties: { [EXACT_PROPS.filmAsk]: JSON.stringify({ seq, by: canvas.viewer, ...job }) } } }]);
    } catch (err) {
      setStatus({ state: "failed", via: "canvas", said: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <form
      className="exact-pair exact-film-ask"
      data-exact-filming={status.state}
      data-exact-filmed-item={status.itemId ?? ""}
      data-exact-filmed-sha={status.sha256 ?? ""}
      onPointerDown={(ev) => ev.stopPropagation()}
      onSubmit={(ev) => { ev.preventDefault(); void submit(); }}
    >
      <strong>Film the interaction</strong>
      <label>
        After <code>{start.shots.split("\n").join("; ")}</code>, press
        <textarea value={press} onChange={(ev) => setPress(ev.target.value)} rows={2} aria-label="The press to film" placeholder="tap add-to-cart" />
      </label>
      {named.length > 0 && (
        <select aria-label="Add a press" value="" onChange={(ev) => { if (ev.target.value) setPress((p) => (p.trim() ? `${p.trim()}\n` : "") + `tap ${ev.target.value}`); }}>
          <option value="">add a tap on…</option>
          {named.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      )}
      <div className="exact-film-ask-row">
        <label>over <input value={over} onChange={(ev) => setOver(ev.target.value)} aria-label="Film for (ms)" inputMode="numeric" size={4} /> ms</label>
        <label>every <input value={every} onChange={(ev) => setEvery(ev.target.value)} aria-label="Frame every (ms)" inputMode="numeric" size={3} /> ms</label>
      </div>
      <label>follow a node (optional) <input value={watch} onChange={(ev) => setWatch(ev.target.value)} aria-label="Node to follow" placeholder="cart-sheet" /></label>
      <div className="exact-film-ask-row">
        <button type="submit" className="btn" disabled={status.state === "filming"}>Film</button>
        <button type="button" className="exact-chip" onClick={onClose}>Close</button>
      </div>
      {status.state === "filming" && <p className="exact-note" role="status">{status.via === "bridge" ? `filming on ${start.host}, on your machine…` : `asked on the canvas — waiting for \`isocan exact live\` to film ${start.host}…`}</p>}
      {status.said && <p className={status.state === "failed" ? "exact-problem" : "exact-note"} role="status">{status.said}</p>}
    </form>
  );
}
