import { describe, expect, it } from "vitest";
import { claim, mint } from "../../../test/conformance/desk-conformance.ts";
import { BADGES, SHELF_DOC } from "../src/cloud-desk.ts";
import { cloudGate, makeCloudDesk, requireEmulator } from "./cloud-fixture.ts";

/**
 * The three denormalized arrays, read off the RAW DOCUMENT.
 *
 * Phase 3's warning, in full: a CloudDesk that does not write `claimIds`,
 * `claimKeys` and `admittedTo` on every claim and every admission passes the
 * suite on a FileDesk and answers nothing in the cloud. The desk conformance
 * suite catches most of that already, because the cloud reads are queries
 * with no fallback — but a conformance suite asks through the `Desk`
 * interface, and an interface is exactly where a read-side cleverness could
 * paper over a missing array without anybody noticing.
 *
 * So this file does not use the interface to check. It goes underneath it and
 * looks at the bytes, after every mutating method, and asserts the arrays are
 * EXACTLY derivable from the record beside them. No cache can satisfy this,
 * and no query rewrite can fake it.
 */

const gate = cloudGate();

if (!gate.ok && requireEmulator()) {
  describe("CloudDesk arrays", () => {
    it("the Firestore emulator is REQUIRED here and is not available", () => {
      throw new Error(`ISOCAN_REQUIRE_EMULATOR=1, but this suite cannot run: ${gate.skip}.`);
    });
  });
} else {
  const test = gate.ok ? it : it.skip;
  const title = gate.ok
    ? "CloudDesk — the denormalized arrays, read off the raw document"
    : `CloudDesk — the denormalized arrays, read off the raw document [SKIPPED: ${gate.skip}]`;

  describe(title, () => {
    /**
     * The invariant, stated once: each array is exactly the set the record
     * beside it implies. Run after EVERY mutating method, because the failure
     * this guards against is not "the derivation is wrong" — it is "one code
     * path forgot to run it".
     */
    const assertArrays = async (
      firestore: ReturnType<typeof makeCloudDesk>["firestore"],
      badgeId: string,
    ) => {
      const raw = (await firestore.collection(BADGES).doc(badgeId).get()).data()!;
      const claims = (raw["claims"] ?? []) as { actorId: string; sessionKey?: string }[];
      const admissions = (raw["admissions"] ?? []) as { canvasId: string }[];
      expect(sorted(raw["claimIds"] as string[])).toEqual(
        sorted([...new Set(claims.map((row) => row.actorId))]),
      );
      expect(sorted(raw["claimKeys"] as string[])).toEqual(
        sorted([
          ...new Set(
            claims
              .map((row) => row.sessionKey)
              .filter((key): key is string => typeof key === "string"),
          ),
        ]),
      );
      expect(sorted(raw["admittedTo"] as string[])).toEqual(
        sorted([...new Set(admissions.map((row) => row.canvasId))]),
      );
    };

    test("after put, setClaims, admit, adopt and touch — every time, on the bytes", async () => {
      const { desk, firestore } = makeCloudDesk();
      try {
        await desk.init();

        // put — a fresh badge: three empty arrays, present rather than absent,
        // because `array-contains` on a missing field matches nothing and a
        // missing field is indistinguishable from a forgotten one.
        await desk.put(mint("bdg_1"));
        await assertArrays(firestore, "bdg_1");
        const fresh = (await firestore.collection(BADGES).doc("bdg_1").get()).data()!;
        expect(fresh["claimIds"]).toEqual([]);
        expect(fresh["claimKeys"]).toEqual([]);
        expect(fresh["admittedTo"]).toEqual([]);

        // setClaims
        await desk.setClaims("bdg_1", [claim("usr_ada", "cli:ada"), claim("usr_bo", "cli:bo")]);
        await assertArrays(firestore, "bdg_1");
        expect(
          sorted((await firestore.collection(BADGES).doc("bdg_1").get()).data()!["claimIds"] as string[]),
        ).toEqual(["usr_ada", "usr_bo"]);

        // setClaims again, SHRINKING the list — the arrays must shrink with
        // it, which an append-only derivation would get wrong.
        await desk.setClaims("bdg_1", [claim("usr_ada", "cli:ada")]);
        await assertArrays(firestore, "bdg_1");
        expect(
          (await firestore.collection(BADGES).doc("bdg_1").get()).data()!["claimIds"],
        ).toEqual(["usr_ada"]);

        // admit
        await desk.admit("bdg_1", "prj_a", { root: "created" });
        await assertArrays(firestore, "bdg_1");
        await desk.admit("bdg_1", "prj_b", { root: "link" });
        await assertArrays(firestore, "bdg_1");
        expect(
          sorted((await firestore.collection(BADGES).doc("bdg_1").get()).data()!["admittedTo"] as string[]),
        ).toEqual(["prj_a", "prj_b"]);

        // touch — the one merge in the file, and the one most likely to
        // clobber an array by writing a partial record.
        await desk.touch("bdg_1", new Date(Date.UTC(2026, 0, 2)).toISOString());
        await assertArrays(firestore, "bdg_1");

        // adopt — a transaction across two documents, and the array write
        // rides inside it.
        await desk.shelve({ "legacy:one": claim("usr_old", "legacy:one") });
        await desk.adopt("legacy:one", "bdg_1");
        await assertArrays(firestore, "bdg_1");
        expect(
          sorted((await firestore.collection(BADGES).doc("bdg_1").get()).data()!["claimIds"] as string[]),
        ).toEqual(["usr_ada", "usr_old"]);

        // shelve — the shelf belongs to no badge, so it is its own document
        // and it must not have grown arrays of its own.
        const shelf = (await firestore.doc(SHELF_DOC).get()).data()!;
        expect(Object.keys(shelf)).toEqual([]); // the one row was adopted away
      } finally {
        await desk.close();
      }
    });

    test("a badge written without its arrays answers NOTHING — no fallback rescues it", async () => {
      const { desk, firestore } = makeCloudDesk();
      try {
        await desk.init();
        // Exactly the bug phase 3 warned about, written by hand: a complete,
        // correct-looking badge record with the derived arrays missing.
        await firestore
          .collection(BADGES)
          .doc("bdg_forgotten")
          .set({
            badgeId: "bdg_forgotten",
            secretHash: "hash",
            kind: "bearer",
            createdAt: new Date(Date.UTC(2026, 0, 1)).toISOString(),
            lastSeen: new Date(Date.UTC(2026, 0, 1)).toISOString(),
            admissions: [{ canvasId: "prj_a", provenance: { root: "link" }, at: "2026-01-01T00:00:00.000Z" }],
            claims: [claim("usr_ghost", "cli:ghost")],
          });

        // The badge itself reads back fine, which is precisely why this is a
        // bug that survives a FileDesk-only suite.
        expect((await desk.badge("bdg_forgotten"))!.claims).toHaveLength(1);
        expect(await desk.claimsOf("bdg_forgotten")).toHaveLength(1);

        // And every question that goes through an index answers nothing —
        // loudly wrong rather than quietly right, which is the whole point of
        // forbidding a scan-the-collection fallback.
        expect(await desk.claimants("usr_ghost")).toEqual([]);
        expect(await desk.holdersOf("cli:ghost")).toEqual([]);
        expect(await desk.claimsIn(["prj_a"])).toEqual([]);
      } finally {
        await desk.close();
      }
    });
  });
}

function sorted(values: string[] | undefined): string[] {
  return [...(values ?? [])].sort();
}
