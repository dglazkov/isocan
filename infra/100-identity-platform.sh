#!/usr/bin/env bash
#
# STAGE E · 1 of 1 — Identity Platform: the borrowed bench.
#
# CREATES   the Identity Platform config on ${PROJECT_ID} (which also creates a
#           browser API key); email-link sign-in with no password; ${DOMAIN} and
#           localhost on the authorized-domain list.
# COSTS     $0 at this scale. Identity Platform bills per monthly active user
#           with the first 49,999 free for the providers this uses (email link,
#           Google, GitHub). A dev home with a handful of people never leaves
#           the free tier; enabling this does not move the monthly floor.
# ASSUMES   10-project.sh ran (the project exists and billing is linked).
# UNDO      `gcloud services disable identitytoolkit.googleapis.com`. The config
#           and any accounts it collected go with it.
#
# WHY THIS EXISTS, since it is the one piece of the desk isocan does not build
# itself. The identity desk's ruling is **borrow, never mint**: isocan holds no
# passwords and no user table, and a grant's subject is a *provable attribute*
# the holder demonstrates with an attester they already have. Identity Platform
# is that attester. What it hands back — "this browser controls
# jordan@example.com" — is written onto a badge as an ATTESTATION and nowhere
# else. It is deliberately not an account: the badge stays the only
# account-shaped thing isocan issues, and it is still just a secret.
#
# THE FLOOR IS THE MAGIC LINK, and that is a choice rather than a starting
# point. An emailed sign-in link needs no OAuth app, no client secret, no
# consent screen and no relationship with an IdP — the inbox IS the proof,
# which is exactly the attribute an `email:` grant names. `passwordRequired:
# false` is the borrow-never-mint rule expressed as one boolean: there is no
# password to store, lose, or reset. Google and GitHub are conveniences on top
# and each needs a human to create an OAuth app and paste two strings; this
# script says so and stops, rather than pretending it can.
#
# ---- two things this script learned the hard way, on its first run ----
#
# 1. **EVERY CALL NEEDS `x-goog-user-project`.** A user credential from
#    `gcloud auth login` bills its API quota to gcloud's own shared client
#    project (32555940559), not to the project named in the URL — so a call to
#    identitytoolkit answers **403 SERVICE_DISABLED naming a project you have
#    never heard of**, having just watched this script enable the API on YOUR
#    project. The header names the quota project explicitly. It is the same
#    disease `lib/common.sh` was written for — an ambient default deciding
#    which project a command really touches — one layer further down, where
#    `--project` cannot reach because curl is not gcloud.
#
# 2. **`initializeAuth` lives under `v2/`, not `admin/v2/`.** Every other call
#    here is `admin/v2`, and the wrong path answers an **HTML 404 page** rather
#    than a JSON error — so a check looking for `"error"` in the body sees none
#    and reports success. That is this codebase's oldest recurring bug (see
#    phases 6-8: "the system's default answer to a wrong address is a cheerful
#    one") reproduced in a provisioning script on the day the phase that closed
#    it was committed. The path came out of the API's own discovery document
#    rather than a guess, and every check below reads back the state it wanted
#    instead of trusting a response it did not parse.

source "$(dirname -- "${BASH_SOURCE[0]}")/lib/common.sh"
preflight
require_project
require_billing

ADMIN="https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}"
# See note 1 above. Rebuilt per call because an access token expires and this
# script may sit at a prompt.
idt() {
  local method="$1" url="$2" body="${3:-}"
  curl -sS -X "${method}" \
    -H "Authorization: Bearer $(gcloud auth print-access-token)" \
    -H "x-goog-user-project: ${PROJECT_ID}" \
    -H 'Content-Type: application/json' \
    ${body:+-d "${body}"} \
    "${url}"
}

step "the Identity Toolkit API"
if gcloud services list --enabled --project="${PROJECT_ID}" \
     --format='value(config.name)' 2>/dev/null | grep -qx 'identitytoolkit.googleapis.com'; then
  have "identitytoolkit.googleapis.com"
else
  gcloud services enable identitytoolkit.googleapis.com --project="${PROJECT_ID}"
  made "identitytoolkit.googleapis.com"
fi

step "the Identity Platform config"
# Read first: a GET that succeeds is a cheaper and clearer signal than a POST
# that fails, and `CONFIGURATION_NOT_FOUND` is an unambiguous "not yet".
if idt GET "${ADMIN}/config" | grep -q '"signIn"'; then
  have "Identity Platform is initialized"
else
  idt POST "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/identityPlatform:initializeAuth" '{}' >/dev/null
  # Verified by reading it back, never by the POST's own say-so — see note 2.
  idt GET "${ADMIN}/config" | grep -q '"signIn"' \
    || die "initializeAuth did not take — check the console for ${PROJECT_ID}"
  made "Identity Platform initialized (this also creates the browser API key)"
fi

step "email-link sign-in (the floor)"
# `passwordRequired` is ABSENT from the response when it is false — the API
# omits its default — so the check is "email is enabled and no password is
# demanded", not a string match on a field that will not be there.
EMAIL_CFG="$(idt GET "${ADMIN}/config" \
  | python3 -c 'import json,sys; e=json.load(sys.stdin).get("signIn",{}).get("email",{}); print(int(bool(e.get("enabled"))), int(bool(e.get("passwordRequired"))))')"
if [ "${EMAIL_CFG}" = "1 0" ]; then
  have "email link enabled, no password"
else
  idt PATCH "${ADMIN}/config?updateMask=signIn.email" \
    '{"signIn":{"email":{"enabled":true,"passwordRequired":false}}}' >/dev/null
  idt GET "${ADMIN}/config" \
    | python3 -c 'import json,sys; e=json.load(sys.stdin).get("signIn",{}).get("email",{}); sys.exit(0 if e.get("enabled") and not e.get("passwordRequired") else 1)' \
    || die "email-link sign-in did not take"
  made "email link enabled, no password"
fi

step "authorized domains"
# Identity Platform refuses to complete a sign-in for a page served from a
# domain it does not know — the defence against somebody standing up a lookalike
# and driving YOUR project's sign-in from it. It is also what protects the
# browser API key below, which is not a secret.
#
# The default list is the two firebaseapp/web.app hosts and NOT localhost, so
# local development needs it added explicitly. Whole-list PATCH, read-modify-
# write, because the field is a list and the API replaces rather than appends.
WANT=("${DOMAIN}" "localhost")
HAVE_DOMAINS="$(idt GET "${ADMIN}/config" | python3 -c 'import json,sys; print("\n".join(json.load(sys.stdin).get("authorizedDomains",[])))')"
MISSING=()
for d in "${WANT[@]}"; do
  printf '%s\n' "${HAVE_DOMAINS}" | grep -qxF "${d}" || MISSING+=("${d}")
done
if [ ${#MISSING[@]} -eq 0 ]; then
  have "${DOMAIN} and localhost are authorized"
else
  NEXT="$(printf '%s\n' "${HAVE_DOMAINS}" "${MISSING[@]}" \
    | python3 -c 'import json,sys; print(json.dumps({"authorizedDomains": [l for l in sys.stdin.read().split("\n") if l]}))')"
  idt PATCH "${ADMIN}/config?updateMask=authorizedDomains" "${NEXT}" >/dev/null
  made "authorized: ${MISSING[*]}"
fi

step "the browser API key"
# NOT created here: `initializeAuth` already made one ("Browser key (auto
# created by Firebase)"), and a second key would be a second thing to rotate
# for no benefit. It is not a secret either — a browser key identifies a
# project, is visible in every page that uses it, and is defended by the
# authorized-domain list above rather than by being hidden.
KEY_RES="$(gcloud services api-keys list --project="${PROJECT_ID}" --format='value(name)' 2>/dev/null | head -1 || true)"
[ -n "${KEY_RES}" ] || die "no API key on ${PROJECT_ID} — initializeAuth should have made one"
KEY_STRING="$(gcloud services api-keys get-key-string "${KEY_RES}" --project="${PROJECT_ID}" --format='value(keyString)' 2>/dev/null || true)"
have "$(printf '%s' "${KEY_RES}" | sed 's|.*/||') — reusing the key Identity Platform made"

step "what the app needs"
note "ISOCAN_AUTH_PROJECT=${PROJECT_ID}"
note "ISOCAN_AUTH_API_KEY=${KEY_STRING:-<gcloud services api-keys get-key-string ${KEY_RES} --project=${PROJECT_ID}>}"
note "neither is a secret: a browser key identifies a project and ships in the page."

step "Google and GitHub — a human step, deliberately not faked"
human "email-link sign-in is LIVE and is the floor. Nothing below is needed to use it."
human "Google:  console.cloud.google.com/auth → OAuth client (Web application),"
human "         redirect https://${PROJECT_ID}.firebaseapp.com/__/auth/handler,"
human "         then paste id+secret into the Google provider in the Identity Platform console."
human "GitHub:  github.com/settings/developers → New OAuth App, same callback,"
human "         then paste id+secret into the GitHub provider."
note "both need a consent screen and a secret this script must not invent, which is"
note "why they are words here rather than commands that would half-work."

step "done"
note "the desk reads an Identity Platform ID token and writes an ATTESTATION onto the"
note "badge — see docs/projects/multiuser/identity-desk.md, 'attestations ride the badge'. Nothing"
note "here creates an isocan account, because isocan does not have any."
