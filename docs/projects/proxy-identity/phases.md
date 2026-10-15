# Proxy identity — the walk

[`journey.md`](journey.md) is the ideal and [`design.md`](design.md) the
mechanism. Each phase ends with a testable slice of the proxy-first flow and
preserves byte-for-byte behaviour on every home without
`ISOCAN_PROXY_EMAIL_HEADER`.

**Ordered from the server's door outward.** First the home learns to resolve a
verified proxy email header into a deterministic proxy badge and human actor on
arrival (so browsers and same-browser embeds work with zero badges and zero
passes). Next, `X-Isocan-Session` gives coding-harness sessions zero-ceremony
agent attribution on that same proxy badge. Last, `homeAuth` in `@isocan/api`
lets the CLI invoke an external credential helper command and optional
per-home forward proxy so one-shot terminal commands need no background gateway
daemon.

**Phase citations name their project**: `proxy-identity phase 0`, never a bare
"phase 0".

**Where we are:** specified 15 Oct 2026; nothing is built.
**proxy-identity phase 0 is next** — stateless proxy principal resolution at the
door.

---

## Phase 0 — Stateless proxy principal at the door

**Status: NOT STARTED.**

When `ISOCAN_PROXY_EMAIL_HEADER` (`proxyAuth`) produces a verified
`email:<addr>` attestation on a badge-less HTTP request or WebSocket upgrade,
resolve a deterministic proxy badge (`bdg_prx_...`, `secretHash: ""`) and ensure
a canonical `home:person` human actor is bound on it (`design.md` §1).

- `@isocan/core`: promote `attestedEmail` and `attestedEmailLocalPart` from
  `packages/web/src/lib/identity.ts` into `packages/core/src/attest.ts` so
  server, web, and CLI share one implementation.
- `@isocan/server`: add `proxyBadgeId` and `resolveProxyPrincipal` in
  `packages/server/src/attest.ts`; wire into `http.ts` (`onRequest` hook and
  `registerPages`) and `ws.ts` (`attachWebSockets` upgrade handler).
- Preserve all existing guards: `originAllowed` on badge-less proxy requests,
  `desk.endedBadge` operator-end checks, `refusals.refusingAttestation`, and
  `401 no-badge` whenever `ISOCAN_PROXY_EMAIL_HEADER` is unset or the header is
  absent/unparseable.
- `@isocan/api`: in `resolveIdentity`, when no harness session is present and
  `readIdentity(home)` is null, query `client.actorBindings(["home:person"])` so
  a zero-state CLI talking to a proxy-authenticated home learns its human actor
  without `~/.isocan/identity.json`.

**Proof:** in `packages/server/test/proxy-identity.test.ts`, a daemon started
with `ISOCAN_PROXY_EMAIL_HEADER=x-forwarded-email` accepts badge-less HTTP
requests (`GET /api/actors`, `POST /api/ops`) and `/ws` upgrades carrying
`X-Forwarded-Email: priya@acme.test`, resolves the same `usr_...` human actor
across requests, folds onto an existing actor if another badge already attested
`email:priya@acme.test`, refuses cross-origin POSTs outside
`ISOCAN_ALLOWED_ORIGINS` with `403 bad-origin`, refuses `Authorization: Bearer
bdg_prx_....anything` when the proxy header is absent, honors operator ends and
address refusals, and leaves a daemon without `ISOCAN_PROXY_EMAIL_HEADER`
refusing badge-less requests with `401 no-badge`.

---

## Phase 1 — Stateless per-session agent attribution (`X-Isocan-Session`)

**Status: NOT STARTED.**

When a coding harness session is present in the environment, `@isocan/api` sends
`X-Isocan-Session: <harness>:<sessionId>` and a proxy-authenticated home claims
a distinct agent actor on the person's proxy badge on first sight (`design.md`
§2).

- `@isocan/core`: define `SESSION_HEADER = "x-isocan-session"` and
  `parseSessionHeader` (validating `isAgentHarness(harness)`, printable ASCII,
  length `<= 256`).
- `@isocan/server`: on proxy-authenticated requests carrying a valid
  `X-Isocan-Session`, ensure `<harness>:<sessionId>` is claimed on `req.badge`
  via `engine.claim(req.badge.badgeId, { type: "actor.claim", sessionKey })`
  before route handling. Ignore `X-Isocan-Session` when `proxyAuth` did not
  authenticate the request.
- `@isocan/api`: wire `DaemonRoutes` / `DaemonClient` to attach
  `X-Isocan-Session` when an ambient harness session is active and not
  overridden by an explicit `--as` or enrolled `agent:` identity.
- Update `packages/cli/src/agent-guide.md` (`identity` topic) to note automatic
  per-session naming on proxy-authenticated homes.

**Proof:** in `packages/server/test/proxy-identity.test.ts` and
`packages/api/test/proxy-session.test.ts`, two CLI/API clients with
`CLAUDE_SESSION_ID=conv-1` and `CLAUDE_SESSION_ID=conv-2` talking to a
proxy-authenticated home (`X-Forwarded-Email: priya@acme.test`) with zero prior
`isocan identity --session` calls land ops as two distinct agent actors
(`Charlie` and `Cass`), both marked as agents in `actorKinds` and both owned by
Priya (`ownsAgent` = true), while a third request with no session header lands
as Priya (`usr_...`). Sending `X-Isocan-Session` to a non-proxy home does not
auto-claim an actor.

---

## Phase 2 — External credential helper and forward-proxy transport (`homeAuth`)

**Status: NOT STARTED.**

Allow `@isocan/api` and the CLI to obtain proxy auth headers from an external
command (`authHeaderCommand`) with short-lived caching, automatic refresh on
`401`/`302`, and optional per-home `httpProxy` routing (`design.md` §3).

- `@isocan/server`: extend `HomeConfig` in `packages/server/src/config.ts` with
  `homeAuth` and `homeAuthFor(homeUrl, home, env)` reading `ISOCAN_HOME_AUTH`,
  `ISOCAN_AUTH_HEADER_COMMAND`, and `config.json`.
- `@isocan/api`: add `packages/api/src/auth-helper.ts` executing
  `authHeaderCommand` via `execFile` (`shell: false`, 10s timeout,
  `ISOCAN_TARGET_URL`), parsing header-line or JSON output, rejecting control
  characters, caching at `~/.isocan/auth-cache/<sha256>.json` (`0600`) with TTL,
  and refreshing once on `401` or `302`/`303`/`307` with `redirect: "manual"`.
- `@isocan/api`: wire `DaemonClient` to use an `upstream: true` `BadgeStore`,
  the cached auth-helper headers, and per-home `httpProxy` (`proxyFetch`) when
  `homeAuth` is configured for `base`.
- Update `README.md` configuration reference.

**Proof:** in `packages/api/test/auth-helper.test.ts`, a test stands up a fake
authenticating reverse proxy in front of an isocan daemon: the proxy rejects
unauthenticated requests with `302` to a login URL, verifies a short-lived token
produced by a synthetic helper script (`node -e ...`), and injects
`X-Forwarded-Email: priya@acme.test` upstream. A fresh `ISOCAN_HOME` with only
`homeAuth` configured runs `isocan whoami` and `isocan add` end-to-end with zero
`identity.json`, zero `/api/door` calls, helper invocation cached across two
commands, and automatic helper re-invocation when the token expires (`401` or
`302`).
