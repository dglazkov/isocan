import { Dialog } from "./dialog.tsx";
import { useEffect, useState } from "react";
import type { Item } from "@isocan/core";
import { CHECKPOINT_MIME, NODE_MIME, PROJECT_MIME } from "./manifest.ts";
import { recoverFile, recoveryVersion } from "./recovery.ts";
import type { AnatomyIO } from "./operations.ts";

/** A file-specific recovery preview; metadata and other concepts remain untouched. */
export function RecoveryDialog({ io, item, analysisId, canEdit, close }: { io: AnatomyIO; item: Item; analysisId: string; canEdit: boolean; close: () => void }) {
  const versions = item.versions.filter(v => [PROJECT_MIME, NODE_MIME, CHECKPOINT_MIME].includes(v.mimeType)).slice().reverse();
  const [choice, setChoice] = useState(versions.find(v => v.id !== item.currentVersionId)?.id ?? versions[0]?.id ?? "");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true; setText(""); setError("");
    recoveryVersion(io, item, choice).then(value => { if (live) setText(value.text); }).catch(err => { if (live) setError(err.message); });
    return () => { live = false; };
  }, [io, item, choice]);
  return <Dialog title={`Recover ${item.title}`} close={close}>
    <p>Preview a saved version. Restore creates a new version of this file’s contents. Its title, relationships, position and discussion stay as they are.</p>
    <label>Saved version <select aria-label="Recovery version" value={choice} onChange={e => setChoice(e.target.value)}>{versions.map(v => <option key={v.id} value={v.id}>{v.createdAt} · {v.createdBy.name}{v.id === item.currentVersionId ? " · current" : ""}</option>)}</select></label>
    {text && <pre className="anatomy-recovery-preview">{text}</pre>}
    {error && <p role="alert">{error}</p>}
    {canEdit && <button disabled={busy || !text || choice === item.currentVersionId} onClick={() => {
      setBusy(true); setError("");
      void recoverFile(io, analysisId, item, choice).then(close).catch(err => setError(err.message)).finally(() => setBusy(false));
    }}>Restore file contents</button>}
  </Dialog>;
}
