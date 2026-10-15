# Proxy identity — the mechanism

**15 October 2026.** Built (phases 0–2 closed 15 Oct 2026). The scenes are [`journey.md`](journey.md);
the walk is [`phases.md`](phases.md).

**The debt it discharges.** `ISOCAN_PROXY_EMAIL_HEADER` (`server/attest.ts`) was
built as an *add-on attestation* atop a badge the caller already carried:

- `http.ts` (`onRequest`) resolves `req.badge` from `Authorization: Bearer` or
  the `isocan_badge` cookie first, and calls `ensureProxyAttestation` only
  inside `if (req.badge)`. A request arriving with a verified proxy email header
  and no badge is refused with `401 no-badge`.
- `ws.ts` (`attachWebSockets`) closes any upgrade without a presented badge with
  `4401 WS_NO_BADGE` before consulting `proxyAuth`.
- Because the home refuses badge-less proxy requests, every surface behind an
  authenticating reverse proxy has to run a stateful onboarding dance before it
  can speak: `POST /api/door` to mint a `bdg_...` secret, `GET /api/attest` +
  `actor.claim` (`enterFromAttestOffer` in `web/src/lib/identity.ts`) to fold
  the human actor, `POST /api/passes` (`#pss_...`) to open a cross-site iframe
  when third-party cookies are blocked, `isocan identity --session` before an
  agent can run its first command, and a background local gateway daemon
  (`gateways` in `config.json`) whenever the proxy needs fresh external auth
  headers.

When an authenticating reverse proxy (`oauth2-proxy`, Pomerium, Cloudflare
Access, or an enterprise identity-aware proxy) sits in front of the home, the
perimeter has already authenticated the person on every request. Minting and
storing a second bearer credential in front of that proxy is pure ceremony.

## The sentence

> **When a home trusts an authenticating proxy, the proxy's verified header is
> the person's badge and human claim on every request, and `X-Isocan-Session` is
> the agent's claim on that same badge.**

---

## 1. Stateless proxy principal resolution (`@isocan/server`, `@isocan/core`)

### The deterministic proxy badge

Every route, admission check, sweep, presence room, and ownership check in
`@isocan/server` operates on a `BadgeRecord` (`req.badge`). Rather than adding a
parallel badge-less branch to forty routes, a verified proxy attestation
resolves to a deterministic `BadgeRecord` on the desk:

- **Badge ID (`proxyBadgeId` in `server/attest.ts`):**
  `bdg_prx_<base64url(sha256("proxy:" + normalizedAttribute)).slice(0, 16)>`.
  Keyed by the normalized attribute (`email:priya@acme.test`), so every request
  from Priya — browser tab, embedded iframe, CLI, or WebSocket upgrade — lands
  on one document read (`desk.badge(badgeId)`) with no secondary index scan on
  the hot path.
- **Unpresentable as a bearer or cookie (`secretHash: ""`):**
  `mintBadge` writes a 64-character hex SHA-256 digest into `secretHash`, and
  `secretMatches` compares 32-byte digests. A proxy badge is stored with
  `secretHash: ""`, which has byte length 0 and can never match any presented
  `<badgeId>.<secret>` token. A proxy badge can therefore *only* be reached
  when `proxyAuth` is configured and `attestationFromProxy(req.headers,
  proxyAuth)` succeeds on that request.

### Human actor resolution on arrival

When `resolveProxyPrincipal(desk, engine, req.headers, proxyAuth)` resolves a
proxy badge:

1. **Upsert the attestation** (`email:<addr>`, `verifiedVia: "proxy"`) onto the
   badge record if not already present.
2. **Check `home:person` on the proxy badge.** If `badge.claims` already holds a
   row with `sessionKey === "home:person"`, the human actor is already bound;
   nothing is written to the actors oplog.
3. **Resume or mint once.** If `home:person` is not yet bound on the proxy
   badge:
   - Query `desk.badgesAttesting(attestation.attribute)` for any other live
     badge that has already proved the same `email:<addr>` and holds a person
     claim (`isPersonHarness(harnessOf(claim.sessionKey))`).
   - If one exists, run `engine.claim(badgeId, { type: "actor.claim",
     sessionKey: "home:person", as: existingActorId })`. Because both badges
     carry `attestation.attribute`, `ClaimContext.vouchedBy` is satisfied by
     construction, folding the proxy badge onto the person's existing `usr_...`
     actor.
   - Otherwise, derive the default display name from the email local-part via
     `attestedEmailLocalPart` (promoted from `web/src/lib/identity.ts` to
     `@isocan/core` so server, web, and CLI share one implementation — house
     rule 4) and run `engine.claim(badgeId, { type: "actor.claim", sessionKey:
     "home:person", name: localPart, fresh: true })`. Using `fresh: true`
     ensures two people who share a local-part across domains or teams never
     fail at the door with `name-taken`; each gets their own `usr_...` id.

### Where it runs

- **`http.ts` (`onRequest` hook):** When `req.badge` is null after
  `resolveBadge(desk, presented)` (and `presented` was not an operator-ended
  badge), call `resolveProxyPrincipal`. If it returns a badge, set `req.badge`
  and proceed through the normal hook (operator checks, takedowns,
  `refusingAttestation`, canvas admission, capability ladder).
- **`http.ts` (`registerPages`):** Because `req.badge` is already populated on
  a proxy-authenticated page load, `if (!req.badge)` is false — the SPA
  fallback serves `index.html` (`data-sso="true"`) without minting a redundant
  cookie badge per browser or per cross-site iframe.
- **`ws.ts` (`attachWebSockets` upgrade path):** When `resolveBadge(desk,
  presented)` returns null and `resolveEnded` is null, call
  `resolveProxyPrincipal` before closing with `WS_NO_BADGE`.

---

## 2. Stateless per-session agent attribution (`X-Isocan-Session`)

### The wire header (`@isocan/core`)

- `SESSION_HEADER = "x-isocan-session"` in `@isocan/core`.
- Value: `<harness>:<sessionId>` (e.g. `claude-code:conv-7b9e`,
  `antigravity:630e3ee9`, `codex:thr-12`), validated by `parseSessionHeader`:
  - `harness` must satisfy `isAgentHarness(harness) === true` (never `web`,
    `home`, `cli`, `person`, or `replica`).
  - Printable ASCII, total length `<= 256`, non-empty `<sessionId>`.

### Server auto-claim on proxy-authenticated requests

When a request is authenticated via `proxyAuth` (`attestationFromProxy`
succeeded) and carries a valid `X-Isocan-Session: <sessionKey>`:

- Check `req.badge.claims` for `row.sessionKey === sessionKey`.
- If absent, run `engine.claim(req.badge.badgeId, { type: "actor.claim",
  sessionKey })` inside the single-writer chain before the route handler runs.
  `applyClaim` (`core/src/claims.ts`) sees an omitted `name` and allocates a
  deterministic free name starting with the harness's initial (`Charlie`,
  `Cass`, `Ada`, `Ansel`) and records `harnesses[actor.id] = harness`.
- Because `req.badge` is the person's proxy badge — which also holds
  `home:person` for `email:<addr>` — `ownsAgent` (`core/src/claims.ts:736`)
  holds immediately: both the human and the session agent sit in
  `req.badge.claims`.
- When `proxyAuth` is **not** configured (or the request carried no valid proxy
  attestation), `X-Isocan-Session` is ignored by the server. An unauthenticated
  or local-daemon caller keeps the explicit `isocan identity --session` rule.

### Client resolution (`@isocan/api`)

1. **`DaemonRoutes` (`api/src/routes.ts`):** Accepts an optional ambient session
   key provider (populated by `DaemonClient` from `harnessSessions(home)` when
   not overridden by `--as` or an explicit `agent:<name>` identity) and sends
   `X-Isocan-Session: <key>` on HTTP requests.
2. **`resolveIdentity` (`api/src/identity.ts`):**
   - When `harnessSessions(home)` is non-empty, `findSessionIdentity` already
     calls `client.actorBindings(present.map((s) => s.key))` (`GET
     /api/actors?keys=...`). On a proxy-authenticated home, that `GET` carries
     `X-Isocan-Session`, the server binds the session on first sight, and `GET
     /api/actors` returns the bound agent `Actor` in one round trip — no prior
     `isocan identity --session` required.
   - When `harnessSessions(home)` is empty (a human terminal) and
     `readIdentity(home)` is null (no `~/.isocan/identity.json`),
     `resolveIdentity` queries `client.actorBindings([HOME_CLAIM_KEY])` (`GET
     /api/actors?keys=home:person`). On a proxy-authenticated home, that returns
     the proxy badge's human `Actor` (`source: "home"`), so `requireIdentity`
     never prompts on TTY or fails in non-TTY scripts.

---

## 3. External credential helper and forward-proxy transport (`@isocan/api`, `@isocan/server`)

### Configuration (`HomeConfig` in `server/config.ts`)

Beside `home` and `gateways`, `~/.isocan/config.json` gains `homeAuth`, keyed by
normalized canonical `homeUrl`:

```json
{
  "home": "https://canvas.acme.test",
  "homeAuth": {
    "https://canvas.acme.test": {
      "authHeaderCommand": ["acme-auth-helper", "--header", "https://canvas.acme.test"],
      "httpProxy": "http://127.0.0.1:3128",
      "ttlSeconds": 300
    }
  }
}
```

For single-home shell and container setups with no `config.json`, environment
variables provide the same surface:

- `ISOCAN_AUTH_HEADER_COMMAND`: JSON string array (e.g.
  `'["acme-auth-helper","--header"]'`) or executable path when no arguments are
  needed.
- `ISOCAN_HOME_AUTH`: JSON map matching `homeAuth` in `config.json` (mirroring
  `ISOCAN_HOME_GATEWAYS`).

### Execution, caching, and security (`api/src/auth-helper.ts`)

Following `git`'s `credential.helper` and `kubectl`'s `exec` credential plugin:

- **No shell (`execFile`):** `authHeaderCommand` is an argv array `readonly
  string[]`, executed via `node:child_process.execFile` with `shell: false`, a
  10-second timeout, and `ISOCAN_TARGET_URL=<homeUrl>` in the environment. Shell
  metacharacters in URLs or config values can never be interpreted.
- **Output format:** stdout may be either a single HTTP header line
  (`Header-Name: value`, e.g. `Cookie: ...` or `Authorization: Bearer ...`) or a
  JSON object `{"headers": {"Header-Name": "value"}, "expiresAt"?: "<ISO>"}`.
  Reject `\r` or `\n` inside parsed header names or values to prevent header
  injection.
- **Caching (`0600`):** Cached in memory per `(homeUrl, command)` and on disk at
  `~/.isocan/auth-cache/<sha256>.json` (`0600`) for `ttlSeconds` (default `300`,
  or until `expiresAt` when earlier), so a sequence of CLI calls in one workflow
  spawns the helper once instead of per command.
- **Refresh on `401` or `302`:** Proxy sessions commonly signal expiry with
  either `401` or a `302` redirect to a sign-in endpoint. When `homeAuth` is
  active, `DaemonRoutes` sends requests with `redirect: "manual"`; on a `401` or
  `302` (or `307`/`303`), it evicts the cached header, runs `authHeaderCommand`
  once more, and replays the request once.
- **No door knocks (`upstream: true`):** When `homeAuth` is active for `base`,
  `DaemonClient` uses an `upstream: true` `BadgeStore` so it never writes a
  `bdg_...` secret to `identity.json` and never calls `POST /api/door`.
- **Per-home forward proxy (`httpProxy`):** When `homeAuth[base].httpProxy` is
  set, `DaemonClient` routes HTTP (`undici` `EnvHttpProxyAgent` with
  `proxyTunnel: false`) and WebSocket (`HomeLink` / `ws` agent) traffic for that
  home through the named forward proxy without requiring global `HTTPS_PROXY` in
  the user's shell.

---

## Security boundaries

| Boundary | How it is held |
| --- | --- |
| **Header spoofing when `proxyAuth` is off** | `resolveProxyPrincipal` and `X-Isocan-Session` auto-claim return null immediately when `ISOCAN_PROXY_EMAIL_HEADER` is unset or `attestationFromProxy` returns null. Tested by sending both headers to an unconfigured daemon and asserting `401 no-badge`. |
| **CSRF on browser / ambient proxy requests** | `http.ts` (`onRequest`) runs `originAllowed` whenever `presented?.carrier !== "bearer"`. A badge-less proxy-authenticated request has `presented === null`, so `originAllowed` is enforced on every `/api/*` request and `/ws` upgrade. Cross-site embeds must be listed in `ISOCAN_ALLOWED_ORIGINS`. |
| **Proxy badge cannot be exported as a bearer token** | Proxy badges are written with `secretHash: ""`. `secretMatches` hashes a presented secret to 32 bytes (64 hex chars), which never equals an empty hash in `timingSafeEqual`. Presenting `Authorization: Bearer bdg_prx_....anything` always fails `resolveBadge`. |
| **Operator end and home-scope refusals** | `resolveProxyPrincipal` checks `desk.endedBadge(badgeId)` (honoring operator ends with `401 badge-ended`) and `http.ts` / `ws.ts` run `refusals.refusingAttestation(req.badge.attestations)` before canvas admission, so `isocan operator refuse email:…` and `isocan operator end` stop a proxy principal immediately. |
| **No shell injection in `authHeaderCommand`** | `authHeaderCommand` is an argv array run with `execFile(..., { shell: false })`. Header names and values are checked against control characters (`[\r\n\0]`). |

---

## Surface checklist (house rule: done on both surfaces)

1. **Op vocabulary:** Unchanged. Proxy principal claims and session auto-claims
   write ordinary `actor.claim` entries through `Engine.claim`.
2. **CLI verb:** Existing `isocan whoami` and `isocan status` report proxy-backed
   standing (`attested via proxy`) and active `homeAuth` configuration; no new
   verb needed because the goal is zero ceremony on every existing verb.
3. **Agent guide (`packages/cli/src/agent-guide.md`):** Update the `identity`
   topic to note that on a proxy-authenticated home, the human and each harness
   session are named automatically on first command (`isocan whoami` shows the
   assigned name; `isocan identity --name` still renames if desired).
4. **Shared helpers in `@isocan/core`:** Move `attestedEmail` and
   `attestedEmailLocalPart` from `packages/web/src/lib/identity.ts` to
   `packages/core/src/attest.ts`, and add `SESSION_HEADER` +
   `parseSessionHeader`.
5. **README:** Document `ISOCAN_PROXY_EMAIL_HEADER` stateless arrival and
   `homeAuth` credential helpers in the self-hosting / configuration reference.
6. **Tests:** Unit tests in `@isocan/core`, `@isocan/server`, and `@isocan/api`,
   plus an end-to-end HTTP + WebSocket test driving a fake authenticating reverse
   proxy in front of a daemon with zero `identity.json` and zero `/api/door`
   calls.
