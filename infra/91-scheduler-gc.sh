#!/usr/bin/env bash
#
# STAGE C · the GC schedule — AND THIS SCRIPT CREATES NOTHING, FOREVER.
#
# CREATES   nothing, and never will. It explains, checks the explanation is
#           still true, and exits.
# COSTS     nothing.
#
# ═══ WHY ═══
#
# GC is not scheduled at this home because **the home collects its own
# garbage, on a timer inside the daemon process** (phase 13.7,
# `packages/server/src/gc.ts`, wired in `startGcSweeper` from `daemon.ts`).
# Every canvas the store holds, swept **a minute after the daemon starts
# serving and every interval after that** — an hour by default,
# `ISOCAN_GC_INTERVAL_MS` to change it — stopped with the daemon, and asking
# nobody at the door for permission, because nobody is at the door: the home is
# collecting after itself.
#
# THE SWEEP AFTER BOOT IS THE PART THAT MATTERS TO THIS DIRECTORY, because the
# deployment is what forced it. `config.sh` sets MIN_INSTANCES=0 for dev, and
# `70-cloud-run.sh` states the consequence: an idle instance lingers about
# fifteen minutes after the last request and then goes away. A timer whose
# first tick is an hour out therefore belongs to a process that was reaped
# forty-five minutes earlier — the sweeper would have run in the test suite and
# never once on this home, with green tests and a silent log to say so. If this
# service is ever given MIN_INSTANCES=1 (prod will want it, ~$48/month), the
# hourly rhythm becomes the one that does the work and the boot sweep becomes
# the cheap first one. Both are correct under both settings; only the boot
# sweep is correct under scale-to-zero.
#
# Not the obstacle, since it is the first thing anyone suspects: CPU
# throttling. This service runs with --no-cpu-throttling (70-cloud-run.sh), so
# timers really do fire between requests. Instance LIFETIME was the whole of it.
#
# That is a DECISION and not a workaround, so this file no longer waits for
# anything. It used to hold the argument open with three ways out, and to exit
# non-zero to make sure a reader noticed. The argument closed:
#
# 1. THE DOOR ADMITS BADGES, AND CLOUD SCHEDULER CANNOT HOLD ONE.
#    `presentedBadge` reads `Authorization: Bearer …` and runs the value
#    through `parseBadgeToken`, which expects `<badgeId>.<secret>`. A Google
#    OIDC identity token is a JWT; it parses as nothing, so a scheduler's
#    request arrives badge-less and is correctly refused. "Behind the door like
#    every route" was right as a policy and impossible as a mechanism.
#
#    The two ways to give a cron a badge were both worse than the chore:
#    mint one and keep the token in Secret Manager (a long-lived robot key,
#    admitted to every canvas it must sweep, against the desk's whole posture
#    that a badge belongs to a person or a daemon), or teach the door a second
#    kind of carrier for maintenance routes (a new kind of caller admitted to
#    the home — a desk decision, taken for housekeeping).
#
# 2. THE HOME-WIDE ROUTE EXISTS NOW, AND IS NOT WHAT SWEEPS THE HOME.
#    `POST /api/gc` was wanted either way, and it shipped in the same change:
#    it is a person or an agent saying "collect everything I can reach", and it
#    sweeps exactly the canvases the CALLING BADGE is admitted to — never the
#    store's own list, or a badge would be deleting bytes on canvases it was
#    never let into. So it is not a route a scheduler could usefully hold even
#    if it could get through the door: a badge minted for a cron is admitted to
#    nothing, and a sweep of nothing is what it would perform.
#
# The timer needs neither of those, and the fit is exact: garbage accrues only
# while a home is in USE, which is precisely when an instance is alive, and a
# sweep that runs late reclaims the same bytes a sweep on time would have. Like
# presence, it leans on this home being exactly one instance — one home, one
# sweeper — which is the same bet Cloud Run's `min = max = 1` already makes.
#
# ═══ WHAT THIS SCRIPT STILL DOES ═══
#
# It checks that the reason is still the reason. The failure mode this guards
# against is a home with NO garbage collection at all and nobody noticing:
# somebody removes the sweeper, and the only trace is a bucket that grows. So
# the greps below look for the sweep in the code, and this script fails if it
# has gone missing — which is the opposite of what it used to check, and the
# only check left worth making from infra/.
#
# `40-service-account.sh` grants ${OPS_SA} roles/run.invoker. It is now
# unnecessary for GC and harmless; the account still needs the Firestore export
# job, and narrowing it is not this file's business.

source "$(dirname -- "${BASH_SOURCE[0]}")/lib/common.sh"
preflight
require_project

step "checking that the home still collects itself"

FOUND_SWEEPER="no"
if grep -rq 'startGcSweeper' "${REPO_ROOT}/packages/server/src/daemon.ts" 2>/dev/null; then
  FOUND_SWEEPER="yes"
fi

FOUND_ROUTE="no"
if grep -rq 'app\.post(HOME_GC_ROUTE' "${REPO_ROOT}/packages/server/src/http.ts" 2>/dev/null; then
  FOUND_ROUTE="yes"
fi

note "in-process GC timer (startGcSweeper in daemon.ts): ${FOUND_SWEEPER}"
note "home-wide route (POST /api/gc):                    ${FOUND_ROUTE}"

if [ "${FOUND_SWEEPER}" != "yes" ]; then
  die "the daemon no longer starts a GC sweeper — this home would run un-swept with no job to cover for it. Put it back, or decide GC again on purpose and rewrite this file."
fi

if [ "${FOUND_ROUTE}" != "yes" ]; then
  warn "POST /api/gc is gone — nobody can ask this home to collect now."
  warn "The timer still runs, so nothing is leaking; the on-demand half is missing."
fi

step "no job created, and none is wanted"
note "GC runs inside the daemon: a minute after each start, then every"
note "ISOCAN_GC_INTERVAL_MS (default 1h) — so a scale-to-zero home still collects."
note "to collect on demand: isocan gc --all  (or POST /api/gc with your badge)"
note "to watch it on this home: gcloud run services logs read ${SERVICE} --project=${PROJECT_ID} --region=${REGION} | grep 'GC swept'"
exit 0
