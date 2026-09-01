/**
 * **The board is its own collaborator, whoever set it off.**
 *
 * A git hook inherits the environment of whatever process committed — which in
 * a repo with several agents working in it is *another agent's session*. The
 * CLI then acts as that agent, and on this machine that failed eleven times out
 * of eleven with `"Kenny" is taken here`: the board had never once updated from
 * a commit, and said so only into a log nobody was reading.
 *
 * It matters twice, and the second time is easier to miss. A watcher tailing
 * the canvas as the person who launched it cannot tell that person's changes
 * from its own — parking and tailing both need the board to BE somebody, so
 * "not me" has an id to compare against.
 *
 * So the identity is pinned rather than inherited: one stable session key,
 * handed to `connect()` as a stated argument (iso-api phase 2) by both scripts
 * that act as the board — `canvas-board.mjs` and `board-watch.mjs`. It used to
 * be env-var surgery (`boardEnv` cleared every harness variable before each
 * CLI spawn); the last spawner went with iso-api phase 3, and the surgery with
 * it. The claim gesture is unchanged:
 * `ISOCAN_HARNESS=board ISOCAN_SESSION_ID=isocan-board isocan identity --name Board --session`.
 *
 * One copy, imported by both scripts. Two copies of this would drift, and the
 * drift would look exactly like the bug it fixes.
 */

/** Stable across every run, so the board is one actor rather than a crowd. */
export const BOARD_SESSION = process.env.ISOCAN_BOARD_SESSION ?? "isocan-board";

/** What `isocan identity --name` was given, for the message when it is absent. */
export const BOARD_NAME = "Board";

/** The identity as a STATED ARGUMENT — what both board scripts hand
 * `connect()`. One key, spelled once. */
export const BOARD_IDENTITY = { session: BOARD_SESSION, harness: "board" };
