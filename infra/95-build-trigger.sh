#!/usr/bin/env bash
#
# STAGE D · continuous deploy — push to main, and dev is running it.
#
# CREATES   one Cloud Build trigger on the GitHub repository, firing on push
#           to `main`, running cloudbuild.yaml with _DEPLOY=yes.
# COSTS     Cloud Build's default pool includes 2,500 free build-minutes a
#           month. A build here is a few minutes, so a busy day of pushes is
#           still free; beyond the free tier, ~$0.006/build-minute. The images
#           it produces are swept by 50-artifact-registry.sh's cleanup policy.
#           **~$0/mo**, and it cannot surprise you: builds only happen when you
#           push.
# ASSUMES   Stage A finished, AND the GitHub repository is connected to Cloud
#           Build — which is a browser step, see below.
# UNDO      `gcloud builds triggers delete <name> --region=${REGION}`. Clean.
#           Disconnecting the GitHub app is separate and also clean.
#
# ═══ THE HUMAN STEP THIS CANNOT DO ═══
#
# A trigger needs a CONNECTION between this GCP project and the GitHub
# repository, and creating one means installing the Google Cloud Build GitHub
# App on the repo and consenting in a browser. There is no gcloud command that
# clicks through an OAuth screen.
#
#   https://console.cloud.google.com/cloud-build/triggers/connect?project=PROJECT
#
# Pick "GitHub (Cloud Build GitHub App)", authorize, and select the repository.
# Do it in the SAME REGION as everything else, or the trigger will not find it.
#
# This is deliberately Stage D and not part of Stage A: `infra/60-build-image.sh`
# builds from your working tree with no GitHub involvement at all, so you can
# have a running home before deciding whether you want Google reading your
# repository.
#
# ═══ WHAT THIS TRIGGER IS NOT ═══
#
# It is not the `release` branch. CI regenerates that from every commit on main
# as the CLI's distribution branch — `github:dglazkov/isocan#release` is what
# people install from — and AGENTS.md is explicit that it is not a gate.
# Two different pipelines from the same commits: one ships a CLI, one deploys a
# home. Neither waits for the other.
#
# PROD, when it exists, is the same file with a tag pattern instead of a branch
# pattern: `--tag-pattern='^prod$'`, a tag somebody moves deliberately. The
# architecture's "promotes only by an explicit gesture".

source "$(dirname -- "${BASH_SOURCE[0]}")/lib/common.sh"
preflight
require_project
require_billing

TRIGGER="${ISOCAN_TRIGGER_NAME:-isocan-dev-deploy}"
REPO_OWNER="${ISOCAN_REPO_OWNER:-dglazkov}"
REPO_NAME="${ISOCAN_REPO_NAME:-isocan}"
BRANCH="${ISOCAN_TRIGGER_BRANCH:-^main$}"

step "is the repository connected?"
# There are TWO connection generations and they do not see each other. The
# console's "GitHub (Cloud Build GitHub App)" flow — the one this file tells
# you to use, and the one `triggers create github --repo-owner/--repo-name`
# below consumes — is 1st gen, and 1st-gen links appear in NEITHER
# `gcloud builds connections list` NOR `gcloud builds repositories list`;
# those are 2nd gen (Developer Connect) only.
#
# This check used to call `builds repositories list` and die when it came back
# empty, which it always does for a correctly connected 1st-gen repo. The
# script would have refused forever no matter what you connected. There is no
# 1st-gen "list what is linked" command, so the honest check is to ATTEMPT the
# create and read the failure — a missing connection fails fast and says so.
note "1st-gen (GitHub App) links are not listable; the create below is the check."

step "trigger ${TRIGGER}"
if exists gcloud builds triggers describe "${TRIGGER}" --project="${PROJECT_ID}" --region="${REGION}"; then
  have "${TRIGGER}"
  note "delete and re-run to change it — a trigger's source cannot be edited in place from here."
  exit 0
fi

confirm "create a trigger that deploys ${PROJECT_ID} on every push to main?"

# --name=, not a positional: `triggers create github` names the trigger with a
# flag, unlike most `create` verbs in gcloud. Measured, after it rejected the
# positional with "unrecognized arguments".
gcloud builds triggers create github \
  --name="${TRIGGER}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --repo-owner="${REPO_OWNER}" \
  --repo-name="${REPO_NAME}" \
  --branch-pattern="${BRANCH}" \
  --build-config=cloudbuild.yaml \
  --service-account="projects/${PROJECT_ID}/serviceAccounts/${BUILD_SA}" \
  --substitutions="_IMAGE=${IMAGE_REPO},_SERVICE=${SERVICE},_REGION=${REGION},_DEPLOY=yes,_TAG=\$SHORT_SHA" \
  --description="isocan: build and deploy ${SERVICE} on push to main" >/dev/null
made "${TRIGGER} — push to main deploys ${SERVICE}"

step "done"
note "the next push to main will build, run the container's own boot check, and deploy."
note "watch:  gcloud builds list --project=${PROJECT_ID} --region=${REGION} --limit=5"
note ""
note "Remember what a deploy IS here: the old revision drains while the new one starts,"
note "so for a few seconds two instances exist. That is the deploy overlap the"
note "architecture names, and ops/{seq}'s create-only precondition is what makes it safe."
note "The proof phase 5 owes is exactly this: ops written DURING a rollout, all in order."
