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
# ISOCAN_AUTH_PROJECT           the Identity Platform project a presented ID
# ISOCAN_AUTH_API_KEY           token is checked against, and the browser key
#                               the page starts a sign-in with. Added only if
#                               100-identity-platform.sh has run — see below.
# ISOCAN_PROXY_HOPS             how many trailing X-Forwarded-For entries this
#                               home's own infrastructure appended — the door
#                               meter's key (packages/server/src/meter.ts).
#                               Set only when config.sh's PROXY_HOPS is set,
#                               so an unset variable means the code's own
#                               default rather than this script asserting one.
# ISOCAN_OPERATORS              the addresses that run this home, as a comma
#                               list in the shape grant subjects use
#                               (email:someone@example.com). Who can set this
#                               is who decides who the operator is — which is
#                               the whole of what makes a list in configuration
#                               trustworthy, and why IAM on this service is the
#                               real boundary. Set only when config.sh's
#                               OPERATORS is set; unset means this home has no
#                               operator and says so on every operator route.
# ISOCAN_CONTENT_HOST           the second registrable domain item content is
#                               served from (isocan.store). THE variable that
#                               turns the hosted content origin on: frames move
#                               there, reads there carry a short-lived
#                               signature the app origin minted, and that Host
#                               is refused everything but blob bytes. Set only
#                               when config.sh's CONTENT_DOMAIN is set, so a
#                               home without one is byte for byte the home
#                               before the split — which is also the rollback.
ENV_VARS="ISOCAN_STORE=cloud"
ENV_VARS="${ENV_VARS};ISOCAN_GCP_PROJECT=${PROJECT_ID}"
ENV_VARS="${ENV_VARS};ISOCAN_BUCKET=${BUCKET}"
ENV_VARS="${ENV_VARS};ISOCAN_BIND=0.0.0.0"
ENV_VARS="${ENV_VARS};ISOCAN_HOME=/tmp/isocan"
ENV_VARS="${ENV_VARS};ISOCAN_ALLOWED_ORIGINS=https://${DOMAIN}"
# Only when it is set. An empty value would reach the container as an empty
# string, which `configuredHops` reads as "not an integer" and answers with its
# default anyway — but it would put a variable in the service description
# claiming a decision nobody made.
if [ -n "${PROXY_HOPS}" ]; then
  ENV_VARS="${ENV_VARS};ISOCAN_PROXY_HOPS=${PROXY_HOPS}"
fi

# **The content origin, if this home has one** — and only if, for the reason
# above: an empty value would put a variable in the service description
# claiming a decision nobody made, and the daemon reads an empty string as
# "no content host" anyway. A home with none serves item content from its own
# origin exactly as it always did.
#
# ORDERING: 82-content-origin.sh must have run and its certificate must be
# ACTIVE before this deploy, or the domain has no valid route and the frames
# this variable moves there will not load. Both scripts are idempotent, so the
# fix is to run them in order rather than to repair anything.
if [ -n "${CONTENT_DOMAIN}" ]; then
  ENV_VARS="${ENV_VARS};ISOCAN_CONTENT_HOST=${CONTENT_DOMAIN}"
fi

# **Who runs this home** (docs/projects/operator/design.md). Only when it is
# set, for the reason every other optional variable here is: an empty value
# would put a variable in the service description claiming a decision nobody
# made, and the daemon reads an empty string as "no operator" anyway.
#
# ORDERING: this does nothing without an attester. A home with no Identity
# Platform project has no way to verify that anybody is the address on this
# list, and every operator route says exactly that — so run
# 100-identity-platform.sh first, or this is a list nobody can ever satisfy.
#
# **This is the variable that made the whole list semicolon-joined**, which is
# why every line above says `;` where it used to say `,`. `ISOCAN_OPERATORS` is
# itself a comma list, and gcloud's default separator for `--set-env-vars` is a
# comma — so `email:a@x.com,email:b@y.com` would arrive as two variables, the
# second of which has no name, and the deploy would either fail obscurely or
# set an operator list with one address in it. gcloud's escaped-list syntax
# (`^;^` on the flag below) picks a different separator, and `;` is one that
# cannot occur in an email address the way `@` and `,` both can.
if [ -n "${OPERATORS}" ]; then
  ENV_VARS="${ENV_VARS};ISOCAN_OPERATORS=${OPERATORS}"
fi

# **The borrowed attester, as CONFIGURATION.** This is what makes one image run
# at dev.isocan.io, at isocan.io, and on somebody's laptop: the container is
# byte-identical everywhere and what differs is whether there is an Identity
# Platform project to check tokens against. A daemon with these unset has no
# attester, refuses `email:` grants with a reason, and shows no sign-in control
# — which is exactly right for a local daemon and is why there is no default.
#
# **The key is LOOKED UP, never written down.** It is not a secret — a browser
# API key identifies a project, ships in every page that uses it, and is
# defended by the provider's authorized-domain list — but a literal `AIza…`
# string in a repository trips GitHub's secret scanner, and a scanner that
# cries wolf is a scanner people stop reading. So it is read from the API at
# deploy time, from the key `initializeAuth` made.
#
# Skipped rather than fatal when Identity Platform is not initialized: stage A
# stands on its own, and a home with no attester is a working home.
if gcloud services list --project="${PROJECT_ID}" --enabled \
     --filter="config.name=identitytoolkit.googleapis.com" --format='value(config.name)' \
     2>/dev/null | grep -q identitytoolkit; then
  AUTH_KEY_RES="$(gcloud services api-keys list --project="${PROJECT_ID}" --format='value(name)' 2>/dev/null | head -1 || true)"
  AUTH_KEY="$(gcloud services api-keys get-key-string "${AUTH_KEY_RES}" --project="${PROJECT_ID}" --format='value(keyString)' 2>/dev/null || true)"
  if [ -n "${AUTH_KEY}" ]; then
    ENV_VARS="${ENV_VARS};ISOCAN_AUTH_PROJECT=${PROJECT_ID}"
    ENV_VARS="${ENV_VARS};ISOCAN_AUTH_API_KEY=${AUTH_KEY}"
  else
    note "identitytoolkit is on but no API key came back — deploying with no attester"
  fi
fi

step "deploying ${SERVICE}"
note "min=${MIN_INSTANCES} max=${MAX_INSTANCES} cpu=${CPU} memory=${MEMORY} concurrency=${CONCURRENCY} timeout=${REQUEST_TIMEOUT}s"

# **This script's default is `:latest`, and on a home whose images are tagged
# by COMMIT it can quietly roll production backwards.**
#
# The Cloud Build trigger deploys `--image=${_IMAGE}:${_TAG}` — the short sha —
# so a home driven by the trigger runs a sha-tagged image and its `:latest` is
# whatever was pushed last, which is not necessarily what is serving. Re-running
# this script to change one ENVIRONMENT VARIABLE would then also swap the code,
# with nothing in the output saying so. Found on 6 Sep 2026 while adding
# ISOCAN_CONTENT_HOST to prod: the fix that day was to pass
# ISOCAN_IMAGE_TAG=<sha> by hand, which works only if you already know about
# this and think of it at the right moment. Neither is a control.
#
# So: say what is running, say what is about to run, and when they differ make
# somebody agree to it out loud. A deploy that changes the code is completely
# legitimate — that is what this script is for — but it should never be a
# SIDE EFFECT of a config change.
RUNNING_IMAGE="$(gcloud run services describe "${SERVICE}" \
  --project="${PROJECT_ID}" --region="${REGION}" \
  --format='value(spec.template.spec.containers[0].image)' 2>/dev/null || true)"
if [ -n "${RUNNING_IMAGE}" ] && [ "${RUNNING_IMAGE}" != "${IMAGE}" ]; then
  note "running now: ${RUNNING_IMAGE}"
  note "about to deploy: ${IMAGE}"
  confirm "this CHANGES THE CODE as well as the configuration. Deploy ${TAG} over ${RUNNING_IMAGE##*:}?"
elif [ -n "${RUNNING_IMAGE}" ]; then
  note "image unchanged (${RUNNING_IMAGE##*:}) — this deploy is configuration only"
fi

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
#
# --ingress is config.sh's INGRESS, and on prod it is not `all`. See that
# variable for the argument: `all` leaves the *.run.app URL reachable around
# the load balancer, and the door's meter keys on a forwarded chain that path
# does not produce. Restricting it makes the LB the only way in — and makes
# the run.app URL stop answering, which is why the check at the end of this
# script asks the domain instead when it is set.
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
  --ingress="${INGRESS}" \
  --set-env-vars="^;^${ENV_VARS}" \
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
#
# **WHICH address gets asked depends on the ingress.** With `all`, the run.app
# URL is the honest thing to check: it is a door this service is actually
# holding open. With ingress restricted, that URL is CLOSED BY DESIGN — asking
# it would fail on a perfectly healthy home, and asking it and shrugging would
# be this codebase's oldest bug — so the domain is asked instead, and a domain
# that does not answer is a real failure rather than a stage-ordering excuse.
# Restricted ingress on a home whose Stage B has not finished is a
# configuration mistake, and the message below says so.
if [ "${INGRESS}" = "all" ]; then
  CHECK_URL="${URL}"
else
  CHECK_URL="https://${DOMAIN}"
  note "ingress is ${INGRESS} — the run.app URL is closed by design; checking ${CHECK_URL}"
fi
if curl -fsS --max-time 30 "${CHECK_URL}/api/healthz"; then
  printf '\n'
  made "the home answers at ${CHECK_URL}"
else
  warn "no answer from ${CHECK_URL}/api/healthz"
  note "logs: gcloud run services logs read ${SERVICE} --project=${PROJECT_ID} --region=${REGION} --limit=100"
  if [ "${INGRESS}" != "all" ]; then
    note "ingress is ${INGRESS}, so ${URL} cannot answer and the domain is the only door."
    note "if Stage B has not finished for this home, deploy with ISOCAN_INGRESS=all first,"
    note "finish the load balancer and the DNS record, then re-run this script."
  fi
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
