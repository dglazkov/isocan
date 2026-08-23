#!/usr/bin/env bash
#
# STAGE A · 4 of 7 — three service accounts, and the self-binding that phase 4
# said would otherwise be discovered at 11pm during a deploy.
#
# CREATES   ${RUNTIME_SA}  what the daemon runs as
#           ${BUILD_SA}    what Cloud Build runs as
#           ${OPS_SA}      what Cloud Scheduler runs as
#           plus their role bindings, project-wide and bucket-scoped;
#           and gs://${PROJECT_ID}_${REGION}_cloudbuild, the source staging
#           bucket, only because a grant needs a thing to be granted on — see
#           "TWO PRINCIPALS" below.
# COSTS     nothing. Service accounts and IAM bindings are free, and the
#           staging bucket holds a few megabytes of source tarball per build.
# ASSUMES   10-project.sh and 30-bucket.sh ran (the bucket bindings need the
#           buckets to exist).
# UNDO      `gcloud iam service-accounts delete …`. Deleting one and recreating
#           it with the same name gives a DIFFERENT unique id, and bindings
#           made to the old one do not follow — so a delete-and-recreate is a
#           re-run of this whole script, not a repair.
#
# ═══ PHASE 4'S FIRST DEBT, PAID HERE AND NOT LATER ═══
#
# A Cloud Run service account has NO PRIVATE KEY. `getSignedUrl` therefore
# cannot sign locally; google-auth-library falls back to the IAM `signBlob`
# API, which is a network call gated by roles/iam.serviceAccountTokenCreator —
# and the account needs that role ON ITSELF, because it is asking IAM to sign
# as itself.
#
# Without it the large-blob upload branch fails at the first attempt, in
# production, with an error about *credentials* rather than about permissions,
# which is the single most misleading failure mode in this whole stack. It is
# granted below, at creation, with the bucket roles — not when a video fails to
# upload. (iamcredentials.googleapis.com is enabled in 10-project.sh for the
# same reason: without the API on, the role is not enough.)

source "$(dirname -- "${BASH_SOURCE[0]}")/lib/common.sh"
preflight
require_project
require_billing

make_sa() {
  local name="$1" display="$2"
  local email="${name}@${PROJECT_ID}.iam.gserviceaccount.com"
  if exists gcloud iam service-accounts describe "${email}" --project="${PROJECT_ID}"; then
    have "${email}"
  else
    gcloud iam service-accounts create "${name}" \
      --project="${PROJECT_ID}" \
      --display-name="${display}" >/dev/null
    made "${email}"
  fi
}

step "service accounts"
make_sa "${RUNTIME_SA_NAME}" "isocan home (Cloud Run runtime)"
make_sa "${BUILD_SA_NAME}"   "isocan build (Cloud Build)"
make_sa "${OPS_SA_NAME}"     "isocan ops (Cloud Scheduler)"

step "the runtime account: its own furniture and nothing else"
# The architecture's line: "scoped to exactly its own furniture: this project's
# Firestore, this bucket, this KMS key, named secrets — nothing else, so home
# compromise stays the innkeeper doc's honest worst case and not a lateral move
# into the rest of the cloud."
#
# roles/datastore.user is project-wide because Firestore IAM has no per-
# collection grain; there is one database and the daemon owns all of it.
bind_project_role "serviceAccount:${RUNTIME_SA}" roles/datastore.user
# Observability. Without logWriter a Cloud Run service's own console.log lands
# nowhere, which is a bad day to have during a first deploy.
bind_project_role "serviceAccount:${RUNTIME_SA}" roles/logging.logWriter
bind_project_role "serviceAccount:${RUNTIME_SA}" roles/monitoring.metricWriter
bind_project_role "serviceAccount:${RUNTIME_SA}" roles/cloudtrace.agent
bind_project_role "serviceAccount:${RUNTIME_SA}" roles/errorreporting.writer

# Storage is bucket-scoped rather than project-scoped, deliberately: the
# runtime account can read and write objects in the canvas bucket and has no
# opinion at all about the backup bucket. objectAdmin covers get/create/delete
# and compose (which `append` needs) without granting bucket administration —
# it cannot change the lifecycle, cannot turn off public-access-prevention, and
# cannot delete the bucket.
bind_bucket_role "${BUCKET}" "serviceAccount:${RUNTIME_SA}" roles/storage.objectAdmin

step "the self-binding (phase 4, debt 1)"
# Idempotent: adding a member that is already bound is a server-side no-op.
gcloud iam service-accounts add-iam-policy-binding "${RUNTIME_SA}" \
  --project="${PROJECT_ID}" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/iam.serviceAccountTokenCreator" >/dev/null
made "roles/iam.serviceAccountTokenCreator on ${RUNTIME_SA} -> ITSELF"
note "this is what makes getSignedUrl work with no private key. infra/signed-url-smoke.sh is what proves it."

step "the build account"
bind_project_role "serviceAccount:${BUILD_SA}" roles/artifactregistry.writer
bind_project_role "serviceAccount:${BUILD_SA}" roles/run.developer
# A build with a user-specified service account must be able to write its own
# logs, or the build fails before it starts with a message about logging
# buckets. cloudbuild.yaml also sets options.logging: CLOUD_LOGGING_ONLY.
bind_project_role "serviceAccount:${BUILD_SA}" roles/logging.logWriter
# Deploying a Cloud Run service that RUNS AS another account requires
# actAs on that account. This is the binding people miss; the failure reads
# "Permission 'iam.serviceaccounts.actAs' denied" at the end of a long build.
gcloud iam service-accounts add-iam-policy-binding "${RUNTIME_SA}" \
  --project="${PROJECT_ID}" \
  --member="serviceAccount:${BUILD_SA}" \
  --role="roles/iam.serviceAccountUser" >/dev/null
made "roles/iam.serviceAccountUser on ${RUNTIME_SA} -> ${BUILD_SA}"

# ═══ THE SOURCE STAGING BUCKET: TWO PRINCIPALS, NOT ONE ═══
#
# `gcloud builds submit` tars this working tree and uploads it AS YOU, the
# human at the keyboard. Cloud Build then downloads that same object AS THE
# BUILD SERVICE ACCOUNT. With a user-specified build account (which is what
# 60-build-image.sh passes) those are two different principals, and nothing in
# the default setup grants the second one read on the first one's upload.
#
# The failure is a 403 on the source object at step 0 of the build, before any
# of cloudbuild.yaml runs — which reads like a broken tarball or a bad
# .gcloudignore and is neither. It was found by hand during the first
# provisioning of isocan-io-dev and granted by hand; it lives here now so the
# next environment does not find it the same way.
#
# The bucket name is gcloud's own, from --default-buckets-behavior=
# regional-user-owned-bucket in 60-build-image.sh. gcloud creates it lazily on
# the first submit, so on a fresh project it does not exist yet — and a grant
# needs something to grant on. Create it here, with the same shape 30-bucket.sh
# uses, so the FIRST build already has its read. If either step is refused this
# says so and continues: the grant is repairable, and a script that dies here
# would strand a project whose service accounts are otherwise complete.
step "the build account's source staging bucket"
STAGING_BUCKET="${PROJECT_ID}_${REGION}_cloudbuild"
if ! exists gcloud storage buckets describe "gs://${STAGING_BUCKET}" --project="${PROJECT_ID}"; then
  if gcloud storage buckets create "gs://${STAGING_BUCKET}" \
       --project="${PROJECT_ID}" \
       --location="${REGION}" \
       --default-storage-class=STANDARD \
       --uniform-bucket-level-access \
       --public-access-prevention >/dev/null 2>&1; then
    made "gs://${STAGING_BUCKET} — where gcloud builds submit puts the source tarball"
  else
    warn "could not create gs://${STAGING_BUCKET} (it may belong to someone else, or the name may be taken)"
    note "the first \`gcloud builds submit\` will create it; then re-run this script to grant the read."
  fi
else
  have "gs://${STAGING_BUCKET}"
fi
if exists gcloud storage buckets describe "gs://${STAGING_BUCKET}" --project="${PROJECT_ID}"; then
  # objectViewer and nothing more: the build account READS the tarball. You
  # write it; it never needs to.
  bind_bucket_role "${STAGING_BUCKET}" "serviceAccount:${BUILD_SA}" roles/storage.objectViewer
else
  warn "no staging bucket to grant on yet — 60-build-image.sh's first submit creates it"
  note "then:  gcloud storage buckets add-iam-policy-binding gs://${STAGING_BUCKET} \\"
  note "         --project=${PROJECT_ID} --member=serviceAccount:${BUILD_SA} --role=roles/storage.objectViewer"
fi

step "the ops account (Cloud Scheduler)"
# Firestore export: the admin API call, plus write access to the backup bucket
# and nothing else.
bind_project_role "serviceAccount:${OPS_SA}" roles/datastore.importExportAdmin
bind_bucket_role "${BACKUP_BUCKET}" "serviceAccount:${OPS_SA}" roles/storage.objectCreator
# run.invoker is granted here so it is in place if and when a GC endpoint the
# scheduler can actually reach exists. Today it cannot — see 91-scheduler-gc.sh,
# which explains why and refuses to create a job that would 401 every night.
bind_project_role "serviceAccount:${OPS_SA}" roles/run.invoker

step "done"
note "next: infra/50-artifact-registry.sh"
