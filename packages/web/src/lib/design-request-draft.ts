import { useCallback, useMemo, useRef, useState } from "react";
import type { Actor, DesignArtifactRef } from "@isocan/core";
import { newOpId } from "@isocan/core";
import { parseDesignArtifactRef } from "@isocan/core/design-partner";
import { parseDesignRequestOperation, type DesignRecordOperation } from "@isocan/core/design-request";
import { changeDesignRequest, publishDesignReceipt, startDesignRequest } from "@isocan/api/design-request";
import { designRequestWriteIO } from "./design-request.ts";

/** A field draft captures its starting version so concurrent corrections are never silently overwritten. */
export interface DesignFieldDraft { mode: "audience" | "primaryTask" | "constraints" | "fact" | "resume" | "cancel" | "complete"; text: string; factId: string; base: DesignArtifactRef; epoch: number; outputIds: string[] }
/** Persisted field drafts are validated before they can become form state or a conditional edit. */
export function readDesignFieldDraft(raw: string | null): DesignFieldDraft | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || !["audience", "primaryTask", "constraints", "fact", "resume", "cancel", "complete"].includes(value.mode) || typeof value.text !== "string" || typeof value.factId !== "string" || !Number.isSafeInteger(value.epoch) || value.epoch < 1 || !Array.isArray(value.outputIds) || value.outputIds.some((id: unknown) => typeof id !== "string")) return null;
    return { mode: value.mode, text: value.text, factId: value.factId, base: parseDesignArtifactRef(value.base), epoch: value.epoch, outputIds: value.outputIds };
  } catch { return null; }
}
interface PendingDesignIntent { opId: string; operation: DesignRecordOperation }
/** An interrupted delivery restores only a validated canonical intent with its original operation identity. */
export function readPendingDesignIntent(raw: string | null): PendingDesignIntent | null {
  if (!raw) return null;
  try { const value = JSON.parse(raw); return value && typeof value.opId === "string" && value.opId.trim() ? { opId: value.opId, operation: parseDesignRequestOperation(value.operation) } : null; }
  catch { return null; }
}

/** A task act saves its retry before sending and keeps uncertain outcomes immutable until acknowledged. */
export function useDesignMutation(canvasId: string, actor: Actor | null, identity: string, accepted: () => void) {
  const key = `isocan.design.intent.v1:${JSON.stringify([canvasId, actor?.id ?? "reader", identity])}`;
  const ownerKey = useRef(key);
  // Completion follows the latest render without changing the retry callback on every render.
  const acceptedRef = useRef(accepted);
  acceptedRef.current = accepted;
  const [pending, setPending] = useState<PendingDesignIntent | null>(() => { try { return readPendingDesignIntent(localStorage.getItem(key)); } catch { return null; } });
  const pendingRef = useRef(pending);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const [refused, setRefused] = useState(false);
  const [storageError, setStorageError] = useState(() => { try { return localStorage.getItem(key) && !readPendingDesignIntent(localStorage.getItem(key)) ? "An earlier saved action could not be read. It remains in browser storage; review the task before starting a new action." : ""; } catch { return "Browser storage is unavailable. Keep this page open until the action is confirmed."; } });
  const clear = useCallback(() => {
    if (ownerKey.current !== key) return;
    pendingRef.current = null; setPending(null); setRefused(false); setError("");
    try { localStorage.removeItem(key); } catch { setStorageError("The saved retry could not be cleared from browser storage."); }
  }, [key]);
  const run = useCallback(async (operation?: DesignRecordOperation) => {
    if (ownerKey.current !== key) { setError("This saved action belongs to another canvas or person. Reopen this task to restore its own draft."); return; }
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(""); setRefused(false);
    try {
      if (!actor) throw new Error("An identified editor is required to change this task.");
      let intent = pendingRef.current;
      if (!intent) {
        if (!operation) throw new Error("There is no saved action to retry.");
        intent = { opId: newOpId(), operation: parseDesignRequestOperation(operation) };
        // Failure here stops the write: an action whose IDs cannot survive refresh is not sent.
        try { localStorage.setItem(key, JSON.stringify(intent)); }
        catch { throw new Error("The browser could not save this action for retry. Free browser storage before sending it; the action has not been sent."); }
        pendingRef.current = intent; setPending(intent); setStorageError("");
      }
      const io = designRequestWriteIO(actor);
      const op = intent.operation;
      const result = op.type === "design.receipt" ? await publishDesignReceipt(io, { canvasId, opId: intent.opId, ...op })
        : op.action.kind === "start" ? await startDesignRequest(io, { canvasId, opId: intent.opId, action: op.action })
        : await changeDesignRequest(io, { canvasId, opId: intent.opId, action: op.action });
      if (result.status !== "accepted") { setRefused(result.status === "refused"); throw new Error(result.reason ?? "The task action is not yet confirmed. Retry uses the same saved intent."); }
      clear(); acceptedRef.current();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The task action was not confirmed. Its draft remains available."); }
    finally { busyRef.current = false; setBusy(false); }
  }, [actor, canvasId, clear, key]);
  return useMemo(() => ({ run, pending, busy, error, refused, storageError, clear }), [run, pending, busy, error, refused, storageError, clear]);
}
