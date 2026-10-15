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
 * - Messages from any origin other than the content origin (`contentOrigin`)
 *   are ignored.
 * - Messages carrying an unknown protocol version are refused (`bad-version`)
 *   rather than guessed at.
 * - Messages naming an operation outside the vocabulary are refused
 *   (`unknown-op` / `internal-op`) — a panel proposing a new op is proposing
 *   a product feature and is told so — and nothing is written.
 * - The bridge replies with ONLY a frozen {@link PanelOpResult}: no store, no
 *   client, no badge, no bearer token, and no snapshot.
 */
export interface PanelBridgeOptions {
  canvasId: string;
  itemId: string;
  /** The content origin (`origin.base`), e.g. `http://127.0.0.1:4442`. */
  contentOrigin: string;
  /** Optional window/source check so only this panel's `<iframe>` is answered. */
  frameWindow?: () => MessageEventSource | null;
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
export async function submitPanelOp(
  canvasId: string,
  itemId: string,
  op: Operation,
  requestId?: string,
  fetchImpl: typeof fetch = fetch,
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
 * content origin. Returns the teardown function.
 */
export function bridgePanelFrame(options: PanelBridgeOptions): () => void {
  const {
    canvasId,
    itemId,
    contentOrigin,
    frameWindow,
    win = typeof window !== "undefined" ? window : undefined,
    fetchImpl = fetch,
    onReply,
  } = options;
  if (!win || !contentOrigin || contentOrigin === "null") return () => {};

  const onMessage = (e: MessageEvent) => {
    // 1. Only messages from the content origin are ever read or answered.
    if (e.origin !== contentOrigin) return;
    // 2. When a specific panel iframe window is bound, ignore other frames.
    if (frameWindow) {
      const expected = frameWindow();
      if (expected !== null && e.source !== null && e.source !== expected) return;
    }
    const parsed = readPanelOpMessage(e.data);
    if (parsed === null) return;

    const replyToFrame = (result: PanelOpResult) => {
      onReply?.(result, contentOrigin);
      const target = e.source ?? frameWindow?.() ?? null;
      if (target && "postMessage" in target && typeof target.postMessage === "function") {
        (target as Window).postMessage(result, contentOrigin);
      }
    };

    if (!parsed.ok) {
      replyToFrame(
        panelOpResult({ ok: false, code: parsed.code, error: parsed.error }, parsed.requestId),
      );
      return;
    }

    void submitPanelOp(canvasId, itemId, parsed.op, parsed.requestId, fetchImpl).then(
      replyToFrame,
      (err: unknown) => {
        const message = err instanceof Error ? err.message : "panel operation failed";
        replyToFrame(panelOpResult({ ok: false, code: "offline", error: message }, parsed.requestId));
      },
    );
  };

  win.addEventListener("message", onMessage as EventListener);
  return () => {
    win.removeEventListener("message", onMessage as EventListener);
  };
}
