#!/usr/bin/env bash
#
# STAGE A · 6 of 7 — build the first image, from THIS checkout.
#
# CREATES   one container image, tagged with the current git sha and `latest`,
#           in the Artifact Registry repo. Nothing else.
# COSTS     Cloud Build's default pool gives 2,500 free build-minutes a month
#           (e2-standard-2). This build is a few minutes. **$0** in practice;
#           beyond the free tier, ~$0.006/build-minute.
#           The image itself is billed by 50-artifact-registry.sh's line.
# ASSUMES   50-artifact-registry.sh ran; you are in a git checkout of isocan;
#           `Dockerfile` and `.dockerignore` are at the repo root.
# UNDO      `gcloud artifacts docker images delete …`, or nothing — the
#           cleanup policy sweeps it.
#
# WHY THIS EXISTS SEPARATELY FROM THE BUILD TRIGGER (95-build-trigger.sh):
# a trigger needs the GitHub repository connected to Cloud Build, which is a
# browser OAuth flow — a human, a consent screen, and an app installation. That
# is a fine thing to do, but it should not stand between you and finding out
# whether the home boots at all. `gcloud builds submit` uploads this working
# tree and needs no GitHub connection whatsoever. So: first image from your
# laptop, continuous deploy later, and the decision about GitHub is its own
# decision.

source "$(dirname -- "${BASH_SOURCE[0]}")/lib/common.sh"
preflight
require_project
require_billing

cd "${REPO_ROOT}"

[ -f Dockerfile ] || die "no Dockerfile at ${REPO_ROOT} — this script builds the repo root"

SHA="$(git rev-parse --short=12 HEAD 2>/dev/null || echo "nogit-$(date +%Y%m%d%H%M%S)")"
DIRTY=""
if ! git diff --quiet HEAD 2>/dev/null; then DIRTY=" (working tree is DIRTY — this image is not any commit)"; fi

step "build ${IMAGE_REPO}:${SHA}"
note "source: ${REPO_ROOT}${DIRTY}"
note "uploaded by gcloud, minus everything .dockerignore and .gcloudignore exclude"

# --default-buckets-behavior=regional-user-owned-bucket: newer Cloud Build
# requires a build using a user-specified service account to own its source
# staging bucket, rather than sharing Google's. Without it the submit fails
# with a message about the legacy staging bucket that reads like a permissions
# problem and is not one.
gcloud builds submit \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --config=cloudbuild.yaml \
  --service-account="projects/${PROJECT_ID}/serviceAccounts/${BUILD_SA}" \
  --default-buckets-behavior=regional-user-owned-bucket \
  --substitutions="_IMAGE=${IMAGE_REPO},_TAG=${SHA},_SERVICE=${SERVICE},_REGION=${REGION},_DEPLOY=no"

made "${IMAGE_REPO}:${SHA}"
made "${IMAGE_REPO}:latest"

step "done"
note "next: ISOCAN_IMAGE_TAG=${SHA} infra/70-cloud-run.sh"
note "(70-cloud-run.sh defaults to :latest if you do not pass a tag — pinning the sha is the honest habit.)"
