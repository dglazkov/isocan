#!/usr/bin/env bash
#
# THE ONE HONEST PROOF THAT NEEDS NO CLOUD ACCOUNT.
#
# Builds the image and runs the CONTAINERIZED daemon with ISOCAN_STORE=cloud
# against local stand-ins for both cloud services, then drives it with the
# isocan CLI — the same client an agent uses — and RESTARTS THE CONTAINER to
# prove the canvas lives in the backing rather than in the process.
#
# CREATES   nothing in anybody's cloud. Three local containers and a JVM.
# COSTS     nothing.
# ASSUMES   Docker is running; a Java 21+ JRE and the gcloud Firestore
#           emulator component are available (or FIRESTORE_EMULATOR_HOST
#           already points at one you started).
# UNDO      the trap below removes everything it made, including on Ctrl-C.
#
# ═══ WHAT THIS PROVES, AND WHAT IT DOES NOT ═══
#
# Proves: the image builds; the container boots and binds an interface the
# outside can reach; `ISOCAN_STORE=cloud` resolves the dynamic import of
# @isocan/cloudstore through the workspace symlinks that survived the prune;
# a canvas is created, an op is applied, both are written to a Firestore and an
# object store; and after `docker restart` — a brand-new process with an empty
# /tmp — the canvas and the op are still there, recovered through the ordinary
# snapshot-plus-tail boot path. That is the deploy story rehearsed on a laptop.
#
# Does NOT prove: anything about GCS itself. `fake-gcs-server` is a stand-in,
# and the @google-cloud/storage client talks to it through STORAGE_EMULATOR_HOST
# with authentication disabled — which means it also does not exercise signing,
# IAM, or the create-only precondition. Those three are exactly what
# `infra/signed-url-smoke.sh` exists for, and they need a real bucket. Two
# scripts because they are two different questions.

source "$(dirname -- "${BASH_SOURCE[0]}")/lib/common.sh"

PROJECT="demo-isocan-e2e"     # `demo-` is the emulator-only convention the
                              # cloud fixtures already enforce; nothing here
                              # can reach a real project.
E2E_BUCKET="isocan-e2e"
IMAGE_TAG="isocan-e2e:local"
HOME_PORT="${ISOCAN_E2E_PORT:-4498}"
GCS_PORT="${ISOCAN_E2E_GCS_PORT:-4443}"
GCS_CONTAINER="isocan-e2e-gcs"
HOME_CONTAINER="isocan-e2e-home"
SCRATCH="$(mktemp -d)"
EMULATOR_PID=""
STARTED_EMULATOR="no"

cleanup() {
  step "cleaning up"
  docker rm -f "${HOME_CONTAINER}" >/dev/null 2>&1 && note "removed ${HOME_CONTAINER}" || true
  docker rm -f "${GCS_CONTAINER}" >/dev/null 2>&1 && note "removed ${GCS_CONTAINER}" || true
  if [ "${STARTED_EMULATOR}" = "yes" ] && [ -n "${EMULATOR_PID}" ]; then
    # The process GROUP: `gcloud emulators firestore start` is a python wrapper
    # that forks a JVM, and killing the wrapper alone leaves a java process
    # holding the port. test/emulator.ts learned this the hard way after a
    # 22-second straggler; the same posture applies here.
    kill -TERM -"${EMULATOR_PID}" 2>/dev/null || true
    sleep 2
    kill -KILL -"${EMULATOR_PID}" 2>/dev/null || true
    note "stopped the Firestore emulator"
  fi
  rm -rf "${SCRATCH}"
}
trap cleanup EXIT INT TERM

# ---------------------------------------------------------------- guards

step "what this machine has"
command -v docker >/dev/null 2>&1 || die "no docker on PATH"
docker info >/dev/null 2>&1 || die "the Docker daemon is not running — start Docker Desktop and re-run"
note "docker: up"

# ---------------------------------------------------------------- Firestore

find_java21() {
  # Same order of confidence test/emulator.ts uses, and for the same reason: a
  # machine with more than one JVM thing on it normally has 17 first on PATH
  # and 21 installed keg-only beside it. The emulator refuses anything under
  # 21, and it refuses it with a message that reads like "no java at all".
  if [ -n "${JAVA_HOME:-}" ] && [ -x "${JAVA_HOME}/bin/java" ]; then
    echo "${JAVA_HOME}/bin/java"; return
  fi
  for candidate in \
    "$(/usr/libexec/java_home -v 21 2>/dev/null)/bin/java" \
    /opt/homebrew/opt/openjdk@21/bin/java \
    /usr/local/opt/openjdk@21/bin/java \
    /usr/lib/jvm/java-21-openjdk-amd64/bin/java
  do
    [ -x "${candidate}" ] && { echo "${candidate}"; return; }
  done
  # Last resort: whatever is on PATH, IF it is 21+.
  if command -v java >/dev/null 2>&1; then
    local v
    v="$(java -version 2>&1 | head -1 | sed -E 's/.*"([0-9]+).*/\1/')"
    [ "${v:-0}" -ge 21 ] 2>/dev/null && { command -v java; return; }
  fi
  echo ""
}

step "Firestore emulator"
if [ -n "${FIRESTORE_EMULATOR_HOST:-}" ]; then
  have "using the one you started: ${FIRESTORE_EMULATOR_HOST}"
  FS_PORT="${FIRESTORE_EMULATOR_HOST##*:}"
else
  command -v gcloud >/dev/null 2>&1 || die "no gcloud, and FIRESTORE_EMULATOR_HOST is not set"
  JAVA="$(find_java21)"
  [ -n "${JAVA}" ] || die "no Java 21+ JRE (the emulator refuses less; brew install openjdk@21, or set JAVA_HOME)"
  note "java: ${JAVA}"
  FS_PORT="${ISOCAN_E2E_FIRESTORE_PORT:-8686}"
  # 0.0.0.0, not 127.0.0.1: the container reaches this across the Docker
  # bridge, and an emulator bound to loopback is invisible from inside one.
  #
  # setsid/its own process group so cleanup can take the JVM with it. The JRE
  # goes in FRONT of PATH rather than replacing it — gcloud is a python program
  # that needs the rest of the environment intact.
  PATH="$(dirname "${JAVA}"):${PATH}" \
    setsid gcloud emulators firestore start --host-port="0.0.0.0:${FS_PORT}" \
      >"${SCRATCH}/firestore.log" 2>&1 &
  EMULATOR_PID=$!
  STARTED_EMULATOR="yes"
  for i in $(seq 1 60); do
    curl -fsS "http://127.0.0.1:${FS_PORT}/" >/dev/null 2>&1 && break
    sleep 1
    [ "$i" = "60" ] && { cat "${SCRATCH}/firestore.log" >&2; die "the emulator did not come up on :${FS_PORT} in 60s"; }
  done
  made "Firestore emulator on :${FS_PORT}"
fi

# ---------------------------------------------------------------- object store

step "object store stand-in"
docker rm -f "${GCS_CONTAINER}" >/dev/null 2>&1 || true
# -public-host / -external-url matter: the client library follows the URLs this
# server hands back, and a server that names itself "localhost" is naming the
# CONTAINER's localhost once the daemon is the one calling.
docker run -d --name "${GCS_CONTAINER}" \
  -p "${GCS_PORT}:4443" \
  fsouza/fake-gcs-server \
  -scheme http -port 4443 -backend memory \
  -public-host "host.docker.internal:${GCS_PORT}" \
  -external-url "http://host.docker.internal:${GCS_PORT}" >/dev/null
for i in $(seq 1 30); do
  curl -fsS "http://127.0.0.1:${GCS_PORT}/storage/v1/b?project=${PROJECT}" >/dev/null 2>&1 && break
  sleep 1
  [ "$i" = "30" ] && { docker logs "${GCS_CONTAINER}" >&2; die "fake-gcs-server never answered"; }
done
curl -fsS -X POST "http://127.0.0.1:${GCS_PORT}/storage/v1/b?project=${PROJECT}" \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"${E2E_BUCKET}\"}" >/dev/null
made "gs://${E2E_BUCKET} on :${GCS_PORT}"

# ---------------------------------------------------------------- the image

step "building the image"
cd "${REPO_ROOT}"
docker build -t "${IMAGE_TAG}" --build-arg "ISOCAN_BUILD_SHA=e2e-$(date +%s)" .
made "${IMAGE_TAG}"

# ---------------------------------------------------------------- the home

start_home() {
  docker run -d --name "${HOME_CONTAINER}" \
    --add-host=host.docker.internal:host-gateway \
    -p "${HOME_PORT}:8080" \
    -e PORT=8080 \
    -e ISOCAN_STORE=cloud \
    -e ISOCAN_GCP_PROJECT="${PROJECT}" \
    -e ISOCAN_BUCKET="${E2E_BUCKET}" \
    -e "FIRESTORE_EMULATOR_HOST=host.docker.internal:${FS_PORT}" \
    -e "STORAGE_EMULATOR_HOST=http://host.docker.internal:${GCS_PORT}" \
    "${IMAGE_TAG}" >/dev/null
}

wait_healthy() {
  for i in $(seq 1 90); do
    if curl -fsS "http://127.0.0.1:${HOME_PORT}/healthz" >/dev/null 2>&1; then
      note "healthy after ${i}s"; return 0
    fi
    sleep 1
  done
  echo "--- container logs ---" >&2
  docker logs "${HOME_CONTAINER}" >&2 || true
  die "the containerized home never answered /healthz"
}

step "starting the containerized home (ISOCAN_STORE=cloud)"
docker rm -f "${HOME_CONTAINER}" >/dev/null 2>&1 || true
start_home
wait_healthy
made "http://127.0.0.1:${HOME_PORT}"

# ---------------------------------------------------------------- drive it

# The CLI is the client, deliberately: the isomorphism thesis says it and the
# web app are equals, so proving the home with the CLI proves the home.
export ISOCAN_HOME="${SCRATCH}/cli"
export ISOCAN_SESSION_ID="e2e-$(date +%s)-$$"
export ISOCAN_HARNESS="infra/local-e2e.sh"
mkdir -p "${ISOCAN_HOME}"
ISO=(node "${REPO_ROOT}/packages/cli/bin/isocan.js" --port "${HOME_PORT}")

# Work from a directory with NO `.isocan/project.json` marker in it or above.
# The repo root has one (#60 binds a directory to a canvas), and running here
# would make the very first CLI command auto-create THAT canvas on the home
# under its real title — carrying a name out of somebody's working canvas into
# a test, which AGENTS.md forbids for exactly this reason. A scratch directory
# has no binding, so every canvas below is one this script made.
mkdir -p "${SCRATCH}/cwd"
cd "${SCRATCH}/cwd"

step "naming the client"
# A non-TTY caller names its own SESSION, never the machine's owner. The name
# is synthetic: AGENTS.md's rule about never carrying a real canvas's names
# into the repo applies to a test fixture just as much.
"${ISO[@]}" identity --name "Acme E2E" --session >/dev/null
note "$("${ISO[@]}" whoami 2>/dev/null | head -1)"

step "creating a canvas"
CREATED="$("${ISO[@]}" --json project create "Acme e2e canvas")"
# `isocan --json project create` prints `{ projectId }`. The fallbacks are for
# the day that changes; a missing id fails loudly two lines down either way.
PROJECT_ID="$(printf '%s' "${CREATED}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.projectId??j.id??j.project?.id??"")})')"
[ -n "${PROJECT_ID}" ] || { echo "${CREATED}" >&2; die "could not read the new canvas id"; }
made "canvas ${PROJECT_ID}"

step "applying an op"
# `comment add` insists on an anchor: --item or --at. A freestanding pin at
# world coordinates needs no item to exist first, which is what makes it the
# cheapest real op to write here.
"${ISO[@]}" --project "${PROJECT_ID}" comment add "an op that has to survive a restart" --at 100,100 >/dev/null
BEFORE="$("${ISO[@]}" --json --project "${PROJECT_ID}" comment list)"
note "threads before restart: $(printf '%s' "${BEFORE}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(Array.isArray(j)?j.length:"?")})')"

# ---------------------------------------------------------------- the proof

step "RESTARTING THE CONTAINER"
# This is the whole point. A restart is a new process with an empty /tmp and no
# in-memory anything — the same path a Cloud Run deploy, a crash, and an
# instance recycle all take. What comes back has to come back from Firestore
# and the object store.
docker restart "${HOME_CONTAINER}" >/dev/null
wait_healthy

step "is it still there?"
LIST="$("${ISO[@]}" --json project list --all)"
if printf '%s' "${LIST}" | grep -q "${PROJECT_ID}"; then
  made "the canvas survived: ${PROJECT_ID}"
else
  echo "${LIST}" >&2
  die "the canvas is GONE after a restart — the backing did not hold it"
fi

AFTER="$("${ISO[@]}" --json --project "${PROJECT_ID}" comment list)"
if [ "$(printf '%s' "${AFTER}" | tr -d ' \n')" = "$(printf '%s' "${BEFORE}" | tr -d ' \n')" ]; then
  made "the op survived, byte for byte"
else
  printf 'before: %s\nafter:  %s\n' "${BEFORE}" "${AFTER}" >&2
  die "the comment thread changed across the restart"
fi

step "what is actually in the backing"
note "objects in gs://${E2E_BUCKET}:"
curl -fsS "http://127.0.0.1:${GCS_PORT}/storage/v1/b/${E2E_BUCKET}/o" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const o of (JSON.parse(s).items??[]))console.log("      "+o.name+"  "+o.size+" bytes")})'

step "PASSED"
note "the image builds, the containerized daemon runs on the cloud backing,"
note "and a canvas survives the process that made it."
note ""
note "Still unproven here, by construction: real GCS, real signing, and the"
note "create-only precondition. That is infra/signed-url-smoke.sh, and it needs a bucket."
