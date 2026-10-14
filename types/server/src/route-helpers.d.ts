import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { type Grant } from "../../core/src/index.js";
import { type HomeLinks } from "./home-links.js";
import type { Workstation } from "./workstation.js";
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
export declare function liveGrants(grants: Grant[]): Grant[];
/** Is this daemon listening only to its own machine? Mechanism 5's "within a
 * machine, localhost trust stands" needs to know, and the hosted home (bound
 * to 0.0.0.0) must not take the clause. */
export declare function loopbackBound(app: FastifyInstance): boolean;
/** The TCP port this Fastify instance is listening on, or null if not bound. */
export declare function boundPort(app: FastifyInstance): number | null;
/** Does `targetUrl` name this daemon itself, by `Host` header or loopback port? */
export declare function isRequestSelfAddress(app: FastifyInstance, req: FastifyRequest, targetUrl: string): boolean;
/**
 * Validate and normalize `body.home` on `project.create` (`POST /api/ops`).
 *
 * - On an authoritative hosted home (`!workstation`), naming this home's own
 *   origin means "birth it here" (`undefined`), while naming another home is
 *   refused (`409 not-a-replica`).
 * - On a local workstation, naming this daemon's own address is refused
 *   (`409 self-link`), because a replica cannot birth canvases at itself.
 */
export declare function resolveCreateHome(app: FastifyInstance, req: FastifyRequest, workstation: Workstation | null | undefined, rawHome: string | undefined): string | undefined;
/**
 * Resolve and validate the target home for `POST /api/home/join`.
 *
 * Refuses self-links (`409 self-link`) before anything else, refuses hosted
 * homes (`409 not-a-replica`) when `!workstation`, and refuses local daemons
 * with neither a named home nor a `birthHome` (`409 not-a-replica`).
 */
export declare function resolveJoinHome(app: FastifyInstance, req: FastifyRequest, workstation: Workstation | null | undefined, rawHome: unknown): string;
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
export declare function refuseAmbiguousHome(reply: FastifyReply, homes: HomeLinks | null | undefined, act: string): FastifyReply | null;
