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
 * **637,600 → 637,400 on 9 Sep, and it went DOWN because the raise above was
 * answered rather than accepted.** Dion, reading that entry: *"A cursor should
 * only be loaded if a theme is loaded."* He is right, and it cost 609 bytes to
 * agree with him — the seven cursor paths were in `@isocan/core/theme.ts`,
 * which every first visit downloads, and a canvas on the dot grid draws
 * exactly one of them.
 *
 * Core is one barrel with no subpath exports, so nothing in it can arrive
 * later; the paths moved to the surface that draws them
 * (`web/src/lib/cursorart.ts`, behind an `import()`) and core kept the
 * decision. The first attempt at the split SAVED 12 BYTES AND COST 81, because
 * the arrow was exported from the same module and a bundler merges a module
 * imported both ways — which is why `arrow.ts` exists and why the guard reads
 * the built chunks instead of the imports.
 *
 * Worth keeping as the shape rather than the number: a raise that gets
 * answered is the gate working exactly as designed. The ceiling went up for a
 * feature, somebody read the sentence, and it came back down further than it
 * went up.
 *
 * **637,400 → 641,100 on 9 Sep, for the module API's own weight.** #156's
 * report turned into a host a module can write through, an overlays slot, a
 * drop registry and the experiments gate — all shell code, all in the first
 * paint because the shell is.
 *
 * **The module behind the experiment is NOT in it, and that was measured
 * rather than assumed.** Built as a plain import gated at render, stickers put
 * 6,227 bytes into the entry chunk for everybody including the people who
 * never switch it on — gating the drawing and not the download. It arrives
 * through `addModule` now, the way a runtime module does, and the entry chunk
 * carries none of it: 6,227 became 3,695, and the rest is API.
 *
 * Worth keeping as the rule rather than the number: **"merged but off" has to
 * mean off**, and an experiment costing everybody bytes is not off. The gate
 * asked, this is the sentence, and the half of the raise that was avoidable
 * was avoided before it was written down.
 *
 * **641,100 → 646,844 on 10 Sep, and the first 1,305 bytes were over before
 * the ceiling was written.** 5,744 bytes past it, and building every commit
 * since the last raise accounts for all of them:
 *
 * - **1,305 predate the number they were meant to fit under.** #214, areas
 *   that grow to fit their items, cost 1,304 bytes of core and landed while
 *   the 641,100 raise was in flight. That raise's own commit builds to
 *   642,405 — 641,100 plus #214, to within a byte — which is what measuring
 *   before a rebase and committing after it looks like. Nobody chose those
 *   bytes; the sentence that should have covered them was written without
 *   them.
 * - **2,263 for #221**, telling an agent whose word wakes it: the rules in
 *   core's `inbox.ts` and the row that shows them, the only two files it
 *   touched.
 * - **1,053 for #215's dual faces** — a version learning a second face, and
 *   the card, the thumbnail and the viewer choosing which one to draw.
 * - **888 for the Site address field** (#231 and the commit after it):
 *   keeping an incomplete address editable, and saying nothing about one
 *   until it is one.
 * - **235 in four small pieces**: the rail's tooltips (#234, 138), the
 *   embed's badge (#222, 78), a held Z letting go (#233, 12) and the overlay
 *   slot (7).
 *
 * What it did NOT cost is the home peek. #224 and #226 rebuilt hover on the
 * home page and moved this number by nothing, because that page is split out
 * of the entry.
 *
 * Accepted rather than chased, by decision: each piece is a feature somebody
 * asked for, none is the eager import JUMP exists to stop, and the gate did
 * its job — it asked on three nights and waited for a sentence. The part
 * worth keeping is the first bullet. A raise measured on one tree and
 * committed on another agrees to a number no build produced, so measure after
 * the rebase, not before it.
 *
 * It is also the fourth raise in this register, against two reductions, and
 * it leaves the goal 6,844 bytes away. By the rule `test/bundle-budget.test.ts`
 * wrote on 6 Sep — three justified raises, then a session taking bytes out —
 * this one should have been that session. It was decided otherwise today, so
 * the rule falls to whoever next finds this number over.
 *
 * The second gate only works because the queue reaches `main` now and an
 * answer covers the nights that repeat it. Before 7 Sep it would have been a
 * warning into a void.
 */

/** The last number somebody agreed to. Raised in the ANSWER to a finding, with
 *  the reason in that answer — not quietly in a diff. */
export const CEILING = 646_844;

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
