# The content origin — execution plan

**26 August 2026.** The walk for [content-origin.md](content-origin.md). The
proposal argues *why*; this is *in what order*, under one constraint set by
Dion when he asked for it: **every stage ends in a stable place for both
shapes**. The local home and the hosted home may have *uneven* functionality
at any point — local gets the origin split first, hosted rides today's
behavior — but neither is ever broken, half-migrated, or waiting on the other
to be usable.

## The two shapes, and why the seam is a role, not a listener

- **The local home**: one daemon, loopback, `127.0.0.1:4441`. The port is
  part of the origin, so a second loopback port **is** a second origin —
  cheap, complete, no DNS.
- **The hosted home** (isocan.io, live since phase 14): a Cloud Run service
  behind a global load balancer with a managed certificate
  (`infra/70-cloud-run.sh`, `80-load-balancer.sh`). Cloud Run exposes **one
  `$PORT`** — there is no second listener to have. The second origin there is
  a second *registrable domain* (not a subdomain; cookies scope to parents)
  routed by a host rule on the same load balancer to the same service.

So the server-side seam must be a **role**, not a listener: one predicate,
`contentRequest(req)`, true when the request arrived on the local content
listener *or* bears the configured content host. The role serves blobs and
nothing else. Local mounts it on a port; hosted mounts it on a Host header;
the routes and their guard tests are one body of code either way.

## The invariants — the stable places themselves

These hold at every stage boundary, and each gets a guard test the moment the
code it constrains exists.

1. **Unconfigured means today, byte for byte.** No content base configured →
   every request, header, and frame attribute is identical to current
   behavior. This is the invariant the hosted home rides until stage 4; it is
   also the rollback story for every stage (unset the config).
2. **The sandbox upgrade is keyed to the split, never to a flag.** A frame
   gets `allow-same-origin` *if and only if* its `src` is on a different
   origin from the app. The pair "app-origin src + `allow-same-origin`" —
   the whole-home compromise the proposal opens with — must be
   *unbuildable*: one function builds item-frame src+sandbox together, and
   the guard test enumerates its outputs.
3. **Chrome reads stay badged, forever.** The editor's fetch, the
   edit-text frame's source fetch, markdown rendering — everything the *app*
   reads keeps using the app-origin API route with the cookie. Only frames
   (and the subresources of pages inside them) move. Consequences: no CORS
   anywhere, and the 2026-08-23 decision — expulsion reaches the bytes
   (`http.ts`, the blob-route comment) — keeps holding unweakened for
   everything that is not a frame.
4. **The content role answers `GET` blob bytes and nothing else.** No door,
   no canvas listing, no metadata, no API — or it has become a second API
   with no door on it. Addressing stays `(canvasId, hash)` as opaque path
   segments; answering "bytes for this pair, or 404" is not answering
   questions about canvases. Guard test: enumerate the role's route table.
5. **Hosted frames do not flip until the hosted read-auth question is
   answered.** The content origin holds no cookie *by design*, so on a
   multi-user home it cannot know who is asking. Until stage 4b resolves
   that, the hosted home's frames stay exactly as they are. Uneven on
   purpose; broken never.

## Stage 1 — the role, with nothing routed to it

All plumbing, zero behavior change. Both shapes ship this identical to today.

- Extract the blob-`GET` handler into the content route set and add the
  `contentRequest` predicate. Configured by `ISOCAN_CONTENT_PORT` (local) and
  `ISOCAN_CONTENT_HOST` (hosted), **both defaulting to off**.
- The daemon advertises its content base to the app — nullable, over the API
  the app already talks to at boot. A base the app does not receive means the
  origin does not exist, and the fallback *is* current behavior.
- The app splits `blobUrl` into two spellings with one home each:
  `apiBlobUrl` (chrome reads, invariant 3) and `frameBlobUrl` (frames).
  While the base is null they return the same string.
- **The CSP header detail, named now so stage 2 doesn't trip on it**: blob
  responses today carry `Content-Security-Policy: sandbox allow-scripts` as a
  response header. On the *content role* that header must not be sent as-is —
  a response-header sandbox re-imposes the opaque origin and defeats storage,
  the exact wrinkle the WYSIWYG research measured from the other side. The
  header stays on app-origin blob responses; what replaces it on the content
  role is stage 3's decision.

Stable place: nothing observable moved; the seam and its tests exist.

*Landed 26 Aug 2026, with one refinement over the sketch above: instead of
two URL spellings (`apiBlobUrl`/`frameBlobUrl`), there is ONE URL spelling —
`blobUrl`, unchanged, badged, used by every chrome read — and one frame
builder, `web/src/lib/frame.ts`'s `itemFrame`, the only code allowed to
decide a frame's src and sandbox together. That makes invariants 2 and 3 the
same seam: the builder is the sole consumer of the content base, so a chrome
read *cannot* wander to the content origin and a frame *cannot* pair an
app-origin src with `allow-same-origin`. Server side: `server/src/content.ts`
is the role (route table enumerated by `content.test.ts`), the app origin
mounts it behind the existing door hook, `GET /api/serving` advertises
`contentBase: null`, and the pre-extraction blob suite passes untouched —
which is invariant 1's witness.*

## Stage 2 — the local half

- The local daemon starts a second loopback listener (default `port+1`,
  so `4442`) serving the content role only. Same process, one lifecycle:
  they come up and shut down together, and `isocan status` says whether the
  content origin is up. Loopback-bound under the same gate ethic the repo
  tree formalized.
- The app receives the base; item frames flip: `src` on the content origin,
  `sandbox="allow-scripts allow-same-origin"` — safe *by construction* under
  invariant 2, because the origin it is now "same" as holds nothing.
- Badge-less reads on the content listener are accepted and correct here:
  loopback, single-user home, hash-addressed — the same three facts that
  admit the tree, and the same warning applies: the argument must never be
  relaxed by somebody who does not know all three.
- What deliberately does not move: `srcdoc` frames (the draft preview, the
  edit-text frame) are unaffected — the draft's `allow-scripts` srcdoc is
  opaque-origin and local by construction; the edit-text frame's
  `allow-same-origin`-with-dead-scripts was measured safe on the app origin
  and may migrate later as a tidy, not a requirement.

Stable place: local frames get structural isolation and storage (the atlas
can pin things); hosted is byte-identical to today because its base is null.
Rollback: unset one variable.

*Landed 26 Aug 2026. The second listener is 4441's neighbour (4442),
ephemeral if taken, and `contentPorts` refuses to plan one for a wide-bound
daemon — so the hosted shape never grows a network-facing badge-less
listener by this path. Default-ON for local homes, which moved the plan's
"carried open question" to a decision: an origin split you must opt into is
a fix most homes wouldn't have. `contentPort: "off"` is the escape hatch and
a test pins that it restores today exactly. Proven live: a `localStorage`
visit counter incremented across reloads on the content origin. No CSP on
the content role yet — stage 3 owns that.*

## Stage 3 — the outbound control, decided on its own

The origin split stops *inbound* theft — cookie, API, parent document. It
does not stop a scripted page from sending what it computes *out* (the
workbench review's exfiltration note). That is a separate control with a
real tension: a strict `connect-src` also breaks legitimate screens that
load external images or data, and agent-written screens do.

The stage is therefore small and honest: **measure what real items actually
load** (the canvases we have are the corpus), then choose the CSP the
content role serves and guard it. It can land with stage 2 or after it;
it blocks nothing. On a local home the exposed secrets are one user's own
items, so the control matters most on the hosted shape — which is another
reason it must be decided before stage 4c, and recorded where the blob-route
comment keeps its ledger.

*Landed 27 Aug 2026, and the measurement was decisive. 76 HTML blobs,
15.5MB of real agent-written screens: 48 run an inline `<script>`, 28 load a
remote stylesheet — **every one of them Google Fonts** — 14 use
`localStorage`, and **zero** use a remote script, `fetch`, XHR, WebSocket,
an `<iframe>`, a `<form>`, a remote image or `eval`. The only hosts
referenced anywhere were `fonts.googleapis.com` and `fonts.gstatic.com`
(`www.w3.org` is an SVG namespace, not a request). So the policy is
everything that renders, nothing that talks: `default-src 'none'` with
inline script and style allowed, Google Fonts as the one remote allowance,
images and media confined to `data:`/`blob:` (an image URL is exfiltration
with extra steps), and `connect-src 'none'` — free today, by the
measurement, and the main channel. No `sandbox` directive, ever: it would
re-impose the opaque origin and take back stage 2's storage. Verified live
on the content origin: the counter still incremented (inline script and
storage intact), a Google Font stylesheet loaded, and both `fetch` and an
image beacon to an external host were blocked. The residual hole is
recorded rather than papered over — a page can still navigate ITSELF to an
attacker URL, which no portable CSP directive stops.*

## Stage 4 — the hosted half, in dependency order

Three sub-decisions; the hosted home stays at today's behavior until **all
three** land, per invariant 5.

- **4a. The domain.** A second registrable domain (the
  `githubusercontent.com` pattern), chosen in the same conversation that
  picked isocan.io. Infra: one more managed certificate and a host rule on
  the existing URL map → the same Cloud Run service; `80-load-balancer.sh`
  grows, no new service exists. The daemon recognizes the role by
  `ISOCAN_CONTENT_HOST`.
- **4b. Read auth — the collision, resolved rather than dodged.** The
  2026-08-23 closure says expulsion reaches the bytes; the content origin
  cannot carry the cookie that enforces it. The recommended resolution:
  **short-lived signed URLs**, minted by the badged app origin per frame
  render — signature over `(canvasId, hash, expiry)`, TTL in minutes, the
  daemon's existing signing keys. The closure comment dismissed "a token in
  a URL" because a *durable* token is a credential where people paste; a
  TTL-minutes signature is not durable, which is what rescues it. The honest
  cost, to be recorded in that same `http.ts` ledger when it lands:
  expulsion reaches the bytes *within one TTL* on the hosted shape — an
  expelled badge cannot mint anew, and what it already minted dies in
  minutes. This design belongs with the door (the multiuser project) and
  should be written there, not improvised inside this plan.
- **4c. Flip hosted frames** — mechanically identical to stage 2's flip,
  gated on 4a+4b, still governed by invariant 2.

Stable place at every point inside this stage: hosted base stays null until
4c, so the hosted home is today's home throughout.

## What this unblocks — the acceptance, owned by other projects

- **Custom views** (`role=view`, the tab strip) — the workbench plan's one
  deliberately-gated piece.
- **The hosted extension-panel tier** — which the extensions design says
  does not exist at all without this.
- **Storage for interactive items** — the atlas pins things, and nothing
  had to know about isocan for it to work: the proposal's own test of
  whether this was the right fix.

## Carried open questions

- **Markdown renders on the app origin** — parsed and DOM'd by the app, a
  different exposure the proposal flags; owed a pass, not owed to this plan.
- **Local default**: once stage 2's guards exist, the content listener
  should default **on** for local homes — an origin split you must opt into
  is a security fix most homes don't have. Recorded as the intent; flipped
  only after a release of soak as opt-in if caution wins.
