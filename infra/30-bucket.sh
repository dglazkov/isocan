#!/usr/bin/env bash
#
# STAGE A · 3 of 7 — the two buckets.
#
# CREATES   gs://${BUCKET}         blobs, snapshots, oplog archives
#           gs://${BACKUP_BUCKET}  Firestore exports (stage C writes to it)
#           Both regional in ${REGION}, uniform bucket-level access, public
#           access prevented, 7-day soft delete.
# COSTS     empty buckets are $0/mo. Standard regional storage in ${REGION} is
#           ~$0.020/GiB-month; operations are ~$0.005 per 1000 writes and
#           ~$0.0004 per 1000 reads. Egress to the internet is ~$0.12/GiB, but
#           bytes served through the daemon leave via Cloud Run, not here.
#           At journey scale: **cents.** A canvas with a gigabyte of video in
#           it is 2 cents a month of storage.
# ASSUMES   10-project.sh ran.
# UNDO      `gcloud storage rm --recursive gs://NAME` then
#           `gcloud storage buckets delete gs://NAME`. Note that a released
#           bucket NAME becomes claimable by anyone — including a stranger.
#
# Bucket names are globally unique and the namespace is crowded — this is the
# name most likely to collide. If the create fails with "already own"/"already
# exists", set ISOCAN_BUCKET to something free and re-run. See README.md,
# "When a name is taken".

source "$(dirname -- "${BASH_SOURCE[0]}")/lib/common.sh"
preflight
require_project
require_billing

make_bucket() {
  local name="$1" purpose="$2" soft_delete="$3"
  if exists gcloud storage buckets describe "gs://${name}" --project="${PROJECT_ID}"; then
    local loc
    loc="$(gcloud storage buckets describe "gs://${name}" --project="${PROJECT_ID}" --format='value(location)')"
    have "gs://${name} (${loc}) — ${purpose}"
    # A bucket that exists in the wrong region is worse than one that does not
    # exist: reads on the durability path would cross regions silently.
    [ "$(printf '%s' "${loc}" | tr 'A-Z' 'a-z')" = "${REGION}" ] \
      || die "gs://${name} is in ${loc}, not ${REGION}. A bucket cannot be moved; pick another name."
    return
  fi
  gcloud storage buckets create "gs://${name}" \
    --project="${PROJECT_ID}" \
    --location="${REGION}" \
    --default-storage-class=STANDARD \
    --uniform-bucket-level-access \
    --public-access-prevention \
    --soft-delete-duration="${soft_delete}"
  made "gs://${name} — ${purpose}"
}

step "the canvas bucket"
# public-access-prevention: nothing in here is ever served directly. Downloads
# stream through the daemon (which honors Range), and uploads arrive by
# short-lived signed PUT URL. A bucket that could be made public by one
# mis-click is a bucket where a leaked canvas is one mis-click away.
#
# uniform-bucket-level-access: per-object ACLs are the other way a bucket
# quietly becomes readable, and turning UBLA on at creation is permanent-ish
# (it can be turned off only within 90 days). Good.
#
# soft-delete 7d: a deleted object is recoverable for a week. The architecture
# asks for "a soft-delete window under GC" and this is it.
make_bucket "${BUCKET}" "blobs, snapshots, oplog archive" 7d

step "the backup bucket"
make_bucket "${BACKUP_BUCKET}" "Firestore exports" 7d

step "backup retention"
# Exports pile up forever otherwise. 90 days of daily exports of a small
# database is still measured in cents, and it is a real recovery window.
#
# AGE, and no versioning condition, and that pairing is load-bearing.
# 90-backup-export.sh gives Firestore the BUCKET as the output prefix, so every
# nightly run invents its own `2026-08-23T02:22:44_58412/` folder and no object
# in this bucket is ever written twice. Two things follow:
#
#   - `age: 90` deletes whole exports, not pieces of them. Every object in one
#     export is written inside the same minute, so a tree ages out with its
#     siblings and the bucket never holds a half-swept restore point.
#   - Object versioning here would be inert — nothing overwrites anything, so
#     no noncurrent generation would ever exist for a `daysSinceNoncurrentTime`
#     rule to sweep. It is not off by oversight; it is off because the shape of
#     the thing being kept made it unnecessary. (It would also have been the
#     WRONG tool: an export is a tree, versioning is per object, and a restore
#     needs a set of generations that `importDocuments` cannot even address.
#     90-backup-export.sh's header argues that in full.)
LIFECYCLE_JSON="$(mktemp)"
cat >"${LIFECYCLE_JSON}" <<'JSON'
{
  "rule": [
    { "action": {"type": "Delete"}, "condition": {"age": 90} }
  ]
}
JSON
gcloud storage buckets update "gs://${BACKUP_BUCKET}" \
  --project="${PROJECT_ID}" \
  --lifecycle-file="${LIFECYCLE_JSON}" >/dev/null
rm -f "${LIFECYCLE_JSON}"
made "gs://${BACKUP_BUCKET}: delete objects older than 90 days (~90 nightly exports kept)"

step "one rule that is deliberately NOT here"
# `GcsObjects.append` composes `<key>.part-<ts>-<rand>` beside the archive and
# deletes it; its own comment says "the bucket's lifecycle rule is where that
# gets swept". It cannot be. GCS lifecycle conditions match by PREFIX and by
# SUFFIX, and that name's prefix is a real object's key while its suffix is
# random — so no rule can name the scratch objects without also naming the
# blobs they sit beside, and a rule that deleted blobs by age would delete the
# canvas.
#
# The leak is small (a crash between compose and delete, a fraction of a cent
# each) and it is not a correctness problem. But it is not swept, and pretending
# otherwise with a rule that looks right would be worse than saying so.
# Phase 5's Work now carries the fix: move scratch under a fixed
# `scratch/` prefix, which one `matchesPrefix` rule with `age: 1` then sweeps.
warn "no scratch-object lifecycle rule — GCS lifecycle cannot match '<key>.part-*'. See Phase 5's Work."

step "done"
note "next: infra/40-service-account.sh"
