import { create } from "zustand";
import type { Actor, CanvasState, CommentThread } from "@isocan/core";
import { useUiStore } from "./uiStore.ts";

/**
 * "What arrived while I wasn't looking." Per-thread read watermarks live in
 * localStorage (per project, per browser — the same place identity lives), so
 * reopening a canvas shows what happened since your last visit. A comment of
 * your own is never unread.
 *
 * Deliberately local: this is a property of a viewer, not of the canvas, so
 * it is not an operation and never touches the oplog.
 */

export interface CommentNotice {
  /** The comment's id — one toast per arriving comment. */
  id: string;
  threadId: string;
  author: Actor;
  body: string;
  /** Wall-clock arrival, for expiry. */
  at: number;
}

/** Watermarks: threadId → ISO time you last read that thread. */
type Watermarks = Record<string, string>;

interface UnreadStore {
  projectId: string | null;
  /** Whose watermarks are loaded — switching identities reloads them. */
  actorId: string | null;
  seen: Watermarks;
  notices: CommentNotice[];
}

export const useUnreadStore = create<UnreadStore>(() => ({
  projectId: null,
  actorId: null,
  seen: {},
  notices: [],
}));

/** Per project AND per person: "since MY last visit" is a claim about a
 * reader, and one browser can hold several (#43). */
const keyFor = (projectId: string, actorId: string | null) =>
  actorId ? `isocan.seen.${projectId}.${actorId}` : `isocan.seen.${projectId}`;

function load(projectId: string, actorId: string | null): Watermarks | null {
  const stored = readKey(keyFor(projectId, actorId));
  if (stored || !actorId) return stored;
  // Watermarks written before read state was per-person belong to whoever is
  // holding the browser now — inherit them once, then keep them under the
  // new key. A second identity finds nothing here and starts fresh, which is
  // exactly right for a newcomer.
  const legacy = readKey(keyFor(projectId, null));
  if (legacy) persist(projectId, actorId, legacy);
  return legacy;
}

function readKey(key: string): Watermarks | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Watermarks) : null;
  } catch {
    return null;
  }
}

function persist(projectId: string, actorId: string | null, seen: Watermarks): void {
  try {
    localStorage.setItem(keyFor(projectId, actorId), JSON.stringify(seen));
  } catch {
    // Private mode / quota — unread marks are a nicety, not worth failing over.
  }
}

/**
 * Called with each snapshot, and again when you become someone else. A canvas
 * you have never opened starts fully read: the point is to show what changed
 * since YOUR last visit, not to greet a newcomer with every comment ever
 * written.
 */
export function syncProject(
  projectId: string,
  canvas: CanvasState,
  actorId: string | null = null,
): void {
  const stored = load(projectId, actorId);
  const previous = useUnreadStore.getState();
  if (stored) {
    if (previous.projectId === projectId && previous.actorId === actorId) return;
    // Drop watermarks for threads that no longer exist, so deleting threads
    // over a long-lived canvas does not grow the record forever.
    const seen: Watermarks = {};
    for (const threadId of Object.keys(canvas.threads)) {
      if (stored[threadId]) seen[threadId] = stored[threadId]!;
    }
    persist(projectId, actorId, seen);
    useUnreadStore.setState({ projectId, actorId, seen, notices: [] });
    return;
  }
  const now = new Date().toISOString();
  const seen: Watermarks = {};
  for (const threadId of Object.keys(canvas.threads)) seen[threadId] = now;
  persist(projectId, actorId, seen);
  useUnreadStore.setState({ projectId, actorId, seen, notices: [] });
}

/** Mark a thread read as of now, and retire any toasts pointing at it. */
export function markRead(threadId: string): void {
  const { projectId, actorId, seen, notices } = useUnreadStore.getState();
  const next = { ...seen, [threadId]: new Date().toISOString() };
  if (projectId) persist(projectId, actorId, next);
  useUnreadStore.setState({
    seen: next,
    notices: notices.filter((notice) => notice.threadId !== threadId),
  });
}

export function dismissNotice(id: string): void {
  useUnreadStore.setState((s) => ({ notices: s.notices.filter((n) => n.id !== id) }));
}

const MAX_NOTICES = 4; // a stack, not a wall

/**
 * A comment from someone else just landed. If you already have that thread
 * open you are reading it — no toast, and the watermark moves instead.
 */
export function noticeComment(notice: CommentNotice): void {
  if (useUiStore.getState().openThreadId === notice.threadId) {
    markRead(notice.threadId);
    return;
  }
  useUnreadStore.setState((s) => ({
    notices: [...s.notices.filter((n) => n.id !== notice.id), notice].slice(-MAX_NOTICES),
  }));
}

/** Comments in this thread written by others since you last read it. */
export function unreadCount(thread: CommentThread, seen: Watermarks, selfId: string): number {
  const since = seen[thread.id];
  return thread.comments.filter(
    (comment) => comment.author.id !== selfId && (!since || comment.createdAt > since),
  ).length;
}

/** Threads with anything unread — what the tab title counts. */
export function unreadThreads(
  canvas: CanvasState,
  seen: Watermarks,
  selfId: string,
): CommentThread[] {
  return Object.values(canvas.threads).filter(
    (thread) => unreadCount(thread, seen, selfId) > 0,
  );
}
