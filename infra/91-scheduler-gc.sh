#!/usr/bin/env bash
#
# STAGE C · the GC schedule — AND THIS SCRIPT DELIBERATELY CREATES NOTHING.
#
# CREATES   nothing. It explains, checks, and exits non-zero.
# COSTS     nothing.
#
# ═══ WHY ═══
#
# The architecture says:
#
#     GC — Cloud Scheduler calls the existing GC endpoint on a schedule,
#     authenticated by OIDC service identity, behind the door like every route.
#
# That sentence is not implementable against today's daemon, for two
# independent reasons, and writing a job that quietly 401s every night would be
# worse than not writing one.
#
# 1. THE DOOR DOES NOT KNOW WHAT AN OIDC TOKEN IS.
#    `presentedBadge` reads `Authorization: Bearer …` and runs the value
#    through `parseBadgeToken`, which expects `<badgeId>.<secret>`. A Google
#    OIDC identity token is a JWT; it parses as nothing, so the request is
#    badge-less, and `/api/projects/:id/gc` is not in `isOpen`'s allowlist.
#    The scheduler gets 401 `badge-required` — correctly. "Behind the door like
#    every route" is exactly right as a policy and exactly the problem as a
#    mechanism: the door admits BADGES, and Cloud Scheduler cannot hold one.
#
# 2. THERE IS NO HOME-WIDE GC ENDPOINT.
#    The only route is `POST /api/projects/:id/gc` — one canvas at a time. A
#    scheduler job would need the canvas ids, which it cannot know, and the
#    list grows. Sweeping a home means enumerating it, and nothing exposes that
#    as one call.
#
# ═══ THE THREE WAYS OUT, none of which this script may choose ═══
#
#   a) A HOME-WIDE ROUTE. `POST /api/gc` that walks `listProjects()` and calls
#      the same `engine.gc` per canvas. One route, no new concepts, and it is
#      the thing a person would also want ("collect the whole home"). Still
#      needs an answer to (1).
#
#   b) A BADGE FOR THE SCHEDULER. Mint one, store the token in Secret Manager,
#      have the job send it as a bearer. Works today with no code change — but
#      it puts a long-lived credential in a header on a cron, admits it to
#      every canvas it must sweep, and the desk's own posture is that a badge
#      is a person's or a daemon's, not a robot's standing key.
#
#   c) A SECOND CARRIER AT THE DOOR: teach `presentedBadge`/`resolveBadge` that
#      a verified Google OIDC token from a known service account is a
#      recognized caller for a small set of maintenance routes. This is what
#      the architecture's sentence actually describes, and it is a desk
#      decision — a new kind of thing the door admits — not a provisioning one.
#
# (c) is what the map says. (a) is needed either way. Both are code, and code
# in this phase belongs to whoever the conductor sends, not to a shell script
# in infra/. Phase 5's Work now carries this.
#
# ═══ MEANWHILE ═══
#
# Nothing is leaking. GC is not load-bearing for correctness — it reclaims
# blobs no live entry references, and the bucket bill for not reclaiming them
# is measured in cents at journey scale. A home can run un-swept for a long
# time. It should not run un-swept forever.

source "$(dirname -- "${BASH_SOURCE[0]}")/lib/common.sh"
preflight
require_project

step "checking whether the blocker is still real"

FOUND_GLOBAL="no"
if grep -rq 'app\.post("/api/gc"' "${REPO_ROOT}/packages/server/src/http.ts" 2>/dev/null; then
  FOUND_GLOBAL="yes"
fi

FOUND_OIDC="no"
if grep -rq 'oidc\|id_token\|verifyIdToken' "${REPO_ROOT}/packages/server/src/badges.ts" 2>/dev/null; then
  FOUND_OIDC="yes"
fi

note "home-wide GC route (POST /api/gc): ${FOUND_GLOBAL}"
note "door recognizes an OIDC carrier:   ${FOUND_OIDC}"

if [ "${FOUND_GLOBAL}" = "yes" ] && [ "${FOUND_OIDC}" = "yes" ]; then
  step "both blockers are gone"
  note "This script is now out of date — it should create the job. The command it would run:"
  cat <<CMD

  gcloud scheduler jobs create http isocan-gc \\
    --project=${PROJECT_ID} \\
    --location=${REGION} \\
    --schedule='42 4 * * *' --time-zone=Etc/UTC \\
    --uri="\$(gcloud run services describe ${SERVICE} --project=${PROJECT_ID} --region=${REGION} --format='value(status.url)')/api/gc" \\
    --http-method=POST \\
    --oidc-service-account-email=${OPS_SA} \\
    --oidc-token-audience="\$(gcloud run services describe ${SERVICE} --project=${PROJECT_ID} --region=${REGION} --format='value(status.url)')" \\
    --attempt-deadline=15m

CMD
  note "${OPS_SA} already holds roles/run.invoker — 40-service-account.sh granted it in advance."
  die "refusing to create it anyway: this file has not been reviewed since the blockers were fixed. Update it deliberately."
fi

step "no job created"
warn "GC is NOT scheduled on this home, on purpose. Read the header of this file."
note "the fix is code, and it is in Phase 5's Work."
exit 1
