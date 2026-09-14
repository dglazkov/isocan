import type { CanvasSnapshotResponse, ContextExtras, ContextLayer, LinkedCanvas } from "@isocan/core";
import type { Ctx } from "./ctx.ts";
import { readInheritedCanvases, readLayeredContext, type ContextReadPort } from "./context-reader.ts";
import { DaemonClient } from "./client.ts";

/** Personal inclusion is deliberate; ambient resources retain the existing shared-only default. */
export interface ContextSummaryOptions {
  personal?: "exclude" | { actorId: string };
  signal?: AbortSignal;
}

/** Resolve authoritative context home, preserving a policy-scoped handle's already asserted authority. */
export async function contextHome(ctx: Ctx, canvasId: string): Promise<string> {
  // A policy-scoped handle already asserted this authority on its successful
  // snapshot request. Discovery deliberately omits known link-only sources;
  // asking the catalogue again would refuse an otherwise authorized read.
  if (ctx.sourceContext?.expectedHome) return ctx.sourceContext.expectedHome;
  const homes = await ctx.client.homes();
  if (!(canvasId in homes.canvases)) throw new Error("The canvas's authoritative home is unknown; linked Context was not read.");
  return homes.canvases[canvasId] ?? ctx.client.base;
}

/** Reassert automatic-source policy on every transport read, including version blobs. */
export function automaticSourceClient(ctx: Ctx, expectedHome: string, signal?: AbortSignal): DaemonClient {
  const client = new DaemonClient(ctx.client.base, ctx.home, signal, {
    policy: { mode: "exclude" }, expectedHome, ...(signal ? { signal } : {}),
  });
  ctx.reclaimOn?.(client);
  return client;
}

function port(ctx: Ctx): ContextReadPort {
  return {
    classifySource: (request, signal) => ctx.client.classifySource(request, signal),
    sourceSnapshot: (source, signal) => automaticSourceClient(ctx, source.expectedHome, signal).snapshot(source.canvasId, signal),
    sourceRecap: (source, signal) => automaticSourceClient(ctx, source.expectedHome, signal).recapHead(source.canvasId, signal),
    readPersonal: (id, request, signal) => ctx.client.readPersonal(id, request, signal),
    designText: async (id, hash, signal) => (await ctx.client.downloadBlob(id, hash, signal)).toString("utf8"),
  };
}

/** Fetch only ordinary inherited sources after classification; private sources cannot govern designs. */
export async function linkedCanvasesOf(ctx: Ctx, canvasId: string, snapshot: Pick<CanvasSnapshotResponse, "canvas">): Promise<LinkedCanvas[]> {
  return readInheritedCanvases(port(ctx), snapshot.canvas, await contextHome(ctx, canvasId), ctx.sourceContext?.signal);
}

/** Node adapts transport and bytes; the browser-safe reader owns the layered Context assembly. */
export async function readContextSummary(ctx: Ctx, canvasId: string, extras: ContextExtras = {}, options: ContextSummaryOptions = {}): Promise<ContextLayer[]> {
  const signal = options.signal ?? ctx.sourceContext?.signal;
  const snapshot = await ctx.client.snapshot(canvasId, signal);
  signal?.throwIfAborted();
  return readLayeredContext(port(ctx), {
    canvasId, home: await contextHome(ctx, canvasId), canvas: snapshot.canvas,
    extras, personal: options.personal ?? "exclude", ...(signal ? { signal } : {}),
  });
}
