# Provisioning the dev home

This directory is Phase 5's ⚑ provision half: **small idempotent gcloud
scripts** (the [architecture](../docs/architecture.md)'s own words — Terraform
waits for a second operator). Every script is safe to run twice. Each one
checks before it creates, so a half-finished run is **resumed, not restarted**
— which matters, because a couple of the steps end in "now go wait for Google".

Nothing here runs itself. This file is the decision; `provision.sh` is the
button.

---

## The shape of it

Four stages, deliberately separable, because they are four different questions
and three of them cost different amounts of money.

| stage | what you get | bills at rest | needs a human |
| --- | --- | --- | --- |
| **A · the home** | a working hosted isocan at an ugly `*.run.app` URL, on a real Firestore and a real bucket | **~$0.20/month** | billing link (once) |
| **B · the front door** | `dev.isocan.io`, HTTPS, Cloud CDN | **~$18/month** | a DNS A record |
| **C · the keeping** | nightly Firestore export, uptime check | ~$0.05/month | an email address (optional) |
| **D · continuous deploy** | push to `main` → dev is running it | $0 | a browser OAuth step |

Stage A is the interesting one and the cheap one. **You can stop after it,
look at a real home, and decide about the domain separately.** That is why it
is a stage.

---

## Money, split the way it actually behaves

The number that matters when you are spending your own money is not the
monthly total — it is **what accrues while nobody is using the thing at all.**
Those are two different lists.

### Bills whether or not anyone visits

| thing | dev, at rest | why |
| --- | --- | --- |
| Cloud Run service, `min-instances=0` | **$0.00** | no instance exists, so nothing is billed. This is the whole reason dev runs at zero. |
| Firestore storage + PITR | ~$0.05 | ~$0.18/GiB-month. A database holding a few canvases is megabytes. |
| Cloud Storage | ~$0.02 | ~$0.020/GiB-month. Snapshots and blobs. |
| Artifact Registry | ~$0.05 | first 0.5 GiB free; the cleanup policy keeps the last 10 images. |
| Cloud Scheduler, uptime check, Cloud Logging, managed cert | $0.00 | all inside free tiers at this size. |
| **Stage A + C floor** | **≈ $0.15–0.30 / month** | |
| **Global load balancer (Stage B)** | **≈ $18.25 / month** | ~$0.025/hour for the forwarding rules, charged by the hour, forever, with zero traffic. |
| **Stage A + B + C floor** | **≈ $18.50 / month** | |

That $18.25 is the entire reason Stage B is a separate decision. It is not a
Google surcharge you can tune away — a global external HTTPS load balancer
costs that to exist. There is no cheaper way to get `dev.isocan.io` with a
managed certificate and a WebSocket that survives an hour.

*(The cheaper alternative, named so you know it was considered: skip Stage B
and use the `*.run.app` URL, which is free, has a valid certificate, and
supports WebSockets. What it does not give you is your own domain, the CDN, or
one origin that survives redeploying the service. For dev that may be a
perfectly good trade for a while.)*

### Bills per use

| thing | rate | at journey scale |
| --- | --- | --- |
| Cloud Run, while an instance is alive | ~$0.072/hour (1 vCPU + 1 GiB, CPU always allocated); an idle instance lingers ~15 min after the last request | the monthly free tier covers roughly the first **50 hours**, so ordinary dev use is very likely **$0** |
| Firestore | ~$0.03 per 100,000 reads, ~$0.09 per 100,000 writes | one op is one document write. Thousands of ops is a cent. |
| Load balancer data processing | ~$0.01/GiB | cents |
| Cloud CDN egress | ~$0.08/GiB (North America) | cents |
| Cloud Run egress (blob downloads stream through the daemon) | ~$0.12/GiB | **this is the one that can move.** A canvas full of video, downloaded often, is the only line here with real upside. |
| Cloud Build | 2,500 free build-minutes/month | $0 |

**Assumptions behind every number above:** `us-west1` (Oregon), list prices as
of the time of writing, one small project, no committed-use discount, no
support plan, and the standard monthly free tiers applied. They are order of
magnitude, not a quote. Check the actual bill after the first month rather
than trusting a table written before any data existed — and set a budget
alert, which is free:

```
gcloud billing budgets create \
  --billing-account=01F457-866EA8-5F9590 \
  --display-name="isocan dev" \
  --budget-amount=30USD \
  --threshold-rule=percent=0.5 --threshold-rule=percent=0.9 --threshold-rule=percent=1.0
```

### And what prod will cost, so it is not a surprise later

Phase 14 stands up `isocan-io-prod` with `min-instances=1` — an always-on
instance, because scale-to-zero would hang up on every parked agent. That is
**~$48/month for the instance plus ~$18/month for its load balancer, ≈ $66/month
that bills whether or not anyone visits.** Both environments together land
under $100/month, which is what the architecture's cost section says. Nothing
below provisions prod.

---

## The exact sequence

Everything is run from the repo root. No command below inherits your ambient
gcloud config — the scripts pass `--project` and an explicit location on every
call, and export the `CLOUDSDK_*` overrides as a second fence. Your config
currently points at `dandy-horse-3` / `us-central1`; it will be ignored, and
each script says so out loud.

### Before anything

```bash
gcloud auth login                      # if your token has expired
cat infra/config.sh                    # read it. It is the whole configuration.
```

Defaults: project `isocan-io-dev`, org `705284693824` (glazkov.com), billing
`01F457-866EA8-5F9590`, region `us-west1`, buckets `isocan-io-dev-canvas` and
`isocan-io-dev-backups`, domain `dev.isocan.io`.

### Stage A — the home  (~10 minutes, ~$0.20/month)

```bash
./infra/provision.sh a
```

which runs, in order:

```bash
./infra/10-project.sh            # project under the org, billing link, 16 APIs
./infra/20-firestore.sh          # the (default) database in us-west1 + PITR   ⚠ one-way door
./infra/30-bucket.sh             # gs://isocan-io-dev-canvas, gs://isocan-io-dev-backups
./infra/40-service-account.sh    # 3 service accounts + roles, incl. the self-binding
./infra/50-artifact-registry.sh  # the docker repo + a cleanup policy
./infra/60-build-image.sh        # builds THIS working tree — no GitHub involved
ISOCAN_IMAGE_TAG=<sha> ./infra/70-cloud-run.sh
```

**Then stop.** You have a home. Open the `*.run.app` URL it prints.

And run the proof phase 4 could not:

```bash
gcloud auth application-default login \
  --impersonate-service-account=isocan-run@isocan-io-dev.iam.gserviceaccount.com
./infra/signed-url-smoke.sh
```

Three assertions, each PASS / FAIL / UNPROVEN, and an UNPROVEN is not a pass.
See "The signed-URL smoke test" below for why the impersonation matters.

### Stage B — the front door  (+~$18/month, and a wait)

```bash
./infra/provision.sh b
```

The ordering here is fussy and it is where people get stuck, so it is spelled
out:

1. `80-load-balancer.sh` reserves a **static IP** and prints it.
2. It builds the NEG, backend service (CDN on), URL map, managed certificate,
   HTTPS proxy, and both forwarding rules. **The ~$18/month clock starts at
   the forwarding rule.**
3. **You** add a DNS record at whoever hosts `isocan.io`:
   ```
   dev.isocan.io.   A   <the IP the script printed>
   ```
4. The certificate sits in `PROVISIONING` until Google resolves
   `dev.isocan.io` and finds it pointing at that load balancer. **Typically
   ten minutes; sometimes a couple of hours.** Nothing is wrong. Watch it:
   ```bash
   ./infra/81-cert-status.sh --watch
   ```

**This route does NOT involve Search Console.** Verifying a domain through
Search Console is the requirement for *Cloud Run domain mappings*, which is a
different (and more limited) product. A Google-managed certificate on a load
balancer validates by checking that the domain resolves to the load balancer's
IP — that is all. If a doc sends you to Search Console, it is describing the
other thing.

### Stage C — the keeping  (~cents)

```bash
./infra/provision.sh c
ISOCAN_ALERT_EMAIL=you@example.com ./infra/92-uptime-check.sh   # if you want mail
```

`90-backup-export.sh` also **runs the export once immediately**, because a
scheduled job nobody has ever watched run is a scheduled job that does not
work. Re-running the script is safe and simply writes another export.

**Every run lands in its own folder, and the missing path in the request is
what makes that happen.** The job asks Firestore to export to
`gs://isocan-io-dev-backups` — the bucket, with no folder after it — and the
API's contract is that a bucket without a namespace path gets "a prefix
generated based on the start time". So the bucket fills with
`2026-08-23T02:22:44_58412/`, one complete, self-consistent tree per night,
swept whole by the 90-day rule from `30-bucket.sh`. Ninety restore points, and
a bad export cannot land on top of a good one, because it never writes where a
good one already is.

The earlier version of this job named a fixed folder, `.../firestore`, and that
is a mistake worth recognising if you meet it elsewhere: it does not quietly
overwrite. Firestore checks for `.overall_export_metadata` before it starts and
refuses, so **the first run succeeds and every run after it returns HTTP 400**
— `INVALID_ARGUMENT: Path already exists: /BUCKET/firestore/firestore.overall_export_metadata`
— while the bucket goes on looking backed up. If a home was provisioned before
this fix it still has that folder; it is a valid export and importable, the
script points it out, and you can leave it or remove it once a new-shape run
has landed:

```bash
gcloud storage rm --recursive gs://isocan-io-dev-backups/firestore --project=isocan-io-dev
```

To restore: `gcloud firestore import gs://isocan-io-dev-backups/FOLDER --project=isocan-io-dev`.

**Object versioning is deliberately off on the backup bucket**, and this is the
reason rather than an omission: an export is a tree of objects, versioning is
per object, and `importDocuments` reads the live objects at a prefix and cannot
address a noncurrent generation. Recovering a versioned export would mean
hand-picking one generation per object — and since the number of `output-N`
shards moves with the database, a smaller export would leave a larger one's
tail shards live and the current tree would be a set that never existed. Under
the per-run prefix nothing is overwritten at all, so versioning has nothing to
retain and the ops account's `objectCreator` (create, but not replace) is
exactly the right grant.

**Firestore's own scheduled backups are not a rival to this and are not set
up.** They keep a copy inside Firestore's control plane, restorable in one
command into a database in the same project, retained up to 14 weeks, and they
survive the source database being deleted — but they cannot be copied out,
which is the whole property the export exists for. They are a sensible *third*
rung to add later (PITR for "what did it look like at 14:32", the export for
"give me the bytes", a managed backup for "put it back now"); they cost backup
storage and buy speed of restore, which is what this home needs least.

**The uptime check probes `/api/healthz`, not `/healthz`, and this is not a
preference.** Google's frontend swallows the exact path `/healthz` and answers
it itself with a branded 404; the request never reaches the container. Measured
on this home: `/` is 200, `/nonexistent-path` is 200 (our SPA fallback),
`/healthz/` with a trailing slash is 200, `/HEALTHZ` is 200, and `/healthz` is
404 — with no `/healthz` line in the container's request log, ever. A check
pointed at `/healthz` would therefore be watching Google's frontend rather than
the daemon: green whether or not the home is up. `/api/healthz` is the same
handler and the same body, on a prefix Google forwards. `/healthz` still exists
and is unchanged — it is what every localhost caller uses, including the CLI's
own daemon lifecycle — so this was an addition, not a rename.

GC is deliberately **not** scheduled. `./infra/91-scheduler-gc.sh` explains
why in full and exits non-zero rather than creating a job that would 401 every
night. Read it — it is the most important file in this directory that creates
nothing.

### Stage D — continuous deploy  ($0 until you push)

First, a browser: connect the GitHub repo to Cloud Build at
`https://console.cloud.google.com/cloud-build/triggers/connect?project=isocan-io-dev`,
choosing **GitHub (Cloud Build GitHub App)** and region `us-west1`. Then:

```bash
./infra/provision.sh d
```

---

## What needs a human, all in one place

| # | thing | why a script cannot |
| --- | --- | --- |
| 1 | **Linking the billing account** | spending money is a decision. `10-project.sh` asks out loud and refuses to guess. |
| 2 | **The `dev.isocan.io` A record** | it lives at whoever hosts DNS for `isocan.io`, which is outside this project entirely. |
| 3 | **Waiting for the managed certificate** | Google's schedule, not yours. |
| 4 | **Connecting GitHub to Cloud Build** | an OAuth consent screen and a GitHub App installation. No CLI clicks through it. |
| 5 | **An email address for alerts** (optional) | and Google sends a confirmation you must click before the channel delivers. |
| 6 | **Possibly: an org policy exception** | see below. |

### The org policy that may bite

`70-cloud-run.sh` grants `allUsers` the invoker role, because the isocan door
is a public front door — the badge is the credential isocan issues, and Cloud
Run IAM knows nothing about badges. Google turns on **Domain Restricted
Sharing** (`constraints/iam.allowedPolicyMemberDomains`) by default for
organizations, and it forbids granting anything to `allUsers`. If that binding
fails, the script stops and prints the exact per-project exception to apply.
The exception is scoped to this project, not the org.

---

## When a name is taken

Two names in `config.sh` are **globally unique across all of Google Cloud**,
so either may already belong to a stranger:

- `PROJECT_ID` (`isocan-io-dev`) — a project id is permanent and, once used,
  is never reusable by anyone.
- `BUCKET` (`isocan-io-dev-canvas`) — the more likely collision of the two;
  the bucket namespace is far more crowded.

If a create bounces with "already exists" or "already own", **change the
variable, not the script**:

```bash
ISOCAN_GCP_PROJECT=isocan-io-dev-7f3a ./infra/provision.sh a
# or, permanently, edit the default at the top of infra/config.sh
```

Everything else — the bucket names, the service account emails, the image
path — derives from those two, so one substitution moves the whole set.
Export the variable for the *whole* session rather than one command: the
failure mode this warns against is a home half in one project and half in
another, and that happens exactly when somebody re-runs one script with an
override and the next one without.

---

## One-way doors

Three things here cannot be undone or moved, and it is better to hear them now
than at the point of no return.

1. **A Firestore database's location is permanent.** Not by a flag, not by a
   support ticket. Moving regions means a second database and an
   export/import, with the home down. `us-west1` is the architecture's Given
   and Cloud Run and the buckets are co-located with it deliberately —
   cross-region reads on the durability path would put tens of milliseconds on
   every op, and that ack is what the daemon calls fsync. `20-firestore.sh`
   asks before it creates, and refuses to continue if it finds a database in
   the wrong region.

2. **A project id can never be reused.** Deleting `isocan-io-dev` frees
   nothing; the id is burned, for you and for everyone.

3. **A released bucket name becomes claimable by anyone.** If you delete
   `isocan-io-dev-canvas`, a stranger can take the name.

Everything else is genuinely reversible.

---

## Backing out, stage by stage

You should be able to try a stage and change your mind. Here is what that
actually costs.

**Stage D** — clean. `gcloud builds triggers delete isocan-dev-deploy --region=us-west1 --project=isocan-io-dev`.
Disconnecting the GitHub App is separate and also clean.

**Stage C** — clean and free either way.
```bash
gcloud scheduler jobs delete isocan-firestore-export --location=us-west1 --project=isocan-io-dev
gcloud monitoring uptime delete <id> --project=isocan-io-dev
```
Exports already written stay in the bucket until the 90-day lifecycle rule
takes them.

**Stage B** — reversible, but **there is a leftover that keeps billing**, and
it is the classic one: *a reserved static IP with nothing attached to it costs
about $0.010/hour — roughly $7/month for an address doing nothing.* Delete in
reverse order and **release the address last**:

```bash
P=isocan-io-dev
gcloud compute forwarding-rules delete isocan-https --global --project=$P
gcloud compute forwarding-rules delete isocan-http  --global --project=$P
gcloud compute target-https-proxies delete isocan-https-proxy --global --project=$P
gcloud compute target-http-proxies  delete isocan-http-proxy  --global --project=$P
gcloud compute ssl-certificates delete isocan-cert --global --project=$P
gcloud compute url-maps delete isocan-urlmap  --global --project=$P
gcloud compute url-maps delete isocan-redirect --global --project=$P
gcloud compute backend-services delete isocan-backend --global --project=$P
gcloud compute network-endpoint-groups delete isocan-neg --region=us-west1 --project=$P
gcloud compute addresses delete isocan-ip --global --project=$P    # ← LAST, and do not forget it
```
Also remove the DNS A record, or it points at nothing.

**Stage A** — the service itself is clean
(`gcloud run services delete isocan --region=us-west1 --project=isocan-io-dev`
bills nothing afterwards and leaves nothing behind). The database and buckets
hold your canvases; deleting them deletes those.

**All of it** — the one clean undo for everything at once:

```bash
gcloud projects delete isocan-io-dev
```

Reversible for 30 days, permanent after. It takes the database, the buckets,
the service accounts, the load balancer, the IP and the images with it. The
project id is burned.

---

## What is deliberately NOT provisioned

Named so nobody assumes it is there.

- **GC on a schedule.** The architecture says Cloud Scheduler calls the GC
  endpoint with an OIDC identity. It cannot: the door reads
  `Authorization: Bearer …` as a *badge* token, a Google OIDC JWT parses as
  nothing, and the request is refused — correctly. There is also no home-wide
  GC route; `POST /api/projects/:id/gc` sweeps one canvas at a time and
  nothing enumerates them. `91-scheduler-gc.sh` lays out the three ways
  forward. Not urgent: un-swept blobs cost cents.
- **A KMS key.** `cloudkms.googleapis.com` is enabled; no key ring and no key
  exist. Registration launch tokens are Phase 9/12.
- **Firebase Auth.** Attesters are Phase 9. Nothing here enables it.
- **Secrets.** Secret Manager is enabled; nothing is stored in it.
- **`isocan-io-prod`.** Phase 14. Same scripts, different variables.
- **A lifecycle rule that sweeps the object store's scratch objects.**
  `GcsObjects.append` composes `<key>.part-<timestamp>-<random>` beside the
  archive and deletes it; a crash between the compose and the delete leaves
  one behind, and its own comment says "the bucket's lifecycle rule is where
  that gets swept". **It cannot be.** GCS lifecycle conditions match by prefix
  and by suffix, and that name's prefix is a real object's key while its
  suffix is random — so no rule can name the scratch objects without also
  naming the blobs beside them. `30-bucket.sh` says so rather than shipping a
  rule that looks right. The fix (move scratch under a fixed `scratch/`
  prefix, then one `matchesPrefix` rule with `age: 1`) is in Phase 5's Work.

---

## The two proofs, and which is which

**`infra/local-e2e.sh`** — needs no cloud account at all. Builds the image and
runs the containerized daemon with `ISOCAN_STORE=cloud` against a Firestore
emulator and a `fake-gcs-server`, drives it with the isocan CLI, then
**restarts the container** and checks the canvas and its ops are still there.
That is the deploy story rehearsed on a laptop: a brand-new process, an empty
`/tmp`, and everything recovered through the ordinary snapshot-plus-tail boot.
It proves nothing about real GCS, and says so.

**`infra/signed-url-smoke.sh`** — needs a real bucket, and is Phase 5's first
act. Three assertions phase 4 could not make:

1. GCS accepts a signature the service minted.
2. `x-goog-if-generation-match: 0` is honored **inside a signed request** — a
   second PUT to the same ticket is refused with 412. This is the one phase 4
   was least sure of, and it is what makes blob writes create-only.
3. A service account with **no private key** can sign at all, through the IAM
   `signBlob` path that `roles/iam.serviceAccountTokenCreator` gates.

Assertion 3 is a claim about *how* the signature was produced, so **who you
run it as decides whether it means anything**:

| you run it as | 1 & 2 | 3 |
| --- | --- | --- |
| impersonating `isocan-run@…` | real | **PASS** — the deployed path exactly |
| inside the Cloud Run service | real | **PASS** |
| a downloaded service-account key file | real | `UNPROVEN` — a key file signs locally and says nothing about the service |
| your ordinary user login | — | cannot sign at all; the script stops early and tells you why |

The script refuses to claim assertion 3 when it cannot establish that no
private key was in play. An `UNPROVEN` is not a pass.
