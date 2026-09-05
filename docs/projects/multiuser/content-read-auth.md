---
status: open
since: 2026-09-05
see: multiuser, atlas
note: the decision the content origin's hosted half turns on — how a cookieless origin knows who may read a private canvas's bytes. Three options costed; signed URLs with a minutes-long TTL recommended; two choices left to the owners, the second domain and the TTL
---
# Read auth on the content origin — the decision

**5 September 2026.** The [content origin](../atlas/content-origin.md) is
built and live on local homes: item content is served from an origin that
holds nothing, frames get `allow-same-origin` only when their source is on
that origin, and the CSP the content role serves was chosen by measuring 76
real screens. Its [plan](../atlas/content-origin-plan.md) stops at stage 4,
the hosted half, and says the hard part of stage 4 "belongs with the door and
should be written there." This is that write-up: one page, so it can be read
and decided.

## The question

On **isocan.io**, who may read the bytes of an item on a private canvas, and
how does the content origin know?

## Why it is a real collision and not a detail

Two decisions this codebase already made pull against each other.

**Expulsion reaches the bytes** (23 August 2026, the blob route's ledger in
`server/src/http.ts`). When somebody is removed from a canvas — a revoked
invitation, a link narrowed to read — their old links stop working. The blob
route requires a badge and an admission, and it sends `Cache-Control:
private` so no shared cache can hand a swept badge the bytes it was just
expelled from. That was measured in Chrome and it holds today on both the
local and the hosted home.

**The content origin holds nothing** (26 August 2026, the proposal). Its
whole safety is that a page rendered there has no cookie to steal, no API to
call and no parent to reach. A frame there can keep storage, and a hosted
extension panel there cannot act as the person watching it.

Put together: the origin that must serve private bytes is the origin that
must not carry the credential that says who is asking. Hash secrecy does not
close it — a content hash is unguessable, which is the CDN answer, and
unguessable is not private once a link has been shared, posted in a Chat, or
copied by an agent.

## The options

| | How the origin knows | Expulsion reaches the bytes | Cost |
| --- | --- | --- | --- |
| **A. Short-lived signed URLs** | The badged app origin mints a signature over `(canvasId, hash, expiry)` for each frame it renders; the content origin verifies the signature and serves or refuses. No cookie, no lookup of who. | **Within one TTL.** An expelled badge cannot mint again; what it already minted dies in minutes. | A per-home HMAC key beside the desk's ledgers (the daemon has none for this today — badges are random secrets, hashed, not signatures); a mint per frame render; URLs that change, so an edge cache keys on the signature and a copy lives at most one TTL. |
| **B. Hash secrecy as the auth** | It does not. Anyone with the URL is served. | **Never.** A link, once seen, is the bytes forever. | Nothing to build. Breaks the 23 August promise on the hosted home, and makes every private canvas exactly as private as its least careful link. |
| **C. Keep hosted frames on the app origin** | Today's cookie, on today's origin. | Yes, as today. | Three things stay impossible on isocan.io: storage for interactive items, custom views in the workbench, the hosted extension-panel tier; and the isolation stays a JSX attribute rather than a structure — the risk the proposal opened with. |

A fourth shape people reach for — a cookie on the content domain — is ruled
out by the design itself: a cookie there is a credential a page there can
read, which is the thing the split exists to remove.

## The recommendation: A, with two numbers left open

Signed URLs, minted by the app origin, verified by the content origin,
with a TTL measured in **minutes**. The 23 August ledger dismissed "a token
in a URL" because a durable token is a credential where people paste; a
signature that dies in minutes is not durable, and that is what rescues it.

What it costs, to be written into the same ledger when it lands: on the
hosted home, expulsion reaches the bytes *within one TTL*, not at once. On
the local home nothing changes; loopback needs no signature and gets none.

What it gives back beyond the three features: the content origin's
responses can be **publicly cacheable per URL for one TTL**, because the URL
itself is the credential and it expires — the edge copy the 23 August change
had to give up (`private`) comes back on the origin where it is safe.

**The two choices that are the owners' to make, not this document's:**

1. **The second registrable domain.** A subdomain of `isocan.io` is not
   enough, because cookies can be scoped to a parent domain. This is the
   `githubusercontent.com` pattern and it needs a name, a certificate and one
   host rule on the existing load balancer routing to the same Cloud Run
   service. No new service.
2. **The TTL.** Five minutes is the number that makes "within one TTL" feel
   like "at once" to a person, at the price of one mint per frame render;
   an hour is calmer for caching and makes an expulsion take an hour to be
   true for bytes already framed. The frame is re-rendered on every canvas
   load, so the mint cost is paid per visit, not per second.

## What does not change

- Chrome reads — the editor's fetch, markdown rendering, the edit-text
  frame's source — stay on the app origin with the cookie (the plan's
  invariant 3). Only frames and their subresources move.
- The content role still answers `GET` bytes and nothing else (invariant 4);
  verifying a signature is not answering a question about a canvas.
- Local homes stay exactly as they are: the second loopback listener, no
  signature, the CSP already chosen.
- Hosted frames stay exactly as they are until the domain and the TTL are
  decided and this lands (invariant 5). Uneven on purpose; broken never.

## What deciding this unblocks

Stage 4 of the content origin — 4a the domain, 4b this, 4c the flip — and
through it: custom views (`role=view`) in the workbench, the hosted
extension-panel tier, storage for interactive items on isocan.io, and the
first of the three gates on the sandboxes module.

## Open, and named rather than hidden

- **Sharing within a TTL.** A signed URL copied out of a page's source can
  be handed to someone else for the minutes it lives. Bounded by the TTL,
  and the same exposure a screenshot has; recorded, not solved.
- **Key rotation.** A per-home HMAC key needs a rotation story before it is
  a year old; the badge desk's revocation machinery is the model.
- **Replicas.** Bytes a replica never held stream through from the canvas's
  home today; a signature minted at the home must verify at the replica, so
  the key travels the home link or the replica forwards the read. Decide
  when stage 4 is built, not before.
