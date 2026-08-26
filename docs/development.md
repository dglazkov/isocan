# Develop isocan

This guide explains how to set up a development environment for the isocan
repository, run the app locally, and make changes to it.

It covers two starting points, one for each developer currently working on the
project:

* **A new machine**, with nothing installed. This is Paul's setup. See
  [Set up a new machine](#set-up-a-new-machine).
* **An existing setup from before the multi-user work**: a local daemon that
  serves pages, and canvases created before homes existed. This is Dion's
  setup. See [Upgrade an existing setup](#upgrade-an-existing-setup).

Read the section that matches your machine, then read
[Development practices](#development-practices) and
[Troubleshooting](#troubleshooting), which apply to both.

This guide is about working *on* isocan. To start a project *on a canvas*, see
[Starting a project on a canvas](new-project.md).

## Before you begin

Install:

* Node.js 24
* Git

In this guide, `isocan` refers to the CLI in your checkout:

```sh
node packages/cli/bin/isocan.js
```

To shorten the commands, create an alias for your current shell session:

```sh
alias isocan="node $PWD/packages/cli/bin/isocan.js"
```

**Caution:** Don't add this alias to your shell profile, and don't rely on a
globally installed `isocan`. A global install can be a different build than the
code you're editing. When the two differ, your changes appear to have no
effect.

## Key concepts

| Term | Meaning |
| --- | --- |
| Canvas | The unit of work. Each canvas has exactly one home. |
| Home | The daemon or server that owns a canvas and orders its writes. |
| Marker | `.isocan/project.json` in a working directory. Records the canvas ID and, optionally, its home address. |
| Birth default | The home where *new* canvases created on this machine are born. Set with `isocan home <url>`. On a machine that has never held a canvas, an INSTALLED `isocan setup` now writes `https://isocan.io` here for you (phase 14) — **a checkout does not**, which is why the steps below have you set it by hand. |
| Replica | A daemon that holds a copy of a canvas whose home is elsewhere. |

A single daemon can be the home of some canvases and a replica for others at
the same time.

A marker with no home address means the local daemon is that canvas's home.
The daemon records each canvas's home in `~/.isocan/homes.json`. A canvas with
no entry in that file is local.

## Set up a new machine

### 1. Clone and install

```sh
git clone https://github.com/dglazkov/isocan.git
cd isocan
npm install
npm run build
```

`npm run build` builds the web app into `packages/web/dist`, which the daemon
serves.

**Note:** `npm install` might modify `package-lock.json`. To discard those
changes, run `git checkout package-lock.json`.

### 2. Create your identity

```sh
isocan identity --home --name "Paul"
```

The `--home` flag identifies you as the owner of the machine.

**Note:** Without `--home`, the command tries to identify the *agent* running
it and fails if no agent is configured. Inside a Claude Code or Codex session,
`--session` is implied. In that case, running `isocan identity` in an unbound
directory also creates a canvas named after that directory.

### 3. Create a local canvas

```sh
isocan canvas create "Acme Scratch"
```

This canvas is local, because you haven't set a birth default yet. Use it to
develop the web UI.

**Important:** Create this canvas before you set a birth default in step 5. A
daemon that has a birth default and no local canvases serves no pages. If you
set the birth default first, `http://localhost:4441/` and all `/p/<id>` paths
return 404, and you have nowhere to run the web UI.

### 4. Start the development servers

```sh
npm run dev
```

This starts the daemon on port 4441 and Vite on port 5173 with hot reload.

Open `http://localhost:5173`.

**Caution:** Use `localhost`, not `127.0.0.1`. Vite binds the hostname, which
resolves to `::1`, so `http://127.0.0.1:5173` doesn't respond. The daemon
answers on both addresses, so the numeric form works everywhere except here.

To open a specific canvas, run `isocan open`. It prints and opens the correct
address for that canvas.

### 5. Create a canvas at dev.isocan.io

`dev.isocan.io` is the shared development home. Set it as your birth default,
then create a canvas there:

```sh
isocan home https://dev.isocan.io
isocan canvas create "Widget Redesign"
isocan --canvas "Widget Redesign" share
```

The `share` command prints the canvas address:

```
address  https://dev.isocan.io/p/prj_mj246fKBrV
link     on — anyone with the address can enter (granted 2026-08-24)
```

Open that address in a browser. Writes from your terminal go through your local
daemon to dev:

```sh
isocan --canvas "Widget Redesign" add notes.md --title "Acme spec"
```

### 6. Verify your setup

```sh
isocan home
```

The output lists every canvas and its home:

```
role           home of 1 canvas; replica of https://dev.isocan.io (1); new canvases → https://dev.isocan.io
birth default  https://dev.isocan.io — a canvas born here is born there; nothing already here moved
answering      yes — https://dev.isocan.io is up

canvases
CANVAS           ID              HOME
Acme Scratch     prj_lGBWI…      here — this daemon is its home
Widget Redesign  prj_mj246…      https://dev.isocan.io
```

You now have one daemon serving two canvases with different homes. Use the
local canvas to develop the web UI. Use the dev canvas to test changes against
a real home, which exercises Firestore, a load balancer, and network latency
that loopback connections don't reproduce.

Requesting the dev-homed canvas from your local daemon returns a signpost
instead of the canvas:

```
$ curl -i http://127.0.0.1:4441/p/prj_mj246fKBrV
HTTP/1.1 404 Not Found
x-isocan-home: https://dev.isocan.io

this canvas lives at https://dev.isocan.io — open it there
```

This is expected. Each canvas has exactly one address. The web app performs the
same check before mounting, so a link to a canvas that lives elsewhere renders
a signpost page instead of opening a connection.

### 7. Verify the round trip

To confirm that writes reach the home, read them back from a separate machine
that has only ever contacted the home:

```sh
isocan --canvas "Widget Redesign" pass
cd /some/empty/dir
npm --prefix ~/src/isocan run dev:replica -- setup 'https://dev.isocan.io/p/<id>#<pass>'
npm --prefix ~/src/isocan run dev:replica -- --canvas "Widget" ls
```

The item you added appears on a scratch machine with its own state directory,
its own credentials, and no access to your disk.

## Upgrade an existing setup

This section is for a machine that ran isocan before the multi-user work
landed: a daemon on port 4441, canvases created on that machine, and markers
that contain a canvas ID and title but no address.

### You don't need to do anything

Your existing canvases continue to work:

* They open in a browser at `http://127.0.0.1:4441/p/<id>`.
* `isocan add` still writes to them.
* `isocan open` still opens them.

A marker with no address means the local daemon is that canvas's home, so those
canvases need no entry in `~/.isocan/homes.json`.

Running `isocan home` on an unchanged setup lists every canvas as local:

```
$ isocan home
role           home — this daemon holds the canvases and serves the app at http://127.0.0.1:4441
birth default  here — a canvas born here stays here

canvases
CANVAS             ID              HOME
Acme Sprint Board  prj_J6Zl-7hUYu  here — this daemon is its home
Widget Redesign    prj_LhBFoZ_0Dq  here — this daemon is its home
```

The report lists the canvases the daemon holds, not the entries in
`homes.json`. On this setup that file is empty (`{}`), because a canvas with no
entry is local.

**Note:** Phase 6 stopped local daemons from serving pages. Phase 10.3 restored
this for the canvases a daemon is the home of. A daemon serves the app for its
own canvases and returns a signpost for canvases hosted elsewhere.

### What changed in `isocan home`

`isocan home <url>` no longer re-points your machine. It sets the birth default,
which affects only canvases created from that point on. Canvases you already
have stay where they are.

Without arguments, `isocan home` reports the home of each canvas:

```
$ isocan home
role           home of 2 canvases; replica of https://dev.isocan.io (1); new canvases → https://dev.isocan.io
birth default  https://dev.isocan.io — a canvas born here is born there; nothing already here moved
answering      yes — https://dev.isocan.io is up

canvases
CANVAS           ID              HOME
Acme Sprint      prj_Le8Xz…      here — this daemon is its home
Widget Redesign  prj_mj246…      https://dev.isocan.io
```

**Note:** If your `config.json` already contained a `home` value from an
earlier version, the first upgraded daemon records your existing canvases as
living at that home. This preserves the behavior you had before the upgrade.

### Limitation: you can't move a canvas to a home

You can create new canvases at a home, and you can share a home-hosted canvas
with another of your machines using `isocan pass`.

You can't move an existing local canvas to a home. That operation is adoption,
it's planned for phase 13, and it doesn't exist yet. There's no command, flag,
or supported manual edit.

To get local work onto a hosted home today, create a new canvas at that home
and copy the content across.

## Use the scratch replica

`npm run dev:replica` starts a daemon with an isolated state directory
(`.dev-replica/`, git-ignored) and no stored credentials.

Use it when you're working on the home, on grants, or on anything where
credentials accumulated on your main machine could mask a bug.

```sh
npm run dev:replica                                 # scratch replica of dev, on port 4442
npm run dev:replica -- ls                           # run any CLI command against it
npm run dev:replica -- setup <home>/p/<id>#<pass>   # add a canvas to it
```

The replica starts with no canvases. It receives only the canvases it's granted
access to.

**Caution:** Don't run the `setup` command from a directory that's already
bound to a canvas, such as the repository root. The command redeems the pass
*before* it detects the conflict, so the pass is consumed and you need a new
one. Run it from an empty directory:

```sh
npm --prefix <checkout> run dev:replica -- setup <home>/p/<id>#<pass>
```

## Development practices

### Don't export ISOCAN_* variables

Use `isocan home` to configure the daemon. Don't export `ISOCAN_*` variables in
your shell.

`ISOCAN_HOME_URL` takes precedence over `config.json` and is inherited by any
daemon the CLI starts. A shell with this variable set disagrees with the
configuration file for as long as that shell exists.

`isocan home <url>` refuses to write the configuration file while the variable
is set:

```
error: ISOCAN_HOME_URL=… is set in this shell and wins over the config file —
unset it first (`unset ISOCAN_HOME_URL`), then run this again
```

Two components set these variables for a single child process, which is
supported: `scripts/dev-replica.mjs` and the test suite.

If you're about to type `export ISOCAN_`, use `isocan home`, the `--port` flag,
or `npm run dev:replica` instead.

### Understand the deploy pipeline

The repository uses three branches:

| Branch | Contents | Written by |
| --- | --- | --- |
| `main` | Source. | You |
| `green` | The most recent commit that passed CI. | CI |
| `release` | The published CLI. | CI |

Edit `main` only. CI generates `green` and `release`.

On every push to `main`,
[`release.yml`](../.github/workflows/release.yml) runs `npm test` with
`ISOCAN_REQUIRE_EMULATOR=1`, then `npm run typecheck`. If both pass, it
fast-forwards `green` to that commit. Cloud Build deploys `dev.isocan.io` from
`green`.

`ISOCAN_REQUIRE_EMULATOR=1` turns a skipped Firestore suite into a failure. The
same suites skip locally and report what they didn't check.

The fast-forward uses `git push` without `--force`. If `green` already points
at a commit that yours doesn't descend from, the push fails, CI logs a warning,
and the deployed home stays where it is.

**Note:** Since 2026-08-24, pushing to `main` doesn't deploy on its own. Expect
a delay of roughly one CI run, and no deployment at all if CI fails. Check
`gh run list --workflow=release.yml` before the build history.

### Repoint the deploy trigger

If you need to change which branch Cloud Build watches, note the following:

* `infra/provision.sh d` can't modify an existing trigger. The script exits
  when a trigger is already present.
* `gcloud builds triggers update github` returns `INVALID_ARGUMENT` for this
  trigger, because it was created through the GitHub App and identifies its
  repository as `github.owner/name` rather than as a `repository` resource.

Use `gcloud builds triggers import` with the full resource definition, and keep
the `id` field so the trigger updates in place instead of creating a second
one.

**Caution:** Quote the `_DEPLOY` value as `"yes"` in the import file. Unquoted,
`yes` is a YAML boolean. `cloudbuild.yaml` tests `[ "${_DEPLOY}" != "yes" ]`, so
an unquoted value produces a pipeline that builds, pushes, reports success, and
deploys nothing. Verify with `--format=json`, because the YAML output prints
`yes` for both the string and the boolean.

## Provisioning access

Dimitri administers the `isocan-io-dev` Google Cloud project, which belongs to
the `glazkov.com` organization. Steps in `infra/` and in planning documents are
marked **⚑ provision** when they create or modify cloud resources. Those steps
require his approval before they run.

There's no second operator, which is why `infra/` contains idempotent shell
scripts rather than Terraform. See [`infra/README.md`](../infra/README.md) for
the reasoning and `infra/provision.sh` to run a stage. The "what needs a human"
table in that README lists the steps no script can perform, including billing,
DNS, GitHub OAuth consent, and certificate provisioning.

## Troubleshooting

### A daemon points at dev unexpectedly

**Cause:** `ISOCAN_HOME_URL` is exported in your shell. It overrides
`config.json` and is inherited by the daemon.

**Fix:** Run `unset ISOCAN_HOME_URL`, then verify with `isocan home`. Each local
canvas should show `here — this daemon is its home`.

### A health check reports a live home as down

**Cause:** The check requests `/healthz`. Google's frontend intercepts that
exact path on `*.run.app` hosts and returns its own 404, so the request never
reaches the container.

**Fix:** Use `/api/healthz`, which returns the same response on a path that
Google forwards. The uptime check and the Cloud Run smoke test use it.

**Note:** Measured on 2026-08-24, `https://dev.isocan.io/healthz` returns 200
through the load balancer, so the interception isn't visible at that address.
Use `/api/healthz` anyway: a home's address is configurable, a bare Cloud Run
URL is valid, and a health path must work for every address.

### `scripts/new-project.sh` doesn't exist

**Cause:** [`new-project.md`](new-project.md), `README.md`, and `AGENTS.md`
reference this script, but it isn't in the repository or its history.

**Fix:** Follow the manual steps in [`new-project.md`](new-project.md), which
are correct and complete. Dion owns this script; don't recreate it.

### The web UI doesn't load at `127.0.0.1:5173`

**Cause:** Vite binds `localhost`, which resolves to `::1`. The daemon answers
on both addresses, so only Vite is affected.

**Fix:** Use `http://localhost:5173`.

### A second checkout can't serve its own web UI

**Cause:** Vite proxies `/api` to a hardcoded `127.0.0.1:4441` in
`packages/web/vite.config.ts`. The `--port` flag moves the CLI and daemon but
not the proxy.

**Fix:** Edit `vite.config.ts`, or work in a single checkout.

### `isocan identity --name` returns an error

**Cause:** Without `--home` or a harness session, the command can't determine
which agent is running it.

**Fix:** Use `--home` to identify yourself as a person, or `--session` with a
session ID for an agent.

### `isocan home` reports `role unknown`

**Cause:** No daemon is running. `isocan home` doesn't start one.

**Fix:** This is expected behavior, not a broken installation. Start a daemon
with `npm run dev` or any other `isocan` command.

### A canvas created from the web UI doesn't appear in the list

**Cause:** On a machine with a birth default and local canvases, the web UI
creates the canvas at the birth default. The list shows only canvases the local
daemon hosts.

**Fix:** Open the canvas at its home address. This is a known issue, recorded
as an open finding in phase 10.3.

### A dev-homed canvas shows a signpost instead of the canvas

**Cause:** The local daemon isn't that canvas's home, so it doesn't serve its
pages.

**Fix:** This is expected. Open the canvas at its home address. Keep at least
one local canvas for web UI development.

## Related documentation

| Document | Contents |
| --- | --- |
| [`AGENTS.md`](../AGENTS.md) | House rules, and the checklist that keeps the CLI and web app in sync. |
| [`README.md`](../README.md) | What the product is and does. |
| [`architecture.md`](architecture.md) | What runs where — one map, all projects. |
| [`projects/`](projects/) | One directory per body of work: its journey, its phases, its designs. |
| [`projects/multiuser/phases.md`](projects/multiuser/phases.md) | The plan for the hosted, multi-user build: phases, status, and findings. |
| [`projects/multiuser/journey.md`](projects/multiuser/journey.md) | The target experience, written as scenarios. |
| [`reviews/lessons.md`](reviews/lessons.md) | Failure modes this codebase has produced, with the guard for each. |
| [`new-project.md`](new-project.md) | How to start a project on a canvas. |
| `isocan --agent-help` | The collaboration protocol, shipped with the CLI. |
