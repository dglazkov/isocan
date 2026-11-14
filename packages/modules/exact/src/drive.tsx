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
import type { LocalToolDoor, Operation } from "@isocan/core";
import type { CapturePoint, CapturePoints } from "./core.ts";
import { driveLine, driveTarget, typesInto, type DriveOp } from "./hosts.ts";

/**
 * **Drive mode, in the browser** (exact phase 3; design §7). A press on the
 * screen is hit-tested against the nodes the last picture recorded — the
 * capture's `exact.points`, then each drive's own — and sent to this
 * machine's bridge as a driver operation: `tap <testId>` on what the app
 * named there, `type <testId> "<text>"` into a field, or `back`. The bridge
 * replays the drive on the screen's host (a cold driver, the capture's fixed
 * seed) and answers a fresh screenshot with its nodes.
 *
 * Two doors, one drive. With the shell's local-tool door open and a bridge
 * paired, the press goes to `/drive` on this machine. With the door shut —
 * *Live frames* off, or a home that is not on this machine — the browser
 * reaches nothing local: it writes the drive on the screen as `exact.drive`
 * (an ordinary `item.update`), and `isocan exact live`, wherever the app is
 * captured, replays it and writes `exact.driven` back — a capture behind
 * (design §5: with live frames off, nothing else is lost).
 */

/** The canvas door: the request written on the screen, the answer read off it. */
export interface CanvasDrive {
  send: (ops: readonly Operation[]) => Promise<void>;
  itemId: string;
  by: string | null;
  /** The screen's `exact.driven`, as the canvas holds it now. */
  answer: { seq: number; ok: boolean; blobHash: string | null; points: unknown; results: Array<{ op: string; reply: Record<string, unknown> | null }>; ms: number; error?: string } | null;
  /** A blob of this canvas, by hash. */
  urlOf: (blobHash: string) => string;
}

export interface DriveStart {
  /** The bridge door: present when this browser reaches this machine's bridge. */
  door?: LocalToolDoor;
  port?: number;
  /** The canvas door: used when there is no bridge door. */
  canvas?: CanvasDrive;
  host: string;
  /** `<w>x<h>`: the web's device size (a simulator ignores it). */
  size: string;
  scheme: "light" | "dark";
  /** Where the drive starts: the shots the capture ran. */
  shots: string;
  /** The capture's own nodes and width in points, for the first press. */
  points: CapturePoints | null;
  width: number;
  height: number;
}

interface Step { op: string; ok: boolean; said: string }

const DRIVE_PROP = "exact.drive";

interface DriveAnswer { ok: boolean; png: string | null; points: CapturePoints | null; results: Array<{ op: string; reply: Record<string, unknown> | null }>; ms: number; error?: string }

/** What a reply says, in a few words: what was pressed, typed, or why not. */
function replyWords(reply: Record<string, unknown> | null): string {
  if (!reply) return "no reply";
  if (typeof reply.error === "string") return reply.error;
  if (typeof reply.refused === "string") return reply.refused;
  if (reply.tapped !== undefined || reply.pressed !== undefined) return `pressed${typeof reply.native === "string" ? ` (${reply.native})` : ""}`;
  if (reply.typed !== undefined || reply.value !== undefined) return "typed";
  if (reply.back !== undefined || reply.popped !== undefined) return "went back";
  return "done";
}

export function Driver({ start, url, alt, onStop }: { start: DriveStart; url: string; alt: string; onStop: () => void }) {
  const [ops, setOps] = useState<string[]>([]);
  const [shown, setShown] = useState<{ src: string; points: CapturePoints | null; width: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<Step[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [typing, setTyping] = useState<{ node: CapturePoint; text: string } | null>(null);

  const [pending, setPending] = useState<{ seq: number; next: string[] } | null>(null);
  const points = shown ? shown.points : start.points;
  const width = shown ? shown.width : start.width;

  /** One answer, from either door: the picture, the step it ends, or why it stopped. */
  const take = (answer: DriveAnswer, next: string[]) => {
    const last = answer.results.at(-1);
    if (answer.png) setShown({ src: answer.png, points: answer.points, width: answer.points?.size?.width ?? width });
    if (answer.ok) {
      setOps(next);
      if (last) setLog((l) => [...l.slice(0, next.length - 1), { op: last.op, ok: true, said: `${replyWords(last.reply)} · ${(answer.ms / 1000).toFixed(1)} s` }]);
    } else {
      setProblem(answer.error ?? "the drive stopped");
      if (last) setLog((l) => [...l.slice(0, next.length - 1), { op: last.op, ok: false, said: answer.error ?? replyWords(last.reply) }]);
    }
  };

  // The canvas door's answer arrives on the screen item, a capture behind.
  const canvasAnswer = start.canvas?.answer ?? null;
  useEffect(() => {
    if (!pending || !canvasAnswer || canvasAnswer.seq !== pending.seq || !start.canvas) return;
    const a = canvasAnswer;
    take({ ok: a.ok, png: a.blobHash ? start.canvas.urlOf(a.blobHash) : null, points: (a.points ?? null) as CapturePoints | null, results: a.results ?? [], ms: a.ms ?? 0, ...(a.error ? { error: a.error } : {}) }, pending.next);
    setPending(null);
    setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasAnswer?.seq, pending?.seq]);

  const send = async (next: string[]) => {
    setBusy(true);
    setProblem(null);
    if (!start.door || start.port === undefined) {
      if (!start.canvas) { setProblem("no way to drive from here"); setBusy(false); return; }
      const seq = Date.now();
      setPending({ seq, next });
      try {
        const request = { seq, by: start.canvas.by, host: start.host, size: start.size, scheme: start.scheme, shots: start.shots, ops: next };
        await start.canvas.send([{ type: "item.update", itemId: start.canvas.itemId, patch: { properties: { [DRIVE_PROP]: JSON.stringify(request) } } }]);
      } catch (err) {
        setPending(null);
        setBusy(false);
        setProblem(err instanceof Error ? err.message : String(err));
      }
      return;
    }
    try {
      const r = await start.door.fetch(start.port, "/drive", { method: "POST", body: JSON.stringify({ host: start.host, size: start.size, scheme: start.scheme, shots: start.shots, ops: next }) });
      const answer = (await r.json().catch(() => null)) as (Omit<DriveAnswer, "png"> & { png: string | null }) | { error?: string } | null;
      if (!answer || !("results" in answer)) throw new Error(answer?.error ?? `the bridge answered ${r.status}`);
      take({ ...answer, png: answer.png ? `data:image/png;base64,${answer.png}` : null }, next);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const push = (op: DriveOp) => {
    let line: string;
    try { line = driveLine(op); } catch (err) { setProblem((err as Error).message); return; }
    void send([...ops, line]);
  };

  const press = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (busy || !points) return;
    const r = e.currentTarget.getBoundingClientRect();
    const k = r.width / width;
    const node = driveTarget(points, (e.clientX - r.left) / k, (e.clientY - r.top) / k);
    if (!node?.testId) { setProblem("nothing the app named is there to press — Drive mode presses nodes by their testId"); return; }
    if (typesInto(node)) { setTyping({ node, text: "" }); return; }
    push({ op: "tap", testId: node.testId });
  };

  const height = shown?.points?.size?.height ?? (shown ? start.height * (shown.width / start.width) : start.height);
  return (
    <div className="exact-drive" data-exact-drive={busy ? "busy" : "ready"} onPointerDown={(e) => e.stopPropagation()}>
      {/* The picture at its own shape, and the catcher exactly over it: a press maps to the capture's points. Nothing else sits on it, so no control of ours covers one of the app's. */}
      <div className="exact-drive-stage" style={{ aspectRatio: `${width} / ${height}` }}>
        <img className="img-view" src={shown?.src ?? url} alt={`${alt} — driven`} draggable={false} />
        {/* The named nodes a press can reach, as the last picture recorded them — what a press is hit-tested against, said on the element for a reader or a walk. */}
        <div className="exact-drive-catcher" title="Drive: press a control" onClick={press} data-exact-width={width} data-exact-targets={JSON.stringify((points?.nodes ?? []).filter((n) => n.testId).map((n) => [n.testId, n.x, n.y, n.w, n.h]))} />
        {typing && points && (
          <form
            className="exact-drive-type"
            style={{ top: `${Math.min(85, ((typing.node.y + typing.node.h) / height) * 100)}%` }}
            onSubmit={(e) => { e.preventDefault(); const t = typing; setTyping(null); push({ op: "type", testId: t.node.testId!, text: t.text }); }}
          >
            <input autoFocus value={typing.text} onChange={(e) => setTyping({ ...typing, text: e.target.value })} aria-label={`Type into ${typing.node.testId}`} placeholder={`Type into ${typing.node.testId}`} />
            <button type="submit" className="exact-chip">Type</button>
          </form>
        )}
      </div>
      <div className="exact-drive-foot">
        <div className="exact-drive-bar">
          <button type="button" className="exact-chip" disabled={busy} onClick={() => push({ op: "back" })}>Back</button>
          <button type="button" className="exact-chip" disabled={busy || ops.length === 0} onClick={() => { const next = ops.slice(0, -1); setLog((l) => l.slice(0, next.length)); if (next.length === 0) { setOps([]); setShown(null); } else void send(next); }}>Undo</button>
          <button type="button" className="exact-chip" onClick={onStop}>Stop</button>
        </div>
        <ol className="exact-drive-log" aria-label="Driver operations">
          {log.map((s, i) => <li key={i} className={s.ok ? "" : "exact-problem"}><code>{s.op}</code> {s.said}</li>)}
          {busy && <li className="exact-note">{start.door ? `driving on ${start.host}…` : `asked on the canvas — waiting for \`isocan exact live\` to drive ${start.host}…`}</li>}
          {problem && !busy && <li className="exact-problem" role="status">{problem}</li>}
        </ol>
      </div>
    </div>
  );
}
