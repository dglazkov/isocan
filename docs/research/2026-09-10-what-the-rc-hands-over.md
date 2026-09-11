---
status: partial
since: 2026-09-10
see: on-demand, harnesses, agent-custody, standing-agents
note: Layers 1 and 3 built 11 Sep. Layer 1 — permissions answered by kind (the allow_once option, else the agent's own reject; a mode switch is never chosen) and the adapter's environment as a list rather than the whole shell. Layer 3 — `isocan rc --sandbox` fences every adapter in @anthropic-ai/sandbox-runtime with a policy derived from the enrolment, after a spike that measured the fence holding on Linux (the daemon reachable through srt's proxy, a real Claude turn completed, sessions resuming) and found SIX things a wrapper must know, each a silent failure otherwise: srt's Linux bridge dies unreported on a kernel without IPv6; `NO_PROXY` cleared and `NODE_USE_ENV_PROXY=1` inside; npm's own proxy keys for `npx`; the harness's config dir re-allowed or sessions never resume; and srt's own files re-allowed or it vanishes inside its own fence. Asked for and not buildable is a refusal, never a quiet unfenced run. Measured 10 Sep, before any of it: a summoned agent got `{ ...process.env }` minus harness variables, the person's shell on the host, every permission auto-allowed by a regex, codex forced to full access because its sandbox refused loopback, and any admitted member of a shared canvas could ring. macOS is the one gating measurement left — `scripts/spike-srt.sh` is it in one command — and codex nested with it. Still owed: a reach word on the enrolment translated per harness, the second-user recipe, owner-only summons
---

# What the rc hands over, and how to hand over less

**10 September 2026.** Research. **Layers 1 and 3 built 11 September.**
Layer 1 is in `acp.ts`: permissions answered by kind, the environment as a
list, with `config.json`'s `adapterEnv` hook for what the list does not
know. Layer 3 is `sandbox.ts`: `isocan rc --sandbox`, written from what the
measurement below found rather than from the documentation. Layer 2, the
second-user recipe and the consent default are owed — and so is the macOS
half of the measurement, which `scripts/spike-srt.sh` exists to get.

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
6. **Close the consent door** in agent-custody: owner-only summons by
   default. Reach limits bound what a turn may do; consent bounds who may
   start one, and a shared canvas makes the second question the sharper one.

What isocan should not do: own a Seatbelt profile, a bwrap line, or a
Landlock ruleset of its own. Those are srt with fewer maintainers, and the
constraint `harness.ts` already states — no adapter per harness — applies
to sandboxes too.

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
