#!/usr/bin/env bash
#
# STAGE B — the front door: static IP, load balancer, CDN, managed cert.
#
# CREATES   a reserved global static IPv4 address; a serverless NEG pointing at
#           the Cloud Run service; a global backend service with Cloud CDN on;
#           a URL map; a Google-managed SSL certificate for ${DOMAIN}; an
#           HTTPS target proxy and forwarding rule; and an HTTP forwarding rule
#           that does nothing but redirect to HTTPS.
#
# COSTS     ★ THIS IS THE FIRST THING THAT BILLS WHILE NOBODY IS LOOKING. ★
#           A global external load balancer charges for its forwarding rules
#           by the hour, whether or not a single request arrives:
#             ~$0.025/hour for the first five rules  →  ~$18/month, always.
#           On top of that, per use: ~$0.008–0.012 per GiB processed, Cloud
#           CDN cache egress ~$0.08/GiB in North America, and ~$0.0075 per
#           10,000 cache lookups. At journey scale the per-use half is cents;
#           the $18 is not.
#           The managed certificate itself is free. The static IP is free
#           WHILE ATTACHED to a forwarding rule — see the teardown note.
#
# ASSUMES   Stage A finished and the Cloud Run service answers.
#
# UNDO      Reversible, but NOT by deleting the load balancer alone:
#           a reserved static IP with nothing attached to it costs about
#           $0.010/hour — ~$7/month for an address doing nothing. Delete in
#           reverse order and RELEASE THE ADDRESS LAST. `infra/README.md` has
#           the exact sequence under "Backing out of Stage B".
#
# ═══ THE ORDERING, WHICH IS WHERE PEOPLE GET STUCK ═══
#
#   1. reserve the static IP          (this script)
#   2. build the LB and both forwarding rules  (this script)
#   3. POINT DNS AT THAT IP           ← YOU, at your registrar. A human step.
#   4. wait                            the managed cert sits in PROVISIONING
#                                      until Google resolves ${DOMAIN} and
#                                      finds it pointing here. Typically ten
#                                      minutes; sometimes a couple of hours.
#
# A certificate stuck in PROVISIONING with no explanation is not a mistake you
# made. It is step 3 not having propagated yet. `infra/81-cert-status.sh` polls
# it and says which of the three states it is in.
#
# ONE THING THIS IS NOT: a Cloud Run **domain mapping**. Those require you to
# verify domain ownership through Search Console. This route does not — a
# Google-managed certificate on a load balancer validates by checking that
# ${DOMAIN} resolves to this load balancer's IP. If somebody sends you to
# Search Console, they are describing the other product.

source "$(dirname -- "${BASH_SOURCE[0]}")/lib/common.sh"
preflight
require_project
require_billing

HTTPS_PROXY_NAME="${SERVICE}-https-proxy"
HTTP_PROXY_NAME="${SERVICE}-http-proxy"
REDIRECT_MAP_NAME="${SERVICE}-redirect"

exists gcloud run services describe "${SERVICE}" --project="${PROJECT_ID}" --region="${REGION}" \
  || die "no Cloud Run service ${SERVICE} — finish Stage A first"

confirm "create a global load balancer for ${DOMAIN}? This adds ~\$18/month that bills whether or not anyone visits."

# ---------------------------------------------------------------- 1. the IP

step "static IP"
if exists gcloud compute addresses describe "${LB_IP_NAME}" --global --project="${PROJECT_ID}"; then
  have "${LB_IP_NAME}"
else
  gcloud compute addresses create "${LB_IP_NAME}" \
    --project="${PROJECT_ID}" --global --ip-version=IPV4 >/dev/null
  made "${LB_IP_NAME}"
fi
LB_IP="$(gcloud compute addresses describe "${LB_IP_NAME}" --global \
  --project="${PROJECT_ID}" --format='value(address)')"
note "address: ${LB_IP}"

# ---------------------------------------------------------------- 2. the NEG

step "serverless NEG"
if exists gcloud compute network-endpoint-groups describe "${NEG_NAME}" \
    --region="${REGION}" --project="${PROJECT_ID}"; then
  have "${NEG_NAME}"
else
  gcloud compute network-endpoint-groups create "${NEG_NAME}" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --network-endpoint-type=serverless \
    --cloud-run-service="${SERVICE}" >/dev/null
  made "${NEG_NAME} -> Cloud Run/${SERVICE}"
fi

# ---------------------------------------------------- 3. the backend + CDN

step "backend service"
if exists gcloud compute backend-services describe "${BACKEND_NAME}" --global --project="${PROJECT_ID}"; then
  have "${BACKEND_NAME}"
else
  # --cache-mode=USE_ORIGIN_HEADERS is a deliberate choice and NOT the default.
  #
  # Cloud CDN's default (CACHE_ALL_STATIC) caches anything that looks static
  # even when the origin sent no Cache-Control at all, using a default TTL of
  # an hour. The daemon's SPA fallback serves `index.html` for every unmatched
  # GET and, crucially, MINTS A BADGE AND SETS A COOKIE on that response when
  # the caller has none — the desk's "badged on the page load" beat. Cloud CDN
  # will not cache a response carrying Set-Cookie, so the badge-minting case is
  # safe by accident; but the SAME URL served to an already-badged caller
  # carries no cookie and IS cacheable, and once that copy is in the cache the
  # next badge-less arrival gets a page with no Set-Cookie at all. The app then
  # limps in through `api.ts`'s 401-and-recover path, which the desk designed
  # as belt-and-braces rather than as the way in.
  #
  # USE_ORIGIN_HEADERS means nothing is cached until the daemon says so with a
  # Cache-Control header — and today it says so about nothing, so the CDN is
  # currently a very expensive pass-through. That is the correct place to
  # start. Phase 5's Work carries the follow-up: `no-store` on the shell,
  # `immutable` on the hashed asset filenames vite already emits, at which
  # point this backend caches exactly the right things and nothing else.
  gcloud compute backend-services create "${BACKEND_NAME}" \
    --project="${PROJECT_ID}" \
    --global \
    --load-balancing-scheme=EXTERNAL_MANAGED \
    --enable-cdn \
    --cache-mode=USE_ORIGIN_HEADERS \
    --timeout="${REQUEST_TIMEOUT}" >/dev/null
  made "${BACKEND_NAME} (CDN on, cache-mode=USE_ORIGIN_HEADERS)"
  note "the WebSocket lifetime is governed by Cloud Run's own --timeout=${REQUEST_TIMEOUT}s;"
  note "the backend-service timeout is set to match, but for serverless NEGs Google"
  note "documents it as having no effect. Both are an hour, so it does not matter which wins."
fi

if gcloud compute backend-services describe "${BACKEND_NAME}" --global \
     --project="${PROJECT_ID}" --format='value(backends[].group)' | grep -q "${NEG_NAME}"; then
  have "${NEG_NAME} attached to ${BACKEND_NAME}"
else
  gcloud compute backend-services add-backend "${BACKEND_NAME}" \
    --project="${PROJECT_ID}" --global \
    --network-endpoint-group="${NEG_NAME}" \
    --network-endpoint-group-region="${REGION}" >/dev/null
  made "${NEG_NAME} attached to ${BACKEND_NAME}"
fi

# ---------------------------------------------------------------- 4. routing

step "URL map"
if exists gcloud compute url-maps describe "${URLMAP_NAME}" --global --project="${PROJECT_ID}"; then
  have "${URLMAP_NAME}"
else
  gcloud compute url-maps create "${URLMAP_NAME}" \
    --project="${PROJECT_ID}" --global \
    --default-service="${BACKEND_NAME}" >/dev/null
  made "${URLMAP_NAME} -> ${BACKEND_NAME}"
fi

# ---------------------------------------------------------------- 5. the cert

step "managed certificate"
if exists gcloud compute ssl-certificates describe "${CERT_NAME}" --global --project="${PROJECT_ID}"; then
  have "${CERT_NAME}"
else
  # A managed certificate's domain list is FIXED at creation. Adding
  # www.dev.isocan.io later means a new certificate and a proxy update, not an
  # edit — so if there are other names, they belong in ISOCAN_CERT_DOMAINS now.
  gcloud compute ssl-certificates create "${CERT_NAME}" \
    --project="${PROJECT_ID}" --global \
    --domains="${ISOCAN_CERT_DOMAINS:-${DOMAIN}}" >/dev/null
  made "${CERT_NAME} for ${ISOCAN_CERT_DOMAINS:-${DOMAIN}} (state: PROVISIONING — see below)"
fi

step "HTTPS frontend"
if exists gcloud compute target-https-proxies describe "${HTTPS_PROXY_NAME}" --global --project="${PROJECT_ID}"; then
  have "${HTTPS_PROXY_NAME}"
else
  gcloud compute target-https-proxies create "${HTTPS_PROXY_NAME}" \
    --project="${PROJECT_ID}" --global \
    --url-map="${URLMAP_NAME}" \
    --ssl-certificates="${CERT_NAME}" >/dev/null
  made "${HTTPS_PROXY_NAME}"
fi

if exists gcloud compute forwarding-rules describe "${SERVICE}-https" --global --project="${PROJECT_ID}"; then
  have "${SERVICE}-https (:443)"
else
  gcloud compute forwarding-rules create "${SERVICE}-https" \
    --project="${PROJECT_ID}" --global \
    --load-balancing-scheme=EXTERNAL_MANAGED \
    --address="${LB_IP_NAME}" \
    --target-https-proxy="${HTTPS_PROXY_NAME}" \
    --ports=443 >/dev/null
  made "${SERVICE}-https (:443) — THE BILLING CLOCK STARTS HERE"
fi

# ------------------------------------------------- 6. port 80, redirect only

step "HTTP -> HTTPS"
# Port 80 exists solely so somebody typing dev.isocan.io without a scheme lands
# somewhere. It serves the redirect and never reaches the backend — a URL map
# with a redirect action and no service at all.
if exists gcloud compute url-maps describe "${REDIRECT_MAP_NAME}" --global --project="${PROJECT_ID}"; then
  have "${REDIRECT_MAP_NAME}"
else
  REDIRECT_YAML="$(mktemp)"
  cat >"${REDIRECT_YAML}" <<YAML
name: ${REDIRECT_MAP_NAME}
defaultUrlRedirect:
  httpsRedirect: true
  redirectResponseCode: MOVED_PERMANENTLY_DEFAULT
  stripQuery: false
YAML
  gcloud compute url-maps import "${REDIRECT_MAP_NAME}" \
    --project="${PROJECT_ID}" --global \
    --source="${REDIRECT_YAML}" --quiet >/dev/null
  rm -f "${REDIRECT_YAML}"
  made "${REDIRECT_MAP_NAME}"
fi

if exists gcloud compute target-http-proxies describe "${HTTP_PROXY_NAME}" --global --project="${PROJECT_ID}"; then
  have "${HTTP_PROXY_NAME}"
else
  gcloud compute target-http-proxies create "${HTTP_PROXY_NAME}" \
    --project="${PROJECT_ID}" --global \
    --url-map="${REDIRECT_MAP_NAME}" >/dev/null
  made "${HTTP_PROXY_NAME}"
fi

if exists gcloud compute forwarding-rules describe "${SERVICE}-http" --global --project="${PROJECT_ID}"; then
  have "${SERVICE}-http (:80)"
else
  gcloud compute forwarding-rules create "${SERVICE}-http" \
    --project="${PROJECT_ID}" --global \
    --load-balancing-scheme=EXTERNAL_MANAGED \
    --address="${LB_IP_NAME}" \
    --target-http-proxy="${HTTP_PROXY_NAME}" \
    --ports=80 >/dev/null
  made "${SERVICE}-http (:80, redirect only)"
fi

# ---------------------------------------------------------------- the human

step "YOUR TURN — the DNS record"
human "At the registrar or DNS host for isocan.io, create:"
printf '\n      %s  A  %s\n\n' "${DOMAIN}" "${LB_IP}"
note "Nothing above this line can do it for you, and nothing below it happens until you do."
note ""
note "Then watch the certificate:  infra/81-cert-status.sh"
note "PROVISIONING is normal and means 'Google has not yet seen the A record'."
note "Ten minutes is typical. Two hours is not alarming. It is not something you did."
note ""
note "Once ACTIVE:  https://${DOMAIN}"
