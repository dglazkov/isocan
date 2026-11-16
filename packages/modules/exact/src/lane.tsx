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
import { newVersionId, type Item, type Operation, type RendererFacts } from "@isocan/core";
import { EXACT_PROPS, appIdOf } from "./core.ts";
import { exactBridge, exactCanvas, useDoor, useExactStore } from "./live.tsx";
import {
  CARD, PHASED_NOTE, cardAt, classificationLine, parseLane, parsePrepareAnswer, parsePrepared, parseRelease, parseShipAnswer, preparedMarkdown, preparedRecord,
  type LaneFacts, type PrepareReport, type PreparedRecord, type ReleaseRecord, type ShipKind,
} from "./release.ts";

/**
 * **The release lane** (exact phase 7; journey Scene 7): `app.json`'s
 * `deploy`, channels as rows, and the cards in each row beside it.
 *
 * - **Prepare** goes through either door, as Run does: through the paired
 *   bridge when this viewer's door is open (it runs Exact's dry run on their
 *   machine and this posts the card), else as an ask on the lane that
 *   `isocan exact live` answers.
 * - **Ship**, **Promote**, **Roll back** go through the canvas door only: the
 *   ask's writer is read off the op log, so `live` can refuse one an agent
 *   wrote — a bridge request carries no isocan actor. Each opens a confirm
 *   step first: the channel, the change count and the classification of the
 *   prepare it is pinned to.
 *
 * With the module gone the lane is a JSON file and every card is Markdown.
 */

type Confirm = { kind: ShipKind; channel: string; prepared: { item: Item; record: PreparedRecord } | null; of: { item: Item; record: ReleaseRecord } | null; from: string | null };

export function LaneCard(facts: RendererFacts) {
  const { item, blobHash, readText, canvasId } = facts;
  useExactStore();
  const [lane, setLane] = useState<{ hash: string; facts: LaneFacts | null } | null>(null);
  const [status, setStatus] = useState<{ state: "idle" | "waiting" | "done" | "failed"; said?: string; seq?: number; what?: "prepare" | "ship" }>({ state: "idle" });
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  useEffect(() => {
    let live = true;
    readText().then((t) => { if (live) setLane({ hash: blobHash, facts: parseLane(t) }); }).catch(() => { if (live) setLane({ hash: blobHash, facts: null }); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blobHash]);
  const door = facts.localTool?.("exact") ?? null;
  const tick = useDoor(door);
  const open = !!door && !door.shut;
  const appId = item ? appIdOf(item) : null;
  const [bridge, setBridge] = useState<Awaited<ReturnType<typeof exactBridge>>>(null);
  useEffect(() => {
    let alive = true;
    if (!open || !appId) { setBridge(null); return; }
    void exactBridge(door!, appId).then((b) => { if (alive) setBridge(b); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, appId, tick]);
  const canvas = exactCanvas();
  const now = canvas?.contents.items[item?.id ?? ""] ?? item;
  const prepAnswer = parsePrepareAnswer(now?.properties?.[EXACT_PROPS.prepared]);
  const shipAnswer = parseShipAnswer(now?.properties?.[EXACT_PROPS.shipped]);
  useEffect(() => {
    if (status.state !== "waiting" || !status.seq) return;
    const a = status.what === "prepare" ? prepAnswer : shipAnswer;
    if (!a || a.seq !== status.seq) return;
    setStatus({ state: a.ok ? "done" : "failed", said: a.ok ? `${status.what === "prepare" ? "prepared" : "done"}: the card is in the row` : a.error ?? "refused" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepAnswer?.seq, shipAnswer?.seq, status.seq]);

  if (!lane || lane.hash !== blobHash) return <div className="exact-index exact-note">Reading the release lane…</div>;
  if (!lane.facts || !item || !appId) return <div className="exact-index exact-problem">This is not a release lane this module can read.</div>;
  const L = lane.facts;
  const items = Object.values(canvas?.contents.items ?? {}).filter((i) => appIdOf(i) === appId);
  const prepared = items.flatMap((i) => { const r = parsePrepared(i.properties?.[EXACT_PROPS.classification]); return r ? [{ item: i, record: r }] : []; }).sort((a, b) => a.record.at.localeCompare(b.record.at));
  const releases = items.flatMap((i) => { const r = parseRelease(i.properties?.[EXACT_PROPS.release]); return r ? [{ item: i, record: r }] : []; }).sort((a, b) => a.record.at.localeCompare(b.record.at));
  const busy = status.state === "waiting";

  const prepare = async (channel: string) => {
    if (!canvas || canvas.id !== canvasId) { setStatus({ state: "failed", said: "the canvas is not ready" }); return; }
    if (open && bridge) {
      setStatus({ state: "waiting", what: "prepare", said: `Exact's dry run on your machine for ${channel} — it snapshots, bakes and classifies; nothing is uploaded…` });
      try {
        const r = await door!.fetch(bridge.port, "/prepare", { method: "POST", body: JSON.stringify({ channel }) });
        const report = (await r.json()) as PrepareReport;
        if (!report.ok || !report.table) throw new Error(report.error ?? `the bridge answered ${r.status}`);
        const record = preparedRecord(report, canvas.viewer ?? "a person", new Date().toISOString());
        const text = preparedMarkdown(record, L.app.name);
        const put = await canvas.putBlob(new Blob([text], { type: "text/markdown" }), `prepared-${channel}-${record.release}.md`);
        const row = Math.max(0, L.channels.findIndex((c) => c.name === channel));
        const inRow = [...prepared, ...releases].filter((c) => c.record.channel === channel).length;
        await canvas.send([{
          type: "item.add", itemId: `itm_${Math.random().toString(36).slice(2, 12)}`,
          version: { id: newVersionId(), blobHash: put.blobHash, mimeType: "text/markdown", filename: `prepared-${channel}-${record.release}.md`, size: put.size },
          width: CARD.width, height: CARD.height, placement: cardAt(item, row, inRow), title: `Prepared → ${channel}: ${classificationLine(record.classification)}`,
          properties: { [EXACT_PROPS.app]: JSON.stringify({ id: appId }), [EXACT_PROPS.classification]: JSON.stringify(record) },
          ...(canvas.groupMode === "groups" ? { containerId: null, groupPlacement: "exact" } : {}),
        } as unknown as Operation]);
        setStatus({ state: "done", said: `prepared on your machine: ${classificationLine(record.classification)}` });
      } catch (err) {
        setStatus({ state: "failed", said: err instanceof Error ? err.message : String(err) });
      }
      return;
    }
    const seq = Date.now();
    setStatus({ state: "waiting", what: "prepare", seq, said: `asked on the canvas — waiting for \`isocan exact live\` to run Exact's dry run for ${channel}…` });
    try { await canvas.send([{ type: "item.update", itemId: item.id, patch: { properties: { [EXACT_PROPS.prepare]: JSON.stringify({ seq, by: canvas.viewer, channel }) } } } as Operation]); }
    catch (err) { setStatus({ state: "failed", said: err instanceof Error ? err.message : String(err) }); }
  };

  const ask = (kind: ShipKind, channel: string, from: string | null = null) => {
    const onChannel = (c: string) => releases.filter((r) => r.record.channel === c && r.record.heads.length);
    const latest = prepared.filter((p) => p.record.channel === channel).at(-1) ?? null;
    const of = kind === "rollback" ? onChannel(channel).at(-2) ?? null : kind === "promote" ? onChannel(from!).at(-1) ?? null : null;
    setConfirm({ kind, channel, prepared: kind === "rollback" ? null : latest, of, from });
  };
  const send = async (c: Confirm) => {
    if (!canvas) return;
    const seq = Date.now();
    setConfirm(null);
    setStatus({ state: "waiting", what: "ship", seq, said: `confirmed — \`isocan exact live\` runs Exact's publisher with the keys on its machine…` });
    try {
      await canvas.send([{ type: "item.update", itemId: item.id, patch: { properties: { [EXACT_PROPS.ship]: JSON.stringify({ seq, by: canvas.viewer, kind: c.kind, channel: c.channel, changes: c.prepared?.record.classification.changes ?? null, prepared: c.prepared?.item.id ?? null, from: c.from }) } } } as Operation]);
    } catch (err) { setStatus({ state: "failed", said: err instanceof Error ? err.message : String(err) }); }
  };

  const production = L.channels.find((c) => c.name === "production")?.name ?? null;
  const internal = L.channels.find((c) => c.name === L.baked)?.name ?? L.channels[0]?.name ?? null;
  return (
    <div className="exact-lane" data-exact-lane={L.app.id} data-exact-state={status.state} onPointerDown={(e) => e.stopPropagation()}>
      <h3>{L.app.name} — releases</h3>
      <p className="exact-note">{L.platform} over the air · {L.activate ?? "next-launch"} · checks every {L.interval ?? 900} s · signed with <code>{L.signing ?? "no key"}</code> (on the machine, never here){L.baked ? ` · the binary bakes ${L.baked}` : ""}</p>
      {L.channels.map((c) => {
        const last = prepared.filter((p) => p.record.channel === c.name).at(-1)?.record;
        const rel = releases.filter((r) => r.record.channel === c.name && r.record.heads.length);
        return (
          <div key={c.name} className="exact-lane-row" data-exact-channel={c.name}>
            <strong>{c.name}</strong>
            <span className="exact-note">{c.release ?? "automatic"}{c.phased ? " · phased asked" : ""} · {rel.length} release{rel.length === 1 ? "" : "s"}{last ? ` · prepared: ${classificationLine(last.classification)}` : ""}</span>
            <div className="exact-lane-actions">
              <button type="button" className="exact-chip" disabled={busy} data-exact-do={`prepare:${c.name}`} onClick={() => void prepare(c.name)}>Prepare</button>
              {c.name === production && internal && internal !== production
                ? <button type="button" className="exact-chip" disabled={busy} data-exact-do={`promote:${c.name}`} onClick={() => ask("promote", c.name, internal)}>Promote from {internal}</button>
                : <button type="button" className="btn" disabled={busy || !last} data-exact-do={`ship:${c.name}`} onClick={() => ask("ship", c.name)}>Ship to {c.name}</button>}
              <button type="button" className="exact-chip" disabled={busy || rel.length < 2} data-exact-do={`rollback:${c.name}`} onClick={() => ask("rollback", c.name)}>Roll back</button>
            </div>
          </div>
        );
      })}
      {/* The install slot (exact phase 8): AppDrop's phone link stays unbuilt (exact phase 7's Open), so this says what Exact
          installs locally, and what a phone waits on. */}
      <p className="exact-note exact-lane-install" data-exact-install="simulator">
        Install on a simulator, not a phone: <code>bun exact.mjs ios --run --sim &lt;name&gt;</code> in the app. A phone&rsquo;s install link (AppDrop&rsquo;s QR) waits on a yes to its hosted service and an Apple ID.
      </p>
      {confirm && <ConfirmStep c={confirm} onCancel={() => setConfirm(null)} onConfirm={() => void send(confirm)} />}
      {status.said && <p className={status.state === "failed" ? "exact-problem" : "exact-note"} role="status" data-exact-said>{status.said}</p>}
    </div>
  );
}

/** The confirm step: what a person is about to publish, in Exact's classification. */
function ConfirmStep({ c, onCancel, onConfirm }: { c: Confirm; onCancel: () => void; onConfirm: () => void }) {
  const p = c.prepared?.record;
  const problem = c.kind === "rollback"
    ? (!c.of ? `${c.channel} needs two releases to roll back` : null)
    : !p ? `nothing is prepared for ${c.channel}: Prepare first`
    : !p.classification.ota.length ? "nothing goes over the air: nothing to ship"
    : c.kind === "promote" && (!c.of || c.of.record.commit !== p.commit) ? `the ${c.channel} prepare is not of ${c.of?.record.release ?? `${c.from}'s latest release`}: prepare ${c.channel} at that commit` : null;
  const verb = c.kind === "ship" ? `Ship to ${c.channel}` : c.kind === "promote" ? `Promote to ${c.channel}` : `Roll back ${c.channel}`;
  return (
    <div className="exact-lane-confirm" role="dialog" aria-label={verb} data-exact-confirm={c.kind}>
      <strong>{verb}?</strong>
      {c.kind === "rollback" && c.of && <p>Re-publishes the content of <code>{c.of.record.release}</code> (commit {c.of.record.commit.slice(0, 12)}) at a new sequence number. Exact has no publisher rollback; the card will say it is a roll back.</p>}
      {p && (
        <>
          <p data-exact-confirm-count={p.classification.changes}>Channel <strong>{c.channel}</strong> · <strong>{p.classification.changes}</strong> change{p.classification.changes === 1 ? "" : "s"} · commit {p.commit.slice(0, 12)}</p>
          <ul>
            {p.classification.ota.map((o, i) => <li key={`o${i}`}>over the air — {o.platform} {o.stream}{o.seq != null ? ` → seq ${o.seq}` : ""}: {o.changes.join(", ")}</li>)}
            {p.classification.binary.map((b, i) => <li key={`b${i}`} className="exact-problem">needs a binary — {b.platform}: {b.reason}</li>)}
          </ul>
          {c.kind === "promote" && c.of && <p>Promotes <code>{c.of.record.release}</code> from {c.from}. {PHASED_NOTE}.</p>}
        </>
      )}
      <p className="exact-note">Only a person ships: an agent's ask is refused. Exact signs with the keys on the machine running <code>isocan exact live</code>; the canvas gets the release record.</p>
      {problem && <p className="exact-problem">{problem}</p>}
      <div className="exact-lane-actions">
        <button type="button" className="btn" disabled={!!problem} data-exact-do="confirm" onClick={onConfirm}>{verb}</button>
        <button type="button" className="exact-chip" data-exact-do="cancel" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

/** A prepare or release card: its Markdown, and for a release the screens it changed, before and after. */
export function ReleaseCard(facts: RendererFacts) {
  const { item, url, blobHash, readText } = facts;
  useExactStore();
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    readText().then((t) => { if (live) setText(t); }).catch(() => { if (live) setText(null); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blobHash]);
  const release = parseRelease(item?.properties?.[EXACT_PROPS.release]);
  const prepared = parsePrepared(item?.properties?.[EXACT_PROPS.classification]);
  const canvas = exactCanvas();
  const src = (itemId: string, versionId: string | null) => {
    const v = versionId ? canvas?.contents.items[itemId]?.versions.find((x) => x.id === versionId) : null;
    return v && url.includes(blobHash) ? url.replace(blobHash, v.blobHash) : null;
  };
  const kind = release ? release.kind : "prepare";
  return (
    <div className={`exact-release exact-release-${kind}`} data-exact-release={release?.release ?? prepared?.release ?? ""} data-exact-kind={kind}
      data-exact-binary={prepared ? prepared.classification.binary.length : release ? release.refused.length : 0}
      data-exact-seq={release ? release.heads.map((h) => h.seq).join(",") : ""}>
      {prepared && prepared.classification.binary.length > 0 && <p className="exact-problem" data-exact-needs-binary>Needs a binary: {prepared.classification.binary.map((b) => `${b.platform} — ${b.reason}`).join("; ")}</p>}
      <pre className="exact-release-text">{text ?? "…"}</pre>
      {release && release.changed.length > 0 && (
        <div className="exact-release-screens">
          {release.changed.map((s) => {
            const before = src(s.itemId, s.before), after = src(s.itemId, s.after);
            return (
              <figure key={s.itemId} data-exact-screen={s.itemId}>
                <figcaption>{s.title}</figcaption>
                {before ? <img src={before} alt={`${s.title} before`} draggable={false} /> : <span className="exact-note">—</span>}
                {after ? <img src={after} alt={`${s.title} after`} draggable={false} /> : <span className="exact-note">—</span>}
              </figure>
            );
          })}
        </div>
      )}
    </div>
  );
}
