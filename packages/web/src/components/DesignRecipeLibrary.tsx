import { useEffect, useState } from "react";
import { parseDesign, workbenchItemPath, type Actor } from "@isocan/core";
import { designRecipes, readDesignRecipe, type DesignRecipe } from "@isocan/api/design-recipes";
import type { DesignSystemTarget } from "@isocan/api/design-system";
import { readDesignDirection } from "@isocan/core/design-direction";
import { directionFields, type DirectionFields } from "../lib/design-system-draft.ts";
import { getSnapshot, postOp, uploadBlob } from "../lib/api.ts";
import { selectCreatedItems } from "../lib/groupplacement.ts";
import { saveDesignFile } from "./DesignSystemsDialog.tsx";

import { prepareDesignReference, submitDesignReference } from "../lib/design-reference-submit.ts";
import { readPendingDesignReference, type PendingDesignReference as PendingReference } from "../lib/design-reference-draft.ts";

/** The library offers inspectable running work, source and direction as separate choices. */
export function DesignRecipeLibrary({ canvasId, actor, target, canEdit, canAdapt, onAdded, onDirection }: { canvasId: string; actor: Actor; target: DesignSystemTarget; canEdit: boolean; canAdapt: boolean; onAdded: () => void; onDirection: (fields: DirectionFields) => void }) {
  const [selected, setSelected] = useState("");
  return <section className="design-recipe-library" aria-label="Working design references"><h3>Start from a working reference</h3><p>Inspect a complete task, then adapt the parts that fit. Existing product components and tokens take precedence.</p><div className="design-recipe-options">{designRecipes().map((recipe) => <button className="design-recipe-choice" key={recipe.id} aria-pressed={selected === recipe.id} onClick={() => setSelected(recipe.id)}><small>{recipe.surface}</small><strong>{recipe.title}</strong><span>{recipe.summary}</span></button>)}</div>{selected && <Recipe key={JSON.stringify([canvasId, actor.id, target, selected])} id={selected} canvasId={canvasId} actor={actor} target={target} canEdit={canEdit} canAdapt={canAdapt} onAdded={onAdded} onDirection={onDirection} />}</section>;
}

function Recipe({ id, canvasId, actor, target, canEdit, canAdapt, onAdded, onDirection }: { id: string; canvasId: string; actor: Actor; target: DesignSystemTarget; canEdit: boolean; canAdapt: boolean; onAdded: () => void; onDirection: (fields: DirectionFields) => void }) {
  const [recipe, setRecipe] = useState<DesignRecipe | null>(null), [tab, setTab] = useState<"preview" | "html" | "design">("preview");
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [added, setAdded] = useState(""), [notice, setNotice] = useState(""), [storageError, setStorageError] = useState("");
  const key = `isocan.design.reference.v1:${JSON.stringify([canvasId, actor.id, target, id])}`;
  const [pending, setPending] = useState<PendingReference | null>(null), [restoring, setRestoring] = useState(true), [corrupt, setCorrupt] = useState(false);
  useEffect(() => { let current = true; void readDesignRecipe(id).then((value) => { if (current) setRecipe(value); }).catch((cause) => { if (current) setError(String(cause)); }); return () => { current = false; }; }, [id]);
  useEffect(() => { let active = true; void (async () => { try { const raw = localStorage.getItem(key); if (raw) { const value = await readPendingDesignReference(raw, canvasId, actor.id); if (active) setPending(value); } } catch { if (active) setCorrupt(true); } finally { if (active) setRestoring(false); } })(); return () => { active = false; }; }, [key, canvasId, actor.id]);
  const keep = (value: PendingReference | null): boolean => {
    setPending(value);
    try { if (value) localStorage.setItem(key, JSON.stringify(value)); else localStorage.removeItem(key); setStorageError(""); return true; }
    catch { setStorageError("The reference intent could not be updated in browser storage. Keep this page open; its current state remains in memory."); return false; }
  };
  async function add(kind: "html" | "design") {
    if (!recipe || busy || !canEdit) return; setBusy(true); setError(""); setNotice("");
    let intent = pending;
    try {
      if (!intent) {
        const snapshot = await getSnapshot(canvasId);
        if (snapshot.project.id !== canvasId) throw new Error("The reference target returned a different canvas.");
        intent = await prepareDesignReference(snapshot, actor, target, { title: kind === "html" ? recipe.title : `${recipe.title} · design`, text: kind === "html" ? recipe.html : recipe.design, filename: kind === "html" ? recipe.htmlFilename : "DESIGN.md", kind });
        if (!keep(intent)) return;
      }
      const outcome = await submitDesignReference({ snapshot: getSnapshot,
        upload: (saved) => uploadBlob(saved.canvasId, new Blob([saved.text], { type: saved.operation.version.mimeType }), saved.operation.version.filename),
        send: (saved, author) => postOp(saved.canvasId, author, saved.operation, saved.opId, undefined, saved.originGroupMode),
      }, intent, actor, !!pending && !pending.refused);
      if (outcome.status === "accepted") {
        // Receipt identity settles first. Optional storage/reveal/refresh cannot turn it into another submission.
        setAdded(outcome.itemId);
        setNotice(`Reference added. ${outcome.consistency.status === "current" ? "Its saved content and destination are current." : outcome.consistency.reason ?? "Current consistency could not be confirmed."}`);
        keep(null);
        try { selectCreatedItems(canvasId, [outcome.itemId]); onAdded(); }
        catch { setNotice(`Reference added. Its selection or refreshed view could not be shown; open the saved reference below. ${outcome.consistency.reason ?? ""}`); }
      } else { keep({ ...intent, refused: outcome.status === "refused" }); setError(`${outcome.status === "pending" ? "Awaiting confirmation. " : "Add refused. "}${outcome.reason}`); }
    } catch (cause) {
      // Unexpected failures retain uncertainty. Only the transport helper can establish a known refusal.
      if (intent) keep({ ...intent, refused: false });
      setError(cause instanceof Error ? cause.message : "This reference could not be prepared.");
    } finally { setBusy(false); }
  }
  if (!recipe) return <p role="status">{error || "Opening reference…"}</p>;
  const direction = readDesignDirection(parseDesign(recipe.design));
  return <div className="design-recipe-open"><header><h4>{recipe.title}</h4><span>For {recipe.audience.toLowerCase()}</span></header><nav aria-label="Reference view">{(['preview', 'html', 'design'] as const).map((name) => <button className="btn secondary" key={name} aria-pressed={tab === name} onClick={() => setTab(name)}>{name === "html" ? "HTML source" : name === "design" ? "Design & rationale" : "Run preview"}</button>)}</nav>
    {tab === "preview" ? <><p className="design-system-help">Temporary preview. Add or download the HTML to keep it as your own working reference.</p><iframe className="design-recipe-preview" title={`${recipe.title} working preview`} sandbox="allow-scripts allow-forms" srcDoc={recipe.html} /></> : <pre className="design-recipe-source">{tab === "html" ? recipe.html : recipe.design}</pre>}
    <p className="design-system-help">States to inspect: {recipe.states.join(" · ")}</p><div className="design-system-actions"><button className="btn secondary" onClick={() => saveDesignFile(recipe.html, recipe.htmlFilename, "text/html")}>Download HTML</button><button className="btn secondary" onClick={() => saveDesignFile(recipe.design, "DESIGN.md", "text/markdown")}>Download DESIGN.md</button>{canAdapt && direction.status === "valid" && <button className="btn secondary" onClick={() => onDirection(directionFields(direction.direction))}>Adapt this direction in my draft</button>}</div>
    {corrupt && <p role="alert">An earlier add could not be read and is preserved in browser storage. Check canvas history before starting another reference.</p>}{error && <p role="alert">{error}</p>}{storageError && <p role="alert">{storageError}</p>}{notice && <p role="status">{notice}</p>}{added && <a href={workbenchItemPath(canvasId, added)}>Open the added reference</a>}
    {canEdit && !corrupt && !restoring && <div className="design-system-actions">{pending ? <><button className="btn primary" disabled={busy} onClick={() => void add(pending.operation.version.mimeType === "text/html" ? "html" : "design")}>Retry exact reference add</button>{pending.refused && <button className="btn secondary" disabled={busy} onClick={() => { try { keep(null); } catch { setError("The draft could not be cleared."); } }}>Clear refused add</button>}</> : <><button className="btn primary" disabled={busy} onClick={() => void add("html")}>Add runnable reference</button><button className="btn secondary" disabled={busy} onClick={() => void add("design")}>Create this system in this scope</button></>}</div>}
  </div>;
}
