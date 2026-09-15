import { defaultSize, designSystemProperties, isGroupItem, newItemId, newOpId, newVersionId, resolveActor, type Actor, type ActorJoins, type CanvasSnapshotResponse, type Item, type ItemVersion, type PostOpResponse } from "@isocan/core";
import type { DesignSystemTarget } from "@isocan/api/design-system";
import { questionnaireFailureStatus } from "@isocan/api/questionnaire";
import { readPendingDesignReference, type PendingDesignReference } from "./design-reference-draft.ts";

type Content = { title: string; text: string; filename: string; kind: "html" | "design" };
type Port = {
  snapshot(canvasId: string): Promise<CanvasSnapshotResponse>;
  upload(intent: PendingDesignReference): Promise<{ blobHash: string; size: number }>;
  send(intent: PendingDesignReference, actor: Actor): Promise<PostOpResponse>;
};
type Consistency = { status: "current" | "stale" | "unavailable"; reason?: string };
type Result = { status: "accepted"; itemId: string; opId: string; consistency: Consistency } | { status: "pending" | "refused"; reason: string };
const reason = (error: unknown) => error instanceof Error ? error.message : String(error);
const semantic = (value: unknown): string => Array.isArray(value) ? "[" + value.map(semantic).join(",") + "]" : value && typeof value === "object" ? "{" + Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, one]) => JSON.stringify(key) + ":" + semantic(one)).join(",") + "}" : JSON.stringify(value);
const sameActor = (joined: ActorJoins, a: string, b: string) => resolveActor(joined, a) === resolveActor(joined, b);

/** Capture group membership before journaling; legacy geometry may require extra acts and is refused explicitly. */
export async function prepareDesignReference(snapshot: CanvasSnapshotResponse, actor: Actor, target: DesignSystemTarget, content: Content): Promise<PendingDesignReference> {
  if (snapshot.project.groupMode !== "groups") throw new Error("Creating a reference in its chosen scope requires canvas groups. Migrate this canvas to groups before adding; previews, downloads and existing source editing remain available.");
  const selected = target.kind === "item" ? snapshot.canvas.items[target.itemId] : target.kind === "group" ? snapshot.canvas.items[target.groupId] : undefined;
  if ((target.kind === "item" || target.kind === "group") && !selected) throw new Error("The chosen reference target no longer exists. Read the scope again before adding.");
  if (target.kind === "group" && !isGroupItem(selected!)) throw new Error("The chosen reference scope is not a group.");
  const containerId = selected ? isGroupItem(selected) ? selected.id : selected.containerId ?? null : null;
  const bytes = new TextEncoder().encode(content.text), blobHash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(byte => byte.toString(16).padStart(2, "0")).join("");
  const mimeType = content.kind === "html" ? "text/html" : "text/markdown";
  return { canvasId: snapshot.project.id, actorId: actor.id, opId: newOpId(), originGroupMode: "groups", text: content.text, refused: false, operation: { type: "item.add", itemId: newItemId(), containerId, groupPlacement: "auto", title: content.title, ...(content.kind === "design" ? { properties: designSystemProperties() } : {}), placement: target.kind === "item" ? { anchorItemId: target.itemId } : target.kind === "point" ? { x: target.x, y: target.y } : { x: 80, y: 80 }, ...defaultSize(mimeType), version: { id: newVersionId(), blobHash, size: bytes.byteLength, filename: content.filename, mimeType } } };
}

function versionMatches(version: ItemVersion, intent: PendingDesignReference, joined: ActorJoins, authorId: string): boolean {
  const { createdAt: _createdAt, createdBy, ...authored } = version;
  return !!createdBy && sameActor(joined, createdBy.id, authorId) && semantic(authored) === semantic(intent.operation.version);
}
function itemMatches(item: Item, intent: PendingDesignReference, joined: ActorJoins, authorId: string): boolean {
  const op = intent.operation;
  return item.id === op.itemId && item.title === (op.title ?? op.version.filename) && item.description === (op.description ?? "") && semantic(item.properties) === semantic(op.properties ?? {}) && item.width === op.width && item.height === op.height && (item.containerId ?? null) === (op.containerId ?? null) && !!item.createdBy && sameActor(joined, item.createdBy.id, authorId);
}
function acknowledges(receipt: PostOpResponse, intent: PendingDesignReference, actor: Actor, joined: ActorJoins): boolean {
  const envelope = receipt?.envelope, op = envelope?.op;
  if (!envelope || envelope.id !== intent.opId || envelope.canvasId !== intent.canvasId || !envelope.actor || !sameActor(joined, envelope.actor.id, actor.id) || !sameActor(joined, envelope.actor.id, intent.actorId)) return false;
  if (op.type === "item.add") {
    if (intent.originGroupMode !== "legacy") return false;
    const { placement, ...authored } = op, { placement: expected, ...wanted } = intent.operation;
    // Legacy normalization discards anchor provenance. Never invent proof of an old anchor from today's geometry.
    return "x" in expected && expected.chosen === true && "x" in placement && placement.x === expected.x && placement.y === expected.y && placement.chosen === true && semantic(authored) === semantic(wanted);
  }
  if (op.type !== "group.change" || op.action.kind !== "apply" || intent.originGroupMode !== "groups") return false;
  const change = op.action.change;
  if (change.canvasId !== intent.canvasId || change.intent !== "insert") return false;
  const creates = change.writes.filter(write => write.kind === "create");
  if (creates.length !== 1) return false;
  const item = creates[0]!.item;
  return itemMatches(item, intent, joined, envelope.actor.id) && item.currentVersionId === intent.operation.version.id && item.versions.length === 1 && versionMatches(item.versions[0]!, intent, joined, envelope.actor.id);
}

/** Only a matching canonical creation confirms an add; later reads describe consistency without reversing acceptance. */
export async function submitDesignReference(io: Port, intent: PendingDesignReference, actor: Actor, uncertain: boolean): Promise<Result> {
  let before: CanvasSnapshotResponse;
  try {
    await readPendingDesignReference(JSON.stringify(intent), intent.canvasId, intent.actorId);
    before = await io.snapshot(intent.canvasId);
    if (before.project.id !== intent.canvasId) throw new Error("The reference target returned a different canvas.");
    if (!sameActor(before.joined ?? {}, intent.actorId, actor.id)) throw new Error("The retained reference belongs to another actor.");
    const uploaded = await io.upload(intent);
    if (uploaded.blobHash !== intent.operation.version.blobHash || uploaded.size !== intent.operation.version.size) throw new Error("The uploaded reference differs from the saved intent.");
  } catch (error) { return { status: uncertain ? "pending" : "refused", reason: reason(error) }; }
  let receipt: PostOpResponse;
  try { receipt = await io.send(intent, actor); }
  catch (error) { return { status: uncertain ? "pending" : questionnaireFailureStatus(error), reason: reason(error) }; }
  if (intent.originGroupMode === "legacy" && (!("x" in intent.operation.placement) || intent.operation.placement.chosen !== true)) return { status: "pending", reason: "The legacy receipt normalizes automatic placement and no longer proves the captured destination. The original draft and retry identity remain retained; acceptance is unconfirmed." };
  if (!acknowledges(receipt, intent, actor, before.joined ?? {})) return { status: "pending", reason: "The returned operation did not confirm this exact reference, author and destination. Retain the original intent for retry." };
  const accepted = { status: "accepted" as const, itemId: intent.operation.itemId, opId: receipt.envelope.id };
  try {
    const current = await io.snapshot(intent.canvasId), item = current.canvas.items[intent.operation.itemId], version = item?.versions.find(one => one.id === intent.operation.version.id);
    if (current.project.id !== intent.canvasId) return { ...accepted, consistency: { status: "unavailable", reason: "The consistency read returned a different canvas." } };
    if (!item || !version) return { ...accepted, consistency: { status: "unavailable", reason: "The add was accepted, but its saved item or version is no longer readable." } };
    const same = itemMatches(item, intent, current.joined ?? {}, actor.id) && versionMatches(version, intent, current.joined ?? {}, actor.id) && item.currentVersionId === version.id;
    return { ...accepted, consistency: same ? { status: "current" } : { status: "stale", reason: "The add was accepted, but its saved content, metadata or destination has since changed." } };
  } catch (error) { return { ...accepted, consistency: { status: "unavailable", reason: `The add was accepted; current consistency could not be read: ${reason(error)}` } }; }
}
