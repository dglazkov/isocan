/**
 * How long something took, said the way a person would.
 *
 * A working note carries two daemon timestamps — when it was posted and when
 * it was last rewritten — so the canvas can say how long the work took without
 * anybody claiming it. An agent that types "took about 5 minutes" is guessing;
 * this is measured.
 */
/** "4s", "2m", "1h 12m" — coarse on purpose: nobody needs 4m 13.2s. */
export declare function elapsedLabel(fromISO: string, toISO: string): string;
/** What a comment's timestamps say about how long its author worked, or null
 * when it was never rewritten — an unedited note took no measurable time. */
export declare function workedFor(comment: {
    createdAt: string;
    editedAt?: string;
}): string | null;
/**
 * **How long ago, in as few characters as possible** — "8m", "3h", "12d".
 *
 * Private to `context.ts` until the home screen needed the same words under
 * every canvas. A second copy would have drifted the first time somebody
 * decided minutes should round differently, and these two views sit one click
 * apart.
 *
 * Empty string for a time in the future or an unparseable one: a card saying
 * "in 3h" about something that already happened is worse than a card saying
 * only who did it.
 */
export declare function ago(iso: string, nowMs: number): string;
