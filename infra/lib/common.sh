# Shared plumbing for the provisioning scripts. Sourced, never run.
#
# Two jobs, and the second is the important one:
#
#  1. Load config.sh and give every script the same vocabulary for saying
#     "made this" / "already there" / "cannot continue".
#  2. FENCE THE AMBIENT CONFIG. `gcloud` reads a project and a region from
#     ~/.config/gcloud unless told otherwise, and on the machine this was
#     written for those are `dandy-horse-3` and `us-central1`. A script that
#     inherited them would build a working home in a stranger's project and say
#     nothing. So: CLOUDSDK_* overrides exported here, `--project` and an
#     explicit location on every command, and a preflight that prints what it
#     is about to touch.

set -euo pipefail

INFRA_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd -- "${INFRA_DIR}/.." && pwd)"

# shellcheck source=../config.sh
source "${INFRA_DIR}/config.sh"

# The belt. Explicit flags are the braces, and both are worn.
export CLOUDSDK_CORE_PROJECT="${PROJECT_ID}"
export CLOUDSDK_COMPUTE_REGION="${REGION}"
export CLOUDSDK_RUN_REGION="${REGION}"
export CLOUDSDK_ARTIFACTS_LOCATION="${REGION}"
# Never let a prompt block a script that is meant to be re-runnable.
export CLOUDSDK_CORE_DISABLE_PROMPTS=1

# ---- saying things ----

if [ -t 1 ]; then
  _dim=$'\033[2m'; _bold=$'\033[1m'; _red=$'\033[31m'; _green=$'\033[32m'; _yellow=$'\033[33m'; _off=$'\033[0m'
else
  _dim=""; _bold=""; _red=""; _green=""; _yellow=""; _off=""
fi

step()  { printf '\n%s==>%s %s\n' "${_bold}" "${_off}" "$*"; }
made()  { printf '  %s+%s %s\n' "${_green}" "${_off}" "$*"; }
have()  { printf '  %s=%s %s %s(already there)%s\n' "${_dim}" "${_off}" "$*" "${_dim}" "${_off}"; }
note()  { printf '  %s·%s %s\n' "${_dim}" "${_off}" "$*"; }
warn()  { printf '  %s!%s %s\n' "${_yellow}" "${_off}" "$*" >&2; }
human() { printf '  %s\xe2\x9c\x8b HUMAN:%s %s\n' "${_yellow}" "${_off}" "$*"; }
die()   { printf '\n  %sx%s %s\n\n' "${_red}" "${_off}" "$*" >&2; exit 1; }

# ---- the preflight ----
#
# Every script calls this first. It is cheap, it is read-only, and it is the
# thing that turns "I ran the wrong script against the wrong project" from a
# discovery into a decision.
preflight() {
  command -v gcloud >/dev/null 2>&1 || die "no gcloud on PATH — install the Google Cloud SDK"
  gcloud auth print-access-token >/dev/null 2>&1 \
    || die "gcloud is not authenticated (or the token expired) — run: gcloud auth login"

  # Read the ambient config with our own overrides UNSET, in a subshell.
  # Asking `gcloud config get-value project` with CLOUDSDK_CORE_PROJECT
  # exported just reads our own override back and always agrees with itself —
  # which would make this check permanently silent, and silent is the one thing
  # it must not be.
  local ambient ambient_region
  ambient="$(unset CLOUDSDK_CORE_PROJECT; gcloud config get-value project 2>/dev/null || true)"
  ambient_region="$(unset CLOUDSDK_RUN_REGION CLOUDSDK_COMPUTE_REGION; gcloud config get-value run/region 2>/dev/null || true)"
  note "project ${_bold}${PROJECT_ID}${_off}   region ${_bold}${REGION}${_off}"
  if [ -n "${ambient}" ] && [ "${ambient}" != "${PROJECT_ID}" ] && [ "${ambient}" != "(unset)" ]; then
    note "(your gcloud config says project=${ambient} — ignored; every command below names ${PROJECT_ID})"
  fi
  if [ -n "${ambient_region}" ] && [ "${ambient_region}" != "${REGION}" ] && [ "${ambient_region}" != "(unset)" ]; then
    note "(your gcloud config says run/region=${ambient_region} — ignored; every command below names ${REGION})"
  fi
}

# Nothing below stage A's first script can succeed without billing, and the
# error Google returns when it is missing names the billing account rather than
# the fix: "the billing account for the owning project is disabled in state
# absent". Say the fix instead, once, up front.
require_billing() {
  local linked
  linked="$(gcloud billing projects describe "${PROJECT_ID}" \
    --format='value(billingEnabled)' 2>/dev/null || true)"
  [ "${linked}" = "True" ] && return 0
  warn "project ${PROJECT_ID} has no billing account linked."
  note "every create below will be refused with a 403 that talks about billing state."
  note "fix:  gcloud billing projects link ${PROJECT_ID} --billing-account=${BILLING_ACCOUNT}"
  note "or:   infra/10-project.sh   (which does exactly that, and asks first)"
  die "stopping before a run of confusing 403s"
}

# The project must exist before anything can be put in it. 10-project.sh is the
# one script that does not call this.
require_project() {
  gcloud projects describe "${PROJECT_ID}" >/dev/null 2>&1 \
    || die "project ${PROJECT_ID} does not exist — run infra/10-project.sh first"
}

# ---- idempotency ----
#
# `exists <description> <command...>` — run a read-only describe, swallow its
# output, and answer with an exit code. Every create in this directory is
# guarded by one of these, which is what makes a half-finished provisioning run
# resumable rather than restartable.
exists() {
  "$@" >/dev/null 2>&1
}

# Ask before something that costs real money every month whether or not anyone
# visits. ISOCAN_YES=1 skips (for a second run, or for CI that will never
# exist here).
confirm() {
  local prompt="$1"
  if [ "${ISOCAN_YES:-0}" = "1" ]; then
    note "ISOCAN_YES=1 — proceeding: ${prompt}"
    return 0
  fi
  printf '\n  %s%s%s\n  type "yes" to proceed: ' "${_bold}" "${prompt}" "${_off}"
  local answer
  read -r answer </dev/tty
  [ "${answer}" = "yes" ] || die "stopped at your request — nothing was created"
}

# IAM bindings are idempotent server-side (adding a member twice is a no-op),
# but they are also the noisiest command in the SDK. Quiet them and say one
# line instead.
bind_project_role() {
  local member="$1" role="$2"
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --project="${PROJECT_ID}" \
    --member="${member}" --role="${role}" \
    --condition=None >/dev/null
  made "${role} -> ${member}"
}

bind_bucket_role() {
  local bucket="$1" member="$2" role="$3"
  gcloud storage buckets add-iam-policy-binding "gs://${bucket}" \
    --project="${PROJECT_ID}" \
    --member="${member}" --role="${role}" >/dev/null
  made "${role} on gs://${bucket} -> ${member}"
}
