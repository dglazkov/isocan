import { useCallback, useEffect, useRef, useState } from "react";
import type { CanvasContents, ContextManifest, NewComment } from "@isocan/core";
import { collectItemRefCandidates, extractItemRefs } from "@isocan/core";
import { fetchContextManifest } from "./api.ts";
import { useCanvasStore, type sendEchoedResult } from "../stores/canvasStore.ts";

/** Selection and explicit references are provenance; only the home deduplicates their closures. */
export function messageContextRoots(canvas: CanvasContents | null, body: string, attached: string[] = []): string[] {
  return [...new Set([...attached, ...(canvas ? extractItemRefs(body, collectItemRefCandidates(canvas)) : [])])];
}

/**
 * **The preview follows the canvas; nobody refreshes it.**
 *
 * It used to stay fixed while the canvas changed, and every message carried
 * the preview's revision as `expectedRevision`, which the home refuses if ANY
 * operation landed since — on a canvas where wires fill in and agents work,
 * nearly always. People saw "refresh the context before sending" and lost the
 * message (Dion, 23 Sep 2026: "the user should never have to do any of this
 * refresh context stuff"). Now the preview rebuilds itself shortly after the
 * canvas moves, and a message sends its roots and override only: the home
 * freezes the context at the moment the message lands, and that frozen
 * manifest is what the sent comment shows ("Frozen when sent"). The home's
 * revision check remains for callers that ask for it explicitly.
 */
export function useMessageContext(canvasId: string, roots: string[]) {
  const mode = useCanvasStore((state) => state.project?.groupMode);
  const lastSeq = useCanvasStore((state) => state.lastSeq);
  const [includeExcluded, setIncludeExcluded] = useState(false);
  const [revision, setRevision] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; manifest: ContextManifest } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const enabled = mode === "groups" && roots.length > 0;
  const key = JSON.stringify([canvasId, roots, includeExcluded, revision]);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const [id, ids, override] = JSON.parse(key) as [string, string[], boolean, number];
    void fetchContextManifest(id, ids, override).then((manifest) => {
      if (!cancelled) { setLoaded({ key, manifest }); setFailure(null); }
    }, (err: Error) => { if (!cancelled) setFailure({ key, message: err.message }); });
    return () => { cancelled = true; };
  }, [key, enabled]);
  const manifest = enabled && loaded?.key === key ? loaded.manifest : null;
  const error = failure?.key === key ? failure.message : null;
  const request = manifest ? messageContextRequest(roots, includeExcluded) : undefined;
  const stale = Boolean(manifest && lastSeq > manifest.revision);
  // Rebuild quietly once the canvas has settled for a moment, so a canvas that
  // writes every second is not asked for a manifest every second.
  useEffect(() => {
    if (!stale) return;
    const timer = setTimeout(refresh, 600);
    return () => clearTimeout(timer);
  }, [stale, lastSeq, refresh]);
  return { enabled, manifest, request, includeExcluded, setIncludeExcluded, refresh, error, loading: enabled && !manifest && !error, stale };
}

/** What a message asks the home to freeze: its roots and the person's override — never a revision to be refused over. */
export function messageContextRequest(roots: readonly string[], includeExcluded: boolean): NonNullable<NewComment["contextRequest"]> {
  return { rootIds: [...roots], includeExcluded };
}

/** Attach only a request: persisted IDs and versions must be supplied by the writer. */
export function withMessageContext(comment: NewComment, request?: NewComment["contextRequest"]): NewComment {
  return request ? { ...comment, contextRequest: request } : comment;
}

/** Refusal keeps a reviewable draft; a queued message cannot be submitted a second time. */
export function useMessageSend(canvasId: string, context: ReturnType<typeof useMessageContext>, draft: string) {
  const [busy, setBusy] = useState(false);
  const [queued, setQueued] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const latestDraft = useRef(draft);
  latestDraft.current = draft;
  function finish(result: Awaited<ReturnType<typeof sendEchoedResult>>, accepted: () => void, submittedDraft: string) {
    submitting.current = false;
    if (useCanvasStore.getState().canvasId !== canvasId) return;
    setQueued(false); setError("");
    if (result.status === "accepted") {
      // Inputs remain editable while the request is pending. Its receipt
      // completes only that captured draft, never text written afterward.
      if (latestDraft.current === submittedDraft) accepted();
      context.setIncludeExcluded(false); context.refresh();
    }
    else { setError(result.message ?? "The message was refused. Review and send again."); context.refresh(); }
  }
  async function submit(post: () => ReturnType<typeof sendEchoedResult>, accepted: () => void) {
    if (submitting.current || queued || (context.enabled && !context.request)) return;
    submitting.current = true;
    setBusy(true); setError("");
    try {
      const result = await post();
      if (useCanvasStore.getState().canvasId !== canvasId) return;
      if (result.status === "queued") {
        setQueued(true); setError("Message queued. You can close this composer while waiting for the home; do not send a second copy.");
        void result.completion?.then((outcome) => finish(outcome, accepted, draft));
      } else finish(result, accepted, draft);
    } catch (err) { submitting.current = false; if (useCanvasStore.getState().canvasId === canvasId) setError((err as Error).message); }
    finally { setBusy(false); }
  }
  return { submit, error, disabled: busy || queued || (context.enabled && !context.request) };
}
