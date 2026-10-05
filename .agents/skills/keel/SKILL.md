---
name: keel
description: Start here in any repo with a .keel/keel.json, or when asked about its phases, the roadmap, lessons, the night shift, evidence, or keel itself — it says what keel is and where its instructions live.
---

# isocan is run with keel

`keel` keeps a project's working practice in its files: one phase file per
piece of work, status in that file's front matter, lessons as a table, and
evidence before anything is called built. The `keel` CLI installs that
practice, checks it, and keeps it current.

**The instructions live in the tool.** Run this first, once per session, and
follow what it says:

```sh
keel --agent-help
```

It ships with the CLI, so it describes the version you are running; this file
cannot fall behind it.

## If `keel` isn't there

Run it from GitHub with nothing installed: wherever a command says `keel`,
say `npx -y github:dalmaer/keel`.

```sh
npx -y github:dalmaer/keel --agent-help
```

To install it instead:

```sh
git clone https://github.com/dalmaer/keel <dir>
npm install -g <dir>
```

## Before you change anything

Read `AGENTS.md`; it is this project's working guide. Never edit
`docs/ROADMAP.md`, which is generated. `npm test && npm run typecheck` is the gate. Outward steps
(repos, secrets, issues on another repo, model spend) wait for the owner's yes.
