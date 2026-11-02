---
status: partial
since: 2026-09-30
issue: 332
see: auto-upgrade, room, iso-api, harnesses
note: designed 18 Sep 2026 from #332; phases 0 to 5 built (phases 4 and 5 completed 30 Sep 2026). Measured in a container close to #332's (`node scripts/first-minute.mjs`): install went from 14.2 s / 227 packages / 115 MB to **4.1 s for 3 packages and 22 MB**, `isocan --version` from 1.12 s to **0.10 s** (49 file opens vs 4397). Phase 4 cut `isocan --agent-help` into a <3,500-token cold start + topic index (`--agent-help <topic>`) and wired `SummonsContext` into `isocan rc` so a summons carries the thread's earlier comments, the anchored item's `id`, `kind`, and `title`, and the non-owner standing sentence (#273). Phase 5 added `ISOCAN_BADGE_UPSTREAM=1` with `ISOCAN_ACTOR_ID` and `ISOCAN_ACTOR_NAME` (reading and writing no `identity.json` and sending no `Authorization` of its own) and `EnvHttpProxyAgent` proxy routing (`HTTPS_PROXY` / `HTTP_PROXY` / `NO_PROXY` without `NODE_USE_ENV_PROXY`, naming the proxy when it is down). Only Phase 6 (walking journeys 1–3 in `dglazkov/isocannery`'s sandbox) remains
---
# The first minute — the journeys

**18 September 2026.** Three journeys, each a thing the agent in
[#332](https://github.com/dglazkov/isocan/issues/332) does in the first minute
of a turn, with the number that says it is fixed. She runs in a hosted sandbox:
4 cores, a slow file system, a fresh disk every so often, an egress proxy as
her only way out, and a badge held outside the sandbox. The numbers on the
"today" lines are the issue's, measured 18 Sep 2026 from isocannery's walk.
The targets are proposed, not decided.

## 1. She arrives

A new sandbox has Node and nothing else. She runs one install line and then
her first command.

- **Today:** `npm install -g github:dglazkov/isocan#release` takes 35 s and
  installs 227 packages. It is the one thing that puts a cold reply over a
  minute.
- **Target:** install in under 5 s, with no dependency to resolve.
- **Today:** every command takes 2 to 4 s to start, `isocan --version`
  included (3.3 s), where a `fetch` of the same home from the same sandbox
  takes 1 s. A turn of five commands spends 10 to 15 s starting the CLI.
- **Target:** `isocan --version` in under 0.5 s in that sandbox, and a command
  that talks to the home costs the network call plus that.

## 2. She is herself

Her badge is outside the sandbox: the proxy sets `Authorization` on requests
to the home. She holds her public ids and no secret.

- **Today:** the CLI refuses without a local identity, so the sandbox is
  handed a hand-written `~/.isocan/identity.json` with a placeholder secret
  and a hand-written direct-mode `config.json`. And `isocan direct` says
  nothing answered until `NODE_USE_ENV_PROXY=1` is set, because the CLI's
  `fetch` ignores `HTTPS_PROXY`.
- **Target:** she says who she is and where her home is in a way isocan
  documents and tests, writes no file by hand, and `HTTPS_PROXY` is honoured
  with no extra variable.

## 3. She wakes to "make it blue"

A person comments on an item. The rc summons her with that comment.

- **Today:** the summons points her at `isocan --agent-help`, which is 210 KB
  with module guides, about 50k tokens, carried again on every model call of
  the turn. The summons has the one comment and not the thread or the item,
  so she runs `comment list` and `get` before she can start. In the 146 s
  turn, three of her ten shell calls were `--help`.
- **Target:** what she must read before acting is under 8k tokens; the rest
  is reachable by topic. The summons carries the thread and the item it is
  on, so "make it blue" is answered in three shell calls or fewer: the edit,
  the reply, the wait.

## What the journeys force

1. A release CLI that is one file, started without a transpiler.
2. An install with no dependencies to resolve and no files an install does
   not run.
3. A guide in tiers, with the test that every verb is described somewhere
   kept.
4. A summons that carries its own context.
5. A supported identity for an agent that holds no secret, and a `fetch` that
   honours the proxy environment.
6. A guard in the suite for 1 and 3, so the next forty features do not undo
   them. The laptop hides all of this; a number in a test does not.
