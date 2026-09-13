import { useEffect, useState } from "react";
import { canvasUrl, capabilityWord, type PublicCanvas } from "@isocan/core";
import { publicCanvases } from "../lib/api.ts";
import "./public.css";

/** Shared by the named home and the unsigned public page. No canvas content reader. */
export function PublicCatalogue({ page = false }: { page?: boolean }) {
  const [rows, setRows] = useState<PublicCanvas[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error("The public catalogue did not answer. Try refreshing.")), 8000);
    setRows(null); setError(null); setLoading(true);
    void publicCanvases(controller.signal).then((answer) => {
      if (!Array.isArray(answer?.canvases)) throw new Error("This home returned an invalid public catalogue.");
      if (live) setRows(answer.canvases);
    }).catch((err: Error) => {
      if (live) setError(controller.signal.aborted ? String(controller.signal.reason?.message ?? err.message) : err.message);
    }).finally(() => { clearTimeout(timeout); if (live) setLoading(false); });
    return () => { live = false; clearTimeout(timeout); controller.abort(); };
  }, [revision]);
  const Heading = page ? "h1" : "h2";
  return <section className="public-catalogue" aria-label="Public canvases">
    <div className="public-catalogue-head"><Heading>Public canvases</Heading><button className="btn quiet" disabled={loading} onClick={() => setRevision((was) => was + 1)}>Refresh</button></div>
    <p>Listed by their owners on this home. Opening one uses its existing viewing access.</p>
    {loading && <p role="status">Loading public canvases…</p>}
    {error && <p role="alert">Could not read the public catalogue: {error}</p>}
    {!loading && !error && rows?.length === 0 && <p>No canvases are publicly listed on this home.</p>}
    {rows && <PublicRows rows={rows} />}
  </section>;
}

/** Only declared metadata is rendered; focus and hover never fetch a preview. */
export function PublicRows({ rows }: { rows: readonly PublicCanvas[] }) {
  return <ul className="public-rows">{rows.map((row) => <li key={row.id}>
    <a className="public-row" href={canvasUrl(row.home, row.id)}>
      <strong>{row.title}</strong>
      <span>{row.home} · {capabilityWord.dialog[row.capability]}</span>
    </a>
  </li>)}</ul>;
}
