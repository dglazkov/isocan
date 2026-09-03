import type { Capability, SweepReport } from "@isocan/core";
import { admittingGrant, rungOfAdmission } from "./grants.ts";
import type { Admission, BadgeRecord, Desk, Provenance } from "./desk.ts";

/**
 * **The provenance sweep: revocation's grip** (identity desk, mechanism 4).
 *
 * Revoking a grant stops NEW arrivals — that is `Desk.revokeGrant`, and it has
 * worked since phase 7. This file is the other half, the one phase 7
 * deliberately did not half-build: expelling the badges that are already
 * inside *because of that row*.
 *
 * The design's sentence is the specification:
 *
 * > Revoking a grant sweeps every admission rooted in it, however many
 * > pass-hops away — but the sweep **re-runs the door test first**: a badge
 * > whose attestations satisfy a surviving grant re-roots instead of dropping.
 * > So revoking Jordan's email grant expels her tab, her daemon, and Nico in
 * > one pass — while turning off the *link* grant expels only those no other
 * > grant covers: it stops strangers without expelling the invited.
 *
 * Getting the two halves the wrong way round is the failure the design names
 * by name, and it is not a subtle bug: a sweep that expels first and asks
 * afterwards turns "the link is off" into "everybody out", including the
 * people who were invited personally. That is why the door test is a call to
 * the SAME `admittingGrant` the door runs, rather than a re-implementation
 * that happens to agree today.
 *
 * ## The predicate: "roots that no longer stand", not "rooted in the row"
 *
 * The design says *rooted in the revoked grant*, and this walks something
 * slightly wider: every admission on the canvas whose root **no longer
 * stands**. On the revocation path the two are the same set plus the ones a
 * previous gesture already broke, and the wider predicate is what makes three
 * awkward shapes fall out instead of needing cases:
 *
 * - **A chain, however long.** `{root: "pass", badgeId}` names the MINTER, so
 *   an admission's real root is found by following that badge's own admission
 *   to this canvas, hop by hop (`decide` below). Nothing had ever walked one
 *   of those chains before this file; phase 8 built it precisely so this could.
 * - **A chain whose middle badge is gone.** Kill a laptop and every machine it
 *   passed onto this canvas is left hanging off a badge that can no longer
 *   authenticate. Those admissions are not "rooted in" any grant at all, and a
 *   sweep that only looked for the revoked grant id would walk straight past
 *   them. Under this predicate they are exactly what an unstanding root looks
 *   like, so `killBadge` sweeps its own canvases and the beneficiaries get the
 *   door test they are owed — kept if a grant still covers them, gone if not.
 * - **A cycle.** B was let in by a pass from M; M was later expelled and got
 *   back in on a pass from B. Their roots now point at each other and at
 *   nothing else. A walk from the revoked grant never reaches either of them
 *   and both would live forever; a walk that RESOLVES each root meets its own
 *   `walking` set and calls the cycle unstanding, which is the truth about it —
 *   nobody in a cycle can say who let them in.
 *
 * ## What is deliberately left standing
 *
 * `{root: "link"}` — the historical provenance phases 2 to 6 wrote before
 * there was a grant to point at. It names no row, so no revocation can find
 * it, and re-testing it would be the sweep inventing a root the desk never
 * wrote. `desk.ts` carries the argument where the type is declared. It is a
 * real hole in revocation, it is bounded to badges minted before phase 7 on a
 * home that has run continuously since, and it is smaller than the alternative
 * (a revocation expelling holders it cannot name).
 *
 * `{root: "created"}` — the badge that made the canvas. "The only root that is
 * not somebody let me in, and the only one a sweep never touches."
 *
 * ## Order must not decide the answer, so nothing is decided in order
 *
 * The first version of this walked the canvas's badges in whatever order the
 * desk handed them over and asked of each one "does its root still stand?".
 * It got a chain wrong, and it got it wrong in exactly the shape the design
 * warns about: Jordan's tab came in on the link and her daemon on a pass from
 * the tab, so with the daemon considered FIRST its chain resolved through a
 * tab whose root had just been revoked, and the daemon was expelled — a moment
 * before the tab was re-rooted onto the email grant that had invited her by
 * name. Two badges of one person, one kept and one thrown out, decided by a
 * list order. The suite caught it on the first run.
 *
 * So a badge's fate is not read off its minter's stale ROOT; it adopts its
 * minter's OUTCOME. `decide` below is a memoized recursion over the chain: a
 * pass-derived admission asks what happened to the badge that minted it, and
 * that badge asks its own minter, down to something that answers for itself —
 * a grant, a creation, a cycle, or a minter that is not here any more. Every
 * badge is decided exactly once per round, whatever order they arrive in.
 *
 * ## And it still iterates
 *
 * One recursive pass is already complete, so the second round is normally a
 * verification that finds nothing left to do. It is kept for the reason
 * `Engine.undo` taught this codebase (lesson #6): a desk whose `expel` or
 * `reroot` silently stops working would otherwise leave a sweep that reports
 * success while changing nothing. Here it loops instead, and the bound turns
 * that into a loud error in milliseconds rather than a wedged write chain and
 * a daemon that has stopped answering anybody.
 */

/**
 * **What a sweep did to one badge, told to whoever is listening** (roles
 * design, "Reaching an open socket"). A re-rooted badge is told its new
 * rung; an expelled one is put out. Reported per badge rather than as the
 * count alone, because the count answers the person who pressed the control
 * and this answers the people it reached.
 */
export type SweepOutcome =
  | { outcome: "rerooted"; capability: Capability }
  | { outcome: "expelled" };

export type SweepListener = (canvasId: string, badgeId: string, outcome: SweepOutcome) => void;

/**
 * **Where the sweep's outcomes go, and what it remembers of them.**
 *
 * One hub per daemon, handed to the routes that sweep and to `ws.ts`, which
 * subscribes once — the way it subscribes to `engine.onEvent`. Two jobs:
 *
 * - **Fan-out.** Every `(canvasId, badgeId, outcome)` a sweep produces
 *   reaches every listener. A listener that throws does not stop the sweep,
 *   which has a desk to finish writing.
 * - **Memory of expulsion**, for `POST /api/oplog/watch`. A badge that was
 *   swept out has no admission any more, and the door alone cannot tell
 *   "never let in" from "put out" — but the difference is the whole message
 *   to an agent parked in `isocan wait`. So an expulsion is remembered here,
 *   by badge and canvas, until that badge is admitted to the canvas again.
 *   In-process, like the rooms: a home runs as one instance, and a local
 *   daemon is one process. Bounded, so a long-lived home does not grow a
 *   list of every badge it ever put out.
 */
export class SweepHub {
  private readonly listeners = new Set<SweepListener>();
  /** `${badgeId} ${canvasId}` → when. Insertion-ordered, which is what
   * makes the bound a FIFO. */
  private readonly withdrawn = new Map<string, string>();
  private static readonly REMEMBER = 10_000;

  on(listener: SweepListener): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  /** The sweep's own callback — bound, so it can be handed over as is. */
  readonly report: SweepListener = (canvasId, badgeId, outcome) => {
    const key = `${badgeId} ${canvasId}`;
    if (outcome.outcome === "expelled") {
      this.withdrawn.delete(key);
      this.withdrawn.set(key, new Date().toISOString());
      while (this.withdrawn.size > SweepHub.REMEMBER) {
        const oldest = this.withdrawn.keys().next().value;
        if (oldest === undefined) break;
        this.withdrawn.delete(oldest);
      }
    } else {
      this.withdrawn.delete(key);
    }
    for (const listener of this.listeners) {
      try {
        listener(canvasId, badgeId, outcome);
      } catch {
        // A listener's failure is the listener's; the desk is already
        // written and the next badge still has to be told.
      }
    }
  };

  /** Was this badge swept out of this canvas, and not admitted since? */
  withdrew(badgeId: string, canvasId: string): boolean {
    return this.withdrawn.has(`${badgeId} ${canvasId}`);
  }

  /** The badge is back in: the expulsion is no longer the last word. */
  forget(badgeId: string, canvasId: string): void {
    this.withdrawn.delete(`${badgeId} ${canvasId}`);
  }
}

/**
 * What a round decided about one badge, and the rung it now holds.
 *
 * `keep` covers "its root stands at the rung it held" and "its minter
 * survived at the rung it held", which are the same fact about whether
 * anything had to be written. The rung rides along because a pass-derived
 * admission adopts its MINTER's rung (roles design, "Agents hold what their
 * person holds"), and the minter's rung is whatever this round decided for
 * it. Null for an expelled badge, which holds nothing.
 */
interface Decision {
  fate: "keep" | "rerooted" | "expelled";
  capability: Capability | null;
}

/**
 * Re-run the door on one canvas and act on the answers.
 *
 * Called after a grant is revoked, after one is written over another, and
 * after a badge is killed (once per canvas it had been let into). It takes
 * no grant id on purpose: the sweep is not "undo this row", it is "this
 * canvas's admissions have been disturbed, ask the door about every one of
 * them". A signature that named the revoked grant would invite an
 * implementation that only looked for it, which is the version that misses
 * chains and cycles.
 *
 * **Since the roles ladder it recomputes RUNGS, not only roots.** A badge
 * whose row still stands is asked what the door would give it now, and
 * re-rooted when that differs — which is how raising Jordan's invitation
 * from Canvas Viewer to Editor reaches the tab she has open (journey 2 step
 * 1), and how a pass-enrolled agent is raised and lowered with the person who
 * enrolled it. The cost is one door test per admitted badge per sweep, which
 * the sweep already paid for every badge whose root fell.
 *
 * `creator` is the canvas's `createdBy.id`, handed in by the routes that hold
 * the snapshot so the door test can apply the creator's floor (roles design):
 * a creator whose browser entered by the link is re-rooted at `created` when
 * the link goes, not expelled. Null when the caller cannot say, in which case
 * the floor is simply not asked — rows only.
 *
 * `report` hears every outcome, per badge — `SweepHub.report`, in the daemon;
 * absent in a test that only wants the count.
 */
export async function sweepCanvas(
  desk: Desk,
  canvasId: string,
  creator: string | null = null,
  report: SweepListener = () => {},
): Promise<SweepReport> {
  let expelled = 0;
  let rerooted = 0;
  /** The tripwire described above. Generous on purpose: it is a bound on a
   * broken backing, never a limit the real algorithm approaches. */
  let rounds = 0;

  for (;;) {
    // Re-read every round. The previous round mutated admissions, and a walk
    // over a stale snapshot would resolve chains through badges that are no
    // longer there — the "helpful fallback" failure wearing a caching face.
    const badges = await desk.badgesIn(canvasId);
    const byId = new Map(badges.map((badge) => [badge.badgeId, badge]));
    const grants = await desk.grantsFor(canvasId);
    const decided = new Map<string, Promise<Decision>>();
    let changed = false;

    if (rounds++ > badges.length + 1) {
      throw new Error(
        `the provenance sweep of ${canvasId} did not settle after ${rounds} rounds over ` +
          `${badges.length} badges — a desk whose expel or reroot is not taking effect`,
      );
    }

    const expel = async (badgeId: string): Promise<Decision> => {
      await desk.expel(badgeId, canvasId);
      expelled += 1;
      changed = true;
      report(canvasId, badgeId, { outcome: "expelled" });
      return { fate: "expelled", capability: null };
    };

    const reroot = async (
      badgeId: string,
      provenance: Provenance,
      capability: Capability,
    ): Promise<Decision> => {
      await desk.reroot(badgeId, canvasId, provenance, capability);
      rerooted += 1;
      changed = true;
      report(canvasId, badgeId, { outcome: "rerooted", capability });
      return { fate: "rerooted", capability };
    };

    /**
     * **The door test, before the expulsion and not after it.** This is the
     * line the design warns about: a badge whose attestations satisfy a grant
     * that is still live belongs here for a NEW reason, and saying so is what
     * keeps "turn off the link" from meaning "everybody out". It is a call to
     * the same `admittingGrant` the door itself runs, rather than a
     * re-implementation that happens to agree today.
     *
     * The new root's capability rides with the new provenance: a re-rooted
     * badge is here for the surviving grant's reason and may do what THAT
     * grant admits to — which is how replacing the edit link with a view link
     * (#88) demotes the people inside instead of expelling them. The door may
     * also answer with the creator's floor, in which case the badge is
     * re-rooted at `created` — the root this sweep never disturbs again.
     */
    const door = async (badgeId: string): Promise<Decision> => {
      const answer = await admittingGrant(desk, canvasId, byId.get(badgeId)!, creator);
      if (!answer) return expel(badgeId);
      return reroot(badgeId, answer.provenance, answer.capability);
    };

    /**
     * A root that STANDS is still asked what rung the door would give now,
     * and re-rooted only when that differs from what the admission holds. A
     * row that stands but no longer admits — nothing today; a bar, in roles
     * phase 3 — expels, because the door is the door.
     */
    const standing = async (badgeId: string, admission: Admission): Promise<Decision> => {
      const held = rungOfAdmission(admission);
      const answer = await admittingGrant(desk, canvasId, byId.get(badgeId)!, creator);
      if (!answer) return expel(badgeId);
      if (answer.capability === held) return { fate: "keep", capability: held };
      return reroot(badgeId, answer.provenance, answer.capability);
    };

    /**
     * What becomes of one badge, computed once and remembered.
     *
     * `walking` is the cycle guard AND the reason the memo holds promises
     * rather than values: a badge that is mid-decision is one whose chain has
     * come back round to it, and everybody in that loop was vouched for by
     * somebody who was vouched for by them. Nobody in there can name who let
     * them in, so the door decides for all of them.
     */
    const decide = (badgeId: string, walking: ReadonlySet<string>): Promise<Decision> => {
      const remembered = decided.get(badgeId);
      if (remembered) return remembered;
      const work = (async (): Promise<Decision> => {
        const badge = byId.get(badgeId)!;
        const admission = badge.admissions.find((a) => a.canvasId === canvasId)!;
        const root = admission.provenance;

        // Roots that answer for themselves. `created` is the creator's floor:
        // `own`, whatever the field says (see `rungOfAdmission`).
        if (root.root === "created") return { fate: "keep", capability: "own" };
        // Historical, from before grants existed. It names no row, so nothing
        // can revoke it and the sweep leaves it alone — see this file's header
        // and `Provenance` in `desk.ts`.
        if (root.root === "link") return { fate: "keep", capability: rungOfAdmission(admission) };
        if (root.root === "grant") {
          const grant = grants.find((row) => row.id === root.grantId);
          // A grant id pointing at nothing is why revocation is a TOMBSTONE
          // and never a delete. If a row does vanish — a hand-edited ledger, a
          // home restored from a partial backup — the honest reading is that
          // the root does not stand, so the door gets asked again rather than
          // the badge being trusted on the strength of a row nobody can
          // produce.
          if (grant && grant.revokedAt === undefined) return standing(badge.badgeId, admission);
          return door(badge.badgeId);
        }

        // `{root: "pass", badgeId}` — whatever became of whoever minted it.
        // A minter that is not on this canvas any more (killed, expelled, or
        // never was) is a root that does not stand.
        const minter = byId.get(root.badgeId);
        if (!minter || walking.has(root.badgeId)) return door(badge.badgeId);
        const upstream = await decide(root.badgeId, new Set([...walking, badgeId]));
        if (upstream.fate === "expelled") return door(badge.badgeId);
        // The minter survived: this badge holds what the minter now holds,
        // under the same root. Written only when it differs, so a chain whose
        // rungs already agree is not rewritten link by link.
        const held = rungOfAdmission(admission);
        if (upstream.capability === null || upstream.capability === held) {
          return { fate: "keep", capability: held };
        }
        return reroot(badge.badgeId, root, upstream.capability);
      })();
      decided.set(badgeId, work);
      return work;
    };

    for (const badge of badges) {
      if (!badge.admissions.some((a) => a.canvasId === canvasId)) continue;
      await decide(badge.badgeId, new Set());
    }

    if (!changed) return { expelled, rerooted };
  }
}

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
export async function killAndSweep(
  desk: Desk,
  badgeId: string,
  by: string,
  now = new Date().toISOString(),
  /** The creator of each canvas swept, for the floor — a kill sweeps rooms
   * whose snapshots the route does not hold, so it asks per canvas. */
  creatorOf: (canvasId: string) => Promise<string | null> = async () => null,
  /** Hears every outcome, per badge — see `sweepCanvas`. */
  report: SweepListener = () => {},
): Promise<{ killed: BadgeRecord; swept: SweepReport } | null> {
  const killed = await desk.killBadge(badgeId, now, by);
  if (!killed) return null;
  let expelled = 0;
  let rerooted = 0;
  for (const admission of killed.admissions) {
    const swept = await sweepCanvas(
      desk,
      admission.canvasId,
      await creatorOf(admission.canvasId),
      report,
    );
    expelled += swept.expelled;
    rerooted += swept.rerooted;
  }
  return { killed, swept: { expelled, rerooted } };
}
