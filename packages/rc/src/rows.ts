/**
 * **The rc half of the enrolment record, as types** (docs/projects/room/design.md).
 *
 * The row is what the room reads to run an agent; where the rows are kept is
 * the host's. On the laptop that is `~/.isocan/rc-agents.json`, written by
 * `packages/cli/src/rc.ts`, which re-exports these types so its importers keep
 * their paths. `SheepPlace` is here because the row carries one;
 * `packages/cli/src/sheep.ts` keeps finding it on this machine.
 */

/** Where an agent's sheep live: the kennel sheep reads, and the home that
 * kennel named at birth — an address, or `local` for the home under the
 * kennel itself, whose port changes with every start. */
export interface SheepPlace {
  kennel: string;
  home: string;
}

export interface RcAgentRow {
  canvasId: string;
  actorId: string;
  /** The name at enrolment, for saying so without a registry round trip.
   * The registry stays the authority on names. */
  name: string;
  /** How to start a session — the enrolling caller's harness, a flag, or
   * null for "not yet said"; phase 3 reads it. */
  harness: string | null;
  /** Where the agent's sessions run. The agent verb takes no --dir: this is
   * always where the enrolling caller already stood. */
  cwd: string;
  /** The ACP resume handle, once phase 3 mints one. Null until then. */
  sessionId: string | null;
  /** Private compare-and-restore token while enrolment is being published. */
  preparationId?: string;
  /** For the sheep harness, where `sessionId` lives: the kennel and the
   * home it named at birth. Carried so a summons from any directory
   * resumes the same sheep, and so a kennel re-pointed since is refused
   * rather than answered with a second sheep. */
  sheep?: SheepPlace;
  /**
   * For the sheep harness, the pass minted at this sheep's birth — its id and
   * the canvas it was minted on, never its token. The desk answers its minter
   * which badge redeemed it (`GET …/passes/:passId`), and that badge is the
   * cell's, so withdrawal ends exactly it and `isocan badges` can name it.
   * Belongs to the sheep in `sessionId`: dropped when the row's sheep
   * changes without a birth.
   */
  cellPass?: { canvasId: string; passId: string };
}
