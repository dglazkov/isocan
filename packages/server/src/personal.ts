import { createHash } from "node:crypto";
import {
  atLeast, resolveActor, newCanvasId, newOpId, newItemId, newVersionId,
  contextSheet, contextSheetSpot, CONTEXT_SHEET_SIZE, preparedGroupCreation,
  personalCanvasItemOf, personalContributions, personalMemoryLinks, canvasIdOf, sourceOf,
  normalizeHomeUrl, parseCanvasAddress,
  type Actor, type Capability, type CanvasSnapshotResponse, type PersonalStatusResponse,
  type PersonalEnsureResponse, type PersonalLinkRequest, type PersonalUnlinkRequest,
  type PersonalLinkResponse, type PersonalUnlinkResponse, type PersonalLinkStatus,
  type PersonalReadRequest, type PersonalReadResponse, type PersonalPiece, type PersonalDelegate,
  type SourceRequestContext, type PersonalSourceState,
} from "@isocan/core";
import type { Desk, BadgeRecord } from "./desk.ts";
import type { Engine } from "./engine.ts";
import type { Store } from "./store.ts";
import type { PersonalConsent, PersonalSourceRecord } from "./personal-desk.ts";
import { admissionIn, admittingGrant, capabilityIn, heldRung, rungOfAdmission } from "./grants.ts";

/** Typed privacy refusals are never retried by minting another badge. */
export class PersonalError extends Error {
  readonly statusCode = 403;
  constructor(message: string, readonly code = "personal-refused") { super(message); }
}

/** Authoritative private state is checked before obtaining any source runtime or blob. */
export class PersonalService {
  constructor(private readonly engine: Engine, private readonly store: Store, private readonly desk: Desk,
    private readonly foreign: (canvasId: string) => boolean) {}

  private async caller(badgeId: string, actorId: string): Promise<{ actor: Actor; aliases: string[]; badge: BadgeRecord }> {
    if (!actorId || typeof actorId !== "string") throw new PersonalError("select an explicit claimed actor", "personal-actor-required");
    const badge = await this.desk.badge(badgeId);
    if (!badge) throw new PersonalError("the presenting badge is no longer available");
    await this.engine.requireActor(badgeId, actorId);
    const joined = await this.engine.actorJoins();
    const id = resolveActor(joined, actorId);
    const names = await this.engine.actorNames();
    const aliases = Object.keys(joined).filter((alias) => resolveActor(joined, alias) === id);
    return { actor: { id, name: names[id] ?? names[actorId] ?? actorId }, aliases, badge };
  }

  private async state(source: PersonalSourceRecord): Promise<PersonalSourceState> {
    if (this.foreign(source.canvasId)) return "unavailable";
    const state = await this.store.canvasLifecycle(source.canvasId);
    return state === "absent" || state === "incomplete" ? source.birth === "reserved" ? "reserved" : "unavailable" : state;
  }

  async status(badgeId: string, actorId: string, home: string): Promise<PersonalStatusResponse> {
    const { actor, aliases } = await this.caller(badgeId, actorId);
    const binding = await this.desk.personalBinding([actor.id, ...aliases]);
    if (!binding && (await this.engine.actorKinds())[actor.id] === "agent") throw new PersonalError("personal canvases belong to people; select your person", "personal-person-required");
    return { home, owner: actor,
      source: binding ? { canvasId: binding.source.canvasId, state: await this.state(binding.source) } : null,
      preserved: binding ? await Promise.all(binding.preserved.map(async (source) => ({ canvasId: source.canvasId, state: await this.state(source) }))) : [] };
  }

  async ensure(badgeId: string, actorId: string, home: string): Promise<PersonalEnsureResponse> {
    return this.engine.personalWrite(async (writer) => {
      const { actor, aliases } = await this.caller(badgeId, actorId);
      const existing = await this.desk.personalBinding([actor.id, ...aliases]);
      if (!existing && (await this.engine.actorKinds())[actor.id] === "agent") throw new PersonalError("personal canvases belong to people; select your person", "personal-person-required");
      const binding = await this.desk.reservePersonal({ ownerId: actor.id, aliases, canvasId: newCanvasId(), birthOpId: newOpId(), at: new Date().toISOString() });
      const created = await writer.birth(binding.source, actor, badgeId);
      if (await this.state(binding.source) === "live") await this.desk.admit(badgeId, binding.source.canvasId, { root: "created" }, "own");
      return { ...await this.status(badgeId, actorId, home), created };
    });
  }

  async sourceOwner(badgeId: string, actorId: string, sourceCanvasId: string): Promise<{ actor: Actor; source: PersonalSourceRecord }> {
    const { actor } = await this.caller(badgeId, actorId);
    const source = await this.desk.personalSource(sourceCanvasId);
    if (!source || this.foreign(sourceCanvasId) || resolveActor(await this.engine.actorJoins(), source.ownerId) !== actor.id) throw new PersonalError("only this personal source's owner may change its access", "personal-not-owner");
    return { actor, source };
  }

  async delegates(badgeId: string, actorId: string, sourceCanvasId: string): Promise<PersonalDelegate[]> {
    await this.sourceOwner(badgeId, actorId, sourceCanvasId);
    return this.desk.personalDelegations(sourceCanvasId);
  }

  async delegate(badgeId: string, actorId: string, sourceCanvasId: string, agentId: string, allowed: boolean): Promise<PersonalDelegate> {
    const { actor } = await this.sourceOwner(badgeId, actorId, sourceCanvasId);
    const agent = resolveActor(await this.engine.actorJoins(), agentId);
    if (allowed && (await this.engine.actorKinds())[agent] !== "agent") throw new PersonalError("select a registered agent at this home", "personal-agent-required");
    return this.desk.setPersonalDelegation(sourceCanvasId, { agentId: agent, allowed, byOwnerId: actor.id, at: new Date().toISOString() });
  }

  private async destination(badgeId: string, actorId: string, canvasId: string, edit = false): Promise<{ actor: Actor; snapshot: CanvasSnapshotResponse }> {
    const { actor, badge } = await this.caller(badgeId, actorId);
    if (this.foreign(canvasId)) throw new PersonalError("personal consent must be checked at the destination's home");
    if (!capabilityIn(badge, canvasId)) throw new PersonalError("enter this canvas before reading its personal links");
    const snapshot = await this.engine.getSnapshot(canvasId);
    if (edit && !atLeast(await heldRung(this.desk, snapshot.project, badge, actorId, await this.engine.actorJoins()), "edit")) throw new PersonalError("editing this canvas is required to link your personal canvas");
    return { actor, snapshot };
  }

  private async validateLink(badgeId: string, actorId: string, canvasId: string, itemId: string, home: string): Promise<{ actor: Actor; source: PersonalSourceRecord; consent: PersonalConsent; owner: Actor }> {
    const { actor, snapshot } = await this.destination(badgeId, actorId, canvasId);
    const consent = await this.desk.personalLinkForItem(canvasId, itemId);
    const item = snapshot.canvas.items[itemId];
    const address = item ? parseCanvasAddress(sourceOf(item) ?? "") : null;
    if (!consent || consent.destinationCanvasId !== canvasId || consent.itemId !== itemId || !item || !personalMemoryLinks(snapshot.canvas).some((row) => row.id === itemId) ||
        canvasIdOf(item) !== consent.sourceCanvasId || address?.canvasId !== consent.sourceCanvasId ||
        normalizeHomeUrl(address.origin) !== normalizeHomeUrl(home)) throw new PersonalError("this card has no current personal consent");
    const source = await this.desk.personalSource(consent.sourceCanvasId);
    if (!source || this.foreign(source.canvasId)) throw new PersonalError("the personal source's authoritative home is unavailable");
    const joined = await this.engine.actorJoins();
    const ownerId = resolveActor(joined, source.ownerId);
    if (resolveActor(joined, consent.ownerId) !== ownerId) throw new PersonalError("this personal consent does not match its owner");
    if (actor.id !== ownerId && !(await this.desk.personalDelegations(source.canvasId)).some((row) => row.agentId === actor.id && row.allowed)) throw new PersonalError("the owner has not allowed this actor to read their personal context");
    if (await this.state(source) !== "live") throw new PersonalError("the personal source is not currently available");
    const names = await this.engine.actorNames();
    return { actor, source, consent, owner: { id: ownerId, name: names[ownerId] ?? ownerId } };
  }

  async links(badgeId: string, actorId: string, canvasId: string, home: string): Promise<PersonalLinkStatus[]> {
    const { snapshot } = await this.destination(badgeId, actorId, canvasId);
    const names = await this.engine.actorNames();
    const joined = await this.engine.actorJoins();
    const links: PersonalLinkStatus[] = [];
    for (const item of personalMemoryLinks(snapshot.canvas)) {
      const consent = await this.desk.personalLinkForItem(canvasId, item.id);
      if (!consent || consent.destinationCanvasId !== canvasId || consent.itemId !== item.id) continue;
      const ownerId = resolveActor(joined, consent.ownerId);
      const link: PersonalLinkStatus = { itemId: item.id, owner: { id: ownerId, name: names[ownerId] ?? ownerId }, sourceCanvasId: consent.sourceCanvasId, home, linked: true, available: false };
      try { await this.validateLink(badgeId, actorId, canvasId, item.id, home); link.available = true; }
      catch (error) { link.refused = error instanceof Error ? error.message : "personal source unavailable"; }
      links.push(link);
    }
    return links;
  }

  async link(badgeId: string, canvasId: string, request: PersonalLinkRequest, home: string): Promise<PersonalLinkResponse> {
    if (typeof request.requestId !== "string" || !request.requestId || request.requestId.length > 256) throw new PersonalError("a bounded link requestId is required");
    await this.destination(badgeId, request.actorId, canvasId, true);
    await this.ensure(badgeId, request.actorId, home);
    return this.engine.personalWrite(async (writer) => {
      const { actor, snapshot } = await this.destination(badgeId, request.actorId, canvasId, true);
      const status = await this.status(badgeId, request.actorId, home);
      if (status.source?.state !== "live") throw new PersonalError("your personal canvas is unavailable");
      const sourceCanvasId = status.source.canvasId;
      const existing = (await this.links(badgeId, request.actorId, canvasId, home)).find((row) => row.owner.id === actor.id && row.sourceCanvasId === sourceCanvasId && row.available);
      if (existing) return { link: existing, receipt: null };
      const intent = await this.desk.reservePersonalLink({ ownerId: actor.id, sourceCanvasId, destinationCanvasId: canvasId,
        itemId: newItemId(), groupId: newItemId(), opId: newOpId(), requestId: request.requestId, createdAt: new Date().toISOString() });
      // Replaying an already-undone gesture must not pretend that its card is live.
      const recorded = (await this.engine.getLog(canvasId)).some((entry) => entry.envelope.id === intent.opId) ||
        (await this.engine.getArchivedLog(canvasId)).some((entry) => entry.envelope.id === intent.opId);
      if (snapshot.canvas.items[intent.itemId] || recorded || snapshot.canvas.trash.some((row) => row.item.id === intent.itemId)) throw new PersonalError("this link gesture was undone or its card changed; relink with a new requestId", "personal-link-undone");
      const card = personalCanvasItemOf(home, sourceCanvasId, actor);
      const blob = await this.store.putBlob(canvasId, Buffer.from(card.blob), { mimeType: card.mimeType, filename: card.filename });
      const sheet = contextSheet(snapshot.canvas);
      const at = sheet ? { x: sheet.x + 48, y: sheet.y + 200 } : contextSheetSpot(snapshot.canvas);
      const version = { id: newVersionId(), blobHash: blob.blobHash, mimeType: card.mimeType, filename: card.filename, size: blob.size };
      const items: Parameters<typeof preparedGroupCreation>[1] = [];
      if (!sheet) items.push({ id: intent.groupId, title: "Context", properties: { kind: "group" }, version: { ...version, id: newVersionId() }, box: { ...at, ...CONTEXT_SHEET_SIZE }, layout: { titleHeight: 56, briefHeight: 120, inset: 48 } });
      items.push({ id: intent.itemId, title: card.title, properties: card.properties, version,
        ...(!sheet ? { containerId: intent.groupId } : {}), box: { x: at.x + (sheet ? 0 : 48), y: at.y + (sheet ? 0 : 200), width: 800, height: 600 } });
      const op = preparedGroupCreation(canvasId, items, at);
      if (sheet && op.action.kind === "copy") op.action.containerId = sheet.id;
      const receipt = await writer.submit({ canvasId, actor, badgeId, opId: intent.opId, op });
      await this.validateLink(badgeId, request.actorId, canvasId, intent.itemId, home);
      return { receipt, link: { itemId: intent.itemId, owner: actor, sourceCanvasId, home, linked: true, available: true } };
    }, canvasId);
  }

  async unlink(badgeId: string, canvasId: string, request: PersonalUnlinkRequest): Promise<PersonalUnlinkResponse> {
    if (typeof request.requestId !== "string" || !request.requestId || request.requestId.length > 256) throw new PersonalError("a bounded unlink requestId is required");
    return this.engine.personalWrite(async (writer) => {
      const { actor } = await this.destination(badgeId, request.actorId, canvasId, true);
      const consent = await this.desk.personalLinkForItem(canvasId, request.itemId);
      if (!consent || consent.destinationCanvasId !== canvasId || consent.itemId !== request.itemId || resolveActor(await this.engine.actorJoins(), consent.ownerId) !== actor.id) throw new PersonalError("only this link's owner may unlink it here");
      const opId = `op_${createHash("sha256").update(JSON.stringify([canvasId, actor.id, request.requestId, "unlink"])).digest("hex").slice(0, 24)}`;
      return { receipt: await writer.submit({ canvasId, actor, badgeId, opId, op: { type: "group.change", action: { kind: "delete", itemIds: [request.itemId] } } }) };
    }, canvasId);
  }

  async read(badgeId: string, canvasId: string, request: PersonalReadRequest, home: string, context?: SourceRequestContext): Promise<PersonalReadResponse> {
    if (request.mode !== "summary" && request.mode !== "content") throw new PersonalError("personal read mode must be summary or content");
    const { source, owner } = await this.validateLink(badgeId, request.actorId, canvasId, request.itemId, home);
    context?.signal?.throwIfAborted();
    const snapshot = await this.engine.getSnapshot(source.canvasId);
    const contributions = personalContributions(snapshot.canvas);
    const fingerprint = createHash("sha256").update(JSON.stringify(contributions.map(({ kind, item, version }) => [kind, item.id, version?.id, version?.blobHash]))).digest("hex");
    let offset = 0;
    if (request.mode === "content" && request.cursor) {
      const cursor = JSON.parse(Buffer.from(request.cursor, "base64url").toString()) as { fingerprint: string; offset: number };
      if (cursor.fingerprint !== fingerprint || !Number.isSafeInteger(cursor.offset) || cursor.offset < 0) throw new PersonalError("personal content changed; restart the read", "personal-content-changed");
      offset = cursor.offset;
    }
    if (request.mode === "content" && request.limit !== undefined && (!Number.isSafeInteger(request.limit) || request.limit < 1 || request.limit > 64)) throw new PersonalError("limit must be 1 to 64 pieces");
    const limit = request.mode === "content" ? request.limit ?? 16 : 64;
    const selected = contributions.slice(offset, offset + limit);
    const pieces: PersonalPiece[] = [];
    let truncated = offset + selected.length < contributions.length;
    for (const { kind, item, version } of selected) {
      context?.signal?.throwIfAborted();
      const piece: PersonalPiece = { kind, itemId: item.id, title: item.title, versionId: version?.id ?? null, mimeType: version?.mimeType ?? null };
      if (!version) piece.unavailable = "current version unavailable";
      else if (request.mode === "content" && (/^text\//.test(version.mimeType) || /(?:json|javascript|xml|svg)/.test(version.mimeType))) {
        const stream = await this.store.openBlob(source.canvasId, version.blobHash, { start: 0, end: 65535 });
        if (!stream) piece.unavailable = "content unavailable";
        else { const chunks: Buffer[] = []; for await (const chunk of stream) { context?.signal?.throwIfAborted(); chunks.push(Buffer.from(chunk)); } const bytes = Buffer.concat(chunks); piece.text = bytes.toString("utf8"); piece.bytes = version.size; if (version.size > bytes.length) { piece.unavailable = "text truncated at 65536 bytes"; truncated = true; } }
      }
      pieces.push(piece);
    }
    return { kind: "personal", mode: request.mode, owner, sourceCanvasId: source.canvasId, home, itemId: request.itemId, pieces, truncated,
      ...(offset + selected.length < contributions.length ? { nextCursor: Buffer.from(JSON.stringify({ fingerprint, offset: offset + selected.length })).toString("base64url") } : {}) };
  }

  async direct(canvasId: string, badgeId: string, context: SourceRequestContext, actual: "read" | "edit" | "own", lookup: "entry" | "discovery" = "entry", actorId?: string): Promise<Capability | null> {
    context.signal?.throwIfAborted();
    const source = await this.desk.personalSource(canvasId);
    if (!source) { if (await this.desk.personalReplica(canvasId)) throw new PersonalError("the personal replica authority is unavailable"); return null; }
    if (context.policy.mode === "exclude") throw new PersonalError("ambient calls cannot read personal canvases", "personal-source-excluded");
    const policy = context.policy;
    const { actor, badge } = await this.caller(badgeId, policy.actorId);
    const joined = await this.engine.actorJoins();
    if (actorId && resolveActor(joined, actorId) !== actor.id) throw new PersonalError("the operation actor differs from the selected source actor");
    if (!atLeast(policy.intent, actual)) throw new PersonalError("this request exceeds its selected source intent", "personal-intent-exceeded");
    if (await this.state(source) !== "live") throw new PersonalError("the personal source is not currently available");
    let capability: Capability | null = null;
    if (resolveActor(joined, source.ownerId) === actor.id) capability = "own";
    else { const answer = await admittingGrant(this.desk, canvasId, badge, null, this.desk, lookup); if (answer?.grant) capability = answer.capability; }
    const admission = admissionIn(badge, canvasId);
    if (admission?.provenance.root === "operator" && capability && !atLeast(rungOfAdmission(admission), capability)) capability = rungOfAdmission(admission);
    if (!capability || !atLeast(capability, policy.intent)) throw new PersonalError("this actor has no current sharing grant for that source action");
    return capability;
  }
}
