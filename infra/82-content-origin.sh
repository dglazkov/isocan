#!/usr/bin/env bash
#
# STAGE B (continued) — the content origin: a second registrable domain on the
# SAME load balancer and the SAME Cloud Run service.
#
# CREATES   a Google-managed SSL certificate for ${CONTENT_DOMAIN}, attached to
#           the existing HTTPS proxy beside the app's; a host rule on the
#           existing URL map sending that Host to the existing backend; and an
#           explicit cache-key policy on that backend.
#
# COSTS     nothing new that bills by the hour. No forwarding rule, no address,
#           no service: the $18/month load balancer is already there and this
#           adds a name to it. The managed certificate is free. Per use, the
#           content origin is where CDN egress finally happens — signed reads
#           are publicly cacheable for their TTL, which is the point.
#
# ASSUMES   80-load-balancer.sh finished, and CONTENT_DOMAIN is set (it is not
#           on dev — see config.sh). Running it on a home with no content
#           domain does nothing and says so.
#
# UNDO      remove the host rule (the app keeps answering on its own domain),
#           then detach and delete the certificate. Deploying the service
#           WITHOUT ISOCAN_CONTENT_HOST is the real rollback and needs none of
#           this: the daemon stops advertising the origin, frames go back to
#           the app origin, and nothing in the front door has to change first.
#
# ═══ WHY THIS EXISTS AT ALL ═══
#
# Item content — the HTML an agent wrote and dropped on a canvas — is served
# from an origin that owns nothing, so that granting it `allow-same-origin`
# (which it needs to have storage) hands it nothing of ours. A subdomain will
# not do, because cookies scope to parent domains. So: a second registrable
# domain, the `githubusercontent.com` pattern.
#   docs/projects/atlas/content-origin.md         — why
#   docs/projects/atlas/content-origin-plan.md    — in what order
#   docs/projects/multiuser/content-read-auth.md  — how a cookieless origin
#                                                   knows who may read a
#                                                   private canvas's bytes
#
# ═══ THE ORDERING, AND WHY THE FLIP IS LAST ═══
#
#   1. point ${CONTENT_DOMAIN}'s A record at the load balancer's IP  ← YOU,
#      at the registrar. The same IP the app domain uses; this script prints
#      it. (Done for isocan.store at Namecheap on 5 September 2026.)
#   2. run this — it creates the certificate and then STOPS, refusing the
#      flip, because of the trap below.
#   3. wait for the certificate to leave PROVISIONING (81-cert-status.sh, with
#      ISOCAN_CERT_NAME set to the content cert, polls it)
#   4. deploy a service that KNOWS about this domain: the code that reads
#      ISOCAN_CONTENT_HOST, with the variable set (70-cloud-run.sh sets it
#      from CONTENT_DOMAIN). Safe in either order with step 2, because until
#      the flip nothing reaches the daemon bearing that Host at all.
#   5. run this again — now it flips the host rule.
#
# **THE TRAP, which the first draft of this script walked into.** The daemon
# accepts its own Host as an allowed origin (`originAllowed` in badges.ts) —
# that is what keeps the *.run.app URL working. So a host rule pointing at the
# backend BEFORE the deploy does not serve "the app, harmlessly": it serves the
# whole app and the whole API, door included, on a second name, where a browser
# mints its own separate badge. That is the one-origin rule broken by an
# ordering mistake. Between the redirect and a daemon that refuses this Host
# there must be no window, so the check below enforces the order rather than
# this comment asking for it.
#
# A certificate created BEFORE the A record resolves records FAILED_NOT_VISIBLE
# and cannot be revalidated in place — that is the whole story behind
# `isocan-cert-2`. Do step 1 first.

source "$(dirname -- "${BASH_SOURCE[0]}")/lib/common.sh"
preflight
require_project

HTTPS_PROXY_NAME="${SERVICE}-https-proxy"
# The path matcher THIS script creates — the one that serves the backend.
# Deliberately not the `content` matcher the 5 September parking created, which
# holds the 301: re-tying a host rule to a matcher of the same name it is
# already tied to is not a documented operation, while orphaning the old one
# and deleting it is. The name says which of the two it is.
CONTENT_MATCHER="content-served"

if [ -z "${CONTENT_DOMAIN}" ]; then
  note "no ISOCAN_CONTENT_DOMAIN for this home — nothing to do."
  note "the app serves item content from its own origin, exactly as it always has."
  exit 0
fi

exists gcloud compute url-maps describe "${URLMAP_NAME}" --global --project="${PROJECT_ID}" \
  || die "no URL map ${URLMAP_NAME} — finish 80-load-balancer.sh first"

LB_IP="$(gcloud compute addresses describe "${LB_IP_NAME}" --global \
  --project="${PROJECT_ID}" --format='value(address)')"
note "${CONTENT_DOMAIN} must have an A record pointing at ${LB_IP}"

# --------------------------------------------------------- 1. the certificate

step "managed certificate for ${CONTENT_DOMAIN}"
if exists gcloud compute ssl-certificates describe "${CONTENT_CERT_NAME}" --global --project="${PROJECT_ID}"; then
  have "${CONTENT_CERT_NAME}"
else
  gcloud compute ssl-certificates create "${CONTENT_CERT_NAME}" \
    --project="${PROJECT_ID}" --global \
    --domains="${CONTENT_DOMAIN}" >/dev/null
  made "${CONTENT_CERT_NAME} for ${CONTENT_DOMAIN} (state: PROVISIONING)"
fi

# A target proxy carries a LIST of certificates and picks by SNI, so the app's
# and the content origin's live side by side on one proxy — one frontend, two
# names. `--ssl-certificates` REPLACES the list, so the app's certificate has to
# be named again here or it would be dropped and every request to the app
# domain would fail its handshake.
step "certificate attached to ${HTTPS_PROXY_NAME}"
ATTACHED="$(gcloud compute target-https-proxies describe "${HTTPS_PROXY_NAME}" \
  --global --project="${PROJECT_ID}" --format='value(sslCertificates)')"
if printf '%s' "${ATTACHED}" | grep -q "/${CONTENT_CERT_NAME}\$\|/${CONTENT_CERT_NAME},"; then
  have "${CONTENT_CERT_NAME} on ${HTTPS_PROXY_NAME}"
else
  gcloud compute target-https-proxies update "${HTTPS_PROXY_NAME}" \
    --project="${PROJECT_ID}" --global \
    --ssl-certificates="${CERT_NAME},${CONTENT_CERT_NAME}" >/dev/null
  made "${CERT_NAME} + ${CONTENT_CERT_NAME} on ${HTTPS_PROXY_NAME}"
fi

# ------------------------------------------------------- 2. the cache key

# **The one line that makes signed URLs safe to cache at the edge, said out
# loud rather than inherited.**
#
# A verified signed read is served `Cache-Control: public, max-age=<what is
# left of its TTL>` — the URL is the credential and it expires, so a shared
# copy cannot outlive the permission. That reasoning holds only if the cache
# key INCLUDES THE QUERY STRING, which is where the signature is. A cache that
# dropped it would serve a signed response to a caller that presented none:
# every private canvas on this home, readable by anyone who knows a hash.
#
# Cloud CDN's default already includes the query string. It is set explicitly
# anyway, because "the default is currently what we need" is not a control, and
# because a future `--cache-key-include-query-string=false` typed by somebody
# optimizing hit rates would be a silent, total authorization bypass. Measured
# on isocan-io-prod, 6 Sep 2026: `cdnPolicy.cacheKeyPolicy` was null — the
# behaviour was right and nothing had said so.
#
# **BEFORE the flip, not after, and that is the whole reason this block moved.**
# It is a PRECONDITION of the flip's safety, not a tidy-up after it: the moment
# the host rule reaches the daemon, signed reads start being served
# `public, max-age=…`, and a cache key that does not carry the signature makes
# that an authorization bypass. Establishing it first also means the run that
# REFUSES the flip still leaves this set, so the property is true before
# anything depends on it rather than moments after.
#
# **The empty blacklist is not decoration.** `--cache-key-include-query-string`
# alone means "include the query string *according to the whitelist and
# blacklist*" — so a whitelist somebody set earlier that does not name `sig`
# would leave the signature out of the key while this flag says it is in. The
# CLI's own help names the fix: "Use --cache-key-query-string-blacklist= (sets
# the blacklist to the empty list) to include the entire query string." The two
# are mutually exclusive, so setting the blacklist empty also clears any
# whitelist. Include everything, exclude nothing, say both.
step "cache key includes the whole query string"
gcloud compute backend-services update "${BACKEND_NAME}" \
  --project="${PROJECT_ID}" --global \
  --cache-key-include-query-string \
  --cache-key-query-string-blacklist= >/dev/null
made "${BACKEND_NAME}: the signature is part of the cache key"

# ------------------------------------------------------------ 3. the host rule

# **This is the flip.** Until now ${CONTENT_DOMAIN} has been a 301 to the app
# domain — a parked name, so that a person who typed it landed somewhere real
# while the daemon could not yet tell the two Hosts apart. Now the same host
# rule sends it to the same backend the app uses, and the DAEMON does the
# telling apart: a request bearing this Host gets blob bytes or a 404, because
# `ISOCAN_CONTENT_HOST` turns on the content role's refusal of everything else.
#
# One backend and not two, deliberately. A second backend service would be a
# second place to configure CDN, timeouts and health, kept in sync by nobody —
# and there is nothing to configure differently: the SAME container answers,
# and which origin a request arrived on is a header it reads.
#
# **The order, enforced rather than asked for.** See THE TRAP at the top: a
# host rule that reaches a daemon which has never heard of this domain serves
# the whole app and the whole API on a second name. So the flip refuses until
# the deployed revision actually carries ISOCAN_CONTENT_HOST — which is the
# same fact as "the daemon will refuse this Host everything but blob bytes",
# read from the service rather than assumed.
#
# ISOCAN_CONTENT_FLIP_ANYWAY=1 skips the check, for the one case it is wrong
# about: a brand-new home whose app has never been deployed, where there is no
# app on the second name to expose because there is no app yet.
step "host rule ${CONTENT_DOMAIN} -> ${BACKEND_NAME}"

# **What the map says now**, read as two tables rather than grepped out of one
# YAML blob. `--filter` is a LIST-command flag and `describe` does not take it,
# so the shape that works is `--flatten` (one row per element) plus a `value()`
# projection; the rows come back tab-separated and awk picks the one that
# matters.
#
# The grep this replaces asked whether the map contained `defaultService:
# .*isocan-backend` ANYWHERE — which is always true, because that is the whole
# map's own default service. It would have reported the flip already done, on
# every home, forever, and quietly skipped the only thing this script is for.
url_map_rows() {
  gcloud compute url-maps describe "${URLMAP_NAME}" --global --project="${PROJECT_ID}" \
    --flatten="$1" --format="value($2)" 2>/dev/null || true
}
CURRENT_MATCHER="$(url_map_rows 'hostRules[]' 'hostRules.hosts,hostRules.pathMatcher' \
  | awk -v d="${CONTENT_DOMAIN}" 'index($1, d) { print $2; exit }')"
SERVED_BY="$(url_map_rows 'pathMatchers[]' 'pathMatchers.name,pathMatchers.defaultService' \
  | awk -v m="${CONTENT_MATCHER}" '$1 == m { print $2; exit }')"

if [ "${CURRENT_MATCHER}" = "${CONTENT_MATCHER}" ] \
   && printf '%s' "${SERVED_BY}" | grep -q "/${BACKEND_NAME}\$"; then
  have "${CONTENT_DOMAIN} -> ${BACKEND_NAME}"
else
  # **The order, enforced rather than asked for.** See THE TRAP at the top: a
  # host rule that reaches a daemon which has never heard of this domain serves
  # the whole app and the whole API on a second name. So the flip refuses until
  # the deployed revision actually carries ISOCAN_CONTENT_HOST — the same fact
  # as "the daemon will refuse this Host everything but blob bytes", read from
  # the service rather than assumed.
  #
  # Inside this branch and not above it, so a re-run against an already-flipped
  # map does not nag about an ordering that is already behind us.
  #
  # ISOCAN_CONTENT_FLIP_ANYWAY=1 skips the check, for the one case it is wrong
  # about: a brand-new home whose app has never been deployed, where there is
  # no app on the second name to expose because there is no app yet.
  step "the deployed service knows this domain"
  DEPLOYED="$(gcloud run services describe "${SERVICE}" \
    --project="${PROJECT_ID}" --region="${REGION}" \
    --format='yaml(spec.template.spec.containers)' 2>/dev/null || true)"
  if printf '%s' "${DEPLOYED}" | grep -q "ISOCAN_CONTENT_HOST"; then
    have "the running revision carries ISOCAN_CONTENT_HOST"
  elif [ -n "${ISOCAN_CONTENT_FLIP_ANYWAY:-}" ]; then
    note "ISOCAN_CONTENT_FLIP_ANYWAY is set — flipping without checking the service"
  else
    note "the running revision does NOT carry ISOCAN_CONTENT_HOST."
    note "Flipping now would serve the whole app and API on ${CONTENT_DOMAIN} until"
    note "the next deploy — see THE TRAP at the top of this script."
    note ""
    note "The certificate above is created and provisioning; nothing else was changed."
    note "Deploy the daemon first, then run this again:"
    note "    ./infra/70-cloud-run.sh && ./infra/82-content-origin.sh"
    exit 0
  fi

  # **Two commands, because the two situations are genuinely different** —
  # `--existing-host` and `--new-hosts` are mutually exclusive
  # (`[--existing-host=X | --new-hosts=Y]`), so the first draft's "pass both and
  # fall back" always failed its first call on an argument error and hid the
  # real one behind `2>/dev/null`.
  if [ -n "${CURRENT_MATCHER}" ]; then
    # The 5 September parking: a host rule for this domain exists and its
    # matcher is a 301. Re-tie the SAME host rule to a matcher that serves the
    # backend. That orphans the redirect matcher, which the command refuses to
    # leave behind unless told — hence the flag, which is the delete.
    step "re-tying ${CONTENT_DOMAIN} from '${CURRENT_MATCHER}' to '${CONTENT_MATCHER}'"
    gcloud compute url-maps add-path-matcher "${URLMAP_NAME}" \
      --project="${PROJECT_ID}" --global \
      --path-matcher-name="${CONTENT_MATCHER}" \
      --default-service="${BACKEND_NAME}" \
      --existing-host="${CONTENT_DOMAIN}" \
      --delete-orphaned-path-matcher >/dev/null
    made "${CONTENT_DOMAIN} -> ${BACKEND_NAME} (was: '${CURRENT_MATCHER}', a 301 to ${DOMAIN})"
  else
    # A home whose second domain has never been routed at all.
    gcloud compute url-maps add-path-matcher "${URLMAP_NAME}" \
      --project="${PROJECT_ID}" --global \
      --path-matcher-name="${CONTENT_MATCHER}" \
      --default-service="${BACKEND_NAME}" \
      --new-hosts="${CONTENT_DOMAIN}" >/dev/null
    made "${CONTENT_DOMAIN} -> ${BACKEND_NAME} (a new host rule)"
  fi
fi


step "done"
note "${CONTENT_DOMAIN} now reaches the daemon, which serves it blob bytes and 404s"
note "everything else. Check the certificate is ACTIVE if you have not already:"
note "    ISOCAN_CERT_NAME=${CONTENT_CERT_NAME} ./infra/81-cert-status.sh"
note ""
note "To roll back, deploy without ISOCAN_CONTENT_HOST (unset ISOCAN_CONTENT_DOMAIN"
note "and re-run 70-cloud-run.sh): frames go back to the app origin and nothing in"
note "the front door has to change first."
