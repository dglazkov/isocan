#!/usr/bin/env bash
#
# STAGE A · 2 of 7 — the Firestore database, in Native mode, with PITR on.
#
# CREATES   the `(default)` Firestore database in ${REGION}, Native mode;
#           turns on point-in-time recovery (7 days).
# COSTS     an empty database is $0/mo. At journey scale — one person, a few
#           canvases, human-driven ops — storage and operations are cents.
#           Order of magnitude in ${REGION}: ~$0.18/GiB-month of stored data,
#           ~$0.03 per 100k document reads, ~$0.09 per 100k writes. PITR keeps
#           older versions of changed documents and bills them as storage; on a
#           database measured in megabytes that is still cents. Call the whole
#           line **under $1/mo for dev** and check the bill after a month
#           rather than trusting a number written before any data existed.
# ASSUMES   10-project.sh ran (project exists, firestore.googleapis.com on).
# UNDO      the database can be deleted, but see the one-way door below.
#
# ⚠ THE ONE-WAY DOOR IN THIS FILE
#
# A Firestore database's LOCATION CANNOT BE CHANGED. Not by a flag, not by a
# support ticket. Moving to another region means creating a second database and
# doing an export/import — with the home down, because the oplog is truth and
# an export is a point in time. ${REGION} is the architecture's Given, and
# Cloud Run and the bucket are co-located with it deliberately: cross-region
# reads on the durability path would put tens of milliseconds on every single
# op, and the ack is what the daemon calls fsync.
#
# So: if the region is wrong, it is wrong NOW, before this script runs.

source "$(dirname -- "${BASH_SOURCE[0]}")/lib/common.sh"
preflight
require_project
require_billing

step "Firestore database"
if exists gcloud firestore databases describe --database='(default)' --project="${PROJECT_ID}"; then
  LOCATION="$(gcloud firestore databases describe --database='(default)' \
    --project="${PROJECT_ID}" --format='value(locationId)')"
  TYPE="$(gcloud firestore databases describe --database='(default)' \
    --project="${PROJECT_ID}" --format='value(type)')"
  have "(default) — ${TYPE} in ${LOCATION}"
  [ "${LOCATION}" = "${REGION}" ] \
    || die "the database is in ${LOCATION}, not ${REGION}, and a database cannot be moved. Either change ISOCAN_REGION to ${LOCATION} everywhere, or use a different project."
  [ "${TYPE}" = "FIRESTORE_NATIVE" ] \
    || die "the database is ${TYPE}, not FIRESTORE_NATIVE, and the mode cannot be changed either. CloudStore needs Native mode."
else
  confirm "create the Firestore database in ${REGION}? THE LOCATION IS PERMANENT — a database cannot be moved between regions."
  gcloud firestore databases create \
    --database='(default)' \
    --location="${REGION}" \
    --type=firestore-native \
    --project="${PROJECT_ID}"
  made "(default) — FIRESTORE_NATIVE in ${REGION}"
fi

step "point-in-time recovery"
# PITR gives 7 days of "read the database as it was at time T". It is the
# backstop for the failure the no-delete rule cannot cover: not a lost write,
# but a bad one — a migration that rewrote documents it should not have.
#
# `databases update --enable-pitr` is idempotent: turning it on when it is
# already on succeeds and changes nothing.
PITR="$(gcloud firestore databases describe --database='(default)' \
  --project="${PROJECT_ID}" --format='value(pointInTimeRecoveryEnablement)' 2>/dev/null || true)"
if [ "${PITR}" = "POINT_IN_TIME_RECOVERY_ENABLED" ]; then
  have "PITR enabled"
else
  gcloud firestore databases update --database='(default)' \
    --enable-pitr --project="${PROJECT_ID}" >/dev/null
  made "PITR enabled (7-day window)"
fi

step "done"
note "the scheduled export to the bucket is STAGE C (infra/90-backup-export.sh) — it needs the backup bucket, which 30-bucket.sh makes."
note "next: infra/30-bucket.sh"
