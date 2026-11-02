---
status: partial
since: 2026-09-10
see: on-demand, harnesses, agent-custody, standing-agents
issue: 238
note: Layers 1 and 3 built 11 Sep. Layer 1 — permissions answered by kind (the allow_once option, else the agent's own reject; a mode switch is never chosen) and the adapter's environment as a list rather than the whole shell. Layer 3 — `isocan rc --sandbox` fences every adapter in @anthropic-ai/sandbox-runtime with a policy derived from the enrolment, after a spike that measured the fence holding on Linux (the daemon reachable through srt's proxy, a real Claude turn completed, sessions resuming) and found SIX things a wrapper must know, each a silent failure otherwise: srt's Linux bridge dies unreported on a kernel without IPv6; `NO_PROXY` cleared and `NODE_USE_ENV_PROXY=1` inside; npm's own proxy keys for `npx`; the harness's config dir re-allowed or sessions never resume; and srt's own files re-allowed or it vanishes inside its own fence. Asked for and not buildable is a refusal, never a quiet unfenced run. Measured 10 Sep, before any of it: a summoned agent got `{ ...process.env }` minus harness variables, the person's shell on the host, every permission auto-allowed by a regex, codex forced to full access because its sandbox refused loopback, and any admitted member of a shared canvas could ring. macOS outer-sandbox checks now pass too (srt 0.0.76). Native Codex is separately opt-in via --codex-sandbox, with command-level policy checks on macOS and Linux; nesting remains refused. Decided 11 Sep (D1): --sandbox stays opt-in, not the default yet. Recommendation 6 (D2, decided the same day) built 11 Sep too — owner-only summons: an agent answers only the person whose rc runs it (and that machine's own actors) until the owner widens it with `rc listen --to` or the tray's Let anyone ask; the gate is at the rc's dispatch, announced with its hold, a refused mention answered in its thread, and only the owner's word widens (`writtenBy` on the enrolment). Still owed: a reach word on the enrolment translated per harness, the second-user recipe
---

# What the rc hands over, and how to hand over less

**10 September 2026.** Research. **Layers 1 and 3 built 11 September.**
Layer 1 is in `acp.ts`: permissions answered by kind, the environment as a
list, with `config.json`'s `adapterEnv` hook for what the list does not
know. Layer 3 is `sandbox.ts`: `isocan rc --sandbox`, written from what the
measurement below found rather than from the documentation. Native Codex now has a separate opt-in (measured below). The
consent default — recommendation 6, owner-only summons — was built the same
day too ([below](#owner-only-summons--11-september)). The second-user recipe
and nested sandboxes remain owed.
`scripts/spike-srt.sh` now also has passing macOS measurements.
**Decided 11 Sep** (Decisions, below): the fence stays opt-in rather than the
default, and summons become owner-only by default — the consent default is
decided and built ([owner-only summons](#owner-only-summons--11-september)).

> "I realise that when I run rc and give it my harness... it pretty much has
> access to my entire system :)"

True, and worth saying precisely before deciding what to do about it. This
note measures what `isocan rc` gives a summoned agent today, lists what the
agent actually needs, and surveys what the protocol, each harness, and the
operating system offer to close the gap. Two surveys behind it, both run
this day: the harness-native controls (Claude Code, codex, pi and Antigravity
driven over ACP) and the OS-level sandboxes (`@anthropic-ai/sandbox-runtime`,
Seatbelt, bubblewrap, Landlock, containers, a second user). Sources are cited
inline; anything not verified says so.

## What is handed over today

Measured in `packages/cli/src/acp.ts` and `harnesses.ts`:

- **The whole environment.** `adapterEnv` starts from `{ ...process.env }`
  (`acp.ts:90`) and deletes only the harness variables plus `CLAUDECODE` and
  `CLAUDE_CODE_ENTRYPOINT`. `SSH_AUTH_SOCK`, `AWS_*`, `GITHUB_TOKEN`,
  `NPM_TOKEN`, every exported key the person's shell carries — all of it
  travels into the adapter and from there into every shell the agent opens.
- **The person's shell, unfenced.** The client declares `fs` and `terminal`
  unsupported (`acp.ts:228`). That does not take the shell away; it means the
  harness uses *its own* file and shell tools on the host, as the spike
  confirmed ("the agent's own Bash runs fine regardless"). The working
  directory is the enroller's, but nothing fences the agent to it.
- **Every permission, granted by a regex.** `session/request_permission` is
  answered with the first option whose kind, id or name matches `/allow/i`,
  else `options[0]` (`acp.ts:307`). The module comment calls this
  provisional and names phase 4/5 as the door; the door closed on the
  ceiling and the cycle guard, which bound *how often* an agent runs and not
  *what it may reach*.
- **codex at full access, on purpose.** Its default mode refused loopback, so
  the CLI inside could not reach the daemon; the builtin runs it with
  `INITIAL_AGENT_MODE=agent-full-access` (`harnesses.ts:88`) — no sandbox,
  no approvals.
- **Anyone admitted can ring.** The agent-custody design leaves open "whose
  ask a parked rc honors": any admitted member of a shared canvas can summon,
  and the turn runs on the rc owner's machine with the rc owner's
  credentials.

The posture `acp.ts` states — "the same trust as the person typing the
harness's name themselves" — is not quite the situation. A person typing
`claude` sits at the keyboard answering prompts, in a directory they chose,
for a task they asked for. A summoned turn has nobody at the keyboard, every
prompt pre-answered yes, and an asker who may be somebody else on a shared
canvas. That is the gap the ask names.

**One small defect found on the way.** The Claude adapter's plan-exit prompt
offers only `allow_always` options — `exit-plan-auto`, `exit-plan-bypass`,
`exit-plan-accept-edits`, `exit-plan-default` and the clear-context variants
(the adapter's `docs/permission-extension.md`, which also says options are
grouped `allow_once`, then `allow_always`, then reject). The regex picks the
first of those, which switches the session's mode; `bypass` is second in the
list. It only arises if the person's `permissions.defaultMode` is `plan`,
since the rc never sets a mode, but the answer function should choose by
`kind === "allow_once"` and reject anything else, never by index or by a
word in the name.

## What the agent actually needs

This is the allow-list; everything outside it is reach the agent has and
does not use.

| Need | Why |
| --- | --- |
| Read and write in the enrolment's `cwd` | The work |
| Loopback to the daemon's port | The CLI inside talks to `127.0.0.1` (`daemon.ts` binds loopback and trusts it by name) |
| `~/.isocan/` | `identity.json` (the badge and its secret), `daemon.json`, `config.json`, `sessions/` — what the CLI inside needs to speak as `agent:<name>` |
| The harness's own config and login | `~/.claude` (and the macOS keychain item), `~/.codex/auth.json`, `~/.pi/agent/auth.json`, `~/.gemini/…`, `.pi/` and `.claude/` in the project |
| Outbound HTTPS to the vendor | `api.anthropic.com`, `api.openai.com`/`chatgpt.com`, Google's endpoints |
| Node, `npx`, and the npm cache | The builtin adapters are `npx -y <package>` |
| `PATH`, `HOME`, `TMPDIR`, locale, proxy variables | For any of the above to run |

Not on the list: the rest of `$HOME`, `~/.ssh`, cloud credentials, other
repositories, the SSH agent socket, the ability to bind ports or reach the
LAN.

## What can be done, in three layers

### Layer 1 — what the rc can do with no new dependency

Cheap, and worth doing whatever else is decided.

1. **Answer permissions by kind.** Select `kind === "allow_once"`; reject the
   rest with a reason the narration shows. `allow_always` options in the
   Claude adapter apply `PermissionUpdate`s (rules, mode switches,
   directory additions) — precisely the durable widenings an unattended
   session should not be making on its own behalf.
2. **Allow-list the environment.** Replace "everything minus harness
   variables" with a named set: `PATH`, `HOME`, `TMPDIR`, `LANG`/`LC_*`,
   `TERM`, `SHELL`, the proxy variables, `ISOCAN_*`, `CLAUDE_CONFIG_DIR`,
   `CODEX_HOME`, `GEMINI_API_KEY` and the vendor key variables, plus a
   `config.json` hook for what a person's harness genuinely needs. The
   accidental exports (`AWS_*`, `GITHUB_TOKEN`, `SSH_AUTH_SOCK`) stop
   travelling. This is the same posture as `harnessVars`: a list, with a
   hook.
3. **Decide who may ring.** Owner-only by default, with an rc-side allow —
   the candidate agent-custody already names. The rc announces its policy
   with its hold, so the web dialog can say whose ask this machine honours.
   *Built 11 September — [owner-only summons](#owner-only-summons--11-september).*

### Layer 2 — each harness's own narrowing, through the client isocan already is

isocan is the ACP client. What a client can set at `session/new` and through
the environment is the cheapest real fence, because the harness enforces it
with its own machinery. Per harness, verified against the adapter sources on
10 Sep unless flagged:

**Claude Code (`@agentclientprotocol/claude-agent-acp`).** The adapter reads
`session/new`'s `_meta.claudeCode.options` as SDK `Options` and forwards
`allowedTools`, `disallowedTools`, `additionalDirectories`, `settingSources`,
`sandbox`, `env` and `tools`. It also loads `~/.claude/settings.json` and the
project's `.claude/settings(.local).json`, so the person's own `permissions`
and `sandbox` blocks already apply. The initial mode is the person's
`permissions.defaultMode`; `bypassPermissions` is offered as a mode only
outside root or with `IS_SANDBOX`. So the rc can, per turn and without
touching the person's files: pin `additionalDirectories` to the enrolment's
`cwd`, deny `Bash` outright for a canvas-only agent (`disallowedTools`), or
turn on Claude's own Bash sandbox with `sandbox.enabled` and
`network.allowedDomains` naming the vendor and the daemon's port. Caveat the
docs are explicit about: that sandbox covers **Bash only**; the built-in file
tools, MCP servers and hooks run on the host. Unverified: whether
`network.allowedDomains` accepts `127.0.0.1:<port>` (the IPv6 literal form is
documented, so it very likely does).

**codex (`@agentclientprotocol/codex-acp`).** Three modes, hard-coded in the
adapter's `AgentMode.ts` and sent on every turn: `read-only` (misnamed —
workspace-write with a human reviewer), `agent` (workspace-write, auto
review, **no network**), `agent-full-access`. `INITIAL_AGENT_MODE` picks the
initial one; `session/set_mode` switches. The reason isocan chose full access
is the `networkAccess: false` in the other two, which blocks loopback. codex
has since grown a network-proxy layer configured under
`[permissions.workspace.network]` with `allow_local_binding` and a
`domains` map (`"127.0.0.1" = "allow"`), settable through the adapter's
`CODEX_CONFIG` JSON. **Unverified and needs a spike:** whether the
per-turn `sandboxPolicy` the adapter sends overrides that config, and codex
issue #33227 (open) reports the explicit loopback exception failing where
`allow_local_binding = true` works. If the spike passes, codex can run as
`agent` with loopback allowed and the full-access line in `harnesses.ts`
goes.

**pi (`pi-acp`).** No permission system by design ("runs with the
permissions of the user account that starts it"). Tools can be narrowed
with `--tools`/`--exclude-tools` or `defaultTools` in `.pi/settings.json`,
and an extension can block `tool_call` — but `pi-acp` passes no tool flags,
and writing settings into the person's project is not the rc's to do. pi
needs layer 3 or nothing.

**Antigravity (`agy_acp_server`).** The official docs were unreachable from
here. Search snippets describe `permissions: {allow, ask, deny}` and
`enableTerminalSandbox` in `~/.gemini/antigravity-cli/settings.json`, with a
sandbox whose allowlist "is initialized with just localhost". Whether the
ACP binary honours any of it is unverified.

**The protocol itself** offers nothing for this. `session/new`'s root set
(`cwd` plus `additionalDirectories`) "SHOULD serve as a boundary" — advisory.
There is no sandbox or network field anywhere in v1, and the registry's
entry schema has no permission fields either. `session/set_mode` and
`session/set_config_option` are the levers, and their ids are per agent.

### Layer 3 — an operating-system boundary around the adapter

For pi, for Claude's non-Bash tools, and for anyone who wants the fence to
hold whatever the harness does. **Built 11 September** as
`packages/cli/src/sandbox.ts`: `isocan rc --sandbox` (or `{"sandbox": true}`
in `config.json`, with `--unsandboxed` to override) wraps every adapter
spawn, on both dispatch paths, in a policy derived from the enrolment — the
row's directory, `~/.isocan`, `/tmp` and the harness's own config to write;
the rest of `$HOME` denied; the daemon's address and the harness's vendor
domains to reach. Asking for a fence this machine cannot build is a
refusal that names what is missing, never a quiet unfenced run, and
`isocan harness` says in advance whether a machine could fence at all. The
survey below is what that was chosen from; the measurement that shaped it
is further down.

**`@anthropic-ai/sandbox-runtime` (`srt`)** — the same engine Claude Code's
`/sandbox` uses, published as a library (v0.0.75 on 1 Sep; "research
preview"). macOS: a generated Seatbelt profile. Linux: bubblewrap with the
network namespace removed, `socat` bridging host-side proxies in, seccomp
blocking Unix sockets. Network is deny-by-default with a domain allow-list
enforced by the proxy; writes are deny-by-default with an allow-list; reads
allow-by-default with a deny-list, and shell rc files, `.git/config`,
`.git/hooks`, `.mcp.json` and the like are denied whatever the config says.
A Node parent calls `SandboxManager.initialize(config)` then
`wrapWithSandbox(command)` and spawns the string it returns. No root
(Ubuntu 24.04 needs a one-time AppArmor sysctl for bwrap). A policy for the
rc writes itself from the table above: read `cwd`, `~/.isocan`, the harness
dirs and the Node toolchain, deny the rest of `~`; write `cwd`, the harness
dirs, `/tmp` and the npm cache; allow the vendor domains and
`127.0.0.1:<daemon port>`.

The caveats are real and each is a spike before adoption:

- **Linux loopback goes through the proxy or not at all.** The child has no
  host network namespace, so `127.0.0.1` inside is its own. The CLI inside
  reaches the daemon only via `HTTP_PROXY`/`ALL_PROXY` with an IP literal
  allow-listed — and the client library must honour those variables. Node's
  `ws` does not; Node's `fetch` does only with `NODE_USE_ENV_PROXY=1`. The
  CLI's own WebSocket to the daemon is the thing to test first. macOS is
  easier: `allowLocalBinding: true` lets the child connect to loopback
  directly.
- **codex inside srt on macOS** nests `sandbox-exec`, which macOS does not
  support recursively. Expect full-access-or-fail; measure.
- **Login happens outside.** Browser OAuth needs Apple Events the sandbox
  denies; the person logs in once with the harness's own tool, as today.
- `npx` needs the npm cache writable; a `denyRead: ["~"]` must re-allow the
  Node toolchain (nvm, fnm, Homebrew).

**Hand-written Seatbelt, bubblewrap, Landlock.** Each does part of what srt
does — and Seatbelt and Landlock cannot say "only this hostname", only ports
and IPs, which is why srt bolts a proxy on. Owning one of these directly is
re-implementing srt with fewer eyes on it. bubblewrap with `--share-net` is
worth knowing as the one-line Linux fence that keeps host loopback native
(filesystem hidden, network unfiltered). firejail is a SUID binary with a CVE
history; nsjail and Coder's Boundary escalate for `CAP_NET_ADMIN`. Skip.

**A stronger box.** Docker Sandboxes (`sbx`, GA 2026, macOS/Windows/Linux):
one microVM per agent, launchers for Claude, codex and Gemini, an egress
proxy that injects secrets so keys never enter the VM, and
`sbx policy allow network localhost:<port>` to reach a host daemon. CLI
only, vendor-controlled, but cheap to support as an optional backend and the
only credible answer on Windows. Anthropic's devcontainer with its
`init-firewall.sh` is the DIY reference. Cloud sandboxes (e2b, Modal, Fly)
are the wrong shape for a laptop with a loopback daemon; they are
isocannery's territory, sketched in on-demand's design.

**The boring boundary: a second OS user.** Create `agent-<you>`, give it its
own `$HOME` with its own harness logins, grant the project by ACL, spawn with
`sudo -n -u`. Everything the kernel's ownership rules isolate is isolated —
keychain, `~/.ssh`, cloud credentials, other repos — and loopback just works.
Root once, to create the user; never at runtime. Costs: files the agent
writes are owned by the other uid (a shared group and default ACLs), each
harness logs in again, tools installed under your own `$HOME` are invisible,
and there is no egress filtering. `sandvault` on macOS is this recipe with a
Seatbelt layer added. It needs no code from isocan beyond a doc, and it is
the layer that holds when everything above it has a bug.

**Credentials, separately.** The daemon already sits on loopback; it can be
the broker: hand the child `ANTHROPIC_BASE_URL` (or an `apiKeyHelper`)
pointing at `127.0.0.1` and add the real key on the way out, so no
credential file has to be visible inside any fence. This is the local
analogue of the vault pattern on-demand's design already names for
isocannery. It works for API-key auth; OAuth-plan logins talk to fixed
backends and would still need their files mounted.

## Comparison

| Option | Fences the filesystem | Fences the network | Loopback to the daemon | Root | Platforms | Cost to isocan |
| --- | --- | --- | --- | --- | --- | --- |
| Env allow-list, answer by kind | no | no | yes | no | all | two functions |
| Claude `_meta.claudeCode.options` | tools and dirs; Bash sandbox | Bash only | likely (`127.0.0.1:port`, unverified) | no | all | per-harness knowledge |
| codex `agent` + loopback config | workspace-write | yes | unverified (#33227) | no | all | a spike |
| pi | none | none | — | — | — | needs layer 3 |
| `srt`, on the PATH | yes | yes, by domain | Linux via proxy: measured, holds | no | macOS, Linux | **built** — no dependency, six things known |
| bubblewrap `--share-net` | yes | no | yes | no | Linux | one command line |
| Docker Sandboxes (`sbx`) | microVM | yes, with secret injection | yes, by policy | install | all | spawn a CLI |
| Second OS user | yes (ownership) | no | yes | once | macOS, Linux | a doc |

## Recommendation

1. ~~**Now, with no decision needed:** answer permissions by kind and
   allow-list the environment.~~ Built 11 September, both in `acp.ts`.
2. **Give the enrolment a word for reach.** The rc half of the record
   (`rc-agents.json`) says how and where; it should also say how far —
   one field, two values: the enrolment's directory (default) or the
   machine. The rc translates the word into each harness's own terms
   through the client it already is: `additionalDirectories` and a Bash
   sandbox for Claude, `agent` mode for codex once the loopback spike
   passes. A harness that cannot honour the word (pi, today) is said so at
   `isocan harness` and in the summons narration, not silently run wide.
3. **Spike codex loopback** under `agent` mode with the network-proxy
   config. If it passes, the full-access line goes; if it fails, the
   finding is the bug report codex needs.
4. ~~**Spike `srt` around the adapter**~~ — done on Linux, and built:
   `isocan rc --sandbox`. What is left is the macOS run
   (`scripts/spike-srt.sh`), which decides whether the fence becomes the
   default rather than an opt-in. The dependency gate went in as a refusal
   rather than a warning, which is stricter than this line first proposed:
   one word cannot also mean its opposite.
5. **Write the second-user recipe** in `docs/`, and point at Docker
   Sandboxes for anyone who wants a VM. Neither costs code.
6. ~~**Close the consent door** in agent-custody: owner-only summons by
   default. Reach limits bound what a turn may do; consent bounds who may
   start one, and a shared canvas makes the second question the sharper one.~~
   Built 11 September — [owner-only summons](#owner-only-summons--11-september).

What isocan should not do: own a Seatbelt profile, a bwrap line, or a
Landlock ruleset of its own. Those are srt with fewer maintainers, and the
constraint `harness.ts` already states — no adapter per harness — applies
to sandboxes too.

## Decisions

**D1. `isocan rc --sandbox` stays opt-in; it is not the default yet.** Dion,
11 Sep 2026. Step 4 above said the macOS run would decide whether the fence
becomes the default. That run has since passed (srt 0.0.76, eight checks held
— the last section below), and the decision is still *not yet*. A person asks
for the fence with `--sandbox`; asked for and not buildable is a refusal,
never a quiet unfenced run. Revisiting the default is a later decision, not a
consequence of any one measurement.

**D2. Summons are owner-only by default.** Dion, 11 Sep 2026 — step 6 above,
taken as written. Reach limits bound what a turn may do; consent bounds who
may start one, and on a shared canvas that is the sharper question. Decided,
and built the same day — [owner-only summons](#owner-only-summons--11-september):
the owner is the rc's person, the gate is at the rc's dispatch and announced
with its hold, widening is `isocan rc listen <name> --to` or the owner's *Let
anyone ask*, and every enrolment with no gate now answers its owner alone.

## The srt spike, measured (11 September, Linux)

Run on Ubuntu 24.04.4 in a Firecracker container (kernel 6.18.44, x86_64,
root, **no IPv6 in the kernel at all** — `/proc/sys/net/ipv6` absent),
Node 22.22.2, `@anthropic-ai/sandbox-runtime` 0.0.76 (published 10 Sep),
bubblewrap 0.9.0, socat 1.8.0.0, `@agentclientprotocol/claude-agent-acp`
0.76.0 over Claude Code 2.1.268. macOS was not available; codex and pi are
not installed here and have no login, so step 3 did not run. The policy
under test: write to one project directory, `~/.isocan` and `/tmp`; deny
read on the rest of `~` (here `/root` and `/home/user`), re-allowing the
project, `~/.isocan`, and the isocan checkout the CLI runs from; network
`127.0.0.1:<daemon port>`, `api.anthropic.com`, later `registry.npmjs.org`.

**Step 1, loopback: holds, after one patch and two variables.**

- The read fence works as documented: a canary in `/root` reads as "no
  such file" inside; `ls /home/user` shows only the re-allowed checkout.
  The mandatory denies materialise as `/dev/null` mounts *in the project
  directory* — `ls -a` inside shows `.bashrc`, `.gitconfig`, `.mcp.json`,
  `.vscode` and the rest that are not on disk — and are cleaned up after.
- **srt's Linux bridge died silently on this host.** Inside the sandbox
  the runtime starts `socat TCP-LISTEN:3128 … UNIX-CONNECT:<sock>` in the
  background with output to `/dev/null`; `TCP-LISTEN` wants an IPv6 socket
  and this kernel has none, so both listeners exit at once with
  `socket(10, 1, 6): Address family not supported by protocol`, and every
  connection to `localhost:3128` is refused "after 0 ms". Nothing
  reported it. A bare `bwrap --unshare-net` confirms the diagnosis:
  `TCP4-LISTEN` works, `TCP-LISTEN` does not. Changing the two listeners
  to `TCP4-LISTEN` in `dist/sandbox/linux-sandbox-utils.js` brought the
  bridge up; everything below is measured with that patch. A laptop kernel
  has IPv6 and would not hit this, but it is the shape of failure to
  expect from srt on Linux: a silent bridge, and "connection refused" as
  the only symptom. Worth an upstream issue.
- **Once the bridge is up, an IP literal in the allow-list reaches the
  host daemon through the proxy.** `curl --noproxy '' http://127.0.0.1:4711/api/health`
  inside got the daemon's answer. A loopback port not in the list is
  refused with "Connection blocked by network allowlist"; a domain not in
  the list gets a 403 CONNECT; `api.anthropic.com` answered 404 through
  the proxy chain.
- **Two variables the wrapper has to set inside the sandbox.** srt
  itself sets `NO_PROXY=localhost,127.0.0.1,::1,…` for the child, so every
  client bypasses the only path to the host for exactly the address that
  needs it: with srt's `NO_PROXY` as set, curl and Node both fail with
  ECONNREFUSED. Clearing `NO_PROXY`/`no_proxy` and setting
  `NODE_USE_ENV_PROXY=1` (Node's env-proxy support, experimental in
  22.22 — it prints an `UNDICI-EHPA` warning) makes Node's `fetch` go
  through the proxy; without the flag it fails even with `NO_PROXY`
  cleared. The isocan CLI uses global `fetch` and a long poll for `wait`,
  no WebSocket, so with those two variables `isocan --json whoami` and
  `isocan wait --timeout 5` both work inside. One more thing seen: when
  the daemon is unreachable, `wait` tries to start one — inside the
  sandbox, that is a second daemon in the sandbox's own network namespace
  that nothing else can reach ("daemon did not come up").
- The listeners race the command: srt backgrounds them and runs the user
  command at once, so a one-line `curl` can run before `socat` listens.
  An adapter takes seconds to start and will not notice; a `sleep 1`
  was enough here.

**Step 2, the Claude adapter under srt: a real turn completed, through
the rc's own spawn path.** With `config.json` declaring `claude-code` as
`srt --settings … -- sh -c 'export NO_PROXY= no_proxy= NODE_USE_ENV_PROXY=1 …; exec npx -y @agentclientprotocol/claude-agent-acp@0.76.0'`
and the two `adapterEnv`-hooked variables, `isocan rc turn Percy hello`
answered "Hi! What are you working on today?" and `end_turn`.

- `npx` inside needs `registry.npmjs.org` allowed **and npm's own proxy
  keys** (`npm_config_proxy`, `npm_config_https_proxy`,
  `npm_config_noproxy=`) pointed at the inner proxy: npm honours its
  config over `HTTPS_PROXY`, and this machine's `npm_config_noproxy`
  listed the registry, so npm resolved DNS directly and failed with
  `EAI_AGAIN`. With the keys set: about 11 s cold whether the npm cache is
  hidden (a tmpfs over `~`) or re-allowed, 2.5 s warm when re-allowed. The
  Claude SDK's own initialize took 18 s the first time.
- **`~/.claude` must be re-allowed for read and write, or sessions do not
  resume.** With `~` denied, the session store lands on the tmpfs and the
  next turn says "the stored one would not load — rebuilt". With
  `~/.claude` and `~/.claude.json` re-allowed, the second turn resumed
  and remembered the word it was told.
- A turn that used the agent's own shell: `isocan --json whoami` from
  Bash inside the sandboxed agent reached the daemon and answered as
  Percy (the enrolled actor, via the injected identity); `cat
  /root/spike-canary.txt` failed; `ls /home/user` showed only the
  checkout. The permission for that Bash call was answered `allow-once`
  by kind — layer 1's answer, on a real adapter. Start to session: 57 s
  on the first turn, 21 s on the resumed one, under srt.
- **Credentials never entered the sandbox.** This machine has no Claude
  login on disk and no key in the environment; the session's egress
  proxy injects the credential on the way out. The model call succeeded
  anyway — the vault pattern the note names, observed working: the
  sandboxed adapter held nothing worth stealing.
- Two things of this machine's, not srt's: the session's own upstream
  proxy terminates TLS with a CA under `~/.ccr`, which `denyRead ~`
  hides, so curl and npm needed the CA re-allowed or the CA variables
  cleared; and the isocan CLI is not installed globally here, so the
  agent's first attempt found no `isocan` on its PATH.

**Step 3, codex nested: not run.** codex is not installed on this machine
and has no login. On Linux codex sandboxes with Landlock and seccomp, not
`sandbox-exec`, so the nesting question is macOS's; unmeasured.

**A sixth thing, found while building the wrapper.** srt must be readable
INSIDE its own fence. `npx -y @anthropic-ai/sandbox-runtime` dies with "No
such file or directory" naming its own seccomp helper at a path that is
plainly on disk — because the npx cache lives under `$HOME` and the policy
denies `$HOME`, so srt's files vanish in the mount namespace srt itself
just built. Re-allowing the npm cache fixes it, and the same trap catches a
global install under nvm or fnm. Hence two things in the wrapper: it
resolves srt's package root and adds it to `allowRead`, and it looks for
srt on the PATH rather than fetching it.

**What this settles.** Layer 3 is real on Linux: the fence holds, the
daemon is reachable, the adapter runs, sessions resume. The cost is a
wrapper that knows six things — the IPv4 listener (until upstream fixes
it), `NO_PROXY` cleared and `NODE_USE_ENV_PROXY=1` inside, npm's proxy keys
and the registry domain for `npx`, the harness's own directory re-allowed,
and srt's own files re-allowed — and a dependency check that refuses rather
than running open. **Built the same day** as
`packages/cli/src/sandbox.ts`. macOS is still unmeasured, and the
recommendation stands: make the fence the default when step 1 holds there
too.

## What this leaves open

- Whether Claude's `sandbox.network.allowedDomains` accepts an IPv4 literal
  with a port (the IPv6 form is documented).
- codex: whether the adapter's per-turn `sandboxPolicy` overrides
  `CODEX_CONFIG`'s network permissions; the state of issue #33227.
- The official Antigravity ACP binary: modes, settings, sandbox — all
  unverified; the docs were unreachable.
- pi's proposed native `--mode acp` with an ask/code option (discussion
  #4444, July 2026): merged or not.
- **srt on macOS — the one measurement that gates the default.**
  `scripts/spike-srt.sh` is that measurement in one command: step 1, step 2,
  and with `--harness codex` step 3, against a throwaway daemon and home so
  it touches nothing of the person's. It prints a table and the sentence to
  paste back into this section. It also tries `allowLocalBinding`, which
  isocan deliberately does not use, so a broken proxy path on macOS would
  still be diagnosed rather than just failing.
- Whether pi's and codex's own clients honour the proxy variables on Linux
  the way the isocan CLI does; and whether srt's IP-literal allow-list
  resolves Claude Code issue #28018 (loopback blocked in the Bash sandbox,
  open as of February).
- An upstream issue worth filing: srt's Linux bridge uses
  `socat TCP-LISTEN`, which opens an IPv6 socket, and sends the listener's
  output to `/dev/null` — so on a kernel without IPv6 it fails with no
  diagnostic at all. `TCP4-LISTEN` is the one-word change that made the
  spike work.
- Keyring-backed logins (Antigravity, codex `keyring` mode) inside any
  fence that hides the secret service.


## Native Codex opt-in — 11 September

`rc --codex-sandbox` and `rc turn --codex-sandbox` now configure a separate,
opt-in native boundary. The default remains unchanged. A local
`codexSandbox: true` setting makes it persistent; `--unsandboxed` disables it
for a run. A request to combine native and outer srt fences is refused.

The measured adapter is **codex-acp 1.11.0**, bundling **Codex 0.153.4**.
The client checks the adapter version and refuses an older or unidentified
bridge. Both new and resumed ACP sessions receive the isocan state directory
as `additionalDirectories`; the enrollment directory is the workspace.
The adapter's misleadingly named `read-only` mode sends `workspaceWrite`
with a human reviewer. Its `agent` mode uses automatic approval review.
Native opt-in deliberately uses the former, and isocan rejects **every**
permission request in this mode, including `allow_once`. This prevents an
ordinary approval response from silently widening the selected sandbox.
The existing default permission behavior remains unchanged outside this mode.

The exact config used by this bridge enables
`sandbox_workspace_write.network_access` and
`features.network_proxy.enabled`, with `allow_local_binding: false` and an
explicit daemon-host allow entry. Additional exact hostnames come from local
`codexSandboxDomains`, such as `github.com` and `registry.npmjs.org`.
Existing Codex domain rules compose; this is not an assertion that the local
user's other allow entries were erased. Hosts are allowed, not individual
ports on a host. No unrestricted private-network exception is requested.

### What was run

`scripts/check-codex-sandbox.mjs` uses the bundled binary's **app-server
command/exec API**, without a model or login, and the same `workspaceWrite`
policy that the adapter sends. It creates synthetic workspace/state files
and a local HTTP listener, then removes them. `codex sandbox -P :workspace`
was the wrong instrument: in this version the explicit profile ignores
`sandbox_workspace_write.writable_roots`. The app-server path proves the
actual extra-root policy without weakening the test to put both roots in one
directory.

| Check | macOS 25.6 arm64 | Linux arm64 (Docker, Node 24 bookworm) |
| --- | --- | --- |
| Workspace and separate isocan-state writes | Allowed | Allowed |
| HTTP daemon request on explicit IPv4 loopback | Allowed | Allowed |
| npm registry lookup, with registry explicitly listed | Allowed | Allowed |
| Git status and GitHub ls-remote | Allowed | Allowed |
| Git metadata write (`git add`) | Refused | Refused |
| Write outside the workspace/state roots | Refused | Refused |
| Unlisted external host through proxy | Refused | Refused |
| Direct external request bypassing the proxy | Refused | Refused |
| Unlisted IPv6 loopback listener, bypassing proxy | Refused | Refused |

The Linux container mounted only the probe script, with no project or login
material. It needed permission to create its nested sandbox (`SYS_ADMIN` and
an unconfined container seccomp profile); these are test-container settings,
not changes to the host or to isocan's runtime policy. This is command-level
OS enforcement evidence, not a claim that a new authenticated model turn ran
on Linux. The earlier macOS ACP turn measurements established daemon reach;
the current fake-bridge tests pin directory propagation on new/resumed
sessions and refusal of escalation.

**Limits:** native mode does not hide file reads, fence the ACP adapter
process, or constrain separately configured MCP services. Git commits need
protected metadata writes and therefore fail in this mode. Report the
refusal rather than suggesting a tool bypass. A second-user recipe and a
unified enrollment reach policy remain separate work (owner-only summons
was built the same day, below). The [official permission documentation](https://learn.chatgpt.com/docs/permissions)
also distinguishes tool sandboxing from other integrations; configuration
syntax must be checked against the binary the ACP bridge actually bundles.

The outer fence was measured separately with
`PATH=<temporary srt bin>:$PATH bash scripts/spike-srt.sh --no-harness`:
**srt 0.0.76 on macOS, eight checks held and none broke**, including the CLI's
identity request, `wait` parking, hidden home canary and unlisted-host refusal.
The probe now creates a unique canary, so rerunning it cannot overwrite an
older probe's file. Linux outer-fence and real Claude-turn evidence remains
in the earlier section; native/outer nesting is still unverified and refused.


## Owner-only summons — 11 September

Decided by Dion the day after this note, and built: **a parked agent
answers only its owner unless its owner widens it.** Layer 1's third item and
recommendation 6, and agent-custody's oldest open question ("whose ask a
parked rc honors").

**Who the owner is.** The person whose machine answers — the rc's home
identity (`~/.isocan/identity.json`, claimed on the machine's badge under
`home:person`) — compared through `actor.join`, so the same person under a
second, joined identity counts. Not whoever wrote the enrolment: an agent can
enrol an agent, and the web's add is an ask the rc completes; the bill is the
machine's person's, and only the machine can say who that is. Every other
actor the rc's badge speaks as (`actorBindings()`: the agents it answers
for, the person's own interactive sessions) is the owner's hands — they run
on the same machine and tokens already, so two agents on one laptop keep
asking each other things, with the cycle guard still bounding the chain.

**Where the gate lives.** At the rc's dispatch, because only the rc starts a
turn. The home never enforces (it starts nothing, and a comment is still a
comment); it carries the words. The shape reuses the 9 Sep gate rather than
adding a second one: `AgentRules.listen` is read through its owner by
`answerPolicy` in core — absent or empty means **the owner alone** (it meant
everyone from 9 to 11 Sep), a list means the owner and those people, `["*"]`
means everyone — and `dispatchReason` applies that value before the
composition, where a mention cannot pierce it and nothing is counted
against the ceiling. A `wait` park, which answers for itself, keeps the old
reading.

**The word, not the mouth.** Walking it in a browser found the hole the
hands leave: a stranger's Chat line, turned away by Sian, woke Percy (open to
everyone), and Percy's reply — the owner's machine talking — woke Sian
anyway. So the rc records whose asks started each agent's turn
(`speakersFor`, followed through agents), and the gate reads the word an
agent's op carries (`onBehalfOf`) rather than the agent that wrote it.

**How it is said.** The rc announces its owner and each agent's policy with
its hold (`RcHoldRequest.owner/policies`), relayed up the home-link beside
the faces with the owner vouched like a face, and read back from
`GET /api/projects/:id/rc`. `isocan who`, `agent rules`, `rc listen`, the
tray and the add dialog read that, not the stored field. A mention from
outside the gate is answered in its thread in the system voice, naming the
owner and the exact command — once per thread and asker, and not repeated by
a restarted rc; the CLI prints the same sentence as a non-owner posts, the
web shows it under the comment instead of *Sent*, a row no longer promises
*answers if you comment* to a reader outside, and `summonsState` gained a
`refused` state that is never *nothing answered*. Only mentions get words —
the Chat being loud is the room.

**How it widens.** `isocan rc listen <name> --to <names>|everyone` (the
owner's verb, refused inside a harness session), `--listen` on `rc add` /
`agent add`, and *Let anyone ask* on the owner's own row in the tray — all
the same `agent.enroll`. No new op; the vocabulary stays at 33. And **only
the owner's word widens**: the gate sits in a record every admitted member
can write, so the reducer now stamps `writtenBy` on the enrolment row, and
the rc honours a stored gate only when the owner (or the owner's machine)
wrote it, saying so when it sets one aside. Rows from before the stamp are
taken as they stand. The ask to add an agent follows the same rule: the home
routes it only to an rc its asker owns and refuses anybody else with the
owner's name (`not-your-rc`), and the rc refuses it again where the machine
is.

**Migration.** The default is the migration: an enrolment with no gate —
every one written before 9 Sep — answers its owner alone from the first rc
on this build, which says so at start, per agent. The repo's own machinery
was walked for anything that relied on waking somebody else's agent, and
nothing did; the day's changelog walks each (the night, sprints, the design
competition, personas, the sheep harness).

**Left open.** The owner is one person per machine; a team box whose
machine identity is a service account has to name its people (`--to`) or
open itself (`--to everyone`). A person's web identity that is neither the
same actor as their machine nor joined to it reads as a stranger to their
own rc — the refusal names the owner, which is the hint, and `actor.join`
is the fix. Widening from the web offers everyone-or-only-me; naming people
is the CLI's. And the provenance is the rc's memory: an rc restarted in the
middle of a chain reads an open sibling's backlog as its owner's machine
talking (the walk saw exactly that, and the cycle guard stopped it at
three), and an interactive session on the owner's machine that a stranger
talked into mentioning a gated agent is read as the owner's hand — nothing
records whose word it carries.


## Granting from the UI — 11 September, the same evening

The gate above shipped in the afternoon and was proved by the first thing it
refused. Dion asked Lamb — Dimitri's sheep-harnessed agent — for a canvas,
nothing woke, and the thread said so correctly and completely, in a command
line he could not run. *"Maybe we can have UI that lets you give me access to
a lamb … instead of just saying the command line lol"* is issue #272, and its
answer is one sentence: **the refusal is the control.**

**Where the control is.** Under the refusal, which is already a system
comment in the thread where the asking happened, and only for the owner —
the person the announced policy names. Nobody else's screen changes; a
stranger keeps reading the words, which were already the right words. This
is the same rule as everything else in this note, applied to pixels: *never
render a control to somebody whose click would be set aside*, because the rc
discards a gate its owner did not write and a discarded click is worse than
no button.

**What the click writes.** The same `agent.enroll` `rc listen --to` writes,
computed by the same function in core (`withListener`) — appended to the gate
that already STANDS (`RcPolicy.listen`, the announced value) rather than to
the stored field, so a grant can never quietly resurrect a gate the rc had
set aside. Still no new op; the vocabulary stays at 33.

**What the thread shows afterwards.** A line, not a comment. The enrolment op
is the record already; what the thread needed was for the refusal above to
stop reading as true, so the same place says *Lamb listens to you now — ask
again*. Recognising the refusal to sit under is core's job too
(`readsAsTurnedAway`, one phrase shared by the writer and the reader), rather
than a marker bolted onto what a comment is.

**Naming people, from the web.** The tray's two-position toggle becomes the
gate itself: everybody here, each a checkbox, plus *anyone*, worded by
`policyWords`. This closes "widening from the web offers
everyone-or-only-me" above — and it closes it in the direction the story
asked for, since the case that produced the issue was one person wanting one
other person let in.

**How long, and where the expiry lives.** A grant may carry one, and
`docs/research/2026-09-11-per-asker-scopes.md` asked that `listen` stop being
a list of strings **exactly once**, becoming an entry per name. It has:
`ListenEntry` is an actor id, or `{ id, until }`, and `ListenGrant` —
`parseListen`'s reading of either — is the single shape a plain grant and an
expiring grant both take.

The first attempt packed the date into the string (`usr_dion until <ISO>`),
and it was wrong for a reason worth keeping written down: **a gate that fails
by accident, in either direction, is exactly what this field exists to
prevent, so the failure has to be one a compiler can see.** With `string[]` a
reader that forgets to parse compiles fine and silently matches nobody; with
the union it is a type error, which is how the three call sites outside core
were found. The other half is what an older build does with an entry it does
not understand: `rulesOf` has always kept only strings in this list, so the
object is dropped whole — the grant is absent, the agent answers its owner
alone, and nothing anywhere renders half a date as a person's name. Fail
closed, tested as such (`packages/core/test/agents.test.ts`, "is dropped
whole by a reader that has never heard of expiry").

There is no migration to write, because both shapes are read and a grant with
no expiry is still a bare id — so every gate written before today is
unchanged, and one that gains no expiry stays byte-identical. A sibling
`until` map beside `listen` was the third option and the only unsafe one:
`rulesOf` drops keys it does not know, so an older build would have gone on
honouring a grant that lapsed a month ago — a gate failing OPEN on the one
field that decides who may spend somebody's tokens.

A lapsed grant refuses in the words a gate that never had one would use, plus
one sentence saying it lapsed: *"you were never let in"* and *"you were,
until Tuesday"* have different next moves, and only the second is the owner's
to repeat.

**Left open, still.** The mockup's other two switches — *create and edit
items* and *run shell commands* — are deliberately not built: what an agent
MAY DO is its rung on the canvas and the fence on its owner's machine,
neither of which is per-asker, and a capability that travels with a summons
does not exist anywhere today. Shipping it as a switch that silently did
nothing would be worse than not having it; it is the missing half of compute
consent, and `docs/research/2026-09-11-per-asker-scopes.md` (#273) is the
note that examined it and declined it for now. The panel says so in one line
rather than leaving the absence to be read as an oversight: *a grant decides
whether this agent answers this person; what it may do here is its own rung
on this canvas.* And a grant's expiry is read
against each reader's clock: the gate is applied at the rc, so the rc's clock
is the one that decides, and a tray a minute behind may still show a grant
the rc has already let lapse.
