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

import type { CanvasContents } from "./model.ts";
import type { Operation } from "./ops.ts";

/**
 * **Work-visible contract** (Open Stitch Phase 2A, OS1 ADR 0018).
 *
 * Every user-visible op derives exactly one first-person past-tense summary
 * reused across CLI confirmation, presence, cards, and voice — and paint acks
 * let callers distinguish *applied* (in the oplog) from *rendered* (painted on
 * a connected canvas surface).
 */

/** Optional context used to name items cleanly in {@link summarizeOp}. */
interface OpSummaryContext {
  canvas?: CanvasContents | null | undefined;
  itemTitle?: string | undefined;
}

/** Whether an op has only landed in the daemon log or has been painted by a client. */
type PaintAckStatus = "rendered" | "applied";

/** Result of waiting for a client paint acknowledgement at a target sequence number. */
export interface PaintAckResult {
  seq: number;
  status: PaintAckStatus;
  paintedSeq: number;
  waitedMs: number;
}

function itemLabel(itemId: string, context?: OpSummaryContext): string {
  if (context?.itemTitle?.trim()) return context.itemTitle.trim();
  const item =
    context?.canvas?.items[itemId] ??
    context?.canvas?.trash.find((entry) => entry.item.id === itemId)?.item;
  return item?.title?.trim() || itemId;
}

/**
 * Generate one first-person past-tense summary sentence for a user-visible
 * canvas operation (OS1 ADR 0018).
 */
export function summarizeOp(op: Operation, context?: OpSummaryContext): string {
  switch (op.type) {
    case "project.create":
      return `I created canvas "${op.title}".`;
    case "project.update":
      return op.patch.title
        ? `I renamed the canvas to "${op.patch.title}".`
        : "I updated the canvas details.";
    case "project.delete":
      return "I deleted the canvas.";
    case "item.add": {
      const name = op.title?.trim() || op.version.filename || op.itemId;
      return `I added "${name}".`;
    }
    case "item.move":
      return `I moved "${itemLabel(op.itemId, context)}" to (${Math.round(op.x)}, ${Math.round(op.y)}).`;
    case "item.resize":
      return `I resized "${itemLabel(op.itemId, context)}" to ${Math.round(op.width)}×${Math.round(op.height)}.`;
    case "item.update": {
      const label = itemLabel(op.itemId, context);
      if (op.patch.title && op.patch.title !== label) {
        return `I renamed "${label}" to "${op.patch.title}".`;
      }
      return `I updated "${label}".`;
    }
    case "item.addVersion":
    case "item.edit":
      return `I updated "${itemLabel(op.itemId, context)}" with a new version.`;
    case "item.setCurrentVersion":
      return `I switched "${itemLabel(op.itemId, context)}" to version ${op.versionId}.`;
    case "item.pruneVersions":
      return `I pruned older versions of "${itemLabel(op.itemId, context)}", keeping ${op.keep}.`;
    case "item.removeVersion":
      return `I reverted a version of "${itemLabel(op.itemId, context)}".`;
    case "item.restoreVersion":
      return `I restored a version of "${itemLabel(op.itemId, context)}".`;
    case "item.delete":
      return `I moved "${itemLabel(op.itemId, context)}" to the trash.`;
    case "item.restore":
      return `I restored "${itemLabel(op.itemId, context)}" from the trash.`;
    case "item.react":
      return `I ${op.on ? "added" : "removed"} ${op.emoji} on "${itemLabel(op.itemId, context)}".`;
    case "items.move":
      return `I moved ${op.moves.length} item${op.moves.length === 1 ? "" : "s"}.`;
    case "items.delete":
      return `I moved ${op.itemIds.length} item${op.itemIds.length === 1 ? "" : "s"} to the trash.`;
    case "items.restore":
      return `I restored ${op.itemIds.length} item${op.itemIds.length === 1 ? "" : "s"} from the trash.`;
    case "trash.empty":
      return "I emptied the trash.";
    case "thread.create": {
      const anchor = op.anchorItemId ? ` on "${itemLabel(op.anchorItemId, context)}"` : "";
      return `I started a comment thread${anchor}.`;
    }
    case "thread.reply":
      return `I replied in thread ${op.threadId}.`;
    case "thread.setAnchor":
      return op.anchorItemId
        ? `I anchored thread ${op.threadId} to "${itemLabel(op.anchorItemId, context)}".`
        : `I detached thread ${op.threadId}.`;
    case "thread.setMain":
      return op.threadId
        ? `I set thread ${op.threadId} as the main Chat.`
        : "I cleared the main Chat designation.";
    case "thread.delete":
      return `I deleted thread ${op.threadId}.`;
    case "thread.restore":
      return `I restored thread ${op.thread.id}.`;
    case "comment.update":
      return "I edited my comment.";
    case "comment.remove":
      return "I removed a comment.";
    case "comment.restore":
      return "I restored a comment.";
    case "group.change":
      return "I updated group layout.";
    case "agent.enroll":
      return `I enrolled ${op.agent.name} on this canvas.`;
    case "agent.invite":
      return `I invited ${op.agent.name} to this canvas.`;
    case "agent.withdraw":
      return `I withdrew agent ${op.actorId} from this canvas.`;
    case "agent.ceiling":
      return op.ceiling
        ? `I set a ${op.ceiling} ceiling on ${op.actorId}.`
        : `I lifted the ceiling on ${op.actorId}.`;
    default:
      return `I applied ${op.type}.`;
  }
}
