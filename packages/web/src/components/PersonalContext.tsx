import { useEffect, useRef, useState } from "react";
import { canvasUrl, newOpId, normalizeHomeUrl, type Actor, type PersonalReadResponse, type PersonalStatusResponse, type PersonalDelegate, type PersonalLinkStatus } from "@isocan/core";
import { useCanEdit } from "../lib/capability.ts";
import { personalApi } from "../lib/personal.ts";

/** Owner controls and private responses exist only inside the current Context inspection. */
export function PersonalContext({ canvasId, actor, refresh, onOwner }: { canvasId: string; actor: Actor; refresh: () => void; onOwner: (id: string) => void }) {
  const canEdit = useCanEdit();
  const [unavailableLinks, setUnavailableLinks] = useState<PersonalLinkStatus[]>([]);
  const [status, setStatus] = useState<PersonalStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [delegates, setDelegates] = useState<PersonalDelegate[] | null>(null);
  const [delegateSource, setDelegateSource] = useState<string | null>(null);
  const [agent, setAgent] = useState("");
  const controller = useRef<AbortController | null>(null);
  const gesture = useRef<{ kind: string; id: string } | null>(null);
  useEffect(() => {
    const control = new AbortController(); controller.current = control;
    void personalApi.personalStatus(actor.id, control.signal, canvasId).then((answer) => { if (!control.signal.aborted) { setStatus(answer); onOwner(answer.owner.id);
      void personalApi.personalLinks(canvasId, actor.id, control.signal).then((rows) => { if (!control.signal.aborted) setUnavailableLinks(rows.links.filter((row) => row.owner.id === answer.owner.id && !row.available)); }).catch(() => {}); } }).catch((err) => { if (!control.signal.aborted) setError(String(err.message ?? err)); });
    return () => { control.abort(); controller.current = null; };
  }, [actor.id, onOwner, canvasId]);
  async function act(work: (signal: AbortSignal) => Promise<void>) {
    const control = controller.current;
    if (!control || busy) return;
    setBusy(true); setError(null);
    try { await work(control.signal); }
    catch (err) { if (!control.signal.aborted) setError(err instanceof Error ? err.message : String(err)); }
    finally { if (!control.signal.aborted) setBusy(false); }
  }
  const source = status?.source;
  const requestId = (kind: string) => {
    if (gesture.current?.kind !== kind) gesture.current = { kind, id: newOpId() };
    return gesture.current.id;
  };
  return <section className="ctx-layer personal-controls" aria-label="Your canvas">
    <h3 className="ctx-heading">Your canvas</h3>
    <p className="ctx-why">Your private canvas at this home. Linking shows your name and a card; its preview stays private.</p>
    {status && <p className="ctx-why">Home: {status.home}</p>}
    {error && <p role="alert" className="ctx-why">{error}</p>}
    {!source && <button className="btn" disabled={busy} onClick={() => void act(async (signal) => {
      const made = await personalApi.ensurePersonal(actor.id, signal, canvasId); signal.throwIfAborted(); setStatus(made); onOwner(made.owner.id);
    })}>Your canvas</button>}
    {source && <>
      <p className="ctx-why">{source.state === "live" ? `${status.owner.name}'s canvas` : `Your canvas is ${source.state}. Its address is preserved.`}</p>
      {source.state === "live" && <div className="personal-actions">
        <a className="btn" href={canvasUrl(status.home, source.canvasId)} target="_blank" rel="noopener noreferrer">Open your canvas</a>
        <button className="btn" disabled={busy || !canEdit || source.canvasId === canvasId} onClick={() => void act(async (signal) => {
          await personalApi.linkPersonal(canvasId, actor.id, requestId("link"), signal); signal.throwIfAborted(); gesture.current = null; refresh();
        })}>Link your canvas here</button>
        <button className="btn" disabled={busy} onClick={() => void act(async (signal) => {
          const answer = await personalApi.personalDelegates(source.canvasId, actor.id, signal); signal.throwIfAborted(); setDelegates(answer.delegates); setDelegateSource(source.canvasId);
        })}>Agent access</button>
      </div>}
      {unavailableLinks.map((one) => <div key={one.itemId}><p className="ctx-why">{one.refused ?? "Personal source unavailable"}</p><button className="btn" disabled={busy || !canEdit} onClick={() => void act(async (signal) => {
        await personalApi.unlinkPersonal(canvasId, actor.id, requestId(`unlink:${one.itemId}`), one.itemId, signal); signal.throwIfAborted(); gesture.current = null; refresh();
      })}>Unlink unavailable personal canvas</button></div>)}
      {status.preserved.map((one) => <div key={one.canvasId} className="personal-actions"><a className="btn" href={canvasUrl(status.home, one.canvasId)} target="_blank" rel="noopener noreferrer">Preserved canvas · {one.state}</a>{one.state === "live" && <button className="btn" disabled={busy} onClick={() => void act(async (signal) => {
        const answer = await personalApi.personalDelegates(one.canvasId, actor.id, signal); signal.throwIfAborted(); setDelegates(answer.delegates); setDelegateSource(one.canvasId);
      })}>Agent access for {one.canvasId}</button>}</div>)}
      {delegates && <form className="personal-delegates" onSubmit={(event) => { event.preventDefault(); if (!agent.trim()) return; void act(async (signal) => {
        await personalApi.setPersonalDelegate(delegateSource ?? source.canvasId, agent.trim(), actor.id, true, signal);
        const answer = await personalApi.personalDelegates(delegateSource ?? source.canvasId, actor.id, signal); signal.throwIfAborted(); setDelegates(answer.delegates); setAgent(""); refresh();
      }); }}>
        <p className="ctx-why">Dataset: {delegateSource ?? source.canvasId}</p>
        <p className="ctx-why">Allow an agent by its exact actor ID. This permits personal Context reads where this source is linked.</p>
        <label>Agent actor ID<input className="text-input" value={agent} onChange={(event) => setAgent(event.target.value)} /></label>
        <button className="btn" disabled={busy || !agent.trim()} type="submit">Allow agent</button>
        {delegates.filter((one) => one.allowed).map((one) => <div key={one.agentId} className="personal-delegate"><code>{one.agentId}</code><button className="btn" type="button" disabled={busy} onClick={() => void act(async (signal) => {
          await personalApi.setPersonalDelegate(delegateSource ?? source.canvasId, one.agentId, actor.id, false, signal);
          const answer = await personalApi.personalDelegates(delegateSource ?? source.canvasId, actor.id, signal); signal.throwIfAborted(); setDelegates(answer.delegates); refresh();
        })}>Revoke agent {one.agentId}</button></div>)}
      </form>}
    </>}
  </section>;
}

/** Dedicated text reading never enters canvas state, blob caches or browser storage. */
export function PersonalRead({ canvasId, actor, itemId, sourceCanvasId, home, canUnlink, refresh }: { canvasId: string; actor: Actor; itemId: string; sourceCanvasId: string; home: string; canUnlink: boolean; refresh: () => void }) {
  const [pages, setPages] = useState<PersonalReadResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const control = useRef<AbortController | null>(null);
  const unlinkId = useRef(newOpId());
  useEffect(() => () => control.current?.abort(), []);
  async function read(more = false) {
    control.current?.abort(); const next = new AbortController(); control.current = next;
    setBusy(true); setError(null); if (!more) setPages([]);
    try {
      const cursor = more ? pages.at(-1)?.nextCursor : undefined;
      const answer = await personalApi.readPersonal(canvasId, { actorId: actor.id, itemId, mode: "content", ...(cursor ? { cursor } : {}) }, next.signal);
      next.signal.throwIfAborted();
      if (answer.itemId !== itemId || answer.sourceCanvasId !== sourceCanvasId || normalizeHomeUrl(answer.home) !== normalizeHomeUrl(home) || answer.kind !== "personal" || answer.mode !== "content") throw new Error("The home returned a different personal context.");
      setPages((prior) => more ? [...prior, answer] : [answer]);
    } catch (err) { if (!next.signal.aborted) { setPages([]); setError(err instanceof Error ? err.message : String(err)); } }
    finally { if (!next.signal.aborted) setBusy(false); }
  }
  return <div className="personal-read">
    <div className="personal-actions"><button className="btn" disabled={busy} onClick={() => void read()}>Read personal context</button>
      {canUnlink && <button className="btn" disabled={busy} onClick={() => {
        control.current?.abort(); const next = new AbortController(); control.current = next; setPages([]); setBusy(true);
        void personalApi.unlinkPersonal(canvasId, actor.id, unlinkId.current, itemId, next.signal).then(() => { next.signal.throwIfAborted(); refresh(); }).catch((err) => { if (!next.signal.aborted) setError(err.message ?? String(err)); }).finally(() => { if (!next.signal.aborted) setBusy(false); });
      }}>Unlink your canvas</button>}
    </div>
    {error && <p role="alert">{error}</p>}
    {pages.length > 0 && <div className="personal-private" aria-label="Private personal context">
      <p>Private · from {pages[0]!.owner.name}'s canvas · current pinned context</p>
      {pages.flatMap((page, pageIndex) => page.pieces.map((piece, index) => <section key={`${pageIndex}:${index}`}><strong>{piece.title}</strong>{piece.text !== undefined ? <pre>{piece.text}</pre> : <p>{piece.unavailable ?? `${piece.mimeType ?? "No current version"} · metadata only`}</p>}</section>))}
      {pages.at(-1)?.nextCursor && <button className="btn" disabled={busy} onClick={() => void read(true)}>Read more personal context</button>}
      {pages.at(-1)?.truncated && <p>Response bounded; more context may remain.</p>}
    </div>}
  </div>;
}
