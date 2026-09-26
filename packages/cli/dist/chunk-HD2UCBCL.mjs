import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  isSystemActor,
  resolveActor
} from "./chunk-4DD3YO2G.mjs";

// packages/core/src/chatclean.ts
function removableComment(comment) {
  return comment.design === void 0 && comment.designDecision === void 0;
}
function mayRemoveComment(comment, actorId, owner, joined) {
  return owner || resolveActor(joined, comment.author.id) === resolveActor(joined, actorId);
}
function matchesFilter(comment, filter, joined) {
  switch (filter.kind) {
    case "system":
      return isSystemActor(comment.author.id);
    case "from":
      return resolveActor(joined, comment.author.id) === resolveActor(joined, filter.actorId);
    case "before":
      return Date.parse(comment.createdAt) < Date.parse(filter.before);
    case "all":
      return true;
  }
}
function cleanupSelection(thread, filter, actorId, owner, joined) {
  return thread.comments.filter(
    (comment) => removableComment(comment) && matchesFilter(comment, filter, joined) && mayRemoveComment(comment, actorId, owner, joined)
  );
}
function cleanupOps(thread, commentIds) {
  const taking = new Set(commentIds.filter((id) => thread.comments.some((c) => c.id === id)));
  if (taking.size === 0) return [];
  if (taking.size === thread.comments.length) return [{ type: "thread.delete", threadId: thread.id }];
  return thread.comments.filter((c) => taking.has(c.id)).map((c) => ({ type: "comment.remove", threadId: thread.id, commentId: c.id }));
}
function parseBefore(text) {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  const ms = day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])).getTime() : Date.parse(text);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}
function cleanupNoun(filter, count, name) {
  const s = count === 1 ? "" : "s";
  switch (filter.kind) {
    case "system":
      return `${count} system notice${s}`;
    case "from":
      return `${count} message${s} from ${name ?? filter.actorId}`;
    case "before":
      return `${count} message${s} from before ${name ?? filter.before}`;
    case "all":
      return `${count} message${s}`;
  }
}

export {
  removableComment,
  mayRemoveComment,
  cleanupSelection,
  cleanupOps,
  parseBefore,
  cleanupNoun
};
