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

import { useEffect, useState, type ComponentType } from "react";
import type { InspectorFacts, RendererFacts, WebModule } from "@isocan/core";
import { parsePointer, type MemoryPointer } from "@isocan/core/pointer";
import {
  MEMORY_FORGET_ROUTE,
  MEMORY_HYDRATE_ROUTE,
  MEMORY_PROPS,
  POINTER_KIND,
  POINTER_MIME,
  memoryModule,
  type MemoryForgetRequest,
  type MemoryForgetResponse,
  type MemoryHydrateRequest,
  type MemoryHydrateResponse,
} from "./core.ts";

type HydrateState =
  | { kind: "loading" }
  | { kind: "locked"; ownerId?: string }
  | { kind: "forgotten" }
  | { kind: "ready"; data: MemoryHydrateResponse }
  | { kind: "error"; message: string };

/** Request hydration of a pointer item from the home. */
export async function requestPointerHydrate(
  req: MemoryHydrateRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<{ status: number; body: MemoryHydrateResponse | { locked?: boolean; forgotten?: boolean; ownerId?: string; error?: string } | null }> {
  const res = await fetchImpl(MEMORY_HYDRATE_ROUTE, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  const body = (await res.json().catch(() => null)) as
    | MemoryHydrateResponse
    | { locked?: boolean; forgotten?: boolean; ownerId?: string; error?: string }
    | null;
  return { status: res.status, body };
}

/** Request source-level Forget of a memory item from the home. */
export async function requestMemoryForget(
  req: MemoryForgetRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<{ status: number; body: MemoryForgetResponse | { error?: string } | null }> {
  const res = await fetchImpl(MEMORY_FORGET_ROUTE, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  const body = (await res.json().catch(() => null)) as MemoryForgetResponse | { error?: string } | null;
  return { status: res.status, body };
}

function resolvePointerTarget(ref: string, fallbackCanvasId: string): { canvasId: string; itemId: string } {
  const colonIdx = ref.indexOf(":");
  if (colonIdx > 0) {
    return { canvasId: ref.slice(0, colonIdx), itemId: ref.slice(colonIdx + 1) };
  }
  return { canvasId: fallbackCanvasId, itemId: ref };
}

function PointerCard(facts: RendererFacts) {
  const [pointer, setPointer] = useState<MemoryPointer | null>(null);
  const [state, setState] = useState<HydrateState>({ kind: "loading" });
  const [forgetting, setForgetting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = facts.readText
          ? await facts.readText()
          : await fetch(facts.url).then((r) => r.text());
        const parsed = parsePointer(raw);
        if (!cancelled) setPointer(parsed);
        if (!facts.canvasId || !facts.item?.id) {
          if (!cancelled) setState({ kind: "locked", ...(parsed?.ownerId ? { ownerId: parsed.ownerId } : {}) });
          return;
        }
        const res = await requestPointerHydrate({
          canvasId: facts.canvasId,
          itemId: facts.item.id,
        });
        if (cancelled) return;
        if (res.status === 403) {
          const lockedBody = res.body as { ownerId?: string } | null;
          const owner = lockedBody?.ownerId ?? parsed?.ownerId;
          setState({ kind: "locked", ...(owner ? { ownerId: owner } : {}) });
          return;
        }
        if (res.status === 410 || (res.body && "forgotten" in res.body && res.body.forgotten)) {
          setState({ kind: "forgotten" });
          return;
        }
        if (res.status === 200 && res.body && "text" in res.body) {
          setState({ kind: "ready", data: res.body });
          return;
        }
        setState({
          kind: "error",
          message: (res.body as { error?: string } | null)?.error ?? `hydrate answered ${res.status}`,
        });
      } catch (err) {
        if (!cancelled) {
          setState({ kind: "error", message: err instanceof Error ? err.message : "Failed to hydrate pointer" });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [facts.blobHash, facts.canvasId, facts.item?.id, facts.url]);

  async function onForget() {
    if (forgetting || !facts.canvasId || !facts.item?.id) return;
    setForgetting(true);
    try {
      const target = pointer
        ? resolvePointerTarget(pointer.ref, facts.canvasId)
        : { canvasId: facts.canvasId, itemId: facts.item.id };
      const res = await requestMemoryForget({
        canvasId: target.canvasId,
        itemId: target.itemId,
      });
      if (res.status === 200) {
        setState({ kind: "forgotten" });
      } else {
        setState({
          kind: "error",
          message: (res.body as { error?: string } | null)?.error ?? `forget answered ${res.status}`,
        });
      }
    } finally {
      setForgetting(false);
    }
  }

  const facet = pointer?.facet ?? facts.item?.properties?.[MEMORY_PROPS.facet];

  return (
    <div
      className="memory-pointer-card"
      data-locked={state.kind === "locked" ? "true" : "false"}
      data-forgotten={state.kind === "forgotten" ? "true" : "false"}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        padding: "12px",
        height: "100%",
        boxSizing: "border-box",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", fontSize: "11px", opacity: 0.8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              padding: "2px 6px",
              borderRadius: "4px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              border: "1px solid currentColor",
            }}
          >
            {state.kind === "locked" ? "Locked memory" : state.kind === "forgotten" ? "Forgotten" : "Memory"}
          </span>
          {facet ? <span>{facet}</span> : null}
        </div>
        {state.kind === "ready" ? (
          <button
            type="button"
            className="memory-pointer-forget-btn"
            disabled={forgetting}
            onClick={() => void onForget()}
            style={{
              fontSize: "11px",
              padding: "2px 6px",
              borderRadius: "4px",
              border: "1px solid currentColor",
              background: "transparent",
              color: "inherit",
              cursor: forgetting ? "default" : "pointer",
            }}
          >
            {forgetting ? "Forgetting…" : "Forget"}
          </button>
        ) : null}
      </div>

      {state.kind === "loading" ? (
        <p style={{ margin: 0, fontSize: "12px", opacity: 0.7 }}>Checking memory access…</p>
      ) : state.kind === "locked" ? (
        <p className="memory-pointer-locked" style={{ margin: 0, fontSize: "12px", opacity: 0.75 }}>
          Private memory pointer — visible only to its owner.
        </p>
      ) : state.kind === "forgotten" ? (
        <p className="memory-pointer-forgotten" style={{ margin: 0, fontSize: "12px", opacity: 0.75 }}>
          This memory has been forgotten.
        </p>
      ) : state.kind === "error" ? (
        <p style={{ margin: 0, fontSize: "12px", opacity: 0.75 }}>{state.message}</p>
      ) : (
        <p className="memory-pointer-text" style={{ margin: 0, fontSize: "12px", lineHeight: 1.4 }}>
          {state.data.text || state.data.title}
        </p>
      )}
    </div>
  );
}

function MemoryInspector({ canvasId, item, host }: InspectorFacts) {
  const facet = item.properties[MEMORY_PROPS.facet] ?? "";
  const ownerId = item.properties[MEMORY_PROPS.ownerId] ?? "";
  const isOwner = !ownerId || host.viewer.id === ownerId;
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onHydrate() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await requestPointerHydrate({ canvasId, itemId: item.id, actor: host.viewer });
      if (res.status === 403) {
        setStatus("Locked — private to owner.");
      } else if (res.status === 410 || (res.body && "forgotten" in res.body && res.body.forgotten)) {
        setStatus("Forgotten — source observation was removed.");
      } else if (res.status === 200 && res.body && "text" in res.body) {
        setStatus(res.body.text || res.body.title);
      } else {
        setStatus((res.body as { error?: string } | null)?.error ?? `Status ${res.status}`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function onForget() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await requestMemoryForget({ canvasId, itemId: item.id, actor: host.viewer });
      if (res.status === 200) {
        setStatus("Forgotten — permanently excluded from recall and hydration.");
      } else {
        setStatus((res.body as { error?: string } | null)?.error ?? `Status ${res.status}`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="memory-inspector" aria-label="Memory pointer details">
      <p>
        <strong>Owner:</strong> {ownerId || "unknown"}
        {facet ? ` · ${facet}` : ""}
      </p>
      {status ? <p className="memory-inspector-status">{status}</p> : null}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button type="button" className="btn" disabled={busy} onClick={() => void onHydrate()}>
          {busy ? "Checking…" : "Hydrate pointer"}
        </button>
        {isOwner ? (
          <button type="button" className="btn" disabled={busy} onClick={() => void onForget()}>
            {busy ? "Working…" : "Forget"}
          </button>
        ) : null}
      </div>
    </section>
  );
}

export const memoryWeb: WebModule<
  never,
  ComponentType<RendererFacts>,
  ComponentType<InspectorFacts>
> = {
  core: memoryModule,
  renderers: [
    {
      mimes: [POINTER_MIME],
      component: PointerCard,
    },
  ],
  inspectors: [
    {
      kinds: [POINTER_KIND.id],
      label: "Memory",
      component: MemoryInspector,
    },
  ],
};

export default memoryWeb;
