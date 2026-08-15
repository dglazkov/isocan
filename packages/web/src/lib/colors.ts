/**
 * Unified actor identity colors: one deterministic color per actor, used for
 * cursors, remote-selection outlines, and comment-pin avatars. A small
 * curated set that sits well on the Drafting Table's vellum — cobalt stays
 * reserved for structure (own selection, primary actions), so it is not here.
 */
const IDENTITY_COLORS = [
  "#0f8a80", // teal
  "#c93a55", // crimson
  "#7a3fd0", // violet
  "#b26a00", // amber
  "#3a7d2c", // forest
  "#3d63dd", // periwinkle (distinct from action cobalt #1f3fd0)
];

export function actorColor(actorId: string): string {
  let hash = 0;
  for (let i = 0; i < actorId.length; i++) {
    hash = (hash * 31 + actorId.charCodeAt(i)) >>> 0;
  }
  return IDENTITY_COLORS[hash % IDENTITY_COLORS.length]!;
}
