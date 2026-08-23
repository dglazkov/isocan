import { describe, expect, it } from "vitest";
import type { ActorClaim, Grant } from "@isocan/core";
import { LINK, SHELF } from "@isocan/core";
import type { BadgeRecord, Desk } from "@isocan/server";
import type { ConformanceOptions } from "./store-conformance.ts";

/**
 * What every `Desk` backing must do — the four claim questions above all.
 *
 * Phase 3 built those four questions specifically so a cloud backing could
 * serve them with an index, and left a warning with them: a CloudDesk that
 * does not write the `claimIds` / `claimKeys` / `admittedTo` arrays passes
 * the suite on a FileDesk and answers nothing in the cloud. This suite is
 * half of the answer to that — because the cloud backing serves these reads
 * with queries and NO FALLBACK, a badge written without its arrays answers
 * nothing here and every claim-reading case below fails.
 *
 * The other half is `cloud-desk-arrays.test.ts`, which reads the raw
 * documents. Two mechanisms, because one of them can be satisfied by a
 * cleverness and the other cannot.
 */

export interface DeskFixture {
  desk: Desk;
  done: () => Promise<void>;
}

export function deskConformance(
  name: string,
  make: () => Promise<DeskFixture>,
  options: ConformanceOptions = {},
): void {
  const title = options.skip
    ? `Desk conformance — ${name} [SKIPPED: ${options.skip}]`
    : `Desk conformance — ${name}`;
  const test = options.skip ? it.skip : it;

  describe(title, () => {
    const withDesk = (body: (fixture: DeskFixture) => Promise<void>) => async () => {
      const fixture = await make();
      try {
        await body(fixture);
      } finally {
        await fixture.done();
      }
    };

    test(
      "init is idempotent, and close can be called twice",
      withDesk(async ({ desk }) => {
        await desk.init();
        await desk.init();
        await desk.close();
        await desk.close();
      }),
    );

    test(
      "stores a badge and gives it back, whole",
      withDesk(async ({ desk }) => {
        const badge = mint("bdg_1");
        await desk.put(badge);
        expect(await desk.badge("bdg_1")).toEqual(badge);
        expect(await desk.badge("bdg_nope")).toBeNull();
      }),
    );

    test(
      "touch freshens lastSeen without losing anything beside it",
      withDesk(async ({ desk }) => {
        const badge = mint("bdg_1");
        await desk.put(badge);
        await desk.admit("bdg_1", "prj_1", { root: "created" });
        await desk.setClaims("bdg_1", [claim("usr_ada", "cli:ada")]);
        // Well past any debounce a backing may keep.
        const later = new Date(Date.parse(badge.createdAt) + 10 * 60_000).toISOString();
        await desk.touch("bdg_1", later);
        const after = await desk.badge("bdg_1");
        expect(after!.claims.map((row) => row.actorId)).toEqual(["usr_ada"]);
        expect(after!.admissions.map((row) => row.canvasId)).toEqual(["prj_1"]);
        // A touch on a badge this desk does not know is a no-op, not a throw.
        await desk.touch("bdg_nope", later);
      }),
    );

    test(
      "claimsOf: one badge's own row, and the definition of mine",
      withDesk(async ({ desk }) => {
        await desk.put(mint("bdg_1"));
        await desk.put(mint("bdg_2"));
        await desk.setClaims("bdg_1", [claim("usr_ada", "cli:ada"), claim("usr_bo", "cli:bo")]);
        expect((await desk.claimsOf("bdg_1")).map((row) => row.actorId)).toEqual([
          "usr_ada",
          "usr_bo",
        ]);
        expect(await desk.claimsOf("bdg_2")).toEqual([]);
        expect(await desk.claimsOf("bdg_nope")).toEqual([]);
        // Replacing the list replaces it — this is not an append.
        await desk.setClaims("bdg_1", [claim("usr_bo", "cli:bo")]);
        expect((await desk.claimsOf("bdg_1")).map((row) => row.actorId)).toEqual(["usr_bo"]);
      }),
    );

    test(
      "claimants: every claim on one actor, anywhere on the desk — never admission-scoped",
      withDesk(async ({ desk }) => {
        await desk.put(mint("bdg_1"));
        await desk.put(mint("bdg_2"));
        await desk.setClaims("bdg_1", [claim("usr_ada", "cli:ada")]);
        await desk.setClaims("bdg_2", [claim("usr_ada", "web:ada"), claim("usr_bo", "cli:bo")]);
        // Two badges that share no canvas at all still both answer, because
        // actor ids are global and never recycled.
        const found = await desk.claimants("usr_ada");
        expect(found.map((row) => row.sessionKey).sort()).toEqual(["cli:ada", "web:ada"]);
        expect(await desk.claimants("usr_nobody")).toEqual([]);
      }),
    );

    test(
      "holdersOf: who holds this session key, with the badge id beside the row",
      withDesk(async ({ desk }) => {
        await desk.put(mint("bdg_1"));
        await desk.setClaims("bdg_1", [claim("usr_ada", "cli:ada")]);
        const held = await desk.holdersOf("cli:ada");
        expect(held).toHaveLength(1);
        expect(held[0]!.badgeId).toBe("bdg_1");
        expect(held[0]!.claim.actorId).toBe("usr_ada");
        expect(await desk.holdersOf("cli:nobody")).toEqual([]);
      }),
    );

    test(
      "claimsIn: the admission scope — empty list in, shelf only out",
      withDesk(async ({ desk }) => {
        await desk.put(mint("bdg_1"));
        await desk.put(mint("bdg_2"));
        await desk.setClaims("bdg_1", [claim("usr_ada", "cli:ada")]);
        await desk.setClaims("bdg_2", [claim("usr_bo", "cli:bo")]);
        await desk.admit("bdg_1", "prj_a", { root: "created" });
        await desk.admit("bdg_2", "prj_b", { root: "link" });

        expect((await desk.claimsIn(["prj_a"])).map((row) => row.actorId)).toEqual(["usr_ada"]);
        expect((await desk.claimsIn(["prj_b"])).map((row) => row.actorId)).toEqual(["usr_bo"]);
        expect((await desk.claimsIn(["prj_a", "prj_b"])).map((row) => row.actorId).sort()).toEqual([
          "usr_ada",
          "usr_bo",
        ]);
        // A badge that has been nowhere shares a roster with nobody.
        expect(await desk.claimsIn([])).toEqual([]);
        expect(await desk.claimsIn(["prj_elsewhere"])).toEqual([]);
      }),
    );

    test(
      "admit is idempotent and records why",
      withDesk(async ({ desk }) => {
        await desk.put(mint("bdg_1"));
        await desk.admit("bdg_1", "prj_a", { root: "created" });
        await desk.admit("bdg_1", "prj_a", { root: "link" }); // the first reason stands
        const badge = await desk.badge("bdg_1");
        expect(badge!.admissions).toHaveLength(1);
        expect(badge!.admissions[0]!.provenance).toEqual({ root: "created" });
        // Admitting a badge that is not here is a no-op, not a throw.
        await desk.admit("bdg_nope", "prj_a", { root: "link" });
      }),
    );

    test(
      "grants: written per canvas, read back by canvas, and nothing else's",
      withDesk(async ({ desk }) => {
        // A canvas nobody has granted anything admits NOBODY. This is the
        // rule `desk.ts` states and the reason the birth path and the
        // migration both write rows: an empty answer here must stay empty,
        // because a backing that helpfully implied a link grant would make a
        // forgotten write invisible until it was an outage.
        expect(await desk.grantsFor("prj_a")).toEqual([]);

        await desk.putGrant(grant("gnt_1", "prj_a", "bdg_1"));
        await desk.putGrant(grant("gnt_2", "prj_b", "bdg_1"));
        const onA = await desk.grantsFor("prj_a");
        expect(onA.map((row) => row.id)).toEqual(["gnt_1"]);
        expect(onA[0]).toMatchObject({
          canvasId: "prj_a",
          subject: "link",
          grantedBy: "bdg_1",
        });
        expect((await desk.grantsFor("prj_b")).map((row) => row.id)).toEqual(["gnt_2"]);
      }),
    );

    test(
      "revoking a grant is a tombstone, and it is idempotent",
      withDesk(async ({ desk }) => {
        await desk.putGrant(grant("gnt_1", "prj_a", "bdg_1"));
        const at = "2026-08-23T12:00:00.000Z";
        const revoked = await desk.revokeGrant("gnt_1", at, "bdg_2");
        expect(revoked).toMatchObject({ id: "gnt_1", revokedAt: at, revokedBy: "bdg_2" });

        // A TOMBSTONE, not a delete: a badge admitted under this grant carries
        // `{root: "grant", grantId}` as its provenance, and phase 9's sweep
        // has to be able to read the row it is expelling people from.
        const rows = await desk.grantsFor("prj_a");
        expect(rows).toHaveLength(1);
        expect(rows[0]!.revokedAt).toBe(at);

        // Idempotent, and the FIRST stamp stands — two people turning one link
        // off at once must not argue about when it went off.
        const again = await desk.revokeGrant("gnt_1", "2026-08-23T13:00:00.000Z", "bdg_3");
        expect(again).toMatchObject({ revokedAt: at, revokedBy: "bdg_2" });
        // A grant this desk does not know is null, not a throw.
        expect(await desk.revokeGrant("gnt_nope", at, "bdg_1")).toBeNull();
      }),
    );

    test(
      "the migration shelf: shelved rows answer every question, and adoption is first-come",
      withDesk(async ({ desk }) => {
        await desk.put(mint("bdg_1"));
        await desk.put(mint("bdg_2"));
        await desk.shelve({ "legacy:one": claim("usr_old", "legacy:one") });

        // A shelved row belongs to no badge and therefore to no admission, so
        // it is in EVERY scope on the one home that has one.
        expect((await desk.claimants("usr_old")).map((row) => row.actorId)).toEqual(["usr_old"]);
        const holders = await desk.holdersOf("legacy:one");
        expect(holders).toHaveLength(1);
        expect(holders[0]!.badgeId).toBe(SHELF);
        expect((await desk.claimsIn([])).map((row) => row.actorId)).toEqual(["usr_old"]);

        const adopted = await desk.adopt("legacy:one", "bdg_1");
        expect(adopted!.actorId).toBe("usr_old");
        expect((await desk.claimsOf("bdg_1")).map((row) => row.actorId)).toEqual(["usr_old"]);
        // First-come: the second claimant gets nothing and must use `--as`.
        expect(await desk.adopt("legacy:one", "bdg_2")).toBeNull();
        expect(await desk.claimsOf("bdg_2")).toEqual([]);
        // And the shelf has stopped answering for it.
        expect((await desk.holdersOf("legacy:one")).map((row) => row.badgeId)).toEqual(["bdg_1"]);

        await desk.shelve({}); // a no-op, not an error
      }),
    );
  });
}

// ---- fixtures ----

export function mint(badgeId: string): BadgeRecord {
  const at = new Date(Date.UTC(2026, 0, 1)).toISOString();
  return {
    badgeId,
    secretHash: `hash_${badgeId}`,
    kind: "bearer",
    createdAt: at,
    lastSeen: at,
    admissions: [],
    claims: [],
  };
}

export function claim(actorId: string, sessionKey: string): ActorClaim {
  return { actorId, boundAt: new Date(Date.UTC(2026, 0, 1)).toISOString(), sessionKey };
}

/** A standing link grant, the only subject a v1 door can check. */
export function grant(id: string, canvasId: string, grantedBy: string): Grant {
  return {
    id,
    canvasId,
    subject: LINK,
    grantedBy,
    at: new Date(Date.UTC(2026, 0, 1)).toISOString(),
  };
}
