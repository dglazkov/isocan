import { validateDesignRepairCanonical } from "./design-repair-state.ts";
import { validateTextAnchor } from "./text-anchor.ts";
import { validateContextManifest } from "./canvas-group-context.ts";
import type {
  Actor,
  Canvas,
  CanvasContents,
  Comment,
  Item,
  ItemVersion,
  CanvasState,
} from "./model.ts";
import { emptyCanvas, mainThread } from "./model.ts";
import type { MetaPatch, NewComment, NewVersion, OpEnvelope } from "./ops.ts";
import { OpValidationError, unknownOperation } from "./errors.ts";
import { questionnaireQuestionMarkdown, validateQuestionnaireComment, questionnaireStates, rejectQuestionnaireMetadata } from "./questionnaire.ts";
import { DesignPartnerContractError, parseDesignQuestionSet, parseDesignResponse } from "./design-partner.ts";
import { designResponseMarkdown } from "./design-partner-plan.ts";
import { positionIsMeaningful, resolvePlacement } from "./placement.ts";
import { applyGroupChange, resolveGroupOperation, validateGroupForest } from "./canvas-groups.ts";
import { validateDesignRecordState, validateDesignRecordEffect } from "./design-record.ts";
import { DesignRestoreConflict, designDecisionMarkdown, designTargetMatches, rejectDesignDecisionMetadata, sameDesignValue, validateDesignDecisionComment } from "./design-decision-state.ts";

/**
 * The shared pure reducer. The daemon runs it authoritatively; the web client
 * runs the identical function against its replica for every broadcast op.
 *
 * - `project.create` requires `state === null` and returns a fresh CanvasState.
 * - `project.delete` returns null (the engine moves the directory aside; the
 *   replica handles the separate "canvas-deleted" message).
 * - Every mutation stamps `updatedAt`/`updatedBy` from the envelope. Undo
 *   restores content, not these stamps — the undoer did mutate the item.
 */
export function applyOperation(
  state: CanvasState | null,
  envelope: OpEnvelope,
): CanvasState | null {
  try { return applyValidatedOperation(state, envelope); }
  catch (error) {
    if (error instanceof DesignPartnerContractError) throw new OpValidationError("bad-op", error.message);
    throw error;
  }
}
function applyValidatedOperation(state: CanvasState | null, envelope: OpEnvelope): CanvasState | null {
  const op = envelope.op;
  rejectQuestionnaireMetadata(op);
  rejectDesignDecisionMetadata(op);
  if ((op.type === "item.add" || op.type === "item.edit" || op.type === "item.addVersion") && op.version.designRecord !== undefined) throw new OpValidationError("bad-op", "design admission requires its canonical design operation");
  const contexts = op.type === "questionnaire.ask" || op.type === "questionnaire.answer" ? [op.context]
    : op.type === "thread.create" || op.type === "thread.reply" || op.type === "comment.restore" ? [op.comment.context]
    : op.type === "comment.update" ? [op.context]
    : op.type === "thread.restore" ? op.thread.comments.map((comment) => comment.context) : [];
  if (op.type === "comment.restore") validateQuestionnaireComment(op.comment, envelope.canvasId!);
  if (op.type === "thread.restore") for (const comment of op.thread.comments) validateQuestionnaireComment(comment, envelope.canvasId!);
  for (const context of contexts) if (context) {
    if (!state || state.project.groupMode !== "groups") throw new OpValidationError("bad-op", "frozen context requires a group-mode canvas");
    validateContextManifest(context, state.project.id);
  }
  const next = reduceOperation(state, envelope);
  // Historical area canvases keep their original reduction. Explicit group
  // state is validated after EVERY operation, including ordinary inverses.
  if (next?.project.groupMode === "groups") validateGroupForest(next);
  if (next) validateDesignRecordState(next);
  if (next) for (const thread of Object.values(next.canvas.threads)) for (const comment of thread.comments) validateDesignDecisionComment(comment, next.project.id);
  return next;
}

/** Primitive existing effects also compile a bounded content write before group-frame repair. */
export function reduceOperation(state: CanvasState | null, envelope: OpEnvelope): CanvasState | null {
  const { op, actor, ts } = envelope;

  if (op.type === "project.create") {
    if (state !== null) {
      throw new OpValidationError("bad-op", "project.create on existing canvas");
    }
    const project: Canvas = {
      id: op.canvasId,
      title: op.title,
      description: op.description ?? "",
      properties: { ...op.properties },
      ...(op.groupMode !== undefined ? { groupMode: op.groupMode } : {}),
      createdAt: ts,
      createdBy: actor,
      updatedAt: ts,
      updatedBy: actor,
    };
    return { project, canvas: emptyCanvas() };
  }

  if (state === null) {
    throw new OpValidationError("bad-op", `${op.type} on missing canvas`);
  }

  if (op.type === "project.delete") {
    return null;
  }

  const stamp = { updatedAt: ts, updatedBy: actor };
  const { project, canvas } = state;

  /**
   * **Every operation stamps the canvas, not just the ones about the canvas's
   * own name.**
   *
   * This returned `project` untouched, so `project.updatedAt` moved only for
   * `project.update` — and the home screen, which shows exactly that field,
   * reported when a canvas was last RENAMED while calling it activity. A
   * canvas worked on all week read as untouched since whenever somebody last
   * edited its title.
   *
   * `lastOp` rides along because the list needs to say WHAT happened and
   * cannot afford to open a log per canvas to find out.
   */
  const touched = { ...project, ...stamp, lastOp: op.type };

  const withCanvas = (next: CanvasContents): CanvasState => ({
    project: touched,
    canvas: next,
  });

  const getItem = (itemId: string): Item => {
    const item = canvas.items[itemId];
    if (!item) throw new OpValidationError("unknown-item", `unknown item: ${itemId}`);
    return item;
  };

  const putItem = (item: Item): CanvasState =>
    withCanvas({ ...canvas, items: { ...canvas.items, [item.id]: item } });

  const getThread = (threadId: string) => {
    const thread = canvas.threads[threadId];
    if (!thread) throw new OpValidationError("unknown-thread", `unknown thread: ${threadId}`);
    return thread;
  };

  switch (op.type) {
    case "design.repair": {
      validateDesignRepairCanonical(envelope);
      if (!designTargetMatches(canvas, op.repair.target)) throw new OpValidationError("edit-conflict", "The captured repair target changed.");
      const next = reduceOperation(state, { ...envelope, actor: { id: actor.id, name: actor.name }, op: op.effect! })!;
      return { ...next, project: { ...next.project, lastOp: op.type } };
    }
    case "design.compare":
    case "design.respond": {
      const comment = op.canonicalComment, expected = op.type === "design.compare" ? op.comparison : op.response;
      if (!comment || comment.id !== op.commentId || comment.author.id !== actor.id || comment.designDecision?.opId !== envelope.id || !sameDesignValue(comment.designDecision.record, expected)) throw new OpValidationError("bad-op", "canonical comparison effect disagrees with intent");
      validateDesignDecisionComment(comment, project.id);
      return reduceOperation(state, { ...envelope, op: { type: "comment.restore", threadId: op.threadId, comment } });
    }
    case "design.decide": {
      const effect = op.effect, record = effect?.comment.designDecision?.record;
      if (!effect || Object.keys(effect).some((key) => !["edit", "threadId", "comment"].includes(key)) || effect.edit.type !== "item.edit" || Object.keys(effect.edit).some((key) => !["type", "itemId", "version", "expectedVersionId", "expectedMetadata", "patch"].includes(key)) || effect.threadId !== op.threadId || effect.comment.id !== op.commentId || effect.comment.author.id !== actor.id || effect.comment.designDecision?.opId !== envelope.id || record?.kind !== "adoption-decision" || !sameDesignValue(record.input, op.decision) || effect.edit.itemId !== op.decision.basis.target.artifact.itemId || effect.edit.version.id !== op.decision.versionId || effect.edit.version.blobHash !== record.adopted.blobHash || Object.keys(effect.edit.patch).length || !sameDesignValue(effect.edit.expectedMetadata, { title: op.decision.basis.target.title, properties: op.decision.basis.target.properties }) || !designTargetMatches(canvas, op.decision.basis.target)) throw new OpValidationError("edit-conflict", "canonical adoption pair disagrees or its approved target changed");
      validateDesignDecisionComment(effect.comment, project.id);
      if (record.input.source.kind === "comparison") {
        const source = record.input.source.source, sourceComment = canvas.threads[source.threadId]?.comments.find((c) => c.id === source.commentId);
        if (source.threadId !== op.threadId || !sourceComment || !sameDesignValue(sourceComment.designDecision?.record, record.comparison) || sourceComment.body !== designDecisionMarkdown(record.comparison) || !sameDesignValue(sourceComment.author, record.recommendationAuthor)) throw new OpValidationError("bad-op", "canonical adoption source or recommendation author disagrees");
      } else if (!sameDesignValue(record.recommendationAuthor, { id: actor.id, name: actor.name })) throw new OpValidationError("bad-op", "direct recommendation author disagrees");
      const retained = effect.comment.designReferences!.find((r) => sameDesignValue(r.artifact, record.adopted))!;
      const { createdAt: _createdAt, createdBy: _createdBy, ...version } = retained.version;
      if (!sameDesignValue(effect.edit.version, version) || effect.edit.expectedVersionId !== record.input.basis.target.artifact.versionId || effect.comment.createdAt !== ts || !sameDesignValue(effect.comment.author, { id: actor.id, name: actor.name })) throw new OpValidationError("bad-op", "canonical edit differs from its retained adopted version");
      const edited = reduceOperation(state, { ...envelope, actor: { id: actor.id, name: actor.name }, op: effect.edit })!;
      const next = reduceOperation(edited, { ...envelope, op: { type: "comment.restore", threadId: effect.threadId, comment: effect.comment } })!;
      return { ...next, project: { ...next.project, lastOp: op.type } };
    }
    case "design.restore": {
      const e = op.effect, current = canvas.threads[e.threadId]?.comments.find((c) => c.id === e.commentId) ?? null;
      if (!designTargetMatches(canvas, e.target) || !canvas.threads[e.threadId] || !sameDesignValue(current, e.expectedComment) || e.item.itemId !== e.target.artifact.itemId || e.comment && e.comment.id !== e.commentId || e.comment === null && e.expectedComment === null) throw new DesignRestoreConflict("The adopted target or decision comment changed; neither half was restored.");
      if (Object.keys(e).some((key) => !["target", "item", "threadId", "commentId", "expectedComment", "comment"].includes(key)) || e.item.type !== "item.removeVersion" && e.item.type !== "item.restoreVersion") throw new DesignRestoreConflict("Invalid paired restoration.");
      const original = e.expectedComment ?? e.comment, record = original?.designDecision?.record;
      if (!original || record?.kind !== "adoption-decision") throw new DesignRestoreConflict("Paired restoration requires its original decision.");
      validateDesignDecisionComment(original, project.id);
      const adopted = original.designReferences!.find((r) => sameDesignValue(r.artifact, record.adopted))!.version;
      const removing = e.item.type === "item.removeVersion";
      if (Object.keys(e.item).some((key) => !(removing ? ["type", "itemId", "versionId", "prevCurrentVersionId", "patch"] : ["type", "itemId", "version", "patch"]).includes(key))) throw new DesignRestoreConflict("Unknown paired restoration semantics.");
      if (!sameDesignValue(e.target, { ...record.input.basis.target, artifact: removing ? record.adopted : record.input.basis.target.artifact }) || e.item.patch && Object.keys(e.item.patch).length || e.item.type === "item.removeVersion" && (e.comment !== null || e.item.versionId !== record.adopted.versionId || e.item.prevCurrentVersionId !== record.input.basis.target.artifact.versionId) || e.item.type === "item.restoreVersion" && (e.expectedComment !== null || !sameDesignValue(e.item.version, adopted))) throw new DesignRestoreConflict("Restoration disagrees with its exact original target/comment pair.");
      const edited = reduceOperation(state, { ...envelope, op: e.item })!;
      const next = reduceOperation(edited, { ...envelope, op: e.comment ? { type: "comment.restore", threadId: e.threadId, comment: e.comment } : { type: "comment.remove", threadId: e.threadId, commentId: e.commentId } })!;
      return { ...next, project: { ...next.project, lastOp: op.type } };
    }
    case "design.request":
    case "design.receipt": {
      if (!op.effect) throw new OpValidationError("bad-op", "design act requires its canonical writer effect");
      validateDesignRecordEffect(state, envelope);
      const next = reduceOperation(state, { ...envelope, op: op.effect });
      return next && { ...next, project: { ...next.project, lastOp: op.type } };
    }
    case "group.change": {
      const resolved = op.action.kind === "apply" ? op : resolveGroupOperation(state, op, { actor, ts, opId: envelope.id });
      if (resolved.action.kind !== "apply") throw new OpValidationError("bad-op", "unresolved group operation");
      return applyGroupChange(state, resolved.action.change, actor, ts);
    }
    case "actor.claim":
    case "actor.setColor":
    case "actor.setMark":
    case "actor.join":
      // Home-scoped: the engine applies these against the actor registry and
      // never routes them here. The cases exist for exhaustiveness.
      throw new OpValidationError("bad-op", `${op.type} is not a canvas operation`);

    case "project.update":
      return {
        project: { ...project, ...applyMetaPatch(project, op.patch), ...stamp },
        canvas,
      };

    case "item.add": {
      if (canvas.items[op.itemId] || canvas.trash.some((t) => t.item.id === op.itemId)) {
        throw new OpValidationError("duplicate-id", `item id already exists: ${op.itemId}`);
      }
      requireFinite({ width: op.width, height: op.height }, "item.add");
      if ("x" in op.placement) {
        requireFinite({ x: op.placement.x, y: op.placement.y }, "item.add placement");
      }
      // The daemon has already resolved this to a concrete, clear position and
      // logged it, so on the live path and on replay alike this finds the spot
      // free and hands it back unchanged. It stays here because an op can also
      // arrive from a client replica applying optimistically, where the
      // placement has not been through the daemon yet.
      const { x, y } = resolvePlacement(
        canvas,
        op.placement,
        op.width,
        op.height,
        positionIsMeaningful(op),
      );
      const item: Item = {
        id: op.itemId,
        x,
        y,
        width: op.width,
        height: op.height,
        title: op.title ?? op.version.filename,
        description: op.description ?? "",
        properties: { ...op.properties },
        versions: [toItemVersion(op.version, actor, ts)],
        currentVersionId: op.version.id,
        createdAt: ts,
        createdBy: actor,
        ...stamp,
      };
      return putItem(item);
    }

    case "item.react": {
      const item = getItem(op.itemId);
      const emoji = op.emoji.trim();
      if (!emoji) throw new OpValidationError("bad-op", "item.react: an emoji is required");
      const worn = item.reactions?.[emoji] ?? [];
      // Set semantics: adding is idempotent, so two people reacting in the
      // same instant both land. Order is arrival order, which is what a
      // tooltip wants to read out.
      const next = op.on
        ? worn.includes(actor.id)
          ? worn
          : [...worn, actor.id]
        : worn.filter((id) => id !== actor.id);
      const reactions = { ...item.reactions };
      // An emoji nobody wears is removed rather than kept at zero — a chip
      // with no count is a chip nobody can get rid of.
      if (next.length > 0) reactions[emoji] = next;
      else delete reactions[emoji];
      const hasAny = Object.keys(reactions).length > 0;
      /**
       * The point, kept beside the set. `on` with `at` places (or moves) this
       * actor's dot; `on` without `at` leaves any dot they had — a chip click
       * after a placed dot is still the same vote, not a vote that lost its
       * place. `off` does NOT remove the dot: the inverse of `off` is `on`
       * with no `at` (the inverter cannot know whose), so a dot that vanished
       * on `off` could never come back on undo. It stays, and readers join
       * points against who WEARS the mark now (`reactionPointsOf`) — a point
       * for an actor not wearing the mark is not a dot. A point is fractions
       * of the box: anything else is refused, because a dot outside the
       * sketch is not on any part of it.
       */
      if (op.at !== undefined) {
        const { x, y } = op.at;
        if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) {
          throw new OpValidationError("bad-op", "item.react: `at` is a point on the item, 0..1 each");
        }
      }
      const points: Record<string, Record<string, { x: number; y: number }>> = { ...item.reactionPoints };
      if (op.on && op.at !== undefined) {
        points[emoji] = { ...points[emoji], [actor.id]: { x: op.at.x, y: op.at.y } };
      }
      const hasPoints = Object.keys(points).length > 0;
      const { reactions: _drop, reactionPoints: _dropPoints, ...rest } = item;
      return putItem({
        ...rest,
        ...(hasAny ? { reactions } : {}),
        ...(hasPoints ? { reactionPoints: points } : {}),
        ...stamp,
      });
    }

    case "item.move":
      requireFinite({ x: op.x, y: op.y }, "item.move");
      return putItem({ ...getItem(op.itemId), x: op.x, y: op.y, ...stamp });

    case "item.resize":
      requireFinite({ width: op.width, height: op.height }, "item.resize");
      return putItem({ ...getItem(op.itemId), width: op.width, height: op.height, ...stamp });

    case "item.update": {
      const item = getItem(op.itemId);
      const renamed =
        op.filename === undefined
          ? item.versions
          : item.versions.map((version) =>
              version.id === item.currentVersionId ? { ...version, filename: op.filename! } : version,
            );
      return putItem({
        ...item,
        ...applyMetaPatch(item, op.patch),
        versions: renamed,
        ...stamp,
      });
    }

    case "item.edit":
    case "item.addVersion": {
      const item = getItem(op.itemId);
      if (op.type === "item.edit") {
        const expected = op.expectedMetadata;
        if (item.currentVersionId !== op.expectedVersionId ||
          (expected && (item.title !== expected.title ||
            Object.keys({ ...item.properties, ...expected.properties }).some(
              (key) => item.properties[key] !== expected.properties[key],
            )))) {
          throw new OpValidationError("edit-conflict", `“${item.title}” changed while editing. Reload it before saving; your draft has not been applied.`);
        }
      }
      if (item.versions.some((v) => v.id === op.version.id)) {
        throw new OpValidationError("duplicate-id", `version id already exists: ${op.version.id}`);
      }
      return putItem({
        ...item,
        ...(op.type === "item.edit" ? applyMetaPatch(item, op.patch) : {}),
        versions: [...item.versions, toItemVersion(op.version, actor, ts)],
        currentVersionId: op.version.id,
        ...stamp,
      });
    }

    case "item.setCurrentVersion": {
      const item = getItem(op.itemId);
      requireVersion(item, op.versionId);
      return putItem({ ...item, currentVersionId: op.versionId, ...stamp });
    }

    case "item.pruneVersions": {
      const item = getItem(op.itemId);
      if (!Number.isInteger(op.keep) || op.keep < 1) {
        throw new OpValidationError("bad-op", `keep must be a whole number of at least 1: ${op.keep}`);
      }
      return putItem({ ...item, versions: pruneVersions(item, op.keep), ...stamp });
    }

    case "item.removeVersion": {
      const item = getItem(op.itemId);
      requireVersion(item, op.versionId);
      const versions = item.versions.filter((v) => v.id !== op.versionId);
      if (versions.length === 0) {
        throw new OpValidationError("bad-op", "cannot remove the only version");
      }
      if (!versions.some((v) => v.id === op.prevCurrentVersionId)) {
        throw new OpValidationError(
          "unknown-version",
          `prevCurrentVersionId not among remaining versions: ${op.prevCurrentVersionId}`,
        );
      }
      return putItem({ ...item, ...(op.patch ? applyMetaPatch(item, op.patch) : {}), versions, currentVersionId: op.prevCurrentVersionId, ...stamp });
    }

    case "item.restoreVersion": {
      const item = getItem(op.itemId);
      if (item.versions.some((v) => v.id === op.version.id)) {
        throw new OpValidationError("duplicate-id", `version id already exists: ${op.version.id}`);
      }
      return putItem({
        ...item,
        ...(op.patch ? applyMetaPatch(item, op.patch) : {}),
        versions: [...item.versions, op.version],
        currentVersionId: op.version.id,
        ...stamp,
      });
    }

    case "item.delete": {
      const item = getItem(op.itemId);
      const items = { ...canvas.items };
      delete items[op.itemId];
      return withCanvas({
        ...canvas,
        items,
        trash: [...canvas.trash, { item, deletedAt: ts, deletedBy: actor }],
      });
    }

    case "item.restore": {
      const entry = canvas.trash.find((t) => t.item.id === op.itemId);
      if (!entry) throw new OpValidationError("not-in-trash", `item not in trash: ${op.itemId}`);
      return withCanvas({
        ...canvas,
        items: { ...canvas.items, [op.itemId]: entry.item },
        trash: canvas.trash.filter((t) => t.item.id !== op.itemId),
      });
    }

    case "items.move": {
      requireUniqueIds(op.moves.map((m) => m.itemId));
      // Validate all before applying any — a batch is one undo step, so a
      // batch that half-applies is a batch undo cannot take back.
      for (const move of op.moves) {
        getItem(move.itemId);
        requireFinite({ x: move.x, y: move.y }, `items.move ${move.itemId}`);
      }
      const items = { ...canvas.items };
      for (const move of op.moves) {
        items[move.itemId] = { ...items[move.itemId]!, x: move.x, y: move.y, ...stamp };
      }
      return withCanvas({ ...canvas, items });
    }

    case "items.delete": {
      requireUniqueIds(op.itemIds);
      const deleted = op.itemIds.map(getItem);
      const items = { ...canvas.items };
      for (const itemId of op.itemIds) delete items[itemId];
      return withCanvas({
        ...canvas,
        items,
        trash: [
          ...canvas.trash,
          ...deleted.map((item) => ({ item, deletedAt: ts, deletedBy: actor })),
        ],
      });
    }

    case "items.restore": {
      requireUniqueIds(op.itemIds);
      const wanted = new Set(op.itemIds);
      const entries = canvas.trash.filter((t) => wanted.has(t.item.id));
      if (entries.length !== op.itemIds.length) {
        const found = new Set(entries.map((t) => t.item.id));
        const missing = op.itemIds.find((id) => !found.has(id));
        throw new OpValidationError("not-in-trash", `item not in trash: ${missing}`);
      }
      const items = { ...canvas.items };
      for (const entry of entries) items[entry.item.id] = entry.item;
      return withCanvas({
        ...canvas,
        items,
        trash: canvas.trash.filter((t) => !wanted.has(t.item.id)),
      });
    }

    case "trash.empty": {
      // The capture describes restorable trash, never a second archive after
      // the person has explicitly emptied it. Historical area shapes stay put.
      const { groupCohorts: _dropCohorts, ...remaining } = canvas;
      return withCanvas({ ...remaining, trash: [] });
    }

    case "thread.create": {
      if (canvas.threads[op.threadId]) {
        throw new OpValidationError("duplicate-id", `thread id already exists: ${op.threadId}`);
      }
      requireBody(op.comment.body);
      requireFinite({ x: op.x, y: op.y }, "thread.create");
      if (op.anchorItemId !== null) getItem(op.anchorItemId);
      const textAnchor = validateTextAnchor(op.textAnchor, op.anchorItemId ? canvas.items[op.anchorItemId] : undefined);
      // Strict, not takeover: a race between two clients birthing a main
      // thread must not leave one silently demoted — the loser errors and
      // replies to the winner's thread instead. Keeps undo exact, too.
      if (op.main && mainThread(canvas)) {
        throw new OpValidationError("main-exists", "canvas already has a main thread");
      }
      const thread = {
        id: op.threadId,
        x: op.x,
        y: op.y,
        anchorItemId: op.anchorItemId,
        ...(textAnchor ? { textAnchor } : {}),
        comments: [toComment(op.comment, actor, ts)],
        ...(op.main ? { main: true } : {}),
        createdAt: ts,
        createdBy: actor,
      };
      return withCanvas({ ...canvas, threads: { ...canvas.threads, [thread.id]: thread } });
    }

    case "questionnaire.ask":
    case "questionnaire.answer": {
      const thread = getThread(op.threadId);
      if (thread.comments.some((c) => c.id === op.commentId)) throw new OpValidationError("duplicate-id", `comment id already exists: ${op.commentId}`);
      const design = op.type === "questionnaire.ask" ? parseDesignQuestionSet(op.questions) : parseDesignResponse(op.response);
      let body: string;
      if (design.kind === "questions") body = questionnaireQuestionMarkdown(design, op.type === "questionnaire.ask" && !!op.legacySource);
      else {
        const source = questionnaireStates(state!.canvas).find((q) => q.source.threadId === design.question.threadId && q.source.commentId === design.question.commentId && q.source.payloadId === design.question.payloadId && q.source.revision === design.question.revision);
        if (!source || source.questions.requestId !== design.requestId || source.questions.epoch !== design.epoch) throw new OpValidationError("bad-op", "questionnaire response source association disagrees");
        body = designResponseMarkdown(design, source.questions);
      }
      const comment: Comment = { id: op.commentId, author: actor, body, createdAt: ts, design, designReferences: structuredClone(op.retainedReferences ?? []), ...(op.context ? { context: structuredClone(op.context) } : {}), ...(op.type === "questionnaire.ask" && op.legacySource ? { designLegacySource: structuredClone(op.legacySource) } : {}) };
      validateQuestionnaireComment(comment, state!.project.id);
      return withCanvas({ ...canvas, threads: { ...canvas.threads, [thread.id]: { ...thread, comments: [...thread.comments, comment] } } });
    }
    case "thread.reply": {
      const thread = getThread(op.threadId);
      requireBody(op.comment.body);
      if (thread.comments.some((c) => c.id === op.comment.id)) {
        throw new OpValidationError("duplicate-id", `comment id already exists: ${op.comment.id}`);
      }
      const next = { ...thread, comments: [...thread.comments, toComment(op.comment, actor, ts)] };
      return withCanvas({ ...canvas, threads: { ...canvas.threads, [next.id]: next } });
    }

    case "thread.setMain": {
      const prev = mainThread(canvas);
      const next = op.threadId === null ? null : getThread(op.threadId);
      if (prev?.id === next?.id) return withCanvas(canvas); // no-op, but keep the entry
      const threads = { ...canvas.threads };
      if (prev) {
        const demoted = { ...prev };
        delete demoted.main;
        threads[prev.id] = demoted;
      }
      if (next) threads[next.id] = { ...next, main: true };
      return withCanvas({ ...canvas, threads });
    }

    case "thread.setAnchor": {
      const thread = getThread(op.threadId);
      requireFinite({ x: op.x, y: op.y }, "thread.setAnchor");
      // A trashed item is a valid anchor (rendered dangling, like after
      // item.delete) — undoing a re-anchor must restore a dangling anchor.
      if (
        op.anchorItemId !== null &&
        !canvas.items[op.anchorItemId] &&
        !canvas.trash.some((t) => t.item.id === op.anchorItemId)
      ) {
        throw new OpValidationError("unknown-item", `unknown item: ${op.anchorItemId}`);
      }
      const anchorItem = op.anchorItemId ? canvas.items[op.anchorItemId] ?? canvas.trash.find(t => t.item.id === op.anchorItemId)?.item : undefined;
      const textAnchor = validateTextAnchor(op.textAnchor, anchorItem);
      const next = { ...thread, anchorItemId: op.anchorItemId, x: op.x, y: op.y };
      if (textAnchor) next.textAnchor = textAnchor; else delete next.textAnchor;
      return withCanvas({ ...canvas, threads: { ...canvas.threads, [next.id]: next } });
    }

    case "comment.update": {
      const thread = getThread(op.threadId);
      const existing = thread.comments.find((c) => c.id === op.commentId);
      if (!existing) {
        throw new OpValidationError("unknown-comment", `unknown comment: ${op.commentId}`);
      }
      // Your own words only. The single writer is the one place this can be
      // enforced, so it is enforced here rather than asked of every client.
      if (existing.author.id !== actor.id) {
        throw new OpValidationError(
          "bad-op",
          `a comment belongs to its author: ${op.commentId} is ${existing.author.name}'s`,
        );
      }
      // Mentions and item refs are re-resolved for the new body, so an edit
      // that drops a name drops the mention with it.
      const { mentions: _wasMentions, items: _wasItems, ...bare } = existing;
      const edited: Comment = {
        ...bare,
        body: op.body,
        ...(op.mentions ? { mentions: op.mentions } : {}),
        ...(op.items ? { items: op.items } : {}),
        editedAt: ts,
      };
      if (op.context === null) delete edited.context;
      else if (op.context !== undefined) {
        validateContextManifest(op.context, state.project.id);
        edited.context = structuredClone(op.context);
      }
      const next = {
        ...thread,
        comments: thread.comments.map((c) => (c.id === op.commentId ? edited : c)),
      };
      return withCanvas({ ...canvas, threads: { ...canvas.threads, [next.id]: next } });
    }

    case "comment.remove": {
      const thread = getThread(op.threadId);
      if (!thread.comments.some((c) => c.id === op.commentId)) {
        throw new OpValidationError("unknown-comment", `unknown comment: ${op.commentId}`);
      }
      if (thread.comments.length === 1) {
        throw new OpValidationError("last-comment", "cannot remove the last comment of a thread");
      }
      const next = { ...thread, comments: thread.comments.filter((c) => c.id !== op.commentId) };
      return withCanvas({ ...canvas, threads: { ...canvas.threads, [next.id]: next } });
    }

    case "comment.restore": {
      const thread = getThread(op.threadId);
      if (thread.comments.some((c) => c.id === op.comment.id)) {
        throw new OpValidationError("duplicate-id", `comment id already exists: ${op.comment.id}`);
      }
      const next = { ...thread, comments: [...thread.comments, op.comment] };
      return withCanvas({ ...canvas, threads: { ...canvas.threads, [next.id]: next } });
    }

    case "thread.delete": {
      getThread(op.threadId);
      const threads = { ...canvas.threads };
      delete threads[op.threadId];
      return withCanvas({ ...canvas, threads });
    }

    case "thread.restore": {
      if (canvas.threads[op.thread.id]) {
        throw new OpValidationError("duplicate-id", `thread id already exists: ${op.thread.id}`);
      }
      // The carried thread may have been main when deleted; if another thread
      // has become main since, the restored one yields — at most one main.
      const { main: wasMain, ...bare } = op.thread;
      const thread = wasMain && !mainThread(canvas) ? { ...bare, main: true } : bare;
      return withCanvas({
        ...canvas,
        threads: { ...canvas.threads, [op.thread.id]: thread },
      });
    }

    case "agent.enroll": {
      // Re-enrolling updates the record in place: the standing was already
      // there, the rules (or the name) changed. `rules` is stored verbatim;
      // `writtenBy` is the envelope's author, so the rc can tell its owner's
      // gate from anybody else's (`EnrolledAgent.writtenBy`).
      const row = {
        actor: op.agent,
        ...(op.rules !== undefined ? { rules: op.rules } : {}),
        writtenBy: actor,
      };
      return withCanvas({
        ...canvas,
        agents: { ...(canvas.agents ?? {}), [op.agent.id]: row },
      });
    }

    case "agent.invite": {
      // **Standing here, and not one thing more** (the bench, journey 2).
      //
      // Joining is the act of naming an agent you already have on a canvas it
      // has never worked on, so the ONLY thing it may add is the row. Three
      // deliberate preservations, each of them a way the rule "a bench row
      // confers nothing" would otherwise erode:
      //
      //   `rules` is carried across untouched — an invite never spells one,
      //   so a re-invite of an already-enrolled agent cannot widen (or
      //   narrow) who may summon it. A fresh row carries none, which the rc
      //   reads as owner-only.
      //
      //   `writtenBy` is stamped only on a row this op CREATES. Re-stamping
      //   an existing row would hand the inviter authorship of a gate
      //   somebody else wrote, which is the widening above by another door.
      //
      //   The recorded `actor` wins over the one carried, so an invitation
      //   cannot rename an agent the canvas already knows.
      const agents = { ...(canvas.agents ?? {}) };
      const standing = agents[op.agent.id];
      const row = standing
        ? { ...standing, invitedFrom: op.from }
        : { actor: op.agent, writtenBy: actor, invitedFrom: op.from };
      return withCanvas({ ...canvas, agents: { ...agents, [op.agent.id]: row } });
    }

    case "agent.withdraw": {
      const agents = { ...(canvas.agents ?? {}) };
      if (!agents[op.actorId]) {
        throw new OpValidationError("unknown-actor", `no standing agent: ${op.actorId}`);
      }
      delete agents[op.actorId];
      return withCanvas({ ...canvas, agents });
    }

    default:
      return unknownOperation(op);
  }
}

function applyMetaPatch(
  target: { title: string; description: string; properties: Record<string, string> },
  patch: MetaPatch,
): { title: string; description: string; properties: Record<string, string> } {
  const properties = { ...target.properties, ...patch.properties };
  for (const key of patch.removeProperties ?? []) delete properties[key];
  return {
    title: patch.title ?? target.title,
    description: patch.description ?? target.description,
    properties,
  };
}

function toItemVersion(v: NewVersion, actor: Actor, ts: string): ItemVersion {
  return { ...v, createdAt: ts, createdBy: actor };
}

function toComment(c: NewComment, actor: Actor, ts: string): Comment {
  const comment: Comment = { id: c.id, author: actor, body: c.body, createdAt: ts };
  if (c.mentions && c.mentions.length > 0) comment.mentions = [...c.mentions];
  if (c.items && c.items.length > 0) comment.items = [...c.items];
  if (c.context) {
    validateContextManifest(c.context, c.context.canvasId);
    comment.context = structuredClone(c.context);
  }
  return comment;
}

/**
 * Every coordinate and every size that reaches the canvas is a real number.
 *
 * It is here rather than at either surface's edge because a geometry field is
 * the one kind of bad input that does not announce itself: `NaN` compares
 * false against everything, so nothing downstream throws — it lays out, it
 * renders as a blank, and it serializes to `null`, which is what actually
 * lands in the oplog. `JSON.stringify(NaN)` is `null`, so a moment's bad
 * arithmetic anywhere becomes a PERMANENT `"x": null` in the log, and the
 * item is unreachable on both surfaces from then on.
 *
 * Found by running `isocan mv <item> --to 300,200`: `mv` allows unknown
 * options so that negative coordinates survive, which made `--to` an operand,
 * so `Number("--to")` was the x. The CLI now refuses that itself with a better
 * message — but the CLI is not the only writer, and this is the layer both
 * writers share.
 */
function requireFinite(values: Record<string, number>, what: string): void {
  for (const [field, value] of Object.entries(values)) {
    if (!Number.isFinite(value)) {
      throw new OpValidationError(
        "bad-op",
        `${what}: ${field} must be a finite number, got ${
          typeof value === "number" ? String(value) : JSON.stringify(value)
        }`,
      );
    }
  }
}

function requireUniqueIds(ids: string[]): void {
  if (ids.length === 0) {
    throw new OpValidationError("bad-op", "batch op requires at least one item");
  }
  if (new Set(ids).size !== ids.length) {
    throw new OpValidationError("duplicate-id", "batch op lists an item twice");
  }
}

/**
 * **The stack `item.pruneVersions` leaves behind** — exported so a surface
 * can say what a prune WOULD drop before anybody confirms it, from the same
 * rule the reducer applies (lessons.md #5: a rule with one home).
 *
 * The newest `keep` by stack order, plus the current version wherever it
 * sits. Order is preserved, so `v3` still means the third that was made.
 */
export function pruneVersions(item: Item, keep: number): ItemVersion[] {
  const cut = Math.max(0, item.versions.length - Math.max(1, Math.floor(keep)));
  return item.versions.filter((v, index) => index >= cut || v.id === item.currentVersionId);
}

/** What `item.pruneVersions` would remove, in stack order. */
export function prunedVersions(item: Item, keep: number): ItemVersion[] {
  const kept = new Set(pruneVersions(item, keep).map((v) => v.id));
  return item.versions.filter((v) => !kept.has(v.id));
}

function requireVersion(item: Item, versionId: string): void {
  if (!item.versions.some((v) => v.id === versionId)) {
    throw new OpValidationError("unknown-version", `unknown version: ${versionId}`);
  }
}

function requireBody(body: string): void {
  if (body.trim().length === 0) {
    throw new OpValidationError("empty-body", "comment body cannot be empty");
  }
}
