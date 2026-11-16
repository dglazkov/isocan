#!/usr/bin/env bash

# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

#
# STAGE A · 5 of 7 — where the image lives.
#
# CREATES   an Artifact Registry Docker repository `${AR_REPO}` in ${REGION},
#           plus a cleanup policy that keeps the last 10 images.
# COSTS     first 0.5 GiB free, then ~$0.10/GiB-month. The isocan image is
#           roughly 400–600 MiB, and every deploy pushes a new one — WITHOUT a
#           cleanup policy this is the line item that grows forever while
#           nobody looks at it. With the policy below: **~$0.05/mo**, and it
#           stays there.
# ASSUMES   10-project.sh ran.
# UNDO      `gcloud artifacts repositories delete ${AR_REPO} --location=${REGION}`.
#           Clean: it takes the images with it and leaves nothing behind.

source "$(dirname -- "${BASH_SOURCE[0]}")/lib/common.sh"
preflight
require_project
require_billing

step "Artifact Registry"
if exists gcloud artifacts repositories describe "${AR_REPO}" \
    --location="${REGION}" --project="${PROJECT_ID}"; then
  have "${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}"
else
  gcloud artifacts repositories create "${AR_REPO}" \
    --project="${PROJECT_ID}" \
    --location="${REGION}" \
    --repository-format=docker \
    --description="isocan home images" >/dev/null
  made "${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}"
fi

step "cleanup policy"
# `keep-recent-versions` keeps the newest N and deletes the rest. Ten is a
# month of daily deploys' worth of rollback targets — more than the number of
# revisions Cloud Run will ever be asked to roll back to, and small enough that
# storage stops growing.
#
# The policy is applied every run rather than checked first: set-cleanup-policies
# REPLACES the policy file wholesale, so applying the same file twice is
# genuinely idempotent.
POLICY_JSON="$(mktemp)"
cat >"${POLICY_JSON}" <<'JSON'
[
  {
    "name": "keep-last-10",
    "action": {"type": "Keep"},
    "mostRecentVersions": {"keepCount": 10}
  },
  {
    "name": "delete-the-rest",
    "action": {"type": "Delete"},
    "condition": {"olderThan": "30d"}
  }
]
JSON
gcloud artifacts repositories set-cleanup-policies "${AR_REPO}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --policy="${POLICY_JSON}" >/dev/null
rm -f "${POLICY_JSON}"
made "keep the 10 most recent images; delete anything else older than 30 days"

step "done"
note "next: infra/60-build-image.sh"
