/**
 * How long something took, said the way a person would.
 *
 * A working note carries two daemon timestamps — when it was posted and when
 * it was last rewritten — so the canvas can say how long the work took without
 * anybody claiming it. An agent that types "took about 5 minutes" is guessing;
 * this is measured.
 */

/** "4s", "2m", "1h 12m" — coarse on purpose: nobody needs 4m 13.2s. */
export function elapsedLabel(fromISO: string, toISO: string): string {
  const ms = Math.max(0, Date.parse(toISO) - Date.parse(fromISO));
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** What a comment's timestamps say about how long its author worked, or null
 * when it was never rewritten — an unedited note took no measurable time. */
export function workedFor(comment: { createdAt: string; editedAt?: string }): string | null {
  return comment.editedAt ? elapsedLabel(comment.createdAt, comment.editedAt) : null;
}
