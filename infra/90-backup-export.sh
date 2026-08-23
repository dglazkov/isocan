#!/usr/bin/env bash
#
# STAGE C · the keeping — a nightly Firestore export to the backup bucket.
#
# CREATES   one Cloud Scheduler job that calls the Firestore admin API's
#           exportDocuments once a day, writing to gs://${BACKUP_BUCKET}.
# COSTS     Cloud Scheduler: the first 3 jobs per billing account are free,
#           then $0.10/job/month. The export itself bills one document read per
#           exported document (~$0.03 per 100,000 in ${REGION}) plus the bytes
#           it lands in GCS (~$0.020/GiB-month, swept after 90 days by
#           30-bucket.sh's lifecycle rule). At journey scale: **cents.**
# ASSUMES   20-firestore.sh, 30-bucket.sh and 40-service-account.sh ran.
# UNDO      `gcloud scheduler jobs delete ${JOB} --location=${REGION}`. Clean.
#           The exports already written stay until the lifecycle rule takes
#           them; delete them by hand if you want them gone sooner.
#
# WHY AN EXPORT WHEN PITR IS ALREADY ON. They answer different questions. PITR
# answers "what did the database look like at 14:32 last Tuesday", inside a
# seven-day window, and only while the database exists. An export answers "give
# me the bytes", lives in a bucket you can copy anywhere, and survives the
# database being deleted — including by you, by accident. The architecture asks
# for both, and it is right to.
#
# WHY NOT `gcloud firestore backups schedules`. Firestore's own managed backup
# schedules are a fine product and they are NOT this: they keep backups inside
# Firestore's control plane, restorable only into a Firestore database in the
# same project. The architecture's line is "a scheduled export TO THE BUCKET",
# and the bucket is the point — it is the copy that leaves.

source "$(dirname -- "${BASH_SOURCE[0]}")/lib/common.sh"
preflight
require_project
require_billing

JOB="${ISOCAN_EXPORT_JOB:-isocan-firestore-export}"
SCHEDULE="${ISOCAN_EXPORT_SCHEDULE:-17 9 * * *}"   # 09:17 UTC daily. An odd
                                                  # minute on purpose: every
                                                  # job in the world runs at
                                                  # :00, and the API is
                                                  # rate-limited.

# The database id has parentheses in it, and they must be percent-encoded or
# the URL is silently a different resource.
EXPORT_URL="https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/%28default%29:exportDocuments"
BODY="{\"outputUriPrefix\":\"gs://${BACKUP_BUCKET}/firestore\"}"

step "Cloud Scheduler job ${JOB}"
if exists gcloud scheduler jobs describe "${JOB}" --location="${REGION}" --project="${PROJECT_ID}"; then
  have "${JOB}"
  note "updating it in place so this file stays the description of the job"
  VERB=update
else
  VERB=create
fi

# --oauth-service-account-email, not --oidc-*: the target is a GOOGLE API, and
# Google APIs want an OAuth 2.0 access token. OIDC identity tokens are for your
# own services (Cloud Run, Cloud Functions). Getting this backwards produces a
# 401 from Firestore that says nothing about which kind of token it wanted.
gcloud scheduler jobs "${VERB}" http "${JOB}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="${SCHEDULE}" \
  --time-zone="Etc/UTC" \
  --uri="${EXPORT_URL}" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --message-body="${BODY}" \
  --oauth-service-account-email="${OPS_SA}" \
  --attempt-deadline=30m \
  --description="isocan: nightly Firestore export to gs://${BACKUP_BUCKET}/firestore" \
  >/dev/null
made "${JOB} — '${SCHEDULE}' UTC -> gs://${BACKUP_BUCKET}/firestore"

step "prove it works, now, rather than at 09:17 tomorrow"
note "a scheduled job nobody has ever seen run is a scheduled job that does not work."
if [ "${ISOCAN_SKIP_EXPORT_RUN:-0}" = "1" ]; then
  note "ISOCAN_SKIP_EXPORT_RUN=1 — not running it"
else
  gcloud scheduler jobs run "${JOB}" --location="${REGION}" --project="${PROJECT_ID}" >/dev/null
  made "triggered one run"
  note "watch it:      gcloud firestore operations list --project=${PROJECT_ID}"
  note "then look:     gcloud storage ls gs://${BACKUP_BUCKET}/firestore/"
  note "(an export of an almost-empty database finishes in well under a minute)"
fi

step "done"
note "next: infra/91-scheduler-gc.sh — read it. It refuses to create a job, and says why."
