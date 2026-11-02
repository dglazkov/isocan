# An agent that holds no secret — the three shapes

**18 September 2026.** Phase 5 of [phases.md](phases.md) opens here and stops:
design.md's open door 3 says the shape of this is Dimitri's, because it changes
*when the CLI refuses for want of an identity*, which is a design call and not
plumbing. This names the three, recommends one, and says what each costs.

## The debt

Journey 2. The agent in #332 runs in a sandbox with no secret of her own: her
badge is held outside, and the egress proxy puts `Authorization` on requests to
the home. Today isocan cannot be told that.

- `requireIdentity()` refuses without a local identity — no TTY, so it throws
  `noIdentityHere`'s sentence. The sandbox was handed a **hand-written
  `~/.isocan/identity.json` with a placeholder secret** and a hand-written
  direct-mode `config.json`.
- And `isocan direct` said nothing answered until `NODE_USE_ENV_PROXY=1` was
  set, because `platformFetch` is Node's `fetch` and Node's `fetch` ignores
  `HTTPS_PROXY` without that flag.

Two problems that arrive together and are separable: **who she is**, and **how
her requests get out**. The second has one answer and no decision in it.

## The part with no decision in it: the proxy

`packages/api/src/routes.ts` exports `platformFetch`, one line, and every
request goes through it. undici is already a dependency and ships
`EnvHttpProxyAgent`, which reads `HTTP_PROXY`, `HTTPS_PROXY` and `NO_PROXY`.
Installing it as the global dispatcher when a proxy variable is set makes
`HTTPS_PROXY` work with no second variable, and changes nothing on a machine
with no proxy set. Recommended regardless of which shape below is chosen.

The refusal matters as much as the plumbing: when the proxy is down, the line
an agent reads should name the proxy, not the home.

## The three shapes

### 1. Environment variables

`ISOCAN_ACTOR_ID`, `ISOCAN_ACTOR_NAME`, `ISOCAN_HOME`, and one switch saying
authorization is added upstream (`ISOCAN_BADGE_UPSTREAM=1`). When the switch is
set the CLI reads and writes no `identity.json` and sends no `Authorization` of
its own.

- **For:** nothing to write, nothing to clean up, and a sandbox's launcher
  already speaks environment. It composes with `ISOCAN_DIRECT`, which is how
  these machines are already told they run no daemon. The harness variables the
  CLI already reads (`harnessVars`) are the same shape, so this is a
  vocabulary the codebase has.
- **Against:** a variable is invisible in a shell transcript, so "why does
  isocan think I am somebody else" is answered by `env`. Four variables is
  three more than a person wants to type.

### 2. A flag on `isocan direct`

`isocan direct --as <id>:<name> --badge-upstream`, persisted into the
directory's `config.json` the way direct mode already is.

- **For:** it is a gesture somebody made on purpose, and it is visible — the
  file says what this machine believes. `direct.ts`'s own argument is that
  this property is "declared and never guessed", and a flag is a declaration.
- **Against:** a sandbox with a fresh disk runs that command every time, which
  is a command in the first minute — the thing this project exists to remove.
  And it splits the answer across a file and an environment.

### 3. A config file isocan writes

`isocan identity adopt --upstream` writes an `identity.json` with no secret in
it and a flag saying so.

- **For:** one file, the existing shape, and `resolveIdentity` already reads
  it. Nothing new to teach the rest of the CLI.
- **Against:** it is the hand-written file with a blessing, and it puts a
  *write* in the first minute of a machine whose disk does not survive. It also
  invites the question the placeholder secret already invited: what happens
  when something tries to use it.

## Recommended: shape 1, with shape 2 as the way a person does it

The sandbox in #332 is *launched*, not *operated* — nobody types in it, and its
disk is gone tomorrow. Environment is the only one of the three that costs
nothing at boot and leaves nothing behind. Shape 2 remains worth having later
as the thing a person runs on a machine they own, and it can write the same
values; it is not needed to close journey 2.

**What this changes about refusing.** `requireIdentity` today asks "is there an
identity file?". With shape 1 it asks "is there an identity *or* a statement
that one is held upstream?", and the sentence it throws when neither is true
should name both ways in. That is the part worth reading twice before saying
yes: every machine that currently gets a clear refusal will now get a refusal
with a second option in it, and a machine that sets the variables wrongly will
be refused by the *home* rather than by the CLI — further away, with a worse
sentence.

## What phase 5 builds once this is settled

The chosen mode documented in the guide; the CLI in that mode reading and
writing no `identity.json` and sending no `Authorization` of its own;
`EnvHttpProxyAgent` installed when a proxy variable is set. The proof is a test
with an empty `HOME`, the mode's inputs set, and a local proxy that adds the
`Authorization` header: `isocan ls` against a scratch home succeeds through the
proxy, and fails with a line naming the proxy when the proxy is down.
