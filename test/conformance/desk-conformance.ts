import { describe, expect, it } from "vitest";
import type { ActorClaim, Grant, Space } from "@isocan/core";
import { LINK, PASS_TTL_MS, SHELF } from "@isocan/core";
import type { BadgeRecord, Desk, PassRecord } from "@isocan/server";
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
        expect(found.map((row) => row.claim.sessionKey).sort()).toEqual(["cli:ada", "web:ada"]);
        // The badge id rides along, which is what kill-a-badge names a
        // surface by (see `Desk.claimants`).
        expect(found.map((row) => row.badgeId).sort()).toEqual(["bdg_1", "bdg_2"]);
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
      "capability rides the admission, and a re-root rewrites it (#88)",
      withDesk(async ({ desk }) => {
        await desk.put(mint("bdg_1"));
        // Stored only when it narrows: `view` is written, and an admission
        // written without one reads as edit (an absent field, not "edit").
        await desk.admit("bdg_1", "prj_a", { root: "grant", grantId: "gnt_v" }, "view");
        let badge = await desk.badge("bdg_1");
        expect(badge!.admissions[0]!.capability).toBe("view");

        // A re-root REWRITES the capability with the provenance — the new
        // reason says what it admits to, entirely. Rewriting with none must
        // drop the old `view`, or an upgraded viewer stays read-only.
        await desk.reroot("bdg_1", "prj_a", { root: "grant", grantId: "gnt_e" }, "edit");
        badge = await desk.badge("bdg_1");
        expect(badge!.admissions[0]!.provenance).toEqual({ root: "grant", grantId: "gnt_e" });
        expect(badge!.admissions[0]!.capability).toBeUndefined();

        // And back down, for the other direction of the link's toggle.
        await desk.reroot("bdg_1", "prj_a", { root: "grant", grantId: "gnt_v2" }, "view");
        badge = await desk.badge("bdg_1");
        expect(badge!.admissions[0]!.capability).toBe("view");
      }),
    );

    test(
      "every rung that is not edit round-trips on an admission (roles phase 1)",
      withDesk(async ({ desk }) => {
        // The rule is "written whenever it is not edit", not "written when it
        // is view": a backing that tested the one literal would store `read`
        // and `own` as absent, which reads back as EDIT — a reader promoted
        // and an owner demoted by a storage detail. Both directions, both
        // rungs, on both backings.
        await desk.put(mint("bdg_r"));
        await desk.admit("bdg_r", "prj_a", { root: "grant", grantId: "gnt_r" }, "read");
        expect((await desk.badge("bdg_r"))!.admissions[0]!.capability).toBe("read");
        await desk.reroot("bdg_r", "prj_a", { root: "grant", grantId: "gnt_o" }, "own");
        expect((await desk.badge("bdg_r"))!.admissions[0]!.capability).toBe("own");
        await desk.reroot("bdg_r", "prj_a", { root: "created" }, "edit");
        expect((await desk.badge("bdg_r"))!.admissions[0]!.capability).toBeUndefined();

        await desk.put(mint("bdg_o"));
        await desk.admit("bdg_o", "prj_a", { root: "created" }, "own");
        expect((await desk.badge("bdg_o"))!.admissions[0]!.capability).toBe("own");
        await desk.reroot("bdg_o", "prj_a", { root: "grant", grantId: "gnt_r" }, "read");
        expect((await desk.badge("bdg_o"))!.admissions[0]!.capability).toBe("read");
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

        // The capability ROUND-TRIPS (#88) — asserted here because a backing
        // that rebuilds rows field-by-field can keep a field on the write and
        // drop it on the read, and that shape shipped: the hosted home's
        // "Can view" answered 200 and went on admitting editors, while the
        // file desk (which stores rows whole) passed every test. A field the
        // door enforces must survive whichever backing holds it.
        await desk.putGrant({ ...grant("gnt_3", "prj_c", "bdg_1"), capability: "view" });
        const onC = await desk.grantsFor("prj_c");
        expect(onC[0]!.capability).toBe("view");
        // And a row written without one stays without one: absent means edit.
        expect(onA[0]!.capability).toBeUndefined();
        // The ladder's other two rungs round-trip the same way (roles phase
        // 1): the read-back guard is "is it a rung", never "is it `view`".
        await desk.putGrant({ ...grant("gnt_4", "prj_d", "bdg_1"), capability: "read" });
        await desk.putGrant({ ...grant("gnt_5", "prj_e", "bdg_1"), capability: "own" });
        expect((await desk.grantsFor("prj_d"))[0]!.capability).toBe("read");
        expect((await desk.grantsFor("prj_e"))[0]!.capability).toBe("own");
        // And a BAR (roles phase 3) — a row with `bars: true` and no rung —
        // comes back as one. A backing that dropped the field would read
        // "kept out" as an edit invitation, which is the same field-picking
        // trap with the sign flipped.
        await desk.putGrant({
          ...grant("gnt_6", "prj_f", "bdg_1"),
          subject: "email:sam@acme.test",
          bars: true,
        });
        const onF = await desk.grantsFor("prj_f");
        expect(onF[0]!.bars).toBe(true);
        expect(onF[0]!.capability).toBeUndefined();
        expect(onA[0]!.bars).toBeUndefined();
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

    // ---- roles phase 4: the space, and the other arm of a grant's scope ----

    test(
      "grantsForSpace: a row on a space is read back by space, and grantsFor never sees it",
      withDesk(async ({ desk }) => {
        // No fallback, as for a canvas: a space with no rows admits nobody
        // but its creator, and an empty answer stays empty.
        expect(await desk.grantsForSpace("spc_a")).toEqual([]);
        await desk.putGrant(grant("gnt_c", "prj_a", "bdg_1"));
        await desk.putGrant({
          ...spaceGrant("gnt_s", "spc_a", "bdg_1"),
          subject: "email:jordan@acme.test",
          capability: "own",
        });
        // The two arms of `GrantScope` do not leak into each other: a caller
        // that asks about one canvas sees only that canvas's rows, and a row
        // on a space comes back with `spaceId` and no `canvasId`.
        expect((await desk.grantsFor("prj_a")).map((row) => row.id)).toEqual(["gnt_c"]);
        const onSpace = await desk.grantsForSpace("spc_a");
        expect(onSpace).toHaveLength(1);
        expect(onSpace[0]).toMatchObject({
          id: "gnt_s",
          spaceId: "spc_a",
          subject: "email:jordan@acme.test",
          capability: "own",
        });
        expect("canvasId" in onSpace[0]!).toBe(false);
        // Revocation is the same tombstone whichever arm the row is on.
        await desk.revokeGrant("gnt_s", "2026-08-23T12:00:00.000Z", "bdg_2");
        expect((await desk.grantsForSpace("spc_a"))[0]!.revokedAt).toBe("2026-08-23T12:00:00.000Z");
      }),
    );

    test(
      "spaces: written whole, read by id, spaceOf names the live one, and a tombstone drops out",
      withDesk(async ({ desk }) => {
        expect(await desk.space("spc_nope")).toBeNull();
        expect(await desk.spaceOf("prj_a")).toBeNull();
        await desk.putSpace(space("spc_a", "usr_priya", ["prj_a", "prj_b"]));
        expect(await desk.space("spc_a")).toEqual(space("spc_a", "usr_priya", ["prj_a", "prj_b"]));
        expect((await desk.spaceOf("prj_a"))?.id).toBe("spc_a");
        expect((await desk.spaceOf("prj_b"))?.id).toBe("spc_a");
        expect(await desk.spaceOf("prj_c")).toBeNull();
        // A write REPLACES: moving a canvas out is the row written again
        // without it, and `spaceOf` answers from the row as it now stands.
        await desk.putSpace(space("spc_a", "usr_priya", ["prj_a"]));
        expect(await desk.spaceOf("prj_b")).toBeNull();
        expect((await desk.space("spc_a"))!.canvasIds).toEqual(["prj_a"]);
        // The tombstone: read back by id, so a route can tell "gone" from
        // "never was" — and nobody's answer to `spaceOf`, so its rows stop
        // reaching the canvases it held.
        const gone = { ...space("spc_a", "usr_priya", ["prj_a"]), deletedAt: "2026-08-23T12:00:00.000Z" };
        await desk.putSpace(gone);
        expect(await desk.space("spc_a")).toEqual(gone);
        expect(await desk.spaceOf("prj_a")).toBeNull();
      }),
    );

    test(
      "spacesFor: by an actor the badge claims, by a live row naming what it has proved, and nothing else",
      withDesk(async ({ desk }) => {
        await desk.put(mint("bdg_priya"));
        await desk.put(mint("bdg_jordan"));
        await desk.put(mint("bdg_nobody"));
        await desk.setClaims("bdg_priya", [claim("usr_priya", "cli:priya")]);
        const at = "2026-01-02T00:00:00.000Z";
        await desk.attest("bdg_jordan", { attribute: "email:jordan@acme.test", verifiedVia: "magic-link", at });
        await desk.putSpace(space("spc_design", "usr_priya", ["prj_a"]));
        await desk.putSpace(space("spc_other", "usr_sam", []));
        await desk.putSpace({ ...space("spc_old", "usr_priya", []), deletedAt: at });
        await desk.putGrant({
          ...spaceGrant("gnt_j", "spc_other", "bdg_sam"),
          subject: "email:jordan@acme.test",
        });
        await desk.putGrant({
          ...spaceGrant("gnt_j_gone", "spc_design", "bdg_priya"),
          subject: "email:jordan@acme.test",
          revokedAt: at,
          revokedBy: "bdg_priya",
        });
        // A row on a CANVAS naming the same address is not a space, and must
        // not become one by sharing a subject.
        await desk.putGrant({ ...grant("gnt_canvas", "prj_z", "bdg_sam"), subject: "email:jordan@acme.test" });

        // The creator sees the spaces they made — and not the tombstone.
        const priya = (await desk.spacesFor((await desk.badge("bdg_priya"))!)).map((s) => s.id);
        expect(priya.sort()).toEqual(["spc_design"]);
        // An invitee sees the space a LIVE row admits them to, and not the
        // one whose row was revoked.
        const jordan = (await desk.spacesFor((await desk.badge("bdg_jordan"))!)).map((s) => s.id);
        expect(jordan).toEqual(["spc_other"]);
        // A badge that claims nobody and has proved nothing sees no space —
        // the no-fallback rule: a backing that scanned would answer with all
        // three, and a stranger would learn what surrounds a canvas.
        expect(await desk.spacesFor((await desk.badge("bdg_nobody"))!)).toEqual([]);
      }),
    );

    test(
      "passes: written by id, read back by id, and nothing else's",
      withDesk(async ({ desk }) => {
        // No fallback here either: a pass this desk has never seen answers
        // nothing, which is what the route turns into `unknown-pass`.
        expect(await desk.pass("pss_nope")).toBeNull();
        await desk.putPass(pass("pss_1", "prj_a", "bdg_1"));
        await desk.putPass(pass("pss_2", "prj_b", "bdg_1", "usr_jordan"));
        expect(await desk.pass("pss_1")).toMatchObject({
          canvasId: "prj_a",
          mintedBy: "bdg_1",
          secretHash: "hash_pss_1",
        });
        // The claim slot is optional and both shapes are real: an
        // admission-only pass admits a surface that will claim its own actor.
        expect((await desk.pass("pss_1"))!.actorId).toBeUndefined();
        expect((await desk.pass("pss_2"))!.actorId).toBe("usr_jordan");
      }),
    );

    test(
      "redeemPass is SINGLE-USE: exactly one caller wins, and the loser is told why",
      withDesk(async ({ desk }) => {
        await desk.putPass(pass("pss_1", "prj_a", "bdg_1", "usr_jordan"));
        const at = "2026-08-23T12:00:00.000Z";
        const first = await desk.redeemPass("pss_1", at, "bdg_2");
        expect(first).toMatchObject({ redeemed: true });
        expect(first!.pass).toMatchObject({ redeemedAt: at, redeemedBy: "bdg_2" });

        // The second caller does NOT win, and is handed the row the winner
        // left — so the route can say "already used, at 12:00" rather than the
        // one answer a person cannot act on.
        const second = await desk.redeemPass("pss_1", "2026-08-23T12:00:01.000Z", "bdg_3");
        expect(second).toMatchObject({ redeemed: false });
        expect(second!.pass).toMatchObject({ redeemedAt: at, redeemedBy: "bdg_2" });

        // And it stays spent when read back — this is a row, not a lock.
        expect((await desk.pass("pss_1"))!.redeemedBy).toBe("bdg_2");

        // A pass this desk does not know is null, not a throw, and null is a
        // DIFFERENT answer from "already spent".
        expect(await desk.redeemPass("pss_nope", at, "bdg_2")).toBeNull();
      }),
    );

    test(
      "two redemptions racing: one winner, whatever the backing",
      withDesk(async ({ desk }) => {
        await desk.putPass(pass("pss_1", "prj_a", "bdg_1"));
        const at = "2026-08-23T12:00:00.000Z";
        // Started together on purpose. A `get`-then-`set` outside a
        // transaction passes the sequential test above and fails this one,
        // which is exactly the bug worth catching: two badges admitted by a
        // pass that invited one.
        const [a, b] = await Promise.all([
          desk.redeemPass("pss_1", at, "bdg_2"),
          desk.redeemPass("pss_1", at, "bdg_3"),
        ]);
        expect([a!.redeemed, b!.redeemed].filter(Boolean)).toHaveLength(1);
        const winner = a!.redeemed ? "bdg_2" : "bdg_3";
        expect((await desk.pass("pss_1"))!.redeemedBy).toBe(winner);
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
        expect((await desk.claimants("usr_old")).map((row) => row.claim.actorId)).toEqual([
          "usr_old",
        ]);
        expect((await desk.claimants("usr_old"))[0]!.badgeId).toBe(SHELF);
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

    // ---- phase 9: attestations, the sweep's query, kill-a-badge ----

    test(
      "attestations ride the badge, and re-verifying replaces rather than piles up",
      withDesk(async ({ desk }) => {
        await desk.put(mint("bdg_1"));
        expect((await desk.badge("bdg_1"))!.attestations ?? []).toEqual([]);

        await desk.attest("bdg_1", {
          attribute: "email:ada@example.test",
          verifiedVia: "magic-link",
          at: "2026-01-02T00:00:00.000Z",
        });
        await desk.attest("bdg_1", {
          attribute: "repo:github.com/acme/widgets",
          verifiedVia: "github",
          at: "2026-01-02T00:00:00.000Z",
        });
        // The SAME attribute again is one proof and a fresher date, never two
        // rows: a badge holding two proofs of one mailbox is the drift
        // `upsertAttestation` exists to prevent.
        await desk.attest("bdg_1", {
          attribute: "email:Ada@Example.Test",
          verifiedVia: "google",
          at: "2026-01-03T00:00:00.000Z",
        });

        const held = (await desk.badge("bdg_1"))!.attestations!;
        expect(held.map((row) => row.attribute).sort()).toEqual([
          "email:ada@example.test",
          "repo:github.com/acme/widgets",
        ]);
        const email = held.find((row) => row.attribute === "email:ada@example.test")!;
        expect(email.verifiedVia).toBe("google");
        expect(email.at).toBe("2026-01-03T00:00:00.000Z");

        // Attesting a badge this desk does not know writes nothing and does
        // not throw: the caller's remedy is the door, not an exception.
        await desk.attest("bdg_nope", {
          attribute: "email:nobody@example.test",
          verifiedVia: "magic-link",
          at: "2026-01-02T00:00:00.000Z",
        });
      }),
    );

    test(
      "badgesAttesting: who else has proved this — the query resumption is made of",
      withDesk(async ({ desk }) => {
        await desk.put(mint("bdg_1"));
        await desk.put(mint("bdg_2"));
        await desk.put(mint("bdg_3"));
        const at = "2026-01-02T00:00:00.000Z";
        await desk.attest("bdg_1", { attribute: "email:ada@example.test", verifiedVia: "magic-link", at });
        await desk.attest("bdg_2", { attribute: "email:ada@example.test", verifiedVia: "google", at });
        await desk.attest("bdg_3", { attribute: "email:eve@example.test", verifiedVia: "magic-link", at });

        expect((await desk.badgesAttesting("email:ada@example.test")).map((b) => b.badgeId).sort())
          .toEqual(["bdg_1", "bdg_2"]);
        // Nobody has proved this, and nobody is the honest answer — a query
        // that fell back to a scan would answer with everyone.
        expect(await desk.badgesAttesting("email:nobody@example.test")).toEqual([]);
        // The attribute is compared AS STORED. `upsertAttestation` normalizes
        // on the way in, so a caller that spells it differently matches
        // nothing — which is why `normalizeAttribute` is on both ends and not
        // in here.
        expect(await desk.badgesAttesting("email:Ada@Example.Test")).toEqual([]);

        // A holder the home no longer recognises vouches for nobody.
        await desk.killBadge("bdg_2", "2026-03-01T00:00:00.000Z", "bdg_1");
        expect((await desk.badgesAttesting("email:ada@example.test")).map((b) => b.badgeId)).toEqual([
          "bdg_1",
        ]);
      }),
    );

    test(
      "badgesIn: every live badge admitted to one canvas — the sweep's population",
      withDesk(async ({ desk }) => {
        await desk.put(mint("bdg_1"));
        await desk.put(mint("bdg_2"));
        await desk.put(mint("bdg_3"));
        await desk.admit("bdg_1", "prj_a", { root: "created" });
        await desk.admit("bdg_2", "prj_a", { root: "grant", grantId: "gnt_1" });
        await desk.admit("bdg_3", "prj_b", { root: "grant", grantId: "gnt_2" });

        expect((await desk.badgesIn("prj_a")).map((b) => b.badgeId).sort()).toEqual([
          "bdg_1",
          "bdg_2",
        ]);
        expect(await desk.badgesIn("prj_nobody")).toEqual([]);
      }),
    );

    test(
      "reroot rewrites one admission's provenance; expel drops it",
      withDesk(async ({ desk }) => {
        await desk.put(mint("bdg_1"));
        await desk.admit("bdg_1", "prj_a", { root: "grant", grantId: "gnt_1" });
        await desk.admit("bdg_1", "prj_b", { root: "grant", grantId: "gnt_1" });

        await desk.reroot("bdg_1", "prj_a", { root: "grant", grantId: "gnt_2" });
        const after = await desk.badge("bdg_1");
        expect(after!.admissions.find((a) => a.canvasId === "prj_a")!.provenance).toEqual({
          root: "grant",
          grantId: "gnt_2",
        });
        // The OTHER canvas is untouched: a sweep is per-canvas, and a reroot
        // that reached sideways would expel people from rooms nobody revoked.
        expect(after!.admissions.find((a) => a.canvasId === "prj_b")!.provenance).toEqual({
          root: "grant",
          grantId: "gnt_1",
        });

        await desk.expel("bdg_1", "prj_a");
        expect((await desk.badge("bdg_1"))!.admissions.map((a) => a.canvasId)).toEqual(["prj_b"]);

        // Both are idempotent: the second of two racing sweeps must not throw,
        // and must not resurrect what the first dropped.
        await desk.expel("bdg_1", "prj_a");
        await desk.reroot("bdg_1", "prj_a", { root: "grant", grantId: "gnt_3" });
        expect((await desk.badge("bdg_1"))!.admissions.map((a) => a.canvasId)).toEqual(["prj_b"]);
      }),
    );

    test(
      "kill-a-badge: nobody holds it, it answers nothing, and the first stamp stands",
      withDesk(async ({ desk }) => {
        await desk.put(mint("bdg_1"));
        await desk.put(mint("bdg_2"));
        await desk.setClaims("bdg_1", [claim("usr_ada", "cli:ada")]);
        await desk.setClaims("bdg_2", [claim("usr_ada", "web:ada")]);
        await desk.admit("bdg_1", "prj_a", { root: "grant", grantId: "gnt_1" });

        const killed = await desk.killBadge("bdg_1", "2026-02-01T00:00:00.000Z", "bdg_2");
        // The record as it was ALIVE — the caller sweeps these canvases and
        // names these actors.
        expect(killed!.admissions.map((a) => a.canvasId)).toEqual(["prj_a"]);
        expect(killed!.claims.map((c) => c.actorId)).toEqual(["usr_ada"]);

        // A badge nobody holds: it cannot authenticate, and it is out of every
        // query — so its claims stop counting as held and its admissions stop
        // counting as scope.
        expect(await desk.badge("bdg_1")).toBeNull();
        expect(await desk.claimsOf("bdg_1")).toEqual([]);
        expect((await desk.claimants("usr_ada")).map((row) => row.badgeId)).toEqual(["bdg_2"]);
        expect(await desk.holdersOf("cli:ada")).toEqual([]);
        expect(await desk.claimsIn(["prj_a"])).toEqual([]);
        expect(await desk.badgesIn("prj_a")).toEqual([]);

        // Idempotent, and the SECOND caller is told there was nothing to do —
        // which is what stops two people ending one laptop sweeping twice.
        expect(await desk.killBadge("bdg_1", "2026-03-01T00:00:00.000Z", "bdg_2")).toBeNull();
        // And a dead badge takes no more writes.
        await desk.setClaims("bdg_1", [claim("usr_eve", "cli:eve")]);
        await desk.admit("bdg_1", "prj_b", { root: "created" });
        await desk.attest("bdg_1", {
          attribute: "email:eve@example.test",
          verifiedVia: "magic-link",
          at: "2026-03-01T00:00:00.000Z",
        });
        expect(await desk.badgesIn("prj_b")).toEqual([]);
        expect(await desk.claimants("usr_eve")).toEqual([]);
        expect(await desk.badgesAttesting("email:eve@example.test")).toEqual([]);

        expect(await desk.killBadge("bdg_nope", "2026-03-01T00:00:00.000Z", "bdg_2")).toBeNull();
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

/**
 * A pass, as the desk holds it. The secret's hash stands in for a real one:
 * hashing is the caller's job (`server/passes.ts`), and what the desk owes is
 * to give back exactly what it was handed.
 */
export function pass(
  id: string,
  canvasId: string,
  mintedBy: string,
  actorId?: string,
): PassRecord {
  const at = Date.UTC(2026, 0, 1);
  return {
    id,
    canvasId,
    mintedBy,
    secretHash: `hash_${id}`,
    createdAt: new Date(at).toISOString(),
    expiresAt: new Date(at + PASS_TTL_MS).toISOString(),
    ...(actorId !== undefined ? { actorId } : {}),
  };
}

/** A row on a space (roles phase 4) — the other arm of `GrantScope`. */
export function spaceGrant(id: string, spaceId: string, grantedBy: string): Grant {
  return {
    id,
    spaceId,
    subject: "email:somebody@acme.test",
    grantedBy,
    at: new Date(Date.UTC(2026, 0, 1)).toISOString(),
  };
}

/** A space, as the desk holds it. */
export function space(id: string, createdBy: string, canvasIds: string[]): Space {
  return {
    id,
    name: `Space ${id}`,
    createdBy,
    canvasIds,
    at: new Date(Date.UTC(2026, 0, 1)).toISOString(),
  };
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
