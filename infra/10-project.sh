#!/usr/bin/env bash
#
# STAGE A · 1 of 7 — the project, its billing link, and the APIs.
#
# CREATES   one GCP project (${PROJECT_ID}); links it to a billing account;
#           enables ~16 service APIs on it.
# COSTS     nothing. A project with nothing in it is free, enabled APIs are
#           free, and a billing link by itself charges nothing. Everything on
#           this page is $0/mo until a later script puts something in it.
# ASSUMES   you are authenticated as someone with
#           roles/resourcemanager.projectCreator on organization ${ORG_ID}
#           (glazkov.com) and roles/billing.user on billing account
#           ${BILLING_ACCOUNT}.
# UNDO      `gcloud projects delete ${PROJECT_ID}`. It is reversible for 30
#           days and then permanent — and the PROJECT ID IS NEVER REUSABLE,
#           by you or by anyone, ever.
#
# The project id is globally unique across all of Google Cloud, so
# `isocan-dev` may already belong to a stranger. If it does, this script fails
# on the create with "requested entity already exists" — set
# ISOCAN_GCP_PROJECT to something free (e.g. isocan-dev-7f3a) and re-run.
# See README.md, "When a name is taken".

source "$(dirname -- "${BASH_SOURCE[0]}")/lib/common.sh"
preflight

# The APIs, each with the reason it is on. An API nobody can name is an API
# nobody should enable.
APIS=(
  cloudresourcemanager.googleapis.com  # project + IAM policy reads and writes
  serviceusage.googleapis.com          # enabling the rest of this list
  iam.googleapis.com                   # service accounts
  iamcredentials.googleapis.com        # signBlob — THE signed-URL path (debt 1)
  firestore.googleapis.com             # the oplog and the desk
  storage.googleapis.com               # blobs, snapshots, oplog archive
  run.googleapis.com                   # the home
  artifactregistry.googleapis.com      # where the image lives
  cloudbuild.googleapis.com            # what builds it
  compute.googleapis.com               # the load balancer, the static IP, the cert
  cloudscheduler.googleapis.com        # GC and the Firestore export
  monitoring.googleapis.com            # the uptime check
  logging.googleapis.com               # Cloud Logging
  clouderrorreporting.googleapis.com   # Error Reporting
  secretmanager.googleapis.com         # phase 7+ credentials; nothing stored yet
  cloudkms.googleapis.com              # phase 9 launch-token wrap; no key created yet
)

step "project ${PROJECT_ID}"
if exists gcloud projects describe "${PROJECT_ID}"; then
  have "project ${PROJECT_ID}"
else
  confirm "create the GCP project ${PROJECT_ID} under organization ${ORG_ID}? (the id is permanent and can never be reused)"
  # The parent is EXPLICIT. A `projects create` with no parent makes a
  # standalone project outside the org — which works, bills the same, and is
  # then invisible to every org-level policy and every org-level bill review.
  # ISOCAN_PROJECT_PARENT overrides with a folder id if the org ever grows
  # folders.
  if [ -n "${ISOCAN_PROJECT_PARENT:-}" ]; then
    gcloud projects create "${PROJECT_ID}" \
      --name="isocan ${PROJECT_ID##*-}" \
      --folder="${ISOCAN_PROJECT_PARENT}"
  else
    gcloud projects create "${PROJECT_ID}" \
      --name="isocan ${PROJECT_ID##*-}" \
      --organization="${ORG_ID}"
  fi
  made "project ${PROJECT_ID} under organization ${ORG_ID}"
fi

step "billing"
CURRENT_BILLING="$(gcloud billing projects describe "${PROJECT_ID}" \
  --format='value(billingAccountName)' 2>/dev/null || true)"
if [ -n "${CURRENT_BILLING}" ]; then
  have "billing account ${CURRENT_BILLING##*/}"
elif [ -n "${BILLING_ACCOUNT}" ]; then
  confirm "link ${PROJECT_ID} to billing account ${BILLING_ACCOUNT}? THIS IS A PERSONAL CARD — everything created after this point charges it."
  gcloud billing projects link "${PROJECT_ID}" \
    --billing-account="${BILLING_ACCOUNT}" >/dev/null
  made "billing account ${BILLING_ACCOUNT}"
else
  human "no billing account is linked, and nothing below this line can be enabled without one."
  note  "list yours:  gcloud billing accounts list"
  note  "then re-run: ISOCAN_BILLING_ACCOUNT=XXXXXX-XXXXXX-XXXXXX $0"
  die   "billing is a human decision — stopping here rather than guessing which account pays"
fi

step "APIs"
# One list call, then enable only what is missing: `services enable` on an
# already-enabled API is a no-op but takes a round trip each, and there are 16.
ENABLED="$(gcloud services list --enabled --project="${PROJECT_ID}" --format='value(config.name)')"
MISSING=()
for api in "${APIS[@]}"; do
  if printf '%s\n' "${ENABLED}" | grep -qx "${api}"; then
    have "${api}"
  else
    MISSING+=("${api}")
  fi
done
if [ ${#MISSING[@]} -gt 0 ]; then
  # Enabling in one call is both faster and how the dependency ordering between
  # them gets resolved for us.
  gcloud services enable "${MISSING[@]}" --project="${PROJECT_ID}"
  for api in "${MISSING[@]}"; do made "${api}"; done
fi

step "done"
note "next: infra/20-firestore.sh"
note "NOTE the one-way door in that script — a Firestore database's location is permanent."
