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
 * **696,100 → 636,000 on 8 Sep 2026, and it went DOWN**, which had not
 * happened before: one namespace import (`import * as core` in
 * `web/lib/runtimeModules.ts`, publishing the host object runtime modules
 * read) asked for every export of `@isocan/core` and pinned all of it into
 * the first paint — 51.5% of the chunk, `recap.ts` and `evals.ts` included,
 * which this app never calls. Fetched inside the guard that already returns
 * early when no module has a web half, it is 64,271 bytes lighter and under
 * the 640,000 goal for the first time since the goal existed.
 *
 * **636,000 → 637,100 the same afternoon, and this is the gate working rather
 * than failing.** #204 phase 3 added a cursor library — three shapes and the
 * fold that chooses between them — for 1,015 bytes. A creep, so it asked
 * instead of blocking, and this is the answer: a feature Dion asked for, paid
 * in a kilobyte, and still 2,985 bytes under the goal. The gate exists so that
 * a raise costs somebody a sentence; this is the sentence.
 *
 * **637,100 → 637,600, and the interesting part is what it did NOT cost.**
 * #195's painted grounds landed on 8 Sep: four JPEG tiles, two new grounds,
 * and two hand-written procedural components deleted. The art is 1.26MB and
 * **none of it is in this number** — a tile is a file in `public/grounds/`
 * fetched only by a canvas wearing that ground, so a canvas on the dot grid
 * downloads none of them and a canvas on a starfield downloads none of them
 * either. What the entry chunk actually paid is 453 bytes of core: two more
 * names in `THEMES`, their labels, their cursor cases and their tone rows.
 *
 * That is the shape worth copying rather than the number: a feature that
 * looked like megabytes cost half a kilobyte, because the megabytes were put
 * where a first visit does not go. A creep, so it asked instead of blocking,
 * and this is the sentence it asked for.
 *
 * The second gate only works because the queue reaches `main` now and an
 * answer covers the nights that repeat it. Before 7 Sep it would have been a
 * warning into a void.
 */

/** The last number somebody agreed to. Raised in the ANSWER to a finding, with
 *  the reason in that answer — not quietly in a diff. */
export const CEILING = 637_600;

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
