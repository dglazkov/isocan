import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  canvasIdOf,
  checkDesign,
  contextLayers,
  designSystem,
  memoryLinks,
  normalizeHomeUrl,
  parseCanvasAddress,
  personalMemoryLinks,
  sourceOf
} from "./chunk-DEUAWJHO.mjs";
import {
  parseDesign
} from "./chunk-7OLMWXEB.mjs";

// packages/api/src/context-reader.ts
function failure(error) {
  return error instanceof Error ? error.message : String(error);
}
async function classifyAutomaticSource(io, target, signal) {
  signal?.throwIfAborted();
  let home;
  try {
    const url = new URL(target.home);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("invalid home");
    home = normalizeHomeUrl(target.home);
  } catch {
    return { kind: "unavailable", refused: "The source's authoritative home is unknown \u2014 not read from here." };
  }
  if (!target.canvasId) return { kind: "unavailable", refused: "This card has no source canvas address." };
  if (target.source) {
    let address;
    try {
      address = parseCanvasAddress(target.source);
    } catch {
      address = null;
    }
    if (!address || address.canvasId !== target.canvasId) return { kind: "unavailable", refused: "This card's source address does not match its canvas." };
    if (normalizeHomeUrl(address.origin) !== home) return { kind: "unavailable", refused: `lives at ${address.origin} \u2014 not read from here` };
  }
  try {
    const answer = await io.classifySource({ canvasId: target.canvasId, expectedHome: home }, signal);
    signal?.throwIfAborted();
    if (answer.kind === "ordinary") return { kind: "ordinary", expectedHome: home };
    if (answer.kind === "personal") return { kind: "personal", refused: "Personal canvas \u2014 automatic previews and inheritance are private." };
    return { kind: "unavailable", refused: "The source's authoritative home could not classify it \u2014 not read from here." };
  } catch (error) {
    signal?.throwIfAborted();
    return { kind: "unavailable", refused: failure(error) };
  }
}
async function readInheritedCanvases(io, canvas, home, signal) {
  const linked = [];
  for (const item of memoryLinks(canvas)) {
    signal?.throwIfAborted();
    const canvasId = canvasIdOf(item);
    const row = { item, canvasId, title: item.title, canvas: null };
    const access = await classifyAutomaticSource(io, { canvasId, home, source: sourceOf(item) }, signal);
    if (access.kind !== "ordinary") {
      linked.push({ ...row, refused: access.refused });
      continue;
    }
    try {
      const snapshot = await io.sourceSnapshot({ canvasId, expectedHome: access.expectedHome }, signal);
      signal?.throwIfAborted();
      linked.push({ item, canvasId, title: snapshot.project.title, canvas: snapshot.canvas });
    } catch (error) {
      signal?.throwIfAborted();
      linked.push({ ...row, refused: failure(error) });
    }
  }
  return linked;
}
async function readLayeredContext(io, options) {
  const { canvas, canvasId, home, signal } = options;
  signal?.throwIfAborted();
  let designProblems;
  let unavailable;
  const design = designSystem(canvas);
  const version = design?.versions.find((one) => one.id === design.currentVersionId);
  if (version && io.designText) {
    try {
      const text = await io.designText(canvasId, version.blobHash, signal);
      signal?.throwIfAborted();
      designProblems = checkDesign(parseDesign(text)).length;
    } catch (error) {
      signal?.throwIfAborted();
      unavailable = `Design system could not be read: ${failure(error)}`;
    }
  }
  const inherited = await readInheritedCanvases(io, canvas, home, signal);
  for (const link of inherited) {
    signal?.throwIfAborted();
    if (!link.canvas) continue;
    try {
      if (!io.sourceRecap) throw new Error("Recent work is unavailable from this connection.");
      const response = await io.sourceRecap({ canvasId: link.canvasId, expectedHome: normalizeHomeUrl(home) }, signal);
      signal?.throwIfAborted();
      let sourceHome = null;
      try {
        const parsed = new URL(response.home);
        if (["http:", "https:"].includes(parsed.protocol)) sourceHome = normalizeHomeUrl(response.home);
      } catch {
      }
      if (response.canvasId !== link.canvasId || sourceHome !== normalizeHomeUrl(home)) {
        throw new Error("Recent work returned a different source \u2014 not shown.");
      }
      link.recap = { value: response };
    } catch (error) {
      signal?.throwIfAborted();
      link.recap = { refused: failure(error) };
    }
  }
  const layers = contextLayers(canvas, inherited, { ...options.extras, ...designProblems === void 0 ? {} : { designProblems } });
  if (unavailable) {
    const piece = layers[0]?.pieces.find((one) => one.name === "Design system");
    if (piece) piece.stale = unavailable;
  }
  if (options.personal === "exclude") return layers;
  const actorId = options.personal.actorId;
  if (!actorId) throw new Error("Personal Context requires an explicit claimed actor.");
  for (const item of personalMemoryLinks(canvas)) {
    signal?.throwIfAborted();
    const sourceCanvasId = canvasIdOf(item);
    try {
      const summary = await io.readPersonal(canvasId, { actorId, itemId: item.id, mode: "summary" }, signal);
      signal?.throwIfAborted();
      let sourceHome = null;
      try {
        const parsed = new URL(summary.home);
        if (["http:", "https:"].includes(parsed.protocol)) sourceHome = normalizeHomeUrl(summary.home);
      } catch {
      }
      if (summary.kind !== "personal" || summary.mode !== "summary" || summary.itemId !== item.id || summary.sourceCanvasId !== sourceCanvasId || sourceHome === null || sourceHome !== normalizeHomeUrl(home)) {
        throw new Error("Personal Context returned a different source \u2014 not shown.");
      }
      const heading = `${summary.owner.name}'s canvas`;
      layers.push({
        kind: "personal",
        itemId: item.id,
        canvasId: sourceCanvasId,
        owner: summary.owner,
        heading,
        pieces: summary.pieces.map((piece) => ({
          name: piece.kind === "design" ? "Design system" : piece.title,
          source: "canvas",
          present: !piece.unavailable,
          from: { canvasId: sourceCanvasId, title: heading },
          ...piece.unavailable ? { stale: piece.unavailable } : {}
        }))
      });
      if (summary.truncated) layers.at(-1).pieces.push({
        name: "More personal context",
        source: "canvas",
        present: false,
        stale: "This summary is truncated; use an explicit personal read for its current contributions."
      });
    } catch (error) {
      signal?.throwIfAborted();
      layers.push({ kind: "personal", itemId: item.id, canvasId: sourceCanvasId, owner: null, heading: item.title, pieces: [], refused: failure(error) });
    }
  }
  return layers;
}

export {
  classifyAutomaticSource,
  readInheritedCanvases,
  readLayeredContext
};
