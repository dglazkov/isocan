import { attestedKindOf, type AttestedKind, type GrantSubject } from "@isocan/core";

/**
 * **The attesters this home has borrowed — and today there are none.**
 *
 * This file is a SEAM WITH NOTHING BEHIND IT, on purpose, and it says so
 * rather than pretending otherwise. Phase 9 is two stages: stage 1 built the
 * machinery revocation needs — attestations on the badge, the door's branch
 * over them, the provenance sweep, kill-a-badge — and stage 2 wires the
 * borrowed bench the architecture chose (Firebase Auth: magic-link email as
 * the floor, Google, GitHub), which needs a cloud resource nobody may
 * provision without asking.
 *
 * ## Why there is no `Attester` interface here
 *
 * There was one, briefly, and it was the wrong shape of honesty. An interface
 * with no implementations, a registry that is always empty, and a route that
 * only ever answers 501 is a **speculative clean seam** — phase 1's lesson,
 * and the same one phase 2 applied when it refused to put an
 * always-empty `attestations` array on `BadgeRecord`. It looks like working
 * code, it type-checks, tests can be written around it, and every one of those
 * tests proves something about a stub.
 *
 * So what stage 1 ships is the smallest true thing: a **list of what this home
 * can verify**, which is empty, and the refusal that follows from it. Stage 2
 * does not implement an interface designed by somebody who had never talked to
 * Firebase — it adds the verification it actually needs, calls `Desk.attest`
 * with the result, and adds this file's one constant to match. `Desk.attest`
 * is the real seam, and it is real precisely because the door above it reads
 * what it writes.
 *
 * ## What "no attester" means at each end
 *
 * - **Writing a grant**: refused, with the reason below. An `email:` row on a
 *   home that cannot verify an email is a row that admits nobody while the
 *   dialog claims somebody was invited — phase 7's "a UI that lies", and the
 *   argument does not change because the phase number did.
 * - **The door**: unchanged and needs no branch. `admittingGrant` compares a
 *   grant's subject against the badge's attestations; on a home with no
 *   attesters no badge has any, so nothing matches and nobody is admitted by
 *   an attested subject. The door does not need to know why the array is
 *   empty, which is what lets stage 2 land without touching it.
 */

/**
 * What this home can verify about a holder. **Empty, and that is the fact
 * stage 1 is reporting rather than a placeholder.**
 *
 * Stage 2 puts `"email"` here when Firebase Auth is wired at the dev home, and
 * `"repo"` when the GitHub token check lands. It is a constant rather than
 * configuration read from the environment because it must match what the code
 * can actually DO: a home that could be told it has an email attester by
 * setting a variable is a home that can be made to lie to the Share dialog.
 */
export const ATTESTERS: readonly AttestedKind[] = [];

/**
 * Why this home cannot take that grant, or null when it can.
 *
 * Separate from `grantSubjectRefusal` in core, which answers the different
 * question of whether the subject is well-formed at all. A caller told "not a
 * grant subject" about a perfectly good email address goes looking for a typo
 * that is not there; a caller told "nobody here can verify that" knows the
 * problem is the home and not the sentence.
 *
 * The message says what the person should do INSTEAD, because there is
 * something they can do — the link still works, and it is how sharing has
 * worked for every phase so far.
 */
export function attesterRefusal(subject: GrantSubject): string | null {
  const kind = attestedKindOf(subject);
  if (kind === null || ATTESTERS.includes(kind)) return null;
  const what =
    kind === "email"
      ? "verify an email address"
      : "check that somebody can read a repository";
  return (
    `this home cannot ${what} yet, so a grant to ${subject} would admit nobody. ` +
    "Attesters are borrowed rather than built — an inbox, a Google or GitHub " +
    "sign-in — and this home has borrowed none. Share the link instead."
  );
}
