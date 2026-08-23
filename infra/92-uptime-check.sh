#!/usr/bin/env bash
#
# STAGE C · the uptime check on /api/healthz, and optionally an email alert.
#
# CREATES   one Cloud Monitoring uptime check against
#           https://${ISOCAN_UPTIME_HOST:-$DOMAIN}/api/healthz;
#           and — only if you pass ISOCAN_ALERT_EMAIL — a notification channel
#           and an alert policy that mails you when it fails.
# COSTS     Cloud Monitoring gives 1,000,000 uptime-check executions free per
#           month. One check at the default period runs ~9,000 times a month
#           from each of several global locations — comfortably inside it.
#           **$0.** Notification channels and alert policies are free.
# ASSUMES   the host being checked is reachable and serving /api/healthz.
# UNDO      `gcloud monitoring uptime delete <id>`. Clean, and free either way.
#
# A health route is the right target for a reason worth stating: it is one of
# the routes `isOpen` lets through without a badge, and its comment says so —
# "the load balancer's probe … the door obviously cannot ask for what it hands
# out". A monitoring check on any other route would be checking the door, not
# the home.
#
# WHY /api/healthz AND NOT /healthz. On a hosted home /healthz never reaches
# the container. Google's frontend answers that exact path itself with a
# branded 404 — measured on isocan-io-dev, where `/`, `/healthz/` (trailing
# slash) and `/HEALTHZ` all return 200 from our daemon and `/healthz` returns
# Google's 404, with no matching entry in the container's request log, ever.
# So a check pointed at /healthz would be watching Google's frontend, not the
# daemon: it could never fail for the right reason. `/healthz` still exists and
# is unchanged — it is what every localhost caller uses — and `/api/healthz` is
# its sibling, same handler, same body, in a prefix Google forwards.
#
# A NOTE ON THE gcloud SURFACE. `gcloud monitoring uptime` and
# `gcloud beta monitoring channels` have moved between alpha/beta/GA more than
# once. If a flag below is rejected, `gcloud monitoring uptime create --help`
# is the authority, not this file — and the console does the same thing in
# three clicks. Nothing here is load-bearing enough to fight about.

source "$(dirname -- "${BASH_SOURCE[0]}")/lib/common.sh"
preflight
require_project
require_billing

HOST="${ISOCAN_UPTIME_HOST:-${DOMAIN}}"
CHECK_NAME="${ISOCAN_UPTIME_NAME:-isocan ${HOST} healthz}"
HEALTH_PATH="/api/healthz"

step "what to check"
# Before the domain exists (i.e. if you stopped after Stage A), point this at
# the run.app host instead — it is a real URL and a real check.
if ! curl -fsS --max-time 15 "https://${HOST}${HEALTH_PATH}" >/dev/null 2>&1; then
  warn "https://${HOST}${HEALTH_PATH} does not answer from here."
  note "if you have not finished Stage B, check the Cloud Run URL instead:"
  note "  ISOCAN_UPTIME_HOST=\"\$(gcloud run services describe ${SERVICE} --project=${PROJECT_ID} --region=${REGION} --format='value(status.url)' | sed 's|https://||')\" $0"
  confirm "create the check anyway against ${HOST}?"
else
  made "https://${HOST}${HEALTH_PATH} answers"
fi

step "uptime check"
EXISTING="$(gcloud monitoring uptime list-configs --project="${PROJECT_ID}" \
  --format='value(displayName)' 2>/dev/null || true)"
if printf '%s\n' "${EXISTING}" | grep -qxF "${CHECK_NAME}"; then
  have "${CHECK_NAME}"
else
  gcloud monitoring uptime create "${CHECK_NAME}" \
    --project="${PROJECT_ID}" \
    --resource-type=uptime-url \
    --resource-labels="host=${HOST},project_id=${PROJECT_ID}" \
    --protocol=https \
    --path="${HEALTH_PATH}" \
    --port=443 \
    --period=5 \
    --timeout=10 \
    --status-classes=2xx >/dev/null
  made "${CHECK_NAME} — every 5 minutes from several regions"
fi

step "alerting"
if [ -z "${ISOCAN_ALERT_EMAIL:-}" ]; then
  human "no ISOCAN_ALERT_EMAIL set, so nothing will tell you when it goes down."
  note "an uptime check with no alert policy is a graph nobody looks at."
  note "re-run with:  ISOCAN_ALERT_EMAIL=you@example.com $0"
  exit 0
fi

CHANNEL="$(gcloud beta monitoring channels list --project="${PROJECT_ID}" \
  --filter="labels.email_address=${ISOCAN_ALERT_EMAIL}" \
  --format='value(name)' 2>/dev/null | head -1 || true)"
if [ -n "${CHANNEL}" ]; then
  have "notification channel for ${ISOCAN_ALERT_EMAIL}"
else
  CHANNEL="$(gcloud beta monitoring channels create \
    --project="${PROJECT_ID}" \
    --display-name="isocan alerts" \
    --type=email \
    --channel-labels="email_address=${ISOCAN_ALERT_EMAIL}" \
    --format='value(name)')"
  made "notification channel ${CHANNEL}"
  human "Google sends a confirmation email. The channel does not deliver until you click it."
fi

POLICY_NAME="isocan ${HOST} is down"
if gcloud alpha monitoring policies list --project="${PROJECT_ID}" \
     --format='value(displayName)' 2>/dev/null | grep -qxF "${POLICY_NAME}"; then
  have "${POLICY_NAME}"
else
  POLICY_YAML="$(mktemp)"
  cat >"${POLICY_YAML}" <<YAML
displayName: "${POLICY_NAME}"
combiner: OR
conditions:
  - displayName: "uptime check failing"
    conditionThreshold:
      filter: >-
        metric.type="monitoring.googleapis.com/uptime_check/check_passed"
        AND resource.type="uptime_url"
      aggregations:
        - alignmentPeriod: 300s
          perSeriesAligner: ALIGN_NEXT_OLDER
          crossSeriesReducer: REDUCE_COUNT_FALSE
          groupByFields: ["resource.label.host"]
      comparison: COMPARISON_GT
      thresholdValue: 1
      duration: 300s
      trigger:
        count: 1
notificationChannels:
  - "${CHANNEL}"
YAML
  gcloud alpha monitoring policies create \
    --project="${PROJECT_ID}" \
    --policy-from-file="${POLICY_YAML}" >/dev/null
  rm -f "${POLICY_YAML}"
  made "${POLICY_NAME} -> ${ISOCAN_ALERT_EMAIL}"
  note "it fires when more than one check location has failed for 5 minutes —"
  note "one location failing is usually that location, not you."
fi

step "done"
note "Stage C is finished except for GC, which 91-scheduler-gc.sh explains and refuses."
