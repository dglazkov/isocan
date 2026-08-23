#!/usr/bin/env bash
#
# STAGE B, the waiting part. Read-only: creates nothing, changes nothing.
#
# A Google-managed certificate goes PROVISIONING → ACTIVE on Google's schedule,
# and the only thing that moves it is ${DOMAIN} resolving to the load
# balancer's IP. This script says which of the three things is true — the DNS
# is wrong, the DNS is right and Google has not looked yet, or it is done — so
# that a wait is a wait rather than a mystery.
#
# COSTS  nothing. Run it as often as you like.
#
#   --watch   poll every 30s until ACTIVE or you give up

source "$(dirname -- "${BASH_SOURCE[0]}")/lib/common.sh"
preflight
require_project

WATCH="no"
[ "${1:-}" = "--watch" ] && WATCH="yes"

LB_IP="$(gcloud compute addresses describe "${LB_IP_NAME}" --global \
  --project="${PROJECT_ID}" --format='value(address)' 2>/dev/null || true)"
[ -n "${LB_IP}" ] || die "no reserved address ${LB_IP_NAME} — run infra/80-load-balancer.sh first"

check_once() {
  step "DNS"
  # `dig +short` if it is here, otherwise fall back to what every machine has.
  local resolved=""
  if command -v dig >/dev/null 2>&1; then
    resolved="$(dig +short "${DOMAIN}" A | tail -1)"
  else
    resolved="$(getent hosts "${DOMAIN}" 2>/dev/null | awk '{print $1}' | tail -1 || true)"
    [ -n "${resolved}" ] || resolved="$(python3 -c 'import socket,sys; print(socket.gethostbyname(sys.argv[1]))' "${DOMAIN}" 2>/dev/null || true)"
  fi
  if [ -z "${resolved}" ]; then
    warn "${DOMAIN} does not resolve at all yet."
    note "the A record has not been created, or it has not propagated. Nothing will move until it does."
  elif [ "${resolved}" = "${LB_IP}" ]; then
    made "${DOMAIN} -> ${resolved}  (the load balancer)"
  else
    warn "${DOMAIN} -> ${resolved}, but the load balancer is ${LB_IP}."
    note "the certificate will NEVER become ACTIVE while this is wrong. Fix the A record."
  fi

  step "certificate"
  local status domain_status
  status="$(gcloud compute ssl-certificates describe "${CERT_NAME}" --global \
    --project="${PROJECT_ID}" --format='value(managed.status)' 2>/dev/null || echo "MISSING")"
  domain_status="$(gcloud compute ssl-certificates describe "${CERT_NAME}" --global \
    --project="${PROJECT_ID}" --format='value(managed.domainStatus)' 2>/dev/null || true)"
  case "${status}" in
    ACTIVE)
      made "ACTIVE — https://${DOMAIN} is live"
      return 0 ;;
    PROVISIONING)
      note "PROVISIONING — per-domain: ${domain_status:-?}"
      note "this is the normal state until Google has both seen the A record and issued."
      note "FAILED_NOT_VISIBLE in the per-domain line means DNS specifically." ;;
    PROVISIONING_FAILED|PROVISIONING_FAILED_PERMANENTLY|FAILED*)
      warn "${status} — per-domain: ${domain_status:-?}"
      note "if this is permanent, delete the certificate, fix DNS, and create it again:"
      note "  gcloud compute target-https-proxies update ${SERVICE}-https-proxy --global --ssl-certificates=NEWCERT --project=${PROJECT_ID}" ;;
    MISSING)
      die "no certificate ${CERT_NAME} — run infra/80-load-balancer.sh" ;;
    *)
      note "${status} — per-domain: ${domain_status:-?}" ;;
  esac
  return 1
}

if [ "${WATCH}" = "yes" ]; then
  while true; do
    if check_once; then exit 0; fi
    note "checking again in 30s (Ctrl-C to stop; nothing is harmed by stopping)"
    sleep 30
  done
else
  check_once || true
  note ""
  note "--watch to poll until it is ACTIVE."
fi
