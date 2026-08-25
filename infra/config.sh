# The one file that names the home. Sourced by every script in this directory.
#
# EVERY name here is overridable from the environment, and two of them are
# GLOBALLY UNIQUE across all of Google Cloud — the project id and the bucket.
# Either may already belong to a stranger. When one is taken, you change it
# HERE, once, and every script follows; you do not edit a script. See
# "When a name is taken" in README.md.
#
# Nothing in this directory reads `gcloud config`. The machine this was
# written on has an ambient project of `dandy-horse-3` and an ambient region of
# `us-central1`, and inheriting either would build the home in the wrong place
# in somebody else's project — quietly, and only half of it. So `--project` and
# `--region`/`--location` are passed EXPLICITLY on every command, and
# lib/common.sh additionally exports the CLOUDSDK_* overrides as a second
# fence around any flag somebody forgets.

# ---- the two globally unique names ----

# The GCP project. Globally unique; permanent (a deleted project id can never
# be reused, by you or anyone). `isocan-dev` was the architecture's shorthand
# and is not what got created: it is ambiguous about whose isocan it is, so the
# domain went into the name.
PROJECT_ID="${ISOCAN_GCP_PROJECT:-isocan-io-dev}"

# Who pays, and under whom. Both are the user's own — the billing account is a
# PERSONAL card, which is why README.md's cost section is written the way it
# is. Overridable so that `isocan-io-prod` (and anyone else's home) walks the
# same scripts.
BILLING_ACCOUNT="${ISOCAN_BILLING_ACCOUNT:-01F457-866EA8-5F9590}"
ORG_ID="${ISOCAN_ORG_ID:-705284693824}"   # glazkov.com

# The canvas bucket: blobs, snapshots, oplog archives. Globally unique, and the
# likelier of the two to collide — the bucket namespace is far more crowded
# than the project namespace. Defaults to the project id so the two move
# together, which is also how you can tell at a glance that a bucket belongs to
# this home.
BUCKET="${ISOCAN_BUCKET:-${PROJECT_ID}-canvas}"

# Firestore exports land here, not in the canvas bucket: a backup that shares a
# lifecycle with the thing it backs up is not a backup.
BACKUP_BUCKET="${ISOCAN_BACKUP_BUCKET:-${PROJECT_ID}-backups}"

# ---- place ----

# The architecture's Givens: one region, compute and Firestore and buckets
# co-located. A Firestore database's location CANNOT BE CHANGED after creation
# — see README.md's one-way doors.
REGION="${ISOCAN_REGION:-us-west1}"

# ---- names that are only unique within the project ----

SERVICE="${ISOCAN_SERVICE:-isocan}"
RUNTIME_SA_NAME="${ISOCAN_RUNTIME_SA:-isocan-run}"
BUILD_SA_NAME="${ISOCAN_BUILD_SA:-isocan-build}"
OPS_SA_NAME="${ISOCAN_OPS_SA:-isocan-ops}"
AR_REPO="${ISOCAN_AR_REPO:-isocan}"

RUNTIME_SA="${RUNTIME_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
BUILD_SA="${BUILD_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
OPS_SA="${OPS_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

IMAGE_REPO="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/${SERVICE}"

# ---- the front door ----

DOMAIN="${ISOCAN_DOMAIN:-dev.isocan.io}"
LB_IP_NAME="${ISOCAN_LB_IP_NAME:-isocan-ip}"
NEG_NAME="${ISOCAN_NEG_NAME:-isocan-neg}"
BACKEND_NAME="${ISOCAN_BACKEND_NAME:-isocan-backend}"
URLMAP_NAME="${ISOCAN_URLMAP_NAME:-isocan-urlmap}"
CERT_NAME="${ISOCAN_CERT_NAME:-isocan-cert}"

# ---- the shape of the instance ----
#
# max = 1 is the single-writer promise expressed as a flag. min differs by
# environment on purpose (architecture, "Why min-instances is 1 in prod"): dev
# scales to zero so every dev request cold-boots through the crash-recovery
# path, prod holds one so a parked agent's socket is not hung up on.
#
# READ THIS BEFORE BELIEVING max=1 MEANS ONE PROCESS: --max-instances is per
# REVISION, not per service. During a rollout the old revision drains while the
# new one serves, and for those seconds two instances exist. That is the
# "deploy overlap" the architecture names, and the create-only precondition on
# `ops/{seq}` is what makes it safe. No flag here prevents it, and none should.
MIN_INSTANCES="${ISOCAN_MIN_INSTANCES:-0}"
MAX_INSTANCES="${ISOCAN_MAX_INSTANCES:-1}"
CPU="${ISOCAN_CPU:-1}"
MEMORY="${ISOCAN_MEMORY:-1Gi}"

# One socket holds one request slot for its lifetime, so this number IS the
# connection ceiling the architecture states in the ceiling section.
CONCURRENCY="${ISOCAN_CONCURRENCY:-1000}"

# An hour, matching the LB backend timeout. A socket that hits it drops and
# reconnects by seq cursor, which is journey rule 4 rather than a mitigation.
# 3600 is Cloud Run's maximum; it cannot be raised.
REQUEST_TIMEOUT="${ISOCAN_REQUEST_TIMEOUT:-3600}"

# The port the container listens on. Cloud Run injects PORT into the container;
# the entrypoint copies it to ISOCAN_PORT. 8080 is Cloud Run's default.
CONTAINER_PORT="${ISOCAN_CONTAINER_PORT:-8080}"

# ---- who may reach the service directly ----
#
# **The rate limit's real bypass, closed by a flag** (phase 13.7's open
# finding, decided in phase 14). `--ingress=all` leaves the `*.run.app` URL
# reachable AROUND the load balancer, and on that path the forwarded chain is
# short enough that the entry `meter.ts` keys on is caller-supplied — so a
# flooder who finds that address mints badges without limit by varying an
# `X-Forwarded-For` it made up. `internal-and-cloud-load-balancing` makes the
# LB the only way in, and then every request carries a chain the infrastructure
# appended.
#
# The blast radius, stated because it is the whole reason this is a decision:
# the `*.run.app` URL stops answering ENTIRELY. Health checks, `curl` against
# the service, and 70-cloud-run.sh's own final check must all go through the
# domain — so this may only be set on a home whose Stage B has finished, and
# 70-cloud-run.sh checks the domain instead when it is set.
#
# **Dev stays open on purpose.** Its run.app URL is what several proofs from
# phase 5 onward were measured against, and a home with no strangers on it has
# nothing to protect from the bypass. Prod is where strangers arrive.
INGRESS="${ISOCAN_INGRESS:-all}"

# How many trailing `X-Forwarded-For` entries this home's infrastructure
# appends — `meter.ts`'s `ISOCAN_PROXY_HOPS`, named here because an operator
# looks in infra/ and not in a TypeScript file. Empty means the code's own
# default of 1 (Google's external ALB appends the client address and then its
# own, so one from the right is the client). Set it only after MEASURING the
# real chain against this home: refusals climbing while the meter's
# distinct-key count sits at 1 is the whole-internet-in-one-bucket signature,
# and it is logged with every refusal for exactly that reason.
PROXY_HOPS="${ISOCAN_PROXY_HOPS:-}"
