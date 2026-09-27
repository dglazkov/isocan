import type { FastifyInstance, FastifyReply } from "fastify";
import { AMBIGUOUS_HOME, isLive, type Grant } from "@isocan/core";
import type { HomeLinks } from "./home-links.ts";

/**
 * **What more than one route file asks.** Three helpers `http.ts` held at
 * module scope until the operator and pass routes moved out of
 * `registerRoutes` into files of their own (cleanup TS-8, 27 Sep 2026): each
 * is read by `http.ts` AND by one of those files, so it lives here rather than
 * being exported back out of `http.ts` into a file `http.ts` itself imports.
 * Moved verbatim — the words are the same words.
 */

/** The rows still admitting, oldest first — what a person means by "who can
 * get in". Tombstones stay on the desk for provenance and audit (see
 * `Grant.revokedAt`) and are nobody's answer to that question. */
export function liveGrants(grants: Grant[]): Grant[] {
  return grants.filter(isLive).sort((a, b) => a.at.localeCompare(b.at));
}

/** Is this daemon listening only to its own machine? Mechanism 5's "within a
 * machine, localhost trust stands" needs to know, and the hosted home (bound
 * to 0.0.0.0) must not take the clause. */
export function loopbackBound(app: FastifyInstance): boolean {
  const address = app.server.address();
  if (!address || typeof address === "string") return false;
  return address.address === "127.0.0.1" || address.address === "::1";
}

/**
 * **Refuse a home-scoped act this daemon cannot place**, or null to carry on.
 *
 * Badges, attestations and (before it learned to carry its own address) pass
 * redemption are facts about a DESK, and a desk belongs to a home. On a mixed
 * rig with two homes and no birth default there is no true answer, and the
 * available wrong ones are both bad: forwarding to whichever link sorted first
 * asks a stranger's desk about you, and answering from the local desk hands
 * back this laptop's own ledger as though it were the home's.
 *
 * The local-desk fallback is the one that would have shipped, because it is
 * what the code did when a daemon had one home and the branch simply never
 * fired. It is a short, plausible, completely wrong list delivered in silence
 * — the cheerful wrong address, about a credential. So: 409, both homes named,
 * and the person chooses.
 */
export function refuseAmbiguousHome(
  reply: FastifyReply,
  homes: HomeLinks | null | undefined,
  act: string,
): FastifyReply | null {
  const contested = homes?.homeScopedAmbiguity() ?? null;
  if (contested === null) return null;
  return reply.status(409).send({
    error:
      `this machine holds work at ${contested.join(" and ")}, and no birth default to break ` +
      `the tie — so "${act}" has more than one true answer and none of them is this laptop's ` +
      "own ledger. A badge belongs to a home's desk, and nothing in this request names one. " +
      "Pick a home for new canvases (`isocan home <address>`) and this asks that one, or " +
      "run the command against the home you mean.",
    code: AMBIGUOUS_HOME,
  });
}
