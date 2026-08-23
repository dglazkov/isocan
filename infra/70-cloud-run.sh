#!/usr/bin/env bash
#
# STAGE A · 7 of 7 — the home itself.
#
# CREATES   the Cloud Run service `${SERVICE}` in ${REGION}, running as
#           ${RUNTIME_SA}, with the cloud backing configured from the
#           environment; and an allUsers invoker binding, because the door is
#           the public front door.
# COSTS     with ISOCAN_MIN_INSTANCES=0 (the dev default) and nobody visiting:
#           **$0/mo.** No instance exists, so nothing is billed.
#           While an instance is alive: ~$0.072/hour for 1 vCPU + 1 GiB with
#           CPU always allocated, and an idle instance lingers ~15 minutes
#           after the last request before it goes away. Cloud Run's monthly
#           free tier (180,000 vCPU-seconds, 360,000 GiB-seconds) covers
#           roughly the first 50 hours of that, so ordinary dev use is very
#           likely $0.
#           With min-instances=1 (what prod will want) it is always alive:
#           ~$48/month, every month, whether or not anyone visits.
# ASSUMES   40-service-account.sh and 60-build-image.sh ran, and an image
#           exists at ${IMAGE_REPO}:${ISOCAN_IMAGE_TAG:-latest}.
# UNDO      `gcloud run services delete ${SERVICE} --region=${REGION}`.
#           Completely clean — a deleted service bills nothing and leaves
#           nothing behind but the images, which the registry policy sweeps.
#
# ═══ THIS IS THE STAGE-A STOPPING POINT ═══
#
# When this finishes you have a real hosted home at an ugly
# https://isocan-XXXXXXXX.${REGION}.run.app URL, with a real Firestore behind
# it and a real bucket beside it. Everything after this — the domain, the CDN,
# the load balancer, the backups, the uptime check — is a separate decision
# and a separate bill. Stop here and look at it before deciding any of them.

source "$(dirname -- "${BASH_SOURCE[0]}")/lib/common.sh"
preflight
require_project
require_billing

TAG="${ISOCAN_IMAGE_TAG:-latest}"
IMAGE="${IMAGE_REPO}:${TAG}"

step "checking the image"
exists gcloud artifacts docker images describe "${IMAGE}" --project="${PROJECT_ID}" \
  || die "no image at ${IMAGE} — run infra/60-build-image.sh first"
have "${IMAGE}"

# The service's environment, in one place so it can be read as a list rather
# than picked out of a command line.
#
# ISOCAN_STORE=cloud            which disk. Environment, never a flag.
# ISOCAN_GCP_PROJECT            passed explicitly rather than left to ADC's
#                               inference, so a mis-scoped credential fails
#                               loudly instead of writing somewhere else.
# ISOCAN_BUCKET                 blobs, snapshots, oplog archive.
# ISOCAN_BIND=0.0.0.0           the container must be reachable from outside
#                               itself or the startup probe fails. Also what
#                               turns OFF `http.ts`'s localhost-trust clause.
# ISOCAN_HOME=/tmp/isocan       scratch. Nothing durable lives here on the
#                               cloud backing.
# ISOCAN_ALLOWED_ORIGINS        strict mode for the Origin check. The service
#                               already accepts its own Host as an origin, so
#                               the run.app URL keeps working; naming the
#                               domain here is what makes the rule explicit
#                               rather than emergent.
ENV_VARS="ISOCAN_STORE=cloud"
ENV_VARS="${ENV_VARS},ISOCAN_GCP_PROJECT=${PROJECT_ID}"
ENV_VARS="${ENV_VARS},ISOCAN_BUCKET=${BUCKET}"
ENV_VARS="${ENV_VARS},ISOCAN_BIND=0.0.0.0"
ENV_VARS="${ENV_VARS},ISOCAN_HOME=/tmp/isocan"
ENV_VARS="${ENV_VARS},ISOCAN_ALLOWED_ORIGINS=https://${DOMAIN}"

step "deploying ${SERVICE}"
note "min=${MIN_INSTANCES} max=${MAX_INSTANCES} cpu=${CPU} memory=${MEMORY} concurrency=${CONCURRENCY} timeout=${REQUEST_TIMEOUT}s"

# `gcloud run deploy` is idempotent by construction: it creates the service if
# absent and adds a revision if present. Every flag is re-stated on every run,
# which is what makes this file — not the console — the description of the
# service.
#
# --max-instances=1 is the single-writer promise as a flag, AND IT DOES NOT
# MEAN ONE PROCESS: max-instances is per revision, so during a rollout the
# draining old revision and the new one both have one. That is the deploy
# overlap the architecture names; `ops/{seq}`'s create-only precondition is
# what makes it safe, and no flag here should try to prevent it.
#
# --no-cpu-throttling: CPU always allocated. The daemon is not a request
# handler — it holds WebSockets, sweeps presence on a TTL, and flushes a
# debounced snapshot on a timer. A throttled instance's timers do not run
# between requests.
#
# --timeout=3600 is Cloud Run's maximum and cannot be raised. A socket that
# reaches it drops and reconnects by seq cursor, which is journey rule 4.
#
# --execution-environment=gen2: a full Linux sandbox rather than gVisor —
# needed for the network and filesystem behaviour a long-lived socket server
# expects, and the only one where memory over 4 GiB is even available later.
gcloud run deploy "${SERVICE}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --image="${IMAGE}" \
  --service-account="${RUNTIME_SA}" \
  --min-instances="${MIN_INSTANCES}" \
  --max-instances="${MAX_INSTANCES}" \
  --cpu="${CPU}" \
  --memory="${MEMORY}" \
  --no-cpu-throttling \
  --concurrency="${CONCURRENCY}" \
  --timeout="${REQUEST_TIMEOUT}" \
  --port="${CONTAINER_PORT}" \
  --execution-environment=gen2 \
  --ingress=all \
  --set-env-vars="${ENV_VARS}" \
  --quiet

made "revision deployed from ${IMAGE}"

step "the public door"
# The door is open by design — "the address admits", and getting a badge is
# free. So the Cloud Run service itself must not ask for a Google identity;
# the badge is the credential isocan issues, and Cloud Run IAM knows nothing
# about badges.
#
# THIS IS THE COMMAND MOST LIKELY TO FAIL IN AN ORGANIZATION. Google turns on
# the Domain Restricted Sharing org policy
# (constraints/iam.allowedPolicyMemberDomains) by default for organizations,
# and it forbids granting anything to `allUsers`. The failure message names the
# constraint but not the fix, so the fix is here.
if gcloud run services add-iam-policy-binding "${SERVICE}" \
     --project="${PROJECT_ID}" --region="${REGION}" \
     --member="allUsers" --role="roles/run.invoker" >/dev/null 2>&1; then
  made "allUsers -> roles/run.invoker"
else
  warn "could not grant allUsers roles/run.invoker."
  warn "almost certainly the Domain Restricted Sharing org policy on organization ${ORG_ID}."
  note "check:  gcloud resource-manager org-policies describe constraints/iam.allowedPolicyMemberDomains --organization=${ORG_ID} --effective"
  note "to allow public services in THIS PROJECT ONLY (not the whole org):"
  note "  cat > /tmp/drs.yaml <<'YAML'"
  note "  constraint: constraints/iam.allowedPolicyMemberDomains"
  note "  listPolicy: {allValues: ALLOW}"
  note "  YAML"
  note "  gcloud resource-manager org-policies set-policy /tmp/drs.yaml --project=${PROJECT_ID}"
  note "then re-run this script. It needs roles/orgpolicy.policyAdmin on the org or the project."
  die "the home is deployed but nobody outside can reach it — see above"
fi

URL="$(gcloud run services describe "${SERVICE}" --project="${PROJECT_ID}" \
  --region="${REGION}" --format='value(status.url)')"

step "does it answer?"
# Not a claim, a check. `/api/healthz` is open by design (the LB probes it and
# the door cannot ask for what it hands out), so this needs no badge.
#
# It is `/api/healthz` and NOT `/healthz` because Google's frontend swallows
# that exact path on a *.run.app host and answers a branded 404 of its own; the
# container never sees the request. This check used to curl `/healthz` and so
# ended Stage A with "deployed, but not serving" on a home that was serving
# perfectly. `/healthz` is untouched and still what localhost uses; see the
# health-path note in README.md's Stage C.
if curl -fsS --max-time 30 "${URL}/api/healthz"; then
  printf '\n'
  made "the home answers at ${URL}"
else
  warn "no answer from ${URL}/api/healthz"
  note "logs: gcloud run services logs read ${SERVICE} --project=${PROJECT_ID} --region=${REGION} --limit=100"
  die "deployed, but not serving"
fi

step "STAGE A IS DONE"
note "Open ${URL} in a browser. That is a real home on a real Firestore."
note ""
note "Before deciding about the domain, run the proof phase 4 could not:"
note "  infra/signed-url-smoke.sh"
note ""
note "Stage B (the domain, the CDN, the load balancer) is infra/80-load-balancer.sh."
note "It is the first thing that bills money while nobody is looking: ~\$18/month, always."
