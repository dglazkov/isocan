import {
  CLIENT_FEATURES_HEADER,
  CURRENT_CLIENT_FEATURES,
  newOpId,
  panelActorRoute,
  panelOpResult,
  readPanelOpMessage,
  type Operation,
  type PanelActorResponse,
  type PanelOpResult,
  type PostOpResponse,
} from "@isocan/core";
import { ApiError, postOp } from "./api.ts";

/**
 * **The narrow door** (`docs/projects/extensions/phases.md`, phase 6).
 *
 * A hosted panel in the dock talks to isocan over `postMessage`, and the API
 * it gets is narrow, versioned, and made of operations — never a handle to
 * internal state. Every message is an `Operation` the vocabulary already has,
 * stamped with the panel's actor (`ext_…`) from phase 5 and sent through the
 * same `/api/ops` door a person's op goes through.
 *
 * - Only the bound live panel window with its sandbox's opaque (`null`)
 *   origin is accepted. Its bytes still load from the content origin.
 * - Messages carrying an unknown protocol version are refused (`bad-version`)
 *   rather than guessed at.
 * - Messages naming an operation outside the vocabulary are refused
 *   (`unknown-op` / `internal-op`) — a panel proposing a new op is proposing
 *   a product feature and is told so — and nothing is written.
 * - The bridge replies with ONLY a frozen {@link PanelOpResult}: no store, no
 *   client, no badge, no bearer token, and no snapshot.
 */
interface PanelBridgeOptions {
  canvasId: string;
  itemId: string;
  /** Required live-window check; a null or replaced frame has no authority. */
  frameWindow: () => Window | null;
  /** Window to listen on (defaults to `window`). */
  win?: Pick<Window, "addEventListener" | "removeEventListener">;
  /** Optional custom `fetch` implementation for testing. */
  fetchImpl?: typeof fetch;
  /** Optional observer invoked whenever a `PanelOpResult` is posted back to the frame. */
  onReply?: (result: PanelOpResult, targetOrigin: string) => void;
}

const panelCredentials = new Map<string, Promise<PanelActorResponse>>();

function credentialKey(canvasId: string, itemId: string): string {
  return `${canvasId}:${itemId}`;
}

async function resolvePanelCredential(
  canvasId: string,
  itemId: string,
  fetchImpl: typeof fetch,
): Promise<{ ok: true; credential: PanelActorResponse } | { ok: false; code: string; error: string }> {
  const key = credentialKey(canvasId, itemId);
  let pending = panelCredentials.get(key);
  if (!pending) {
    pending = (async () => {
      const res = await fetchImpl(panelActorRoute(canvasId, itemId), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [CLIENT_FEATURES_HEADER]: CURRENT_CLIENT_FEATURES,
        },
        body: JSON.stringify({}),
      });
      const json = (await res.json().catch(() => null)) as
        | (PanelActorResponse & { error?: string; code?: string })
        | null;
      if (!res.ok || !json || typeof json.token !== "string") {
        const err = new Error(json?.error ?? `HTTP ${res.status}`) as Error & { code?: string };
        err.code = json?.code ?? "not-admitted";
        throw err;
      }
      return json;
    })();
    panelCredentials.set(key, pending);
  }
  try {
    return { ok: true, credential: await pending };
  } catch (err) {
    panelCredentials.delete(key);
    const e = err as { message?: string; code?: string };
    return {
      ok: false,
      code: e.code ?? "not-admitted",
      error: e.message ?? "panel is not admitted to this canvas",
    };
  }
}

/**
 * Send one validated `Operation` through `/api/ops` stamped with the panel's
 * own actor (`ext_…`) and bearer credential, returning ONLY the sanitized
 * {@link PanelOpResult}.
 */
async function submitPanelOp(
  canvasId: string,
  itemId: string,
  op: Operation,
  requestId?: string,
  fetchImpl: typeof fetch = fetch,
  isLive: () => boolean = () => true,
): Promise<PanelOpResult> {
  const checked = readPanelOpMessage({
    type: "isocan:panel-op",
    version: 1,
    ...(requestId !== undefined ? { requestId } : {}),
    op,
  });
  if (!checked || !checked.ok) {
    return panelOpResult(
      {
        ok: false,
        code: checked?.code ?? "bad-op",
        error: checked?.error ?? "invalid panel operation",
      },
      requestId,
    );
  }
  const auth = await resolvePanelCredential(canvasId, itemId, fetchImpl);
  // Enrollment may finish after the panel was closed or replaced. Never turn
  // that late result into a new write under the previous frame's authority.
  if (!isLive()) return panelOpResult({ ok: false, code: "detached", error: "panel was detached" }, requestId);
  if (!auth.ok) {
    return panelOpResult({ ok: false, code: auth.code, error: auth.error }, requestId);
  }
  if (fetchImpl !== fetch) {
    return submitPanelOpWithFetch(canvasId, itemId, auth.credential, checked.op, requestId, fetchImpl);
  }
  try {
    const json = await postOp(
      canvasId,
      auth.credential.actor,
      checked.op,
      newOpId(),
      undefined,
      undefined,
      undefined,
      { headers: { Authorization: `Bearer ${auth.credential.token}` } },
    );
    return panelOpResult({ ok: true, seq: json.seq, id: json.envelope.id }, requestId);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      panelCredentials.delete(credentialKey(canvasId, itemId));
    }
    const code = err instanceof ApiError ? (err.code ?? "refused") : "offline";
    const error = err instanceof Error ? err.message : "panel operation failed";
    return panelOpResult({ ok: false, code, error }, requestId);
  }
}

async function submitPanelOpWithFetch(
  canvasId: string,
  itemId: string,
  credential: PanelActorResponse,
  op: Operation,
  requestId: string | undefined,
  fetchImpl: typeof fetch,
): Promise<PanelOpResult> {
  const opsUrl = ["", "api", "ops"].join("/");
  const res = await fetchImpl(opsUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [CLIENT_FEATURES_HEADER]: CURRENT_CLIENT_FEATURES,
      Authorization: `Bearer ${credential.token}`,
    },
    body: JSON.stringify({
      canvasId,
      actor: credential.actor,
      opId: newOpId(),
      op,
    }),
  });
  const json = (await res.json().catch(() => null)) as
    | (PostOpResponse & { error?: string; code?: string })
    | null;
  if (!res.ok || !json || typeof json.seq !== "number" || !json.envelope?.id) {
    if (res.status === 401 || res.status === 403) {
      panelCredentials.delete(credentialKey(canvasId, itemId));
    }
    return panelOpResult(
      {
        ok: false,
        code: json?.code ?? "refused",
        error: json?.error ?? `HTTP ${res.status}`,
      },
      requestId,
    );
  }
  return panelOpResult({ ok: true, seq: json.seq, id: json.envelope.id }, requestId);
}

/** Clear cached panel credentials (for tests). */
export function clearPanelBridgeCredentials(): void {
  panelCredentials.clear();
}

/**
 * Attach the narrow `postMessage` bridge for a hosted panel `<iframe>` on the
 * content origin under an opaque sandbox. Returns the teardown function.
 */
export function bridgePanelFrame(options: PanelBridgeOptions): () => void {
  const {
    canvasId,
    itemId,
    frameWindow,
    win = typeof window !== "undefined" ? window : undefined,
    fetchImpl = fetch,
    onReply,
  } = options;
  const target = frameWindow?.();
  if (!win || !target) return () => {};
  let attached = true;
  const isLive = () => attached && frameWindow() === target;

  const onMessage = (e: MessageEvent) => {
    // Opaque origins all serialize to "null"; that string alone grants nothing.
    if (!isLive() || e.origin !== "null" || e.source !== target) return;
    const parsed = readPanelOpMessage(e.data);
    if (parsed === null) return;

    const replyToFrame = (result: PanelOpResult) => {
      if (!isLive()) return;
      // Opaque destinations require '*'. It is sent only to the captured,
      // still-live window, never to a broadcast or a replacement frame.
      target.postMessage(result, "*");
      onReply?.(result, "*");
    };

    if (!parsed.ok) {
      replyToFrame(
        panelOpResult({ ok: false, code: parsed.code, error: parsed.error }, parsed.requestId),
      );
      return;
    }

    void submitPanelOp(canvasId, itemId, parsed.op, parsed.requestId, fetchImpl, isLive).then(
      replyToFrame,
      (err: unknown) => {
        const message = err instanceof Error ? err.message : "panel operation failed";
        replyToFrame(panelOpResult({ ok: false, code: "offline", error: message }, parsed.requestId));
      },
    );
  };

  win.addEventListener("message", onMessage as EventListener);
  return () => {
    attached = false;
    win.removeEventListener("message", onMessage as EventListener);
  };
}
