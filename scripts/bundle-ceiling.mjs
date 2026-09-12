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
 * **641,100 → 653,500 on 11 Sep, and this one arrived the way the soft gate
 * was built to let things arrive: as a question, answered late.** The
 * performance persona asked on 8 Sep ("bytes past the last size somebody
 * agreed to") and four nights running; nobody answered, and the queue was one
 * day from reddening `main` over it. Dion's call: raise it, with the reason.
 *
 * Measured at `1e846a1f`: **653,406**. Rebuilt commit by commit on a machine
 * whose build reproduces the nightly's own readings exactly (645,806 at
 * `86cc4cb`, 646,899 at `a2deb19`), the 12,306 bytes are:
 *
 *   1,305  already there at 4caba2f2, the commit that wrote 641,100
 *   2,263  whose word wakes an agent — the gate in core's routing, and its
 *          words in the agent tray (#221)
 *   1,053  an artifact's two faces, visual and source (#215)
 *     888  a Site address that stays editable and says why it is not one yet
 *          (#231, and the follow-up)
 *     798  reading Markdown together — shared text selections
 *   1,303  the guide canvases, listed in the Help panel
 *   3,373  durable quoted comments — a thread anchored to a passage of text
 *   1,033  the switcher's scope toggle, and the minimap folding below 460px
 *          (#265 — it landed while this was being measured, which is the
 *          creep in miniature)
 *     290  smaller: the embed badge (#222), rail tooltips (#234), a held Z
 *          (#233), the sheep's withdrawal badge, the overlay slot
 *
 * Every one is a feature somebody asked for, in core or in the canvas shell,
 * and the largest single step is 3,373 bytes — a sixth of `JUMP`, so none of
 * this is the eager-import accident the hard gate exists for. Accepted for
 * that reason. The margin is 94 bytes, the round-up to the hundred every
 * ceiling here has used: a comment's worth, not a feature's, so the next
 * feature asks.
 *
 * **What it did not buy, written down so it is not forgotten:** the goal is
 * now 13,406 bytes away, the furthest since the namespace import came out on
 * 8 Sep. The first place to look is the Help panel — `CanvasPage` imports it
 * statically and renders it on every visit, so the guide catalog's 1,303
 * bytes are paid by everyone before anyone presses `?`; that is the `lazy()`
 * shape the 6 Sep list took seventy-nine kilobytes out with.
 *
 * The second gate only works because the queue reaches `main` now and an
 * answer covers the nights that repeat it. Before 7 Sep it would have been a
 * warning into a void.
 *
 * **653,500 → 658,000 the same evening, and almost all of it is a debt from
 * earlier in the day.** Two creeps, one raise, both said out loud:
 *
 *   3,943  owner-only summons (#238/#269, the same afternoon), which measured
 *          itself at 657,446 and deliberately did NOT raise the ceiling —
 *          "it moves in the answer to the performance persona's finding, and
 *          this is the sentence that answer can quote." Quoted, and paid: a
 *          second unremarked creep stacked on the first is exactly the shape
 *          this file exists to stop, and it is a worse shape than a raise.
 *     473  granting an agent access from the UI (#272) — the grant control
 *          under a refusal, the tray's who-panel, and the timed gate. NET,
 *          and the two lines below are why the gross was 5,914.
 *  −2,702  the Help panel, behind `lazy()`. Named in this file's own "what it
 *          did not buy" three paragraphs up: `CanvasPage` imported it
 *          statically and rendered it on every visit, so the shortcut tables
 *          and the command registry were paid by everybody before anybody
 *          pressed `?`. That is the whole point of writing the next place to
 *          look down — the next feature read it and took it.
 *  −2,739  #272's own two controls, behind the same boundary. Both are
 *          owner-only and occasional — a grant appears under a message an
 *          agent turned away, the who-panel when its owner opens a tray row
 *          — but all three of their hosts (the comment popover, the Chat,
 *          the tray) are eager, so the controls were too. Behind `lazy()`
 *          they take `withListener`, `listenUntil`, `listenGrants` and
 *          `readsAsTurnedAway` with them, since no eager reader wants those:
 *          two chunks of 1,804 and 1,589 bytes, fetched by the people who
 *          actually grant something. What stays eager is what a first visit
 *          genuinely reads — the words on a tray row and under a comment.
 *
 * 657,916 measured, and the margin is 84 bytes. The goal is 17,916 away,
 * and the shape is the one worth copying rather than the number: a feature
 * that measured 5,914 bytes cost 473, because the parts of it a first visit
 * never reaches were put where a first visit does not go.
 *
 * **658,000 → 660,100 on 12 Sep, for a whole module's registry weight.**
 * Modules phase 5 added `@isocan/sandbox` — a program that lives on the
 * canvas as a file and runs fenced on the machine that typed the verb. The
 * margin was 84 bytes, so it could not have been anything but a raise; this
 * is the sentence, written with the feature rather than left for the fourth
 * night of a persona finding, which is the mistake the paragraph above this
 * one is an apology for.
 *
 * Measured: **660,000**, up 2,084. All of it is the module's CORE record,
 * because that is the half of a module a first visit registers:
 *
 *   ~900  the `/run` command's body, which is the skill an agent reads in
 *         the composer's menu — the one place a browser-side agent learns
 *         that running a canvas's program spends its own machine, and that
 *         a refused fence is not to be worked around. The obvious trim, and
 *         refused: the CLI surface has `--agent-help` to say this and the
 *         web has only the body.
 *   ~700  the record, the context row and the page route's wiring
 *   ~480  the lazy boundary and the module's entry in the shell's list
 *
 * **What it did not cost, which is the part worth copying.** The page
 * component is behind `lazy()`, so the list, the dates and the links are a
 * chunk nobody fetches until they open Sandboxes. And the whole terminal
 * half — the argv split, the transcript writer, the fence request — is
 * `cli.ts`, which the web never imports.
 *
 * The one measurement worth writing down because it was wrong: the CLI-only
 * readers in `core.ts` (`argvOf`, `transcriptOf`, `statusLine`) were split
 * into a `run.ts` on the theory they were riding into the entry chunk on the
 * web half's eager import of the record. Measured, the split changed the
 * chunk's content hash not at all — vite had already shaken them out, since
 * nothing in `web.tsx` or `page.tsx` names them. The split was reverted.
 * **A barrel a module imports eagerly is not automatically a cost**; the
 * cost is what something eager actually references, and the way to know is
 * to grep the built chunk for a string only that code has.
 * **658,000 → 659,300 on 12 Sep, for seen-marks (#147, #134).** The
 * arithmetic, measured on a machine that reproduces the reading (657,915
 * before the change, one byte off the number above):
 *
 *   1,411  gross: `lib/seen.ts` (the mark cache, `loadSeen`, `noteVisit`),
 *          `fetchSeen`/`putSeen` in `lib/api.ts`, the route spellings out of
 *          core, the visit effect on `CanvasPage`, and the switcher's
 *          "lately" merge
 *    −114  `latelyIds` and core's `latelyOrder` moved to `lib/lately.ts`,
 *          which only `CommandPalette` imports — and the palette is already
 *          behind `lazy()`. Small, and the right shape: the merge is read
 *          when somebody opens ⌘O, not when a canvas loads.
 *   1,297  NET
 *
 * **What is left is genuinely eager, and this is the sentence for it.**
 * Opening a canvas IS the act that writes the mark, so the write cannot be
 * deferred behind a boundary without either delaying it or paying a second
 * chunk fetch on every canvas open — which is worse for the person than a
 * kilobyte. The `arrow.ts` lesson three paragraphs up is why the split that
 * WAS available was taken first rather than the ceiling being raised for the
 * gross.
 *
 * 659,212 measured, rounded to 659,300 so the margin is 88 bytes — a
 * comment's worth and not a feature's, which is the whole point of the
 * round-up: the next feature asks. The goal is 19,212 away, and the first
 * place to look is still a `lazy()` boundary rather than a smaller feature.
 *
 * (32 of those bytes are lessons.md #54's fix — the mark's write sequenced
 * after its read so the two cannot race the claim recovery. A bug a real
 * browser found and three green test files did not, paid for in a sentence
 * of bytes.)
 */

/** The last number somebody agreed to. Raised in the ANSWER to a finding, with
 *  the reason in that answer — not quietly in a diff. */
export const CEILING = 660_100;

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
