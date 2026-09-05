---
status: noted
since: 2026-09-04
see: harnesses, on-demand
note: measured 4 Sep — Google ships an official ACP server for Antigravity (registry entry 20 Aug, 1.1.1 on 3 Sep) as a 316 MB per-platform zip from dl.google.com, not npm; it speaks ACP 1 with session load/resume, keeps its own login apart from the IDE's and the CLI's, and its Google login rejected this account as "not eligible for Antigravity". First call: not worth building on. Revisited the same evening: the server's gemini-api-key method skips the gate, so it is built on a key
---

# Antigravity over ACP

**4 September 2026.** Could `isocan rc` run agents on Google Antigravity
the way it runs them on Claude Code, pi and codex (the
[harnesses](../projects/harnesses/journey.md) project)? Measured on this
machine, on the day dated. **First decision: not built** — the user's
call, after reading what follows: the product is not in a shape worth
building on. **Revisited the same evening and built on a key**; the
addendum at the end says what changed.

## What exists

- **The `agy` CLI has no ACP mode.** Issue #31 on `antigravity-cli`
  (opened 20 May) asks for one and is open. The 1.1.26 binary (4 Sep) was
  downloaded and searched: the only "acp" strings are Google Home
  analytics protos. What 1.1.24 did add is `--input-format stream-json`,
  an NDJSON stdio mode of its own, not ACP.
- **The SDK ships no server.** `google-antigravity` 0.1.16 on PyPI (2 Sep)
  and the GitHub mirror were both searched. One test docstring in the
  wheel says "the ACP server sets `run_command_config.enable_sandbox`"
  — the server is a consumer of the SDK, built elsewhere.
- **Google publishes an official ACP server**, `agy_acp_server`, as a
  binary: registry entry `antigravity-acp` added 20 Aug by a Google
  contributor, 1.1.1 on 3 Sep, distributed as a 316 MB per-platform zip
  from `dl.google.com` (an 800 MB native server plus the SDK's
  `localharness_external`). Not on npm. The registry's protocol matrix
  reads it as `agent` with `loadSession`, `session/list`,
  `session/resume`.
- **Four community adapters** wrap `agy` directly (one over its SQLite
  conversation store, one over a local Connect API, one over the SDK
  with a Gemini API key). Google's developer forum carries an unanswered
  request for clarification on whether that is allowed under the terms
  of service; one adapter's README says it is not. Not a foundation.

## What the official server did

Driven with the same client `acp.ts` uses (integer protocol 1, `fs` and
`terminal` declared unsupported):

- **Initialize works.** `loadSession: true`, prompt capabilities for
  image, audio and embedded context, MCP over http and sse, four auth
  methods: `oauth-personal` (Google account), `oauth-business` (Gemini
  Enterprise), `gemini-api-key`, `agent-platform` (Vertex, ADC or key).
- **It keeps its own login.** Home is `~/.gemini/antigravity-acp/`,
  separate from the IDE's `~/.gemini/antigravity` and the CLI's
  `~/.gemini/antigravity-cli`. A machine logged into both still gets
  `session/new: Authentication required` until ACP `authenticate` has
  run once. That call prints an OAuth link (and opened the browser).
- **The login was refused.** After the browser flow: *"User is
  ineligible for free-tier. Your current account is not eligible for
  Antigravity. Try signing in with another personal Google account."*
  The server wiped the credential it had just minted. The account that
  runs the IDE and the CLI on this machine is not, to this server, an
  Antigravity account.

So no session ran, and the injection, permission and resume facts the
other three harnesses have were not measured.

## What building on it would have cost

Two things none of the other harnesses needed, recorded so the price is
known if this is revisited:

- **A builtin that downloads a binary on first use** — `npx -y` is the
  whole distribution story for the other three — with the registry's
  `agent.json` as the source of URLs and versions, cached under
  `~/.isocan/adapters/antigravity/<version>/`, plus a Linux quirk
  (`--uid=` in the registry's args).
- **A one-time login verb**, something like `isocan harness login
  antigravity`, because a summoned session has nobody to click a link;
  and a different "installed" signal for the scan, since neither `agy`
  on the PATH nor the IDE implies this server is logged in.

## Why not

The user's reading, which this note records rather than argues: three
Google entry points (IDE, CLI, ACP server) with three separate logins and
an eligibility gate that rejects an account the other two accept is not a
product to build a harness row on yet. The door stays the general one:
anybody may declare the server under `acpAdapters` in config.json today
and it will be tried like any other adapter; nothing in isocan names
Antigravity specially.

## Addendum, the same evening: built on a key

The question "do we need ACP at all — could a lightweight adapter over the
SDK do the same?" had a cheaper answer than either. ACP is not the
obstacle: the rc's contract is four calls and any stdio process speaking
them is a harness. The SDK is the same `localharness` engine the official
server bundles, and authenticates only by Gemini API key (77 mentions of
`api_key` in the wheel, none of OAuth) — so an SDK adapter would be more
code for the same engine and the same auth. And the official server's
`gemini-api-key` method already reads `GEMINI_API_KEY` from the
environment it was launched from, skipping the eligibility gate; tried
with no key, it said exactly that.

The user's word: a metered key is a valid way to use Antigravity. Built
that evening: the ACP client answers "Authentication required" with a
method the environment can satisfy (`acp.ts`, `UNATTENDED_AUTH`), and
`antigravity` is a builtin whose server is fetched from Google into the
isocan home on first use (`harnesses.ts`). Not yet measured: a real turn
through it — the machine had no key exported, and reading one out of
another tool's credential store was rightly refused.
