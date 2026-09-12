import { useState } from "react";
import { Dialog } from "./dialog.tsx";
import { applyGraphReview, graphDifferences, prepareGraphReview, type GraphReview } from "./graph-review.ts";
import { loadProject, type AnatomyIO } from "./operations.ts";

/** Render domain facts as readable fields, including citations and assessments. */
function Facts({ value }: { value: unknown }) {
  if (value === undefined || value === null || value === "") return <span className="anatomy-muted">Not set</span>;
  if (Array.isArray(value)) return value.length ? <ul>{value.map((entry, i) => <li key={i}><Facts value={entry} /></li>)}</ul> : <span className="anatomy-muted">None</span>;
  if (typeof value === "object") return <dl>{Object.entries(value).map(([key, entry]) => <div key={key}>
    <dt>{key.replace(/([A-Z])/g, " $1")}</dt><dd><Facts value={entry} /></dd>
  </div>)}</dl>;
  return <span>{String(value)}</span>;
}

export function GraphReviewDialog({ initial, title, io, canEdit, close, exportPlan }: {
  initial: GraphReview; title: string; io: AnatomyIO; canEdit: boolean;
  close: () => void; exportPlan: (plan: GraphReview) => void;
}) {
  const [plan, setPlan] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const difference = graphDifferences(plan);
  const count = difference.concepts.length + difference.relationships.length;
  async function apply() {
    setBusy(true); setError("");
    try { await applyGraphReview(io, plan); close(); }
    catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  async function refresh() {
    setBusy(true); setError("");
    try {
      const { canvas, item, project } = await loadProject(io, plan.projectId);
      setPlan(prepareGraphReview(canvas, item, project, plan.after, (await io.record()).id));
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  return <Dialog title={title} close={() => { if (!busy) close(); }}>
    <p>Review changes to concepts and relationships. The overview, sources, positions and discussions are preserved.</p>
    <p>{difference.concepts.length} concept changes · {difference.relationships.length} relationship changes</p>
    {!count && <p>The live graph already matches this snapshot.</p>}
    {([ ["Concepts", difference.concepts], ["Relationships", difference.relationships] ] as const).map(([label, rows]) => rows.length > 0 &&
      <section key={label} className="anatomy-graph-diff">
        <h3>{label}</h3>
        {rows.map(row => <details key={row.id}>
          <summary><strong>{row.kind === "restore" ? "Restore from trash" : row.kind}</strong> · {row.title}{row.fields.length ? ` · ${row.fields.join(", ")}` : ""}</summary>
          {(row.fields.length ? row.fields : [""]).map(field => <div key={field}>
            {field && <h4>{field.replace(/([A-Z])/g, " $1")}</h4>}
            <div className="anatomy-diff-values">
              {row.before !== undefined && <div><strong>Before</strong><Facts value={field ? (row.before as Record<string, unknown>)[field] : row.before} /></div>}
              {row.after !== undefined && <div><strong>After</strong><Facts value={field ? (row.after as Record<string, unknown>)[field] : row.after} /></div>}
            </div>
          </div>)}
        </details>)}
      </section>)}
    {error && <p role="alert" className="anatomy-error">{error}</p>}
    <div className="anatomy-dialog-actions">
      <button disabled={busy} onClick={() => exportPlan(plan)}>Export review</button>
      <button disabled={busy} onClick={() => void refresh()}>Review latest canvas</button>
      {canEdit && <button disabled={busy || !count || !!error} onClick={() => void apply()}>{busy ? "Working…" : "Apply reviewed changes"}</button>}
    </div>
  </Dialog>;
}
