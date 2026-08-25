#!/usr/bin/env bash
#
# STAGE C · the keeping — a nightly Firestore export to the backup bucket.
#
# CREATES   one Cloud Scheduler job that calls the Firestore admin API's
#           exportDocuments once a day, writing a NEW timestamped folder under
#           gs://${BACKUP_BUCKET} every run.
# COSTS     Cloud Scheduler: the first 3 jobs per billing account are free,
#           then $0.10/job/month. The export itself bills one document read per
#           exported document (~$0.03 per 100,000 in ${REGION}) plus the bytes
#           it lands in GCS (~$0.020/GiB-month, swept after 90 days by
#           30-bucket.sh's lifecycle rule). Note that the bucket now holds up
#           to 90 exports rather than one, so storage is ~90x what a single
#           copy costs: at journey scale this home's whole export is 11.8 KB,
#           so ninety of them is ~1 MB. At journey scale: **cents.**
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
# WHY THE PREFIX IS THE BUCKET AND NOT A FOLDER IN IT. This is the whole of
# the fix that this line encodes, so it is worth the paragraph.
#
# The first version of this file asked for `gs://${BACKUP_BUCKET}/firestore` —
# one fixed folder, the same one every night. That is wrong twice, and the
# second way is the one that bites:
#
#   1. One folder is one restore point. Ninety nightly runs into the same
#      destination leave you with whatever the last one wrote, and a backup you
#      cannot walk backwards through is a weak version of the promise above.
#   2. Firestore REFUSES the second run outright. It checks for the
#      `.overall_export_metadata` file before it starts, and answers
#      `INVALID_ARGUMENT: Path already exists:
#      /${BACKUP_BUCKET}/firestore/firestore.overall_export_metadata`.
#      Measured on this home: the first run SUCCESSFUL, the second HTTP 400,
#      two seconds apart. So the fixed prefix does not overwrite the good
#      backup — it means there is exactly one backup, ever, and the nightly job
#      is red from the second night onward while the bucket still looks full.
#      A green-looking bucket and a red job is the worst of both.
#
# The API's own answer is one character of URL: "If the URI is a bucket
# (without a namespace path), a prefix will be generated based on the start
# time." So we hand it the bucket, and every run lands in its own
# `2026-08-23T02:22:44_58412/` beside the others — a complete, self-consistent
# set of objects per run, no computed timestamp, no second moving part, and the
# Scheduler body stays the static string that Scheduler bodies have to be.
# `30-bucket.sh`'s `age: 90` lifecycle rule then sweeps whole exports, because
# every object in one export is written within the same minute and ages out
# with its siblings.
#
# WHY NOT OBJECT VERSIONING ON THE BUCKET, which is the other obvious answer.
# Because an export is not an object, it is a TREE, and versioning is per
# object. To recover last Tuesday you would have to pick, object by object, the
# generation belonging to one run — and `importDocuments` reads the LIVE
# objects at a prefix and cannot address a noncurrent generation at all, so you
# would first hand-copy each `#generation` into a fresh prefix. Worse, the
# number of `output-N` shards moves with the database: a smaller export leaves
# the tail shards of a larger one as the current versions, and the live tree
# becomes a set that never existed. Versioning would keep the bytes and lose
# the export. (It would also need the ops account widened from objectCreator to
# something that can delete, since replacing an object requires it — see
# 40-service-account.sh. Under this fix nothing is ever overwritten, so
# objectCreator is exactly the right grant and stays.)
#
# WHY NOT `gcloud firestore backups schedules` — AND WHY IT IS NOT A RIVAL.
# Firestore's own managed backup schedules are a fine product and they are NOT
# this: they keep backups inside Firestore's control plane, restorable only
# into a Firestore database in the same project, and they cannot be copied out
# or downloaded. The architecture's line is "a scheduled export TO THE BUCKET",
# and the bucket is the point — it is the copy that leaves. But it is an ALSO,
# not an INSTEAD: it is a third rung (PITR for "what did it look like at
# 14:32", the export for "give me the bytes", a managed backup for "put it back
# in one command", retained up to 14 weeks and surviving deletion of the source
# database). It is not created here because it bills for backup storage, adds a
# resource, and buys speed of restore — which at journey scale is the thing we
# have the least need of. When the home holds someone else's canvases and a
# restore is measured in a person's afternoon, add it. Do not remove this.

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

# NO trailing path, and that is the fix rather than a tidiness preference —
# see the header. Putting `/firestore` back makes every run after the first a
# 400, and leaves you with a single restore point until it does.
BODY="{\"outputUriPrefix\":\"gs://${BACKUP_BUCKET}\"}"

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
# `create` takes --headers; `update` refuses it and wants --update-headers.
# Not a synonym pair — the update verb models a patch, so it distinguishes
# "set these" from "clear them". Measured, after `update` rejected --headers
# with "did you mean '--clear-headers'?" against a job that already existed.
if [ "${VERB}" = create ]; then
  HEADER_FLAG=(--headers="Content-Type=application/json")
else
  HEADER_FLAG=(--update-headers="Content-Type=application/json")
fi

gcloud scheduler jobs "${VERB}" http "${JOB}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="${SCHEDULE}" \
  --time-zone="Etc/UTC" \
  --uri="${EXPORT_URL}" \
  --http-method=POST \
  "${HEADER_FLAG[@]}" \
  --message-body="${BODY}" \
  --oauth-service-account-email="${OPS_SA}" \
  --attempt-deadline=30m \
  --description="isocan: nightly Firestore export, one timestamped folder per run under gs://${BACKUP_BUCKET}" \
  >/dev/null
made "${JOB} — '${SCHEDULE}' UTC -> gs://${BACKUP_BUCKET}/<start-time>/"

step "the folder the old fixed prefix left behind"
# Homes provisioned before this fix have one export sitting at the literal
# path `firestore/`, and the job that wrote it has been refusing to run ever
# since. It is a real export and it still imports; it is simply not where new
# ones land, and leaving it costs a fraction of a cent. Say so; do not delete
# somebody's only backup from a script.
if gcloud storage ls "gs://${BACKUP_BUCKET}/firestore/firestore.overall_export_metadata" \
     --project="${PROJECT_ID}" >/dev/null 2>&1; then
  warn "gs://${BACKUP_BUCKET}/firestore/ is an export from the old fixed prefix."
  note "it is valid and importable, and it is why runs after the first used to 400."
  note "new runs land in their own folder and never touch it. keep it or remove it:"
  note "  gcloud storage rm --recursive gs://${BACKUP_BUCKET}/firestore --project=${PROJECT_ID}"
  note "(do that only once a run under the new shape has landed below.)"
else
  note "none — nothing at the old fixed prefix"
fi

step "prove it works, now, rather than at 09:17 tomorrow"
note "a scheduled job nobody has ever seen run is a scheduled job that does not work."
# This trigger used to be able to collide with itself: two runs against the one
# fixed prefix, the second refused with "Path already exists". It cannot now.
# Each run computes its own destination from its own start time, so re-running
# this script — which you are meant to be able to do — writes another export
# beside the last one and costs a document read apiece.
if [ "${ISOCAN_SKIP_EXPORT_RUN:-0}" = "1" ]; then
  note "ISOCAN_SKIP_EXPORT_RUN=1 — not running it"
else
  gcloud scheduler jobs run "${JOB}" --location="${REGION}" --project="${PROJECT_ID}" >/dev/null
  made "triggered one run"
  note "watch it:      gcloud firestore operations list --project=${PROJECT_ID}"
  note "then look:     gcloud storage ls gs://${BACKUP_BUCKET}/"
  note "restore from:  gcloud firestore import gs://${BACKUP_BUCKET}/<folder> --project=${PROJECT_ID}"
  note "(an export of an almost-empty database finishes in well under a minute)"
fi

step "done"
note "next: infra/91-scheduler-gc.sh — read it. It creates nothing, on purpose, and says why."
