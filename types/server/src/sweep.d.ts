import type { SweepReport } from "../../core/src/index.js";
import type { BadgeRecord, Desk } from "./desk.js";
/**
 * Re-run the door on one canvas and act on the answers.
 *
 * Called after a grant is revoked, and after a badge is killed (once per
 * canvas it had been let into). It takes no grant id on purpose: the sweep is
 * not "undo this row", it is "this canvas's admissions have been disturbed,
 * ask the door about the ones that no longer stand". A signature that named
 * the revoked grant would invite an implementation that only looked for it,
 * which is the version that misses chains and cycles.
 */
export declare function sweepCanvas(desk: Desk, canvasId: string): Promise<SweepReport>;
/**
 * **Kill a badge, then sweep every room it had been in.**
 *
 * The composition the design promises — *"kill-a-badge handles the
 * stolen-laptop case; grant revocation handles the un-invite. The two
 * compose"* — turned into two lines, and the second line is the one that is
 * easy to leave out.
 *
 * Ending a badge's recognition stops that HOLDER. It does not, on its own,
 * stop the machines that holder vouched onto a canvas with a pass: their
 * admissions name a badge that can no longer authenticate, which is a root
 * that no longer stands, and until something re-runs the door they sit there
 * looking admitted. So a stolen laptop that had escalated two more machines
 * would be killed while the two machines it enrolled carried on — which is
 * exactly the failure the sweep exists to prevent, arriving through the other
 * door.
 *
 * The canvases come off the record as it was ALIVE, which is why `killBadge`
 * hands that back rather than a boolean.
 *
 * Returns null when there was no live badge to kill: an already-dead badge is
 * not an error (two people can end one laptop) and there is nothing left to
 * sweep, because the first kill swept it.
 */
export declare function killAndSweep(desk: Desk, badgeId: string, by: string, now?: string): Promise<{
    killed: BadgeRecord;
    swept: SweepReport;
} | null>;
