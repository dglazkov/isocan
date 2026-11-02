import {
  canvasIdOf, contextPinDecoration, groupCopyAction, groupCopySource, memoryLinks,
  newItemId, newOpId, newVersionId, resolveGroupOperation, resolveSourcePinPiece,
  sourceOf, sourcePinPieces,
  type Actor, type CanvasContents, type CanvasSnapshotResponse, type ContextSource,
  type GroupAction, type Item, type SourceClassificationRequest, type SourcePinPiece,
} from "@isocan/core";
import { classifyAutomaticSource, type ContextReadPort } from "./context-reader.ts";
import { assertGroupDestination } from "./canvas-group-access.ts";
import { copyFaces, transferCopyFaces, type CopyBytesPort } from "./copy-bytes.ts";

/**
 * **Copy one piece of an inherited source into a local pin**
 * (`docs/projects/memory/pin-from-source.md`, memory phase 6).
 *
 * This is the portable half: the order of the checks, the freeze, the byte
 * transfer and the one act that lands. Transport is injected, because the
 * browser and the CLI reach a daemon in genuinely different ways — and the
 * decisions are HERE rather than in either of them, because a picker that
 * decided eligibility differently from the terminal would be two features
 * wearing one name.
 *
 * Nothing in this file is a new operation, a new reducer path, or a second
 * copy algorithm. Membership, remapping and placement are `groupCopySource` /
 * `groupCopyAction` in core; bytes are `copy-bytes.ts`, shared with
 * `CanvasGroups.copyFrom`; the pin and the provenance ride the copy act's
 * `decorate` hook; and what lands is one `group.change` that one undo removes.
 */
export interface ContextPinPort extends Pick<ContextReadPort, "classifySource" | "sourceSnapshot"> {
  /** The DESTINATION, read with the caller's ordinary authority. */
  snapshot(canvasId: string, signal?: AbortSignal): Promise<CanvasSnapshotResponse>;
  /** Bytes, bound to a classified source and this destination — so a blob
   *  request cannot escape the exclusion policy the classification imposed. */
  copyBytes(source: SourceClassificationRequest, destinationCanvasId: string): CopyBytesPort;
  /** The one accepted act. Clients differ only in how they hand it over. */
  submit(canvasId: string, actor: Actor, action: Extract<GroupAction, { kind: "copy" }>, opId: string, originGroupMode: "legacy" | "groups"): Promise<{ seq?: number }>;
}

/** Reading the picker's offers needs no write transport at all. */
export type PinSourcePort = Pick<ContextPinPort, "classifySource" | "sourceSnapshot">;

/** One inherited source as the picker shows it: the card that links it, the
 *  source's own current title, and what it is currently offering. */
export interface PinSourceOffer {
  /** The inheritance card on the destination — the concrete visible edge. */
  itemId: string;
  canvasId: string;
  title: string;
  home: string;
  pieces: SourcePinPiece[];
}

/** What one accepted copy did, in the words both surfaces report it with. */
export interface PinFromSourceResult {
  dryRun: boolean;
  /** The new local root, pinned. */
  rootId: string;
  itemIds: string[];
  /** How many items landed, root included. */
  count: number;
  title: string;
  source: ContextSource;
  seq?: number;
}

/** What to copy and where, resolved against the canvases as they are NOW —
 *  never against the list a picker was showing a minute ago. */
export interface PinFromSourceRequest {
  canvasId: string;
  /** The destination's authoritative home; the source must share it. */
  home: string;
  actor: Actor;
  /** An inheritance link: exact canvas or card ID, else unambiguous prefix. */
  from: string;
  /** A piece the source offers: exact item ID, else unambiguous prefix. */
  piece: string;
  at?: { x: number; y: number } | undefined;
  dryRun?: boolean | undefined;
  signal?: AbortSignal | undefined;
}

/**
 * `--from` resolves ONLY among the destination's visible ordinary inheritance
 * links. Not among canvases the caller can reach, and not among addresses they
 * can type: the edge is the thing that makes this source readable from here,
 * so a refusal names the edges rather than sending somebody to look for a
 * canvas ID. `memoryLinks` already drops excluded cards and excluded ancestors.
 */
function resolveInheritanceLink(canvas: CanvasContents, ref: string): Item {
  const links = memoryLinks(canvas);
  const list = links.map((item) => `  ${canvasIdOf(item)}  ${item.title}  (card ${item.id})`).join("\n");
  const exact = links.find((item) => item.id === ref || canvasIdOf(item) === ref);
  if (exact) return exact;
  const needle = ref.trim().toLowerCase();
  const starts = (value: string | null) => !!value && value.toLowerCase().startsWith(needle);
  const matches = needle ? links.filter((item) => starts(item.id) || starts(canvasIdOf(item)) || starts(item.title)) : [];
  if (matches.length === 1) return matches[0]!;
  if (matches.length === 0) throw new Error(`no visible inherited source called ${JSON.stringify(ref)} here — this canvas inherits:\n${list || "  nothing"}`);
  throw new Error(`ambiguous source ${JSON.stringify(ref)}; use a canvas ID:\n${matches.map((item) => `  ${canvasIdOf(item)}  ${item.title}`).join("\n")}`);
}

/** Classify, then read — in that order and never the other way round. A
 *  personal card relabelled `memory=inherit` is refused by CLASSIFICATION, so
 *  no snapshot, blob or screenshot request is made on it at all. */
async function readSource(io: PinSourcePort, link: Item, home: string, signal?: AbortSignal) {
  const canvasId = canvasIdOf(link);
  if (!canvasId) throw new Error(`“${link.title}” has no source canvas address.`);
  const access = await classifyAutomaticSource(io, { canvasId, home, source: sourceOf(link) }, signal);
  if (access.kind !== "ordinary") throw new Error(access.refused);
  const request: SourceClassificationRequest = { canvasId, expectedHome: access.expectedHome };
  const snapshot = await io.sourceSnapshot(request, signal);
  signal?.throwIfAborted();
  return { request, snapshot };
}

/** What one inherited source is offering right now — the picker's list, read
 *  fresh on both surfaces rather than derived from the Context summary. */
export async function readPinSource(
  io: PinSourcePort,
  options: { canvas: CanvasContents; home: string; from: string; signal?: AbortSignal | undefined },
): Promise<PinSourceOffer> {
  const link = resolveInheritanceLink(options.canvas, options.from);
  const { request, snapshot } = await readSource(io, link, options.home, options.signal);
  return { itemId: link.id, canvasId: request.canvasId, title: snapshot.project.title, home: request.expectedHome, pieces: sourcePinPieces(snapshot.canvas) };
}

/**
 * The act itself.
 *
 * **Everything is rechecked here**, because the picker's list is a reading and
 * a reading gets old: the destination is re-read for editability and group
 * mode, the inheritance edge is re-resolved and re-classified, the source is
 * re-snapshotted, and the chosen piece is re-validated against that snapshot's
 * current versions. Then the faces are read, verified and uploaded — and only
 * then is the destination re-read a second time, to confirm it is still
 * editable and the same visible edge is still there, before one act is
 * submitted. A link deleted or excluded mid-transfer, or a browser that
 * changed identity, refuses with nothing visible left behind.
 *
 * What this is NOT is a cross-canvas transaction. Bytes deliberately copied
 * with valid access stay copied; a later source edit, removal or unlink does
 * not reach back into them. That is the whole point of the act.
 */
export async function pinFromSource(io: ContextPinPort, request: PinFromSourceRequest): Promise<PinFromSourceResult> {
  const { canvasId, home, actor, signal } = request;
  signal?.throwIfAborted();
  // The destination is judged BEFORE a source is read: a legacy canvas gets
  // its conversion guidance without anybody's content arriving first.
  const before = assertGroupDestination(await io.snapshot(canvasId, signal), true);
  signal?.throwIfAborted();
  const link = resolveInheritanceLink(before.canvas, request.from);
  const { request: source, snapshot } = await readSource(io, link, home, signal);
  const chosen = resolveSourcePinPiece(sourcePinPieces(snapshot.canvas), request.piece);
  if (chosen.refused) throw new Error(`“${chosen.title}” cannot be copied: ${chosen.refused}`);
  const item = snapshot.canvas.items[chosen.itemId]!;
  const frozen = groupCopySource(source.canvasId, snapshot.canvas, [chosen.itemId]);
  const from = { home: source.expectedHome, canvasId: source.canvasId, canvasTitle: snapshot.project.title };
  const action = groupCopyAction(frozen, canvasId, {
    newItemId, newVersionId, containerId: null,
    ...(request.at ? { at: request.at } : {}),
    decorate: contextPinDecoration(from),
  });
  const provenance: ContextSource = { ...from, itemId: item.id, itemTitle: item.title, versionId: item.currentVersionId };
  const answer = { rootId: action.rootIds[0]!, itemIds: action.items.map((one) => one.id), count: action.items.length, title: chosen.title, source: provenance };
  // Geometry and metadata are validated with no bytes written, exactly as an
  // ordinary copy's dry run does — so a refusal costs the source nothing.
  const opId = newOpId();
  const stamp = { actor, ts: new Date().toISOString(), opId };
  resolveGroupOperation(before, { type: "group.change", action }, stamp);
  if (request.dryRun) return { dryRun: true, ...answer };
  await transferCopyFaces(io.copyBytes(source, canvasId), copyFaces(frozen.items), { upload: true, ...(signal ? { signal } : {}) });
  signal?.throwIfAborted();
  const after = assertGroupDestination(await io.snapshot(canvasId, signal), true);
  signal?.throwIfAborted();
  const still = memoryLinks(after.canvas).find((one) => one.id === link.id && canvasIdOf(one) === source.canvasId);
  if (!still) throw new Error(`“${link.title}” is no longer a visible inherited source here — nothing was copied.`);
  resolveGroupOperation(after, { type: "group.change", action }, stamp);
  const { seq } = await io.submit(canvasId, actor, action, opId, after.project.groupMode ?? "legacy");
  return { dryRun: false, ...answer, ...(seq === undefined ? {} : { seq }) };
}
