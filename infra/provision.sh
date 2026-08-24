#!/usr/bin/env bash
#
# Run a stage. Not the whole thing — there is no "provision everything" here on
# purpose, because the stages are the decisions and running them all at once
# would be answering four questions with one keystroke.
#
#   ./provision.sh a     the home        → a real hosted home at *.run.app
#   ./provision.sh b     the front door  → dev.isocan.io, CDN, cert (+~$18/mo)
#   ./provision.sh c     the keeping     → backups, uptime check
#   ./provision.sh d     continuous deploy
#
# Every script it calls is idempotent, so re-running a stage after fixing one
# thing is the normal way to use this, not a repair.

source "$(dirname -- "${BASH_SOURCE[0]}")/lib/common.sh"

STAGE="${1:-}"
case "${STAGE}" in
  a|A) SCRIPTS=(10-project.sh 20-firestore.sh 30-bucket.sh 40-service-account.sh 50-artifact-registry.sh 60-build-image.sh 70-cloud-run.sh) ;;
  b|B) SCRIPTS=(80-load-balancer.sh 81-cert-status.sh) ;;
  c|C) SCRIPTS=(90-backup-export.sh 92-uptime-check.sh) ;;
  d|D) SCRIPTS=(95-build-trigger.sh) ;;
  e|E) SCRIPTS=(100-identity-platform.sh) ;;
  *)
    cat <<USAGE
usage: $0 <stage>

  a   THE HOME            project, APIs, Firestore, buckets, service accounts,
                          Artifact Registry, first image, Cloud Run.
                          Ends with a working home at an ugly *.run.app URL.
                          Costs at rest with nobody visiting: \$0/month.

  b   THE FRONT DOOR      static IP, load balancer, Cloud CDN, managed cert.
                          Ends needing you to add a DNS A record.
                          Costs at rest with nobody visiting: ~\$18/month.

  c   THE KEEPING         nightly Firestore export, uptime check.
                          Costs at rest: cents.
                          (GC needs no job — the daemon sweeps itself on a
                          timer; infra/91-scheduler-gc.sh says why.)

  d   CONTINUOUS DEPLOY   Cloud Build trigger on push to \`green\` — the ref
                          CI advances when the suite passes.
                          Needs a browser step first. Costs: \$0 until you push.

  e   THE ATTESTERS       Identity Platform: email-link sign-in as the floor,
                          so a badge can prove an attribute a grant names.
                          Google and GitHub need OAuth apps you create.
                          Costs at rest: \$0 (49,999 free monthly users).

Read infra/README.md before stage a. It is the decision, this is the button.
USAGE
    exit 2 ;;
esac

step "stage ${STAGE}: ${#SCRIPTS[@]} scripts, in order"
for s in "${SCRIPTS[@]}"; do note "  ${s}"; done

for s in "${SCRIPTS[@]}"; do
  printf '\n%s────────────────────────────────────────────────────────%s\n' "${_dim}" "${_off}"
  step "${s}"
  # 81-cert-status.sh exits non-zero while the certificate is still
  # provisioning, which is not a failure of the stage — it is the stage's last
  # word being "now go add a DNS record".
  if [ "${s}" = "81-cert-status.sh" ]; then
    "${INFRA_DIR}/${s}" || true
  else
    "${INFRA_DIR}/${s}"
  fi
done

step "stage ${STAGE} complete"
