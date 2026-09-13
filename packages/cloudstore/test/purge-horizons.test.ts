import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PURGE_HORIZONS, hostedPurgeHorizons } from "../src/purge-horizons.ts";

/**
 * **The printed horizons match the scripts** — operator phase 3's acceptance,
 * verbatim: *the printed horizons match `infra/30-bucket.sh` and
 * `infra/90-backup-export.sh` — asserted by a test that reads the scripts, so
 * the day a horizon changes the sentence fails rather than lies.*
 *
 * Read, not restated. Each number the verb prints after a purge is a claim
 * about a Google Cloud setting that one script under `infra/` made, and the
 * script is the only place that setting is decided. So this parses the lines
 * that decide them — the `--soft-delete-duration` the canvas bucket is created
 * with, the `"age"` in the backup bucket's lifecycle rule, the PITR window
 * `20-firestore.sh` names, and the export job's schedule and destination —
 * and asserts the constants against what it found. A constant that agrees
 * with a stale reading of the script is exactly the lie this exists to catch.
 */

const infra = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`../../../infra/${name}`, import.meta.url)), "utf8");

describe("the purge horizons are read from infra/, not remembered", () => {
  const bucket = infra("30-bucket.sh");
  const exportJob = infra("90-backup-export.sh");
  const firestore = infra("20-firestore.sh");

  it("the bucket keeps a deleted object for as long as 30-bucket.sh says", () => {
    // `make_bucket "${BUCKET}" "…" 7d` — the third argument is the soft-delete
    // duration the canvas bucket is created with.
    const made = /make_bucket "\$\{BUCKET\}" "[^"]*" (\d+)d/.exec(bucket);
    expect(made, "30-bucket.sh no longer creates the canvas bucket with a soft-delete duration").not.toBeNull();
    expect(bucket).toContain('--soft-delete-duration="${soft_delete}"');
    expect(PURGE_HORIZONS.bucketSoftDeleteDays).toBe(Number(made![1]));
  });

  it("the exports age out when 30-bucket.sh's lifecycle rule says, and 90-backup-export.sh fills that bucket nightly", () => {
    const age = /"condition":\s*\{\s*"age":\s*(\d+)\s*\}/.exec(bucket);
    expect(age, "30-bucket.sh no longer sets an age rule on the backup bucket").not.toBeNull();
    expect(bucket, "the rule is applied to the BACKUP bucket").toMatch(
      /buckets update "gs:\/\/\$\{BACKUP_BUCKET\}"[\s\S]*--lifecycle-file/,
    );
    expect(PURGE_HORIZONS.exportRetentionDays).toBe(Number(age![1]));
    // "Nightly" is a claim about the schedule: five fields, and the day-of-
    // month, month and weekday are all `*`, so it runs every day.
    const schedule = /SCHEDULE="\$\{ISOCAN_EXPORT_SCHEDULE:-([^}]+)\}"/.exec(exportJob);
    expect(schedule, "90-backup-export.sh no longer sets a default schedule").not.toBeNull();
    const fields = schedule![1]!.trim().split(/\s+/);
    expect(fields).toHaveLength(5);
    expect(fields.slice(2), "daily: day, month and weekday unconstrained").toEqual(["*", "*", "*"]);
    // And the export lands in the bucket the age rule sweeps.
    expect(exportJob).toMatch(/outputUriPrefix\\":\\"gs:\/\/\$\{BACKUP_BUCKET\}\\"/);
  });

  it("the database rewinds as far as 20-firestore.sh's PITR window", () => {
    expect(firestore).toContain("--enable-pitr");
    const window = /PITR enabled \((\d+)-day window\)/.exec(firestore);
    expect(window, "20-firestore.sh no longer names the PITR window").not.toBeNull();
    expect(PURGE_HORIZONS.databaseRewindDays).toBe(Number(window![1]));
  });

  it("the sentences carry the numbers, in the order the verb prints them", () => {
    const lines = hostedPurgeHorizons();
    expect(lines.map((line) => line.kind)).toEqual(["bucket", "database", "exports"]);
    expect(lines[0]!.days).toBe(PURGE_HORIZONS.bucketSoftDeleteDays);
    expect(lines[0]!.sentence).toContain(`${PURGE_HORIZONS.bucketSoftDeleteDays} days`);
    expect(lines[1]!.days).toBe(PURGE_HORIZONS.databaseRewindDays);
    expect(lines[1]!.sentence).toContain(`${PURGE_HORIZONS.databaseRewindDays} days`);
    expect(lines[2]!.days).toBe(PURGE_HORIZONS.exportRetentionDays);
    expect(lines[2]!.sentence).toContain(`${PURGE_HORIZONS.exportRetentionDays} days`);
    // Each sentence says what the number is a limit ON, so a reader who only
    // sees the line knows which copy it is talking about.
    expect(lines[0]!.sentence).toMatch(/bucket/);
    expect(lines[1]!.sentence).toMatch(/database/);
    expect(lines[2]!.sentence).toMatch(/exports/);
  });
});
