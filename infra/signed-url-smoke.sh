#!/usr/bin/env bash
#
# PHASE 5'S FIRST ACT — one command, three assertions.
#
# CREATES   one ~1 KiB object in gs://${BUCKET}, and deletes it again.
#           Nothing else. Fractions of a cent.
# COSTS     nothing measurable. Three PUTs and a DELETE.
# ASSUMES   30-bucket.sh and 40-service-account.sh ran.
# UNDO      nothing to undo — it cleans up after itself (--keep opts out).
#
# ═══ WHO THIS MUST RUN AS, AND WHY IT MATTERS MORE THAN IT SOUNDS ═══
#
# The third assertion is that a service account WITH NO PRIVATE KEY can sign —
# which is what the deployed home will be doing. A run signing with a
# downloaded key file proves nothing about that, so this script arranges to
# sign AS the runtime service account, through impersonation, which takes the
# same IAM signBlob path Cloud Run does.
#
# Your ordinary `gcloud auth application-default login` credential CANNOT SIGN
# AT ALL — it is a user, and a user has no service-account identity to sign as.
# The failure is a message about `client_email`, which reads like a bug. So:
#
#   gcloud auth application-default login \
#     --impersonate-service-account=isocan-run@PROJECT.iam.gserviceaccount.com
#
# and your own account needs roles/iam.serviceAccountTokenCreator ON that
# service account to be allowed to impersonate it (a different binding from the
# self-binding 40-service-account.sh makes — that one is the account on itself).
# This script offers to grant it.
#
# The other way to run it — and the one that proves the most, because it is
# literally the deployed identity in the deployed environment:
#
#   gcloud run services proxy … , or a one-off `gcloud run jobs`, or simply
#   read the result of the same script running as part of a future deploy.
#   Until then, impersonation is the closest honest thing.

source "$(dirname -- "${BASH_SOURCE[0]}")/lib/common.sh"
preflight
require_project

step "who will sign"
ADC="${GOOGLE_APPLICATION_CREDENTIALS:-${CLOUDSDK_CONFIG:-$HOME/.config/gcloud}/application_default_credentials.json}"
if [ ! -f "${ADC}" ]; then
  human "no application-default credential at ${ADC}"
  note "run:  gcloud auth application-default login --impersonate-service-account=${RUNTIME_SA}"
  die "nothing to sign with"
fi

ADC_TYPE="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("type","?"))' "${ADC}" 2>/dev/null || echo "?")"
case "${ADC_TYPE}" in
  impersonated_service_account)
    note "impersonated credential — this is the run that proves assertion 3" ;;
  service_account)
    warn "a downloaded KEY FILE. Assertions 1 and 2 will be real; assertion 3 will read UNPROVEN,"
    warn "because a key file signs locally and the deployed service has no key." ;;
  authorized_user)
    human "your credential is a plain user login. It cannot sign — not a bug, a fact about users."
    note "run:  gcloud auth application-default login --impersonate-service-account=${RUNTIME_SA}"
    note "and if that is refused, grant yourself the right to impersonate:"
    note "  gcloud iam service-accounts add-iam-policy-binding ${RUNTIME_SA} \\"
    note "    --project=${PROJECT_ID} --member=\"user:\$(gcloud config get-value account)\" \\"
    note "    --role=roles/iam.serviceAccountTokenCreator"
    die "stopping before a confusing error about client_email" ;;
  *)
    warn "credential type '${ADC_TYPE}' — the script will say what it could and could not establish" ;;
esac

step "running"
cd "${REPO_ROOT}"
[ -d node_modules ] || die "no node_modules — run \`npm ci\` in ${REPO_ROOT} first"

set +e
node --import tsx packages/cloudstore/scripts/signed-url-smoke.ts \
  --bucket="${BUCKET}" \
  --project="${PROJECT_ID}" \
  "$@"
STATUS=$?
set -e

case "${STATUS}" in
  0) made "all three assertions PASS — the signed-URL branch is proven in production conditions" ;;
  3) warn "no failures, but not all three are proven. Read the RECORD above; an UNPROVEN is not a pass." ;;
  *) die  "at least one assertion FAILED — see the RECORD above" ;;
esac
exit "${STATUS}"
