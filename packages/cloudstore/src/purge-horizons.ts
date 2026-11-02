import type { PurgeHorizon } from "@isocan/core";

/**
 * **What a purge on the hosted backing cannot erase, in numbers** — the three
 * horizons `docs/projects/operator/design.md` names under "Purge: the bytes",
 * each a fact about one script under `infra/`.
 *
 * The numbers live here, in the package that IS the Google Cloud adapter, and
 * nowhere else: a file home has no bucket and no export, and a terminal prints
 * what the home tells it. They are constants rather than reads of the
 * scripts because a daemon on Cloud Run has no `infra/` directory — but
 * `test/purge-horizons.test.ts` READS the scripts and fails the day one of
 * these stops matching, which is the acceptance's own sentence: *so the day a
 * horizon changes the sentence fails rather than lies.*
 *
 * Each is what it is for a different reason, and the reasons are the scripts':
 *
 * - **The bucket keeps a deleted object for seven days.** `30-bucket.sh`
 *   creates the canvas bucket with `--soft-delete-duration=7d`, "so a deleted
 *   object is recoverable for a week". A purge's deletes are ordinary deletes,
 *   and this is what ordinary means there.
 * - **Firestore can be rewound seven days.** `20-firestore.sh` turns on
 *   point-in-time recovery, and its window is seven days: the `ops` and
 *   `blobmeta` documents a purge deletes are readable at any instant before
 *   the purge for that long.
 * - **The nightly exports hold the op text for ninety days.**
 *   `90-backup-export.sh` exports the whole database to the backup bucket
 *   every night, and `30-bucket.sh`'s lifecycle rule on that bucket deletes
 *   objects older than ninety days — so the last export taken before the
 *   purge ages out within ninety.
 *
 * Dimitri's open question 6 is whether ninety days is the honest end of a
 * purge or whether a purge should also delete from the exports. Until it is
 * answered, the honest thing is to say the number.
 */
export const PURGE_HORIZONS = {
  /** `infra/30-bucket.sh`: `--soft-delete-duration=7d` on the canvas bucket. */
  bucketSoftDeleteDays: 7,
  /** `infra/20-firestore.sh`: point-in-time recovery, a 7-day window. */
  databaseRewindDays: 7,
  /** `infra/30-bucket.sh`: the backup bucket's lifecycle rule, `age: 90`;
   * `infra/90-backup-export.sh` fills that bucket nightly. */
  exportRetentionDays: 90,
} as const;

/** The three, as the lines the verb prints — rendered by the home, so a
 * terminal running an older bundle still prints what this home's
 * infrastructure says today. */
export function hostedPurgeHorizons(): PurgeHorizon[] {
  const { bucketSoftDeleteDays, databaseRewindDays, exportRetentionDays } = PURGE_HORIZONS;
  return [
    {
      kind: "bucket",
      days: bucketSoftDeleteDays,
      sentence:
        `the storage bucket keeps a deleted object for ${bucketSoftDeleteDays} days ` +
        "(soft delete), then it is gone",
    },
    {
      kind: "database",
      days: databaseRewindDays,
      sentence:
        `the database can be rewound ${databaseRewindDays} days (point-in-time recovery), ` +
        "then the log entries and blob records are gone",
    },
    {
      kind: "exports",
      days: exportRetentionDays,
      sentence:
        `the nightly exports hold the op text for up to ${exportRetentionDays} days, ` +
        "then age out",
    },
  ];
}
