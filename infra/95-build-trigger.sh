#!/usr/bin/env bash
#
# STAGE D · continuous deploy — a commit goes green, and dev is running it;
#           a tag moves, and prod is running that.
#
# CREATES   one Cloud Build trigger on the GitHub repository, running
#           cloudbuild.yaml with _DEPLOY=yes. It fires on push to `green`
#           (dev) or on the `prod` tag (prod) — see ISOCAN_TRIGGER_TAG below.
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
# ═══ WHY `green` AND NOT `main` (phase 10.5) ═══
#
# This used to fire on push to `main`, which meant the deploy pipeline and the
# test pipeline raced: a commit that was green on somebody's laptop but red on
# CI reached dev.isocan.io anyway. With more than one developer pushing, that
# is one person taking down the other's dogfood home — and CI is precisely the
# machine that catches what local timing hides.
#
# `green` is a ref that means one thing: **the suite passed on this commit,
# with the Firestore emulator required.** `.github/workflows/release.yml`
# fast-forwards it after `npm test` and `npm run typecheck` pass, and nothing
# else ever writes it. A red commit never reaches this trigger at all.
#
# ═══ WHAT THIS TRIGGER IS NOT ═══
#
# It is not the `release` branch, and `green` is not a second one. `release` is
# REGENERATED CONTENT — scripts/release.mjs builds it, and
# `github:dglazkov/isocan#release` is what people install from — and both
# AGENTS.md and cloudbuild.yaml are explicit that it is not a gate and must
# never become one. `green` is not content at all: it is main's own commit,
# moved forward, and being a gate is its entire job.
#
# Three refs, three jobs: **main is the source, `green` is the tested source,
# `release` is the shipped CLI.** Two pipelines still run from the same
# commits — one ships a CLI, one deploys a home — and neither waits for the
# other; what changed is that both now start from a commit that passed.
#
# ═══ AND PROD: A TAG, NOT A BRANCH (phase 14) ═══
#
# Prod is this same file with a TAG pattern instead of a branch pattern. Set
# `ISOCAN_TRIGGER_TAG` (prod.env sets `^prod$`) and the create below asks for
# `--tag-pattern` instead of `--branch-pattern`; everything else — the build
# config, the substitutions, the build service account — is identical, because
# the difference between dev and prod is WHICH COMMIT, never which pipeline.
#
# **Why a tag and not a fourth branch.** `green` moves by itself: CI advances
# it on every commit whose suite passes, which is exactly right for a dogfood
# home and exactly wrong for the one strangers are on. The architecture asks
# that prod "promotes only by an explicit gesture", and a tag somebody moves is
# that gesture in its smallest form — one command, no ref that drifts while
# nobody is looking, and a name that reads as a decision in `git log`.
#
# The gesture, which is the whole promotion:
#
#   git tag -f prod green          # green, not main: only a CI-tested commit
#   git push -f origin prod
#
# `-f` on both because the tag MOVES; it is a pointer at the running commit,
# not a release marker that accumulates. What is running in prod is therefore
# always `git rev-parse prod`, and rolling back is the same two commands
# pointed at an older sha — no rebuild of anything, because the image for that
# sha is already in the registry under its own tag.
#
# **`green`, not `main`, is what a promotion may name**, for phase 10.5's
# reason twice over: a commit that is green on a laptop and red on CI must not
# reach the dogfood home, and it must certainly not reach prod. Nothing
# enforces that here — a tag can point anywhere — so it is written down where
# the person typing the command will read it.

source "$(dirname -- "${BASH_SOURCE[0]}")/lib/common.sh"
preflight
require_project
require_billing

TRIGGER="${ISOCAN_TRIGGER_NAME:-isocan-dev-deploy}"
REPO_OWNER="${ISOCAN_REPO_OWNER:-dglazkov}"
REPO_NAME="${ISOCAN_REPO_NAME:-isocan}"
# `green`, not `main` — see the note above. Overridable, because a project
# that wants the old racy behaviour (or a fork with no CI) can still say so out
# loud rather than editing this file.
BRANCH="${ISOCAN_TRIGGER_BRANCH:-^green$}"
# Set instead of a branch for a home promoted by a gesture — prod.env sets
# `^prod$`. Empty means this is a branch trigger, which is dev.
TAG_PATTERN="${ISOCAN_TRIGGER_TAG:-}"

if [ -n "${TAG_PATTERN}" ]; then
  FIRES_ON="tag ${TAG_PATTERN}"
  PATTERN_FLAG="--tag-pattern=${TAG_PATTERN}"
else
  FIRES_ON="push to ${BRANCH}"
  PATTERN_FLAG="--branch-pattern=${BRANCH}"
fi

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

confirm "create a trigger that deploys ${PROJECT_ID} on ${FIRES_ON}?"

# --name=, not a positional: `triggers create github` names the trigger with a
# flag, unlike most `create` verbs in gcloud. Measured, after it rejected the
# positional with "unrecognized arguments".
gcloud builds triggers create github \
  --name="${TRIGGER}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --repo-owner="${REPO_OWNER}" \
  --repo-name="${REPO_NAME}" \
  "${PATTERN_FLAG}" \
  --build-config=cloudbuild.yaml \
  --service-account="projects/${PROJECT_ID}/serviceAccounts/${BUILD_SA}" \
  --substitutions="_IMAGE=${IMAGE_REPO},_SERVICE=${SERVICE},_REGION=${REGION},_DEPLOY=yes,_TAG=\$SHORT_SHA" \
  --description="isocan: build and deploy ${SERVICE} on ${FIRES_ON}" >/dev/null
made "${TRIGGER} — ${FIRES_ON} deploys ${SERVICE}"

step "done"
if [ -n "${TAG_PATTERN}" ]; then
  note "nothing deploys until somebody moves the tag:  git tag -f prod green && git push -f origin prod"
  note "green, not main — only a commit CI has tested may be promoted."
else
  note "the next commit CI marks green will build, run the container's own boot check, and deploy."
fi
note "watch:  gcloud builds list --project=${PROJECT_ID} --region=${REGION} --limit=5"
note ""
note "Remember what a deploy IS here: the old revision drains while the new one starts,"
note "so for a few seconds two instances exist. That is the deploy overlap the"
note "architecture names, and ops/{seq}'s create-only precondition is what makes it safe."
note "The proof phase 5 owes is exactly this: ops written DURING a rollout, all in order."
