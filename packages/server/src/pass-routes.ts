import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  normalizeHomeUrl,
  PASS_REDEEM_ROUTE,
  PASS_UNKNOWN,
  type Actor,
  type MintPassRequest,
  type MintPassResponse,
  type Pass,
  type PassResponse,
  type RedeemPassRequest,
  type RedeemPassResponse,
} from "@isocan/core";
import type { Desk } from "./desk.ts";
import type { Engine } from "./engine.ts";
import type { RouteOptions } from "./http.ts";
import { mintPass, redeemPass } from "./passes.ts";
import { loopbackBound, refuseAmbiguousHome } from "./route-helpers.ts";

/**
 * **The pass routes** — minting one, reading it back, redeeming it (Scene 5).
 *
 * Inline in `registerRoutes` until cleanup TS-8 (27 Sep 2026) moved them
 * here whole, beside `withoutSecret` and `hostOf`, which only they read.
 * `registerRoutes` calls this where the section used to begin, so
 * registration order is exactly what it was.
 */
export interface PassRouteScope {
  engine: Engine;
  desk: Desk;
  options: RouteOptions;
  sourceMutation: (req: FastifyRequest, canvasId: string) => Promise<void>;
}

/** The pass routes, on `app`, at the point `registerRoutes` reaches them — so the paths
 * and the registration order are the ones they had inline. */
export function registerPassRoutes(app: FastifyInstance, scope: PassRouteScope): void {
  const { engine, desk, options, sourceMutation } = scope;

  // Two routes with deliberately different shapes, and the asymmetry is the
  // design rather than an accident of naming.
  //
  // **Minting is canvas-scoped** (`/api/projects/:id/passes`), the same
  // argument the three grant routes are written on: the `onRequest` hook has
  // already asked the door about this caller for anything under
  // `/api/projects/:id/`, so "only an admitted badge may mint a pass for this
  // canvas" costs nothing per-route and cannot be forgotten by a later edit.
  // The canvas comes from the address, so a pass is about the room the asker
  // was standing in rather than one it named in a body.
  //
  // **Redeeming is not** (`/api/passes/redeem`), and it cannot be: the whole
  // point of the redeemer is that it is NOT admitted to that canvas yet, so a
  // canvas-scoped path would be refused by the door hook before the handler
  // could look at the pass — the door answering `not-admitted` to the one
  // request whose purpose is to become admitted.
  //
  // On a REPLICA both forward. A pass is desk state and desk state does not
  // replicate: the row lives at the home that minted it, single use is only
  // single across the desk that holds it, and a laptop that minted its own
  // passes would be handing out admissions to a canvas it does not own.

  /**
   * Mint one. The token comes back exactly once — no route reads it back out
   * (the read below returns the row, never the secret), and the desk keeps
   * only its hash.
   *
   * `actorId` is optional and both shapes are real (see `Pass.actorId`): with
   * it the redeemer arrives being somebody, without it the redeemer arrives
   * admitted and claims its own actor. The claim a pass may name must be one
   * this badge HOLDS, checked by mechanism 5's own `requireActor` rather than
   * by a second spelling of the same rule — a pass hands over an identity its
   * minter already is, and endowing somebody else's is impersonation with a
   * wrapper on it.
   *
   * The design widens the mintable set by exactly one hop — a badge may also
   * endow an *agent's* actor that it SPONSORED into existence, which is how
   * Inna resumes Sonia after the sandbox that held Sonia's badge is gone. That
   * hop is deliberately NOT built here: sponsorship is a fact the desk would
   * have to record (the provenance parent of a badge), it exists to serve
   * standing registrations minting with nobody at the keyboard, and both of
   * those are the innkeeper's half of launch custody — mechanism 11, phase 9.
   * Half-building it here would mean inferring sponsorship from provenance at
   * exactly the moment nobody is watching.
   *
   * On a replica the check runs TWICE, which is mechanism 5's split working as
   * designed: this daemon verifies session-level (the local badge holds that
   * claim) because only it can, and the home verifies badge-level (its own
   * badge at the home holds it) because that is all it can honestly see.
   */
  app.post("/api/projects/:id/passes", async (req) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as Partial<MintPassRequest>;
    const actorId = typeof body.actorId === "string" && body.actorId ? body.actorId : undefined;
    if (actorId) await engine.requireActor(req.badge!.badgeId, actorId);
    // THIS canvas's home: a pass admits to one canvas, and single-use is only
    // a property of the desk that holds the row.
    const home = options.homes?.for(id) ?? null;
    if (home) {
      // The name rides up with the actor so the home can vouch for an actor it
      // has never heard of — `HomeLink.mintPass` claims before it asks, and
      // `reincarnate` refuses an unknown `as` with no name to go on.
      const names = actorId ? await engine.actorNames() : {};
      return home.mintPass(
        id,
        actorId ? { id: actorId, name: names[actorId] ?? "" } : undefined,
      );
    }
    await engine.getSnapshot(id); // 404 for unknown canvases, like every route here
    const { record, token } = mintPass({
      canvasId: id,
      mintedBy: req.badge!.badgeId,
      ...(actorId !== undefined ? { actorId } : {}),
    });
    await sourceMutation(req, id);
    await desk.putPass(record);
    return { pass: withoutSecret(record), token } satisfies MintPassResponse;
  });

  /**
   * Read one back — **for the badge that minted it, and nobody else.**
   * The row without its secret, so the minter learns
   * whether its pass was spent and by which badge (`redeemedBy`): the exact
   * surface the pass made, which is what ending that badge needs.
   *
   * Another badge's pass, a pass for another canvas, and no pass at all
   * answer the same `unknown-pass`, so this is no oracle over passes the
   * caller did not mint. On a replica it forwards to the canvas's home, where
   * the row is and where the minter was this daemon's badge.
   */
  app.get("/api/projects/:id/passes/:passId", async (req, reply) => {
    const { id, passId } = req.params as { id: string; passId: string };
    const home = options.homes?.for(id) ?? null;
    if (home) return home.pass(id, passId);
    const held = await desk.pass(passId);
    if (!held || held.canvasId !== id || held.mintedBy !== req.badge!.badgeId) {
      return reply.status(404).send({
        error: `no pass ${passId} minted by this badge for ${id}`,
        code: PASS_UNKNOWN,
      });
    }
    return { pass: withoutSecret(held) } satisfies PassResponse;
  });

  /**
   * Redeem one — **the presenting badge is the one that gets endowed.**
   *
   * This diverges from the desk design's diagram, which has the home minting a
   * third badge (`H-->>D: badge B₃`), and the divergence is argued at length
   * in `passes.ts` rather than taken quietly. The short of it: a browser
   * already holds a cookie badge before it can ask for anything, the door
   * deliberately never returns a cookie's secret in a body, and every client
   * here already knocks on the door when it is 401'd — so "mint a second
   * badge" would mean re-setting the one cookie and dropping its admissions.
   * The design's substance is preserved exactly: a badge that arrived knowing
   * nothing leaves knowing its person, and leaves admitted. Only who did the
   * minting moved.
   *
   * **On a replica, redemption forwards AND writes locally, and both halves
   * are necessary.** The forwarding is what spends the pass and endows this
   * daemon's badge AT THE HOME — which is what makes the canvas appear in that
   * badge's admissions, and therefore in `GET /api/projects`, and therefore in
   * the sweep that dials it: the pass is how a replica stops discovering
   * canvases by enumerating a home (phase 7's finding, and the question phase
   * 8 inherited). The local write is the claim row for the badge in front of
   * us, because the CLI on this machine speaks to THIS daemon and mechanism
   * 5's local half checks the local claims table — without it, Jordan's agent
   * would be admitted to a canvas at the home and be told `not-your-actor` by
   * her own laptop.
   *
   * What is deliberately NOT written locally is an admission. A replicated
   * canvas already gets a local link grant when it lands (`ensureHomeLinkGrant`
   * — "who on THIS machine may reach the local copy"), so the local door
   * admits this badge the first time it asks; writing a second, pass-rooted
   * local admission would put provenance in a ledger whose grants are a
   * different sentence, pointing at a badge id that means nothing on this
   * machine.
   */
  app.post(PASS_REDEEM_ROUTE, async (req, reply) => {
    const body = (req.body ?? {}) as Partial<RedeemPassRequest>;
    if (body.adoptIdentity !== undefined && typeof body.adoptIdentity !== "boolean") {
      return reply.status(400).send({ error: "adoptIdentity must be a boolean", code: "bad-request" });
    }
    const local = req.ip === "127.0.0.1" || req.ip === "::1" || req.ip === "::ffff:127.0.0.1";
    if (
      body.adoptIdentity &&
      (options.servesWorld === true || !loopbackBound(app) || !local || !options.adoptIdentity)
    ) {
      return reply.status(403).send({
        error: "saving a machine's person is available only through its local daemon",
        code: "not-local-setup",
      });
    }
    const finish = async (answer: RedeemPassResponse): Promise<RedeemPassResponse> => {
      if (!body.adoptIdentity || !answer.actor) return answer;
      return { ...answer, identity: await options.adoptIdentity!(answer.actor) };
    };
    // No special case for a missing token: `redeemPass` parses it, and an
    // empty string is not a pass in exactly the way a mangled one is not.
    const token = typeof body.token === "string" ? body.token : "";
    const badge = req.badge!;
    /**
     * **Which desk holds this pass's row.**
     *
     * `home` when the caller named one, because a pass is never handed over
     * alone — it arrives as `address#pass`, so the caller that has the token
     * has the address too (see `RedeemPassRequest.home`). This is the one act
     * `homeScoped` used to swallow that has a right answer, and presenting a
     * credential at the wrong desk reports a valid pass as invalid.
     *
     * **Never this daemon's own address**, or a daemon asked to redeem a pass
     * minted at itself would open a link to itself and become its own
     * replica. The CLI already declines to send its own base; this is the
     * server refusing to be talked into it by anybody else, which it can do
     * because `Host` is the one address a request always carries.
     *
     * Absent — every caller older than the field, and the browser at a home —
     * falls back to `homeScoped`, whose seam is named where it lives.
     */
    const asked = typeof body.home === "string" ? body.home.trim() : "";
    const askedHost = asked === "" ? null : hostOf(asked);
    const self = askedHost !== null && askedHost === String(req.headers.host ?? "");
    if (asked === "") {
      // Only when the caller named nothing: an address in the request IS the
      // answer, so a pass pasted with its address is never ambiguous. This is
      // the older caller, and the browser at a home.
      const stuck = refuseAmbiguousHome(reply, options.homes, "redeem a pass");
      if (stuck) return stuck;
    }
    const home =
      asked !== "" && !self
        ? (options.homes?.linkFor(normalizeHomeUrl(asked)) ?? null)
        : (options.homes?.homeScoped() ?? null);
    if (home) {
      const answer = await home.redeemPass(token);
      if (answer.actor) await engine.endowClaim(badge.badgeId, answer.actor, answer.canvasId);
      return finish(answer);
    }
    const pass = await redeemPass(desk, token, badge);
    if (pass.actorId === undefined) {
      return { canvasId: pass.canvasId } satisfies RedeemPassResponse;
    }
    // The name as of NOW, not as of minting: a person who renamed herself
    // between copying the command and pasting it is handed the name she goes
    // by, which is also the name the canvas already shows on her work.
    const names = await engine.actorNames();
    const actor: Actor = { id: pass.actorId, name: names[pass.actorId] ?? "" };
    await engine.endowClaim(badge.badgeId, actor, pass.canvasId);
    return finish({ canvasId: pass.canvasId, actor });
  });
}

/**
 * A pass as the wire may see it. The hash stays behind the desk seam — the
 * same split the badge has, and the reason is the same: what leaves this
 * process must never be enough to redeem anything.
 */
function withoutSecret(record: Pass & { secretHash: string }): Pass {
  const { secretHash: _hash, ...pass } = record;
  return pass;
}

/**
 * The host[:port] of an address, or null when it is not one at all.
 *
 * Its one caller compares against a request's `Host` header, which carries no
 * scheme — so this deliberately compares hosts and not origins. A daemon
 * reached over http at the address a marker spells with https is still the
 * same daemon, and the question here is only ever "is this me".
 */
function hostOf(address: string): string | null {
  try {
    return new URL(address).host || null;
  } catch {
    return null;
  }
}
