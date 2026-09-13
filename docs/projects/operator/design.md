# The operator

**11 September 2026.** Design. Nothing built. The project's status lives in
[journey.md](journey.md)'s front matter; the journeys are the acceptance
suite, this doc is the argument, and [phases.md](phases.md) is the walk.

The debt is [#77](https://github.com/dglazkov/isocan/issues/77), filed by
Dimitri on 25 August: *a daemon that hosts other people has no
administrative surface.* `/terms` (`packages/web/src/lib/terms.ts:148`)
tells strangers the operator can kill a badge, revoke a grant, delete a
canvas and refuse somebody at the door, and names the address to write to.
[innkeeper.md](../multiuser/innkeeper.md) is where that promise comes from —
*"the desk already forged the tools"* — and it was right about the tools
and wrong about the hands. Every tool is scoped to the caller's own access,
on purpose, and the operator is not a caller anybody's access includes.

The thesis in one line: **the operator is a proof, not a credential** — an
address the home's configuration names, proved fresh for each act by the
attester the home already borrows, carried with the act and stored nowhere.

## What exists, exactly

Mapped before designing, so the design reuses shape where it can. Every one
of these was read in the tree on 11 Sep.

- **Ending a badge.** `Desk.killBadge` tombstones (`killedAt`, `killedBy`)
  and never deletes; the cloud desk empties the four derived arrays in the
  same transaction (`cloud-desk.ts:355-367`), so a dead badge drops out of
  every indexed query by construction. `killAndSweep` (`sweep.ts:464`)
  kills and then sweeps each canvas the badge was in. The route,
  `DELETE /api/badges/:badgeId` (`http.ts:2789`), admits only a badge in
  `mySurfaces` — one that shares an actor with the caller — and answers
  `NOT_YOUR_BADGE` otherwise. The comment at `http.ts:4280` says why there
  is no listing: *a route that could enumerate badges would be a roster of
  people to kill.*
- **What a kill misses.** Four gaps, each found by reading and none by a
  test. The killed badge's own sockets stay open and keep receiving
  broadcasts, because the sweep reports only badges `badgesIn` returns and
  a dead badge is not among them (`ws.ts:201-212`). A parked
  `/api/oplog/watch` is not woken (`http.ts:3322`). A pass the dead badge
  minted is still redeemable — `redeemPass` never asks whether the minter
  lives (`passes.ts:197`). And the CLI, meeting a 401, knocks for a new
  badge and sends `actor.claim {as}` (`api/routes.ts:241`,
  `api/identity.ts:393`), which the engine's vouch allows when no live
  badge still claims that actor (`engine.ts:2154`) — so a killed CLI can
  come back as the same name within a second. Read, not walked; phase 4's
  acceptance walks it.
- **Revoking a grant.** A tombstone on the desk (`revokedAt`, `revokedBy`),
  then `sweepCanvas`, which reaches an open socket as `standing` or closes
  it `WS_NOT_ADMITTED` with the reason `withdrawn`, and refuses the next
  wait with the same reason (roles phases 2–3, built). The route needs
  `own` (`http.ts:2143`). `?bar=1` writes a bar in the same request.
- **The bar.** A grant row with `bars: true`, on a canvas or a space, whose
  subject is `email:` or `repo:` only (`grants.ts:428`). Nothing refuses at
  home scope. The only per-caller refusal at the door is the mint meter:
  20 a minute per network address, in memory, keyed from
  `X-Forwarded-For` by `ISOCAN_PROXY_HOPS` (`meter.ts:31`, `:247`, `:289`).
- **Deleting a canvas.** Not a route: the op `project.delete`, through
  `/api/ops`, which asks for **edit, not own** (`http.ts:1175-1183`). Soft on
  both backings — the file store renames the directory aside, the cloud
  store merges `deleted: true` (`cloud-store.ts:365`). The home broadcasts
  `canvas-deleted`, which has no fields and so no reason
  (`protocol.ts:117`); a linked daemon soft-deletes its own copy
  (`engine.ts:1716`) and a tab forgets its IndexedDB replica
  (`canvasStore.ts:1136`). **Nothing is ever purged.** The GC walks
  `listCanvases()`, which excludes deleted canvases (`gc.ts:245`), and the
  `Store` interface has no hard delete. The terms' *"and the files under
  it"* is not true of any delete today, the owner's included.
- **Blobs belong to one canvas.** Content-addressed, but keyed under the
  canvas — `canvases/{id}/blobs/…` in the bucket, `canvases/{id}/blobmeta`
  in Firestore — so dedup is within a canvas and purging one canvas's
  prefix cannot break another.
- **The content origin re-checks the canvas, not the person.** A signed
  read on isocan.store verifies the HMAC, then calls
  `engine.getSnapshot(id)` (`content.ts:316-324`), so a canvas the engine
  no longer holds is refused before its URLs expire. Grants and badges are
  not consulted, by design: an expelled badge cannot mint, and what it
  minted lives its five minutes. A verified read goes out `public,
  max-age=<what is left>` through Cloud CDN, and nothing in the tree
  invalidates the edge.
- **Configuration is a home's capability.** `ISOCAN_AUTH_PROJECT` and
  `ISOCAN_AUTH_API_KEY` decide whether a home has an attester
  (`attest.ts:101`); `verifyIdToken` checks the signature, `iss`, `aud`,
  `exp` and `email_verified` (`attest.ts:228`). It does not read
  `auth_time`. The web app signs in over two REST calls with no SDK, uses
  the ID token once and drops it (`web/src/lib/signin.ts`).
- **The desk keeps no log on Firestore.** The file desk's
  `desk/badges.jsonl` is append-only and timestamped; the cloud desk has
  document tombstones and nothing else. The `audit/` collection
  `architecture.md` draws is not built, and the badge-to-op log that
  `terms.ts:130` lists among the ledgers does not exist — `engine.ts:213`
  stops the badge id at the engine on purpose and nothing writes it
  anywhere.
- **The SYSTEM voice carries no authority.** Any badge may post
  `thread.create` or `thread.reply` as `sys_isocan` (`engine.ts:973`), and
  the server itself never writes an op.
- **The op vocabulary is closed and isomorphic.** Thirty-three ops, capped,
  and `test/isomorphism.test.ts` requires every op to be sendable from both
  the web app and the CLI.

## Who the operator is

Four candidates, each costed against one question: what stops an agent, or
a stranger, from holding it.

| Candidate | What proves it | Verdict |
| --- | --- | --- |
| **A person actor named in config** (`usr_…`) | a claim on that actor | **No.** A daemon's badge claims every actor it relays, and the forwarded-write rule trusts a daemon about which of its people is acting. That is exactly the trust an operator power must not ride, and after the kill gap above, a claim is also the thing a re-badged CLI gets back for free. |
| **An operator token minted out of band** | a long-lived bearer secret | **No.** It is the robot key the GC decision refused (`infra/91-scheduler-gc.sh`): a credential that belongs to no person, lives in a file an agent can read, and needs a rotation story before it is useful. |
| **An address the home's attester proves, named in config** | a fresh sign-in, the address on a list | **Yes.** |
| **A key on the operator's machine** | a signature by a private key | **Not now.** The key sits in a home directory a summoned agent shares: the [10 Sep rc measurement](../../research/2026-09-10-what-the-rc-hands-over.md) found a summoned agent running the person's shell on the host, and `isocan rc --sandbox`, which fences it, is opt-in. A hardware key would close that; it is a door left open, not a first step. |

And one that is not a candidate for the path but stays in the picture:
**Cloud IAM.** A tool that writes Firestore directly with the operator's
`gcloud` credentials is the Firestore hand edit with better manners. It
still runs beside the daemon rather than in it — the running home holds
canvases in memory, is the single writer, and owns every socket, so a
write behind its back is overwritten, unseen, or both. IAM's role is one
step up: **who can set the home's configuration is who decides who the
operator is.** That is what makes a list in configuration trustworthy, and
it is the same argument the attester made in phase 9 — the configuration is
not a claim that could be false, it is the thing verification is performed
with.

So: **`ISOCAN_OPERATORS`**, a comma list of attributes in the normalized
shape grant subjects already use (`email:dimitri@glazkov.com`). Set on the
Cloud Run service by `infra/70-cloud-run.sh` beside `ISOCAN_AUTH_*`. One
image, many homes: a team that runs its own home is its own operator by
setting its own list, which is the only definition of "the operator"
commitment 2 of the innkeeper posture can bear. A home with no attester has
no proof to check and therefore no operator path over HTTP — stated, not
papered over. A local daemon needs none: its badge is admitted to
everything on it already. A self-hosted home without an attester is the
case left open (phases.md, phase 8).

## A proof, carried with the act

**The proof is a Firebase ID token for a listed address, signed in within
the last ten minutes, sent in a header on every operator request.** The
home checks it with the same `verifyIdToken` that attests an address today,
plus two things: the token's `email` is on `ISOCAN_OPERATORS`, and its
`auth_time` is recent. The request still carries its badge through the
door unchanged, so the ledger knows which surface carried the proof.

What is stored: nothing new. Not on the badge — the home writes no operator
standing anywhere, so there is nothing for another holder of the same badge
to borrow. Not on disk — the CLI holds the token in memory for one
invocation. Not in Firebase — no SDK, no refresh token, the same rule
`signin.ts` keeps. After an hour the token is dead whatever anybody does;
after ten minutes the home stops honouring it.

**How the terminal gets one.** The loopback pattern every CLI that signs in
through a browser uses. `isocan operator …` listens on `127.0.0.1` at a
random port, opens `/operator/prove` on the home with the port, a `state`
it chose, and a one-line summary of the act. The page shows the summary
first — *a terminal on this machine asks to act as this home's operator:
take down prj_…* — then runs the sign-in `signin.ts` already runs, and
instead of hop 4 (`POST /api/attest`) hands the token to the loopback
address with the `state`. It refuses any destination that is not loopback.
One detail to carry through: the magic-link path returns through
`/__/auth/action`, which keeps only the path of `continueUrl`
(`architecture.md`, phase 13.5), so the handoff state rides the path.

The browser surface, when there is one, uses the same header with the
token its own sign-in just produced. One mechanism, both surfaces.

**Why fresh rather than once.** An attestation on a badge lasts as long as
the badge; a stolen cookie would be a stolen operator. Ten minutes is sudo's
window with the timestamp file removed: a person at a sign-in page, for a
named act, recently.

## Agents never hold it

Decided, and enforced by construction rather than by instruction.

- **An agent's badge has proved nothing.** It was admitted by a pass, and a
  pass endows claims and admissions, never attestations. There is no
  operator standing on any badge for it to inherit.
- **The proof is an act of a person at a sign-in page.** An agent's harness
  holds the person's shell, not the person's Google session in a browser
  that shows *this terminal asks to take down prj_…* before it asks
  anything.
- **The CLI refuses inside a summoned session** — `ISOCAN_SESSION_ID` is
  set by the rc for the sessions it vends over ACP (`acp.ts:152`) — before any
  browser opens, with the sentence journey 10 prints. A courtesy that gets
  the words right, not the enforcement; an agent that unsets the variable
  meets the two rules above.

Stated honestly: no credential tells a person from a program running as
that person, on that person's machine, with that person's browser open.
What this buys is the property that matters — the proof is a thing the
person does, at a moment, for an act the page named.

## Not an op

Every operator act is a desk write and a ledger row, never an operation on
a canvas log. Three reasons, each sufficient:

1. **The vocabulary is closed and isomorphic.** An operator act is not a
   canvas act the web app and the CLI can both send; putting one in the
   vocabulary would be the first op `isomorphism.test.ts` has to exempt.
2. **The log replicates.** It is shared state every member's replica holds,
   and it is the members'. The operator's act is about hosting — the home's
   business, in the home's private ledger, beside grants, which the log has
   never recorded either.
3. **The log cannot carry authority.** Ops are authored by actors, the
   operator is not an actor on the canvas, and the one voice that belongs
   to no actor is open to every badge.

So **the words come from the home, not from the log**: a refusal with a
reason, rendered by whichever surface meets it.

## The four powers

Each names what it reuses, what it must reach, what the affected person
reads, and what cannot be undone. All four are routes under
`/api/operator/`, each refused without the proof and each writing a ledger
row before it answers.

### Take a canvas down

**Taking down is not deleting.** A delete is the owner's: an op, into the
log, broadcast as `canvas-deleted`, erasing the copy on every linked daemon
and tab. A takedown is the home's: it stops serving the canvas, leaves every
replica's copy where it is, and can be lifted. That is the innkeeper line —
sovereignty by replica means the operator cannot reach a laptop, and a
takedown that erased Priya's copy would be the operator reaching one.

**Mechanism.** A store flag beside `deleted` — `takenDownAt` on
`canvases/{id}`, a field on the file store's canvas record — that `load`
refuses exactly where it refuses `deleted` today, plus a desk row
`takedowns/{canvasId}` holding the reason the surfaces show and the note
they do not. No op is appended, so lifting is clearing the flag: the log
never recorded the takedown and replays as it was. The engine drops its
in-memory copy, as delete does.

**What it reaches.**

| Surface | How |
| --- | --- |
| Open sockets | the room closed with a new reason, `taken-down`, not `canvas-deleted` — a linked daemon must not erase its copy |
| Parked `isocan wait` | woken and refused with the reason; the CLI exits and does not re-park |
| Parked rc holds | ended for that canvas — `RcHolds` today ends only on timeout, close or an ask |
| A linked daemon | refused on redial with `WS_NOT_ADMITTED` and `taken-down`; it stops redialling, as it does for `withdrawn`, and keeps its copy |
| Signed URLs already out | refused at the origin at once, because `getSnapshot` already runs on the serve path; the CDN edge may serve its copy for what is left of five minutes, and the verb prints the `gcloud compute url-maps invalidate-cdn-cache` line rather than hand the daemon's service account compute rights |
| The canvas list | listed for its members with the sentence, not hidden, so the owner is told |
| A second instance during a rollout | not reached for the seconds both run; the hub is in-process, the same bound the sweep lives with |

**Words.** *This canvas was taken down by the operator of this home on
&lt;date&gt;: &lt;reason&gt;. Write to &lt;address&gt;.* The reason is a
category from a short list; the note is the operator's.

**Irreversible:** nothing, until purge.

### Purge: the bytes

A second act, refused unless the canvas is taken down. `Store` grows its
first hard delete, `purgeCanvas`: the bucket prefix `canvases/{id}/`
(snapshot, blobs, archive, overflow ops) and the Firestore `ops` and
`blobmeta` subcollections, on both backings. The `canvases/{id}` document
stays as the tombstone, so `canvasExists` stays true and the id can never be
adopted, teleported into, or re-created. The desk rows stay — who made it,
who came in, when it came down and why — as the record.

**Irreversible, with a horizon, said in numbers.** The bucket keeps a
deleted object seven days (`infra/30-bucket.sh`); Firestore rewinds seven
days; the nightly exports hold the op text for ninety
(`infra/90-backup-export.sh`). Copies on members' machines are theirs. The
verb prints all four lines, so the reply to Kai can be exact.

### End a badge

The operator route calls `killAndSweep`, the owner's path, with the
`mySurfaces` check replaced by the proof. Targets resolve by the id a
report names: a badge id; an actor, through `claimIds` and `actor.join`'s
`resolveActor`, so a folded identity is one target; or an address, through
`badgesAttesting`. The verb lists what the target reaches before it acts,
including the registrations and enrolments a badge created — innkeeper.md
already says those outlive their creating badge, and that the ledger's
`createdBy` is how an operator reviews what a compromised badge left
behind.

**The four gaps are fixed for everyone**, because each is a bug in the
owner's stolen-laptop path too:

- a kill is an outcome the sweep hub reports, so `ws.ts` closes the dead
  badge's sockets with a reason;
- a watch held by the dead badge is woken and refused;
- `redeemPass` refuses a pass whose minter is dead;
- a 401 carries the tombstone's reason, and the CLI's re-badge does not
  resume an actor after an end by the operator — it prints the sentence
  and stops. An end by the holder (sign-out, a lost laptop ended from the
  phone) keeps today's quiet re-badge, which is what lost-badge recovery
  is.

**Words.** *This surface was ended by the operator of this home on
&lt;date&gt;. Write to &lt;address&gt;.* **Irreversible:** the badge — a
tombstone never revives, by the desk's own rule that an id minted once is
never minted again. Ending is not refusing: the person can knock again as a
stranger, and the verb says so.

### Turn off a grant

The owner's revoke — `desk.revokeGrant`, then the sweep of the canvas, or
of every canvas in the space, or of every canvas a group's rows reach —
with `own` replaced by the proof. The row gains `revokedVia: "operator"`,
so the Share dialog and `isocan share` say *turned off by the operator of
this home on &lt;date&gt;: &lt;reason&gt;* instead of naming a badge.
`--bar` writes the bar as the owner's `?bar=1` does.

**The owner can turn it back on.** A revoke the owner can undo is a
request; when the operator needs it to stay off, the order is a takedown.
Giving the operator a row the owner cannot touch would make a second kind
of grant for one caller. **Irreversible:** nothing — a re-grant is a new
row, as it always was.

### Refuse at the door

Dimitri's question was blocklist, global rate limit, or something narrower.
**Narrower, and not a rate limit**: the meter already is the global limit,
and tuning it is configuration, not a power.

A home-scope refusal is a desk row, `refusals/{id}`: `{subject, reason,
note, at, by, expiresAt?, liftedAt?}`. Four subjects, each a thing the home
can actually tell apart:

| Subject | Read at | Refuses |
| --- | --- | --- |
| `email:` / `repo:` | the door hook, against the badge's attestations; `/api/attest` | every canvas and every create, for any badge that proved it; proving it at all |
| `actor:` | `actor.claim` | resuming that actor — the name stops coming back |
| `net:<cidr>` | the mint meter | minting a badge from that network; **expires by default** (24 hours), because networks are shared and reassigned |

It is the roles bar moved to home scope, and the same reasoning keeps it a
row: one list the operator writes, lifts and reads, loaded into memory at
boot on a single-instance home and re-read on write, so the door's cost is a
set lookup. Refusing an address ends every badge that proved it, in the
same act.

**The honest limit, printed by the verb.** A badge is free and a link
admits strangers who prove nothing. A stranger cannot be refused by who
they are, because they are nobody yet; what stops them on a canvas is the
link, which is the revoke. The one posture that would close the gap
everywhere — *creating a canvas at this home needs a proven address* — is a
change to what isocan.io is, and it is Dimitri's call, below.

## The look

The operator must judge a report, and the canvas may be closed to the
address. `isocan operator look` mints, after the proof, a pass the home
redeems into the operator's browser as an admission at `view` with
provenance `{root: "operator", until}`: the door honours it for an hour,
the sweep leaves it alone as it leaves `created`, and it is not in presence
because no `view` connection is. The ledger records every look with its
reason. **The home reads everything it hosts** — innkeeper.md says it and
the terms page repeats it — and the ledger is the counterweight: a look is
never unrecorded, even when it is unannounced.

## The record

**The ledger** is a desk collection, `operator/{id}` on Firestore and a
line type in the file desk's log: `{act, target, reason, note, proof:
{attribute, authTime, tokenHash}, badgeId, at, reach, outcome}`. Written
before the act answers, so a crash leaves a row saying the act was
attempted. Append-only; a lift is a new row naming the one it lifts.
Innkeeper-private, like every desk ledger: **the operator reads it**
(`isocan operator log`), and nobody else does over the wire.

**The affected person reads a sentence**, from the home, on the surface
they are on: the tab, the wait, the canvas list, the replica's status, the
Share dialog, the door. Each carries the date, the reason category, and the
address on `/terms`. Never silence, never *not found* for something that
was taken down: the difference between *there is nothing here* and *this
was removed, and here is who to ask* is the whole message.

**The reporter** gets the operator's email, as today — the terms page
already promises *he will tell you what he did*. The verb's output is
written to be pasted into it.

## Both surfaces

**The CLI is the operator's surface.** Abuse mail is read by a person at a
desk, the reach and the purge horizon read best as lines, and the loopback
proof is a pattern people already know from `gcloud` and `gh`.

```
isocan operator show     <canvas>
isocan operator look     <canvas> --reason …
isocan operator takedown <canvas> --reason … [--note …] [--lift]
isocan operator purge    <canvas> --force
isocan operator end      <badge|actor|email:…> --reason … [--with-enrolments]
isocan operator revoke   <canvas|space> <subject> --reason … [--bar]
isocan operator refuse   <email:…|repo:…|actor:…|net:…> --reason … [--for 24h] [--lift]
isocan operator log      [--target …]
```

Every verb prints its reach before acting and its outcome after, and
`--json` gives both. Targets are ids a report names. **There is no verb that
lists the home** — no badges, no canvases, no people — for the reason
`http.ts:4280` already gives: a listing would be a roster.

**The web surface is one page**, `/operator/prove`, where the proof is
made. No dashboard at first, and possibly ever: the words the affected
people read land on surfaces that already exist.

**The agent guide gets one line**, because
`packages/cli/test/surface.test.ts` fails on a verb the guide does not
name, and because the line is the useful thing to tell an agent:
*`isocan operator` is for the person who runs the home; it needs their
sign-in in a browser and refuses inside a session — if asked to take
something down, say so and give the address on /terms.*

This is the one feature that is deliberately half by the
[AGENTS.md](../../../AGENTS.md) rule — done on both surfaces, and reachable
by only one kind of hand.

## What /terms should say meanwhile

Proposed, not applied: the terms page is legal copy and Dion's call, and
the operator it names is Dimitri. The smallest change that makes today's
page true, to `packages/web/src/lib/terms.ts`:

```diff
     body: [
-      "What the operator can do, and will: kill a badge, revoke a grant — which sweeps everything that grant let in — delete a canvas and the files under it, and refuse somebody at the door.",
+      "What the operator will do: take a canvas down so this home stops serving it, turn off a grant, end a badge, and refuse somebody at the door. Today the first three are done by hand, in the home's database, and only partly — an ended badge can knock again, and a canvas taken down is not yet erased. The fourth is not built. None of it is recorded anywhere but the reply you get; the work to make them commands is in the same repository as this page.",
       "Write to dimitri@glazkov.com. Say which canvas and what is on it. …",
```

```diff
-      "The desk's ledgers — badges, the claims saying who may speak as which actor, attestations (which means email addresses), grants, provenance, and the log of which badge performed which operation — are innkeeper-private …",
+      "The desk's ledgers — badges, the claims saying who may speak as which actor, attestations (which means email addresses), grants, and provenance — are innkeeper-private …",
```

The second is the same kind of correction: the badge-to-op log does not
exist. Neither edit disturbs `packages/web/test/terms.test.ts` — both
sections keep citing sentences `innkeeper.md` still says. When phase 7
lands, the page says what is built, and that test learns to cite this
design beside the record it cites now.

## Dimitri's questions, answered

| #77 asked | Answer |
| --- | --- |
| What proves someone is the operator — Cloud IAM, a separate credential, or something else | An address on `ISOCAN_OPERATORS`, proved by the home's attester within ten minutes, per act. IAM decides who may set the list; it is not the path. |
| HTTP API, the CLI, or a separate tool that talks to the store | HTTP, into the running daemon — the single writer, the socket owner, the one place derived fields are kept consistent. The CLI is the first surface over it. No store-side tool. |
| How acts are recorded, and whether an affected user can see one happened | A desk ledger row per act, read by the operator. The affected person reads a sentence on whatever surface they are on; the owner sees it in their list and their Share dialog. |
| Refuse at the door: blocklist, global rate limit, or narrower | Narrower: home-scope refusal rows on proven attributes, actors, and networks (the last one expiring). The meter stays the rate limit. The limit on refusing a stranger is stated rather than solved. |
| Should `/terms` describe only what the code can do meanwhile | Yes — the diff above, for Dion. |

## Decisions

**D1. The operator is an address the home's configuration names, proved fresh for each act.** Not a badge, not an actor, not a key.

**D2. The proof travels with the act and is stored nowhere.** No operator standing on any badge; the CLI holds the token for one invocation.

**D3. Operator acts run in the daemon, over HTTP — never beside it on the store.** The single writer owns the sockets, the memory and the derived fields.

**D4. An agent never holds operator standing.** Enforced by what a proof is, not by the guide.

**D5. An operator act is a desk record, never an op.** The vocabulary stays closed, the log stays the members', and the words come from the home.

**D6. Taking down is not deleting.** The home stops serving; replicas keep their copies; it is lifted by clearing a flag.

**D7. Purge is a second act, after a takedown, and says what it could not erase.** Seven days, seven days, ninety days, and the members' machines.

**D8. The operator has no roster.** Every read is by an id a report names.

**D9. A revoke the owner can undo is a request; a takedown is the order.** No second kind of grant for one caller.

**D10. The kill gaps are fixed for everyone.** They are bugs in the stolen-laptop path, found while designing this.

**D11. A refusal names something the home can tell apart.** A proven attribute, an actor, or a network that expires — and the verb says what it cannot refuse.

## Open

**For Dimitri**, who operates isocan.io and is the name on its terms:

1. **Who is on isocan.io's list.** Only `email:dimitri@glazkov.com`, or a
   second operator — who would then be a second person the terms name.
2. **The freshness window.** Ten minutes proposed.
3. **Whether a takedown should reach replicas** for content illegal to
   possess, not only to host. D6 says no, on the innkeeper line; the legal
   judgement is his.
4. **Whether a look is disclosed** to the canvas's owner. Proposed:
   recorded always, disclosed when an act follows.
5. **Whether the affected person sees the reason category.** Proposed: yes,
   from a short list; the note stays private.
6. **The ninety-day export horizon** as the honest end of a purge, or a
   purge that also deletes from the exports.
7. **Owner-deleted canvases are never purged** — the GC skips them. A purge
   after a horizon (thirty days?) would make the terms' *"and the files
   under it"* true for everyone.
8. **Whether creating a canvas at isocan.io needs a proven address** — the
   only posture under which a refusal bites someone who never signs in.
9. **A public count of acts** on `/terms`, per quarter.

**For Dion:**

1. **The terms wording meanwhile** — the diff above.
2. **The CLI-first bet** — the loopback proof page, rather than a
   browser-only operator page.
3. **Whether `isocan operator` appears in everyone's `--help`.** The guide
   must name it either way; proposed: listed, with the line that agents
   cannot use it.

**Found while mapping, not this project's to settle:** `project.delete`
needs only `edit`, so any editor can delete somebody's canvas and erase
its replicas (`http.ts:1175-1183`), while revoking a grant needs `own`; and
an editor on the hosted home may be able to teleport a canvas to another
home (`http.ts:3601`, not walked end to end). Both belong to
[roles](../roles/).

## Considered and left out

- **An operator rung on the ladder.** A rung is per canvas and compared by
  highest-wins; the operator is per home and does not enter canvases.
- **An operator badge kind.** A new kind of caller at the door, for one
  person — the thing the GC decision refused for a chore, and no better for
  an obligation when a proof does the job with nothing stored.
- **A global kill switch** (read-only home, maintenance mode). An outage
  with a button. Not asked for, and scaling the service to zero already is
  one.
- **A web dashboard.** A dashboard is a roster with styling. The page that
  exists is the one the proof needs.
- **Takedown as `project.delete` sent by the home.** It would erase every
  replica, be an op authored by nobody, and not be liftable.
