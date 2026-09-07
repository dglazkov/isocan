/**
 * **What a first visit may download, in one place both readers can see.**
 *
 * The number lived in `test/bundle-budget.test.ts` and only the test could
 * read it. That was fine while the test was the only enforcement — and it
 * stopped being fine on 7 Sep 2026, when the enforcement split in two.
 *
 * ## Why it split
 *
 * The bound was a hard gate: any excess failed `npm test`, which gates the
 * release. In two days it was raised **seven times**, every raise deliberate
 * and every one with a reason written beside it. Dion named the problem in
 * that: *"the gate for size should trigger an effort to slim down but doesn't
 * have to block a release. Maybe if there is a major increase that would be
 * 'oops that's a mistake!'"*
 *
 * He is right, and the evidence is that seven raises teach somebody to edit a
 * number without reading it — which is precisely how the first hundred
 * kilobytes arrived while six nightly reports said so.
 *
 * So there are two questions now, and they want different answers:
 *
 * - **"Did somebody make a mistake?"** — an eager import of something large.
 *   Tens of kilobytes at once, nobody meant it. That still fails the build,
 *   because shipping it is worse than waiting.
 * - **"Is this creeping up?"** — a few hundred bytes for a feature somebody
 *   chose. That is a conversation, not a blocker: it becomes a persona finding
 *   which must be answered within three days (`test/review-queue.test.ts`),
 *   and answering it is where CEILING gets raised with its reason.
 *
 * The second only works because the queue reaches `main` now and an answer
 * covers the nights that repeat it. Before 7 Sep it would have been a warning
 * into a void.
 */

/** The last number somebody agreed to. Raised in the ANSWER to a finding, with
 *  the reason in that answer — not quietly in a diff. */
export const CEILING = 696_100;

/** The performance persona's declared goal (`.agents/personas/performance.md`)
 *  — restated here only so the failure message can say how far there is to go.
 *  That file is where it is decided. */
export const GOAL = 640_000;

/**
 * **How much at once is a mistake rather than a decision.**
 *
 * Every deliberate raise on 7 Sep was between 16 and 956 bytes. An accidental
 * eager import — a charting library, a parser, a page that should have been
 * lazy — is tens of kilobytes. Twenty thousand sits an order of magnitude
 * above the largest thing anybody has meant to do and well below the smallest
 * thing nobody meant.
 *
 * It is the one number here that still stops a release, so it is deliberately
 * generous: a false stop costs a promotion, and this project has already spent
 * a day on what a red trunk costs.
 */
export const JUMP = 20_000;
