import { canvasIdOf, checkDesign, contextLayers, designSystem, memoryLinks, parseCanvasAddress, parseDesign, sourceOf, type CanvasSnapshotResponse, type ContextExtras, type ContextLayer, type LinkedCanvas } from "@isocan/core";
import type { Ctx } from "./ctx.ts";

/** Fetch inherited sources once, preserving every unavailable layer and its refusal. */
export async function linkedCanvasesOf(ctx: Ctx, canvasId: string, snapshot: Pick<CanvasSnapshotResponse, "canvas">): Promise<LinkedCanvas[]> {
  const home = (await ctx.homeOf(canvasId).catch(() => null)) ?? ctx.client.base;
  const rows: LinkedCanvas[] = [];
  for (const item of memoryLinks(snapshot.canvas)) {
    const id = canvasIdOf(item)!;
    const address = sourceOf(item);
    const elsewhere = address ? parseCanvasAddress(address)?.origin : null;
    if (elsewhere && elsewhere !== home) {
      rows.push({ item, canvasId: id, title: item.title, canvas: null, refused: `lives at ${elsewhere} — not read from here` });
      continue;
    }
    try {
      const theirs = await ctx.client.snapshot(id);
      rows.push({ item, canvasId: id, title: theirs.project.title, canvas: theirs.canvas });
    } catch (err) {
      rows.push({ item, canvasId: id, title: item.title, canvas: null, refused: (err as Error).message });
    }
  }
  return rows;
}

/** The live layered Context view; machine extras are supplied only by the process that knows them. */
export async function readContextSummary(ctx: Ctx, canvasId: string, extras: ContextExtras = {}): Promise<ContextLayer[]> {
  const snapshot = await ctx.client.snapshot(canvasId);
  const design = designSystem(snapshot.canvas);
  let designProblems: number | undefined;
  let unavailable: string | undefined;
  if (design) {
    const version = design.versions.find((v) => v.id === design.currentVersionId) ?? design.versions[0];
    if (version) {
      try { designProblems = checkDesign(parseDesign((await ctx.client.downloadBlob(canvasId, version.blobHash)).toString("utf8"))).length; }
      catch (err) { unavailable = `Design system could not be read: ${(err as Error).message}`; }
    }
  }
  const layers = contextLayers(snapshot.canvas, await linkedCanvasesOf(ctx, canvasId, snapshot), {
    ...extras, ...(designProblems === undefined ? {} : { designProblems }),
  });
  if (unavailable) {
    const piece = layers[0]?.pieces.find((piece) => piece.name === "Design system");
    if (piece) piece.stale = unavailable;
  }
  return layers;
}
