---
status: designed
since: 2026-10-15
see: multiuser, first-minute, multi-identity, embed, antigravity, iso-api
note: specified 15 Oct 2026. When a home sits behind an authenticating reverse proxy (ISOCAN_PROXY_EMAIL_HEADER), the proxy's verified header is the person's identity per request, and a harness session header (X-Isocan-Session) is the agent's identity per request — with an external credential helper (homeAuth) in @isocan/api so one-shot CLI calls and same-browser embeds need zero stored badges, zero single-use passes, zero explicit identity claims, and zero background gateway daemons. Nothing is built; phase 0 is stateless proxy principal resolution at the door.
---

# The proxy already knows who you are

This is the **ideal**: what it feels like when an isocan home sits behind an
authenticating reverse proxy (`oauth2-proxy`, Pomerium, Cloudflare Access, or
an enterprise identity-aware proxy) that already verifies every request before
it reaches the daemon. The mechanism is [`design.md`](design.md); the walk is
[`phases.md`](phases.md).

The scenes are synthetic. Acme is a made-up company running an internal home at
`https://canvas.acme.test` behind an authenticating reverse proxy that stamps
`X-Forwarded-Email` on every verified request.

Three principles sit behind every scene:

1. **Do not mint a second credential when the perimeter already verified one.**
2. **An agent's conversation id is already its session identity.**
3. **A CLI talking through a proxy should run a helper command, not a daemon.**

---

## Scene 1 — A fresh terminal, a first command

Priya opens a fresh cloud workstation at Acme. `~/.isocan/` does not exist: no
`identity.json`, no stored badge, no running local daemon. Her team's dotfiles
set `ISOCAN_HOME_URL=https://canvas.acme.test` and an external credential
helper command (`authHeaderCommand`) that prints a short-lived proxy header to
stdout.

She runs one command in her repo:

```sh
isocan ls --canvas prj_acme01
```

It prints the canvas's items in under half a second. It did not knock on
`/api/door`, did not write `identity.json`, and did not ask her for her name.
When she runs `isocan whoami`, it answers `priya (usr_...) — attested as
email:priya@acme.test via proxy`.

**What the scene forces:** a verified proxy header on a badge-less request must
resolve to a canonical human actor and proxy-backed badge at the home on first
sight, and `@isocan/api` must be able to invoke an external credential helper
command (with short-lived caching and refresh on `401`/`302`) instead of
requiring a background gateway daemon or a pre-minted `bdg_...` secret.

---

## Scene 2 — An agent speaks on its first command

Priya opens a coding agent in the same workspace. Its harness sets
`CLAUDE_SESSION_ID=conv-7b9e`. Nobody has run `isocan identity --session`, and
no hook was needed to register the conversation ahead of time.

The agent runs:

```sh
isocan comment reply thr_9x1 "Moved the summary above the fold."
```

On the canvas, the reply appears from **Charlie** (`usr_...`), marked as an
agent belonging to Priya. Ten minutes later, in the same conversation, the
agent adds an HTML screen; it lands from the same **Charlie**. When Priya opens
a second, parallel agent session (`CLAUDE_SESSION_ID=conv-8c2f`), its first
command lands from **Cass** (`usr_...`), without touching Charlie or Priya.

**What the scene forces:** when a harness session key is present in the
environment, `@isocan/api` sends `X-Isocan-Session: <harness>:<sessionId>` with
the request. On a proxy-authenticated home, `(email:<addr>, sessionKey)`
deterministically resolves (or allocates on first sight) a distinct agent actor
bound to that person's proxy badge, so `ownsAgent` holds without an upfront
`isocan identity --session` round trip.

---

## Scene 3 — An embedded canvas pane in the same browser

Priya opens her coding environment in the browser, where she is already signed
into Acme's identity-aware proxy. She opens a side pane that frames
`https://canvas.acme.test/p/prj_acme01?embed=1`.

The canvas renders immediately as Priya, with live WebSocket presence and full
edit standing. Her browser blocks third-party cookies in cross-site iframes,
and the host pane never minted a `#pss_...` single-use pass. Because every HTTP
request and the `/ws` upgrade inside the frame carry Acme's proxy session to
`canvas.acme.test`, the proxy stamps `X-Forwarded-Email: priya@acme.test` on
each of them, and the home recognizes Priya on every hop.

**What the scene forces:** both HTTP routes and WebSocket upgrades must accept a
verified proxy header when no badge cookie or bearer token is presented, while
still enforcing the `Origin` check (`ISOCAN_ALLOWED_ORIGINS` and own-origin) so
a cross-site page outside the allowlist cannot ride an ambient proxy session.

---

## Scene 4 — Nothing changes when there is no proxy

Jordan runs `isocan` on his laptop against `http://127.0.0.1:4441` and
`https://isocan.io`, where `ISOCAN_PROXY_EMAIL_HEADER` is unset.

A request with `X-Forwarded-Email: jordan@acme.test` and no badge is refused
with `401 no-badge`. A request with `X-Isocan-Session: claude-code:conv-1` on an
unclaimed session does not auto-claim an actor until `isocan identity --session`
is run. Every badge, pass, magic-link attestation, and operator refusal works
byte-for-byte as before.

**What the scene forces:** proxy principal resolution and header-driven session
auto-claim are strictly gated on `ISOCAN_PROXY_EMAIL_HEADER` producing a
verified proxy attestation for that request. Without `proxyAuth`, client-sent
proxy or session headers carry zero authority.

---

## What the scenes force

1. **Proxy principal resolution at the door (`@isocan/server`).** When
   `ISOCAN_PROXY_EMAIL_HEADER` (`proxyAuth`) yields a verified `email:<addr>`
   attestation on a badge-less HTTP request or WebSocket upgrade, the home
   resolves a deterministic proxy badge (`bdg_prx_...`) and ensures a canonical
   human actor (`home:person`) is claimed on it — resuming any existing person
   actor already attested to `email:<addr>` or claiming the email's local-part
   on first sight.
2. **Stateless per-session agent attribution (`X-Isocan-Session`).** When a
   coding harness session is present in the environment, `@isocan/api` sends
   `X-Isocan-Session: <harness>:<sessionId>`. On a proxy-authenticated request,
   the home ensures that `<harness>:<sessionId>` is claimed on the proxy badge
   before running the route, allocating a harness-initial name on first sight
   and preserving `ownsAgent` through the shared proxy badge.
3. **External credential helper and forward-proxy transport (`@isocan/api`).**
   `config.json` (`homeAuth`) and `ISOCAN_AUTH_HEADER_COMMAND` allow a client
   to obtain per-home proxy headers by executing a local command (`execFile`,
   never a shell), caching the result with a short TTL, refreshing once on
   `401` or `302`, and optionally routing through an explicit `httpProxy`
   forwarder (`EnvHttpProxyAgent` with `proxyTunnel: false`) with no background
   gateway daemon.
4. **Unchanged security boundaries.** Proxy-authenticated requests without a
   bearer badge remain subject to `originAllowed` CSRF checks, operator
   takedowns, badge ends, and home-scope address refusals. Homes without
   `ISOCAN_PROXY_EMAIL_HEADER` ignore proxy and session headers completely.
